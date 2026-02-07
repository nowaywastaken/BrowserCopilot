/**
 * ProviderStore Tests
 * Tests for the ProviderStore class - Chrome Storage API wrapper
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ProviderApiKeys, ProviderId } from '@/lib/types/provider';

describe('ProviderStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getApiKeys', () => {
    it('should return empty object when no keys stored', async () => {
      const mockChrome = {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}),
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      const result = await ProviderStore.getApiKeys();

      expect(result).toEqual({});
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith('provider_api_keys');
    });

    it('should return stored API keys', async () => {
      const storedKeys: ProviderApiKeys = {
        openai: 'sk-test-key-123',
        anthropic: 'sk-ant-test-456',
      };

      const mockChrome = {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({ provider_api_keys: storedKeys }),
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      const result = await ProviderStore.getApiKeys();

      expect(result).toEqual(storedKeys);
      expect(result.openai).toBe('sk-test-key-123');
      expect(result.anthropic).toBe('sk-ant-test-456');
    });
  });

  describe('getApiKey', () => {
    it('should return undefined for missing provider', async () => {
      const mockChrome = {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({ provider_api_keys: {} }),
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      const result = await ProviderStore.getApiKey('openrouter' as ProviderId);

      expect(result).toBeUndefined();
    });

    it('should return API key for specific provider', async () => {
      const storedKeys: ProviderApiKeys = {
        openrouter: 'sk-or-test-key',
      };

      const mockChrome = {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({ provider_api_keys: storedKeys }),
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      const result = await ProviderStore.getApiKey('openrouter' as ProviderId);

      expect(result).toBe('sk-or-test-key');
    });
  });

  describe('setApiKey', () => {
    it('should set new API key for provider', async () => {
      const getMock = vi.fn().mockResolvedValue({ provider_api_keys: {} });
      const setMock = vi.fn().mockResolvedValue(undefined);

      const mockChrome = {
        storage: {
          local: {
            get: getMock,
            set: setMock,
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      await ProviderStore.setApiKey('anthropic' as ProviderId, 'sk-ant-new-key');

      expect(getMock).toHaveBeenCalledWith('provider_api_keys');
      expect(setMock).toHaveBeenCalledWith({
        provider_api_keys: { anthropic: 'sk-ant-new-key' },
      });
    });

    it('should preserve existing keys when adding new one', async () => {
      const existingKeys: ProviderApiKeys = {
        openai: 'sk-existing-key',
      };

      const getMock = vi.fn().mockResolvedValue({ provider_api_keys: existingKeys });
      const setMock = vi.fn().mockResolvedValue(undefined);

      const mockChrome = {
        storage: {
          local: {
            get: getMock,
            set: setMock,
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      await ProviderStore.setApiKey('anthropic' as ProviderId, 'sk-ant-new-key');

      expect(setMock).toHaveBeenCalledWith({
        provider_api_keys: {
          openai: 'sk-existing-key',
          anthropic: 'sk-ant-new-key',
        },
      });
    });
  });

  describe('removeApiKey', () => {
    it('should remove API key for provider', async () => {
      const existingKeys: ProviderApiKeys = {
        openai: 'sk-to-remove',
        anthropic: 'sk-keep',
      };

      const getMock = vi.fn().mockResolvedValue({ provider_api_keys: existingKeys });
      const setMock = vi.fn().mockResolvedValue(undefined);

      const mockChrome = {
        storage: {
          local: {
            get: getMock,
            set: setMock,
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      await ProviderStore.removeApiKey('openai' as ProviderId);

      expect(setMock).toHaveBeenCalledWith({
        provider_api_keys: { anthropic: 'sk-keep' },
      });
    });
  });

  describe('clearAllApiKeys', () => {
    it('should remove all API keys', async () => {
      const removeMock = vi.fn().mockResolvedValue(undefined);

      const mockChrome = {
        storage: {
          local: {
            remove: removeMock,
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      await ProviderStore.clearAllApiKeys();

      expect(removeMock).toHaveBeenCalledWith('provider_api_keys');
    });
  });

  describe('getSelectedProvider', () => {
    it('should return default provider when none selected', async () => {
      const mockChrome = {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}),
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      const result = await ProviderStore.getSelectedProvider();

      expect(result).toBe('openrouter');
    });

    it('should return selected provider', async () => {
      const mockChrome = {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({ selected_provider: 'anthropic' }),
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      const result = await ProviderStore.getSelectedProvider();

      expect(result).toBe('anthropic');
    });
  });

  describe('setSelectedProvider', () => {
    it('should store selected provider', async () => {
      const setMock = vi.fn().mockResolvedValue(undefined);

      const mockChrome = {
        storage: {
          local: {
            set: setMock,
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      await ProviderStore.setSelectedProvider('openai' as ProviderId);

      expect(setMock).toHaveBeenCalledWith({ selected_provider: 'openai' });
    });
  });

  describe('getSelectedModel', () => {
    it('should return default model when none selected', async () => {
      const mockChrome = {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}),
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      const result = await ProviderStore.getSelectedModel();

      expect(result).toBe('anthropic/claude-3-sonnet-20240229');
    });

    it('should return selected model', async () => {
      const mockChrome = {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({ selected_model: 'anthropic/claude-3-haiku' }),
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      const result = await ProviderStore.getSelectedModel();

      expect(result).toBe('anthropic/claude-3-haiku');
    });
  });

  describe('setSelectedModel', () => {
    it('should store selected model', async () => {
      const setMock = vi.fn().mockResolvedValue(undefined);

      const mockChrome = {
        storage: {
          local: {
            set: setMock,
          },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const { ProviderStore } = await import('@/lib/storage/provider-store');
      await ProviderStore.setSelectedModel('gpt-4o');

      expect(setMock).toHaveBeenCalledWith({ selected_model: 'gpt-4o' });
    });
  });
});

// ============================================================================
// ProviderApiKeys Type Tests
// ============================================================================

describe('ProviderApiKeys Type', () => {
  describe('key storage', () => {
    it('should allow multiple provider keys', () => {
      const keys: ProviderApiKeys = {
        openai: 'sk-123',
        anthropic: 'sk-ant-456',
        openrouter: 'sk-or-789',
      };

      expect(keys.openai).toBe('sk-123');
      expect(keys.anthropic).toBe('sk-ant-456');
      expect(keys.openrouter).toBe('sk-or-789');
    });

    it('should allow partial key assignment', () => {
      const keys: ProviderApiKeys = {
        openai: 'sk-only-openai',
      };

      expect(keys.openai).toBe('sk-only-openai');
      expect(keys.anthropic).toBeUndefined();
    });

    it('should support key removal via delete', () => {
      const keys: ProviderApiKeys = {
        openai: 'sk-to-delete',
        anthropic: 'sk-keep',
      };

      delete keys.openai;

      expect(keys.openai).toBeUndefined();
      expect(keys.anthropic).toBe('sk-keep');
    });
  });
});

// ============================================================================
// ProviderId Type Tests
// ============================================================================

describe('ProviderId Type', () => {
  describe('valid providers', () => {
    it('should accept openrouter', () => {
      const id: ProviderId = 'openrouter';
      expect(id).toBe('openrouter');
    });

    it('should accept anthropic', () => {
      const id: ProviderId = 'anthropic';
      expect(id).toBe('anthropic');
    });

    it('should accept openai', () => {
      const id: ProviderId = 'openai';
      expect(id).toBe('openai');
    });
  });
});
