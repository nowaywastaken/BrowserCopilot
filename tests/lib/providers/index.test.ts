/**
 * Provider Index Tests
 * Tests for AI provider factory and configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Provider Index', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createProviderInstance', () => {
    it('should create OpenAI provider instance', async () => {
      const { createProviderInstance } = await import('../../../src/lib/providers/index');

      const provider = createProviderInstance('openai', 'test-api-key');

      expect(typeof provider).toBe('function');
    });

    it('should create Anthropic provider instance', async () => {
      const { createProviderInstance } = await import('../../../src/lib/providers/index');

      const provider = createProviderInstance('anthropic', 'test-api-key');

      expect(typeof provider).toBe('function');
    });

    it('should create OpenRouter provider instance', async () => {
      const { createProviderInstance } = await import('../../../src/lib/providers/index');

      const provider = createProviderInstance('openrouter', 'test-api-key');

      expect(typeof provider).toBe('function');
    });

    it('should throw error for unknown provider', async () => {
      const { createProviderInstance } = await import('../../../src/lib/providers/index');

      expect(() => createProviderInstance('unknown' as any, 'test-key')).toThrow('Unknown provider: unknown');
    });

    it('should return callable function for each provider', async () => {
      const { createProviderInstance } = await import('../../../src/lib/providers/index');

      const openai = createProviderInstance('openai', 'key');
      const anthropic = createProviderInstance('anthropic', 'key');
      const openrouter = createProviderInstance('openrouter', 'key');

      expect(openai).toBeInstanceOf(Function);
      expect(anthropic).toBeInstanceOf(Function);
      expect(openrouter).toBeInstanceOf(Function);
    });
  });

  describe('getDefaultModel', () => {
    it('should return correct default model for OpenAI', async () => {
      const { getDefaultModel } = await import('../../../src/lib/providers/index');

      const model = getDefaultModel('openai');

      expect(model).toBe('gpt-4o');
    });

    it('should return correct default model for Anthropic', async () => {
      const { getDefaultModel } = await import('../../../src/lib/providers/index');

      const model = getDefaultModel('anthropic');

      expect(model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should return correct default model for OpenRouter', async () => {
      const { getDefaultModel } = await import('../../../src/lib/providers/index');

      const model = getDefaultModel('openrouter');

      expect(model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should throw error for unknown provider', async () => {
      const { getDefaultModel } = await import('../../../src/lib/providers/index');

      expect(() => getDefaultModel('unknown' as any)).toThrow('Unknown provider: unknown');
    });

    it('should return string model ID for all providers', async () => {
      const { getDefaultModel } = await import('../../../src/lib/providers/index');

      const providers = ['openai', 'anthropic', 'openrouter'] as const;

      for (const provider of providers) {
        const model = getDefaultModel(provider);
        expect(typeof model).toBe('string');
        expect(model.length).toBeGreaterThan(0);
      }
    });
  });

  describe('ProviderId type', () => {
    it('should accept valid provider IDs', async () => {
      const { createProviderInstance, getDefaultModel } = await import('../../../src/lib/providers/index');

      // These should not throw
      expect(() => createProviderInstance('openai', 'key')).not.toThrow();
      expect(() => createProviderInstance('anthropic', 'key')).not.toThrow();
      expect(() => createProviderInstance('openrouter', 'key')).not.toThrow();

      expect(() => getDefaultModel('openai')).not.toThrow();
      expect(() => getDefaultModel('anthropic')).not.toThrow();
      expect(() => getDefaultModel('openrouter')).not.toThrow();
    });
  });

  describe('Provider configuration', () => {
    it('should create OpenAI provider instance', async () => {
      const { createProviderInstance } = await import('../../../src/lib/providers/index');

      const provider = createProviderInstance('openai', 'test-key');

      expect(provider).toBeDefined();
      expect(typeof provider).toBe('function');
    });

    it('should create OpenRouter provider instance', async () => {
      const { createProviderInstance } = await import('../../../src/lib/providers/index');

      const provider = createProviderInstance('openrouter', 'test-key');

      expect(provider).toBeDefined();
      expect(typeof provider).toBe('function');
    });

    it('should create Anthropic provider instance', async () => {
      const { createProviderInstance } = await import('../../../src/lib/providers/index');

      const provider = createProviderInstance('anthropic', 'test-key');

      expect(provider).toBeDefined();
      expect(typeof provider).toBe('function');
    });
  });

  describe('Config exports', () => {
    it('should export all config items', async () => {
      const config = await import('../../../src/lib/providers/index');

      expect(config.createProviderInstance).toBeDefined();
      expect(config.getDefaultModel).toBeDefined();
    });

    it('should re-export from config module', async () => {
      // The config module should export these
      const config = await import('../../../src/lib/providers/config');

      // Just verify the module loads
      expect(config).toBeDefined();
    });
  });
});
