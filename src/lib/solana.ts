import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';
import { ORIGIN_MINT, ORIGIN_DECIMALS, getUSDCToOriginRate, createUSDCToOriginSwap } from './origin-token';

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

// Platform fee wallet - Production wallet address
export const PLATFORM_WALLET = new PublicKey('DhVcKrZc5b8eVfvhMiVghKVfHkfxBJuNvxXpXfFHQVqg'); // LancerFi platform wallet

// Payment currencies
export type PaymentCurrency = 'USDC' | 'ORIGIN';

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

// Create escrow account with currency support
export async function createEscrowAccount(
  clientWallet: PublicKey,
  projectId: string,
  amount: number,
  currency: PaymentCurrency = 'ORIGIN',
  platformFeePercent: number = 10
): Promise<{ escrowAccount: PublicKey; transaction: Transaction }> {
  const platformFee = (amount * platformFeePercent) / 100;
  const totalAmount = amount + platformFee;
  
  // Generate escrow account keypair
  // Ensure projectId seed is <= 32 bytes (UUID -> 16 bytes hex)
  const projectSeedHex = projectId.replace(/-/g, '');
  let projectSeedBuffer: Buffer;
  try {
    // If projectId is a UUID, this yields 16 bytes
    projectSeedBuffer = Buffer.from(projectSeedHex, 'hex');
  } catch {
    // Fallback: truncate utf8 bytes to 32 bytes
    projectSeedBuffer = Buffer.from(projectId).slice(0, 32);
  }
  if (projectSeedBuffer.length > 32) {
    projectSeedBuffer = projectSeedBuffer.slice(0, 32);
  }

  const escrowAccount = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), clientWallet.toBuffer(), projectSeedBuffer],
    new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM') // LancerFi escrow program ID
  )[0];

  const transaction = new Transaction();
  
  // Initialize escrow account with project details
  // This would normally call the escrow program's initialize instruction
  // For now, we create a minimal transaction to establish the escrow account
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: clientWallet,
      toPubkey: escrowAccount,
      lamports: 1000000, // Rent for escrow account
    })
  );

  return { escrowAccount, transaction };
}

// Fund escrow with USDC or Origin (with conversion)
export async function fundEscrowWithCurrency(
  clientWallet: PublicKey,
  escrowAccount: PublicKey,
  amount: number,
  currency: PaymentCurrency,
  convertFromUSDC: boolean = false
): Promise<Transaction> {
  const transaction = new Transaction();
  
  if (convertFromUSDC && currency === 'ORIGIN') {
    // Client pays USDC but we convert to Origin internally
    // First create the swap transaction from USDC to Origin
    const swapTxBase64 = await createUSDCToOriginSwap(clientWallet, amount);
    const swapTx = Transaction.from(Buffer.from(swapTxBase64, 'base64'));
    
    // Add swap instructions to our transaction
    for (const instruction of swapTx.instructions) {
      transaction.add(instruction);
    }
    
    return transaction;
  }
  
  // Direct payment in specified currency
  const tokenMint = currency === 'USDC' ? USDC_MINT : ORIGIN_MINT;
  const decimals = currency === 'USDC' ? 6 : ORIGIN_DECIMALS;
  
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

// Release escrow payment (always in Origin tokens)
export async function releaseEscrowPayment(
  clientWallet: PublicKey,
  freelancerWallet: PublicKey,
  escrowAccount: PublicKey,
  amount: number,
  currency: PaymentCurrency = 'ORIGIN'
): Promise<Transaction> {
  const transaction = new Transaction();
  
  // Always release in Origin tokens (internal currency)
  const tokenMint = ORIGIN_MINT;
  const decimals = ORIGIN_DECIMALS;
  
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
  
  // Create freelancer token account if it doesn't exist
  try {
    await connection.getAccountInfo(freelancerTokenAccount);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        clientWallet,
        freelancerTokenAccount,
        freelancerWallet,
        tokenMint
      )
    );
  }
  
  // Transfer Origin tokens from escrow to freelancer
  transaction.add(
    createTransferInstruction(
      escrowTokenAccount,
      freelancerTokenAccount,
      escrowAccount, // Escrow account as authority
      amount * Math.pow(10, decimals),
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  return transaction;
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

// Legacy function kept for backward compatability
export const fundEscrowWithUSDC = (
  clientWallet: PublicKey,
  escrowAccount: PublicKey,
  amount: number
) => fundEscrowWithCurrency(clientWallet, escrowAccount, amount, 'USDC', false);