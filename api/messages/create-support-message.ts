/**
 * Vercel Serverless Function for /api/messages/create-support-message
 * Creates a support message with rate limiting enforcement
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
    const { walletAddress, subject, content, attachments } = body;
    
    if (!walletAddress || !content) {
      return res.status(400).json({ 
        error: 'walletAddress and content are required',
        success: false
      });
    }
    
    // Check rate limit FIRST before creating message
    // Only prevent rapid spam - 3 messages per minute
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000); // Last 1 minute
    
    const { data: recentMessages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('id, created_at')
      .eq('sender_id', walletAddress)
      .eq('recipient_id', 'admin@lancerfi.app')
      .gte('created_at', oneMinuteAgo.toISOString())
      .order('created_at', { ascending: true }); // Get oldest first
    
    if (messagesError) {
      // Fail open - allow message if we can't check rate limit
      // Don't block legitimate users due to database errors
    } else {
      const messageCount = recentMessages?.length || 0;
      // Block if they've sent 3+ messages in the last minute
      if (messageCount >= 3) {
        // Calculate time until the oldest message expires (1 minute after it was sent)
        if (recentMessages && recentMessages.length > 0) {
          const oldestMessage = recentMessages[0]; // Already sorted ascending
          const oldestMessageTime = new Date(oldestMessage.created_at);
          const millisecondsSinceOldest = now.getTime() - oldestMessageTime.getTime();
          const remainingMilliseconds = (60 * 1000) - millisecondsSinceOldest;
          const remainingSeconds = Math.max(1, Math.ceil(remainingMilliseconds / 1000));
          
          // Always block if we have 3+ messages in the last minute
          return res.status(429).json({
            error: `Rate limit exceeded. You can send 3 messages per minute. Please wait ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} before sending another message.`,
            success: false,
            count: messageCount,
            limit: 3,
            remainingSeconds
          });
        } else {
          // Fallback: block if count is 3+ even if we can't calculate time
          return res.status(429).json({
            error: `Rate limit exceeded. You can send 3 messages per minute. Please wait before sending another message.`,
            success: false,
            count: messageCount,
            limit: 3
          });
        }
      }
    }
    
    // Rate limit passed - create the message
    const { data: newMessage, error: createError } = await supabaseClient
      .from('messages')
      .insert({
        sender_id: walletAddress,
        recipient_id: 'admin@lancerfi.app',
        subject: subject || null,
        content: content.trim(),
        attachments: attachments && Array.isArray(attachments) ? attachments : [],
        is_read: false
      })
      .select()
      .single();
    
    if (createError) {
      return res.status(500).json({ 
        error: 'Failed to create message',
        success: false,
        details: createError.message
      });
    }
    
    return res.json({
      success: true,
      message: newMessage
    });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Error creating support message',
      success: false,
      details: error.message
    });
  }
}

