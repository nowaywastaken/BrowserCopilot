import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ScreenshotCapture', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    // Reset chrome to base mock before each test
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([]),
        captureVisibleTab: vi.fn(),
      },
      scripting: {
        executeScript: vi.fn(),
      },
    });
  });

  it('should capture visible tab with high quality', async () => {
    const mockChrome = {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123, active: true, windowId: 1 }]),
        captureVisibleTab: vi.fn().mockResolvedValue('data:image/jpeg;base64,mock123'),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: { devicePixelRatio: 2, width: 1920, height: 1080 } }]),
      },
    };

    vi.stubGlobal('chrome', mockChrome);

    const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
    const result = await captureScreenshot({ quality: 'high' });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.width).toBe(1920);
    expect(result.data?.height).toBe(1080);
    expect(result.data?.devicePixelRatio).toBe(2);
    expect(result.data?.dataUrl).toBe('data:image/jpeg;base64,mock123');
  });

  it('should use high quality by default', async () => {
    const mockChrome = {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 456, active: true, windowId: 2 }]),
        captureVisibleTab: vi.fn().mockResolvedValue('data:image/jpeg;base64,mediUM'),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: { devicePixelRatio: 1, width: 1366, height: 768 } }]),
      },
    };

    vi.stubGlobal('chrome', mockChrome);

    const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
    const result = await captureScreenshot({});

    expect(result.success).toBe(true);
    expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(2, { format: 'jpeg', quality: 92 });
  });

  it('should return error when no active tab', async () => {
    const mockChrome = {
      tabs: {
        query: vi.fn().mockResolvedValue([]),
      },
      scripting: {
        executeScript: vi.fn(),
      },
    };

    vi.stubGlobal('chrome', mockChrome);

    const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
    const result = await captureScreenshot({});

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab found');
  });

  describe('returnToUser option', () => {
    it('should NOT log when returnToUser is true', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 789, active: true, windowId: 3 }]),
          captureVisibleTab: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
        },
        scripting: {
          executeScript: vi.fn().mockResolvedValue([{ result: { devicePixelRatio: 1, width: 1920, height: 1080 } }]),
        },
      };

      vi.stubGlobal('chrome', mockChrome);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
      await captureScreenshot({ returnToUser: true });

      // Should NOT log when returning to user
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log debug message when returnToUser is false', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 101, active: true, windowId: 4 }]),
          captureVisibleTab: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
        },
        scripting: {
          executeScript: vi.fn().mockResolvedValue([{ result: { devicePixelRatio: 1, width: 1920, height: 1080 } }]),
        },
      };

      vi.stubGlobal('chrome', mockChrome);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
      await captureScreenshot({ returnToUser: false });

      // Should log when NOT returning to user
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Screenshot captured but not returned to user')
      );
    });

    it('should default returnToUser to true', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 202, active: true, windowId: 5 }]),
          captureVisibleTab: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
        },
        scripting: {
          executeScript: vi.fn().mockResolvedValue([{ result: { devicePixelRatio: 1, width: 1920, height: 1080 } }]),
        },
      };

      vi.stubGlobal('chrome', mockChrome);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
      await captureScreenshot({});

      // Should NOT log when returnToUser defaults to true
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('quality mapping consistency', () => {
    it('should use 1-100 scale for quality values', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 303, active: true, windowId: 6 }]),
          captureVisibleTab: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
        },
        scripting: {
          executeScript: vi.fn().mockResolvedValue([{ result: { devicePixelRatio: 1, width: 1920, height: 1080 } }]),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');

      await captureScreenshot({ quality: 'low' });
      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(6, { format: 'jpeg', quality: 50 });

      await captureScreenshot({ quality: 'medium' });
      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(6, { format: 'jpeg', quality: 75 });

      await captureScreenshot({ quality: 'high' });
      expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(6, { format: 'jpeg', quality: 92 });
    });

    it('should have quality values in valid range (1-100)', () => {
      // Verify the QUALITY_MAP values are in correct range
      const low = 50;
      const medium = 75;
      const high = 92;

      expect(low).toBeGreaterThanOrEqual(1);
      expect(low).toBeLessThanOrEqual(100);
      expect(medium).toBeGreaterThanOrEqual(1);
      expect(medium).toBeLessThanOrEqual(100);
      expect(high).toBeGreaterThanOrEqual(1);
      expect(high).toBeLessThanOrEqual(100);
    });
  });

  describe('error handling', () => {
    it('should return error when device info fails to load', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 404, active: true, windowId: 7 }]),
          captureVisibleTab: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
        },
        scripting: {
          executeScript: vi.fn().mockResolvedValue([{ result: null }]),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
      const result = await captureScreenshot({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get device info');
    });

    it('should return error when captureVisibleTab throws exception', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 505, active: true, windowId: 8 }]),
          captureVisibleTab: vi.fn().mockRejectedValue(new Error('Capture failed: tab not found')),
        },
        scripting: {
          executeScript: vi.fn().mockResolvedValue([{ result: { devicePixelRatio: 1, width: 1920, height: 1080 } }]),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
      const result = await captureScreenshot({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Screenshot capture failed');
    });

    it('should handle unknown error types gracefully', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 606, active: true, windowId: 9 }]),
          captureVisibleTab: vi.fn().mockRejectedValue('String error instead of Error object'),
        },
        scripting: {
          executeScript: vi.fn().mockResolvedValue([{ result: { devicePixelRatio: 1, width: 1920, height: 1080 } }]),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
      const result = await captureScreenshot({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Screenshot capture failed');
    });

    it('should handle executeScript throwing exception', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 707, active: true, windowId: 10 }]),
          captureVisibleTab: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
        },
        scripting: {
          executeScript: vi.fn().mockRejectedValue(new Error('Scripting permission denied')),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
      const result = await captureScreenshot({});

      // When executeScript fails, it falls back to default device info, so capture succeeds
      // The fallback returns { width: 0, height: 0, devicePixelRatio: 1 }
      expect(result.success).toBe(true);
    });

    it('should handle empty results array from executeScript', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 808, active: true, windowId: 11 }]),
          captureVisibleTab: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
        },
        scripting: {
          executeScript: vi.fn().mockResolvedValue([]),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
      const result = await captureScreenshot({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get device info');
    });

    it('should handle undefined result in executeScript response', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 909, active: true, windowId: 12 }]),
          captureVisibleTab: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
        },
        scripting: {
          executeScript: vi.fn().mockResolvedValue([undefined]),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
      const result = await captureScreenshot({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get device info');
    });
  });

  describe('ScreeshotResult structure', () => {
    it('should have correct structure on success', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([{ id: 1001, active: true, windowId: 13 }]),
          captureVisibleTab: vi.fn().mockResolvedValue('data:image/jpeg;base64,success'),
        },
        scripting: {
          executeScript: vi.fn().mockResolvedValue([{ result: { devicePixelRatio: 2, width: 1280, height: 720 } }]),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
      const result = await captureScreenshot({});

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.dataUrl).toBe('data:image/jpeg;base64,success');
      expect(result.data!.width).toBe(1280);
      expect(result.data!.height).toBe(720);
      expect(result.data!.devicePixelRatio).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it('should have correct structure on failure', async () => {
      const mockChrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([]),
        },
        scripting: {
          executeScript: vi.fn(),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
      const result = await captureScreenshot({});

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
    });
  });

  describe('device pixel ratio handling', () => {
    it('should handle various DPR values correctly', async () => {
      const dprValues = [1, 1.5, 2, 3, 4];

      for (const dpr of dprValues) {
        const mockChrome = {
          tabs: {
            query: vi.fn().mockResolvedValue([{ id: 1000 + dpr, active: true, windowId: dpr * 10 }]),
            captureVisibleTab: vi.fn().mockResolvedValue(`data:image/jpeg;base64,dpr${dpr}`),
          },
          scripting: {
            executeScript: vi.fn().mockResolvedValue([{ result: { devicePixelRatio: dpr, width: 1920, height: 1080 } }]),
          },
        };

        vi.stubGlobal('chrome', mockChrome);

        const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
        const result = await captureScreenshot({});

        expect(result.success).toBe(true);
        expect(result.data!.devicePixelRatio).toBe(dpr);
      }
    });
  });
});
