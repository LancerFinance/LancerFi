/**
 * Vercel Serverless Function for /api/admin/restrict-user
 * Handles user restrictions (mute, ban wallet, ban IP)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { adminRestrictionsRouter } from '../../server/routes/admin-restrictions.js';
import { 
  validateRequestSize, 
  sanitizeRequestBody,
  generalRateLimiter
} from '../../server/middleware/security.js';

// Load environment variables
dotenv.config();

// Create a mini Express app for this route
const app = express();

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://lancerfi.app',
  'https://www.lancerfi.app',
  'http://localhost:8080',
  'http://localhost:5173',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(validateRequestSize);
app.use(sanitizeRequestBody);
app.use(generalRateLimiter);

// Mount the admin restrictions router at root since Vercel already routes /api/admin/restrict-user here
app.use('/', adminRestrictionsRouter);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Modify the request URL to match what the router expects
  const expressReq = req as any;
  const expressRes = res as any;
  
  // The router expects /restrict-user, but Vercel routes /api/admin/restrict-user here
  // So we need to modify the path
  const originalUrl = expressReq.url;
  expressReq.url = '/restrict-user';
  expressReq.path = '/restrict-user';
  expressReq.originalUrl = '/restrict-user';
  
  // Handle the request through Express
  return new Promise((resolve) => {
    app(expressReq, expressRes, () => {
      resolve(undefined);
    });
  });
}

