import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { releasePaymentRouter } from './routes/release-payment.js';
import rpcProxyRouter from './routes/rpc-proxy.js';
import x402PaymentRouter from './routes/x402-payment.js';
import projectRateLimitRouter from './routes/project-rate-limit.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://lancerfi.app',
  'https://www.lancerfi.app', // Add www version
  'http://localhost:8080',
  'http://localhost:5173',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/payment', releasePaymentRouter);
app.use('/api/rpc', rpcProxyRouter);
app.use('/api/x402', x402PaymentRouter);
app.use('/api/project', projectRateLimitRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Export for Vercel serverless
export default app;

// For local development, listen on port
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Platform wallet loaded: ${process.env.PLATFORM_WALLET_PRIVATE_KEY ? 'Yes' : 'No'}`);
  });
}

