import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { USDC_MINT, connection, getAccountBalanceViaProxy } from './solana';
import { getLatestBlockhashWithFallback } from './solana';

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

  // Note: We skip balance check here to avoid 403 RPC errors
  // Phantom wallet will validate the balance and show appropriate errors if insufficient

  // Create USDC transfer transaction
  const transaction = new Transaction();

  // Get latest blockhash (optimized - use backend proxy with shorter timeout)
  // Start blockhash fetch early while we get token accounts
  const blockhashPromise = getLatestBlockhashWithFallback();
  
  // Get associated token accounts (async) - run in parallel with blockhash
  const [tokenAccounts, blockhashData] = await Promise.all([
    Promise.all([
      getAssociatedTokenAddress(mint, clientWallet),
      getAssociatedTokenAddress(mint, recipientWallet)
    ]),
    blockhashPromise
  ]);
  
  const [clientTokenAccount, recipientTokenAccount] = tokenAccounts;
  const { blockhash, lastValidBlockHeight } = blockhashData;
  
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = clientWallet;
  transaction.lastValidBlockHeight = lastValidBlockHeight;

  // Check if recipient token account exists before adding creation instruction
  // This makes the transaction look more standard and less suspicious to Phantom
  // Phantom's security scanner flags transactions that always create accounts unnecessarily
  let recipientAccountExists = false;
  try {
    // Use backend proxy to check account existence (avoids 403 errors)
    const API_BASE_URL = import.meta.env.VITE_API_URL || 
      (import.meta.env.PROD ? 'https://server-sepia-alpha-52.vercel.app' : 'http://localhost:3001');
    
    const response = await fetch(`${API_BASE_URL}/api/rpc/account-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: recipientTokenAccount.toString() }),
    });
    
    if (response.ok) {
      const data = await response.json();
      recipientAccountExists = data.accountExists === true;
    }
  } catch {
    // If check fails, try direct RPC (may fail with 403, but that's okay)
    try {
      const accountInfo = await connection.getAccountInfo(recipientTokenAccount);
      recipientAccountExists = accountInfo !== null;
    } catch {
      // If both fail, assume it doesn't exist and add creation instruction
      recipientAccountExists = false;
    }
  }

  // Only add token account creation if it doesn't exist
  // This avoids Phantom flagging transactions with unnecessary account creation
  if (!recipientAccountExists) {
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
  // Use BigInt to ensure proper token amount handling
  const microUSDC = BigInt(Math.round(amount * Math.pow(10, 6)));

  // Add USDC transfer instruction
  // Using BigInt ensures Phantom recognizes this as a token transfer, not SOL
  transaction.add(
    createTransferInstruction(
      clientTokenAccount,
      recipientTokenAccount,
      clientWallet,
      microUSDC, // BigInt ensures proper token amount
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // Use the same pattern as SOL/USDC payments: signTransaction + sendRawTransactionViaProxy
  // This avoids Phantom's security warnings that can occur with signAndSendTransaction
  // for certain transaction patterns (like token account creation + transfer)
  try {
    // Sign with Phantom (user approves in wallet)
    const signedTransaction = await wallet.signTransaction(transaction);
    
    // Serialize immediately after signing
    const serializedTransaction = signedTransaction.serialize();
    
    // Send via backend proxy (same as SOL/USDC payments)
    // This is more reliable and avoids Phantom security warnings
    const { sendRawTransactionViaProxy } = await import('./solana');
    const signature = await sendRawTransactionViaProxy(serializedTransaction);
    
    return signature;
  } catch (error: any) {
    console.error('Phantom transaction failed');
    
    // If user rejected, let them know
    if (error?.code === 4001 || error.message?.includes('User rejected')) {
      throw new Error('Transaction was cancelled by user');
    }
    if (error.message?.includes('insufficient funds') || error.message?.includes('not enough')) {
      throw new Error('Insufficient USDC or SOL for transaction fees. Please ensure you have at least 11 USDC and 0.01 SOL in your wallet.');
    }
    
    throw new Error(`Transaction failed: ${error.message || 'Unknown error'}`);
  }
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
  try {
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
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `HTTP ${response.status}` };
      }
      
      console.error('x402 verification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const result = await response.json();
    
    console.log('x402 verification result:', {
      verified: result.verified,
      error: result.error,
      transactionSignature: transactionSignature.substring(0, 20) + '...'
    });
    
    return {
      success: result.verified === true,
      error: result.error
    };
  } catch (error: any) {
    console.error('x402 verification exception:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify payment - network error'
    };
  }
}

