// Polyfills for browser
import { Buffer } from 'buffer';

// Ensure global/window references exist for libs expecting Node globals
if (typeof window !== 'undefined') {
  // Buffer polyfill (required by @solana/spl-token and others)
  (window as any).Buffer = (window as any).Buffer || Buffer;
  // Some libs check for global/process
  (window as any).global = (window as any).global || window;
  (window as any).process = (window as any).process || { env: {} };
}

// No exports needed; just side effects