/**
 * Screenshot Quality Constants
 *
 * Centralized quality settings for screenshot capture and processing.
 * Uses JPEG quality values in 0-100 range for consistency.
 */

export const SCREENSHOT_QUALITY = {
  /** Low quality - 50% JPEG compression */
  low: 50,
  /** Medium quality - 75% JPEG compression */
  medium: 75,
  /** High quality - 92% JPEG compression (slightly less than 100 for efficiency) */
  high: 92,
} as const;

/** Type for quality settings */
export type ScreenshotQuality = keyof typeof SCREENSHOT_QUALITY;

/**
 * Converts quality setting to JPEG quality value (0-1 range for canvas.toDataURL)
 */
export function getQualityValue(quality: ScreenshotQuality): number {
  return SCREENSHOT_QUALITY[quality] / 100;
}
