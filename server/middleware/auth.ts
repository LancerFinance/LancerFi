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
        console.log('⚠️ Message missing newlines - reconstructed:', messageToVerify);
      }
    }

    // Verify the signature
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(messageToVerify);
    const signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));

    // Log what we're verifying (for debugging)
    console.log('🔍 Verifying signature:', {
      walletAddress,
      originalMessageLength: message.length,
      messageToVerifyLength: messageToVerify.length,
      originalMessage: message,
      messageToVerify: messageToVerify,
      originalHasNewlines: message.includes('\n'),
      messageToVerifyHasNewlines: messageToVerify.includes('\n'),
      signatureLength: signatureBytes.length,
      publicKey: publicKey.toString()
    });

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    if (!isValid) {
      console.error('❌ Signature verification failed:', {
        messageBytes: Array.from(messageBytes.slice(0, 20)),
        signatureBytes: Array.from(signatureBytes.slice(0, 20)),
        publicKeyBytes: Array.from(publicKey.toBytes().slice(0, 20))
      });
      return res.status(401).json({
        error: 'Invalid wallet signature. Authentication failed.'
      });
    }

    console.log('✅ Signature verified successfully');

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

