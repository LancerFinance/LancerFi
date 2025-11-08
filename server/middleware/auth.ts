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
    const messageBytes = new TextEncoder().encode(message);
    
    // Phantom's signMessage returns a signature that signs the message AS-IS (no prefix)
    // The signature is over the raw UTF-8 encoded message bytes
    let isValid = false;
    
    // Method 1: Direct message verification (Phantom signs the raw message)
    try {
      isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes()
      );
      if (isValid) {
        console.log('✅ Signature verified with direct message format');
      }
    } catch (e) {
      console.error('Direct verification error:', e);
    }
    
    // Method 2: Try with Solana message prefix format (for compatibility)
    if (!isValid) {
      try {
        const prefix = new TextEncoder().encode('\xffSolana Signed Message:\n');
        const messageLengthBytes = new Uint8Array(2);
        messageLengthBytes[0] = messageBytes.length & 0xff;
        messageLengthBytes[1] = (messageBytes.length >> 8) & 0xff;
        
        const fullMessage = new Uint8Array(prefix.length + 2 + messageBytes.length);
        fullMessage.set(prefix, 0);
        fullMessage.set(messageLengthBytes, prefix.length);
        fullMessage.set(messageBytes, prefix.length + 2);
        
        isValid = nacl.sign.detached.verify(
          fullMessage,
          signatureBytes,
          publicKey.toBytes()
        );
        if (isValid) {
          console.log('✅ Signature verified with Solana prefix format');
        }
      } catch (e) {
        console.warn('Prefix format verification failed:', e);
      }
    }
    
    // Log for debugging if verification fails
    if (!isValid) {
      console.error('Signature verification failed:', {
        walletAddress,
        messageLength: message.length,
        signatureLength: signatureBytes.length,
        messagePreview: message.substring(0, 50) + '...',
        fullMessageLength: fullMessage.length,
        signatureHex: Array.from(signatureBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
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

