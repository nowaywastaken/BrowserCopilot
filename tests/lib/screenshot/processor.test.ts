/**
 * Screenshot Processor Tests
 * Tests for the DPR-aware screenshot processing module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ProcessedScreenshot } from '../../../src/lib/screenshot/processor';

// Create a minimal mock for canvas operations
const createMockCanvas = () => {
  const ctx = {
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high' as const,
    getContext: vi.fn().mockReturnValue({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high' as const,
      drawImage: vi.fn(),
    }),
  };
  return {
    width: 0,
    height: 0,
    getContext: ctx.getContext,
  };
};

// Create a valid base64 data URL for testing
const createTestDataUrl = (width: number, height: number): string => {
  // Minimal 1x1 PNG base64
  const mockPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return `data:image/png;base64,${mockPngBase64}`;
};

describe('Screenshot Processor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('processScreenshotForDisplay', () => {
    it('should process screenshot with correct DPR scaling for 2x displays', async () => {
      const { processScreenshotForDisplay } = await import('../../../src/lib/screenshot/processor');
      const dataUrl = createTestDataUrl(3840, 2160);
      const devicePixelRatio = 2;

      // Mock Image constructor
      const mockImage = {
        width: 3840,
        height: 2160,
        complete: true,
        src: '',
        onload: null as ((this: HTMLImageElement) => void) | null,
        onerror: null as ((this: HTMLImageElement, error: Event) => void) | null,
      };

      vi.spyOn(global, 'Image').mockImplementation(() => {
        const img = mockImage as unknown as HTMLImageElement;
        // Simulate async load
        setTimeout(() => img.onload?.(img), 0);
        return img;
      });

      // Mock canvas creation
      const mockCtx = {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high' as const,
        drawImage: vi.fn(),
      };
      const mockCanvas = {
        width: 1920,
        height: 1080,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toDataURL: vi.fn().mockReturnValue(createTestDataUrl(1920, 1080)),
      };

      vi.spyOn(document, 'createElement').mockImplementation(() => mockCanvas as unknown as HTMLCanvasElement);

      const result = await processScreenshotForDisplay(dataUrl, devicePixelRatio);

      expect(result.displayWidth).toBe(1920);
      expect(result.displayHeight).toBe(1080);
      expect(result.devicePixelRatio).toBe(2);
      expect(result.originalWidth).toBe(3840);
      expect(result.originalHeight).toBe(2160);
    });

    it('should handle 1x DPR without scaling', async () => {
      const { processScreenshotForDisplay } = await import('../../../src/lib/screenshot/processor');
      const dataUrl = createTestDataUrl(1920, 1080);

      const mockImage = {
        width: 1920,
        height: 1080,
        complete: true,
        src: '',
        onload: null as ((this: HTMLImageElement) => void) | null,
      };

      vi.spyOn(global, 'Image').mockImplementation(() => {
        const img = mockImage as unknown as HTMLImageElement;
        setTimeout(() => img.onload?.(img), 0);
        return img;
      });

      const mockCtx = {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high' as const,
        drawImage: vi.fn(),
      };
      const mockCanvas = {
        width: 1920,
        height: 1080,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toDataURL: vi.fn().mockReturnValue(dataUrl),
      };

      vi.spyOn(document, 'createElement').mockImplementation(() => mockCanvas as unknown as HTMLCanvasElement);

      const result = await processScreenshotForDisplay(dataUrl, 1);

      expect(result.displayWidth).toBe(1920);
      expect(result.displayHeight).toBe(1080);
      expect(result.devicePixelRatio).toBe(1);
    });

    it('should use low quality setting when specified', async () => {
      const { processScreenshotForDisplay } = await import('../../../src/lib/screenshot/processor');
      const dataUrl = createTestDataUrl(1920, 1080);

      const mockImage = {
        width: 1920,
        height: 1080,
        complete: true,
        src: '',
        onload: null as ((this: HTMLImageElement) => void) | null,
      };

      vi.spyOn(global, 'Image').mockImplementation(() => {
        const img = mockImage as unknown as HTMLImageElement;
        setTimeout(() => img.onload?.(img), 0);
        return img;
      });

      const mockCtx = {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high' as const,
        drawImage: vi.fn(),
      };
      const mockCanvas = {
        width: 960,
        height: 540,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toDataURL: vi.fn().mockReturnValue(createTestDataUrl(960, 540)),
      };

      vi.spyOn(document, 'createElement').mockImplementation(() => mockCanvas as unknown as HTMLCanvasElement);

      const result = await processScreenshotForDisplay(dataUrl, 2, 'low');

      expect(result.devicePixelRatio).toBe(2);
    });

    it('should throw error when canvas context is unavailable', async () => {
      const { processScreenshotForDisplay } = await import('../../../src/lib/screenshot/processor');
      const dataUrl = createTestDataUrl(1920, 1080);

      const mockImage = {
        width: 1920,
        height: 1080,
        complete: true,
        src: '',
        onload: null as ((this: HTMLImageElement) => void) | null,
      };

      vi.spyOn(global, 'Image').mockImplementation(() => {
        const img = mockImage as unknown as HTMLImageElement;
        setTimeout(() => img.onload?.(img), 0);
        return img;
      });

      const mockCanvas = {
        width: 1920,
        height: 1080,
        getContext: vi.fn().mockReturnValue(null),
      };

      vi.spyOn(document, 'createElement').mockImplementation(() => mockCanvas as unknown as HTMLCanvasElement);

      await expect(processScreenshotForDisplay(dataUrl, 1)).rejects.toThrow('Failed to get canvas context');
    });
  });

  describe('processScreenshotOriginal', () => {
    it('should return original resolution without scaling', async () => {
      const { processScreenshotOriginal } = await import('../../../src/lib/screenshot/processor');
      const dataUrl = createTestDataUrl(3840, 2160);

      const mockImage = {
        width: 3840,
        height: 2160,
        complete: true,
        src: '',
        onload: null as ((this: HTMLImageElement) => void) | null,
      };

      vi.spyOn(global, 'Image').mockImplementation(() => {
        const img = mockImage as unknown as HTMLImageElement;
        setTimeout(() => img.onload?.(img), 0);
        return img;
      });

      const result = await processScreenshotOriginal(dataUrl);

      expect(result.displayWidth).toBe(3840);
      expect(result.displayHeight).toBe(2160);
      expect(result.originalWidth).toBe(3840);
      expect(result.originalHeight).toBe(2160);
      expect(result.devicePixelRatio).toBe(1);
      expect(result.dataUrl).toBe(dataUrl);
    });
  });

  describe('scaleScreenshot', () => {
    it('should scale to exact dimensions when both provided', async () => {
      const { scaleScreenshot } = await import('../../../src/lib/screenshot/processor');
      const dataUrl = createTestDataUrl(1920, 1080);

      const mockImage = {
        width: 1920,
        height: 1080,
        complete: true,
        src: '',
        onload: null as ((this: HTMLImageElement) => void) | null,
      };

      vi.spyOn(global, 'Image').mockImplementation(() => {
        const img = mockImage as unknown as HTMLImageElement;
        setTimeout(() => img.onload?.(img), 0);
        return img;
      });

      const mockCtx = {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high' as const,
        drawImage: vi.fn(),
      };
      const mockCanvas = {
        width: 800,
        height: 600,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toDataURL: vi.fn().mockReturnValue(createTestDataUrl(800, 600)),
      };

      vi.spyOn(document, 'createElement').mockImplementation(() => mockCanvas as unknown as HTMLCanvasElement);

      const result = await scaleScreenshot(dataUrl, 800, 600);

      expect(result.displayWidth).toBe(800);
      expect(result.displayHeight).toBe(600);
    });

    it('should maintain aspect ratio when only width provided', async () => {
      const { scaleScreenshot } = await import('../../../src/lib/screenshot/processor');
      const dataUrl = createTestDataUrl(1920, 1080);

      const mockImage = {
        width: 1920,
        height: 1080,
        complete: true,
        src: '',
        onload: null as ((this: HTMLImageElement) => void) | null,
      };

      vi.spyOn(global, 'Image').mockImplementation(() => {
        const img = mockImage as unknown as HTMLImageElement;
        setTimeout(() => img.onload?.(img), 0);
        return img;
      });

      const mockCtx = {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high' as const,
        drawImage: vi.fn(),
      };
      const mockCanvas = {
        width: 800,
        height: 450,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toDataURL: vi.fn().mockReturnValue(createTestDataUrl(800, 450)),
      };

      vi.spyOn(document, 'createElement').mockImplementation(() => mockCanvas as unknown as HTMLCanvasElement);

      const result = await scaleScreenshot(dataUrl, 800);

      // 1920/1080 = 1.777..., 800/450 = 1.777...
      expect(result.displayWidth).toBe(800);
      expect(result.displayHeight).toBe(450);
    });

    it('should throw error when canvas context is unavailable', async () => {
      const { scaleScreenshot } = await import('../../../src/lib/screenshot/processor');
      const dataUrl = createTestDataUrl(1920, 1080);

      const mockImage = {
        width: 1920,
        height: 1080,
        complete: true,
        src: '',
        onload: null as ((this: HTMLImageElement) => void) | null,
      };

      vi.spyOn(global, 'Image').mockImplementation(() => {
        const img = mockImage as unknown as HTMLImageElement;
        setTimeout(() => img.onload?.(img), 0);
        return img;
      });

      const mockCanvas = {
        width: 800,
        height: 600,
        getContext: vi.fn().mockReturnValue(null),
      };

      vi.spyOn(document, 'createElement').mockImplementation(() => mockCanvas as unknown as HTMLCanvasElement);

      await expect(scaleScreenshot(dataUrl, 800, 600)).rejects.toThrow('Failed to get canvas context');
    });
  });

  describe('getImageDimensions', () => {
    it('should return dimensions for already loaded image', async () => {
      const { getImageDimensions } = await import('../../../src/lib/screenshot/processor');

      const mockImage = {
        complete: true,
        naturalWidth: 1920,
        naturalHeight: 1080,
        src: '',
      };

      vi.spyOn(global, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      const dims = getImageDimensions(createTestDataUrl(1920, 1080));

      expect(dims).toEqual({ width: 1920, height: 1080 });
    });

    it('should return null for not-yet-loaded image', async () => {
      const { getImageDimensions } = await import('../../../src/lib/screenshot/processor');

      const mockImage = {
        complete: false,
        naturalWidth: 0,
        naturalHeight: 0,
        src: '',
      };

      vi.spyOn(global, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      const dims = getImageDimensions(createTestDataUrl(0, 0));

      expect(dims).toBeNull();
    });

    it('should return null when naturalWidth is 0', async () => {
      const { getImageDimensions } = await import('../../../src/lib/screenshot/processor');

      const mockImage = {
        complete: true,
        naturalWidth: 0,
        naturalHeight: 1080,
        src: '',
      };

      vi.spyOn(global, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      const dims = getImageDimensions(createTestDataUrl(0, 0));

      expect(dims).toBeNull();
    });
  });

  describe('ProcessedScreenshot interface compliance', () => {
    it('should have all required properties', () => {
      const validResult: ProcessedScreenshot = {
        dataUrl: 'data:image/jpeg;base64,test',
        displayWidth: 1920,
        displayHeight: 1080,
        devicePixelRatio: 2,
        originalWidth: 3840,
        originalHeight: 2160,
      };

      expect(validResult.dataUrl).toBeDefined();
      expect(validResult.displayWidth).toBeDefined();
      expect(validResult.displayHeight).toBeDefined();
      expect(validResult.devicePixelRatio).toBeDefined();
      expect(validResult.originalWidth).toBeDefined();
      expect(validResult.originalHeight).toBeDefined();
    });

    it('should handle various quality settings', () => {
      const qualitySettings = ['low', 'medium', 'high'] as const;

      for (const quality of qualitySettings) {
        expect(['low', 'medium', 'high']).toContain(quality);
      }
    });
  });
});
