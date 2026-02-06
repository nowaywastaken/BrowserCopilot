/**
 * DOM Extractor Tests
 * Tests for DOM capture and extraction functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureDOM, DOMCaptureOptions } from '../../../src/lib/dom/extractor';

// Mock chrome.tabs
const mockTabsQuery = vi.fn();
const mockTabsSendMessage = vi.fn();

// Mock the global chrome object for tabs
global.chrome = {
  ...global.chrome,
  tabs: {
    query: mockTabsQuery,
    sendMessage: mockTabsSendMessage,
  },
} as any;

describe('DOM Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('captureDOM', () => {
    it('should return error when no active tab found', async () => {
      mockTabsQuery.mockResolvedValue([]);

      const result = await captureDOM();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active tab found');
    });

    it('should return error when tab has no ID', async () => {
      mockTabsQuery.mockResolvedValue([{ active: true }]);

      const result = await captureDOM();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active tab found');
    });

    it('should successfully capture full document DOM', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, active: true }]);
      mockTabsSendMessage.mockResolvedValue({
        success: true,
        html: '<html><body><h1>Test</h1></body></html>',
        text: 'Test',
        metadata: {
          url: 'https://example.com',
          title: 'Test Page',
          viewport: { width: 1920, height: 1080 },
        },
      });

      const result = await captureDOM();

      expect(result.success).toBe(true);
      expect(result.data?.html).toBe('<html><body><h1>Test</h1></body></html>');
      expect(result.data?.text).toBe('Test');
      expect(result.data?.metadata.url).toBe('https://example.com');
      expect(result.data?.metadata.title).toBe('Test Page');
      expect(result.data?.metadata.viewport).toEqual({ width: 1920, height: 1080 });
    });

    it('should capture DOM with selector option', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, active: true }]);
      mockTabsSendMessage.mockResolvedValue({
        success: true,
        html: '<div class="content">Hello World</div>',
        text: 'Hello World',
        metadata: {
          url: 'https://example.com',
          title: 'Test Page',
          viewport: { width: 1920, height: 1080 },
        },
      });

      const options: DOMCaptureOptions = { selector: '.content' };
      const result = await captureDOM(options);

      expect(result.success).toBe(true);
      expect(mockTabsSendMessage).toHaveBeenCalledWith(1, {
        type: 'captureDOM',
        selector: '.content',
        includeAttributes: false,
        maxDepth: undefined,
      });
    });

    it('should pass all options to content script', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, active: true }]);
      mockTabsSendMessage.mockResolvedValue({
        success: true,
        html: '<div>Content</div>',
        text: 'Content',
        metadata: {
          url: 'https://example.com',
          title: 'Test',
          viewport: { width: 800, height: 600 },
        },
      });

      const options: DOMCaptureOptions = {
        selector: '#main',
        includeAttributes: true,
        maxDepth: 3,
      };
      const result = await captureDOM(options);

      expect(result.success).toBe(true);
      expect(mockTabsSendMessage).toHaveBeenCalledWith(1, {
        type: 'captureDOM',
        selector: '#main',
        includeAttributes: true,
        maxDepth: 3,
      });
    });

    it('should return error when content script fails', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, active: true }]);
      mockTabsSendMessage.mockResolvedValue({
        success: false,
        error: 'Element not found',
      });

      const result = await captureDOM({ selector: '.nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
    });

    it('should return error when sendMessage throws exception', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, active: true }]);
      mockTabsSendMessage.mockRejectedValue(new Error('Connection error'));

      const result = await captureDOM();

      expect(result.success).toBe(false);
      expect(result.error).toContain('DOM capture failed');
    });

    it('should use default options when not specified', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, active: true }]);
      mockTabsSendMessage.mockResolvedValue({
        success: true,
        html: '<html></html>',
        text: '',
        metadata: {
          url: 'https://example.com',
          title: 'Test',
          viewport: { width: 1920, height: 1080 },
        },
      });

      await captureDOM();

      expect(mockTabsSendMessage).toHaveBeenCalledWith(1, {
        type: 'captureDOM',
        selector: undefined,
        includeAttributes: false,
        maxDepth: undefined,
      });
    });
  });

  describe('extractText', () => {
    it('should extract text content from selector', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, active: true }]);
      mockTabsSendMessage.mockResolvedValue({
        success: true,
        html: '<p>Hello World</p>',
        text: 'Hello World',
        metadata: {
          url: 'https://example.com',
          title: 'Test',
          viewport: { width: 1920, height: 1080 },
        },
      });

      const { extractText } = await import('../../../src/lib/dom/extractor');
      const text = await extractText('p');

      expect(text).toBe('Hello World');
    });

    it('should throw error when extraction fails', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, active: true }]);
      mockTabsSendMessage.mockResolvedValue({
        success: false,
        error: 'Selector not found',
      });

      const { extractText } = await import('../../../src/lib/dom/extractor');
      await expect(extractText('.missing')).rejects.toThrow('Selector not found');
    });
  });

  describe('extractHTML', () => {
    it('should extract HTML content from selector', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, active: true }]);
      mockTabsSendMessage.mockResolvedValue({
        success: true,
        html: '<section class="article"><p>Content</p></section>',
        text: 'Content',
        metadata: {
          url: 'https://example.com',
          title: 'Test',
          viewport: { width: 1920, height: 1080 },
        },
      });

      const { extractHTML } = await import('../../../src/lib/dom/extractor');
      const html = await extractHTML('section.article');

      expect(html).toBe('<section class="article"><p>Content</p></section>');
    });

    it('should throw error when extraction fails', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, active: true }]);
      mockTabsSendMessage.mockResolvedValue({
        success: false,
        error: 'Element not found',
      });

      const { extractHTML } = await import('../../../src/lib/dom/extractor');
      await expect(extractHTML('#missing')).rejects.toThrow('Element not found');
    });
  });
});
