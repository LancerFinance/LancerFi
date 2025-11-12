/**
 * Vercel Serverless Function for /api/track-ip
 * Tracks user IP address when they connect wallet or make API calls
 */

// Vercel types
type VercelRequest = any;
type VercelResponse = any;

import { supabaseClient } from '../server/services/supabase.js';
import { getClientIPFromVercelRequest } from '../server/middleware/ip-ban-check.js';

// Helper to parse request body
async function parseBody(req: VercelRequest): Promise<any> {
  if (!req.body) {
    return {};
  }
  
  if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  
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
    // Get client IP from request
    const clientIP = getClientIPFromVercelRequest(req);
    
    // Skip if IP is unknown or localhost
    if (!clientIP || clientIP === 'unknown' || clientIP === '::1' || clientIP.startsWith('127.') || clientIP.startsWith('::ffff:127.')) {
      return res.status(200).json({ success: true, message: 'IP tracking skipped (localhost/unknown)' });
    }
    
    // Parse request body
    const body = await parseBody(req);
    const { walletAddress } = body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    // Update user's last_ip_address in profile
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ last_ip_address: clientIP })
      .eq('wallet_address', walletAddress);

    if (updateError) {
      console.error('Error updating user IP:', updateError);
      // Don't fail - IP tracking is not critical
      return res.status(200).json({ 
        success: false, 
        message: 'IP tracking failed but request can continue',
        error: updateError.message 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'IP address tracked successfully',
      ip: clientIP
    });
  } catch (error: any) {
    console.error('Exception in track-ip endpoint:', error);
    // Don't fail - IP tracking is not critical
    return res.status(200).json({ 
      success: false, 
      message: 'IP tracking failed but request can continue',
      error: error.message 
    });
  }
}

