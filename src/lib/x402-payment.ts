import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { USDC_MINT, connection, getAccountBalanceViaProxy } from './solana';
import { getLatestBlockhashWithFallback, sendRawTransactionViaProxy } from './solana';

const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://server-sepia-alpha-52.vercel.app' : 'http://localhost:3001');

export interface X402PaymentChallenge {
  amount: string;
  currency: string;
  recipient: string;
  network: string;
  mint: string;
  projectId: string;
  clientWallet: string;
  platformFee: string;
  message: string;
}

/**
 * Request x402 payment challenge from backend
 * Returns payment details needed to make the payment
 */
export async function requestX402Payment(
  projectId: string,
  amount: number,
  clientWallet: string
): Promise<X402PaymentChallenge> {
  const response = await fetch(`${API_BASE_URL}/api/x402/payment-required`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      amount,
      clientWallet,
    }),
  });

  // x402 protocol: Backend responds with HTTP 402 when payment is required
  // NOTE: Browser console will show 402 as an error (red), but this is CORRECT behavior for x402 protocol
  // HTTP 402 "Payment Required" is the standard response for x402 payment challenges
  if (response.status === 402) {
    console.log('✅ x402 Payment Required response received (HTTP 402 is correct for x402 protocol)');
    const paymentDetails = await response.json();
    return paymentDetails as X402PaymentChallenge;
  }

  // If not 402, it's an error - provide detailed error message
  let errorMessage = `Unexpected response status: ${response.status}`;
  try {
    const errorData = await response.json();
    errorMessage = errorData.error || errorMessage;
  } catch {
    // If response isn't JSON, use status text
    errorMessage = response.statusText || errorMessage;
  }
  
  // If 404, the backend endpoint doesn't exist (not deployed)
  if (response.status === 404) {
    throw new Error(`x402 backend endpoint not found (404). The x402 payment feature may not be deployed yet. Please use SOL or USDC payment instead.`);
  }
  
  throw new Error(`x402 payment request failed: ${errorMessage}`);
}

/**
 * Process x402 payment using user's wallet
 * Creates and sends USDC transaction to the recipient address
 */
export async function processX402Payment(
  paymentChallenge: X402PaymentChallenge,
  wallet: any // Phantom wallet
): Promise<string> {
  if (!wallet?.isPhantom || !wallet.isConnected) {
    throw new Error('Phantom wallet is required and must be connected');
  }

  const clientWallet = new PublicKey(paymentChallenge.clientWallet);
  const recipientWallet = new PublicKey(paymentChallenge.recipient);
  const amount = parseFloat(paymentChallenge.amount);
  const mint = new PublicKey(paymentChallenge.mint);

  // Create USDC transfer transaction
  const transaction = new Transaction();

  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithFallback();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = clientWallet;
  transaction.lastValidBlockHeight = lastValidBlockHeight;

  // Get associated token accounts (async)
  const clientTokenAccount = await getAssociatedTokenAddress(mint, clientWallet);
  const recipientTokenAccount = await getAssociatedTokenAddress(mint, recipientWallet);

  // Check if recipient token account exists using backend proxy (avoids 403 errors)
  // We'll try to get balance - if it fails, the account doesn't exist
  let recipientAccountExists = false;
  try {
    // Use backend proxy to check if recipient has a token account
    // This avoids 403 errors from direct RPC calls
    const accountInfo = await getAccountBalanceViaProxy(recipientTokenAccount.toString());
    recipientAccountExists = accountInfo.accountExists;
  } catch (error) {
    // If check fails, assume account doesn't exist (will create it)
    console.log('Recipient token account check failed, will create if needed:', error);
    recipientAccountExists = false;
  }

  // If recipient token account doesn't exist, add instruction to create it
  if (!recipientAccountExists) {
    console.log('Recipient token account does not exist, adding create instruction');
    transaction.add(
      createAssociatedTokenAccountInstruction(
        clientWallet, // Payer for account creation
        recipientTokenAccount,
        recipientWallet,
        mint
      )
    );
  }

  // Convert amount to micro-USDC (6 decimals)
  // amount is already in USDC (e.g., 11), so multiply by 10^6 to get micro-USDC
  const microUSDC = Math.round(amount * Math.pow(10, 6));
  
  console.log('x402 Payment amount conversion:', {
    amountUSDC: amount,
    microUSDC: microUSDC,
    decimals: 6,
    calculation: `${amount} * 10^6 = ${microUSDC}`
  });

  // Add USDC transfer instruction
  transaction.add(
    createTransferInstruction(
      clientTokenAccount,
      recipientTokenAccount,
      clientWallet,
      microUSDC,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // Sign with Phantom
  const signedTransaction = await wallet.signTransaction(transaction);

  // Send transaction
  const signature = await sendRawTransactionViaProxy(signedTransaction.serialize());

  return signature;
}

/**
 * Verify x402 payment with backend
 * Backend checks the transaction on-chain and confirms payment was received
 */
export async function verifyX402Payment(
  projectId: string,
  transactionSignature: string,
  clientWallet: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/x402/verify-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      transactionSignature,
      clientWallet,
      amount,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    return {
      success: false,
      error: error.error || `HTTP ${response.status}`
    };
  }

  const result = await response.json();
  return {
    success: result.verified === true,
    error: result.error
  };
}

