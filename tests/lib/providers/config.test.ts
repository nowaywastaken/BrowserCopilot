/**
 * Provider Config Tests
 * Tests for provider configuration
 */

import { describe, it, expect } from 'vitest';
import {
  PROVIDERS,
  getProviderConfig,
  getAllProviders,
  getProviderModels,
  isValidProvider,
  isValidModel,
  type ProviderId,
} from '../../../src/lib/providers/config';
import type { AIModel } from '../../../src/lib/types/provider';

describe('Provider Config', () => {
  describe('PROVIDERS', () => {
    it('should have all required providers', () => {
      expect(PROVIDERS).toHaveProperty('openai');
      expect(PROVIDERS).toHaveProperty('anthropic');
      expect(PROVIDERS).toHaveProperty('openrouter');
    });

    it('should have models for each provider', () => {
      Object.values(PROVIDERS).forEach(provider => {
        expect(provider.models).toBeDefined();
        expect(provider.models.length).toBeGreaterThan(0);
      });
    });

    it('should have correct provider properties', () => {
      expect(PROVIDERS.openai.id).toBe('openai');
      expect(PROVIDERS.openai.name).toBe('OpenAI');
      expect(PROVIDERS.anthropic.id).toBe('anthropic');
      expect(PROVIDERS.anthropic.name).toBe('Anthropic');
      expect(PROVIDERS.openrouter.id).toBe('openrouter');
      expect(PROVIDERS.openrouter.name).toBe('OpenRouter');
      expect(PROVIDERS.openrouter.baseURL).toBe('https://openrouter.ai/api/v1');
    });
  });

  describe('getProviderConfig', () => {
    it('should return correct config for openai', () => {
      const config = getProviderConfig('openai');
      expect(config.id).toBe('openai');
      expect(config.name).toBe('OpenAI');
    });

    it('should return correct config for anthropic', () => {
      const config = getProviderConfig('anthropic');
      expect(config.id).toBe('anthropic');
      expect(config.name).toBe('Anthropic');
    });

    it('should return correct config for openrouter', () => {
      const config = getProviderConfig('openrouter');
      expect(config.id).toBe('openrouter');
      expect(config.name).toBe('OpenRouter');
      expect(config.baseURL).toBe('https://openrouter.ai/api/v1');
    });
  });

  describe('getAllProviders', () => {
    it('should return array of all providers', () => {
      const providers = getAllProviders();
      expect(providers).toHaveLength(3);
      expect(providers[0].id).toBe('openai');
      expect(providers[1].id).toBe('anthropic');
      expect(providers[2].id).toBe('openrouter');
    });
  });

  describe('getProviderModels', () => {
    it('should return models for openai', () => {
      const models = getProviderModels('openai');
      expect(models.length).toBeGreaterThan(0);
      expect(models[0].provider).toBe('openai');
    });

    it('should return models for anthropic', () => {
      const models = getProviderModels('anthropic');
      expect(models.length).toBeGreaterThan(0);
      expect(models[0].provider).toBe('anthropic');
    });

    it('should return empty array for unknown provider', () => {
      const models = getProviderModels('unknown' as ProviderId);
      expect(models).toEqual([]);
    });
  });

  describe('isValidProvider', () => {
    it('should return true for valid providers', () => {
      expect(isValidProvider('openai')).toBe(true);
      expect(isValidProvider('anthropic')).toBe(true);
      expect(isValidProvider('openrouter')).toBe(true);
    });

    it('should return false for invalid providers', () => {
      expect(isValidProvider('invalid')).toBe(false);
      expect(isValidProvider('ollama')).toBe(false);
      expect(isValidProvider('')).toBe(false);
    });
  });

  describe('isValidModel', () => {
    it('should return true for valid openai models', () => {
      expect(isValidModel('openai', 'gpt-4o')).toBe(true);
      expect(isValidModel('openai', 'gpt-4o-mini')).toBe(true);
      expect(isValidModel('openai', 'o1-preview')).toBe(true);
    });

    it('should return true for valid anthropic models', () => {
      expect(isValidModel('anthropic', 'claude-3-5-sonnet-20241022')).toBe(true);
      expect(isValidModel('anthropic', 'claude-3-opus-20240229')).toBe(true);
    });

    it('should return true for valid openrouter models', () => {
      expect(isValidModel('openrouter', 'anthropic/claude-3.5-sonnet')).toBe(true);
      expect(isValidModel('openrouter', 'openai/gpt-4o')).toBe(true);
    });

    it('should return false for invalid models', () => {
      expect(isValidModel('openai', 'invalid-model')).toBe(false);
      expect(isValidModel('anthropic', 'gpt-4o')).toBe(false);
      expect(isValidModel('openrouter', 'unknown/model')).toBe(false);
    });

    it('should return false for unknown provider', () => {
      expect(isValidModel('unknown' as ProviderId, 'gpt-4o')).toBe(false);
    });
  });
});
