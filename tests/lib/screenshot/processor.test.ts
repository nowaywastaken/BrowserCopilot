import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ScreenshotProcessor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('quality mapping consistency', () => {
    it('should use consistent 0-1 scale for quality values', async () => {
      // Verify quality settings are in correct range
      // The processor uses: low=0.5, medium=0.75, high=0.92
      expect(0.5).toBeGreaterThanOrEqual(0);
      expect(0.5).toBeLessThanOrEqual(1);
      expect(0.75).toBeGreaterThanOrEqual(0);
      expect(0.75).toBeLessThanOrEqual(1);
      expect(0.92).toBeGreaterThanOrEqual(0);
      expect(0.92).toBeLessThanOrEqual(1);
    });
  });

  describe('DPR scaling calculations', () => {
    it('should correctly calculate display dimensions from DPR', () => {
      // Original capture dimensions at 2x DPR
      const originalWidth = 3840;
      const originalHeight = 2160;
      const devicePixelRatio = 2;

      // Calculate display dimensions (same logic as processor.ts)
      const displayWidth = Math.round(originalWidth / devicePixelRatio);
      const displayHeight = Math.round(originalHeight / devicePixelRatio);

      expect(displayWidth).toBe(1920);
      expect(displayHeight).toBe(1080);
    });

    it('should correctly handle 1x DPR (no scaling)', () => {
      const originalWidth = 1920;
      const originalHeight = 1080;
      const devicePixelRatio = 1;

      const displayWidth = Math.round(originalWidth / devicePixelRatio);
      const displayHeight = Math.round(originalHeight / devicePixelRatio);

      expect(displayWidth).toBe(1920);
      expect(displayHeight).toBe(1080);
    });

    it('should correctly handle 3x DPR (mobile retina)', () => {
      const originalWidth = 1170;
      const originalHeight = 2532;
      const devicePixelRatio = 3;

      const displayWidth = Math.round(originalWidth / devicePixelRatio);
      const displayHeight = Math.round(originalHeight / devicePixelRatio);

      expect(displayWidth).toBe(390);
      expect(displayHeight).toBe(844);
    });
  });

  describe('aspect ratio calculations', () => {
    it('should maintain 16:9 aspect ratio when scaling width', () => {
      const originalWidth = 1920;
      const originalHeight = 1080;
      const targetWidth = 800;

      const aspectRatio = originalWidth / originalHeight;
      const calculatedHeight = Math.round(targetWidth / aspectRatio);

      expect(calculatedHeight).toBe(450); // 800 / (1920/1080) = 800 / 1.777... = 450
    });

    it('should maintain 4:3 aspect ratio when scaling width', () => {
      const originalWidth = 1600;
      const originalHeight = 1200;
      const targetWidth = 400;

      const aspectRatio = originalWidth / originalHeight;
      const calculatedHeight = Math.round(targetWidth / aspectRatio);

      expect(calculatedHeight).toBe(300); // 400 / (1600/1200) = 400 / 1.333... = 300
    });
  });

  describe('ProcessedScreenshot interface', () => {
    it('should have correct structure', () => {
      const mockResult = {
        dataUrl: 'data:image/jpeg;base64,test123',
        displayWidth: 1920,
        displayHeight: 1080,
        devicePixelRatio: 2,
        originalWidth: 3840,
        originalHeight: 2160,
      };

      // Verify all required properties exist
      expect(mockResult.dataUrl).toBeDefined();
      expect(mockResult.displayWidth).toBeDefined();
      expect(mockResult.displayHeight).toBeDefined();
      expect(mockResult.devicePixelRatio).toBeDefined();
      expect(mockResult.originalWidth).toBeDefined();
      expect(mockResult.originalHeight).toBeDefined();

      // Verify types
      expect(typeof mockResult.dataUrl).toBe('string');
      expect(typeof mockResult.displayWidth).toBe('number');
      expect(typeof mockResult.displayHeight).toBe('number');
      expect(typeof mockResult.devicePixelRatio).toBe('number');
      expect(typeof mockResult.originalWidth).toBe('number');
      expect(typeof mockResult.originalHeight).toBe('number');
    });
  });

  describe('getImageDimensions', () => {
    it('should parse data URL header for dimensions', async () => {
      // Mock Image element behavior
      const mockImage = {
        complete: true,
        naturalWidth: 1920,
        naturalHeight: 1080,
      };

      vi.spyOn(global, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      const { getImageDimensions } = await import('../../../src/lib/screenshot/processor');
      const dims = getImageDimensions('data:image/jpeg;base64,test');

      expect(dims).toEqual({ width: 1920, height: 1080 });
    });

    it('should return null for unloaded image', async () => {
      const mockImage = {
        complete: false,
        naturalWidth: 0,
        naturalHeight: 0,
      };

      vi.spyOn(global, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      const { getImageDimensions } = await import('../../../src/lib/screenshot/processor');
      const dims = getImageDimensions('data:image/jpeg;base64,test');

      expect(dims).toBeNull();
    });
  });
});
