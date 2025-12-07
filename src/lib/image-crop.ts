/**
 * Image cropping utilities
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Create a cropped image from a source image
 */
export async function createCroppedImage(
  imageSrc: string,
  pixelCrop: CropArea,
  outputType: string = 'image/jpeg',
  quality: number = 0.92
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  // Set canvas size to match crop area
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Draw the cropped image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      },
      outputType,
      quality
    );
  });
}

/**
 * Create an image element from a source
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });
}

/**
 * Convert blob to File
 */
export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type });
}

