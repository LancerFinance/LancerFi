/**
 * IP Ban Check Helper for Vercel Serverless Functions
 * This can be used in individual serverless functions to check IP bans
 */

import { supabaseClient } from '../services/supabase.js';

// Vercel types
type VercelRequest = any;
type VercelResponse = any;

/**
 * Get client IP address from Vercel request
 */
export function getClientIPFromVercelRequest(req: VercelRequest): string {
  // Check various headers for IP (handles proxies/load balancers)
  const forwarded = req.headers?.['x-forwarded-for'];
  const realIP = req.headers?.['x-real-ip'];
  const cfConnectingIP = req.headers?.['cf-connecting-ip']; // Cloudflare
  
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
  
  // Fallback
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Check if IP is banned and return ban info
 * Returns null if not banned, or ban info if banned
 */
export async function checkIPBanStatus(clientIP: string): Promise<{
  isBanned: boolean;
  expiresAt: string | null;
  reason: string | null;
} | null> {
  // Skip check if IP is unknown or localhost (for development)
  if (!clientIP || clientIP === 'unknown' || clientIP === '::1' || clientIP.startsWith('127.') || clientIP.startsWith('::ffff:127.')) {
    return null;
  }
  
  try {
    const { data: ipBan, error } = await supabaseClient
      .from('banned_ip_addresses')
      .select('*')
      .eq('ip_address', clientIP)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking IP ban:', error);
      return null; // Fail open
    }
    
    if (ipBan) {
      // Check if ban has expired
      const now = new Date();
      const expires = ipBan.expires_at ? new Date(ipBan.expires_at) : null;
      const isExpired = expires && expires < now;
      
      if (!isExpired) {
        return {
          isBanned: true,
          expiresAt: ipBan.expires_at,
          reason: ipBan.reason
        };
      } else {
        // Ban expired, clean it up (async)
        supabaseClient
          .from('banned_ip_addresses')
          .delete()
          .eq('ip_address', clientIP)
          .then(() => {})
          .catch((err: any) => console.error('Error cleaning up expired IP ban:', err));
      }
    }
    
    return null; // Not banned
  } catch (error: any) {
    console.error('Exception in IP ban check:', error);
    return null; // Fail open
  }
}

/**
 * Middleware wrapper for Vercel serverless functions
 * Use this at the start of your handler to block banned IPs
 */
export async function checkIPBanForVercel(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const clientIP = getClientIPFromVercelRequest(req);
  const banStatus = await checkIPBanStatus(clientIP);
  
  if (banStatus?.isBanned) {
    res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address has been banned from accessing this service.',
      expiresAt: banStatus.expiresAt || null,
      reason: banStatus.reason || null
    });
    return true; // Request blocked
  }
  
  return false; // Request allowed
}

