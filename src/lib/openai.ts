/**
 * OpenRouter 统一 AI 接入客户端
 * 支持 GPT-4 / Claude 3 / Llama 3 多模型切换
 * 实现 SSE 流式响应、错误处理、重试机制和缓存
 *
 * @deprecated 此文件已废弃。请使用 src/lib/services/chat-service.ts 代替。
 * 新的多提供商架构支持 OpenAI、Anthropic 和 OpenRouter。
 *
 * 特性：
 * - 完整的 AbortController 支持，支持请求取消
 * - Stream Reader 自动取消，防止内存泄漏
 * - 指数退避重试机制
 * - LRU 缓存策略
 * - 完整的 TypeScript 类型定义
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 支持的 AI 模型 */
export type AIModel =
  | 'openai/gpt-4o'
  | 'openai/gpt-4o-mini'
  | 'openai/gpt-4-turbo'
  | 'anthropic/claude-3-opus-20240229'
  | 'anthropic/claude-3-sonnet-20240229'
  | 'anthropic/claude-3-haiku-20240307'
  | 'meta-llama/llama-3-70b-instruct'
  | 'meta-llama/llama-3-8b-instruct'
  | 'google/gemini-1.5-pro-latest'
  | 'google/gemini-1.5-flash-latest';

/** 聊天消息角色 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** 聊天消息 */
export interface ChatMessage {
  role: MessageRole;
  content: string | Array<{
    type: 'image_url' | 'text';
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
    text?: string;
  }>;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/** 工具调用 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/** 工具定义 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/** SSE 流式响应块 */
export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: MessageRole;
      content?: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
    logprobs?: unknown;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** 非流式响应 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
    logprobs?: unknown;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

/** OpenRouter 客户端配置 */
export interface OpenRouterConfig {
  apiKey: string;
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  siteUrl?: string;
  siteTitle?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  enableCache?: boolean;
  cacheTTL?: number;
}

/** 请求配置 */
export interface RequestConfig {
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  stream?: boolean;
  signal?: AbortSignal;
}

/** API 错误 */
export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

// ============================================================================
// 常量定义
// ============================================================================

const BASE_URL = 'https://openrouter.ai/api/v1';

const DEFAULT_CONFIG: Required<Omit<OpenRouterConfig, 'apiKey' | 'siteUrl' | 'siteTitle'>> = {
  model: 'anthropic/claude-3-sonnet-20240229',
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  timeout: 60000,
  retries: 3,
  retryDelay: 1000,
  enableCache: true,
  cacheTTL: 5 * 60 * 1000, // 5 分钟
};

/** 模型定价信息（每 1K tokens） */
export const MODEL_PRICING: Record<AIModel, { input: number; output: number }> = {
  'openai/gpt-4o': { input: 0.005, output: 0.015 },
  'openai/gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'openai/gpt-4-turbo': { input: 0.01, output: 0.03 },
  'anthropic/claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'anthropic/claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'anthropic/claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'meta-llama/llama-3-70b-instruct': { input: 0.0009, output: 0.0009 },
  'meta-llama/llama-3-8b-instruct': { input: 0.0002, output: 0.0002 },
  'google/gemini-1.5-pro-latest': { input: 0.0035, output: 0.0105 },
  'google/gemini-1.5-flash-latest': { input: 0.00035, output: 0.00105 },
};

// ============================================================================
// LRU 缓存实现
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;

  constructor(private maxSize: number, private defaultTTL: number) {
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // 移动到最近使用
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttl?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最久未使用的
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    });
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
}

// ============================================================================
// 日志工具
// ============================================================================

class Logger {
  private static readonly PREFIX = '[OpenRouter]';
  private static enabled = true;

  static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  static debug(...args: unknown[]): void {
    if (this.enabled) {
      console.debug(this.PREFIX, ...args);
    }
  }

  static info(...args: unknown[]): void {
    if (this.enabled) {
      console.info(this.PREFIX, ...args);
    }
  }

  static warn(...args: unknown[]): void {
    if (this.enabled) {
      console.warn(this.PREFIX, ...args);
    }
  }

  static error(...args: unknown[]): void {
    if (this.enabled) {
      console.error(this.PREFIX, ...args);
    }
  }
}

// ============================================================================
// OpenRouter 客户端
// ============================================================================

export class OpenRouterClient {
  private apiKey: string;
  private config: Required<Omit<OpenRouterConfig, 'apiKey' | 'siteUrl' | 'siteTitle'>> &
    Pick<OpenRouterConfig, 'siteUrl' | 'siteTitle'>;
  private cache: LRUCache<string, ChatCompletionResponse>;
  private activeRequests: Map<string, AbortController>;

  constructor(config: OpenRouterConfig) {
    if (!config.apiKey) {
      throw new OpenRouterError('API Key 是必需的');
    }

    this.apiKey = config.apiKey;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.cache = new LRUCache(100, this.config.cacheTTL);
    this.activeRequests = new Map();
  }

  /**
   * 获取请求头
   */
  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.config.siteUrl) {
      headers['HTTP-Referer'] = this.config.siteUrl;
    }

    if (this.config.siteTitle) {
      headers['X-Title'] = this.config.siteTitle;
    }

    return headers;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(messages: ChatMessage[], config: RequestConfig): string {
    const keyData = {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      model: config.model ?? this.config.model,
      temperature: config.temperature ?? this.config.temperature,
      maxTokens: config.maxTokens ?? this.config.maxTokens,
      topP: config.topP ?? this.config.topP,
    };
    return JSON.stringify(keyData);
  }

  /**
   * 指数退避延迟
   */
  private async delay(attempt: number): Promise<void> {
    const delayMs = this.config.retryDelay * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  /**
   * 检查错误是否可重试
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof OpenRouterError) {
      return error.retryable;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true; // 网络错误
    }
    return false;
  }

  /**
   * 处理 API 错误响应
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;
    let errorData: { error?: { message?: string; code?: string } } = {};

    try {
      errorData = await response.json();
    } catch {
      // 忽略解析错误
    }

    const message = errorData.error?.message || `HTTP ${status}`;
    const code = errorData.error?.code;

    // 根据状态码确定是否可重试
    const retryable = status === 429 || status >= 500;

    throw new OpenRouterError(message, status, code, retryable);
  }

  /**
   * 执行带重试的请求
   */
  private async requestWithRetry<T>(
    url: string,
    options: RequestInit,
    signal?: AbortSignal
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        // 创建 AbortController 用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        // 合并外部 signal
        if (signal) {
          signal.addEventListener('abort', () => controller.abort());
        }

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 如果是用户取消，直接抛出
        if (error instanceof Error && error.name === 'AbortError') {
          throw new OpenRouterError('请求已取消', undefined, 'ABORTED', false);
        }

        // 检查是否可重试
        if (attempt < this.config.retries && this.isRetryableError(error)) {
          Logger.warn(`请求失败，${attempt + 1}/${this.config.retries + 1} 次尝试，即将重试...`, error);
          await this.delay(attempt + 1);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new OpenRouterError('请求失败');
  }

  /**
   * 非流式聊天 - 发送消息并等待完整响应
   * 支持缓存和重试
   */
  async chat(
    messages: ChatMessage[],
    config: RequestConfig = {}
  ): Promise<ChatCompletionResponse> {
    // 检查缓存
    if (this.config.enableCache && !config.stream) {
      const cacheKey = this.generateCacheKey(messages, config);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        Logger.debug('缓存命中', cacheKey);
        return cached;
      }
    }

    const requestBody = {
      model: config.model ?? this.config.model,
      messages,
      temperature: config.temperature ?? this.config.temperature,
      max_tokens: config.maxTokens ?? this.config.maxTokens,
      top_p: config.topP ?? this.config.topP,
      frequency_penalty: config.frequencyPenalty ?? this.config.frequencyPenalty,
      presence_penalty: config.presencePenalty ?? this.config.presencePenalty,
      tools: config.tools,
      tool_choice: config.toolChoice,
      stream: false,
    };

    const response = await this.requestWithRetry<ChatCompletionResponse>(
      `${BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      },
      config.signal
    );

    // 缓存响应
    if (this.config.enableCache) {
      const cacheKey = this.generateCacheKey(messages, config);
      this.cache.set(cacheKey, response);
    }

    return response;
  }

  /**
   * 流式聊天 - 发送消息并返回异步生成器
   * 支持 AbortController 取消和自动资源清理
   */
  async *streamChat(
    messages: ChatMessage[],
    config: RequestConfig = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    // 合并外部 signal
    if (config.signal) {
      config.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const requestBody = {
        model: config.model ?? this.config.model,
        messages,
        temperature: config.temperature ?? this.config.temperature,
        max_tokens: config.maxTokens ?? this.config.maxTokens,
        top_p: config.topP ?? this.config.topP,
        frequency_penalty: config.frequencyPenalty ?? this.config.frequencyPenalty,
        presence_penalty: config.presencePenalty ?? this.config.presencePenalty,
        tools: config.tools,
        tool_choice: config.toolChoice,
        stream: true,
      };

      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      if (!response.body) {
        throw new OpenRouterError('响应体为空');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // 解码并追加到缓冲区
          buffer += decoder.decode(value, { stream: true });

          // 处理完整的行
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留不完整的行

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
              continue;
            }

            const data = trimmedLine.slice(6).trim();

            // 跳过保活和结束标记
            if (data === '[DONE]' || data.includes('OPENROUTER PROCESSING')) {
              continue;
            }

            try {
              const chunk: StreamChunk = JSON.parse(data);
              yield chunk;

              // 检查是否完成
              if (chunk.choices[0]?.finish_reason) {
                return;
              }
            } catch (parseError) {
              Logger.warn('解析 SSE 数据块失败', parseError, data);
            }
          }
        }
      } finally {
        // 确保 reader 被释放
        reader.releaseLock();
      }
    } catch (error) {
      // 如果是取消错误，转换为标准错误
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OpenRouterError('流式请求已取消', undefined, 'ABORTED', false);
      }
      throw error;
    } finally {
      // 清理请求追踪
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * 取消所有活跃请求
   */
  cancelAllRequests(): void {
    for (const [id, controller] of this.activeRequests) {
      controller.abort();
      this.activeRequests.delete(id);
    }
    Logger.info('已取消所有活跃请求');
  }

  /**
   * 取消特定请求（通过 AbortController）
   */
  cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * 获取模型列表
   */
  async getModels(signal?: AbortSignal): Promise<
    Array<{
      id: string;
      name: string;
      description?: string;
      pricing?: { prompt: number; completion: number };
      context_length?: number;
    }>
  > {
    const response = await this.requestWithRetry<{
      data: Array<{
        id: string;
        name: string;
        description?: string;
        pricing?: { prompt: number; completion: number };
        context_length?: number;
      }>;
    }>(
      `${BASE_URL}/models`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      signal
    );

    return response.data;
  }

  /**
   * 计算请求预估成本
   */
  estimateCost(model: AIModel, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0;

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<OpenRouterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取活跃请求数量
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 OpenRouter 客户端实例
 */
export function createOpenRouterClient(config: OpenRouterConfig): OpenRouterClient {
  return new OpenRouterClient(config);
}

/**
 * 简单的非流式聊天函数
 */
export async function sendMessage(
  messages: ChatMessage[],
  apiKey: string,
  model: AIModel = 'anthropic/claude-3-sonnet-20240229'
): Promise<string> {
  const client = new OpenRouterClient({ apiKey, model });
  const response = await client.chat(messages);
  const content = response.choices[0]?.message?.content;
  // Handle both string and array content types
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('');
  }
  return '';
}

/**
 * 流式聊天函数
 */
export async function* streamMessage(
  messages: ChatMessage[],
  apiKey: string,
  model: AIModel = 'anthropic/claude-3-sonnet-20240229',
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const client = new OpenRouterClient({ apiKey, model });

  for await (const chunk of client.streamChat(messages, { signal })) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

// ============================================================================
// 导出类型
// ============================================================================

export type {
  OpenRouterConfig as OpenRouterClientConfig,
  RequestConfig as OpenRouterRequestConfig,
};
