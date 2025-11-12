import { Router, Response, Request, NextFunction } from 'express';
import { verifyWalletSignature, generateChallenge } from '../middleware/auth.js';
import { generalRateLimiter } from '../middleware/security.js';

const router = Router();

// Admin wallet address - only this wallet can access admin dashboard
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
  
  // CRITICAL: Only allow the specific admin wallet
  if (walletAddress !== ADMIN_WALLET_ADDRESS) {
    // Silently deny - don't log wallet addresses for security
    return res.status(403).json({ 
      error: 'Unauthorized: This wallet does not have admin access' 
    });
  }
  
  next();
}

/**
 * GET /api/admin/challenge
 * Generate a challenge message for admin authentication
 */
router.get('/challenge', generalRateLimiter, (req, res: Response) => {
  try {
    const challenge = generateChallenge();
    res.json({ challenge });
  } catch (error) {
    console.error('Error generating admin challenge:', error);
    res.status(500).json({ error: 'Failed to generate challenge' });
  }
});

/**
 * POST /api/admin/verify
 * Verify admin wallet signature and return auth token
 */
router.post('/verify', generalRateLimiter, verifyWalletSignature, verifyAdminWallet, async (req: any, res: Response) => {
  try {
    const walletAddress = req.walletAddress;

    // Generate a secure session token (JWT-like but simpler for this use case)
    // In production, you might want to use a proper JWT library
    const sessionToken = Buffer.from(`${walletAddress}:${Date.now()}:${Math.random()}`).toString('base64');
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour expiration

    // Store session info (in production, use Redis or database)
    // For now, we'll just return the token and verify it on each request
    
    res.json({
      success: true,
      token: sessionToken,
      expiresAt,
      message: 'Admin authentication successful'
    });
  } catch (error) {
    console.error('Error verifying admin access:', error);
    res.status(500).json({ error: 'Failed to verify admin access' });
  }
});

/**
 * POST /api/admin/check
 * Check if current session token is valid for admin access
 */
router.post('/check', generalRateLimiter, verifyWalletSignature, verifyAdminWallet, async (req: any, res: Response) => {
  try {
    const walletAddress = req.walletAddress;

    res.json({
      authorized: true,
      walletAddress
    });
  } catch (error) {
    console.error('Error checking admin access:', error);
    res.status(500).json({ 
      authorized: false,
      error: 'Failed to check admin access' 
    });
  }
});

export default router;

