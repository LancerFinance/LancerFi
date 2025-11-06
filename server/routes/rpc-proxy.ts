import { Router } from 'express';
import { Connection, Transaction } from '@solana/web3.js';

const router = Router();

// ============================================
// PRODUCTION ONLY: MAINNET-BETA ONLY
// NO DEVNET, NO CONDITIONALS, NO FALLBACKS
// ============================================

// ONLY mainnet endpoints - no devnet, no conditionals
const MAINNET_RPC_ENDPOINTS = [
  process.env.SOLANA_MAINNET_RPC, // Custom env var if provided
  'https://api.mainnet-beta.solana.com', // Official Solana mainnet RPC
  'https://solana-api.projectserum.com', // Serum mainnet RPC
  'https://rpc.ankr.com/solana', // Ankr mainnet RPC
].filter(Boolean) as string[];

// Ensure we always have at least one mainnet endpoint
const RPC_ENDPOINTS = MAINNET_RPC_ENDPOINTS.length > 0 
  ? MAINNET_RPC_ENDPOINTS 
  : ['https://api.mainnet-beta.solana.com'];

const RPC_ENDPOINT = RPC_ENDPOINTS[0];

console.log(`🚀🚀🚀 VERSION 2.0 - PRODUCTION MODE: Using MAINNET-BETA ONLY 🚀🚀🚀`);
console.log(`🚀 RPC Endpoints:`, RPC_ENDPOINTS);
console.log(`🚀 Primary Endpoint:`, RPC_ENDPOINT);
console.log(`🚀 BUILD TIMESTAMP: ${new Date().toISOString()}`);
console.log(`🚀 IF YOU SEE DEVNET IN LOGS, VERCEL IS SERVING OLD CODE`);

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
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    res.json({
      success: true,
      blockhash,
      lastValidBlockHeight
    });
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
    
    // Try each MAINNET endpoint in order
    let lastError: Error | null = null;
    
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const testConnection = new Connection(endpoint, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000,
          disableRetryOnRateLimit: false,
        });
        
        const balance = await testConnection.getBalance(publicKey, 'confirmed');
        const accountInfo = await testConnection.getAccountInfo(publicKey, 'confirmed');
        
        return res.json({
          success: true,
          balance,
          balanceSOL: balance / 1e9,
          accountExists: accountInfo !== null,
          owner: accountInfo?.owner?.toString() || null
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next endpoint
      }
    }
    
    throw lastError || new Error('All RPC endpoints failed');
  } catch (error) {
    console.error('Error getting account balance:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get account balance'
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
  
  console.log(`🚀 SEND TRANSACTION: Using MAINNET endpoints only:`, RPC_ENDPOINTS);
  
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
      console.log('Received transaction buffer, size:', transactionBuffer.length, 'bytes');
      
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
        // We skip blockhash validation here - the RPC will reject it if the blockhash is truly expired
        // The frontend ensures a fresh blockhash is used before signing
        
        // Simulate transaction on MAINNET
        try {
          const simulation = await testConnection.simulateTransaction(
            txToSimulate,
            {
              commitment: 'confirmed',
              replaceRecentBlockhash: false,
            } as any
          );
          
          if (simulation.value.err) {
            console.error(`❌ Transaction simulation FAILED:`, simulation.value.err);
            throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
          }
          
          console.log(`✅ Transaction simulation passed on MAINNET`);
        } catch (simError: any) {
          const errorMsg = simError?.message || String(simError);
          console.error(`❌ Transaction simulation error:`, errorMsg);
          throw new Error(`Transaction simulation failed: ${errorMsg}`);
        }
        
        // Send transaction to MAINNET
        try {
          console.log(`🚀 Sending transaction to MAINNET via ${endpoint}...`);
          
          const signature = await testConnection.sendRawTransaction(
            transactionBuffer,
            {
              skipPreflight: false,
              maxRetries: 3,
              preflightCommitment: 'confirmed' as const,
              ...(options || {})
            }
          );
          
          console.log(`✅ Transaction sent to MAINNET, signature: ${signature}`);
          
          // Wait for transaction to be included in a block
          await new Promise(resolve => setTimeout(resolve, 8000));
          
          // Verify transaction exists on MAINNET
          let found = false;
          let attempts = 0;
          const maxAttempts = 5;
          
          while (!found && attempts < maxAttempts) {
            attempts++;
            console.log(`Checking transaction status on MAINNET (attempt ${attempts}/${maxAttempts})...`);
            
            try {
              const statusResult = await testConnection.getSignatureStatus(signature, {
                searchTransactionHistory: true
              });
              
              if (statusResult && statusResult.value) {
                if (statusResult.value.err) {
                  throw new Error(`Transaction failed on-chain: ${statusResult.value.err.toString()}`);
                } else {
                  found = true;
                  console.log(`✅ Transaction verified on MAINNET:`, {
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
                console.warn(`⚠️ RPC access blocked (403) - continuing...`);
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
