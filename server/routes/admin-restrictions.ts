import { Router, Response, Request, NextFunction } from 'express';
import { supabaseClient } from '../services/supabase.js';
import { generalRateLimiter } from '../middleware/security.js';

const router = Router();

// Admin wallet address - only this wallet can access admin endpoints
const ADMIN_WALLET_ADDRESS = 'AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U';

/**
 * Middleware to verify admin wallet access
 * Gets wallet address from request body (no signature required)
 */
function verifyAdminWallet(req: any, res: Response, next: NextFunction) {
  const walletAddress = req.body?.walletAddress;
  
  if (!walletAddress) {
    return res.status(401).json({ error: 'Wallet address is required' });
  }
  
  if (walletAddress !== ADMIN_WALLET_ADDRESS) {
    return res.status(403).json({ 
      error: 'Unauthorized: This wallet does not have admin access' 
    });
  }
  
  // Store wallet address for use in route handlers
  req.walletAddress = walletAddress;
  
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
 * POST /api/admin/restrict-user
 * Apply restriction to a user (mute, ban, or IP ban)
 */
router.post('/restrict-user', generalRateLimiter, verifyAdminWallet, async (req: any, res: Response) => {
  try {
    const { profileId, restrictionType, expiresAt, reason, ipAddress } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    if (!restrictionType || !['mute', 'ban_wallet', 'ban_ip'].includes(restrictionType)) {
      return res.status(400).json({ error: 'Invalid restriction type. Must be mute, ban_wallet, or ban_ip' });
    }

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
      return res.status(500).json({ error: 'Failed to update user restrictions' });
    }

    // Record mute in history if it's a mute
    if (restrictionType === 'mute') {
      try {
        await supabaseClient
          .from('mute_history')
          .insert({
            profile_id: profileId,
            muted_by_wallet: req.walletAddress,
            reason: reason || null
          });
      } catch (historyError) {
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
            banned_by_wallet: req.walletAddress
          }, {
            onConflict: 'ip_address'
          });
      } catch (ipBanError) {
        console.error('Error banning IP:', ipBanError);
        // Don't fail the request if IP ban fails
      }
    }

    res.json({
      success: true,
      message: `User ${restrictionType === 'mute' ? 'muted' : restrictionType === 'ban_wallet' ? 'banned' : 'IP banned'} successfully`,
      data: updatedProfile
    });
  } catch (error: any) {
    console.error('Error in restrict-user endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to apply restriction' });
  }
});

/**
 * POST /api/admin/unrestrict-user
 * Remove restriction from a user
 */
router.post('/unrestrict-user', generalRateLimiter, verifyAdminWallet, async (req: any, res: Response) => {
  try {
    const { profileId } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

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
      return res.status(500).json({ error: 'Failed to remove user restrictions' });
    }

    res.json({
      success: true,
      message: 'Restriction removed successfully',
      data: updatedProfile
    });
  } catch (error: any) {
    console.error('Error in unrestrict-user endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to remove restriction' });
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

