import { Router, Request, Response } from 'express';
import { supabaseClient } from '../services/supabase.js';
import { getClientIP } from '../middleware/security.js';

const router = Router();

/**
 * Check rate limit for support messages
 * Limits: 5 messages per hour per wallet address
 */
router.post('/check-support-rate-limit', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ 
        allowed: false, 
        error: 'walletAddress is required',
        count: 0,
        limit: 5
      });
    }
    
    const supabase = supabaseClient;
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Count support messages sent by this wallet in the last hour
    const { data: recentMessages, error: messagesError } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('sender_id', walletAddress)
      .eq('recipient_id', 'admin@lancerfi.app')
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false });
    
    if (messagesError) {
      // Fail open - allow if we can't check
      return res.json({ 
        allowed: true, 
        reason: 'Unable to verify rate limit',
        count: 0,
        limit: 5
      });
    }
    
    const messageCount = recentMessages?.length || 0;
    const allowed = messageCount < 5;
    
    if (!allowed) {
      // Calculate time until oldest message expires
      let remainingMinutes = 60;
      if (recentMessages && recentMessages.length > 0) {
        const oldestMessage = recentMessages[recentMessages.length - 1];
        const oldestMessageTime = new Date(oldestMessage.created_at);
        const minutesSinceOldest = (now.getTime() - oldestMessageTime.getTime()) / (1000 * 60);
        remainingMinutes = Math.ceil(60 - minutesSinceOldest);
      }
      
      return res.json({
        allowed: false,
        count: messageCount,
        limit: 5,
        reason: `You've reached the limit of 5 support messages per hour. Please wait ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} before sending another message.`,
        remainingMinutes
      });
    }
    
    return res.json({
      allowed: true,
      count: messageCount,
      limit: 5,
      reason: `You have sent ${messageCount}/5 support messages in the last hour`
    });
  } catch (error: any) {
    // Fail open - allow if there's an error
    return res.json({ 
      allowed: true, 
      reason: 'Error checking rate limit',
      count: 0,
      limit: 5
    });
  }
});

/**
 * Create a support message with rate limiting enforcement
 * This endpoint enforces rate limits server-side before creating the message
 */
router.post('/create-support-message', async (req: Request, res: Response) => {
  try {
    const { walletAddress, subject, content, attachments } = req.body;
    
    if (!walletAddress || !content) {
      return res.status(400).json({ 
        error: 'walletAddress and content are required',
        success: false
      });
    }
    
    // Check rate limit FIRST before creating message
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const { data: recentMessages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('id, created_at')
      .eq('sender_id', walletAddress)
      .eq('recipient_id', 'admin@lancerfi.app')
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false });
    
    if (messagesError) {
      return res.status(500).json({ 
        error: 'Failed to check rate limit',
        success: false
      });
    }
    
    const messageCount = recentMessages?.length || 0;
    if (messageCount >= 5) {
      // Calculate time until oldest message expires
      let remainingMinutes = 60;
      if (recentMessages && recentMessages.length > 0) {
        const oldestMessage = recentMessages[recentMessages.length - 1];
        const oldestMessageTime = new Date(oldestMessage.created_at);
        const minutesSinceOldest = (now.getTime() - oldestMessageTime.getTime()) / (1000 * 60);
        remainingMinutes = Math.ceil(60 - minutesSinceOldest);
      }
      
      return res.status(429).json({
        error: `Rate limit exceeded. You've reached the limit of 5 support messages per hour. Please wait ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} before sending another message.`,
        success: false,
        count: messageCount,
        limit: 5,
        remainingMinutes
      });
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
});

export default router;

