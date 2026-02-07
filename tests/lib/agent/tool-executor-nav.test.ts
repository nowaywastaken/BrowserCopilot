/**
 * Tool Executor - Navigation & Interaction Tests
 * Tests for navigate, click, fill, and other interaction executors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('navigateExecutor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should navigate to URL using existing tab', async () => {
    const { navigateExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
        update: vi.fn().mockResolvedValue({ id: 123, url: 'https://example.com' }),
      },
    });

    const result = await navigateExecutor.execute(
      { url: 'https://example.com' },
      { tabId: 123 }
    );

    expect(result.success).toBe(true);
    expect(result.data?.url).toBe('https://example.com');
  });

  it('should create new tab when no active tab', async () => {
    const { navigateExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 456, url: 'https://example.com' }),
      },
    });

    const result = await navigateExecutor.execute(
      { url: 'https://example.com' },
      { tabId: undefined }
    );

    expect(result.success).toBe(true);
  });

  it('should return error when URL is missing', async () => {
    const { navigateExecutor } = await import('../../../src/lib/agent/tool-executor');

    const result = await navigateExecutor.execute(
      {},
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('URL is required');
  });

  it('should handle navigation error', async () => {
    const { navigateExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
        update: vi.fn().mockRejectedValue(new Error('Navigation failed')),
      },
    });

    const result = await navigateExecutor.execute(
      { url: 'https://example.com' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
  });
});

describe('clickElementExecutor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should click element successfully', async () => {
    const { clickElementExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: { success: true } }]),
      },
    });

    const result = await clickElementExecutor.execute(
      { selector: '#button' },
      { tabId: 123 }
    );

    expect(result.success).toBe(true);
    expect(result.data?.clicked).toBe(true);
  });

  it('should return error when selector missing', async () => {
    const { clickElementExecutor } = await import('../../../src/lib/agent/tool-executor');

    const result = await clickElementExecutor.execute(
      {},
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Selector is required');
  });

  it('should return error when no active tab', async () => {
    const { clickElementExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await clickElementExecutor.execute(
      { selector: '#button' },
      { tabId: undefined }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab');
  });

  it('should return error when element not found', async () => {
    const { clickElementExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: { success: false, error: 'Element not found' } }]),
      },
    });

    const result = await clickElementExecutor.execute(
      { selector: '#nonexistent' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
  });

  it('should handle script error', async () => {
    const { clickElementExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockRejectedValue(new Error('Script failed')),
      },
    });

    const result = await clickElementExecutor.execute(
      { selector: '#button' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Click failed');
  });
});

describe('fillFormExecutor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should fill form successfully', async () => {
    const { fillFormExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: { success: true } }]),
      },
    });

    const result = await fillFormExecutor.execute(
      { selector: '#input', value: 'test value' },
      { tabId: 123 }
    );

    expect(result.success).toBe(true);
    expect(result.data?.filled).toBe(true);
  });

  it('should return error when selector missing', async () => {
    const { fillFormExecutor } = await import('../../../src/lib/agent/tool-executor');

    const result = await fillFormExecutor.execute(
      { value: 'test' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Selector and value are required');
  });

  it('should return error when value missing', async () => {
    const { fillFormExecutor } = await import('../../../src/lib/agent/tool-executor');

    const result = await fillFormExecutor.execute(
      { selector: '#input' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Selector and value are required');
  });

  it('should handle element not found', async () => {
    const { fillFormExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: { success: false, error: 'Element not found' } }]),
      },
    });

    const result = await fillFormExecutor.execute(
      { selector: '#nonexistent', value: 'test' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
  });

  it('should handle script error', async () => {
    const { fillFormExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockRejectedValue(new Error('Script failed')),
      },
    });

    const result = await fillFormExecutor.execute(
      { selector: '#input', value: 'test' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Fill form failed');
  });
});
