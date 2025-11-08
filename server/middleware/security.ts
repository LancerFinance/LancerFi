/**
 * Security middleware for request validation and protection
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// Request size limits
const MAX_JSON_SIZE = '10mb';
const MAX_URL_ENCODED_SIZE = '10mb';

/**
 * Validate request body size and content type
 */
export function validateRequestSize(req: Request, res: Response, next: NextFunction) {
  const contentLength = req.get('content-length');
  
  // Check content length header
  if (contentLength) {
    const sizeInMB = parseInt(contentLength, 10) / (1024 * 1024);
    if (sizeInMB > 10) {
      return res.status(413).json({ 
        error: 'Request payload too large. Maximum size is 10MB.' 
      });
    }
  }
  
  next();
}

/**
 * Sanitize request body to prevent injection attacks
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Recursively sanitize object values
 */
function sanitizeObject(obj: any, key?: string): any {
  if (typeof obj === 'string') {
    // CRITICAL: Don't sanitize the 'message' field - it contains newlines that are needed for signature verification
    // The message is a controlled format from our own generateChallenge() function
    if (key === 'message') {
      // Only remove null bytes from message, preserve newlines and other control chars
      return obj.replace(/\0/g, '');
    }
    // Remove null bytes and control characters (but preserve newlines for other fields that might need them)
    // Remove only truly dangerous control chars, not newlines/tabs
    return obj.replace(/\0/g, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, key));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      sanitized[key] = sanitizeObject(obj[key], key);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate wallet address format
 */
export function validateWalletAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Solana addresses are base58 encoded, 32-44 characters
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return solanaAddressRegex.test(address);
}

/**
 * Validate project ID format (UUID)
 */
export function validateProjectId(projectId: string): boolean {
  if (!projectId || typeof projectId !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(projectId);
}

/**
 * Rate limiter for general API endpoints
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiter for payment endpoints
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 payment requests per windowMs
  message: 'Too many payment requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for RPC proxy endpoints
 */
export const rpcRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 RPC requests per minute
  message: 'Too many RPC requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Validate numeric input to prevent injection
 */
export function validateNumeric(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }
  
  return num;
}

/**
 * Validate string length
 */
export function validateStringLength(str: string, min: number, max: number): boolean {
  if (typeof str !== 'string') {
    return false;
  }
  
  const length = str.length;
  return length >= min && length <= max;
}

