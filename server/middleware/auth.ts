import { Request, Response, NextFunction } from 'express';
import { PublicKey, Transaction } from '@solana/web3.js';
import nacl from 'tweetnacl';

interface AuthenticatedRequest extends Request {
  walletAddress?: string;
}

/**
 * Verify wallet signature authentication
 * Client must sign a message with their wallet to prove ownership
 */
export async function verifyWalletSignature(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        error: 'Missing required authentication fields: walletAddress, signature, message'
      });
    }

    // CRITICAL: The message must match EXACTLY what Phantom signed
    // Phantom signs the message with newlines, so we need to preserve them
    // If the message doesn't have newlines but should (based on the challenge format),
    // we need to reconstruct it with newlines
    let messageToVerify = message;
    
    // Check if message is missing newlines but should have them (LancerFi challenge format)
    if (!message.includes('\n') && message.includes('Timestamp:') && message.includes('Nonce:')) {
      // Reconstruct the message with newlines to match what Phantom signed
      const timestampMatch = message.match(/Timestamp:\s*(\d+)/);
      const nonceMatch = message.match(/Nonce:\s*(\w+)/);
      if (timestampMatch && nonceMatch) {
        messageToVerify = `LancerFi Payment Release Challenge\nTimestamp: ${timestampMatch[1]}\nNonce: ${nonceMatch[1]}\n\nThis signature proves you own this wallet.`;
        // Don't log full message - just indicate reconstruction happened
      }
    }

    // Verify the signature
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(messageToVerify);
    const signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));

    // Verify signature silently

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid wallet signature. Authentication failed.'
      });
    }

    // Don't log success to avoid cluttering logs - only log failures

    // Attach wallet address to request for use in handlers
    req.walletAddress = walletAddress;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({
      error: 'Authentication failed. Invalid wallet address or signature.'
    });
  }
}

/**
 * Generate a challenge message for the client to sign
 * This should be called first to get a message to sign
 */
export function generateChallenge(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `LancerFi Payment Release Challenge\nTimestamp: ${timestamp}\nNonce: ${random}\n\nThis signature proves you own this wallet.`;
}

