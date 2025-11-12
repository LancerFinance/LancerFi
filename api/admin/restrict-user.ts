/**
 * Vercel Serverless Function for /api/admin/restrict-user
 * Handles user restrictions (mute, ban wallet, ban IP)
 */

// Vercel types - using any to avoid build errors (types are provided at runtime)
type VercelRequest = any;
type VercelResponse = any;

import dotenv from 'dotenv';
import { supabaseClient } from '../../server/services/supabase.js';

// Load environment variables
dotenv.config();

// Admin wallet address - only this wallet can access admin endpoints
const ADMIN_WALLET_ADDRESS = 'AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U';

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse request body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { walletAddress, profileId, restrictionType, expiresAt, reason, ipAddress } = body;

    // Verify admin wallet
    if (!walletAddress) {
      return res.status(401).json({ error: 'Wallet address is required' });
    }

    if (walletAddress !== ADMIN_WALLET_ADDRESS) {
      return res.status(403).json({ 
        error: 'Unauthorized: This wallet does not have admin access' 
      });
    }

    // Validate required fields
    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    if (!restrictionType || !['mute', 'ban_wallet', 'ban_ip'].includes(restrictionType)) {
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

    // Update user restrictions
    const { data: updatedProfile, error: updateError } = await supabaseClient
      .from('profiles')
      .update(restrictions)
      .eq('id', profileId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user restrictions:', updateError);
      return res.status(500).json({ error: 'Failed to update user restrictions', details: updateError.message });
    }

    // Record mute in history if it's a mute
    if (restrictionType === 'mute') {
      try {
        await supabaseClient
          .from('mute_history')
          .insert({
            profile_id: profileId,
            muted_by_wallet: walletAddress,
            reason: reason || null
          });
      } catch (historyError: any) {
        console.error('Error recording mute history:', historyError);
        // Don't fail the request if history recording fails
      }
    }

    // Handle IP ban separately
    if (restrictionType === 'ban_ip' && ipAddress) {
      try {
        await supabaseClient
          .from('banned_ip_addresses')
          .upsert({
            ip_address: ipAddress.trim(),
            expires_at: expiresAt || null,
            reason: reason || null,
            banned_by_wallet: walletAddress
          }, {
            onConflict: 'ip_address'
          });
      } catch (ipBanError: any) {
        console.error('Error banning IP:', ipBanError);
        // Don't fail the request if IP ban fails
      }
    }

    return res.status(200).json({
      success: true,
      message: `User ${restrictionType === 'mute' ? 'muted' : restrictionType === 'ban_wallet' ? 'banned' : 'IP banned'} successfully`,
      data: updatedProfile
    });
  } catch (error: any) {
    console.error('Error in restrict-user endpoint:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to apply restriction',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
