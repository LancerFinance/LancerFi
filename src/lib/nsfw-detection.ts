/**
 * NSFW Image Detection Utility
 * Uses NSFWJS (TensorFlow.js) to detect inappropriate content in images
 */

import * as nsfwjs from 'nsfwjs';

let model: nsfwjs.NSFWJS | null = null;
let modelLoading = false;

/**
 * Load the NSFW detection model (lazy loading)
 */
async function loadModel(): Promise<nsfwjs.NSFWJS> {
  if (model) {
    return model;
  }

  if (modelLoading) {
    // Wait for model to finish loading
    while (modelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (model) return model;
  }

  modelLoading = true;
  try {
    // Load the model - NSFWJS will use its default model
    // The model is loaded from a CDN and cached
    model = await nsfwjs.load();
    modelLoading = false;
    return model;
  } catch (error) {
    modelLoading = false;
    console.error('Error loading NSFW model:', error);
    throw new Error('Failed to load image moderation model. Please try again.');
  }
}

/**
 * Check if an image contains NSFW content
 * @param imageFile - The image file to check
 * @param threshold - Confidence threshold (0-1). Default 0.8 means 80% confidence required
 * @returns Object with isNSFW boolean and details
 */
export async function checkImageForNSFW(
  imageFile: File,
  threshold: number = 0.8
): Promise<{ isNSFW: boolean; confidence: number; category: string; error?: string }> {
  try {
    // Load model if not already loaded
    const nsfwModel = await loadModel();

    // Create an image element from the file
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => {
        console.error('Error loading image:', err);
        reject(new Error('Failed to load image for moderation'));
      };
      img.src = URL.createObjectURL(imageFile);
    });

    // Classify the image
    const predictions = await nsfwModel.classify(image);

    // Clean up the object URL
    URL.revokeObjectURL(image.src);

    // Find the highest confidence prediction
    const topPrediction = predictions.reduce((prev, current) => 
      (prev.probability > current.probability) ? prev : current
    );

    // Check if the top category is NSFW and exceeds threshold
    const nsfwCategories = ['Porn', 'Hentai', 'Sexy'];
    const isNSFW = nsfwCategories.includes(topPrediction.className) && topPrediction.probability >= threshold;

    return {
      isNSFW,
      confidence: topPrediction.probability,
      category: topPrediction.className
    };
  } catch (error: any) {
    console.error('Error checking image for NSFW content:', error);
    // If detection fails, we'll allow the image (fail open for better UX)
    // But log the error for monitoring
    // In production, you might want to fail closed (reject) for security
    return {
      isNSFW: false,
      confidence: 0,
      category: 'Unknown',
      error: error.message || 'Unknown error during image moderation'
    };
  }
}

/**
 * Check if an image is safe to upload
 * Returns true if image is safe, false if NSFW
 */
export async function isImageSafe(imageFile: File): Promise<boolean> {
  const result = await checkImageForNSFW(imageFile, 0.8);
  return !result.isNSFW;
}

