/**
 * Admin authentication helper
 * Provides secure token verification for admin API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://server-sepia-alpha-52.vercel.app' : 'http://localhost:3001');

/**
 * Get admin auth token from session storage
 */
export function getAdminToken(): string | null {
  const token = sessionStorage.getItem('admin_token');
  const expiresAt = sessionStorage.getItem('admin_token_expires');
  
  if (!token || !expiresAt) {
    return null;
  }
  
  // Check if token is expired
  if (Date.now() > parseInt(expiresAt, 10)) {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token_expires');
    return null;
  }
  
  return token;
}

/**
 * Verify admin token is still valid
 */
export async function verifyAdminToken(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) {
    return false;
  }
  
  try {
    // Get current wallet address from window (if available)
    const w: any = window as any;
    let walletAddress: string | null = null;
    
    if (w.solana && w.solana.isPhantom && w.solana.isConnected) {
      walletAddress = w.solana.publicKey?.toString?.() || null;
    }
    
    if (!walletAddress) {
      return false;
    }
    
    // Get a fresh challenge and verify
    const challengeResponse = await fetch(`${API_BASE_URL}/api/admin/challenge`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!challengeResponse.ok) {
      return false;
    }
    
    const { challenge } = await challengeResponse.json();
    
    // Sign the challenge
    const encodedMessage = new TextEncoder().encode(challenge);
    const signed = await w.solana.signMessage(encodedMessage, 'utf8');
    const signatureBase64 = btoa(String.fromCharCode(...signed.signature));
    
    // Verify with backend
    const verifyResponse = await fetch(`${API_BASE_URL}/api/admin/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        signature: signatureBase64,
        message: challenge
      }),
    });
    
    if (!verifyResponse.ok) {
      return false;
    }
    
    const { authorized } = await verifyResponse.json();
    return authorized === true;
  } catch (error) {
    // Silently fail - no logging for security
    return false;
  }
}

/**
 * Make an authenticated admin API request
 * Automatically includes token verification
 */
export async function adminApiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const isAuthorized = await verifyAdminToken();
  
  if (!isAuthorized) {
    throw new Error('Admin authentication required');
  }
  
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

