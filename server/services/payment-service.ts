import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';

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
  
  // Verify we're using the correct platform wallet
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
  
  // Get latest blockhash FIRST
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  
  // Set fee payer and blockhash (like working releaseEscrowPayment)
  transaction.feePayer = escrowAccount;
  transaction.recentBlockhash = blockhash;
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
    // USDC token transfer - EXACT match to working releaseEscrowPayment
    const tokenMint = USDC_MINT;
    const decimals = 6;
    
    // Get escrow's token account (platform wallet's USDC ATA)
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      escrowAccount
    );
    
    // Get freelancer's token account
    const freelancerTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      freelancerWallet
    );
    
    const { createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount } = await import('@solana/spl-token');
    
    // CRITICAL: Verify source token account exists and has balance BEFORE attempting transfer
    try {
      const sourceAccountInfo = await connection.getAccountInfo(escrowTokenAccount);
      
      if (!sourceAccountInfo) {
        throw new Error('Source token account does not exist. The x402 payment may not have been received.');
      }
      
      // Verify it's a valid token account
      if (sourceAccountInfo.owner.toString() !== TOKEN_PROGRAM_ID.toString()) {
        throw new Error('Source account is not a valid token account');
      }
      
      // Get token account details to verify balance and ownership
      const sourceTokenAccountData = await getAccount(connection, escrowTokenAccount);
      const sourceBalanceUSDC = Number(sourceTokenAccountData.amount) / Math.pow(10, decimals);
      
      // Verify the token account is owned by the platform wallet
      if (sourceTokenAccountData.owner.toString() !== escrowAccount.toString()) {
        throw new Error('Token account owner mismatch');
      }
      
      // Verify the token account is for the correct mint (USDC)
      if (sourceTokenAccountData.mint.toString() !== tokenMint.toString()) {
        throw new Error('Token account mint mismatch');
      }
      
      if (sourceBalanceUSDC < amount) {
        throw new Error(`Insufficient USDC balance. Available: ${sourceBalanceUSDC}, Required: ${amount}`);
      }
    } catch (validationError: any) {
      console.error('Payment release validation failed:', validationError.message);
      throw validationError;
    }
    
    // Check if freelancer token account exists - use null check, not try-catch
    const freelancerAccountInfo = await connection.getAccountInfo(freelancerTokenAccount);
    if (!freelancerAccountInfo) {
      // Freelancer token account doesn't exist - create it
      transaction.add(
        createAssociatedTokenAccountInstruction(
          escrowAccount, // Use platform wallet (escrow account) as payer
          freelancerTokenAccount,
          freelancerWallet,
          tokenMint
        )
      );
    }
    
    // Transfer tokens
    const transferAmount = Math.round(amount * Math.pow(10, decimals));
    transaction.add(
      createTransferInstruction(
        escrowTokenAccount,
        freelancerTokenAccount,
        escrowAccount, // Escrow account as authority
        transferAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }
  
  // Verify transaction is valid before signing
  if (transaction.instructions.length === 0) {
    throw new Error('Transaction has no instructions - cannot send empty transaction');
  }
  
  // Sign with platform keypair
  transaction.sign(platformKeypair);
  
  let signature: string;
  try {
    signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false, maxRetries: 3 }
    );
  } catch (error: any) {
    console.error('Payment release transaction failed:', error.message);
    throw error;
  }
  
  // Confirm transaction
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight
  }, 'confirmed');
  
  return signature;
}

/**
 * Verify x402 payment transaction on Base network
 * Checks if a transaction sent USDC to the platform wallet
 */
export async function verifyX402Payment(
  transactionSignature: string,
  expectedSender: string,
  expectedAmount: number
): Promise<{ verified: boolean; amount?: number; error?: string }> {
  try {
    const { ethers } = await import('ethers');
    
    // Base network configuration
    const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const platformWallet = getPlatformWalletAddress();
    
    // Create provider for Base network
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Retry with exponential backoff if transaction not found yet
    let receipt = null;
    let retries = 0;
    const maxRetries = 5;
    
    while (!receipt && retries < maxRetries) {
      try {
        receipt = await provider.getTransactionReceipt(transactionSignature);
        
        if (!receipt) {
          // Transaction not found yet - wait and retry
          if (retries < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1))); // Exponential backoff: 1s, 2s, 3s, 4s
            retries++;
            continue;
          }
          return {
            verified: false,
            error: 'Transaction not found on Base network after multiple attempts'
          };
        }
      } catch (statusError: any) {
        // If status check fails, retry
        if (retries < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
          retries++;
          continue;
        }
        throw statusError;
      }
    }

    // Check if transaction has errors
    if (!receipt) {
      return {
        verified: false,
        error: 'Transaction receipt is null'
      };
    }
    
    if (receipt.status !== 1) {
      return {
        verified: false,
        error: `Transaction failed with status: ${receipt.status}`
      };
    }

    // Get transaction details
    const tx = await provider.getTransaction(transactionSignature);
    if (!tx) {
      return {
        verified: false,
        error: 'Transaction not found'
      };
    }

    // Check if transaction from matches expected sender
    if (tx.from.toLowerCase() !== expectedSender.toLowerCase()) {
      return {
        verified: false,
        error: `Transaction from address (${tx.from}) does not match expected sender (${expectedSender})`
      };
    }

    // Check if transaction is to USDC contract
    if (tx.to?.toLowerCase() !== BASE_USDC_ADDRESS.toLowerCase()) {
      return {
        verified: false,
        error: `Transaction is not to USDC contract. Expected: ${BASE_USDC_ADDRESS}, Got: ${tx.to}`
      };
    }

    // Parse transfer event from logs
    // ERC20 Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
    const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const platformWalletLower = platformWallet.toLowerCase();
    
    let totalUSDCReceived = BigInt(0);
    const expectedMicroUSDC = BigInt(Math.round(expectedAmount * Math.pow(10, 6))); // USDC has 6 decimals
    
    // Check all Transfer events in the transaction
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() && 
          log.topics[0] === transferEventSignature) {
        // Parse Transfer event
        // topics[0] = event signature
        // topics[1] = from address (indexed)
        // topics[2] = to address (indexed)
        // data = amount
        
        if (log.topics.length >= 3) {
          const fromAddress = '0x' + log.topics[1].slice(-40);
          const toAddress = '0x' + log.topics[2].slice(-40);
          
          // Check if this is a transfer TO the platform wallet
          if (toAddress.toLowerCase() === platformWalletLower) {
            const amount = BigInt(log.data);
            totalUSDCReceived += amount;
          }
        }
      }
    }

    // Verify amount matches (allow small tolerance for rounding)
    const tolerance = BigInt(1000); // 0.001 USDC tolerance
    const difference = totalUSDCReceived > expectedMicroUSDC 
      ? totalUSDCReceived - expectedMicroUSDC 
      : expectedMicroUSDC - totalUSDCReceived;
    
    if (difference > tolerance) {
      return {
        verified: false,
        error: `Payment amount mismatch. Expected: ${expectedMicroUSDC} micro-USDC, Received: ${totalUSDCReceived} micro-USDC`
      };
    }

    if (totalUSDCReceived === BigInt(0)) {
      return {
        verified: false,
        error: 'No USDC transfer found to platform wallet in this transaction'
      };
    }

    return {
      verified: true,
      amount: Number(totalUSDCReceived) / Math.pow(10, 6) // Convert back to USDC
    };
  } catch (error: any) {
    console.error('Error verifying x402 payment on Base:', error);
    return {
      verified: false,
      error: error.message || 'Failed to verify payment transaction on Base network'
    };
  }
}

// Export platform wallet address getter
export function getPlatformWalletAddress(): string {
  const platformKeypair = getPlatformKeypair();
  return platformKeypair.publicKey.toString();
}

