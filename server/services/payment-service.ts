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
  console.log(`[RELEASE START] Currency: ${currency}, Amount: ${amount}, Freelancer: ${freelancerWallet.toString()}`);
  
  // Security: Validate amount
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }
  if (amount > 1000000) {
    throw new Error('Payment amount exceeds maximum allowed (1M)');
  }

  const platformKeypair = getPlatformKeypair();
  const escrowAccount = platformKeypair.publicKey;
  
  // Verify we're using the correct platform wallet
  console.log(`[RELEASE] Platform wallet: ${escrowAccount.toString()}`);
  if (escrowAccount.toString() !== 'AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U') {
    throw new Error(`Platform wallet mismatch! Expected AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U, got ${escrowAccount.toString()}`);
  }
  
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
    
    console.log(`[RELEASE] USDC Transfer - Source: ${sourceTokenAccount.toString()}, Dest: ${destTokenAccount.toString()}, Amount: ${amount}`);
    
    // CRITICAL: Verify source account exists and is a VALID TOKEN ACCOUNT (not just any account)
    // Use getAccount from @solana/spl-token to verify it's actually a token account
    const { getAccount } = await import('@solana/spl-token');
    try {
      const sourceTokenAccountData = await getAccount(connection, sourceTokenAccount);
      console.log(`[RELEASE] Source token account VERIFIED:`, {
        address: sourceTokenAccount.toString(),
        owner: sourceTokenAccountData.owner.toString(),
        mint: sourceTokenAccountData.mint.toString(),
        amount: sourceTokenAccountData.amount.toString(),
        decimals: sourceTokenAccountData.mint.toString() === USDC_MINT.toString() ? 6 : 'unknown'
      });
      
      // Verify it's USDC
      if (sourceTokenAccountData.mint.toString() !== USDC_MINT.toString()) {
        throw new Error(`Source token account is not USDC! Mint: ${sourceTokenAccountData.mint.toString()}, Expected: ${USDC_MINT.toString()}`);
      }
      
      // Verify the owner is the platform wallet
      if (sourceTokenAccountData.owner.toString() !== escrowAccount.toString()) {
        throw new Error(`Source token account owner mismatch! Owner: ${sourceTokenAccountData.owner.toString()}, Expected: ${escrowAccount.toString()}`);
      }
      
      // Check balance
      const balanceUSDC = Number(sourceTokenAccountData.amount) / Math.pow(10, 6);
      console.log(`[RELEASE] Source account balance: ${balanceUSDC} USDC, Required: ${amount} USDC`);
      if (balanceUSDC < amount) {
        throw new Error(`Insufficient USDC balance. Available: ${balanceUSDC} USDC, Required: ${amount} USDC`);
      }
    } catch (error: any) {
      console.error(`[RELEASE ERROR] Source token account verification failed:`, error);
      if (error.message?.includes('Invalid param') || error.message?.includes('not found')) {
        throw new Error(`Platform wallet USDC token account does not exist: ${sourceTokenAccount.toString()}. The x402 payment may not have been received.`);
      }
      throw error;
    }
    
    // Check if destination exists using getAccount (more reliable than getAccountInfo)
    let destAccountExists = false;
    try {
      const destAccountData = await getAccount(connection, destTokenAccount);
      destAccountExists = true;
      console.log(`[RELEASE] Destination account EXISTS and is valid:`, {
        address: destTokenAccount.toString(),
        owner: destAccountData.owner.toString(),
        mint: destAccountData.mint.toString()
      });
    } catch (error: any) {
      // Account doesn't exist or isn't valid - we'll create it
      destAccountExists = false;
      console.log(`[RELEASE] Destination account does NOT exist (or invalid), will create it:`, error.message);
    }
    
    // Create destination account if needed (BEFORE transfer instruction)
    // This becomes Instruction 0 if the account doesn't exist
    if (!destAccountExists) {
      console.log(`[RELEASE] Adding create account instruction (will be Instruction 0)`);
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
    // This becomes Instruction 0 if dest account exists, or Instruction 1 if we created it
    const transferAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));
    
    console.log(`[RELEASE] Adding transfer instruction (will be Instruction ${transaction.instructions.length}):`, {
      from: sourceTokenAccount.toString(),
      to: destTokenAccount.toString(),
      authority: escrowAccount.toString(),
      amount: transferAmount.toString(),
      amountUSDC: amount,
      tokenMint: tokenMint.toString(),
      decimals: decimals
    });
    
    // CRITICAL: Verify addresses one more time right before creating instruction
    console.log(`[RELEASE] VERIFYING addresses before createTransferInstruction:`, {
      sourceTokenAccount: sourceTokenAccount.toString(),
      destTokenAccount: destTokenAccount.toString(),
      authority: escrowAccount.toString(),
      platformWallet: escrowAccount.toString(),
      expectedPlatform: 'AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U',
      matches: escrowAccount.toString() === 'AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U'
    });
    
    const transferIx = createTransferInstruction(
      sourceTokenAccount, // From: platform wallet USDC account
      destTokenAccount,    // To: freelancer USDC account
      escrowAccount,       // Authority: platform wallet (owner of source)
      transferAmount,      // Amount in micro-USDC (BigInt)
      [],
      TOKEN_PROGRAM_ID
    );
    
    console.log(`[RELEASE] Transfer instruction created:`, {
      programId: transferIx.programId.toString(),
      keys: transferIx.keys.map((k, i) => ({
        index: i,
        pubkey: k.pubkey.toString(),
        isSigner: k.isSigner,
        isWritable: k.isWritable
      }))
    });
    
    transaction.add(transferIx);
    
    console.log(`[RELEASE] Transaction built with ${transaction.instructions.length} instruction(s)`);
    
    // CRITICAL: Double-check the source account one more time right before building
    // Sometimes account state can change or we might have the wrong account
    try {
      const finalCheck = await getAccount(connection, sourceTokenAccount);
      console.log(`[RELEASE] FINAL CHECK - Source account before transfer:`, {
        address: sourceTokenAccount.toString(),
        owner: finalCheck.owner.toString(),
        mint: finalCheck.mint.toString(),
        amount: finalCheck.amount.toString(),
        expectedAuthority: escrowAccount.toString(),
        ownerMatchesAuthority: finalCheck.owner.toString() === escrowAccount.toString()
      });
      
      if (finalCheck.owner.toString() !== escrowAccount.toString()) {
        throw new Error(`CRITICAL: Source token account owner (${finalCheck.owner.toString()}) does NOT match authority (${escrowAccount.toString()})!`);
      }
      
      if (finalCheck.mint.toString() !== USDC_MINT.toString()) {
        throw new Error(`CRITICAL: Source token account mint (${finalCheck.mint.toString()}) is NOT USDC (${USDC_MINT.toString()})!`);
      }
    } catch (error: any) {
      console.error(`[RELEASE ERROR] Final source account check failed:`, error);
      throw new Error(`Source token account verification failed before transfer: ${error.message}`);
    }
  }
  
  // Sign with platform keypair
  transaction.sign(platformKeypair);
  
  console.log(`[RELEASE] Transaction signed, ${transaction.instructions.length} instruction(s)`);
  for (let i = 0; i < transaction.instructions.length; i++) {
    const ix = transaction.instructions[i];
    console.log(`[RELEASE] Instruction ${i}: Program=${ix.programId.toString()}, Keys=${ix.keys.length}, Data=${ix.data.length} bytes`);
    if (ix.keys.length > 0) {
      console.log(`[RELEASE] Instruction ${i} accounts:`, ix.keys.map((k, idx) => `${idx}:${k.pubkey.toString()}`).join(', '));
    }
  }
  
  // Send and confirm transaction (let sendRawTransaction do the simulation)
  // The error will be more detailed from sendRawTransaction
  console.log(`[RELEASE] Sending transaction...`);
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: false, maxRetries: 3 } // Let it simulate to get better errors
  );
  console.log(`[RELEASE] Transaction sent: ${signature}`);
  
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

