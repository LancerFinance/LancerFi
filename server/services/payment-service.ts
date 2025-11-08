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
    // USDC or other token transfers
    const tokenMint = USDC_MINT;
    const decimals = 6;
    
    // Get escrow's token account (platform wallet's USDC token account)
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      escrowAccount
    );
    
    // CRITICAL: Verify escrow token account exists and has balance before attempting transfer
    // For x402 payments, USDC should already be in the platform wallet
    let escrowTokenAccountInfo;
    let escrowBalance;
    try {
      escrowTokenAccountInfo = await connection.getAccountInfo(escrowTokenAccount);
      if (!escrowTokenAccountInfo) {
        throw new Error(`Platform wallet USDC token account does not exist. Token account: ${escrowTokenAccount.toString()}. This may mean the x402 payment was not received.`);
      }
      
      // Also check the actual balance to ensure we have enough
      const balanceInfo = await connection.getTokenAccountBalance(escrowTokenAccount);
      escrowBalance = parseFloat(balanceInfo.value.uiAmount?.toString() || '0');
      
      console.log(`Platform wallet USDC token account verified: ${escrowTokenAccount.toString()}, Balance: ${escrowBalance} USDC, Required: ${amount} USDC`);
      
      if (escrowBalance < amount) {
        throw new Error(`Insufficient USDC balance in platform wallet. Required: ${amount} USDC, Available: ${escrowBalance} USDC`);
      }
    } catch (error: any) {
      // If getAccountInfo returns null, the account doesn't exist
      if (!escrowTokenAccountInfo) {
        throw new Error(`Platform wallet USDC token account does not exist. Token account: ${escrowTokenAccount.toString()}. This may mean the x402 payment was not received or the token account was never created. Please verify the x402 payment transaction was successful.`);
      }
      // If getTokenAccountBalance fails, it might be because account doesn't exist or is invalid
      if (error.message?.includes('Invalid param') || error.message?.includes('not found') || error.message?.includes('does not exist')) {
        throw new Error(`Platform wallet USDC token account does not exist or is invalid. Token account: ${escrowTokenAccount.toString()}. This may mean the x402 payment was not received.`);
      }
      // If it's a balance check error, re-throw it
      if (error.message?.includes('Insufficient')) {
        throw error;
      }
      // Otherwise, it might be a different error - log it and throw
      console.error('Error checking escrow token account:', error);
      throw new Error(`Failed to verify platform wallet USDC token account: ${error.message || 'Unknown error'}`);
    }
    
    // Get freelancer's token account
    const freelancerTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      freelancerWallet
    );
    
    // Check if freelancer token account exists, create if not
    const freelancerTokenAccountInfo = await connection.getAccountInfo(freelancerTokenAccount);
    if (!freelancerTokenAccountInfo) {
      // Freelancer doesn't have a USDC token account - create it
      transaction.add(
        createAssociatedTokenAccountInstruction(
          escrowAccount, // Platform wallet pays for account creation
          freelancerTokenAccount,
          freelancerWallet,
          tokenMint
        )
      );
    }
    
    // Transfer tokens from escrow to freelancer
    transaction.add(
      createTransferInstruction(
        escrowTokenAccount,
        freelancerTokenAccount,
        escrowAccount, // Platform wallet as authority
        Math.round(amount * Math.pow(10, decimals)),
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }
  
  // Sign with platform keypair
  transaction.sign(platformKeypair);
  
  // Send and confirm transaction
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: false, maxRetries: 3 }
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

