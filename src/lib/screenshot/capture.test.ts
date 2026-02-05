import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureScreenshot, isValidDataUrl } from './capture';
import { SCREENSHOT_QUALITY } from './constants';

// Mock chrome APIs
const mockChrome = {
  tabs: {
    query: vi.fn(),
    captureVisibleTab: vi.fn(),
  },
  scripting: {
    executeScript: vi.fn(),
  },
};

describe('Screenshot Capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock chrome.tabs.query
    mockChrome.tabs.query.mockResolvedValue([
      { id: 123, active: true, windowId: 1 },
    ]);

    // Mock chrome.scripting.executeScript
    mockChrome.scripting.executeScript.mockResolvedValue([
      { result: { width: 1920, height: 1080, devicePixelRatio: 2 } },
    ]);

    // Mock chrome.tabs.captureVisibleTab
    mockChrome.tabs.captureVisibleTab.mockResolvedValue(
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q=='
    );

    // Assign mock chrome globally
    global.chrome = mockChrome as any;
  });

  describe('captureScreenshot', () => {
    it('should return success with data when capture succeeds', async () => {
      const result = await captureScreenshot();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.dataUrl).toBeDefined();
      expect(result.data?.width).toBe(1920);
      expect(result.data?.height).toBe(1080);
      expect(result.data?.devicePixelRatio).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it('should use default high quality setting', async () => {
      await captureScreenshot();

      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, {
        format: 'jpeg',
        quality: SCREENSHOT_QUALITY.high,
      });
    });

    it('should use low quality when specified', async () => {
      await captureScreenshot({ quality: 'low' });

      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, {
        format: 'jpeg',
        quality: SCREENSHOT_QUALITY.low,
      });
    });

    it('should use medium quality when specified', async () => {
      await captureScreenshot({ quality: 'medium' });

      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, {
        format: 'jpeg',
        quality: SCREENSHOT_QUALITY.medium,
      });
    });

    it('should return error when no active tab found', async () => {
      mockChrome.tabs.query.mockResolvedValue([]);

      const result = await captureScreenshot();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active tab found');
      expect(result.data).toBeUndefined();
    });

    it('should return error when tab has no ID', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ active: true }]);

      const result = await captureScreenshot();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active tab found');
    });

    it('should use fallback DPR when executeScript fails', async () => {
      mockChrome.scripting.executeScript.mockRejectedValue(
        new Error('Scripting error')
      );

      const result = await captureScreenshot();

      // Should still succeed with fallback DPR of 1
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.devicePixelRatio).toBe(1);
    });

    it('should return error when captureVisibleTab fails', async () => {
      mockChrome.tabs.captureVisibleTab.mockRejectedValue(
        new Error('Capture failed')
      );

      const result = await captureScreenshot();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Screenshot capture failed');
    });

    it('should use returnToUser option when provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await captureScreenshot({ returnToUser: true });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('isValidDataUrl', () => {
    it('should return true for valid image data URLs', () => {
      expect(isValidDataUrl('data:image/jpeg;base64,abc123')).toBe(true);
      expect(isValidDataUrl('data:image/png;base64,abc123')).toBe(true);
      expect(isValidDataUrl('data:image/webp;base64,abc123')).toBe(true);
    });

    it('should return false for invalid data URLs', () => {
      expect(isValidDataUrl('data:text/plain;base64,abc123')).toBe(false);
      expect(isValidDataUrl('not-a-data-url')).toBe(false);
      expect(isValidDataUrl('')).toBe(false);
    });
  });
});

// Test the quality mapping constant
describe('Quality Mapping', () => {
  it('should have correct quality values', () => {
    expect(SCREENSHOT_QUALITY.low).toBe(50);
    expect(SCREENSHOT_QUALITY.medium).toBe(75);
    expect(SCREENSHOT_QUALITY.high).toBe(92);
  });
});
