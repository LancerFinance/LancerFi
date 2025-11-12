import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { releasePaymentRouter } from '../server/routes/release-payment.js';
import rpcProxyRouter from '../server/routes/rpc-proxy.js';
import x402PaymentRouter from '../server/routes/x402-payment.js';
import projectRateLimitRouter from '../server/routes/project-rate-limit.js';
import projectCleanupRouter from '../server/routes/project-cleanup.js';
import adminAuthRouter from '../server/routes/admin-auth.js';
import adminRestrictionsRouter from '../server/routes/admin-restrictions.js';
import systemStatusRouter from '../server/routes/system-status.js';
import { 
  validateRequestSize, 
  sanitizeRequestBody,
  generalRateLimiter,
  paymentRateLimiter,
  rpcRateLimiter
} from '../server/middleware/security.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"], // Allow inline scripts for React
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'", 
        "https://api.mainnet-beta.solana.com", 
        "https://api.devnet.solana.com", 
        "https://*.supabase.co",
        "https://*.solana.com", // Allow all Solana RPC endpoints
        "https://rpc.ankr.com", // Ankr RPC
        "https://solana-api.projectserum.com", // Serum RPC
        "https://*.vercel.app" // Backend API
      ],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"], // Allow iframes from same origin (for wallet interactions)
    },
  },
  crossOriginEmbedderPolicy: false, // Allow iframe embedding if needed
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow resources from other origins
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

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

// Request size limits and validation
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(validateRequestSize);
app.use(sanitizeRequestBody);

// Apply general rate limiting to all routes
app.use(generalRateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes with specific rate limiting
app.use('/api/payment', paymentRateLimiter, releasePaymentRouter);
app.use('/api/rpc', rpcRateLimiter, rpcProxyRouter);
app.use('/api/x402', paymentRateLimiter, x402PaymentRouter);
app.use('/api/project', projectRateLimitRouter);
app.use('/api/project', projectCleanupRouter);
app.use('/api/admin', adminAuthRouter);
app.use('/api/admin', adminRestrictionsRouter);
app.use('/api/system-status', systemStatusRouter);

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

