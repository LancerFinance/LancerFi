import { Router, Response, Request } from 'express';
import { supabaseClient } from '../services/supabase.js';
import { Connection } from '@solana/web3.js';
import { generalRateLimiter } from '../middleware/security.js';

const router = Router();

// Get Solana connection for RPC checks - always use mainnet in production
const MAINNET_RPC_ENDPOINTS = [
  process.env.SOLANA_MAINNET_RPC,
  'https://rpc.ankr.com/solana',
  'https://solana-api.projectserum.com',
  'https://api.mainnet-beta.solana.com',
].filter(Boolean) as string[];

const RPC_ENDPOINT = MAINNET_RPC_ENDPOINTS[0] || 'https://api.mainnet-beta.solana.com';

const connection = new Connection(RPC_ENDPOINT, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 10000, // 10 second timeout for health checks
});

/**
 * GET /api/system-status
 * Get real-time system status for all services
 */
router.get('/', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const statuses: Record<string, { status: string; lastCheck: string; error?: string }> = {};

    // Check Database (Supabase)
    try {
      const startTime = Date.now();
      const { error } = await supabaseClient
        .from('profiles')
        .select('id')
        .limit(1);
      
      const responseTime = Date.now() - startTime;
      
      if (error) {
        statuses.database = {
          status: 'offline',
          lastCheck: new Date().toISOString(),
          error: error.message
        };
      } else {
        statuses.database = {
          status: responseTime < 2000 ? 'online' : 'degraded',
          lastCheck: new Date().toISOString()
        };
      }
    } catch (error: any) {
      statuses.database = {
        status: 'offline',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }

    // Check Storage (Supabase Storage)
    try {
      const startTime = Date.now();
      const { data, error } = await supabaseClient.storage.listBuckets();
      const responseTime = Date.now() - startTime;
      
      if (error) {
        statuses.storage = {
          status: 'offline',
          lastCheck: new Date().toISOString(),
          error: error.message
        };
      } else {
        statuses.storage = {
          status: responseTime < 2000 ? 'online' : 'degraded',
          lastCheck: new Date().toISOString()
        };
      }
    } catch (error: any) {
      statuses.storage = {
        status: 'offline',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }

    // Check API Server (self-check)
    try {
      const startTime = Date.now();
      // Simple check - if we got here, API is working
      const responseTime = Date.now() - startTime;
      statuses.apiServer = {
        status: 'online',
        lastCheck: new Date().toISOString()
      };
    } catch (error: any) {
      statuses.apiServer = {
        status: 'offline',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }

    // Check Blockchain RPC (Solana)
    // Use a simple health check that doesn't require API keys
    try {
      const startTime = Date.now();
      // Try to get the slot number instead of blockhash - this is a lighter operation
      // and works with public RPCs that don't require API keys
      const slot = await connection.getSlot('confirmed');
      const responseTime = Date.now() - startTime;
      
      if (slot && slot > 0) {
        statuses.blockchainRPC = {
          status: responseTime < 5000 ? 'online' : 'degraded',
          lastCheck: new Date().toISOString()
        };
      } else {
        statuses.blockchainRPC = {
          status: 'offline',
          lastCheck: new Date().toISOString(),
          error: 'Invalid response from RPC'
        };
      }
    } catch (error: any) {
      // If the primary RPC fails, try a fallback public endpoint
      try {
        const fallbackConnection = new Connection('https://api.mainnet-beta.solana.com', {
          commitment: 'confirmed',
        });
        const startTime = Date.now();
        const slot = await fallbackConnection.getSlot('confirmed');
        const responseTime = Date.now() - startTime;
        
        if (slot && slot > 0) {
          statuses.blockchainRPC = {
            status: responseTime < 5000 ? 'online' : 'degraded',
            lastCheck: new Date().toISOString()
            // Don't show error for fallback - it's working fine
          };
        } else {
          statuses.blockchainRPC = {
            status: 'offline',
            lastCheck: new Date().toISOString(),
            error: 'All RPC endpoints failed'
          };
        }
      } catch (fallbackError: any) {
        statuses.blockchainRPC = {
          status: 'offline',
          lastCheck: new Date().toISOString(),
          error: `RPC check failed: ${fallbackError.message}`
        };
      }
    }

    res.json({
      success: true,
      systems: statuses,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check system status'
    });
  }
});

export default router;

