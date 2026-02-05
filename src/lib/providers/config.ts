import type { ProviderConfig, AIModel, ProviderId } from '../types/provider';

/** OpenAI 模型列表 */
const OPENAI_MODELS: AIModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: '最新的 GPT-4 Omni 模型' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: '轻量级 GPT-4o' },
  { id: 'o1-preview', name: 'o1-preview', provider: 'openai', description: 'OpenAI 推理模型' },
  { id: 'o1-mini', name: 'o1-mini', provider: 'openai', description: '轻量级推理模型' },
];

/** Anthropic 模型列表 */
const ANTHROPIC_MODELS: AIModel[] = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: '最新的 Claude 模型' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', description: '最强性能' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', description: '最快响应' },
];

/** OpenRouter 模型列表（精选常用） */
const OPENROUTER_MODELS: AIModel[] = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'openrouter', description: '通过 OpenRouter' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter', description: '通过 OpenRouter' },
  { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', provider: 'openrouter', description: '开源模型' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'openrouter', description: 'Google 模型' },
];

/** 提供商配置注册表 */
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: OPENAI_MODELS,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    models: ANTHROPIC_MODELS,
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    models: OPENROUTER_MODELS,
  },
};

/** 获取提供商配置 */
export function getProviderConfig(providerId: ProviderId): ProviderConfig {
  return PROVIDERS[providerId];
}

/** 获取所有提供商列表 */
export function getAllProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS);
}

/** 获取提供商的模型列表 */
export function getProviderModels(providerId: ProviderId): AIModel[] {
  return PROVIDERS[providerId]?.models || [];
}

/** 验证提供商 ID */
export function isValidProvider(providerId: string): providerId is ProviderId {
  return providerId in PROVIDERS;
}

/** 验证模型 ID */
export function isValidModel(providerId: ProviderId, modelId: string): boolean {
  const models = getProviderModels(providerId);
  return models.some((m) => m.id === modelId);
}
