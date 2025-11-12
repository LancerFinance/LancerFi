/**
 * Vercel Serverless Function for /api/admin/unrestrict-user
 * Handles removing user restrictions
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
    const { walletAddress, profileId } = body;

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

    // Remove all restrictions
    const restrictions: any = {
      is_muted: false,
      is_banned: false,
      restriction_type: null,
      restriction_expires_at: null,
      restriction_reason: null
    };

    const { data: updatedProfile, error: updateError } = await supabaseClient
      .from('profiles')
      .update(restrictions)
      .eq('id', profileId)
      .select()
      .single();

    if (updateError) {
      console.error('Error removing user restrictions:', updateError);
      return res.status(500).json({ error: 'Failed to remove user restrictions', details: updateError.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Restriction removed successfully',
      data: updatedProfile
    });
  } catch (error: any) {
    console.error('Error in unrestrict-user endpoint:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to remove restriction',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
