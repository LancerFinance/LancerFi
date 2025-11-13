import { supabaseClient } from '../../server/services/supabase.js';
import { getClientIPFromVercelRequest } from '../../server/middleware/ip-ban-check.js';

type VercelRequest = any;
type VercelResponse = any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress, ipAddress } = req.query;
    
    // If no parameters, get IP from request
    let ipToCheck = ipAddress as string | undefined;
    if (!walletAddress && !ipAddress) {
      ipToCheck = getClientIPFromVercelRequest(req);
    }

    let isRestricted = false;
    let restrictionType: string | null = null;
    let expiresAt: string | null = null;
    let reason: string | null = null;

    // Check wallet ban
    if (walletAddress) {
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('restriction_type, restriction_expires_at, restriction_reason, is_muted, is_banned')
        .eq('wallet_address', walletAddress as string)
        .maybeSingle();

      if (!profileError && profile) {
        const now = new Date();
        const expires = profile.restriction_expires_at ? new Date(profile.restriction_expires_at) : null;
        const isExpired = expires && expires < now;

        if (!isExpired && (profile.is_muted || profile.is_banned)) {
          isRestricted = true;
          restrictionType = profile.restriction_type || (profile.is_banned ? 'ban_wallet' : 'mute');
          expiresAt = profile.restriction_expires_at;
          reason = profile.restriction_reason;
        }
      }
    }

    // Check IP ban
    if (ipToCheck && !isRestricted) {
      const { data: ipBan, error: ipError } = await supabaseClient
        .from('banned_ip_addresses')
        .select('*')
        .eq('ip_address', ipToCheck)
        .maybeSingle();

      if (!ipError && ipBan) {
        const now = new Date();
        const expires = ipBan.expires_at ? new Date(ipBan.expires_at) : null;
        const isExpired = expires && expires < now;

        if (!isExpired) {
          isRestricted = true;
          restrictionType = 'ban_ip';
          expiresAt = ipBan.expires_at;
          reason = ipBan.reason;
          
          // If IP is banned, return 403 instead of 200
          return res.status(403).json({
            error: 'Access denied',
            message: 'Your IP address has been banned from accessing this service.',
            isRestricted: true,
            restrictionType: 'ban_ip',
            expiresAt: ipBan.expires_at,
            reason: ipBan.reason
          });
        }
      }
    }

    // Return JSON response (always JSON, never HTML)
    return res.status(200).json({
      isRestricted,
      restrictionType,
      expiresAt,
      reason
    });
  } catch (error: any) {
    console.error('Error checking restriction:', error);
    // Always return JSON, even on error
    return res.status(500).json({ 
      error: error.message || 'Failed to check restriction',
      isRestricted: false,
      restrictionType: null,
      expiresAt: null,
      reason: null
    });
  }
}

