/**
 * File upload security utilities
 * Validates file types, sizes, and prevents malicious uploads
 */

// Allowed file types for different upload categories
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

// File size limits (in bytes)
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (general limit)

/**
 * Validate file type
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSize: number): boolean {
  return file.size <= maxSize;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): {
  isValid: boolean;
  error?: string;
} {
  // Check file type
  if (!validateFileType(file, ALLOWED_IMAGE_TYPES)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.map(t => t.split('/')[1]).join(', ')}`,
    };
  }

  // Check file size
  if (!validateFileSize(file, MAX_IMAGE_SIZE)) {
    return {
      isValid: false,
      error: `File size exceeds limit. Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`,
    };
  }

  // Check file name for security risks (path traversal, null bytes, etc.)
  // Allow common characters like spaces, parentheses, etc.
  if (!file.name || file.name.length === 0) {
    return {
      isValid: false,
      error: 'File name cannot be empty.',
    };
  }
  
  // Check for path traversal attempts
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      isValid: false,
      error: 'File name contains invalid path characters.',
    };
  }
  
  // Check for null bytes or control characters
  if (file.name.includes('\0') || /[\x00-\x1F\x7F]/.test(file.name)) {
    return {
      isValid: false,
      error: 'File name contains invalid control characters.',
    };
  }
  
  // Check for extremely long filenames
  if (file.name.length > 255) {
    return {
      isValid: false,
      error: 'File name is too long (maximum 255 characters).',
    };
  }

  return { isValid: true };
}

/**
 * Validate document file
 */
export function validateDocumentFile(file: File): {
  isValid: boolean;
  error?: string;
} {
  // Check file type
  if (!validateFileType(file, ALLOWED_DOCUMENT_TYPES)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: PDF, DOC, DOCX, TXT`,
    };
  }

  // Check file size
  if (!validateFileSize(file, MAX_DOCUMENT_SIZE)) {
    return {
      isValid: false,
      error: `File size exceeds limit. Maximum size is ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB`,
    };
  }

  // Check file name for security risks
  if (!file.name || file.name.length === 0) {
    return {
      isValid: false,
      error: 'File name cannot be empty.',
    };
  }
  
  // Check for path traversal attempts
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      isValid: false,
      error: 'File name contains invalid path characters.',
    };
  }
  
  // Check for null bytes or control characters
  if (file.name.includes('\0') || /[\x00-\x1F\x7F]/.test(file.name)) {
    return {
      isValid: false,
      error: 'File name contains invalid control characters.',
    };
  }
  
  // Check for extremely long filenames
  if (file.name.length > 255) {
    return {
      isValid: false,
      error: 'File name is too long (maximum 255 characters).',
    };
  }

  return { isValid: true };
}

/**
 * Validate general file upload
 */
export function validateFile(file: File, allowedTypes?: string[]): {
  isValid: boolean;
  error?: string;
} {
  // Check file size (general limit)
  if (!validateFileSize(file, MAX_FILE_SIZE)) {
    return {
      isValid: false,
      error: `File size exceeds limit. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  // If allowed types specified, validate type
  if (allowedTypes && !validateFileType(file, allowedTypes)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.map(t => t.split('/')[1] || t).join(', ')}`,
    };
  }

  // Check file name for security risks
  if (!file.name || file.name.length === 0) {
    return {
      isValid: false,
      error: 'File name cannot be empty.',
    };
  }
  
  // Check for path traversal attempts
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      isValid: false,
      error: 'File name contains invalid path characters.',
    };
  }
  
  // Check for null bytes or control characters
  if (file.name.includes('\0') || /[\x00-\x1F\x7F]/.test(file.name)) {
    return {
      isValid: false,
      error: 'File name contains invalid control characters.',
    };
  }
  
  // Check for extremely long filenames
  if (file.name.length > 255) {
    return {
      isValid: false,
      error: 'File name is too long (maximum 255 characters).',
    };
  }

  return { isValid: true };
}

/**
 * Check if file extension matches MIME type (prevents spoofing)
 */
export function validateFileExtension(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();

  // Map of extensions to MIME types
  const extensionMap: Record<string, string[]> = {
    jpg: ['image/jpeg', 'image/jpg'],
    jpeg: ['image/jpeg', 'image/jpg'],
    png: ['image/png'],
    gif: ['image/gif'],
    webp: ['image/webp'],
    pdf: ['application/pdf'],
    doc: ['application/msword'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    txt: ['text/plain'],
  };

  if (!extension || !extensionMap[extension]) {
    return false;
  }

  return extensionMap[extension].includes(mimeType);
}

