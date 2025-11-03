import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';
import { ORIGIN_MINT, ORIGIN_DECIMALS } from './origin-token';

// Solana configuration
const MODE = import.meta.env.MODE || 'development';
export const SOLANA_NETWORK = MODE === 'production' ? 'mainnet-beta' : 'devnet';
export const RPC_ENDPOINT = SOLANA_NETWORK === 'mainnet-beta' 
  ? 'https://api.mainnet-beta.solana.com'
  : 'https://api.devnet.solana.com';

export const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// USDC Token addresses
export const USDC_MINT = SOLANA_NETWORK === 'mainnet-beta'
  ? new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') // Mainnet USDC
  : new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // Devnet USDC

// Platform fee wallet - Production wallet address (LancerFi escrow wallet)
// Public Key: AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U
// Private key stored securely in escrow-keypair.json (NEVER commit to git)
export const PLATFORM_WALLET = new PublicKey('AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U'); // LancerFi escrow wallet

// ⚠️ SECURITY: Platform wallet keypair loading has been moved to backend server
// This function is deprecated and should not be used in frontend
// All payment operations must go through the secure backend API
async function getPlatformKeypair(): Promise<Keypair> {
  throw new Error('SECURITY ERROR: Platform wallet keypair must not be loaded in frontend. Use backend API for payment operations.');
}

// Payment currencies
export type PaymentCurrency = 'USDC' | 'SOLANA' | 'X402';

// SOL token configuration
export const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112'); // Wrapped SOL
export const SOL_DECIMALS = 9;

// Escrow program configuration
export interface EscrowAccount {
  projectId: string;
  clientWallet: PublicKey;
  freelancerWallet: PublicKey | null;
  amount: number;
  platformFee: number;
  currency: PaymentCurrency;
  isReleased: boolean;
  milestones: {
    id: string;
    amount: number;
    isCompleted: boolean;
    isApproved: boolean;
  }[];
}

// Create and fund escrow account - uses PLATFORM_WALLET as escrow
export async function createAndFundEscrow(
  clientWallet: PublicKey,
  projectId: string,
  amount: number,
  currency: PaymentCurrency = 'SOLANA',
  platformFeePercent: number = 10
): Promise<{ escrowAccount: PublicKey; transaction: Transaction }> {
  const platformFee = (amount * platformFeePercent) / 100;
  const totalAmount = amount + platformFee;
  
  // Use PLATFORM_WALLET as the escrow account (LancerFi's wallet)
  const escrowAccount = PLATFORM_WALLET;

  const transaction = new Transaction();
  
  if (currency === 'SOLANA') {
    // Native SOL transfer using SystemProgram
    // Convert to lamports and round to integer (BigInt requires integer)
    const totalLamports = Math.round(totalAmount * LAMPORTS_PER_SOL);
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: clientWallet,
        toPubkey: escrowAccount,
        lamports: totalLamports,
      })
    );
  } else {
    // USDC or other token transfers
    const tokenMint = USDC_MINT;
    const decimals = 6;
    
    // Get client's token account
    const clientTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      clientWallet
    );
    
    // Get escrow's (platform) token account
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      escrowAccount
    );
    
    // Check if escrow token account exists, if not create it
    try {
      await connection.getAccountInfo(escrowTokenAccount);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          clientWallet,
          escrowTokenAccount,
          escrowAccount,
          tokenMint
        )
      );
    }
    
    // Transfer total amount (amount + platform fee) to escrow
    // Convert to smallest unit (micro-USDC) and round to integer
    const totalMicroUnits = Math.round(totalAmount * Math.pow(10, decimals));
    transaction.add(
      createTransferInstruction(
        clientTokenAccount,
        escrowTokenAccount,
        clientWallet,
        totalMicroUnits,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  return { escrowAccount, transaction };
}

// Legacy function kept for compatibility - redirects to createAndFundEscrow
export async function createEscrowAccount(
  clientWallet: PublicKey,
  projectId: string,
  amount: number,
  currency: PaymentCurrency = 'SOLANA',
  platformFeePercent: number = 10
): Promise<{ escrowAccount: PublicKey; transaction: Transaction }> {
  return createAndFundEscrow(clientWallet, projectId, amount, currency, platformFeePercent);
}

// Fund escrow with USDC or Solana (label), internally same logic
export async function fundEscrowWithCurrency(
  clientWallet: PublicKey,
  escrowAccount: PublicKey,
  amount: number,
  currency: PaymentCurrency
): Promise<Transaction> {
  const transaction = new Transaction();
  
  // Direct payment in specified currency
  const tokenMint = currency === 'USDC' ? USDC_MINT : SOL_MINT;
  const decimals = currency === 'USDC' ? 6 : SOL_DECIMALS;
  
  // Get client's token account
  const clientTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    clientWallet
  );
  
  // Get escrow's token account
  const escrowTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    escrowAccount
  );
  
  // Create escrow token account if it doesn't exist
  try {
    await connection.getAccountInfo(escrowTokenAccount);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        clientWallet,
        escrowTokenAccount,
        escrowAccount,
        tokenMint
      )
    );
  }
  
  // Transfer tokens to escrow
  transaction.add(
    createTransferInstruction(
      clientTokenAccount,
      escrowTokenAccount,
      clientWallet,
      amount * Math.pow(10, decimals),
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  return transaction;
}

// Release escrow payment (creates transaction - used by client for approval)
export async function releaseEscrowPayment(
  clientWallet: PublicKey,
  freelancerWallet: PublicKey,
  escrowAccount: PublicKey,
  amount: number,
  currency: PaymentCurrency = 'SOLANA'
): Promise<Transaction> {
  const transaction = new Transaction();
  
  // Release in the same currency as funded
  const tokenMint = currency === 'USDC' ? USDC_MINT : SOL_MINT;
  const decimals = currency === 'USDC' ? 6 : SOL_DECIMALS;
  
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
  
  // Create freelancer token account if it doesn't exist (use platform wallet as payer)
  try {
    await connection.getAccountInfo(freelancerTokenAccount);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        escrowAccount, // Use platform wallet (escrow account) as payer
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
      escrowAccount, // Escrow account as authority
      Math.round(amount * Math.pow(10, decimals)),
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  return transaction;
}

// ⚠️ DEPRECATED: This function has been moved to backend server
// DO NOT USE THIS FUNCTION - It exposes private keys in frontend
// Use the backend API endpoint instead via releasePaymentToFreelancer in api-client.ts
// This function is kept for backward compatibility but will throw an error
export async function releasePaymentFromPlatform(
  freelancerWallet: PublicKey,
  amount: number,
  currency: PaymentCurrency = 'SOLANA'
): Promise<string> {
  // SECURITY: This function is deprecated - payment release moved to backend
  throw new Error('SECURITY ERROR: Payment release must be done through secure backend API. This function is disabled.');
}

// Get USDC balance
export async function getUSDCBalance(walletAddress: PublicKey): Promise<number> {
  try {
    const tokenAccount = await getAssociatedTokenAddress(USDC_MINT, walletAddress);
    const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
    return parseFloat(accountInfo.value.uiAmount?.toString() || '0');
  } catch (error) {
    console.error('Error getting USDC balance:', error);
    return 0;
  }
}

// Utility to format currency amounts
export function formatUSDC(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Utility to format SOL amounts
export function formatSOL(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0 SOL';
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount) + ' SOL';
}

// Legacy function kept for backward compatability
export const fundEscrowWithUSDC = (
  clientWallet: PublicKey,
  escrowAccount: PublicKey,
  amount: number
) => fundEscrowWithCurrency(clientWallet, escrowAccount, amount, 'USDC');