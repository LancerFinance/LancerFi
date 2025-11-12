/**
 * Vercel Serverless Function for /api/admin/restrict-user
 * Handles user restrictions (mute, ban wallet, ban IP)
 */

// Vercel types - using any to avoid build errors (types are provided at runtime)
type VercelRequest = any;
type VercelResponse = any;

import { supabaseClient } from '../../server/services/supabase.js';
import { checkIPBanForVercel } from '../../server/middleware/ip-ban-check.js';

// Admin wallet address - only this wallet can access admin endpoints
const ADMIN_WALLET_ADDRESS = 'AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U';

// Helper to parse request body
async function parseBody(req: VercelRequest): Promise<any> {
  if (!req.body) {
    return {};
  }
  
  // If body is already an object, return it
  if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  
  // If body is a string, parse it
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  
  // If body is a Buffer, convert to string and parse
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString());
    } catch (e) {
      return {};
    }
  }
  
  return {};
}

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Check IP ban first - block all requests from banned IPs
  const isBlocked = await checkIPBanForVercel(req, res);
  if (isBlocked) {
    return; // Request already blocked
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse request body
    const body = await parseBody(req);
    const { walletAddress, profileId, restrictionType, expiresAt, reason, ipAddress } = body;

    console.log('Request received:', { walletAddress, profileId, restrictionType, hasBody: !!body });

    // Verify admin wallet
    if (!walletAddress) {
      console.error('Missing wallet address');
      return res.status(401).json({ error: 'Wallet address is required' });
    }

    if (walletAddress !== ADMIN_WALLET_ADDRESS) {
      console.error('Unauthorized wallet:', walletAddress);
      return res.status(403).json({ 
        error: 'Unauthorized: This wallet does not have admin access' 
      });
    }

    // Validate required fields
    if (!profileId) {
      console.error('Missing profileId');
      return res.status(400).json({ error: 'profileId is required' });
    }

    if (!restrictionType || !['mute', 'ban_wallet', 'ban_ip'].includes(restrictionType)) {
      console.error('Invalid restriction type:', restrictionType);
      return res.status(400).json({ error: 'Invalid restriction type. Must be mute, ban_wallet, or ban_ip' });
    }

    // Prepare restrictions object
    const restrictions: any = {
      restriction_type: restrictionType,
      restriction_expires_at: expiresAt || null,
      restriction_reason: reason || null
    };

    if (restrictionType === 'mute') {
      restrictions.is_muted = true;
      restrictions.is_banned = false;
    } else if (restrictionType === 'ban_wallet') {
      restrictions.is_banned = true;
      restrictions.is_muted = false;
    } else if (restrictionType === 'ban_ip') {
      // IP ban also applies wallet ban (prevents the wallet from doing anything)
      restrictions.is_banned = true;
      restrictions.is_muted = false;
    }

    console.log('Updating profile:', profileId, 'with restrictions:', restrictions);

    // Helper function to get client IP from request
    function getClientIP(req: VercelRequest): string | null {
      // Check various headers for IP (handles proxies/load balancers)
      const forwarded = req.headers['x-forwarded-for'];
      const realIP = req.headers['x-real-ip'];
      const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
      
      if (typeof forwarded === 'string') {
        // x-forwarded-for can contain multiple IPs, take the first one
        return forwarded.split(',')[0].trim();
      }
      
      if (typeof realIP === 'string') {
        return realIP;
      }
      
      if (typeof cfConnectingIP === 'string') {
        return cfConnectingIP;
      }
      
      // Fallback to connection remote address
      return req.socket?.remoteAddress || req.ip || null;
    }

    // Get user profile first to get wallet_address and last_ip_address
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('wallet_address, last_ip_address')
      .eq('id', profileId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({ 
        error: 'Failed to fetch user profile', 
        details: profileError.message,
        code: profileError.code
      });
    }

    // Handle IP ban FIRST (before updating profile) to validate IP exists
    // This ensures we don't apply wallet ban or send message if IP ban fails
    if (restrictionType === 'ban_ip') {
      // Get IP address: use provided IP, or user's last known IP from profile, or from recent projects
      let ipToBan = ipAddress?.trim();
      
      if (!ipToBan && userProfile?.last_ip_address) {
        ipToBan = userProfile.last_ip_address;
        console.log('Using user\'s last known IP address from profile:', ipToBan);
      }
      
      // If still no IP, check user's recent projects for their IP
      if (!ipToBan && userProfile?.wallet_address) {
        try {
          const { data: recentProject, error: projectError } = await supabaseClient
            .from('projects')
            .select('client_ip')
            .eq('client_id', userProfile.wallet_address)
            .not('client_ip', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (!projectError && recentProject?.client_ip) {
            ipToBan = recentProject.client_ip;
            console.log('Using IP address from user\'s recent project:', ipToBan);
            
            // Also update the profile's last_ip_address for future reference
            await supabaseClient
              .from('profiles')
              .update({ last_ip_address: ipToBan })
              .eq('id', profileId);
          }
        } catch (projectLookupError: any) {
          console.error('Error looking up user IP from projects:', projectLookupError);
          // Continue without failing
        }
      }
      
      // If no IP found, return error BEFORE applying any restrictions
      if (!ipToBan) {
        console.error('Cannot ban IP: No IP address found for user');
        return res.status(400).json({ 
          error: 'Cannot ban IP: No IP address found for user. The user has no recorded IP address in their profile or recent projects. Please manually enter an IP address to proceed with the IP ban.',
          suggestion: 'You can manually enter the IP address in the IP Address field, or the system will attempt to find it from the user\'s profile or recent projects.'
        });
      }
      
      // Ban the IP address
      try {
        const { error: ipBanError } = await supabaseClient
          .from('banned_ip_addresses')
          .upsert({
            ip_address: ipToBan.trim(),
            expires_at: expiresAt || null,
            reason: reason || null,
            banned_by_wallet: walletAddress
          }, {
            onConflict: 'ip_address'
          });
        
        if (ipBanError) {
          console.error('Error banning IP:', ipBanError);
          return res.status(500).json({ 
            error: 'Failed to ban IP address', 
            details: ipBanError.message,
            code: ipBanError.code
          });
        }
        
        console.log('IP address banned successfully:', ipToBan);
      } catch (ipBanError: any) {
        console.error('Exception banning IP:', ipBanError);
        return res.status(500).json({ 
          error: 'Failed to ban IP address', 
          details: ipBanError.message || 'Unknown error'
        });
      }
    }

    // Now update user restrictions (wallet ban is applied here for IP bans)
    const { data: updatedProfile, error: updateError } = await supabaseClient
      .from('profiles')
      .update(restrictions)
      .eq('id', profileId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user restrictions:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update user restrictions', 
        details: updateError.message,
        code: updateError.code
      });
    }

    // Record mute in history if it's a mute
    if (restrictionType === 'mute') {
      try {
        const { error: historyError } = await supabaseClient
          .from('mute_history')
          .insert({
            profile_id: profileId,
            muted_by_wallet: walletAddress,
            reason: reason || null
          });
        
        if (historyError) {
          console.error('Error recording mute history:', historyError);
          // Don't fail the request if history recording fails
        }
      } catch (historyError: any) {
        console.error('Exception recording mute history:', historyError);
        // Don't fail the request if history recording fails
      }
    }

    // Send system message to user about the restriction (AFTER all restrictions are successfully applied)
    if (userProfile?.wallet_address && (restrictionType === 'mute' || restrictionType === 'ban_wallet' || restrictionType === 'ban_ip')) {
      try {
        const restrictionName = restrictionType === 'mute' ? 'muted' : restrictionType === 'ban_ip' ? 'IP banned' : 'banned';
        const expiresText = expiresAt 
          ? ` until ${new Date(expiresAt).toLocaleString()}`
          : ' permanently';
        const reasonText = reason ? ` Reason: ${reason}` : '';
        
        const { error: messageError } = await supabaseClient
          .from('messages')
          .insert({
            sender_id: 'system@lancerfi.app',
            recipient_id: userProfile.wallet_address,
            subject: `You have been ${restrictionType === 'ban_ip' ? 'IP banned' : restrictionName}`,
            content: `You have been ${restrictionName}${expiresText}.${reasonText}`,
            is_read: false
          });
        
        if (messageError) {
          console.error('Error sending restriction message:', messageError);
          // Don't fail the request if message fails
        } else {
          console.log('Restriction message sent to:', userProfile.wallet_address);
        }
      } catch (msgError: any) {
        console.error('Exception sending restriction message:', msgError);
        // Don't fail the request if message fails
      }
    }

    console.log('Restriction applied successfully');

    return res.status(200).json({
      success: true,
      message: `User ${restrictionType === 'mute' ? 'muted' : restrictionType === 'ban_wallet' ? 'banned' : 'IP banned'} successfully`,
      data: updatedProfile
    });
  } catch (error: any) {
    console.error('Exception in restrict-user endpoint:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: error.message || 'Failed to apply restriction',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
