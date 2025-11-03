/**
 * API Client for communicating with backend server
 * Handles authentication and secure payment operations
 */

// API URL - Uses Vercel environment variable or defaults to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://lancerfi-backend.vercel.app' : 'http://localhost:3001');

interface ReleasePaymentRequest {
  escrowId: string;
  freelancerWallet: string;
  walletAddress: string;
  signature: string;
  message: string;
}

interface ReleasePaymentResponse {
  success: boolean;
  transactionSignature: string;
  message: string;
}

/**
 * Generate a challenge message for wallet signature
 */
export function generateChallenge(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `LancerFi Payment Release Challenge\nTimestamp: ${timestamp}\nNonce: ${random}\n\nThis signature proves you own this wallet.`;
}

/**
 * Release payment to freelancer via secure backend API
 * Requires wallet signature authentication
 */
export async function releasePaymentToFreelancer(
  escrowId: string,
  freelancerWallet: string,
  walletAddress: string,
  signMessage: (message: string) => Promise<{ signature: Uint8Array }>
): Promise<string> {
  try {
    // Generate challenge message
    const message = generateChallenge();
    
    // Sign message with wallet
    // If user cancels, this will throw/reject and we catch it below
    let signature: Uint8Array;
    try {
      const result = await signMessage(message);
      signature = result.signature;
    } catch (signError) {
      // User canceled the signature request
      if (signError instanceof Error && (
        signError.message.includes('User rejected') ||
        signError.message.includes('canceled') ||
        signError.message.includes('denied')
      )) {
        throw new Error('Signature request was canceled. Payment was not sent.');
      }
      throw signError; // Re-throw other errors
    }
    
    // Convert signature to base64 for transmission
    const signatureBase64 = Buffer.from(signature).toString('base64');
    
    // Call backend API
    const response = await fetch(`${API_BASE_URL}/api/payment/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        escrowId,
        freelancerWallet,
        walletAddress,
        signature: signatureBase64,
        message
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ReleasePaymentResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Payment release failed');
    }

    return data.transactionSignature;
  } catch (error) {
    console.error('Error releasing payment:', error);
    throw error;
  }
}

/**
 * Check backend server health
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

