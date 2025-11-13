/**
 * Vercel Serverless Function for /api/admin/unrestrict-user
 * Handles removing user restrictions
 */

// Vercel types - using any to avoid build errors (types are provided at runtime)
type VercelRequest = any;
type VercelResponse = any;

import { supabaseClient } from '../../server/services/supabase.js';
import { checkIPBanForVercel } from '../../server/middleware/ip-ban-check.js';
import { verifyWalletSignatureForVercel } from '../middleware/verify-signature.js';

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
    const { walletAddress, profileId, signature, message } = body;


    // Verify admin wallet
    if (!walletAddress) {
      return res.status(401).json({ error: 'Wallet address is required' });
    }

    if (walletAddress !== ADMIN_WALLET_ADDRESS) {
      return res.status(403).json({ 
        error: 'Unauthorized: This wallet does not have admin access' 
      });
    }

    // CRITICAL SECURITY: Verify cryptographic signature to prove wallet ownership
    if (!signature || !message) {
      return res.status(401).json({ 
        error: 'Signature verification required. Please sign the challenge message with your wallet.' 
      });
    }

    const isValidSignature = await verifyWalletSignatureForVercel(walletAddress, signature, message);
    if (!isValidSignature) {
      return res.status(401).json({ 
        error: 'Invalid signature. Authentication failed.' 
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
      return res.status(500).json({ 
        error: 'Failed to remove user restrictions', 
        details: updateError.message,
        code: updateError.code
      });
    }


    return res.status(200).json({
      success: true,
      message: 'Restriction removed successfully',
      data: updatedProfile
    });
  } catch (error: any) {
    return res.status(500).json({ 
      error: error.message || 'Failed to remove restriction',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
