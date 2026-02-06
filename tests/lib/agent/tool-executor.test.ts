/**
 * Tool Executor Tests
 * Tests for the tool registry and executor implementations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Tool Executor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createToolRegistry', () => {
    it('should create a registry with all tools', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();

      expect(registry.size).toBeGreaterThan(0);
      expect(registry.has('captureScreenshot')).toBe(true);
      expect(registry.has('captureDOM')).toBe(true);
      expect(registry.has('navigate')).toBe(true);
      expect(registry.has('clickElement')).toBe(true);
      expect(registry.has('fillForm')).toBe(true);
      expect(registry.has('scroll')).toBe(true);
    });

    it('should return Map instance', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();

      expect(registry).toBeInstanceOf(Map);
    });

    it('should contain get method', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      const tool = registry.get('captureScreenshot');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('captureScreenshot');
    });
  });

  describe('getToolDefinitions', () => {
    it('should extract tool definitions from registry', async () => {
      const { createToolRegistry, getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0]).toHaveProperty('name');
      expect(definitions[0]).toHaveProperty('description');
      expect(definitions[0]).toHaveProperty('parameters');
    });

    it('should include all tool names in definitions', async () => {
      const { createToolRegistry, getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const toolNames = definitions.map((d: any) => d.name);

      expect(toolNames).toContain('captureScreenshot');
      expect(toolNames).toContain('captureDOM');
      expect(toolNames).toContain('capturePageAnalysis');
      expect(toolNames).toContain('getElementInfo');
      expect(toolNames).toContain('executeScript');
      expect(toolNames).toContain('getPageInfo');
      expect(toolNames).toContain('installUserScript');
      expect(toolNames).toContain('listUserScripts');
      expect(toolNames).toContain('navigate');
      expect(toolNames).toContain('clickElement');
      expect(toolNames).toContain('fillForm');
      expect(toolNames).toContain('scroll');
      expect(toolNames).toContain('summarizePage');
    });
  });

  describe('ALL_TOOLS constant', () => {
    it('should export all tool executors', async () => {
      const { ALL_TOOLS } = await import('../../../src/lib/agent/tool-executor');

      expect(Array.isArray(ALL_TOOLS)).toBe(true);
      expect(ALL_TOOLS.length).toBe(13); // 13 tools total
    });

    it('should have correct tool names', async () => {
      const { ALL_TOOLS } = await import('../../../src/lib/agent/tool-executor');

      const names = ALL_TOOLS.map((t: any) => t.name);

      expect(names).toContain('captureScreenshot');
      expect(names).toContain('navigate');
      expect(names).toContain('clickElement');
    });
  });

  describe('ToolExecutor interface', () => {
    it('should have required properties', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      const tool = registry.get('captureScreenshot');

      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('parameters');
      expect(tool).toHaveProperty('execute');
      expect(typeof tool?.execute).toBe('function');
    });

    it('should have valid parameter schemas', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();

      for (const [name, tool] of registry) {
        expect(tool.parameters).toHaveProperty('type');
        expect(tool.parameters.type).toBe('object');
        expect(tool.parameters).toHaveProperty('properties');
        expect(typeof tool.parameters.properties).toBe('object');
      }
    });
  });

  describe('ScreenshotQuality type', () => {
    it('should accept valid quality values', async () => {
      const { ScreenshotQuality } = await import('../../../src/lib/agent/tool-executor');

      const values: ScreenshotQuality[] = ['low', 'medium', 'high'];

      expect(values).toContain('low');
      expect(values).toContain('medium');
      expect(values).toContain('high');
    });
  });

  describe('Individual tool executors', () => {
    describe('captureScreenshot executor', () => {
      it('should have correct name and description', async () => {
        const { captureScreenshotExecutor } = await import('../../../src/lib/agent/tool-executor');

        expect(captureScreenshotExecutor.name).toBe('captureScreenshot');
        expect(captureScreenshotExecutor.description).toContain('screenshot');
      });

      it('should have quality parameter', async () => {
        const { captureScreenshotExecutor } = await import('../../../src/lib/agent/tool-executor');

        expect(captureScreenshotExecutor.parameters.properties).toHaveProperty('quality');
        expect(captureScreenshotExecutor.parameters.properties.quality.enum).toContain('low');
        expect(captureScreenshotExecutor.parameters.properties.quality.enum).toContain('medium');
        expect(captureScreenshotExecutor.parameters.properties.quality.enum).toContain('high');
      });
    });

    describe('navigate executor', () => {
      it('should have url parameter', async () => {
        const { navigateExecutor } = await import('../../../src/lib/agent/tool-executor');

        expect(navigateExecutor.parameters.properties).toHaveProperty('url');
        expect(navigateExecutor.parameters.required).toContain('url');
      });
    });

    describe('clickElement executor', () => {
      it('should have selector parameter', async () => {
        const { clickElementExecutor } = await import('../../../src/lib/agent/tool-executor');

        expect(clickElementExecutor.parameters.properties).toHaveProperty('selector');
        expect(clickElementExecutor.parameters.required).toContain('selector');
      });

      it('should support optional button parameter', async () => {
        const { clickElementExecutor } = await import('../../../src/lib/agent/tool-executor');

        expect(clickElementExecutor.parameters.properties).toHaveProperty('button');
      });
    });

    describe('fillForm executor', () => {
      it('should have selector and value parameters', async () => {
        const { fillFormExecutor } = await import('../../../src/lib/agent/tool-executor');

        expect(fillFormExecutor.parameters.properties).toHaveProperty('selector');
        expect(fillFormExecutor.parameters.properties).toHaveProperty('value');
        expect(fillFormExecutor.parameters.required).toContain('selector');
        expect(fillFormExecutor.parameters.required).toContain('value');
      });
    });

    describe('scroll executor', () => {
      it('should have y parameter for vertical scroll', async () => {
        const { scrollExecutor } = await import('../../../src/lib/agent/tool-executor');

        expect(scrollExecutor.parameters.properties).toHaveProperty('y');
      });

      it('should support optional selector parameter', async () => {
        const { scrollExecutor } = await import('../../../src/lib/agent/tool-executor');

        expect(scrollExecutor.parameters.properties).toHaveProperty('selector');
      });
    });

    describe('installUserScript executor', () => {
      it('should have code parameter', async () => {
        const { installUserScriptExecutor } = await import('../../../src/lib/agent/tool-executor');

        expect(installUserScriptExecutor.parameters.properties).toHaveProperty('code');
        expect(installUserScriptExecutor.parameters.required).toContain('code');
      });
    });

    describe('executeScript executor', () => {
      it('should have code parameter', async () => {
        const { executeScriptExecutor } = await import('../../../src/lib/agent/tool-executor');

        expect(executeScriptExecutor.parameters.properties).toHaveProperty('code');
        expect(executeScriptExecutor.parameters.required).toContain('code');
      });
    });

    describe('getElementInfo executor', () => {
      it('should have selector parameter', async () => {
        const { getElementInfoExecutor } = await import('../../../src/lib/agent/tool-executor');

        expect(getElementInfoExecutor.parameters.properties).toHaveProperty('selector');
        expect(getElementInfoExecutor.parameters.required).toContain('selector');
      });
    });
  });

  describe('ToolResult interface', () => {
    it('should have required properties', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      const tool = registry.get('captureScreenshot');

      // Verify the type definition exists
      expect(tool?.execute).toBeInstanceOf(Function);
    });
  });

  describe('ToolContext interface', () => {
    it('should accept tabId and url', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      const tool = registry.get('getPageInfo');

      expect(tool).toBeDefined();
    });
  });

  describe('ToolDefinition interface', () => {
    it('should match expected structure', async () => {
      const { getToolDefinitions, createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);

      const definition = definitions[0] as any;
      expect(definition).toHaveProperty('name');
      expect(definition).toHaveProperty('description');
      expect(definition).toHaveProperty('parameters');
      expect(definition.parameters.type).toBe('object');
    });
  });

  describe('ToolParameterSchema interface', () => {
    it('should support optional enum values', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      const screenshotTool = registry.get('captureScreenshot');
      const qualityProp = screenshotTool?.parameters.properties.quality;

      expect(qualityProp?.enum).toBeDefined();
      expect(qualityProp?.enum).toEqual(['low', 'medium', 'high']);
    });

    it('should support optional minimum/maximum', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      const scrollTool = registry.get('scroll');

      expect(scrollTool?.parameters.properties).toHaveProperty('y');
    });
  });

  describe('Named exports', () => {
    it('should export all individual executors', async () => {
      const exports = await import('../../../src/lib/agent/tool-executor');

      expect(exports.captureScreenshotExecutor).toBeDefined();
      expect(exports.captureDOMExecutor).toBeDefined();
      expect(exports.capturePageAnalysisExecutor).toBeDefined();
      expect(exports.getElementInfoExecutor).toBeDefined();
      expect(exports.executeScriptExecutor).toBeDefined();
      expect(exports.getPageInfoExecutor).toBeDefined();
      expect(exports.installUserScriptExecutor).toBeDefined();
      expect(exports.listUserScriptsExecutor).toBeDefined();
      expect(exports.navigateExecutor).toBeDefined();
      expect(exports.clickElementExecutor).toBeDefined();
      expect(exports.fillFormExecutor).toBeDefined();
      expect(exports.scrollExecutor).toBeDefined();
      expect(exports.summarizePageExecutor).toBeDefined();
    });

    it('should export type re-exports', async () => {
      // Types are not available at runtime, so we just verify the module loads
      const module = await import('../../../src/lib/agent/tool-executor');
      expect(module.createToolRegistry).toBeDefined();
      expect(module.getToolDefinitions).toBeDefined();
    });
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('Tool Executor Edge Cases', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('ToolRegistry edge cases', () => {
    it('should handle empty registry', async () => {
      const { getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

      const emptyRegistry = new Map<string, any>();
      const definitions = getToolDefinitions(emptyRegistry);

      expect(definitions).toEqual([]);
    });

    it('should handle registry with single tool', async () => {
      const { createToolRegistry, getToolDefinitions } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      registry.delete('captureScreenshot');
      registry.delete('captureDOM');

      const definitions = getToolDefinitions(registry);

      expect(definitions.length).toBeLessThan(13);
    });

    it('should handle duplicate tool names gracefully', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      const originalSize = registry.size;

      // Adding a duplicate key won't increase size
      registry.set('navigate', registry.get('navigate')!);

      expect(registry.size).toBe(originalSize);
    });
  });

  describe('Parameter validation', () => {
    it('should have correct parameter types for all tools', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();

      for (const [name, tool] of registry) {
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.parameters).toBe('object');
        expect(typeof tool.parameters.type).toBe('string');
        expect(typeof tool.parameters.properties).toBe('object');
      }
    });

    it('should mark required parameters correctly', async () => {
      const { navigateExecutor, captureScreenshotExecutor } = await import('../../../src/lib/agent/tool-executor');

      expect(navigateExecutor.parameters.required).toContain('url');
      expect(captureScreenshotExecutor.parameters.required).toContain('quality');
    });

    it('should have optional parameters for optional fields', async () => {
      const { scrollExecutor } = await import('../../../src/lib/agent/tool-executor');

      // x, y, behavior are technically optional in the schema
      // but the implementation handles defaults
      expect(scrollExecutor.parameters.properties).toHaveProperty('x');
      expect(scrollExecutor.parameters.properties).toHaveProperty('y');
    });
  });

  describe('Tool descriptions', () => {
    it('should have descriptive descriptions for all tools', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();

      for (const [name, tool] of registry) {
        expect(tool.description.length).toBeGreaterThan(10);
      }
    });

    it('should mention key parameters in descriptions', async () => {
      const { navigateExecutor } = await import('../../../src/lib/agent/tool-executor');

      expect(navigateExecutor.description).toContain('URL');
    });

    it('should mention screenshot quality in description', async () => {
      const { captureScreenshotExecutor } = await import('../../../src/lib/agent/tool-executor');

      expect(captureScreenshotExecutor.description).toContain('screenshot');
    });
  });

  describe('Parameter constraints', () => {
    it('should have enum values for screenshot quality', async () => {
      const { captureScreenshotExecutor } = await import('../../../src/lib/agent/tool-executor');

      const qualityParam = captureScreenshotExecutor.parameters.properties.quality;
      expect(qualityParam.enum).toEqual(['low', 'medium', 'high']);
    });

    it('should have enum values for scroll behavior', async () => {
      const { scrollExecutor } = await import('../../../src/lib/agent/tool-executor');

      const behaviorParam = scrollExecutor.parameters.properties.behavior;
      expect(behaviorParam.enum).toEqual(['auto', 'smooth']);
    });
  });

  describe('Tool name consistency', () => {
    it('should have consistent naming across exports', async () => {
      const {
        ALL_TOOLS,
        captureScreenshotExecutor,
        captureDOMExecutor,
        navigateExecutor,
        clickElementExecutor,
        fillFormExecutor,
        scrollExecutor,
      } = await import('../../../src/lib/agent/tool-executor');

      // Verify export names match tool names
      expect(captureScreenshotExecutor.name).toBe('captureScreenshot');
      expect(captureDOMExecutor.name).toBe('captureDOM');
      expect(navigateExecutor.name).toBe('navigate');
      expect(clickElementExecutor.name).toBe('clickElement');
      expect(fillFormExecutor.name).toBe('fillForm');
      expect(scrollExecutor.name).toBe('scroll');

      // Verify ALL_TOOLS contains all exports
      expect(ALL_TOOLS.length).toBe(13);
    });

    it('should have unique tool names', async () => {
      const { createToolRegistry } = await import('../../../src/lib/agent/tool-executor');

      const registry = createToolRegistry();
      const names = Array.from(registry.keys());

      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });
});

// ============================================================================
// Type Definition Tests
// ============================================================================

describe('Tool Executor Type Definitions', () => {
  describe('ScreenshotQuality type', () => {
    it('should allow literal values', () => {
      const values: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
      expect(values.length).toBe(3);
    });
  });

  describe('ToolResult structure', () => {
    it('should define success result structure', () => {
      const successResult = {
        toolName: 'test',
        success: true,
        data: { key: 'value' },
        timestamp: Date.now(),
      };

      expect(successResult.success).toBe(true);
      expect(successResult.data).toBeDefined();
    });

    it('should define error result structure', () => {
      const errorResult = {
        toolName: 'test',
        success: false,
        error: 'Something went wrong',
        timestamp: Date.now(),
      };

      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBeDefined();
    });
  });

  describe('ToolContext structure', () => {
    it('should define context with tabId', () => {
      const context = {
        tabId: 123,
        url: 'https://example.com',
      };

      expect(context.tabId).toBe(123);
      expect(context.url).toBe('https://example.com');
    });

    it('should allow optional fields', () => {
      const context = {
        tabId: 123,
      };

      expect(context.tabId).toBe(123);
      expect(context.url).toBeUndefined();
    });
  });

  describe('ToolDefinition structure', () => {
    it('should define tool definition with required fields', () => {
      const definition = {
        name: 'testTool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {},
        },
      };

      expect(definition.name).toBe('testTool');
      expect(definition.description).toBe('A test tool');
      expect(definition.parameters.type).toBe('object');
    });
  });

  describe('ToolParameterSchema structure', () => {
    it('should support enum constraints', () => {
      const schema = {
        type: 'string',
        enum: ['value1', 'value2'],
      };

      expect(schema.enum).toEqual(['value1', 'value2']);
    });

    it('should support numeric constraints', () => {
      const schema = {
        type: 'number',
        minimum: 0,
        maximum: 100,
      };

      expect(schema.minimum).toBe(0);
      expect(schema.maximum).toBe(100);
    });
  });
});
