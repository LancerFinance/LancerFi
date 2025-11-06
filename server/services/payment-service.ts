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

