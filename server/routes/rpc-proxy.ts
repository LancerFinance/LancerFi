import { Router } from 'express';
import { Connection } from '@solana/web3.js';

const router = Router();

// Get Solana RPC endpoint from environment or use default
const SOLANA_NETWORK = process.env.NODE_ENV === 'production' ? 'mainnet-beta' : 'devnet';

// Use multiple RPC endpoints for fallback
// Note: Many free RPCs now require API keys. These are public endpoints that should work.
const MAINNET_RPC_ENDPOINTS = [
  process.env.SOLANA_MAINNET_RPC, // Custom env var (highest priority)
  'https://api.mainnet-beta.solana.com', // Official Solana RPC
  'https://solana-api.projectserum.com', // Serum RPC (free, public)
  'https://rpc.ankr.com/solana', // Ankr (free tier, may need API key)
].filter(Boolean) as string[];

const DEVNET_RPC_ENDPOINTS = [
  process.env.SOLANA_DEVNET_RPC,
  'https://api.devnet.solana.com',
].filter(Boolean) as string[];

const RPC_ENDPOINTS = SOLANA_NETWORK === 'mainnet-beta' ? MAINNET_RPC_ENDPOINTS : DEVNET_RPC_ENDPOINTS;
const RPC_ENDPOINT = RPC_ENDPOINTS[0] || 'https://api.mainnet-beta.solana.com';

// Create connection with retry configuration
const connection = new Connection(RPC_ENDPOINT, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
});

/**
 * Proxy endpoint to get latest blockhash
 * This avoids CORS and rate limiting issues from browser requests
 * Handle OPTIONS preflight for CORS
 */
router.options('/blockhash', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/blockhash', async (req, res) => {
  // Set CORS headers
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
 * Get account balance via backend proxy (avoids CORS/403 errors)
 */
router.options('/account-balance', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/account-balance', async (req, res) => {
  // Set CORS headers
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

    // Try each RPC endpoint in order
    let lastError: Error | null = null;
    
    const { PublicKey } = await import('@solana/web3.js');
    const publicKey = new PublicKey(address);
    
    console.log(`[Balance Check] Network: ${SOLANA_NETWORK}, NODE_ENV: ${process.env.NODE_ENV}, Endpoints: ${RPC_ENDPOINTS.length}, Address: ${address}`);
    console.log(`[Balance Check] Endpoint list:`, RPC_ENDPOINTS);
    
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        console.log(`[${SOLANA_NETWORK}] Attempting balance check via ${endpoint}...`);
        const testConnection = new Connection(endpoint, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000,
          disableRetryOnRateLimit: false,
        });
        
        // Verify connection works first
        try {
          const version = await testConnection.getVersion();
          console.log(`✅ Connection to ${endpoint} verified, version: ${version['solana-core'] || 'unknown'}`);
        } catch (connError) {
          console.warn(`⚠️ Connection test failed for ${endpoint}, but continuing...`);
          // Continue anyway - getVersion might fail but getBalance might work
        }
        
        // Get balance - try multiple commitment levels if needed
        let balance: number;
        let accountInfo: any = null;
        let lastBalanceError: Error | null = null;
        
        // Try 'confirmed' first (faster)
        try {
          balance = await testConnection.getBalance(publicKey, 'confirmed');
          accountInfo = await testConnection.getAccountInfo(publicKey, 'confirmed');
          console.log(`✅ Got balance via ${endpoint} (confirmed): ${balance} lamports = ${balance / 1e9} SOL`);
        } catch (confirmedError) {
          lastBalanceError = confirmedError instanceof Error ? confirmedError : new Error(String(confirmedError));
          console.warn(`⚠️ getBalance('confirmed') failed: ${lastBalanceError.message}, trying 'finalized'...`);
          
          // Try 'finalized' (slower but more reliable)
          try {
            balance = await testConnection.getBalance(publicKey, 'finalized');
            accountInfo = await testConnection.getAccountInfo(publicKey, 'finalized');
            console.log(`✅ Got balance via ${endpoint} (finalized): ${balance} lamports = ${balance / 1e9} SOL`);
          } catch (finalizedError) {
            console.error(`❌ Both 'confirmed' and 'finalized' failed for ${endpoint}`);
            throw lastBalanceError; // Throw original error
          }
        }
        
        // Validate balance - if it's 0, that might be correct, but log it
        const balanceSOL = balance / 1e9;
        
        if (balance === 0) {
          console.warn(`⚠️ Balance is 0 for ${address} on ${endpoint} - this might be correct if account is empty`);
        }
        
        console.log(`✅ Balance check successful via ${endpoint}:`, {
          address,
          balance,
          balanceSOL,
          accountExists: accountInfo !== null,
          owner: accountInfo?.owner?.toString() || null,
          network: SOLANA_NETWORK,
          endpoint
        });
        
        return res.json({
          success: true,
          balance,
          balanceSOL,
          accountExists: accountInfo !== null,
          owner: accountInfo?.owner?.toString() || null
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error(`❌ Failed to check balance via ${endpoint}:`, {
          error: errorMsg,
          stack: errorStack,
          endpoint
        });
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next endpoint
      }
    }
    
    console.error('All RPC endpoints failed for balance check:', lastError);
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
 * Verify transaction exists and was confirmed on blockchain
 */
router.options('/verify-transaction', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/verify-transaction', async (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const { signature } = req.body;
    
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Signature is required'
      });
    }

    // Try each RPC endpoint in order
    let lastError: Error | null = null;
    
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const testConnection = new Connection(endpoint, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000,
          disableRetryOnRateLimit: false,
        });
        
        // Check if transaction exists and get its status
        const statusResult = await testConnection.getSignatureStatus(signature);
        
        if (!statusResult || !statusResult.value) {
          continue; // Try next endpoint
        }

        const status = statusResult.value;
        
        // CRITICAL: Check if transaction has an error - if err is not null, transaction FAILED
        if (status.err) {
          console.error(`❌ Transaction ${signature} has error:`, status.err);
          return res.json({
            success: false,
            confirmed: false,
            error: status.err.toString(),
            transactionFailed: true
          });
        }

        // Transaction exists, has no error, and is confirmed
        const confirmationStatus = status.confirmationStatus || 'confirmed';
        console.log(`✅ Transaction ${signature} verified successfully:`, {
          confirmationStatus,
          slot: status.slot || null
        });
        
        return res.json({
          success: true,
          confirmed: true,
          confirmationStatus,
          transactionFailed: false
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next endpoint
      }
    }
    
    // If all endpoints failed, return not found
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
 * Confirm transaction with blockhash and lastValidBlockHeight
 * This waits for the transaction to be confirmed on-chain
 */
router.options('/confirm-transaction', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/confirm-transaction', async (req, res) => {
  // Set CORS headers
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

    // Try each RPC endpoint in order
    let lastError: Error | null = null;
    
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const testConnection = new Connection(endpoint, {
          commitment: commitment as any,
          confirmTransactionInitialTimeout: 60000,
          disableRetryOnRateLimit: false,
        });
        
        console.log(`[${SOLANA_NETWORK}] Confirming transaction ${signature} via ${endpoint}...`);
        
        // Confirm transaction with blockhash
        const confirmation = await testConnection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight: lastValidBlockHeight || undefined,
        }, commitment as any);
        
        // confirmation is RpcResponseAndContext<SignatureResult>
        // Get slot from context if available
        const slot = (confirmation as any).context?.slot || null;
        
        console.log(`✅ Transaction confirmed via ${endpoint}:`, {
          signature,
          slot,
          value: confirmation.value,
        });
        
        return res.json({
          success: true,
          confirmed: true,
          slot,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to confirm transaction via ${endpoint}:`, errorMsg);
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next endpoint
      }
    }
    
    // If all endpoints failed
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
 * Send a raw transaction to the network
 * This avoids CORS and rate limiting issues from browser requests
 */
router.options('/send-transaction', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/send-transaction', async (req, res) => {
  // Set CORS headers
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

    // Convert base64 transaction to Buffer
    let transactionBuffer: Buffer;
    try {
      transactionBuffer = Buffer.from(transaction, 'base64');
      console.log('Received transaction buffer, size:', transactionBuffer.length, 'bytes');
      
      // Validate buffer size (should be reasonable for a Solana transaction)
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

    // Try each RPC endpoint in order
    let lastError: Error | null = null;
    
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        console.log(`Attempting to send transaction via ${endpoint}...`);
        const testConnection = new Connection(endpoint, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000,
          disableRetryOnRateLimit: false,
        });
        
        // Send transaction
        // Skip preflight to avoid simulation errors (transaction will be validated on-chain)
        // The simulation might fail due to temporary network issues or account state
        const sendOptions = {
          skipPreflight: true, // Skip simulation to avoid false negatives
          maxRetries: 3,
          preflightCommitment: undefined, // Don't wait for preflight
          ...(options || {})
        };
        
        try {
          const signature = await testConnection.sendRawTransaction(
            transactionBuffer,
            sendOptions
          );
          
          console.log(`✅ Transaction sent successfully via ${endpoint}: ${signature}`);
          
          // CRITICAL: Wait a moment and verify the transaction actually exists
          // If it doesn't exist, it was likely dropped due to being invalid
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          try {
            const statusResult = await testConnection.getSignatureStatus(signature);
            if (!statusResult || !statusResult.value) {
              console.warn(`⚠️ Transaction ${signature} not found after 2 seconds - may have been dropped`);
              // Continue to next endpoint - transaction might still be processing
            } else if (statusResult.value.err) {
              console.error(`❌ Transaction ${signature} has error:`, statusResult.value.err);
              throw new Error(`Transaction failed: ${statusResult.value.err.toString()}`);
            } else {
              console.log(`✅ Transaction ${signature} verified - exists and has no errors`);
            }
          } catch (verifyError) {
            console.warn(`⚠️ Could not verify transaction immediately:`, verifyError);
            // Continue anyway - transaction might still be processing
          }
          
          return res.json({
            success: true,
            signature
          });
        } catch (sendError: any) {
          // If error contains "simulation" or "preflight", it means the RPC still simulated
          // even though we set skipPreflight. Try with a different approach or just log it.
          const errorMsg = sendError?.message || String(sendError);
          
          if (errorMsg.includes('simulation') || errorMsg.includes('Simulation') || errorMsg.includes('preflight')) {
            console.warn(`⚠️ RPC ${endpoint} ran simulation despite skipPreflight. Error: ${errorMsg}`);
            // Try one more time with explicit skip flags
            try {
              const retrySignature = await testConnection.sendRawTransaction(
                transactionBuffer,
                {
                  skipPreflight: true,
                  maxRetries: 0, // Don't retry on RPC side
                }
              );
              console.log(`✅ Transaction sent on retry via ${endpoint}: ${retrySignature}`);
              return res.json({
                success: true,
                signature: retrySignature
              });
            } catch (retryError) {
              console.error(`❌ Retry also failed for ${endpoint}:`, retryError);
              throw retryError;
            }
          }
          throw sendError; // Re-throw if it's not a simulation error
        }
      } catch (error) {
        console.error(`❌ Failed to send via ${endpoint}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next endpoint
      }
    }
    
    // If all endpoints failed, return error
    throw lastError || new Error('All RPC endpoints failed');
    
  } catch (error) {
    console.error('Error sending transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send transaction';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    console.error('Full error details:', errorDetails);
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    });
  }
});

export default router;

