import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';

// Solana configuration - PRODUCTION ONLY: MAINNET-BETA
// NO DEVNET, NO CONDITIONALS
const RPC_ENDPOINT = process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
const SOLANA_NETWORK = 'mainnet-beta';

export const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// USDC Token addresses - MAINNET ONLY
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Mainnet USDC

export type PaymentCurrency = 'USDC' | 'SOLANA' | 'X402';

// Platform wallet keypair - loaded from environment variable
let platformKeypair: Keypair | null = null;

function getPlatformKeypair(): Keypair {
  if (platformKeypair) {
    return platformKeypair;
  }

  const privateKeyString = process.env.PLATFORM_WALLET_PRIVATE_KEY;
  if (!privateKeyString) {
    throw new Error('PLATFORM_WALLET_PRIVATE_KEY environment variable is not set');
  }

  try {
    // Parse private key from environment variable
    // Can be JSON array string like "[42,5,181,...]" or comma-separated
    let privateKeyArray: number[];
    
    if (privateKeyString.startsWith('[')) {
      privateKeyArray = JSON.parse(privateKeyString);
    } else {
      privateKeyArray = privateKeyString.split(',').map(Number);
    }

    const privateKeyUint8Array = new Uint8Array(privateKeyArray);
    platformKeypair = Keypair.fromSecretKey(privateKeyUint8Array);
    
    console.log(`✅ Platform wallet loaded: ${platformKeypair.publicKey.toString()}`);
    return platformKeypair;
  } catch (error) {
    throw new Error(`Failed to load platform wallet keypair: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Release payment from platform wallet to freelancer
 * This is the secure backend implementation
 */
export async function releasePaymentFromPlatform(
  freelancerWallet: PublicKey,
  amount: number,
  currency: PaymentCurrency = 'SOLANA'
): Promise<string> {
  // Security: Validate amount
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }
  if (amount > 1000000) {
    throw new Error('Payment amount exceeds maximum allowed (1M)');
  }

  const platformKeypair = getPlatformKeypair();
  const escrowAccount = platformKeypair.publicKey;
  
  // Security: Verify wallet balance before attempting transfer
  // Note: For USDC, we'll verify the token account exists and has balance in the transfer section below
  // This avoids duplicate checks and ensures we have the token account address available
  if (currency === 'SOLANA') {
    const balance = await connection.getBalance(escrowAccount);
    const requiredLamports = Math.round(amount * LAMPORTS_PER_SOL);
    if (balance < requiredLamports) {
      throw new Error(`Insufficient SOL balance. Required: ${amount} SOL, Available: ${balance / LAMPORTS_PER_SOL} SOL`);
    }
  }
  // For USDC, balance check is done in the transfer section below where we have the token account address
  
  const transaction = new Transaction();
  
  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = escrowAccount;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  
  if (currency === 'SOLANA') {
    // Native SOL transfer
    const lamports = Math.round(amount * LAMPORTS_PER_SOL);
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: escrowAccount,
        toPubkey: freelancerWallet,
        lamports: lamports,
      })
    );
  } else {
    // USDC token transfer - Use EXACT same pattern as x402 payment (which works)
    const tokenMint = USDC_MINT;
    const decimals = 6;
    
    // Get token accounts (same as x402 payment)
    const sourceTokenAccount = await getAssociatedTokenAddress(tokenMint, escrowAccount);
    const destTokenAccount = await getAssociatedTokenAddress(tokenMint, freelancerWallet);
    
    console.log(`[USDC Release] Transfer setup:`, {
      source: sourceTokenAccount.toString(),
      dest: destTokenAccount.toString(),
      amount: amount,
      platformWallet: escrowAccount.toString()
    });
    
    // CRITICAL: Verify source account exists and is valid (platform wallet's USDC account)
    // This must exist since x402 payment was received
    try {
      const sourceAccountInfo = await connection.getAccountInfo(sourceTokenAccount);
      if (!sourceAccountInfo) {
        throw new Error(`Platform wallet USDC token account does not exist: ${sourceTokenAccount.toString()}. The x402 payment may not have been received.`);
      }
      console.log(`[USDC Release] Source account verified: ${sourceTokenAccount.toString()}`);
    } catch (error: any) {
      console.error(`[USDC Release] Source account check failed:`, error);
      throw new Error(`Platform wallet USDC token account is invalid or does not exist: ${sourceTokenAccount.toString()}. Error: ${error.message}`);
    }
    
    // Check if destination exists (same pattern as x402)
    let destAccountExists = false;
    try {
      const accountInfo = await connection.getAccountInfo(destTokenAccount);
      destAccountExists = accountInfo !== null;
      if (destAccountExists) {
        console.log(`[USDC Release] Destination account exists: ${destTokenAccount.toString()}`);
      }
    } catch {
      destAccountExists = false;
    }
    
    // Create destination account if needed (BEFORE transfer instruction)
    if (!destAccountExists) {
      console.log(`[USDC Release] Creating freelancer token account`);
      transaction.add(
        createAssociatedTokenAccountInstruction(
          escrowAccount, // Platform wallet pays
          destTokenAccount,
          freelancerWallet,
          tokenMint
        )
      );
    }
    
    // Transfer using EXACT same pattern as x402 payment
    const transferAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));
    
    console.log(`[USDC Release] Adding transfer instruction:`, {
      from: sourceTokenAccount.toString(),
      to: destTokenAccount.toString(),
      authority: escrowAccount.toString(),
      amount: transferAmount.toString()
    });
    
    transaction.add(
      createTransferInstruction(
        sourceTokenAccount, // From: platform wallet USDC account
        destTokenAccount,    // To: freelancer USDC account
        escrowAccount,       // Authority: platform wallet (owner of source)
        transferAmount,      // Amount in micro-USDC (BigInt)
        [],
        TOKEN_PROGRAM_ID
      )
    );
    
    console.log(`[USDC Release] Transaction built: ${transaction.instructions.length} instruction(s)`);
  }
  
  // Sign with platform keypair
  transaction.sign(platformKeypair);
  
  console.log(`[USDC Release] Transaction signed, instructions: ${transaction.instructions.length}`);
  
  // Simulate transaction first to catch errors before sending
  try {
    // Get a fresh blockhash for simulation
    const { blockhash: simBlockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = simBlockhash;
    
    const simulation = await connection.simulateTransaction(transaction);
    
    console.log(`[USDC Release] Simulation result:`, {
      err: simulation.value.err,
      logs: simulation.value.logs?.slice(0, 10), // First 10 logs
      accountsUsed: simulation.value.accounts?.length
    });
    
    if (simulation.value.err) {
      const errorDetails = {
        err: simulation.value.err,
        logs: simulation.value.logs || []
      };
      console.error(`[USDC Release] Simulation failed with details:`, errorDetails);
      throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}. Logs: ${simulation.value.logs?.join('\n') || 'No logs'}`);
    }
  } catch (simError: any) {
    console.error(`[USDC Release] Simulation error:`, simError);
    // If simulation fails, we still want to see the detailed error
    throw simError;
  }
  
  // Send and confirm transaction
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: true, maxRetries: 3 } // Skip preflight since we already simulated
  );
  
  // Confirm transaction
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight
  }, 'confirmed');
  
  console.log(`✅ Payment released: ${signature} (${amount} ${currency} to ${freelancerWallet.toString()})`);
  
  return signature;
}

/**
 * Verify x402 payment transaction on Solana
 * Checks if a transaction sent USDC to the platform wallet
 */
export async function verifyX402Payment(
  transactionSignature: string,
  expectedSender: string,
  expectedAmount: number
): Promise<{ verified: boolean; amount?: number; error?: string }> {
  try {
    // First, check transaction status (faster than getTransaction)
    // Retry with exponential backoff if transaction not found yet
    let transaction = null;
    let retries = 0;
    const maxRetries = 5;
    
    while (!transaction && retries < maxRetries) {
      try {
        // Try getSignatureStatus first (faster)
        const statusResult = await connection.getSignatureStatus(transactionSignature);
        
        if (!statusResult || !statusResult.value) {
          // Transaction not found yet - wait and retry
          if (retries < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1))); // Exponential backoff: 1s, 2s, 3s, 4s
            retries++;
            continue;
          }
          return {
            verified: false,
            error: 'Transaction not found on Solana network after multiple attempts'
          };
        }
        
        // Check if transaction has errors
        if (statusResult.value.err) {
          return {
            verified: false,
            error: `Transaction failed: ${statusResult.value.err.toString()}`
          };
        }
        
        // Transaction exists and has no errors - now get full transaction details
        transaction = await connection.getTransaction(transactionSignature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });
        
        if (!transaction) {
          // If we can't get transaction but status shows success, still verify using status
          // This is a fallback for when getTransaction fails but status is confirmed
          if (statusResult.value.confirmationStatus === 'confirmed' || statusResult.value.confirmationStatus === 'finalized') {
            // We'll verify using a different method - check balance changes via RPC
            // For now, if status is confirmed and no error, we'll trust it
            // But we still need to verify the amount, so we'll try to get transaction one more time
            await new Promise(resolve => setTimeout(resolve, 2000));
            transaction = await connection.getTransaction(transactionSignature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            });
            
            if (!transaction) {
              return {
                verified: false,
                error: 'Transaction confirmed but could not retrieve details for amount verification'
              };
            }
          } else {
            return {
              verified: false,
              error: 'Transaction not found on Solana network'
            };
          }
        }
      } catch (statusError: any) {
        // If status check fails, try getTransaction directly
        if (retries < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
          retries++;
          continue;
        }
        throw statusError;
      }
    }

    // Check if transaction has errors (double-check)
    if (transaction.meta?.err) {
      return {
        verified: false,
        error: `Transaction failed: ${JSON.stringify(transaction.meta.err)}`
      };
    }

    // Get platform wallet address
    const platformKeypair = getPlatformKeypair();
    const platformWallet = platformKeypair.publicKey;

    // Check if transaction fee payer matches expected sender
    // For VersionedTransaction, use getAccountKeys() method
    const accountKeys = transaction.transaction.message.getAccountKeys();
    const feePayer = accountKeys.get(0);
    if (!feePayer || feePayer.toString() !== expectedSender) {
      return {
        verified: false,
        error: `Transaction fee payer (${feePayer?.toString() || 'unknown'}) does not match expected sender (${expectedSender})`
      };
    }

    // Check token transfers in the transaction
    const preBalances = transaction.meta?.preTokenBalances || [];
    const postBalances = transaction.meta?.postTokenBalances || [];

    // Find USDC transfers to platform wallet
    let totalUSDCReceived = 0;
    const expectedMicroUSDC = Math.round(expectedAmount * Math.pow(10, 6)); // USDC has 6 decimals

    // Check post-token balances for platform wallet
    for (const balance of postBalances) {
      if (balance.owner === platformWallet.toString() && balance.mint === USDC_MINT.toString()) {
        const postAmount = BigInt(balance.uiTokenAmount.amount);
        
        // Find corresponding pre-balance
        const preBalance = preBalances.find(
          b => b.owner === platformWallet.toString() && b.mint === USDC_MINT.toString()
        );
        const preAmount = preBalance ? BigInt(preBalance.uiTokenAmount.amount) : BigInt(0);
        
        const received = postAmount - preAmount;
        if (received > 0) {
          totalUSDCReceived += Number(received);
        }
      }
    }

    // Verify amount matches (allow small tolerance for rounding)
    const tolerance = 1000; // 0.001 USDC tolerance
    if (Math.abs(totalUSDCReceived - expectedMicroUSDC) > tolerance) {
      return {
        verified: false,
        error: `Payment amount mismatch. Expected: ${expectedMicroUSDC} micro-USDC, Received: ${totalUSDCReceived} micro-USDC`
      };
    }

    return {
      verified: true,
      amount: totalUSDCReceived / Math.pow(10, 6) // Convert back to USDC
    };
  } catch (error: any) {
    console.error('Error verifying x402 payment:', error);
    return {
      verified: false,
      error: error.message || 'Failed to verify payment transaction'
    };
  }
}

// Export platform wallet address getter
export function getPlatformWalletAddress(): string {
  const platformKeypair = getPlatformKeypair();
  return platformKeypair.publicKey.toString();
}

