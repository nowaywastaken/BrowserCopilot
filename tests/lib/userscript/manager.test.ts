/**
 * UserScript Manager Tests
 * Tests for user script management functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseScriptMetadata,
  validateScriptCode,
  listUserScripts,
  enableScript,
  disableScript,
  removeScript,
} from '../../../src/lib/userscript/manager';

// Mock chrome object with userScripts
const mockUserScripts = {
  getScripts: vi.fn(),
  update: vi.fn(),
  unregister: vi.fn(),
  register: vi.fn(),
};

// Set up global chrome mock
const originalChrome = globalThis.chrome;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('chrome', {
    userScripts: mockUserScripts,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalChrome) {
    vi.stubGlobal('chrome', originalChrome);
  }
});

describe('UserScript Manager', () => {
  describe('parseScriptMetadata', () => {
    it('should parse script name', () => {
      const code = `// ==UserScript==
// @name        Test Script
// ==/UserScript==`;
      const metadata = parseScriptMetadata(code);
      expect(metadata.name).toBe('Test Script');
    });

    it('should parse version', () => {
      const code = `// ==UserScript==
// @name        Test Script
// @version     1.0.0
// ==/UserScript==`;
      const metadata = parseScriptMetadata(code);
      expect(metadata.version).toBe('1.0.0');
    });

    it('should parse description', () => {
      const code = `// ==UserScript==
// @name        Test Script
// @description This is a test script
// ==/UserScript==`;
      const metadata = parseScriptMetadata(code);
      expect(metadata.description).toBe('This is a test script');
    });

    it('should parse match patterns', () => {
      const code = `// ==UserScript==
// @name        Test Script
// @match       *://*.example.com/*
// @match       https://test.com/*
// ==/UserScript==`;
      const metadata = parseScriptMetadata(code);
      expect(metadata.matchPatterns).toEqual(['*://*.example.com/*', 'https://test.com/*']);
    });

    it('should parse grants', () => {
      const code = `// ==UserScript==
// @name        Test Script
// @grant       GM_addStyle
// @grant       GM_setValue
// ==/UserScript==`;
      const metadata = parseScriptMetadata(code);
      expect(metadata.grants).toEqual(['GM_addStyle', 'GM_setValue']);
    });

    it('should handle script without header', () => {
      const code = `console.log('Hello');`;
      const metadata = parseScriptMetadata(code);
      expect(metadata.name).toBe('Unnamed Script');
    });
  });

  describe('validateScriptCode', () => {
    it('should validate correct script', () => {
      const code = `// ==UserScript==
// @name        Test Script
// @match       *://*.example.com/*
// ==/UserScript==

console.log('Hello');`;
      const result = validateScriptCode(code);
      expect(result.valid).toBe(true);
    });

    it('should reject empty code', () => {
      const result = validateScriptCode('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject code without header', () => {
      const code = `console.log('Hello');`;
      const result = validateScriptCode(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('UserScript header');
    });

    it('should reject code without name', () => {
      const code = `// ==UserScript==
// @match       *://*.example.com/*
// ==/UserScript==`;
      const result = validateScriptCode(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('@name');
    });

    it('should reject code without match pattern', () => {
      const code = `// ==UserScript==
// @name        Test Script
// ==/UserScript==`;
      const result = validateScriptCode(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('@match');
    });
  });

  describe('listUserScripts', () => {
    it('should return empty list when no scripts installed', async () => {
      mockUserScripts.getScripts.mockImplementation((callback) => {
        callback([]);
      });

      const result = await listUserScripts();
      expect(result.success).toBe(true);
      expect(result.scripts).toEqual([]);
    });

    it('should return list of installed scripts', async () => {
      mockUserScripts.getScripts.mockImplementation((callback) => {
        callback([
          { id: 'script1', name: 'Script 1' },
          { id: 'script2', name: 'Script 2' },
        ]);
      });

      const result = await listUserScripts();
      expect(result.success).toBe(true);
      expect(result.scripts).toHaveLength(2);
      expect(result.scripts?.[0].name).toBe('Script 1');
    });

    it('should handle error when getScripts throws', async () => {
      mockUserScripts.getScripts.mockImplementation(() => {
        throw new Error('Failed to get scripts');
      });

      const result = await listUserScripts();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get scripts');
      expect(result.scripts).toEqual([]);
    });

    it('should handle unknown error type', async () => {
      mockUserScripts.getScripts.mockImplementation(() => {
        throw 123; // Non-error type
      });

      const result = await listUserScripts();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to list scripts');
    });
  });

  describe('enableScript', () => {
    it('should enable a disabled script', async () => {
      mockUserScripts.update.mockImplementation((_options, callback) => {
        callback?.();
      });

      const result = await enableScript('script1');
      expect(result.success).toBe(true);
    });

    it('should handle errors', async () => {
      mockUserScripts.update.mockImplementation(() => {
        throw new Error('Update failed');
      });

      const result = await enableScript('script1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });

    it('should handle unknown error type', async () => {
      mockUserScripts.update.mockImplementation(() => {
        throw null; // Unknown error type
      });

      const result = await enableScript('script1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to enable script');
    });
  });

  describe('disableScript', () => {
    it('should disable an enabled script', async () => {
      mockUserScripts.update.mockImplementation((_options, callback) => {
        callback?.();
      });

      const result = await disableScript('script1');
      expect(result.success).toBe(true);
    });

    it('should handle errors', async () => {
      mockUserScripts.update.mockImplementation(() => {
        throw new Error('Update failed');
      });

      const result = await disableScript('script1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });

    it('should handle unknown error type', async () => {
      mockUserScripts.update.mockImplementation(() => {
        throw 'error'; // Unknown error type
      });

      const result = await disableScript('script1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to disable script');
    });
  });

  describe('removeScript', () => {
    it('should remove a script', async () => {
      mockUserScripts.unregister.mockImplementation((_options, callback) => {
        callback?.();
      });

      const result = await removeScript('script1');
      expect(result.success).toBe(true);
    });

    it('should handle errors', async () => {
      mockUserScripts.unregister.mockImplementation(() => {
        throw new Error('Remove failed');
      });

      const result = await removeScript('script1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Remove failed');
    });
  });
});
