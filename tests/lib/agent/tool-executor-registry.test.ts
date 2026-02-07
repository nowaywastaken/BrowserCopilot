/**
 * Tool Executor - Registry & Tool Definitions Tests
 * Tests for createToolRegistry and getToolDefinitions functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('createToolRegistry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should create registry with all tools', async () => {
    const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();

    // Should contain all 12 tools
    expect(registry.size).toBe(13);
  });

  it('should have captureScreenshot tool', async () => {
    const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const tool = registry.get('captureScreenshot');

    expect(tool).toBeDefined();
    expect(tool?.name).toBe('captureScreenshot');
    expect(typeof tool?.execute).toBe('function');
  });

  it('should have navigate tool', async () => {
    const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const tool = registry.get('navigate');

    expect(tool).toBeDefined();
    expect(tool?.name).toBe('navigate');
  });

  it('should have clickElement tool', async () => {
    const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const tool = registry.get('clickElement');

    expect(tool).toBeDefined();
    expect(tool?.name).toBe('clickElement');
  });

  it('should have fillForm tool', async () => {
    const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const tool = registry.get('fillForm');

    expect(tool).toBeDefined();
    expect(tool?.name).toBe('fillForm');
  });

  it('should have installUserScript tool', async () => {
    const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const tool = registry.get('installUserScript');

    expect(tool).toBeDefined();
    expect(tool?.name).toBe('installUserScript');
  });

  it('should have listUserScripts tool', async () => {
    const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const tool = registry.get('listUserScripts');

    expect(tool).toBeDefined();
    expect(tool?.name).toBe('listUserScripts');
  });

  it('should have all required tools for agent operations', async () => {
    const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const requiredTools = [
      'captureScreenshot',
      'captureDOM',
      'navigate',
      'clickElement',
      'fillForm',
      'executeScript',
      'getElementInfo',
      'getPageInfo',
      'summarizePage',
      'scroll',
    ];

    for (const toolName of requiredTools) {
      expect(registry.has(toolName), `Missing tool: ${toolName}`).toBe(true);
    }
  });
});

describe('getToolDefinitions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return array of tool definitions', async () => {
    const { createToolRegistry, getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const definitions = getToolDefinitions(registry);

    expect(Array.isArray(definitions)).toBe(true);
    expect(definitions.length).toBe(13);
  });

  it('should include name in each definition', async () => {
    const { createToolRegistry, getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const definitions = getToolDefinitions(registry);

    for (const def of definitions) {
      expect(def.name).toBeDefined();
      expect(typeof def.name).toBe('string');
    }
  });

  it('should include description in each definition', async () => {
    const { createToolRegistry, getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const definitions = getToolDefinitions(registry);

    for (const def of definitions) {
      expect(def.description).toBeDefined();
      expect(typeof def.description).toBe('string');
    }
  });

  it('should include parameters in each definition', async () => {
    const { createToolRegistry, getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const definitions = getToolDefinitions(registry);

    for (const def of definitions) {
      expect(def.parameters).toBeDefined();
      expect(typeof def.parameters).toBe('object');
    }
  });

  it('should have correct structure for navigate tool', async () => {
    const { createToolRegistry, getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const definitions = getToolDefinitions(registry);
    const navigateDef = definitions.find(d => d.name === 'navigate');

    expect(navigateDef).toBeDefined();
    expect(navigateDef?.parameters.properties.url).toBeDefined();
    expect(navigateDef?.parameters.required).toContain('url');
  });

  it('should have correct structure for clickElement tool', async () => {
    const { createToolRegistry, getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const definitions = getToolDefinitions(registry);
    const clickDef = definitions.find(d => d.name === 'clickElement');

    expect(clickDef).toBeDefined();
    expect(clickDef?.parameters.properties.selector).toBeDefined();
    expect(clickDef?.parameters.required).toContain('selector');
  });

  it('should have correct structure for fillForm tool', async () => {
    const { createToolRegistry, getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const definitions = getToolDefinitions(registry);
    const fillDef = definitions.find(d => d.name === 'fillForm');

    expect(fillDef).toBeDefined();
    expect(fillDef?.parameters.properties.selector).toBeDefined();
    expect(fillDef?.parameters.properties.value).toBeDefined();
    expect(fillDef?.parameters.required).toContain('selector');
    expect(fillDef?.parameters.required).toContain('value');
  });

  it('should have correct structure for scroll tool', async () => {
    const { createToolRegistry, getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

    const registry = createToolRegistry();
    const definitions = getToolDefinitions(registry);
    const scrollDef = definitions.find(d => d.name === 'scroll');

    expect(scrollDef).toBeDefined();
    expect(scrollDef?.parameters.properties.x).toBeDefined();
    expect(scrollDef?.parameters.properties.y).toBeDefined();
    expect(scrollDef?.parameters.properties.behavior).toBeDefined();
  });
});

describe('ALL_TOOLS', () => {
  it('should export all tool executors', async () => {
    const { ALL_TOOLS } = await import('../../../src/lib/agent/tool-executor');

    expect(Array.isArray(ALL_TOOLS)).toBe(true);
    expect(ALL_TOOLS.length).toBe(13);
  });

  it('should have unique tool names', async () => {
    const { ALL_TOOLS } = await import('../../../src/lib/agent/tool-executor');

    const names = ALL_TOOLS.map(t => t.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);
  });
});
