import { Router, Response, Request, NextFunction } from 'express';
import { supabaseClient } from '../services/supabase.js';
import { generalRateLimiter } from '../middleware/security.js';
import { verifyWalletSignature } from '../middleware/auth.js';

const router = Router();

// Admin wallet address - only this wallet can access admin endpoints
const ADMIN_WALLET_ADDRESS = 'AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U';

/**
 * Middleware to verify admin wallet access
 * Must be used after verifyWalletSignature
 */
function verifyAdminWallet(req: any, res: Response, next: NextFunction) {
  const walletAddress = req.walletAddress;
  
  if (!walletAddress) {
    return res.status(401).json({ error: 'Wallet address not authenticated' });
  }
  
  if (walletAddress !== ADMIN_WALLET_ADDRESS) {
    return res.status(403).json({ 
      error: 'Unauthorized: This wallet does not have admin access' 
    });
  }
  
  next();
}

/**
 * POST /api/admin/ban-ip
 * Ban an IP address
 */
router.post('/ban-ip', generalRateLimiter, verifyWalletSignature, verifyAdminWallet, async (req: any, res: Response) => {
  try {
    const { ipAddress, expiresAt, reason } = req.body;

    if (!ipAddress || typeof ipAddress !== 'string') {
      return res.status(400).json({ error: 'IP address is required' });
    }

    // Insert or update banned IP
    const { data, error } = await supabaseClient
      .from('banned_ip_addresses')
      .upsert({
        ip_address: ipAddress.trim(),
        expires_at: expiresAt || null,
        reason: reason || null,
        banned_by_wallet: req.walletAddress
      }, {
        onConflict: 'ip_address'
      })
      .select()
      .single();

    if (error) {
      console.error('Error banning IP:', error);
      return res.status(500).json({ error: 'Failed to ban IP address' });
    }

    res.json({
      success: true,
      message: `IP address ${ipAddress} banned successfully`,
      data
    });
  } catch (error: any) {
    console.error('Error in ban-ip endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to ban IP address' });
  }
});

/**
 * GET /api/admin/check-restriction
 * Check if a wallet or IP is restricted
 */
router.get('/check-restriction', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const { walletAddress, ipAddress } = req.query;

    if (!walletAddress && !ipAddress) {
      return res.status(400).json({ error: 'walletAddress or ipAddress is required' });
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
    if (ipAddress && !isRestricted) {
      const { data: ipBan, error: ipError } = await supabaseClient
        .from('banned_ip_addresses')
        .select('*')
        .eq('ip_address', ipAddress as string)
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
        }
      }
    }

    res.json({
      isRestricted,
      restrictionType,
      expiresAt,
      reason
    });
  } catch (error: any) {
    console.error('Error checking restriction:', error);
    res.status(500).json({ error: error.message || 'Failed to check restriction' });
  }
});

export default router;

