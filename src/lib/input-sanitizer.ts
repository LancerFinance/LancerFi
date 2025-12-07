/**
 * Input sanitization utilities for XSS protection
 * Sanitizes user inputs before storing or displaying
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - Potentially unsafe HTML string
 * @returns Sanitized HTML string safe for display
 */
export function sanitizeHTML(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }
  
  // Sanitize HTML while preserving basic formatting
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize plain text by removing HTML tags and dangerous characters
 * @param text - Text to sanitize
 * @returns Plain text safe for storage
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove HTML tags and sanitize
  const stripped = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
  
  // Remove control characters except newlines and tabs
  return stripped.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitize URL to prevent javascript: and data: protocol attacks
 * @param url - URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  const trimmed = url.trim();
  
  // Allow http, https, and relative URLs only
  if (/^(https?:\/\/|\/)/i.test(trimmed)) {
    try {
      const urlObj = new URL(trimmed.startsWith('/') ? `https://example.com${trimmed}` : trimmed);
      // Only allow http and https protocols
      if (['http:', 'https:'].includes(urlObj.protocol)) {
        return urlObj.href.replace('https://example.com', '');
      }
    } catch {
      // Invalid URL
      return '';
    }
  }
  
  return '';
}

/**
 * Sanitize object with string values recursively
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeText(sanitized[key]) as any;
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeObject(sanitized[key]) as any;
    } else if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map((item: any) => 
        typeof item === 'string' ? sanitizeText(item) : item
      ) as any;
    }
  }
  
  return sanitized;
}

/**
 * Validate and sanitize file name to prevent path traversal
 * @param filename - File name to validate
 * @returns Sanitized filename or empty string if invalid
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  
  // Remove path traversal attempts
  const sanitized = filename
    .replace(/\.\./g, '') // Remove ..
    .replace(/[\/\\]/g, '_') // Replace slashes
    .replace(/[^\w\.-]/g, '_') // Only allow word chars, dots, hyphens
    .substring(0, 255); // Limit length
  
  return sanitized;
}

