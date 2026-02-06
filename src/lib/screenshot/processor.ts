/**
 * Screenshot Processor Module
 * Handles DPR-aware processing of screenshots for WYSIWYG display
 * Uses Image and Canvas to scale screenshots appropriately
 */

export interface ProcessedScreenshot {
  /** The processed data URL (scaled for display) */
  dataUrl: string;
  /** Display width in CSS pixels */
  displayWidth: number;
  /** Display height in CSS pixels */
  displayHeight: number;
  /** The device pixel ratio of the original capture */
  devicePixelRatio: number;
  /** Original capture width in pixels */
  originalWidth: number;
  /** Original capture height in pixels */
  originalHeight: number;
}

/**
 * Quality setting for JPEG compression
 */
type QualitySetting = 'low' | 'medium' | 'high';

/**
 * Processes a screenshot for display by scaling based on device pixel ratio
 * This ensures WYSIWYG rendering across different display configurations
 *
 * @param dataUrl - The original screenshot data URL
 * @param devicePixelRatio - The device pixel ratio of the capture
 * @param quality - Optional JPEG quality for the output (default: high)
 * @returns Promise resolving to the processed screenshot
 */
export async function processScreenshotForDisplay(
  dataUrl: string,
  devicePixelRatio: number,
  quality: QualitySetting = 'high'
): Promise<ProcessedScreenshot> {
  // Load the image from the data URL
  const image = await loadImage(dataUrl);

  // Calculate dimensions
  const originalWidth = image.width;
  const originalHeight = image.height;

  // Calculate display dimensions (CSS pixels)
  // The original capture includes DPR, so we divide by DPR to get CSS pixels
  const displayWidth = Math.round(originalWidth / devicePixelRatio);
  const displayHeight = Math.round(originalHeight / devicePixelRatio);

  // Create canvas for scaling
  const canvas = document.createElement('canvas');
  canvas.width = displayWidth;
  canvas.height = displayHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Disable image smoothing for sharper downscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the image scaled to display dimensions
  ctx.drawImage(image, 0, 0, displayWidth, displayHeight);

  // Get quality mapping
  const qualityValue = getQualityValue(quality);

  // Convert to data URL
  const processedDataUrl = canvas.toDataURL('image/jpeg', qualityValue);

  return {
    dataUrl: processedDataUrl,
    displayWidth,
    displayHeight,
    devicePixelRatio,
    originalWidth,
    originalHeight,
  };
}

/**
 * Processes a screenshot at its original resolution
 * Useful when you need the full resolution image
 *
 * @param dataUrl - The original screenshot data URL
 * @returns Promise resolving to the original resolution screenshot info
 */
export async function processScreenshotOriginal(
  dataUrl: string
): Promise<ProcessedScreenshot> {
  const image = await loadImage(dataUrl);

  return {
    dataUrl,
    displayWidth: image.width,
    displayHeight: image.height,
    devicePixelRatio: 1,
    originalWidth: image.width,
    originalHeight: image.height,
  };
}

/**
 * Scales a screenshot to specific dimensions
 * Maintains aspect ratio if only one dimension is provided
 *
 * @param dataUrl - The screenshot data URL
 * @param targetWidth - Target width in pixels
 * @param targetHeight - Target height in pixels (optional)
 * @param quality - JPEG quality for output
 * @returns Promise resolving to the scaled screenshot
 */
export async function scaleScreenshot(
  dataUrl: string,
  targetWidth: number,
  targetHeight?: number,
  quality: QualitySetting = 'high'
): Promise<ProcessedScreenshot> {
  const image = await loadImage(dataUrl);

  const aspectRatio = image.width / image.height;
  const finalWidth = targetWidth;
  const finalHeight = targetHeight ?? Math.round(targetWidth / aspectRatio);

  const canvas = document.createElement('canvas');
  canvas.width = finalWidth;
  canvas.height = finalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, finalWidth, finalHeight);

  const qualityValue = getQualityValue(quality);
  const processedDataUrl = canvas.toDataURL('image/jpeg', qualityValue);

  return {
    dataUrl: processedDataUrl,
    displayWidth: finalWidth,
    displayHeight: finalHeight,
    devicePixelRatio: 1,
    originalWidth: image.width,
    originalHeight: image.height,
  };
}

/**
 * Loads an image from a data URL and returns an Image object
 *
 * @param dataUrl - The image data URL
 * @returns Promise resolving to the loaded Image
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = dataUrl;
  });
}

/**
 * Converts quality setting to JPEG quality value
 *
 * @param quality - Quality setting
 * @returns JPEG quality value (0-1)
 */
function getQualityValue(quality: QualitySetting): number {
  const qualityMap: Record<QualitySetting, number> = {
    low: 0.5,
    medium: 0.75,
    high: 0.92, // Slightly less than 1.0 for file size efficiency
  };
  return qualityMap[quality];
}

/**
 * Extracts image dimensions from a data URL without loading it fully
 *
 * @param dataUrl - The image data URL
 * @returns Object with width and height, or null if parsing fails
 */
export function getImageDimensions(dataUrl: string): { width: number; height: number } | null {
  // Create an image but don't wait for full load
  const img = new Image();
  img.src = dataUrl;

  if (img.complete && img.naturalWidth > 0) {
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  }

  return null;
}
