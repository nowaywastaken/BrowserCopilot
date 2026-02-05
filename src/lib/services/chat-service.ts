import { streamText, generateText } from 'ai';
import type { ChatMessage, ChatOptions } from '../types/chat';
import type { ProviderId } from '../types/provider';
import { createProviderInstance, getDefaultModel } from '../providers';
import { ProviderStore } from '../storage/provider-store';

export class ChatService {
  static async *streamChat(
    messages: ChatMessage[],
    options: ChatOptions & { providerId?: ProviderId; model?: string } = {}
  ): AsyncGenerator<string, void, unknown> {
    const providerId = options.providerId || await ProviderStore.getSelectedProvider();
    const model = options.model || await ProviderStore.getSelectedModel();
    const apiKey = await ProviderStore.getApiKey(providerId);

    if (!apiKey) {
      throw new Error(`未配置 ${providerId} 的 API Key`);
    }

    const provider = createProviderInstance(providerId, apiKey);

    const result = streamText({
      model: provider(model),
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      abortSignal: options.signal,
    });

    for await (const chunk of result.textStream) {
      yield chunk;
    }
  }

  static async chat(
    messages: ChatMessage[],
    options: ChatOptions & { providerId?: ProviderId; model?: string } = {}
  ): Promise<string> {
    const providerId = options.providerId || await ProviderStore.getSelectedProvider();
    const model = options.model || await ProviderStore.getSelectedModel();
    const apiKey = await ProviderStore.getApiKey(providerId);

    if (!apiKey) {
      throw new Error(`未配置 ${providerId} 的 API Key`);
    }

    const provider = createProviderInstance(providerId, apiKey);

    const result = await generateText({
      model: provider(model),
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      abortSignal: options.signal,
    });

    return result.text;
  }
}
