/**
 * Tool Executor - Script & Info Tests
 * Tests for executeScript, getElementInfo, getPageInfo, summarizePage, scroll executors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('executeScriptExecutor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should execute script successfully', async () => {
    const { executeScriptExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: { success: true, output: 'result' } }]),
      },
    });

    const result = await executeScriptExecutor.execute(
      { code: 'return 1 + 1' },
      { tabId: 123 }
    );

    expect(result.success).toBe(true);
  });

  it('should return error when code missing', async () => {
    const { executeScriptExecutor } = await import('../../../src/lib/agent/tool-executor');

    const result = await executeScriptExecutor.execute(
      {},
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Code is required');
  });

  it('should handle script failure', async () => {
    const { executeScriptExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: { success: false, error: 'Syntax error' } }]),
      },
    });

    const result = await executeScriptExecutor.execute(
      { code: 'invalid syntax' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
  });

  it('should handle execution error', async () => {
    const { executeScriptExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockRejectedValue(new Error('Execution failed')),
      },
    });

    const result = await executeScriptExecutor.execute(
      { code: 'throw new Error("test")' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Script execution failed');
  });
});

describe('getElementInfoExecutor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should get element info successfully', async () => {
    const { getElementInfoExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{
          result: {
            success: true,
            result: {
              tagName: 'DIV',
              id: 'test',
              visible: true,
            },
          },
        }]),
      },
    });

    const result = await getElementInfoExecutor.execute(
      { selector: '#test' },
      { tabId: 123 }
    );

    expect(result.success).toBe(true);
    expect(result.data?.tagName).toBe('DIV');
  });

  it('should return error when selector missing', async () => {
    const { getElementInfoExecutor } = await import('../../../src/lib/agent/tool-executor');

    const result = await getElementInfoExecutor.execute(
      {},
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Selector is required');
  });

  it('should handle script error', async () => {
    const { getElementInfoExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockRejectedValue(new Error('Script failed')),
      },
    });

    const result = await getElementInfoExecutor.execute(
      { selector: '#test' },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Get element info failed');
  });
});

describe('getPageInfoExecutor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return page info', async () => {
    const { getPageInfoExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{
          id: 123,
          url: 'https://example.com/page',
          title: 'Example Page',
          favIconUrl: 'https://example.com/favicon.ico',
          incognito: false,
        }]),
      },
    });

    const result = await getPageInfoExecutor.execute(
      {},
      { tabId: 123 }
    );

    expect(result.success).toBe(true);
    expect(result.data?.url).toBe('https://example.com/page');
    expect(result.data?.title).toBe('Example Page');
  });

  it('should return error when no active tab', async () => {
    const { getPageInfoExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await getPageInfoExecutor.execute(
      {},
      { tabId: undefined }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab');
  });

  it('should handle query error', async () => {
    const { getPageInfoExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockRejectedValue(new Error('Query failed')),
      },
    });

    const result = await getPageInfoExecutor.execute(
      {},
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Get page info failed');
  });
});

describe('summarizePageExecutor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should summarize page successfully', async () => {
    const { summarizePageExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{
          result: {
            success: true,
            data: {
              title: 'Test Page',
              url: 'https://example.com',
              totalLinks: 10,
              totalButtons: 5,
            },
          },
        }]),
      },
    });

    const result = await summarizePageExecutor.execute(
      {},
      { tabId: 123 }
    );

    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('Test Page');
  });

  it('should handle script error', async () => {
    const { summarizePageExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockRejectedValue(new Error('Script failed')),
      },
    });

    const result = await summarizePageExecutor.execute(
      {},
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Summarize page failed');
  });
});

describe('scrollExecutor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should scroll with y offset', async () => {
    const { scrollExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: { success: true } }]),
      },
    });

    const result = await scrollExecutor.execute(
      { y: 500 },
      { tabId: 123 }
    );

    expect(result.success).toBe(true);
    expect(result.toolName).toBe('scroll');
  });

  it('should return error when no active tab', async () => {
    const { scrollExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await scrollExecutor.execute(
      { y: 500 },
      { tabId: undefined }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab');
  });

  it('should handle scroll target not found', async () => {
    const { scrollExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{ result: { success: false, error: 'Scroll target not found' } }]),
      },
    });

    const result = await scrollExecutor.execute(
      { selector: '#nonexistent', y: 100 },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
  });

  it('should handle script error', async () => {
    const { scrollExecutor } = await import('../../../src/lib/agent/tool-executor');

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockRejectedValue(new Error('Script failed')),
      },
    });

    const result = await scrollExecutor.execute(
      { y: 500 },
      { tabId: 123 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Scroll failed');
  });
});
