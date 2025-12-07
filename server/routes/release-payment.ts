import { Router } from 'express';
import { releasePaymentHandler } from '../handlers/release-payment.js';
import { verifyWalletSignature } from '../middleware/auth.js';

export const releasePaymentRouter = Router();

// POST /api/payment/release
// Requires: wallet signature authentication
releasePaymentRouter.post('/release', verifyWalletSignature, releasePaymentHandler);

