import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import type { ProviderId } from '../types/provider';

/**
 * 创建 Vercel AI SDK 提供商实例
 */
export function createProviderInstance(
  providerId: ProviderId,
  apiKey: string
): (modelId: string) => LanguageModelV3 {
  switch (providerId) {
    case 'openai': {
      const provider = createOpenAI({ apiKey });
      return (modelId: string) => provider.chat(modelId);
    }

    case 'anthropic': {
      const provider = createAnthropic({ apiKey });
      return (modelId: string) => provider.chat(modelId);
    }

    case 'openrouter': {
      // OpenRouter 兼容 OpenAI 格式
      const provider = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
      });
      return (modelId: string) => provider.chat(modelId);
    }

    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

/**
 * 获取提供商的默认模型
 */
export function getDefaultModel(providerId: ProviderId): string {
  switch (providerId) {
    case 'openai':
      return 'gpt-4o';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    case 'openrouter':
      return 'anthropic/claude-3.5-sonnet';
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

// 导出配置
export * from './config';
