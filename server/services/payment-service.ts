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
  if (currency === 'SOLANA') {
    const balance = await connection.getBalance(escrowAccount);
    const requiredLamports = Math.round(amount * LAMPORTS_PER_SOL);
    if (balance < requiredLamports) {
      throw new Error(`Insufficient SOL balance. Required: ${amount} SOL, Available: ${balance / LAMPORTS_PER_SOL} SOL`);
    }
  } else {
    // For USDC, check token account balance
    const tokenMint = USDC_MINT;
    const decimals = 6;
    const escrowTokenAccount = await getAssociatedTokenAddress(tokenMint, escrowAccount);
    try {
      const balance = await connection.getTokenAccountBalance(escrowTokenAccount);
      const requiredAmount = Math.round(amount * Math.pow(10, decimals));
      const availableAmount = BigInt(balance.value.amount);
      if (availableAmount < BigInt(requiredAmount)) {
        throw new Error(`Insufficient ${currency} balance in escrow account`);
      }
    } catch (error) {
      throw new Error(`Failed to verify ${currency} balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
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
    
    // Get escrow's token account
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      escrowAccount
    );
    
    // Get freelancer's token account
    const freelancerTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      freelancerWallet
    );
    
    // Check if freelancer token account exists, create if not
    try {
      await connection.getAccountInfo(freelancerTokenAccount);
    } catch {
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
    // Try multiple RPC endpoints if the first one fails
    const RPC_ENDPOINTS = [
      process.env.SOLANA_MAINNET_RPC,
      'https://rpc.ankr.com/solana',
      'https://solana-api.projectserum.com',
      'https://api.mainnet-beta.solana.com',
    ].filter(Boolean) as string[];

    let transaction = null;
    let lastError: Error | null = null;

    // Try each RPC endpoint
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const testConnection = new Connection(endpoint, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 30000,
        });
        
        transaction = await testConnection.getTransaction(transactionSignature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });
        
        if (transaction) {
          break; // Found it, exit loop
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue; // Try next endpoint
      }
    }

    if (!transaction) {
      return {
        verified: false,
        error: `Transaction not found on Solana network. ${lastError?.message || 'All RPC endpoints failed. Please wait a few seconds and try again.'}`
      };
    }

    // Check if transaction has errors
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

    // The owner field in token balances refers to the token account owner (wallet address)
    // We need to check if any token account belongs to the platform wallet and received USDC
    for (const postBalance of postBalances) {
      // Check if this is a USDC token account
      if (postBalance.mint === USDC_MINT.toString()) {
        // Check if the owner (wallet) of this token account is the platform wallet
        if (postBalance.owner === platformWallet.toString()) {
          const postAmount = BigInt(postBalance.uiTokenAmount.amount || '0');
          
          // Find corresponding pre-balance for the same account index
          const preBalance = preBalances.find(
            b => b.accountIndex === postBalance.accountIndex
          );
          const preAmount = preBalance ? BigInt(preBalance.uiTokenAmount.amount || '0') : BigInt(0);
          
          const received = postAmount - preAmount;
          if (received > 0) {
            totalUSDCReceived += Number(received);
          }
        }
      }
    }
    
    // If we didn't find a balance change, check if the platform wallet's token account was created
    // (new token accounts start with 0 balance, so we need to check account creation)
    if (totalUSDCReceived === 0) {
      // Check account keys to see if platform wallet's token account was involved
      const accountKeys = transaction.transaction.message.getAccountKeys();
      const platformWalletStr = platformWallet.toString();
      
      // Look for token account creation or transfers
      // If platform wallet's token account was just created, check if it received tokens
      for (let i = 0; i < accountKeys.length; i++) {
        const accountKey = accountKeys.get(i);
        if (!accountKey) continue;
        
        // Check if this might be the platform wallet's token account
        // We need to verify by checking if tokens were transferred to it
        // The postTokenBalances should have an entry for this account if it received tokens
        const balanceEntry = postBalances.find(b => {
          // The accountIndex corresponds to the position in accountKeys
          // But we need to match by owner (wallet address) and mint
          return b.owner === platformWalletStr && b.mint === USDC_MINT.toString();
        });
        
        if (balanceEntry) {
          const postAmount = BigInt(balanceEntry.uiTokenAmount.amount || '0');
          const preBalance = preBalances.find(b => b.accountIndex === balanceEntry.accountIndex);
          const preAmount = preBalance ? BigInt(preBalance.uiTokenAmount.amount || '0') : BigInt(0);
          const received = postAmount - preAmount;
          if (received > 0) {
            totalUSDCReceived += Number(received);
            break;
          }
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

