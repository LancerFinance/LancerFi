import { Router } from 'express';
import { Connection, Transaction } from '@solana/web3.js';

const router = Router();

// ============================================
// PRODUCTION ONLY: MAINNET-BETA ONLY
// NO DEVNET, NO CONDITIONALS, NO FALLBACKS
// ============================================

// ONLY mainnet endpoints - no devnet, no conditionals
// Prioritize free public RPCs that allow server-side requests
const MAINNET_RPC_ENDPOINTS = [
  process.env.SOLANA_MAINNET_RPC, // Custom env var if provided (highest priority)
  'https://rpc.ankr.com/solana', // Ankr free tier (allows server requests)
  'https://solana-api.projectserum.com', // Serum mainnet RPC
  'https://api.mainnet-beta.solana.com', // Official Solana mainnet RPC (rate-limited, try last)
].filter(Boolean) as string[];

// Ensure we always have at least one mainnet endpoint
const RPC_ENDPOINTS = MAINNET_RPC_ENDPOINTS.length > 0 
  ? MAINNET_RPC_ENDPOINTS 
  : ['https://api.mainnet-beta.solana.com'];

const RPC_ENDPOINT = RPC_ENDPOINTS[0];


// Create connection to mainnet
const connection = new Connection(RPC_ENDPOINT, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
});

/**
 * Proxy endpoint to get latest blockhash from MAINNET
 */
router.options('/blockhash', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/blockhash', async (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    // Try all endpoints in parallel with timeout (much faster than sequential)
    const TIMEOUT_MS = 1500; // 1.5 second timeout per endpoint (reduced for speed)
    
    type BlockhashResult = {
      success?: boolean;
      blockhash?: string;
      lastValidBlockHeight?: number;
      error?: Error | string;
      endpoint?: string;
    };
    
    const blockhashPromises = RPC_ENDPOINTS.map(endpoint => {
      return Promise.race([
        (async (): Promise<BlockhashResult> => {
          const testConnection = new Connection(endpoint, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 10000,
            disableRetryOnRateLimit: false,
          });
          
          const { blockhash, lastValidBlockHeight } = await testConnection.getLatestBlockhash('confirmed');
          
          return {
            success: true,
            blockhash,
            lastValidBlockHeight
          };
        })(),
        new Promise<BlockhashResult>((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
        )
      ]).catch((error): BlockhashResult => ({ error, endpoint }));
    });
    
    // Wait for first successful response
    const results = await Promise.all(blockhashPromises);
    const success = results.find((r: BlockhashResult) => r.success && !r.error);
    
    if (success && success.success) {
      return res.json({
        success: true,
        blockhash: success.blockhash,
        lastValidBlockHeight: success.lastValidBlockHeight
      });
    }
    
    // All failed
    throw new Error('All RPC endpoints failed or timed out');
  } catch (error) {
    console.error('Error getting blockhash:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get blockhash'
    });
  }
});

/**
 * Get account balance from MAINNET
 */
router.options('/account-balance', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/account-balance', async (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const { address } = req.body;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Account address is required'
      });
    }

    const { PublicKey } = await import('@solana/web3.js');
    const publicKey = new PublicKey(address);
    
    // Try all endpoints in parallel with timeout (much faster than sequential)
    const TIMEOUT_MS = 3000; // 3 second timeout per endpoint
    
    type BalanceResult = {
      success?: boolean;
      balance?: number;
      balanceSOL?: number;
      accountExists?: boolean;
      owner?: string | null;
      error?: Error | string;
      endpoint?: string;
    };
    
    const balancePromises = RPC_ENDPOINTS.map(endpoint => {
      return Promise.race([
        (async (): Promise<BalanceResult> => {
          const testConnection = new Connection(endpoint, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 10000,
            disableRetryOnRateLimit: false,
          });
          
          const balance = await testConnection.getBalance(publicKey, 'confirmed');
          const accountInfo = await testConnection.getAccountInfo(publicKey, 'confirmed');
          
          return {
            success: true,
            balance,
            balanceSOL: balance / 1e9,
            accountExists: accountInfo !== null,
            owner: accountInfo?.owner?.toString() || null
          };
        })(),
        new Promise<BalanceResult>((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
        )
      ]).catch((error): BalanceResult => ({ error, endpoint }));
    });
    
    // Wait for first successful response
    const results = await Promise.all(balancePromises);
    const success = results.find((r: BalanceResult) => r.success && !r.error);
    
    if (success && success.success) {
      return res.json({
        success: true,
        balance: success.balance,
        balanceSOL: success.balanceSOL,
        accountExists: success.accountExists,
        owner: success.owner
      });
    }
    
    // All failed
    throw new Error('All RPC endpoints failed or timed out');
  } catch (error) {
    console.error('Error getting account balance:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get account balance'
    });
  }
});

/**
 * Get token balance (e.g., USDC) via MAINNET RPC
 */
router.options('/token-balance', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/token-balance', async (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const { tokenAccount, mint } = req.body;
    
    if (!tokenAccount || typeof tokenAccount !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Token account address is required'
      });
    }

    const { PublicKey, Connection } = await import('@solana/web3.js');
    const tokenAccountPubkey = new PublicKey(tokenAccount);
    
    // Try all endpoints in parallel with timeout
    const TIMEOUT_MS = 3000;
    
    type TokenBalanceResult = {
      success?: boolean;
      balance?: number;
      error?: Error | string;
      endpoint?: string;
    };
    
    const balancePromises = RPC_ENDPOINTS.map(endpoint => {
      return Promise.race([
        (async (): Promise<TokenBalanceResult> => {
          const testConnection = new Connection(endpoint, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 10000,
            disableRetryOnRateLimit: false,
          });
          
          try {
            const accountInfo = await testConnection.getTokenAccountBalance(tokenAccountPubkey, 'confirmed');
            return {
              success: true,
              balance: parseFloat(accountInfo.value.uiAmount?.toString() || '0')
            };
          } catch (err: any) {
            // If account doesn't exist, return 0 balance (not an error)
            if (err.message?.includes('Invalid param') || err.message?.includes('not found') || err.message?.includes('Invalid')) {
              return {
                success: true,
                balance: 0
              };
            }
            throw err;
          }
        })(),
        new Promise<TokenBalanceResult>((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
        )
      ]).catch((error): TokenBalanceResult => ({ error, endpoint }));
    });
    
    // Wait for first successful response
    const results = await Promise.all(balancePromises);
    const success = results.find((r: TokenBalanceResult) => r.success && !r.error);
    
    if (success && success.success) {
      return res.json({
        success: true,
        balance: success.balance
      });
    }
    
    // All failed - return 0 balance (account might not exist)
    return res.json({
      success: true,
      balance: 0
    });
  } catch (error) {
    console.error('Error getting token balance:', error);
    // Return 0 balance on error (account might not exist)
    res.json({
      success: true,
      balance: 0
    });
  }
});

/**
 * Verify transaction on MAINNET
 */
router.options('/verify-transaction', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/verify-transaction', async (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const { signature } = req.body;
    
    if (!signature || typeof signature !== 'string' || signature.trim() === '') {
      return res.status(400).json({
        success: false,
        confirmed: false,
        error: 'Signature is required and must be a non-empty string'
      });
    }

    // Try each MAINNET endpoint
    let lastError: Error | null = null;
    
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const testConnection = new Connection(endpoint, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000,
          disableRetryOnRateLimit: false,
        });
        
        const statusResult = await testConnection.getSignatureStatus(signature);
        
        if (!statusResult || !statusResult.value) {
          continue; // Try next endpoint
        }

        const status = statusResult.value;
        
        if (status.err) {
          return res.json({
            success: false,
            confirmed: false,
            error: status.err.toString(),
            transactionFailed: true
          });
        }

        return res.json({
          success: true,
          confirmed: true,
          confirmationStatus: status.confirmationStatus || 'confirmed',
          transactionFailed: false
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next endpoint
      }
    }
    
    return res.json({
      success: false,
      confirmed: false,
      error: 'Transaction not found'
    });
  } catch (error) {
    console.error('Error verifying transaction:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify transaction'
    });
  }
});

/**
 * Confirm transaction on MAINNET
 */
router.options('/confirm-transaction', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/confirm-transaction', async (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const { signature, blockhash, lastValidBlockHeight, commitment = 'confirmed' } = req.body;
    
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Signature is required'
      });
    }

    if (!blockhash || typeof blockhash !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Blockhash is required'
      });
    }

    // Try each MAINNET endpoint
    let lastError: Error | null = null;
    
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const testConnection = new Connection(endpoint, {
          commitment: commitment as any,
          confirmTransactionInitialTimeout: 60000,
          disableRetryOnRateLimit: false,
        });
        
        const confirmation = await testConnection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight: lastValidBlockHeight || undefined,
        }, commitment as any);
        
        const slot = (confirmation as any).context?.slot || null;
        
        return res.json({
          success: true,
          confirmed: true,
          slot,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next endpoint
      }
    }
    
    throw lastError || new Error('All RPC endpoints failed');
  } catch (error) {
    console.error('Error confirming transaction:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm transaction'
    });
  }
});

/**
 * Send transaction to MAINNET
 */
router.options('/send-transaction', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/send-transaction', async (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  
  try {
    const { transaction, options } = req.body;
    
    if (!transaction || typeof transaction !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Transaction data is required (base64 encoded)'
      });
    }

    // Decode transaction
    let transactionBuffer: Buffer;
    try {
      transactionBuffer = Buffer.from(transaction, 'base64');
      
      if (transactionBuffer.length === 0 || transactionBuffer.length > 1232) {
        return res.status(400).json({
          success: false,
          error: `Invalid transaction size: ${transactionBuffer.length} bytes (expected 1-1232 bytes)`
        });
      }
    } catch (error) {
      console.error('Error decoding transaction:', error);
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction data (must be base64 encoded)'
      });
    }

    // Try each MAINNET endpoint in order
    let lastError: Error | null = null;
    
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        console.log(`🚀 Attempting to send transaction via MAINNET endpoint: ${endpoint}`);
        
        const testConnection = new Connection(endpoint, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000,
          disableRetryOnRateLimit: false,
        });
        
        // Parse transaction to get blockhash info
        const txToSimulate = Transaction.from(transactionBuffer);
        const blockhashStr = txToSimulate.recentBlockhash?.toString() || 'MISSING';
        console.log(`Transaction blockhash: ${blockhashStr.substring(0, 20)}...`);
        console.log(`Transaction fee payer: ${txToSimulate.feePayer?.toString() || 'MISSING'}`);
        console.log(`Transaction instructions count: ${txToSimulate.instructions.length}`);
        
        // NOTE: lastValidBlockHeight is NOT serialized in transactions, so it will be 0 after deserialization
        // We skip blockhash validation and simulation - the RPC will validate and reject if invalid
        // The frontend ensures a fresh blockhash is used before signing
        
        // Send transaction directly to MAINNET - RPC will validate it
        try {
          
          const signature = await testConnection.sendRawTransaction(
            transactionBuffer,
            {
              skipPreflight: false,
              maxRetries: 3,
              preflightCommitment: 'confirmed' as const,
              ...(options || {})
            }
          );
          
          
          // Wait for transaction to be included in a block
          await new Promise(resolve => setTimeout(resolve, 8000));
          
          // Verify transaction exists on MAINNET
          let found = false;
          let attempts = 0;
          const maxAttempts = 5;
          
          while (!found && attempts < maxAttempts) {
            attempts++;
            
            try {
              const statusResult = await testConnection.getSignatureStatus(signature, {
                searchTransactionHistory: true
              });
              
              if (statusResult && statusResult.value) {
                if (statusResult.value.err) {
                  throw new Error(`Transaction failed on-chain: ${statusResult.value.err.toString()}`);
                } else {
                  found = true;
                    signature,
                    confirmationStatus: statusResult.value.confirmationStatus,
                    slot: statusResult.value.slot
                  });
                  break;
                }
              } else {
                if (attempts < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }
              }
            } catch (statusError: any) {
              const errorMsg = statusError?.message || String(statusError);
              if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
                if (attempts < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }
              } else {
                throw statusError;
              }
            }
          }
          
          if (!found) {
            throw new Error(`Transaction was not found on-chain after ${maxAttempts} attempts. The transaction was likely dropped by validators.`);
          }
          
          return res.json({
            success: true,
            signature
          });
        } catch (sendError: any) {
          const errorMsg = sendError?.message || String(sendError);
          console.error(`❌ Failed to send transaction to MAINNET:`, errorMsg);
          throw sendError;
        }
      } catch (error) {
        console.error(`❌ Failed via MAINNET endpoint ${endpoint}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next MAINNET endpoint
      }
    }
    
    // If all MAINNET endpoints failed
    throw lastError || new Error('All MAINNET RPC endpoints failed');
    
  } catch (error) {
    console.error('Error sending transaction to MAINNET:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send transaction';
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

export default router;
  