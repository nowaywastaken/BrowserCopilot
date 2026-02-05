/**
 * Screenshot Capture Module
 * Uses Chrome's tabs.captureVisibleTab API to capture screenshots
 * and chrome.scripting.executeScript to get device info (DPR)
 */

import { SCREENSHOT_QUALITY, type ScreenshotQuality } from './constants';

export interface ScreenshotCaptureOptions {
  /** Quality level for the screenshot (affects compression) */
  quality?: ScreenshotQuality;
  /** Whether to return the screenshot data to the user immediately */
  returnToUser?: boolean;
}

export interface ScreenshotData {
  /** Base64 encoded image data URL */
  dataUrl: string;
  /** Logical width of the screenshot */
  width: number;
  /** Logical height of the screenshot */
  height: number;
  /** Device Pixel Ratio used for capture */
  devicePixelRatio: number;
}

export interface ScreenshotResult {
  /** Whether the capture was successful */
  success: boolean;
  /** Screenshot data if successful */
  data?: ScreenshotData;
  /** Error message if capture failed */
  error?: string;
}

interface DeviceInfo {
  width: number;
  height: number;
  devicePixelRatio: number;
}

/**
 * Captures a screenshot of the current visible tab
 *
 * @param options - Optional configuration for capture
 * @returns Promise resolving to ScreenshotResult
 */
export async function captureScreenshot(
  options: ScreenshotCaptureOptions = {}
): Promise<ScreenshotResult> {
  const { quality = 'high', returnToUser = true } = options;

  try {
    // First, get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      return {
        success: false,
        error: 'No active tab found',
      };
    }

    // Get device info using executeScript (needed for DPR)
    const deviceInfo = await getDeviceInfo(activeTab.id);
    if (!deviceInfo) {
      return {
        success: false,
        error: 'Failed to get device info',
      };
    }

    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: 'jpeg',
      quality: SCREENSHOT_QUALITY[quality],
    });

    const screenshotData: ScreenshotData = {
      dataUrl,
      width: deviceInfo.width,
      height: deviceInfo.height,
      devicePixelRatio: deviceInfo.devicePixelRatio,
    };

    if (returnToUser) {
      // Log for debugging purposes
      console.log(`Screenshot captured: ${screenshotData.width}x${screenshotData.height} @ ${screenshotData.devicePixelRatio}x DPR`);
    }

    return {
      success: true,
      data: screenshotData,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Screenshot capture failed:', error);
    return {
      success: false,
      error: `Screenshot capture failed: ${errorMessage}`,
    };
  }
}

/**
 * Gets device information from the active tab using scripting API
 * This is needed to determine the actual pixel dimensions considering DPR
 *
 * @param tabId - The ID of the active tab
 * @returns Promise resolving to device info or null if failed
 */
async function getDeviceInfo(tabId: number): Promise<DeviceInfo | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (): DeviceInfo => {
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        };
      },
    });

    if (results && results[0]?.result) {
      return results[0].result as DeviceInfo;
    }

    return null;
  } catch (error) {
    console.error('Failed to get device info:', error);
    // Fallback: try without DPR adjustment
    return {
      width: 0,
      height: 0,
      devicePixelRatio: 1,
    };
  }
}

/**
 * Validates that the screenshot data URL is properly formatted
 *
 * @param dataUrl - The data URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith('data:image/') && dataUrl.includes('base64,');
}
