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
    
    console.log(`[USDC Release] Starting verification:`, {
      escrowAccount: escrowAccount.toString(),
      escrowTokenAccount: escrowTokenAccount.toString(),
      amount: amount,
      freelancerWallet: freelancerWallet.toString()
    });
    
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
      
      console.log(`[USDC Release] Platform wallet USDC token account verified:`, {
        address: escrowTokenAccount.toString(),
        balance: escrowBalance,
        required: amount,
        hasEnough: escrowBalance >= amount
      });
      
      if (escrowBalance < amount) {
        throw new Error(`Insufficient USDC balance in platform wallet. Required: ${amount} USDC, Available: ${escrowBalance} USDC`);
      }
    } catch (error: any) {
      console.error(`[USDC Release] Error verifying escrow token account:`, error);
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
      throw new Error(`Failed to verify platform wallet USDC token account: ${error.message || 'Unknown error'}`);
    }
    
    // Get freelancer's token account
    const freelancerTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      freelancerWallet
    );
    
    console.log(`[USDC Release] Freelancer token account: ${freelancerTokenAccount.toString()}`);
    
    // CRITICAL: For SPL token transfers, the authority must be the owner of the SOURCE token account
    // Get the token account info to verify it's a valid token account and get the owner
    const { getAccount } = await import('@solana/spl-token');
    let escrowTokenAccountData;
    let transferAuthority: PublicKey;
    
    try {
      escrowTokenAccountData = await getAccount(connection, escrowTokenAccount);
      console.log(`[USDC Release] Escrow token account verified:`, {
        address: escrowTokenAccount.toString(),
        owner: escrowTokenAccountData.owner.toString(),
        mint: escrowTokenAccountData.mint.toString(),
        amount: escrowTokenAccountData.amount.toString(),
        decimals: escrowTokenAccountData.mint.toString() === USDC_MINT.toString() ? 6 : 'unknown',
        platformWallet: escrowAccount.toString()
      });
      
      // The authority for the transfer must be the owner of the source token account
      transferAuthority = escrowTokenAccountData.owner;
      
      // Verify the owner is the platform wallet
      if (transferAuthority.toString() !== escrowAccount.toString()) {
        throw new Error(`Token account owner mismatch. Account owner: ${transferAuthority.toString()}, Expected platform wallet: ${escrowAccount.toString()}`);
      }
      
      console.log(`[USDC Release] Transfer authority verified: ${transferAuthority.toString()}`);
    } catch (error: any) {
      console.error(`[USDC Release] Error getting escrow token account data:`, error);
      // If getAccount fails, the account might not be a valid token account
      if (error.message?.includes('Invalid param') || error.message?.includes('not found')) {
        throw new Error(`Platform wallet USDC token account is not a valid token account: ${escrowTokenAccount.toString()}. Error: ${error.message}`);
      }
      if (error.message?.includes('owner mismatch')) {
        throw error;
      }
      // If we can't verify, assume platform wallet is the owner and proceed
      console.warn(`[USDC Release] Could not verify token account owner, assuming platform wallet is owner`);
      transferAuthority = escrowAccount;
    }
    
    // Check if freelancer token account exists, create if not
    let freelancerTokenAccountInfo;
    try {
      freelancerTokenAccountInfo = await connection.getAccountInfo(freelancerTokenAccount);
      if (freelancerTokenAccountInfo) {
        // Verify it's a valid token account
        try {
          const freelancerTokenAccountData = await getAccount(connection, freelancerTokenAccount);
          console.log(`[USDC Release] Freelancer token account exists and is valid:`, {
            address: freelancerTokenAccount.toString(),
            owner: freelancerTokenAccountData.owner.toString(),
            mint: freelancerTokenAccountData.mint.toString()
          });
        } catch (error: any) {
          console.warn(`[USDC Release] Freelancer token account exists but might not be valid, will recreate:`, error.message);
          // Account exists but isn't valid - we'll create it anyway (will fail if it's a different type)
          transaction.add(
            createAssociatedTokenAccountInstruction(
              escrowAccount,
              freelancerTokenAccount,
              freelancerWallet,
              tokenMint
            )
          );
        }
      } else {
        // Freelancer doesn't have a USDC token account - create it
        console.log(`[USDC Release] Freelancer token account does not exist, creating it`);
        transaction.add(
          createAssociatedTokenAccountInstruction(
            escrowAccount, // Platform wallet pays for account creation
            freelancerTokenAccount,
            freelancerWallet,
            tokenMint
          )
        );
      }
    } catch (error: any) {
      console.warn(`[USDC Release] Error checking freelancer token account, will create it:`, error.message);
      // If check fails, create the account to be safe
      transaction.add(
        createAssociatedTokenAccountInstruction(
          escrowAccount,
          freelancerTokenAccount,
          freelancerWallet,
          tokenMint
        )
      );
    }
    
    // Transfer tokens from escrow to freelancer
    // Authority must be the owner of the source token account
    const transferAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));
    
    console.log(`[USDC Release] Creating transfer instruction:`, {
      source: escrowTokenAccount.toString(),
      destination: freelancerTokenAccount.toString(),
      authority: transferAuthority.toString(),
      amount: transferAmount.toString(),
      amountUSDC: amount,
      decimals: decimals
    });
    
    transaction.add(
      createTransferInstruction(
        escrowTokenAccount, // Source: platform wallet's USDC token account
        freelancerTokenAccount, // Destination: freelancer's USDC token account
        transferAuthority, // Authority: owner of source token account (should be platform wallet)
        transferAmount, // Amount in micro-USDC (use BigInt)
        [],
        TOKEN_PROGRAM_ID
      )
    );
    
    console.log(`[USDC Release] Transaction built successfully with ${transaction.instructions.length} instruction(s)`);
  }
  
  // Sign with platform keypair
  transaction.sign(platformKeypair);
  
  console.log(`[USDC Release] Transaction signed, instructions: ${transaction.instructions.length}`);
  
  // Simulate transaction first to catch errors before sending
  try {
    const simulation = await connection.simulateTransaction(transaction, {
      commitment: 'confirmed',
      replaceRecentBlockhash: true
    });
    
    console.log(`[USDC Release] Simulation result:`, {
      err: simulation.value.err,
      logs: simulation.value.logs?.slice(0, 10), // First 10 logs
      accountsUsed: simulation.value.accounts?.length
    });
    
    if (simulation.value.err) {
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

