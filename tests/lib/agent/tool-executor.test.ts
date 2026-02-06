/**
 * Tool Executor Tests
 * Tests for the tool executor interface and registry
 */

import { describe, it, expect } from 'vitest';
import {
  createToolRegistry,
  getToolDefinitions,
  captureScreenshotExecutor,
  captureDOMExecutor,
  capturePageAnalysisExecutor,
  getElementInfoExecutor,
  executeScriptExecutor,
  getPageInfoExecutor,
  installUserScriptExecutor,
  listUserScriptsExecutor,
  navigateExecutor,
  clickElementExecutor,
  fillFormExecutor,
  scrollExecutor,
  summarizePageExecutor,
} from '../../../src/lib/agent/tool-executor';

describe('Tool Executor Interface', () => {
  describe('createToolRegistry', () => {
    it('should create a registry with all 13 tools', () => {
      const registry = createToolRegistry();

      expect(registry.size).toBe(13);
    });

    it('should have all expected tool names', () => {
      const registry = createToolRegistry();

      expect(registry.has('captureScreenshot')).toBe(true);
      expect(registry.has('captureDOM')).toBe(true);
      expect(registry.has('capturePageAnalysis')).toBe(true);
      expect(registry.has('getElementInfo')).toBe(true);
      expect(registry.has('executeScript')).toBe(true);
      expect(registry.has('getPageInfo')).toBe(true);
      expect(registry.has('installUserScript')).toBe(true);
      expect(registry.has('listUserScripts')).toBe(true);
      expect(registry.has('navigate')).toBe(true);
      expect(registry.has('clickElement')).toBe(true);
      expect(registry.has('fillForm')).toBe(true);
      expect(registry.has('scroll')).toBe(true);
      expect(registry.has('summarizePage')).toBe(true);
    });
  });

  describe('getToolDefinitions', () => {
    it('should return tool definitions for all registered tools', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);

      expect(definitions.length).toBe(13);
    });

    it('should return correct tool names in definitions', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const names = definitions.map((d) => d.name);

      expect(names).toContain('captureScreenshot');
      expect(names).toContain('captureDOM');
      expect(names).toContain('capturePageAnalysis');
      expect(names).toContain('getElementInfo');
      expect(names).toContain('executeScript');
      expect(names).toContain('getPageInfo');
      expect(names).toContain('installUserScript');
      expect(names).toContain('listUserScripts');
      expect(names).toContain('navigate');
      expect(names).toContain('clickElement');
      expect(names).toContain('fillForm');
      expect(names).toContain('scroll');
      expect(names).toContain('summarizePage');
    });
  });

  describe('Tool Definitions', () => {
    it('captureScreenshot should have correct parameters', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'captureScreenshot');

      expect(tool).toBeDefined();
      expect(tool?.parameters.type).toBe('object');
      expect(tool?.parameters.required).toContain('quality');
      expect((tool?.parameters.properties.quality as { enum?: string[] })?.enum).toEqual(['low', 'medium', 'high']);
      expect((tool?.parameters.properties.returnToUser as { type?: string })?.type).toBe('boolean');
    });

    it('captureDOM should have optional parameters', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'captureDOM');

      expect(tool).toBeDefined();
      expect(tool?.parameters.type).toBe('object');
      expect(tool?.parameters.required).toBeUndefined();
      expect((tool?.parameters.properties.selector as { type?: string })?.type).toBe('string');
      expect((tool?.parameters.properties.includeAttributes as { type?: string })?.type).toBe('boolean');
      expect((tool?.parameters.properties.maxDepth as { type?: string })?.type).toBe('number');
    });

    it('capturePageAnalysis should have optional quality and depth parameters', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'capturePageAnalysis');

      expect(tool).toBeDefined();
      expect(tool?.parameters.type).toBe('object');
      expect((tool?.parameters.properties.screenshotQuality as { enum?: string[] })?.enum).toEqual(['low', 'medium', 'high']);
      expect((tool?.parameters.properties.domMaxDepth as { type?: string })?.type).toBe('number');
    });

    it('getElementInfo should require selector parameter', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'getElementInfo');

      expect(tool).toBeDefined();
      expect(tool?.parameters.required).toContain('selector');
      expect((tool?.parameters.properties.selector as { type?: string })?.type).toBe('string');
    });

    it('executeScript should require code parameter', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'executeScript');

      expect(tool).toBeDefined();
      expect(tool?.parameters.required).toContain('code');
      expect((tool?.parameters.properties.code as { type?: string })?.type).toBe('string');
    });

    it('getPageInfo should have no parameters', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'getPageInfo');

      expect(tool).toBeDefined();
      expect(tool?.parameters.type).toBe('object');
      expect(Object.keys(tool?.parameters.properties || {})).toHaveLength(0);
    });

    it('installUserScript should require code parameter', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'installUserScript');

      expect(tool).toBeDefined();
      expect(tool?.parameters.required).toContain('code');
      expect((tool?.parameters.properties.code as { type?: string })?.type).toBe('string');
    });

    it('listUserScripts should have no parameters', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'listUserScripts');

      expect(tool).toBeDefined();
      expect(tool?.parameters.type).toBe('object');
      expect(Object.keys(tool?.parameters.properties || {})).toHaveLength(0);
    });

    it('navigate should require url parameter', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'navigate');

      expect(tool).toBeDefined();
      expect(tool?.parameters.required).toContain('url');
      expect((tool?.parameters.properties.url as { type?: string })?.type).toBe('string');
    });

    it('clickElement should require selector parameter', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'clickElement');

      expect(tool).toBeDefined();
      expect(tool?.parameters.required).toContain('selector');
    });

    it('fillForm should require selector and value parameters', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'fillForm');

      expect(tool).toBeDefined();
      expect(tool?.parameters.required).toContain('selector');
      expect(tool?.parameters.required).toContain('value');
    });

    it('scroll should have optional parameters', () => {
      const registry = createToolRegistry();
      const definitions = getToolDefinitions(registry);
      const tool = definitions.find((d) => d.name === 'scroll');

      expect(tool).toBeDefined();
      expect(tool?.parameters.type).toBe('object');
      expect((tool?.parameters.properties.selector as { type?: string })?.type).toBe('string');
      expect((tool?.parameters.properties.x as { type?: string })?.type).toBe('number');
      expect((tool?.parameters.properties.y as { type?: string })?.type).toBe('number');
    });
  });

  describe('Tool Executors', () => {
    it('captureScreenshot executor should have correct metadata', () => {
      expect(captureScreenshotExecutor.name).toBe('captureScreenshot');
      expect(captureScreenshotExecutor.description).toBeDefined();
      expect(captureScreenshotExecutor.parameters.type).toBe('object');
    });

    it('captureDOM executor should have correct metadata', () => {
      expect(captureDOMExecutor.name).toBe('captureDOM');
      expect(captureDOMExecutor.description).toBeDefined();
      expect(captureDOMExecutor.parameters.type).toBe('object');
    });

    it('capturePageAnalysis executor should have correct metadata', () => {
      expect(capturePageAnalysisExecutor.name).toBe('capturePageAnalysis');
      expect(capturePageAnalysisExecutor.description).toBeDefined();
      expect(capturePageAnalysisExecutor.parameters.type).toBe('object');
    });

    it('getElementInfo executor should have correct metadata', () => {
      expect(getElementInfoExecutor.name).toBe('getElementInfo');
      expect(getElementInfoExecutor.description).toBeDefined();
      expect(getElementInfoExecutor.parameters.required).toContain('selector');
    });

    it('executeScript executor should have correct metadata', () => {
      expect(executeScriptExecutor.name).toBe('executeScript');
      expect(executeScriptExecutor.description).toBeDefined();
      expect(executeScriptExecutor.parameters.required).toContain('code');
    });

    it('getPageInfo executor should have correct metadata', () => {
      expect(getPageInfoExecutor.name).toBe('getPageInfo');
      expect(getPageInfoExecutor.description).toBeDefined();
    });

    it('installUserScript executor should have correct metadata', () => {
      expect(installUserScriptExecutor.name).toBe('installUserScript');
      expect(installUserScriptExecutor.description).toBeDefined();
      expect(installUserScriptExecutor.parameters.required).toContain('code');
    });

    it('listUserScripts executor should have correct metadata', () => {
      expect(listUserScriptsExecutor.name).toBe('listUserScripts');
      expect(listUserScriptsExecutor.description).toBeDefined();
    });

    it('navigate executor should have correct metadata', () => {
      expect(navigateExecutor.name).toBe('navigate');
      expect(navigateExecutor.description).toBeDefined();
      expect(navigateExecutor.parameters.required).toContain('url');
    });

    it('clickElement executor should have correct metadata', () => {
      expect(clickElementExecutor.name).toBe('clickElement');
      expect(clickElementExecutor.description).toBeDefined();
      expect(clickElementExecutor.parameters.required).toContain('selector');
    });

    it('fillForm executor should have correct metadata', () => {
      expect(fillFormExecutor.name).toBe('fillForm');
      expect(fillFormExecutor.description).toBeDefined();
      expect(fillFormExecutor.parameters.required).toContain('selector');
      expect(fillFormExecutor.parameters.required).toContain('value');
    });

    it('scroll executor should have correct metadata', () => {
      expect(scrollExecutor.name).toBe('scroll');
      expect(scrollExecutor.description).toBeDefined();
    });

    it('summarizePage executor should have correct metadata', () => {
      expect(summarizePageExecutor.name).toBe('summarizePage');
      expect(summarizePageExecutor.description).toBeDefined();
      expect(summarizePageExecutor.parameters.type).toBe('object');
    });
  });
});
