/**
 * 提供商相关类型
 */

/** 提供商 ID 类型 */
export type ProviderId = 'openai' | 'anthropic' | 'openrouter';

/** AI 模型信息 */
export interface AIModel {
  id: string;
  name: string;
  provider: ProviderId;
  description?: string;
}

/** 提供商配置 */
export interface ProviderConfig {
  id: ProviderId;
  name: string;
  baseURL?: string;
  models: AIModel[];
}

/** 提供商 API Key 存储 */
export interface ProviderApiKeys {
  openai?: string;
  anthropic?: string;
  openrouter?: string;
}

/** 存储键常量 */
export const STORAGE_KEYS = {
  PROVIDER_API_KEYS: 'provider_api_keys',
  SELECTED_PROVIDER: 'selected_provider',
  SELECTED_MODEL: 'selected_model',
  MESSAGES: 'chat_messages',
  DARK_MODE: 'dark_mode',
} as const;

/** 存储键类型 */
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
