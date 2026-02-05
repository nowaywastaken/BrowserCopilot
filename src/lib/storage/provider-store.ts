import type { ProviderApiKeys, ProviderId } from '../types/provider';

/** 存储键 */
const STORAGE_KEYS = {
  PROVIDER_API_KEYS: 'provider_api_keys',
  SELECTED_PROVIDER: 'selected_provider',
  SELECTED_MODEL: 'selected_model',
} as const;

/** 默认值 */
const DEFAULTS = {
  SELECTED_PROVIDER: 'openrouter' as ProviderId, // 保持向后兼容
  SELECTED_MODEL: 'anthropic/claude-3-sonnet-20240229',
};

/**
 * ProviderStore - Chrome Storage 封装
 */
export class ProviderStore {
  /**
   * 获取所有 API Keys
   */
  static async getApiKeys(): Promise<ProviderApiKeys> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PROVIDER_API_KEYS);
    return result[STORAGE_KEYS.PROVIDER_API_KEYS] || {};
  }

  /**
   * 获取特定提供商的 API Key
   */
  static async getApiKey(providerId: ProviderId): Promise<string | undefined> {
    const apiKeys = await this.getApiKeys();
    return apiKeys[providerId];
  }

  /**
   * 设置 API Key
   */
  static async setApiKey(providerId: ProviderId, apiKey: string): Promise<void> {
    const apiKeys = await this.getApiKeys();
    apiKeys[providerId] = apiKey;
    await chrome.storage.local.set({ [STORAGE_KEYS.PROVIDER_API_KEYS]: apiKeys });
  }

  /**
   * 删除 API Key
   */
  static async removeApiKey(providerId: ProviderId): Promise<void> {
    const apiKeys = await this.getApiKeys();
    delete apiKeys[providerId];
    await chrome.storage.local.set({ [STORAGE_KEYS.PROVIDER_API_KEYS]: apiKeys });
  }

  /**
   * 清除所有 API Keys
   */
  static async clearAllApiKeys(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.PROVIDER_API_KEYS);
  }

  /**
   * 获取选中的提供商
   */
  static async getSelectedProvider(): Promise<ProviderId> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SELECTED_PROVIDER);
    return result[STORAGE_KEYS.SELECTED_PROVIDER] || DEFAULTS.SELECTED_PROVIDER;
  }

  /**
   * 设置选中的提供商
   */
  static async setSelectedProvider(providerId: ProviderId): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.SELECTED_PROVIDER]: providerId });
  }

  /**
   * 获取选中的模型
   */
  static async getSelectedModel(): Promise<string> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SELECTED_MODEL);
    return result[STORAGE_KEYS.SELECTED_MODEL] || DEFAULTS.SELECTED_MODEL;
  }

  /**
   * 设置选中的模型
   */
  static async setSelectedModel(modelId: string): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.SELECTED_MODEL]: modelId });
  }
}
