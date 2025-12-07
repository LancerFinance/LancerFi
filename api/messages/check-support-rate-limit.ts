/**
 * Vercel Serverless Function for /api/messages/check-support-rate-limit
 * Checks rate limit for support messages
 */

// Vercel types
type VercelRequest = any;
type VercelResponse = any;

import { supabaseClient } from '../../server/services/supabase.js';
import { checkIPBanForVercel } from '../../server/middleware/ip-ban-check.js';

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
    const body = await parseBody(req);
    const { walletAddress } = body;
    
    if (!walletAddress) {
      return res.status(400).json({ 
        allowed: false, 
        error: 'walletAddress is required',
        count: 0,
        limit: 3
      });
    }
    
    const supabase = supabaseClient;
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000); // Last 1 minute
    
    // Count support messages sent by this wallet in the last minute
    const { data: recentMessages, error: messagesError } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('sender_id', walletAddress)
      .eq('recipient_id', 'admin@lancerfi.app')
      .gte('created_at', oneMinuteAgo.toISOString())
      .order('created_at', { ascending: false });
    
    if (messagesError) {
      // Fail open - allow if we can't check
      return res.json({ 
        allowed: true, 
        reason: 'Unable to verify rate limit',
        count: 0,
        limit: 3
      });
    }
    
    const messageCount = recentMessages?.length || 0;
    const allowed = messageCount < 3;
    
    if (!allowed) {
      // Calculate time until oldest message expires
      let remainingSeconds = 60;
      if (recentMessages && recentMessages.length > 0) {
        const oldestMessage = recentMessages[recentMessages.length - 1];
        const oldestMessageTime = new Date(oldestMessage.created_at);
        const secondsSinceOldest = (now.getTime() - oldestMessageTime.getTime()) / 1000;
        remainingSeconds = Math.ceil(60 - secondsSinceOldest);
      }
      
      return res.json({
        allowed: false,
        count: messageCount,
        limit: 3,
        reason: `Please wait ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} before sending another message.`,
        remainingSeconds
      });
    }
    
    return res.json({
      allowed: true,
      count: messageCount,
      limit: 3,
      reason: `You have sent ${messageCount}/3 support messages in the last minute`
    });
  } catch (error: any) {
    // Fail open - allow if there's an error
    return res.json({ 
      allowed: true, 
      reason: 'Error checking rate limit',
      count: 0,
      limit: 3
    });
  }
}

