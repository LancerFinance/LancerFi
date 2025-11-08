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
    const signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));
    
    // Phantom's signMessage signs the message with Solana's standard format
    // Format: "\xffSolana Signed Message:\n" + message length (u16, little-endian) + message
    const messageBytes = new TextEncoder().encode(message);
    
    // Build the full message that Phantom signs
    const prefix = new TextEncoder().encode('\xffSolana Signed Message:\n');
    const messageLengthBytes = new Uint8Array(2);
    // Little-endian encoding
    messageLengthBytes[0] = messageBytes.length & 0xff;
    messageLengthBytes[1] = (messageBytes.length >> 8) & 0xff;
    
    const fullMessage = new Uint8Array(prefix.length + 2 + messageBytes.length);
    fullMessage.set(prefix, 0);
    fullMessage.set(messageLengthBytes, prefix.length);
    fullMessage.set(messageBytes, prefix.length + 2);
    
    // Verify using nacl (Ed25519)
    let isValid = false;
    try {
      isValid = nacl.sign.detached.verify(
        fullMessage,
        signatureBytes,
        publicKey.toBytes()
      );
    } catch (e) {
      console.error('Signature verification error:', e);
    }
    
    // If that fails, try direct message verification (some wallets don't use prefix)
    if (!isValid) {
      try {
        isValid = nacl.sign.detached.verify(
          messageBytes,
          signatureBytes,
          publicKey.toBytes()
        );
      } catch (e) {
        console.warn('Direct verification also failed:', e);
      }
    }
    
    // Log for debugging if verification fails
    if (!isValid) {
      console.error('Signature verification failed:', {
        walletAddress,
        messageLength: message.length,
        signatureLength: signatureBytes.length,
        messagePreview: message.substring(0, 50) + '...'
      });
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

