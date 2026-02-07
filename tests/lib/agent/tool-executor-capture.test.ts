/**
 * Tool Executor - Capture Tests
 * Tests for screenshot and DOM capture executors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock screenshot capture module
vi.mock('../../../src/lib/screenshot/capture', () => ({
  captureScreenshot: vi.fn(),
}));

// Mock DOM extractor module
vi.mock('../../../src/lib/dom/extractor', () => ({
  captureDOM: vi.fn(),
}));

describe('captureScreenshotExecutor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should capture screenshot with high quality', async () => {
    const { captureScreenshotExecutor } = await import('../../../src/lib/agent/tool-executor');
    const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');

    vi.mocked(captureScreenshot).mockResolvedValue({
      success: true,
      data: {
        width: 1920,
        height: 1080,
        devicePixelRatio: 2,
        dataUrl: 'data:image/png;base64,abc123',
      },
    });

    const result = await captureScreenshotExecutor.execute(
      { quality: 'high', returnToUser: true },
      { tabId: 123 }
    );

    expect(result.success).toBe(true);
    expect(result.data?.width).toBe(1920);
    expect(result.data?.height).toBe(1080);
  });

  it('should use medium quality when specified', async () => {
    const { captureScreenshotExecutor } = await import('../../../src/lib/agent/tool-executor');
    const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');

    vi.mocked(captureScreenshot).mockResolvedValue({
      success: true,
      data: { width: 1280, height: 720, devicePixelRatio: 1, dataUrl: 'data:image/png;base64,def' },
    });

    const result = await captureScreenshotExecutor.execute(
      { quality: 'medium' },
      { tabId: 123 }
    );

    expect(result.success).toBe(true);
  });

  it('should return error when capture fails', async () => {
    const { captureScreenshotExecutor } = await import('../../../src/lib/agent/tool-executor');
    const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');

    vi.mocked(captureScreenshot).mockResolvedValue({
      success: false,
      error: 'Tab not found',
    });

    const result = await captureScreenshotExecutor.execute(
      { quality: 'high' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Tab not found');
  });

  it('should handle exceptions', async () => {
    const { captureScreenshotExecutor } = await import('../../../src/lib/agent/tool-executor');
    const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');

    vi.mocked(captureScreenshot).mockRejectedValue(new Error('Unknown error'));

    const result = await captureScreenshotExecutor.execute(
      { quality: 'high' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown error');
  });
});

describe('captureDOMExecutor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should capture DOM with selector', async () => {
    const { captureDOMExecutor } = await import('../../../src/lib/agent/tool-executor');
    const { captureDOM } = await import('../../../src/lib/dom/extractor');

    vi.mocked(captureDOM).mockResolvedValue({
      success: true,
      data: {
        html: '<div>Test</div>',
        text: 'Test',
        metadata: { title: 'Test Page', url: 'https://example.com' },
      },
    });

    const result = await captureDOMExecutor.execute(
      { selector: '#main', includeAttributes: true },
      { tabId: 123 }
    );

    expect(result.success).toBe(true);
    expect(result.data?.html).toBe('<div>Test</div>');
  });

  it('should return error when DOM capture fails', async () => {
    const { captureDOMExecutor } = await import('../../../src/lib/agent/tool-executor');
    const { captureDOM } = await import('../../../src/lib/dom/extractor');

    vi.mocked(captureDOM).mockResolvedValue({
      success: false,
      error: 'Selector not found',
    });

    const result = await captureDOMExecutor.execute(
      { selector: '#nonexistent' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Selector not found');
  });

  it('should handle exceptions', async () => {
    const { captureDOMExecutor } = await import('../../../src/lib/agent/tool-executor');
    const { captureDOM } = await import('../../../src/lib/dom/extractor');

    vi.mocked(captureDOM).mockRejectedValue(new Error('Connection failed'));

    const result = await captureDOMExecutor.execute(
      { selector: '#test' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection failed');
  });
});
