/**
 * API Client for communicating with backend server
 * Handles authentication and secure payment operations
 */

// API URL - Use the original working backend server
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://server-sepia-alpha-52.vercel.app' : 'http://localhost:3001');

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

/**
 * Check if wallet can create a project (2 projects per 24 hours)
 */
export async function checkWalletProjectLimit(walletAddress: string): Promise<{
  allowed: boolean;
  count: number;
  limit: number;
  reason: string;
  remainingHours?: number;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/project/check-wallet-limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress }),
    });

    if (!response.ok) {
      // Fail open - allow if we can't check
      return {
        allowed: true,
        count: 0,
        limit: 2,
        reason: 'Unable to verify wallet limit',
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking wallet limit:', error);
    // Fail open - allow if there's an error
    return {
      allowed: true,
      count: 0,
      limit: 2,
      reason: 'Error checking wallet limit',
    };
  }
}

/**
 * Check if IP can create a project (3 projects per 6 hours)
 */
export async function checkIPProjectLimit(): Promise<{
  allowed: boolean;
  count: number;
  limit: number;
  reason: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/project/check-ip-limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Fail open - allow if we can't check
      return {
        allowed: true,
        count: 0,
        limit: 3,
        reason: 'Unable to verify IP limit',
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking IP limit:', error);
    // Fail open - allow if there's an error
    return {
      allowed: true,
      count: 0,
      limit: 3,
      reason: 'Error checking IP limit',
    };
  }
}

/**
 * Record a project creation (called after project is successfully created)
 */
export async function recordProjectCreation(projectId: string, walletAddress: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/project/record-project-creation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        walletAddress,
      }),
    });

    if (!response.ok) {
      console.error('Failed to record project creation');
      return false;
    }

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Error recording project creation:', error);
    return false;
  }
}

/**
 * Trigger cleanup of pending projects stuck for over 1 hour
 * This can be called manually or will be triggered automatically by cron
 */
export async function resetRateLimit(walletAddress: string): Promise<{
  success: boolean;
  message: string;
  reset?: number;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/project/reset-rate-limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        message: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: data.success || false,
      message: data.message || 'Rate limit reset',
      reset: data.reset || 0,
    };
  } catch (error: any) {
    console.error('Error resetting rate limit:', error);
    return {
      success: false,
      message: error.message || 'Error resetting rate limit',
    };
  }
}

export async function cleanupPendingProjects(): Promise<{
  success: boolean;
  cleaned: number;
  message: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/project/cleanup-pending`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        cleaned: 0,
        message: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: data.success || false,
      cleaned: data.cleaned || 0,
      message: data.message || 'Cleanup completed',
    };
  } catch (error: any) {
    console.error('Error cleaning up pending projects:', error);
    return {
      success: false,
      cleaned: 0,
      message: error.message || 'Error cleaning up pending projects',
    };
  }
}

