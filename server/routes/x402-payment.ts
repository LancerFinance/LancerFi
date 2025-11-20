import express from 'express';
import { USDC_MINT, getPlatformWalletAddress } from '../services/payment-service.js';

const router = express.Router();

// x402 Payment Challenge endpoint - responds with HTTP 402 when payment is required
router.post('/payment-required', async (req, res) => {
  try {
    const { projectId, amount, clientWallet } = req.body;

    if (!projectId || !amount || !clientWallet) {
      return res.status(400).json({
        error: 'Missing required fields: projectId, amount, clientWallet'
      });
    }

    // Calculate platform fee (10%)
    const platformFeePercent = 10;
    const platformFee = (amount * platformFeePercent) / 100;
    const totalAmount = amount + platformFee;

    // Get platform wallet address
    const platformWallet = getPlatformWalletAddress();

    // x402 Payment Required response
    // According to x402 protocol, we respond with HTTP 402 and payment details
    // Using Base network with Base USDC
    res.status(402).json({
      amount: totalAmount.toString(),
      currency: 'USDC',
      recipient: platformWallet,
      network: 'base',
      mint: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC contract address
      projectId: projectId,
      clientWallet: clientWallet,
      platformFee: platformFee.toString(),
      message: 'Payment required to create escrow for this project'
    });
  } catch (error: any) {
    console.error('Error in x402 payment-required endpoint:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// x402 Payment Verification endpoint - verifies payment and creates escrow
router.post('/verify-payment', async (req, res) => {
  try {
    const { projectId, transactionSignature, clientWallet, amount } = req.body;

    if (!projectId || !transactionSignature || !clientWallet || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: projectId, transactionSignature, clientWallet, amount'
      });
    }

    // Import payment service to verify transaction
    const { verifyX402Payment } = await import('../services/payment-service.js');
    
    // Verify the payment transaction on Base network
    const verification = await verifyX402Payment(
      transactionSignature,
      clientWallet,
      amount
    );

    if (!verification.verified) {
      return res.status(402).json({
        error: 'Payment verification failed',
        details: verification.error
      });
    }

    // Payment verified - return success
    // The frontend will then create the escrow using the verified payment
    res.json({
      success: true,
      verified: true,
      transactionSignature: transactionSignature,
      amount: verification.amount,
      message: 'Payment verified successfully'
    });
  } catch (error: any) {
    console.error('Error in x402 verify-payment endpoint:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

export default router;

