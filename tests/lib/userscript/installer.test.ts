/**
 * UserScript Installer Tests
 * Tests for Tampermonkey script installation module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('UserScript Installer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createScriptTemplate', () => {
    it('should create valid UserScript template with required headers', async () => {
      const { createScriptTemplate } = await import('../../../src/lib/userscript/installer');

      const template = createScriptTemplate(
        'Test Script',
        'A test script description',
        'https://example.com/*'
      );

      expect(template).toContain('// ==UserScript==');
      expect(template).toContain('// @name        Test Script');
      expect(template).toContain('// @namespace   http://tampermonkey.net/');
      expect(template).toContain('// @version     1.0');
      expect(template).toContain('// @description');
      expect(template).toContain('// @match       https://example.com/*');
      expect(template).toContain('// @grant       none');
      expect(template).toContain('// @run-at      document-idle');
      expect(template).toContain('// ==/UserScript==');
      expect(template).toContain("(function() {");
      expect(template).toContain("'use strict';");
      expect(template).toContain("})();");
    });

    it('should use default match pattern when not provided', async () => {
      const { createScriptTemplate } = await import('../../../src/lib/userscript/installer');

      const template = createScriptTemplate('Test Script', 'Description');

      expect(template).toContain('// @match       *://*.example.com/*');
    });

    it('should escape special characters in name', async () => {
      const { createScriptTemplate } = await import('../../../src/lib/userscript/installer');

      const template = createScriptTemplate('Test <>&"\' Script', 'Description');

      expect(template).toContain('// @name        Test <>&"\' Script');
    });
  });

  describe('installUserScript', () => {
    it('should return error for invalid script code', async () => {
      const { installUserScript } = await import('../../../src/lib/userscript/installer');

      const result = await installUserScript({
        code: 'invalid code without headers',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should successfully install valid script', async () => {
      const { installUserScript } = await import('../../../src/lib/userscript/installer');

      const validScript = `// ==UserScript==
// @name         Test Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Test
// @match        https://example.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  console.log('test');
})();
`;

      const mockScripts = [{ id: 'test-id-123', name: 'Test Script' }];
      const mockChrome = {
        userScripts: {
          register: vi.fn((scripts, callback) => {
            setTimeout(callback, 0);
          }),
          getScripts: vi.fn((callback) => {
            callback(mockScripts);
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await installUserScript({
        code: validScript,
      });

      expect(result.success).toBe(true);
      expect(result.scriptId).toBe('test-id-123');
    });

    it('should use provided match patterns over metadata', async () => {
      const { installUserScript } = await import('../../../src/lib/userscript/installer');

      const validScript = `// ==UserScript==
// @name         Test Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Test
// @match        https://wrong.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
})();
`;

      const registeredMatches: string[] = [];

      const mockChrome = {
        userScripts: {
          register: vi.fn((scripts, callback) => {
            registeredMatches.push(...(scripts.matches || []));
            setTimeout(callback, 0);
          }),
          getScripts: vi.fn((callback) => {
            callback([{ id: 'test-id', name: 'Test Script' }]);
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      await installUserScript({
        code: validScript,
        matches: ['https://correct.com/*'],
      });

      expect(registeredMatches).toContain('https://correct.com/*');
      expect(registeredMatches).not.toContain('https://wrong.com/*');
    });

    it('should use provided runAt over metadata', async () => {
      const { installUserScript } = await import('../../../src/lib/userscript/installer');

      const validScript = `// ==UserScript==
// @name         Test Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Test
// @match        https://example.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
})();
`;

      let registeredRunAt = '';

      const mockChrome = {
        userScripts: {
          register: vi.fn((scripts, callback) => {
            registeredRunAt = scripts.runAt;
            setTimeout(callback, 0);
          }),
          getScripts: vi.fn((callback) => {
            callback([{ id: 'test-id', name: 'Test Script' }]);
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      await installUserScript({
        code: validScript,
        runAt: 'document-end',
      });

      expect(registeredRunAt).toBe('document-end');
    });

    it('should handle chrome.userScripts.register throwing error', async () => {
      const { installUserScript } = await import('../../../src/lib/userscript/installer');

      const validScript = `// ==UserScript==
// @name         Error Test
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Error test
// @match        https://example.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
})();
`;

      const mockChrome = {
        userScripts: {
          register: vi.fn((_scripts, _callback) => {
            throw new Error('Registration failed');
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await installUserScript({
        code: validScript,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
    });

    it('should handle non-Error thrown during registration', async () => {
      const { installUserScript } = await import('../../../src/lib/userscript/installer');

      const validScript = `// ==UserScript==
// @name         Non-Error Test
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Non-error test
// @match        https://example.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
})();
`;

      const mockChrome = {
        userScripts: {
          register: vi.fn((_scripts, _callback) => {
            throw 123;
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await installUserScript({
        code: validScript,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to install script');
    });
  });

  describe('updateUserScript', () => {
    it('should successfully update existing script', async () => {
      const { updateUserScript } = await import('../../../src/lib/userscript/installer');

      const mockChrome = {
        userScripts: {
          update: vi.fn((options, callback) => {
            setTimeout(callback, 0);
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await updateUserScript('script-123', {
        code: 'updated code',
      });

      expect(result.success).toBe(true);
      expect(result.scriptId).toBe('script-123');
    });

    it('should handle update error when chrome.userScripts.update throws', async () => {
      const { updateUserScript } = await import('../../../src/lib/userscript/installer');

      const mockChrome = {
        userScripts: {
          update: vi.fn((_options, _callback) => {
            throw new Error('Update failed');
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await updateUserScript('script-123', {
        code: 'updated code',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });

    it('should handle non-Error thrown in update', async () => {
      const { updateUserScript } = await import('../../../src/lib/userscript/installer');

      const mockChrome = {
        userScripts: {
          update: vi.fn((_options, _callback) => {
            throw 'Unknown error';
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await updateUserScript('script-123', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update script');
    });

    it('should only update specified options', async () => {
      const { updateUserScript } = await import('../../../src/lib/userscript/installer');

      const updatedOptions: Record<string, unknown> = {};

      const mockChrome = {
        userScripts: {
          update: vi.fn((options, callback) => {
            Object.assign(updatedOptions, options);
            setTimeout(callback, 0);
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      await updateUserScript('script-123', {
        matches: ['https://new.com/*'],
      });

      expect(updatedOptions.ids).toEqual(['script-123']);
      expect(updatedOptions.matches).toEqual(['https://new.com/*']);
      expect(updatedOptions.code).toBeUndefined();
    });
  });

  describe('quickInstall', () => {
    it('should install script with default options', async () => {
      const { quickInstall } = await import('../../../src/lib/userscript/installer');

      const validScript = `// ==UserScript==
// @name         Quick Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Quick install test
// @match        https://example.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
})();
`;

      let registeredMatches: string[] = [];
      let registeredRunAt = '';

      const mockChrome = {
        userScripts: {
          register: vi.fn((scripts, callback) => {
            registeredMatches = scripts.matches || [];
            registeredRunAt = scripts.runAt || '';
            setTimeout(callback, 0);
          }),
          getScripts: vi.fn((callback) => {
            callback([{ id: 'quick-id', name: 'Quick Script' }]);
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await quickInstall(validScript);

      expect(result.success).toBe(true);
      expect(registeredMatches).toContain('<all_urls>');
      expect(registeredRunAt).toBe('document-idle');
    });
  });

  describe('InstallOptions interface', () => {
    it('should accept valid install options', async () => {
      const { installUserScript } = await import('../../../src/lib/userscript/installer');

      const validScript = `// ==UserScript==
// @name         Options Test
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Options test
// @match        https://example.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
})();
`;

      const mockChrome = {
        userScripts: {
          register: vi.fn((_scripts, callback) => setTimeout(callback, 0)),
          getScripts: vi.fn((callback) => {
            callback([{ id: 'options-id', name: 'Options Test' }]);
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await installUserScript({
        code: validScript,
        matches: ['https://*.google.com/*'],
        runAt: 'document-start',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('InstallResult interface', () => {
    it('should return success result with script info', async () => {
      const { installUserScript } = await import('../../../src/lib/userscript/installer');

      const validScript = `// ==UserScript==
// @name         Result Test
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Result test
// @match        https://example.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
})();
`;

      const mockChrome = {
        userScripts: {
          register: vi.fn((_scripts, callback) => setTimeout(callback, 0)),
          getScripts: vi.fn((callback) => {
            callback([{ id: 'result-id', name: 'Result Test' }]);
          }),
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await installUserScript({
        code: validScript,
      });

      expect(result.success).toBe(true);
      expect(result.scriptId).toBe('result-id');
      expect(result.error).toBeUndefined();
    });

    it('should return error result on failure', async () => {
      const { installUserScript } = await import('../../../src/lib/userscript/installer');

      const result = await installUserScript({
        code: 'no headers',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.scriptId).toBeUndefined();
    });
  });
});
