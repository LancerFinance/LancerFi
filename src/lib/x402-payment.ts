import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { USDC_MINT, connection } from './solana';
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
  if (response.status === 402) {
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

  // Check if recipient token account exists, create if not
  try {
    await connection.getAccountInfo(recipientTokenAccount);
  } catch {
    // Account doesn't exist, add instruction to create it
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
  const microUSDC = Math.round(amount * Math.pow(10, 6));

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

