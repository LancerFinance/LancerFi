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

// Platform fee wallet - Production wallet address
export const PLATFORM_WALLET = new PublicKey('DhVcKrZc5b8eVfvhMiVghKVfHkfxBJuNvxXpXfFHQVqg'); // Web3Lance platform wallet

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
    new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM') // Web3Lance escrow program ID
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