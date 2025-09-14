import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';

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

// Platform fee wallet (replace with your actual wallet)
export const PLATFORM_WALLET = new PublicKey('11111111111111111111111111111111'); // Replace with actual platform wallet

// Escrow program configuration
export interface EscrowAccount {
  projectId: string;
  clientWallet: PublicKey;
  freelancerWallet: PublicKey | null;
  amount: number;
  platformFee: number;
  isReleased: boolean;
  milestones: {
    id: string;
    amount: number;
    isCompleted: boolean;
    isApproved: boolean;
  }[];
}

// Create escrow account
export async function createEscrowAccount(
  clientWallet: PublicKey,
  projectId: string,
  amount: number,
  platformFeePercent: number = 10
): Promise<{ escrowAccount: PublicKey; transaction: Transaction }> {
  const platformFee = (amount * platformFeePercent) / 100;
  const totalAmount = amount + platformFee;
  
  // Generate escrow account keypair
  const escrowAccount = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), clientWallet.toBuffer(), Buffer.from(projectId)],
    new PublicKey('11111111111111111111111111111111') // Replace with actual program ID
  )[0];

  const transaction = new Transaction();
  
  // For demo purposes, we'll use a simple SOL transfer
  // In production, implement proper escrow program
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: clientWallet,
      toPubkey: clientWallet, // Demo: self-transfer to produce a valid signature
      lamports: 10000, // minimal lamports for demo on devnet
    })
  );

  return { escrowAccount, transaction };
}

// Fund escrow with USDC
export async function fundEscrowWithUSDC(
  clientWallet: PublicKey,
  escrowAccount: PublicKey,
  amount: number
): Promise<Transaction> {
  const transaction = new Transaction();
  
  // Get client's USDC token account
  const clientUSDCAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    clientWallet
  );
  
  // Get escrow's USDC token account
  const escrowUSDCAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    escrowAccount
  );
  
  // Create escrow token account if it doesn't exist
  try {
    await connection.getAccountInfo(escrowUSDCAccount);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        clientWallet,
        escrowUSDCAccount,
        escrowAccount,
        USDC_MINT
      )
    );
  }
  
  // Transfer USDC to escrow
  transaction.add(
    createTransferInstruction(
      clientUSDCAccount,
      escrowUSDCAccount,
      clientWallet,
      amount * 1_000_000, // USDC has 6 decimals
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  return transaction;
}

// Release escrow payment
export async function releaseEscrowPayment(
  clientWallet: PublicKey,
  freelancerWallet: PublicKey,
  escrowAccount: PublicKey,
  amount: number
): Promise<Transaction> {
  const transaction = new Transaction();
  
  // Get escrow's USDC token account
  const escrowUSDCAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    escrowAccount
  );
  
  // Get freelancer's USDC token account
  const freelancerUSDCAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    freelancerWallet
  );
  
  // Create freelancer token account if it doesn't exist
  try {
    await connection.getAccountInfo(freelancerUSDCAccount);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        clientWallet,
        freelancerUSDCAccount,
        freelancerWallet,
        USDC_MINT
      )
    );
  }
  
  // Transfer USDC from escrow to freelancer
  transaction.add(
    createTransferInstruction(
      escrowUSDCAccount,
      freelancerUSDCAccount,
      escrowAccount, // Escrow account as authority
      amount * 1_000_000, // USDC has 6 decimals
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

// Utility to format USDC amount
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