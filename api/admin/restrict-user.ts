/**
 * Vercel Serverless Function for /api/admin/restrict-user
 * Handles user restrictions (mute, ban wallet, ban IP)
 */

// Vercel types - using any to avoid build errors (types are provided at runtime)
type VercelRequest = any;
type VercelResponse = any;

import { supabaseClient } from '../../server/services/supabase.js';

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
      // For IP ban, we don't set is_muted or is_banned on the profile
      // The IP ban is handled separately in the banned_ip_addresses table
    }

    console.log('Updating profile:', profileId, 'with restrictions:', restrictions);

    // Update user restrictions
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

    // Handle IP ban separately
    if (restrictionType === 'ban_ip' && ipAddress) {
      try {
        const { error: ipBanError } = await supabaseClient
          .from('banned_ip_addresses')
          .upsert({
            ip_address: ipAddress.trim(),
            expires_at: expiresAt || null,
            reason: reason || null,
            banned_by_wallet: walletAddress
          }, {
            onConflict: 'ip_address'
          });
        
        if (ipBanError) {
          console.error('Error banning IP:', ipBanError);
          // Don't fail the request if IP ban fails
        }
      } catch (ipBanError: any) {
        console.error('Exception banning IP:', ipBanError);
        // Don't fail the request if IP ban fails
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
