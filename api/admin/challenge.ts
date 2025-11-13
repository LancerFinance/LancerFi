/**
 * Vercel Serverless Function for /api/admin/challenge
 * Generates a challenge message for admin authentication
 */

// Vercel types
type VercelRequest = any;
type VercelResponse = any;

import { generateChallengeForVercel } from '../middleware/verify-signature.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const challenge = generateChallengeForVercel();
    res.json({ challenge });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate challenge' });
  }
}

