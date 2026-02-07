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
