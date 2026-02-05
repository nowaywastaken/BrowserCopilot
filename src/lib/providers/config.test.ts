import { describe, it, expect } from 'vitest';
import { PROVIDERS, getProviderConfig, isValidProvider, isValidModel } from './config';

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

  describe('isValidProvider', () => {
    it('should return true for valid providers', () => {
      expect(isValidProvider('openai')).toBe(true);
      expect(isValidProvider('anthropic')).toBe(true);
      expect(isValidProvider('openrouter')).toBe(true);
    });

    it('should return false for invalid providers', () => {
      expect(isValidProvider('invalid')).toBe(false);
      expect(isValidProvider('ollama')).toBe(false);
    });
  });

  describe('isValidModel', () => {
    it('should return true for valid openai models', () => {
      expect(isValidModel('openai', 'gpt-4o')).toBe(true);
      expect(isValidModel('openai', 'gpt-4o-mini')).toBe(true);
    });

    it('should return true for valid anthropic models', () => {
      expect(isValidModel('anthropic', 'claude-3-5-sonnet-20241022')).toBe(true);
      expect(isValidModel('anthropic', 'claude-3-opus-20240229')).toBe(true);
    });

    it('should return false for invalid models', () => {
      expect(isValidModel('openai', 'invalid-model')).toBe(false);
      expect(isValidModel('anthropic', 'gpt-4o')).toBe(false);
    });
  });
});
