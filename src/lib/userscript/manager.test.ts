/**
 * UserScript Manager Tests
 *
 * Tests for AutoMonkey integration - listing and installing user scripts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installUserScript } from './installer';
import { listUserScripts } from './manager';
import { AUTOMONKEY_EXTENSION_ID } from './constants';

// Mock chrome.runtime.sendMessage
const mockSendMessage = vi.fn();

describe('UserScript Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (chrome.runtime.sendMessage as any) = mockSendMessage;
  });

  describe('installUserScript', () => {
    it('should successfully install a user script', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        scriptId: 'userscript-123',
      });

      const result = await installUserScript('// ==UserScript==\n// @name Test Script\n// ==/UserScript==');

      expect(result.success).toBe(true);
      expect(result.scriptId).toBe('userscript-123');
      expect(mockSendMessage).toHaveBeenCalledWith(
        AUTOMONKEY_EXTENSION_ID,
        {
          action: 'open_install_dialog',
          code: '// ==UserScript==\n// @name Test Script\n// ==/UserScript==',
        }
      );
    });

    it('should return error when AutoMonkey returns failure', async () => {
      mockSendMessage.mockResolvedValue({
        success: false,
        error: 'Invalid script format',
      });

      const result = await installUserScript('invalid script code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid script format');
    });

    it('should return error when chrome.runtime.sendMessage throws', async () => {
      mockSendMessage.mockRejectedValue(new Error('Connection failed'));

      const result = await installUserScript('// ==UserScript==\n// @name Test\n// ==/UserScript==');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to communicate with AutoMonkey');
    });

    it('should return error for empty script code', async () => {
      const result = await installUserScript('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid script code');
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should return error for non-string script code', async () => {
      const result = await installUserScript(null as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid script code');
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('listUserScripts', () => {
    it('should successfully list installed scripts', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        scripts: [
          {
            id: 'script-1',
            name: 'Script One',
            enabled: true,
          },
          {
            id: 'script-2',
            name: 'Script Two',
            enabled: false,
          },
        ],
      });

      const result = await listUserScripts();

      expect(result.success).toBe(true);
      expect(result.scripts).toHaveLength(2);
      expect(result.scripts?.[0].name).toBe('Script One');
      expect(result.scripts?.[1].enabled).toBe(false);
    });

    it('should return empty array when no scripts installed', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        scripts: [],
      });

      const result = await listUserScripts();

      expect(result.success).toBe(true);
      expect(result.scripts).toEqual([]);
    });

    it('should return error when AutoMonkey returns failure', async () => {
      mockSendMessage.mockResolvedValue({
        success: false,
        error: 'Database access denied',
      });

      const result = await listUserScripts();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database access denied');
    });

    it('should return error when chrome.runtime.sendMessage throws', async () => {
      mockSendMessage.mockRejectedValue(new Error('AutoMonkey not found'));

      const result = await listUserScripts();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to communicate with AutoMonkey');
    });
  });
});
