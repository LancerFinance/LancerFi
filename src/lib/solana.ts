import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';
import { ORIGIN_MINT, ORIGIN_DECIMALS } from './origin-token';

// Solana configuration
const MODE = import.meta.env.MODE || 'development';
export const SOLANA_NETWORK = MODE === 'production' ? 'mainnet-beta' : 'devnet';

// RPC endpoints - try official first, fallback to free public alternatives
// Note: Official Solana RPC (api.mainnet-beta.solana.com) has strict rate limits
// and often blocks browser requests with 403 errors. Many free RPCs now require API keys.
// These are free public endpoints that should work without authentication.
const MAINNET_RPC_ENDPOINTS = [
  import.meta.env.VITE_SOLANA_MAINNET_RPC, // Custom env var (highest priority)
  'https://api.mainnet-beta.solana.com', // Official (rate-limited, but try first)
  'https://solana-api.projectserum.com', // Serum (free, no account needed)
  'https://rpc-mainnet.helius.xyz/?api-key=YOUR_API_KEY', // Not used (requires key)
].filter((endpoint) => endpoint && !endpoint.includes('YOUR_API_KEY'));

const DEVNET_RPC_ENDPOINTS = [
  import.meta.env.VITE_SOLANA_DEVNET_RPC,
  'https://api.devnet.solana.com',
].filter(Boolean);

// Use first available endpoint (custom env var takes priority)
export const RPC_ENDPOINT = SOLANA_NETWORK === 'mainnet-beta' 
  ? (MAINNET_RPC_ENDPOINTS[0] || 'https://api.mainnet-beta.solana.com')
  : (DEVNET_RPC_ENDPOINTS[0] || 'https://api.devnet.solana.com');

// Create connection with retry configuration
// Disable WebSockets to avoid connection issues (use HTTP polling instead)
export const connection = new Connection(RPC_ENDPOINT, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000, // 60 seconds
  disableRetryOnRateLimit: false,
  wsEndpoint: undefined, // Disable WebSocket, use HTTP polling only
});

// Helper function to get blockhash - tries backend proxy first, then falls back to direct RPC
export async function getLatestBlockhashWithFallback(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  // Try backend proxy first (avoids CORS and browser rate limiting)
  const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD ? 'https://server-sepia-alpha-52.vercel.app' : 'http://localhost:3001');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/rpc/blockhash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return {
          blockhash: data.blockhash,
          lastValidBlockHeight: data.lastValidBlockHeight
        };
      }
    }
  } catch (error) {
    console.warn('Backend RPC proxy failed, trying direct RPC:', error);
  }
  
  // Fallback to direct RPC (try endpoints in order)
  const endpoints = SOLANA_NETWORK === 'mainnet-beta' 
    ? MAINNET_RPC_ENDPOINTS 
    : DEVNET_RPC_ENDPOINTS;
  
  let lastError: Error | null = null;
  
  for (const endpoint of endpoints) {
    try {
      const testConnection = new Connection(endpoint, 'confirmed');
      const result = await testConnection.getLatestBlockhash('confirmed');
      return result;
    } catch (error) {
      console.warn(`RPC endpoint ${endpoint} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next endpoint
    }
  }
  
  // If all endpoints fail, throw the last error
  throw lastError || new Error('All RPC endpoints failed');
}

// Helper function to get account balance via backend proxy (avoids CORS/403 errors)
export async function getAccountBalanceViaProxy(address: string): Promise<{ balance: number; balanceSOL: number; accountExists: boolean; owner: string | null }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD ? 'https://server-sepia-alpha-52.vercel.app' : 'http://localhost:3001');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/rpc/account-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Backend balance response:', data);
      if (data.success) {
        return {
          balance: data.balance,
          balanceSOL: data.balanceSOL,
          accountExists: data.accountExists,
          owner: data.owner
        };
      }
      const errorMsg = data.error || 'Failed to get account balance';
      console.error('Backend balance check failed:', errorMsg);
      throw new Error(errorMsg);
    }
    
    const errorText = await response.text();
    console.error('Backend balance check HTTP error:', response.status, errorText);
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  } catch (error) {
    console.warn('Backend balance check failed, trying direct RPC:', error);
    
    // Fallback to direct RPC (will likely fail with 403 on mainnet)
    try {
      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);
      const accountInfo = await connection.getAccountInfo(publicKey);
      return {
        balance,
        balanceSOL: balance / 1e9,
        accountExists: accountInfo !== null,
        owner: accountInfo?.owner?.toString() || null
      };
    } catch (directError) {
      throw new Error(`Failed to get account balance: ${directError instanceof Error ? directError.message : 'Unknown error'}`);
    }
  }
}

// Helper function to send a raw transaction via backend proxy (avoids CORS/403 errors)
export async function sendRawTransactionViaProxy(serializedTransaction: Uint8Array): Promise<string> {
  // Try backend proxy first (avoids CORS and browser rate limiting)
  const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD ? 'https://server-sepia-alpha-52.vercel.app' : 'http://localhost:3001');
  
  console.log('🔍 Backend URL:', API_BASE_URL);
  
  try {
    // Convert Uint8Array to base64 for transmission
    // Use btoa for browser compatibility (Buffer is Node.js only)
    let base64Transaction: string;
    if (typeof Buffer !== 'undefined') {
      // Node.js environment
      base64Transaction = Buffer.from(serializedTransaction).toString('base64');
    } else {
      // Browser environment - convert Uint8Array to base64
      const binary = String.fromCharCode(...Array.from(serializedTransaction));
      base64Transaction = btoa(binary);
    }
    
    console.log('Sending transaction to backend proxy:', API_BASE_URL);
    console.log('Transaction size:', serializedTransaction.length, 'bytes');
    
    const response = await fetch(`${API_BASE_URL}/api/rpc/send-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction: base64Transaction,
        options: { skipPreflight: false, maxRetries: 3 }
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        console.log('✅ Transaction sent via backend proxy:', data.signature);
        return data.signature;
      }
      throw new Error(data.error || 'Failed to send transaction');
    }
    
    const errorText = await response.text();
    console.error('Backend proxy error response:', errorText);
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  } catch (error) {
    console.warn('Backend RPC proxy failed, trying direct RPC:', error);
    
    // Fallback to direct RPC (will likely fail with 403 on mainnet, but try anyway)
    try {
      return await connection.sendRawTransaction(serializedTransaction, {
        skipPreflight: false,
        maxRetries: 3,
      });
    } catch (directError) {
      throw new Error(`Failed to send transaction: ${directError instanceof Error ? directError.message : 'Unknown error'}`);
    }
  }
}

// Helper function to confirm transaction via backend proxy (avoids CORS/403 errors)
export async function confirmTransactionViaProxy(
  signature: string,
  blockhash: string,
  lastValidBlockHeight?: number,
  commitment: 'confirmed' | 'finalized' = 'confirmed'
): Promise<{ success: boolean; slot?: number; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD ? 'https://server-sepia-alpha-52.vercel.app' : 'http://localhost:3001');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/rpc/confirm-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature,
        blockhash,
        lastValidBlockHeight,
        commitment
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: data.success && data.confirmed,
        slot: data.slot,
        error: data.error
      };
    }
    
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  } catch (error) {
    console.error('Backend transaction confirmation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm transaction'
    };
  }
}

// Helper function to verify transaction was actually sent and confirmed
export async function verifyTransaction(signature: string): Promise<{ confirmed: boolean; error?: string; success?: boolean }> {
  // Try backend proxy first (avoids CORS and browser rate limiting)
  const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD ? 'https://server-sepia-alpha-52.vercel.app' : 'http://localhost:3001');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/rpc/verify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature }),
    });
    
    if (response.ok) {
      const data = await response.json();
      // Check if transaction has an error - if it does, it failed
      const hasError = data.error && !data.error.includes('not found');
      const isConfirmed = data.success && data.confirmed && !hasError;
      
      return {
        confirmed: isConfirmed,
        success: isConfirmed && !hasError,
        error: hasError ? data.error : undefined
      };
    }
  } catch (error) {
    console.warn('Backend transaction verification failed, trying direct RPC:', error);
  }
  
  // Fallback to direct RPC verification (will likely fail with 403 on mainnet)
  try {
    const statusResult = await connection.getSignatureStatus(signature);
    if (!statusResult || !statusResult.value) {
      return { confirmed: false, success: false, error: 'Transaction not found' };
    }
    const status = statusResult.value;
    // CRITICAL: Check if transaction has an error - if err is not null, transaction failed
    if (status.err) {
      return { confirmed: false, success: false, error: status.err.toString() };
    }
    // Transaction exists, has no error, and is confirmed
    return { confirmed: true, success: true };
  } catch (error) {
    // If we get 403, it's an RPC access issue, not a transaction failure
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
      console.warn('⚠️ RPC verification blocked (403) - transaction may still be processing');
      // Return unknown status - can't verify but transaction might be fine
      return { confirmed: false, success: undefined, error: 'RPC access blocked (403) - cannot verify' };
    }
    console.error('Error verifying transaction:', error);
    return { confirmed: false, success: false, error: errorMsg };
  }
}

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
    
    // Verify accounts exist before creating transaction (use backend proxy to avoid 403)
    console.log('Creating SOL transfer:', {
      from: clientWallet.toString(),
      to: escrowAccount.toString(),
      amount: totalAmount,
      lamports: totalLamports,
      network: SOLANA_NETWORK,
    });
    
    // Verify balance via backend proxy (already checked in useEscrow, but double-check here)
    try {
      const accountData = await getAccountBalanceViaProxy(clientWallet.toString());
      if (!accountData.accountExists) {
        throw new Error(`Source account ${clientWallet.toString()} does not exist`);
      }
      if (accountData.balance < totalLamports) {
        throw new Error(`Insufficient balance: account has ${accountData.balanceSOL} SOL but needs ${totalAmount} SOL`);
      }
      console.log('Account verification passed:', {
        fromAccountExists: accountData.accountExists,
        fromBalance: accountData.balanceSOL,
      });
    } catch (error) {
      // If backend proxy fails, log warning but continue (balance was already checked)
      console.warn('Account verification via proxy failed, but continuing:', error);
    }
    
    // Add SOL transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: clientWallet,
      toPubkey: escrowAccount,
      lamports: totalLamports,
    });
    
    console.log('Transfer instruction created:', {
      from: clientWallet.toString(),
      to: escrowAccount.toString(),
      lamports: totalLamports,
      programId: transferInstruction.programId.toString(),
      keys: transferInstruction.keys.length
    });
    
    transaction.add(transferInstruction);
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