import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderStore } from './provider-store';

// Mock storage to simulate chrome.storage.local behavior
const mockStorage = new Map<string, unknown>();

describe('ProviderStore', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();

    // Mock chrome.storage.local.get to return values from mockStorage
    (chrome.storage.local.get as any).mockImplementation(async (keys: string | string[] | null) => {
      const result: Record<string, unknown> = {};
      if (keys === null) {
        // Return all stored values
        for (const [key, value] of mockStorage.entries()) {
          result[key] = value;
        }
      } else if (typeof keys === 'string') {
        if (mockStorage.has(keys)) result[keys] = mockStorage.get(keys);
      } else if (Array.isArray(keys)) {
        keys.forEach(key => {
          if (mockStorage.has(key)) result[key] = mockStorage.get(key);
        });
      }
      return result;
    });

    // Mock chrome.storage.local.set to store values in mockStorage
    (chrome.storage.local.set as any).mockImplementation(async (items: Record<string, unknown>) => {
      Object.entries(items).forEach(([key, value]) => {
        mockStorage.set(key, value);
      });
    });
  });

  describe('getApiKeys', () => {
    it('should return empty object when no keys stored', async () => {
      const keys = await ProviderStore.getApiKeys();
      expect(keys).toEqual({});
    });

    it('should return stored API keys', async () => {
      mockStorage.set('provider_api_keys', { openai: 'sk-test' });
      const keys = await ProviderStore.getApiKeys();
      expect(keys).toEqual({ openai: 'sk-test' });
    });
  });

  describe('setApiKey', () => {
    it('should store API key for provider', async () => {
      await ProviderStore.setApiKey('openai', 'sk-test');
      expect(mockStorage.get('provider_api_keys')).toEqual({ openai: 'sk-test' });
    });

    it('should preserve existing keys when adding new one', async () => {
      mockStorage.set('provider_api_keys', { anthropic: 'sk-ant-test' });
      await ProviderStore.setApiKey('openai', 'sk-test');
      expect(mockStorage.get('provider_api_keys')).toEqual({
        anthropic: 'sk-ant-test',
        openai: 'sk-test',
      });
    });
  });

  describe('getSelectedProvider', () => {
    it('should return default provider when none stored', async () => {
      const provider = await ProviderStore.getSelectedProvider();
      expect(provider).toBe('openrouter');
    });

    it('should return stored provider', async () => {
      mockStorage.set('selected_provider', 'openai');
      const provider = await ProviderStore.getSelectedProvider();
      expect(provider).toBe('openai');
    });
  });
});
