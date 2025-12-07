import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

/**
 * Verify wallet signature for Vercel serverless functions
 * This ensures the request is actually from the wallet owner
 */
export async function verifyWalletSignatureForVercel(
  walletAddress: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    if (!walletAddress || !signature || !message) {
      return false;
    }

    // Verify the signature
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    return isValid;
  } catch (error) {
    return false;
  }
}

/**
 * Generate a challenge message for the client to sign
 */
export function generateChallengeForVercel(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `LancerFi Challenge\nTimestamp: ${timestamp}\nNonce: ${random}\n\nThis signature proves you own this wallet.`;
}

