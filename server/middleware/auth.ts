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

    // Verify the signature
    const publicKey = new PublicKey(walletAddress);
    
    // Phantom signs messages with a Solana message prefix
    // Format: "\xffSolana Signed Message:\n" + message length (u16) + message
    const prefix = new TextEncoder().encode('\xffSolana Signed Message:\n');
    const messageBytes = new TextEncoder().encode(message);
    const messageLengthBytes = new Uint8Array(2);
    messageLengthBytes[0] = messageBytes.length & 0xff;
    messageLengthBytes[1] = (messageBytes.length >> 8) & 0xff;
    
    // Combine prefix + length + message
    const fullMessage = new Uint8Array(prefix.length + 2 + messageBytes.length);
    fullMessage.set(prefix, 0);
    fullMessage.set(messageLengthBytes, prefix.length);
    fullMessage.set(messageBytes, prefix.length + 2);
    
    const signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));

    // Try verification with Solana message prefix first
    let isValid = nacl.sign.detached.verify(
      fullMessage,
      signatureBytes,
      publicKey.toBytes()
    );
    
    // If that fails, try without prefix (for backwards compatibility)
    if (!isValid) {
      const plainMessageBytes = new TextEncoder().encode(message);
      isValid = nacl.sign.detached.verify(
        plainMessageBytes,
        signatureBytes,
        publicKey.toBytes()
      );
    }

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid wallet signature. Authentication failed.'
      });
    }

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

