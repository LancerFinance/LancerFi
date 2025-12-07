/**
 * File Security Scanner for Work Submissions
 * Detects suspicious files that may be malicious
 * Conservative approach - only flags obvious red flags
 */

import JSZip from 'jszip';

export interface SuspiciousFile {
  filename: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ScanResult {
  hasSuspiciousFiles: boolean;
  suspiciousFiles: SuspiciousFile[];
}

// Executable extensions that are suspicious in work submissions
const EXECUTABLE_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'app', 'dmg',
  'deb', 'rpm', 'msi', 'sh', 'ps1', 'psm1', 'psd1', 'vbe', 'jse', 'ws', 'wsf',
  'wsc', 'wsh', 'scf', 'lnk', 'inf', 'reg', 'dll', 'sys', 'drv', 'ocx', 'cpl'
];

// Document/image extensions that are commonly legitimate
const LEGITIMATE_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm',
  'mp3', 'wav', 'ogg', 'flac',
  'html', 'css', 'js', 'json', 'xml', 'csv',
  'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt',
  'md', 'readme', 'txt', 'log'
];

// Magic numbers for common file types (first few bytes)
const MAGIC_NUMBERS: Record<string, number[][]> = {
  'pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]], // PK..
  'jpg': [[0xFF, 0xD8, 0xFF]],
  'png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a, GIF89a
  'exe': [[0x4D, 0x5A]], // MZ (PE executable)
  'docx': [[0x50, 0x4B, 0x03, 0x04]], // ZIP-based (Office 2007+)
  'xlsx': [[0x50, 0x4B, 0x03, 0x04]],
  'pptx': [[0x50, 0x4B, 0x03, 0x04]],
};

/**
 * Get file extension from filename
 */
function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Check if filename has double extension (e.g., document.pdf.exe)
 */
function hasDoubleExtension(filename: string): boolean {
  const parts = filename.toLowerCase().split('.');
  if (parts.length < 3) return false;
  
  const lastExt = parts[parts.length - 1];
  const secondLastExt = parts[parts.length - 2];
  
  // Check if last extension is executable
  if (EXECUTABLE_EXTENSIONS.includes(lastExt)) {
    // Check if second-to-last is a document/image extension
    const documentExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'txt', 'xls', 'xlsx'];
    if (documentExtensions.includes(secondLastExt)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if executable has misleading name (looks like a document)
 */
function hasMisleadingName(filename: string, extension: string): boolean {
  if (!EXECUTABLE_EXTENSIONS.includes(extension)) return false;
  
  const nameWithoutExt = filename.toLowerCase().replace(`.${extension}`, '');
  const misleadingPatterns = [
    'invoice', 'receipt', 'contract', 'agreement', 'document', 'report',
    'statement', 'bill', 'quote', 'estimate', 'proposal', 'letter',
    'memo', 'note', 'photo', 'image', 'picture', 'photo', 'img'
  ];
  
  return misleadingPatterns.some(pattern => nameWithoutExt.includes(pattern));
}

/**
 * Read first few bytes of file to check magic numbers
 */
async function readFileHeader(file: File, bytes: number = 8): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(e.target.result.slice(0, bytes)));
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(0, bytes));
  });
}

/**
 * Check if file type matches its extension (magic number verification)
 */
async function checkTypeSpoofing(file: File, extension: string): Promise<{ isSpoofed: boolean; actualType?: string }> {
  try {
    const header = await readFileHeader(file, 8);
    
    // Check for executable magic numbers
    if (header[0] === 0x4D && header[1] === 0x5A) { // MZ - PE executable
      if (!EXECUTABLE_EXTENSIONS.includes(extension)) {
        return { isSpoofed: true, actualType: 'executable' };
      }
    }
    
    // Check for PDF
    if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
      if (extension !== 'pdf') {
        return { isSpoofed: true, actualType: 'pdf' };
      }
    }
    
    // Check for ZIP (which could be Office docs or archives)
    if (header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04) {
      // ZIP-based format - could be docx, xlsx, pptx, or zip
      const zipBasedExtensions = ['docx', 'xlsx', 'pptx', 'zip'];
      if (!zipBasedExtensions.includes(extension)) {
        // If it's an executable extension but file is ZIP-based, it's suspicious
        if (EXECUTABLE_EXTENSIONS.includes(extension)) {
          return { isSpoofed: true, actualType: 'zip-based' };
        }
      }
    }
    
    // Check for image magic numbers
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) { // JPEG
      if (extension !== 'jpg' && extension !== 'jpeg') {
        if (EXECUTABLE_EXTENSIONS.includes(extension)) {
          return { isSpoofed: true, actualType: 'jpeg' };
        }
      }
    }
    
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) { // PNG
      if (extension !== 'png') {
        if (EXECUTABLE_EXTENSIONS.includes(extension)) {
          return { isSpoofed: true, actualType: 'png' };
        }
      }
    }
    
    return { isSpoofed: false };
  } catch (error) {
    console.warn('Error checking file type spoofing:', error);
    return { isSpoofed: false };
  }
}

/**
 * Scan a single file for suspicious characteristics
 */
export async function scanFile(file: File): Promise<SuspiciousFile | null> {
  const filename = file.name;
  const extension = getExtension(filename);
  
  // Check 1: Double extension
  if (hasDoubleExtension(filename)) {
    return {
      filename,
      reason: 'File has double extension (e.g., document.pdf.exe) - may be attempting to hide executable',
      severity: 'high'
    };
  }
  
  // Check 2: Executable with misleading name
  if (hasMisleadingName(filename, extension)) {
    return {
      filename,
      reason: `Executable file (${extension}) with misleading name that suggests it's a document`,
      severity: 'high'
    };
  }
  
  // Check 3: Type spoofing (magic number check)
  const spoofCheck = await checkTypeSpoofing(file, extension);
  if (spoofCheck.isSpoofed) {
    return {
      filename,
      reason: `File extension (${extension}) does not match actual file type (${spoofCheck.actualType}) - possible type spoofing`,
      severity: 'high'
    };
  }
  
  // Check 4: Executable in work submission (medium severity - could be legitimate)
  if (EXECUTABLE_EXTENSIONS.includes(extension)) {
    // Only flag if it's a clearly suspicious executable
    const suspiciousExecutables = ['exe', 'bat', 'cmd', 'vbs', 'scr', 'pif', 'com'];
    if (suspiciousExecutables.includes(extension)) {
      return {
        filename,
        reason: `Executable file type (${extension}) detected - please ensure this is legitimate work`,
        severity: 'medium'
      };
    }
  }
  
  return null;
}

/**
 * Scan files inside a ZIP archive
 */
async function scanZipContents(zipFile: File): Promise<SuspiciousFile[]> {
  const suspiciousFiles: SuspiciousFile[] = [];
  
  try {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(zipFile);
    
    // Scan each file in the ZIP
    for (const [filename, zipEntry] of Object.entries(zipData.files)) {
      // Skip directories
      if (zipEntry.dir) continue;
      
      // Check filename for suspicious patterns
      const extension = getExtension(filename);
      
      // Check for double extension
      if (hasDoubleExtension(filename)) {
        suspiciousFiles.push({
          filename: `[ZIP] ${filename}`,
          reason: 'File inside ZIP has double extension (e.g., document.pdf.exe) - may be attempting to hide executable',
          severity: 'high'
        });
        continue;
      }
      
      // Check for executable with misleading name
      if (hasMisleadingName(filename, extension)) {
        suspiciousFiles.push({
          filename: `[ZIP] ${filename}`,
          reason: `Executable file (${extension}) with misleading name that suggests it's a document`,
          severity: 'high'
        });
        continue;
      }
      
      // Check for suspicious executables
      if (EXECUTABLE_EXTENSIONS.includes(extension)) {
        const suspiciousExecutables = ['exe', 'bat', 'cmd', 'vbs', 'scr', 'pif', 'com'];
        if (suspiciousExecutables.includes(extension)) {
          suspiciousFiles.push({
            filename: `[ZIP] ${filename}`,
            reason: `Executable file type (${extension}) detected inside ZIP - please ensure this is legitimate work`,
            severity: 'medium'
          });
        }
      }
      
      // Try to read file header for type spoofing (limit to first 8 bytes to avoid loading large files)
      try {
        const fileData = await zipEntry.async('uint8array');
        if (fileData.length >= 8) {
          const header = fileData.slice(0, 8);
          
          // Check for executable magic numbers
          if (header[0] === 0x4D && header[1] === 0x5A) { // MZ - PE executable
            if (!EXECUTABLE_EXTENSIONS.includes(extension)) {
              suspiciousFiles.push({
                filename: `[ZIP] ${filename}`,
                reason: `File extension (${extension}) does not match actual file type (executable) - possible type spoofing`,
                severity: 'high'
              });
            }
          }
        }
      } catch (headerError) {
        // If we can't read the header, skip type checking for this file
        console.warn(`Could not read header for ${filename} in ZIP:`, headerError);
      }
    }
  } catch (error) {
    console.warn('Error scanning ZIP contents:', error);
    // If ZIP extraction fails, don't fail the whole scan - just log it
  }
  
  return suspiciousFiles;
}

/**
 * Scan a single file for suspicious characteristics (including ZIP contents)
 */
export async function scanFileWithZipExtraction(file: File): Promise<SuspiciousFile[]> {
  const suspiciousFiles: SuspiciousFile[] = [];
  const extension = getExtension(file.name);
  
  // If it's a ZIP file, scan its contents
  if (extension === 'zip' || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
    const zipSuspicious = await scanZipContents(file);
    suspiciousFiles.push(...zipSuspicious);
  }
  
  // Also scan the file itself (for double extensions, etc.)
  const fileResult = await scanFile(file);
  if (fileResult) {
    suspiciousFiles.push(fileResult);
  }
  
  return suspiciousFiles;
}

/**
 * Scan multiple files for suspicious characteristics
 */
export async function scanFiles(files: File[]): Promise<ScanResult> {
  const suspiciousFiles: SuspiciousFile[] = [];
  
  for (const file of files) {
    const results = await scanFileWithZipExtraction(file);
    suspiciousFiles.push(...results);
  }
  
  return {
    hasSuspiciousFiles: suspiciousFiles.length > 0,
    suspiciousFiles
  };
}

