# 多提供商 AI 助手实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 支持多个 AI 提供商（OpenAI、Anthropic、OpenRouter），使用 Vercel AI SDK 作为统一接口层。

**Architecture:** 使用 Vercel AI SDK 的统一接口抽象多个提供商，通过提供商工厂模式创建实例，Chrome Storage 持久化 API Key 配置，UI 层实现提供商和模型的联动选择。

**Tech Stack:** Vercel AI SDK (`ai` 包)、React 18、TypeScript、Chrome Extension API

---

## 前置条件

### 阅读材料
- 设计文档: `docs/plans/2026-02-05-multi-provider-design.md`
- 现有 OpenRouter 客户端: `src/lib/openai.ts`
- 主应用组件: `src/sidepanel/App.tsx`

### 关键文件位置
- 提供商目录: `src/lib/providers/` (新建)
- 类型定义: `src/lib/types/` (新建)
- 存储封装: `src/lib/storage/` (新建)
- UI 组件: `src/sidepanel/components/`

---

## Task 1: 安装 Vercel AI SDK 依赖

**Files:**
- Modify: `package.json`

**Step 1: 安装依赖包**

Run:
```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic
```

Expected: 依赖安装成功，`package.json` 和 `package-lock.json` 更新

**Step 2: 验证安装**

Run:
```bash
npm list ai @ai-sdk/openai @ai-sdk/anthropic
```

Expected: 显示已安装的版本号

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: 安装 Vercel AI SDK 依赖 (ai, @ai-sdk/openai, @ai-sdk/anthropic)"
```

---

## Task 2: 创建类型定义文件

**Files:**
- Create: `src/lib/types/chat.ts`
- Create: `src/lib/types/provider.ts`

**Step 1: 创建聊天类型定义**

Create `src/lib/types/chat.ts`:
```typescript
/** 聊天消息角色 */
export type MessageRole = 'system' | 'user' | 'assistant';

/** 聊天消息 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

/** Vercel AI SDK 兼容的消息格式 */
export interface VercelChatMessage {
  role: MessageRole;
  content: string;
}

/** 聊天选项 */
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}
```

**Step 2: 创建提供商类型定义**

Create `src/lib/types/provider.ts`:
```typescript
import type { ChatMessage } from './chat';

/** 提供商 ID 类型 */
export type ProviderId = 'openai' | 'anthropic' | 'openrouter';

/** AI 模型 */
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

/** 存储键类型 */
export interface StorageKeys {
  PROVIDER_API_KEYS: string;
  SELECTED_PROVIDER: string;
  SELECTED_MODEL: string;
  MESSAGES: string;
  DARK_MODE: string;
}
```

**Step 3: Commit**

```bash
git add src/lib/types/chat.ts src/lib/types/provider.ts
git commit -m "feat: 添加提供商和聊天类型定义"
```

---

## Task 3: 创建提供商配置注册表

**Files:**
- Create: `src/lib/providers/config.ts`

**Step 1: 创建提供商配置**

Create `src/lib/providers/config.ts`:
```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/providers/config.ts
git commit -m "feat: 添加提供商配置注册表"
```

---

## Task 4: 创建 Chrome Storage 封装

**Files:**
- Create: `src/lib/storage/provider-store.ts`

**Step 1: 创建存储封装**

Create `src/lib/storage/provider-store.ts`:
```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/storage/provider-store.ts
git commit -m "feat: 添加提供商存储封装"
```

---

## Task 5: 创建提供商工厂

**Files:**
- Create: `src/lib/providers/index.ts`

**Step 1: 创建提供商工厂**

Create `src/lib/providers/index.ts`:
```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import type { ProviderId } from '../types/provider';

/**
 * 创建 Vercel AI SDK 提供商实例
 */
export function createProviderInstance(
  providerId: ProviderId,
  apiKey: string
): (modelId: string) => LanguageModelV1 {
  switch (providerId) {
    case 'openai':
      return openai({ apiKey });

    case 'anthropic':
      return anthropic({ apiKey });

    case 'openrouter':
      // OpenRouter 兼容 OpenAI 格式
      return createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
      });

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
```

**Step 2: Commit**

```bash
git add src/lib/providers/index.ts
git commit -m "feat: 添加提供商工厂函数"
```

---

## Task 6: 创建聊天服务

**Files:**
- Create: `src/lib/services/chat-service.ts`

**Step 1: 创建聊天服务**

Create `src/lib/services/chat-service.ts`:
```typescript
import { streamText, generateText } from 'ai';
import type { ChatMessage, ChatOptions } from '../types/chat';
import type { ProviderId } from '../types/provider';
import { createProviderInstance, getDefaultModel } from '../providers';
import { ProviderStore } from '../storage/provider-store';

/**
 * 聊天服务 - 使用 Vercel AI SDK
 */
export class ChatService {
  /**
   * 流式聊天
   */
  static async *streamChat(
    messages: ChatMessage[],
    options: ChatOptions & { providerId?: ProviderId; model?: string } = {}
  ): AsyncGenerator<string, void, unknown> {
    // 获取提供商和模型
    const providerId = options.providerId || await ProviderStore.getSelectedProvider();
    const model = options.model || await ProviderStore.getSelectedModel();

    // 获取 API Key
    const apiKey = await ProviderStore.getApiKey(providerId);

    if (!apiKey) {
      throw new Error(`未配置 ${providerId} 的 API Key`);
    }

    // 创建提供商实例
    const provider = createProviderInstance(providerId, apiKey);

    // 调用 Vercel AI SDK
    const result = streamText({
      model: provider(model),
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      abortSignal: options.signal,
    });

    // 流式输出
    for await (const chunk of result.textStream) {
      yield chunk;
    }
  }

  /**
   * 非流式聊天
   */
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
```

**Step 2: Commit**

```bash
git add src/lib/services/chat-service.ts
git commit -m "feat: 添加基于 Vercel AI SDK 的聊天服务"
```

---

## Task 7: 创建 ProviderSelector 组件

**Files:**
- Create: `src/sidepanel/components/ProviderSelector.tsx`

**Step 1: 创建提供商选择器组件**

Create `src/sidepanel/components/ProviderSelector.tsx`:
```typescript
import React from 'react';
import { clsx } from 'clsx';
import type { ProviderId } from '../../lib/types/provider';
import { PROVIDERS } from '../../lib/providers';

interface ProviderSelectorProps {
  value: ProviderId;
  onChange: (providerId: ProviderId) => void;
  configuredProviders: ProviderId[];
  disabled?: boolean;
}

export function ProviderSelector({
  value,
  onChange,
  configuredProviders,
  disabled = false,
}: ProviderSelectorProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ProviderId)}
        disabled={disabled}
        className={clsx(
          'appearance-none',
          'px-3 py-1.5 pr-8',
          'bg-gray-100 dark:bg-gray-700',
          'border border-gray-200 dark:border-gray-600',
          'rounded-lg',
          'text-sm font-medium',
          'text-gray-700 dark:text-gray-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors'
        )}
      >
        {Object.values(PROVIDERS).map((provider) => {
          const isConfigured = configuredProviders.includes(provider.id);
          return (
            <option
              key={provider.id}
              value={provider.id}
              disabled={!isConfigured}
            >
              {provider.name}{!isConfigured ? ' (未配置)' : ''}
            </option>
          );
        })}
      </select>

      {/* 下拉箭头 */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/sidepanel/components/ProviderSelector.tsx
git commit -m "feat: 添加提供商选择器组件"
```

---

## Task 8: 改造 ModelSelector 组件

**Files:**
- Modify: `src/sidepanel/components/ModelSelector.tsx`

**Step 1: 重写 ModelSelector 组件**

Replace the entire content of `src/sidepanel/components/ModelSelector.tsx`:
```typescript
import React from 'react';
import { clsx } from 'clsx';
import type { ProviderId } from '../../lib/types/provider';
import { getProviderModels } from '../../lib/providers';

interface ModelSelectorProps {
  providerId: ProviderId;
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  providerId,
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  const models = getProviderModels(providerId);

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={clsx(
          'appearance-none',
          'px-3 py-1.5 pr-8',
          'bg-gray-100 dark:bg-gray-700',
          'border border-gray-200 dark:border-gray-600',
          'rounded-lg',
          'text-sm',
          'text-gray-700 dark:text-gray-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors'
        )}
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>

      {/* 下拉箭头 */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}

// 导出类型以保持向后兼容
export type { AIModel } from '../../lib/types/provider';
```

**Step 2: Commit**

```bash
git add src/sidepanel/components/ModelSelector.tsx
git commit -m "refactor: 改造 ModelSelector 支持提供商联动"
```

---

## Task 9: 更新 App.tsx - 添加提供商状态

**Files:**
- Modify: `src/sidepanel/App.tsx`

**Step 1: 添加新的导入和状态**

在 `src/sidepanel/App.tsx` 顶部添加导入：
```typescript
import { ProviderSelector } from './components/ProviderSelector';
import { ChatService } from '../lib/services/chat-service';
import { ProviderStore } from '../lib/storage/provider-store';
import type { ProviderId } from '../lib/types/provider';
import { getDefaultModel } from '../lib/providers';
```

**Step 2: 添加新的状态变量**

在 App 组件的 state 声明区域添加：
```typescript
const [selectedProvider, setSelectedProvider] = useState<ProviderId>('openrouter');
const [configuredProviders, setConfiguredProviders] = useState<ProviderId[]>([]);
```

**Step 3: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "refactor: App 添加提供商状态"
```

---

## Task 10: 更新 App.tsx - 加载提供商配置

**Files:**
- Modify: `src/sidepanel/App.tsx`

**Step 1: 添加加载提供商配置的 useEffect**

```typescript
// 加载提供商配置
useEffect(() => {
  const loadProviderConfig = async () => {
    try {
      const [provider, model, apiKeys] = await Promise.all([
        ProviderStore.getSelectedProvider(),
        ProviderStore.getSelectedModel(),
        ProviderStore.getApiKeys(),
      ]);

      setSelectedProvider(provider);
      setSelectedModel(model);

      // 更新已配置的提供商列表
      const configured = Object.keys(apiKeys) as ProviderId[];
      setConfiguredProviders(configured);
    } catch (err) {
      console.error('Failed to load provider config:', err);
    }
  };

  loadProviderConfig();
}, []);
```

**Step 2: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "feat: 加载提供商配置"
```

---

## Task 11: 更新 App.tsx - 处理提供商切换

**Files:**
- Modify: `src/sidepanel/App.tsx`

**Step 1: 添加提供商切换处理函数**

```typescript
// 处理提供商切换
const handleProviderChange = useCallback(async (newProvider: ProviderId) => {
  // 检查是否已配置 API Key
  if (!configuredProviders.includes(newProvider)) {
    setShowSettings(true);
    setError({
      message: `请先配置 ${newProvider} 的 API Key`,
      timestamp: Date.now(),
      recoverable: true,
    });
    return;
  }

  setSelectedProvider(newProvider);

  // 切换到该提供商的默认模型
  const defaultModel = getDefaultModel(newProvider);
  setSelectedModel(defaultModel);

  await ProviderStore.setSelectedProvider(newProvider);
  await ProviderStore.setSelectedModel(defaultModel);
}, [configuredProviders]);
```

**Step 2: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "feat: 添加提供商切换处理"
```

---

## Task 12: 更新 App.tsx - 改造发送消息逻辑

**Files:**
- Modify: `src/sidepanel/App.tsx`

**Step 1: 替换 handleSend 函数使用新的 ChatService**

找到并替换 `handleSend` 函数：
```typescript
const handleSend = useCallback(async (content: string) => {
  // 检查 API Key
  const apiKey = await ProviderStore.getApiKey(selectedProvider);
  if (!apiKey) {
    setError({
      message: `请先配置 ${selectedProvider} 的 API Key`,
      timestamp: Date.now(),
      recoverable: true,
    });
    setShowSettings(true);
    return;
  }

  if (!content.trim()) return;

  setLoading(true);
  setError(null);

  // 添加用户消息
  const userMessage: Message = {
    id: generateId(),
    role: 'user',
    content: content.trim(),
    timestamp: Date.now(),
  };

  setMessages((prev) => {
    const newMessages = [...prev, userMessage];
    saveMessages(newMessages);
    return newMessages;
  });

  // 准备 API 消息
  const apiMessages: ChatMessage[] = [
    { role: 'system', content: formatSystemPrompt() },
  ];

  // 添加上下文
  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  for (const msg of recentMessages) {
    apiMessages.push({ role: msg.role, content: msg.content });
  }

  // 检索记忆
  let relevantContext = '';
  if (memoryManagerRef.current?.isInitialized()) {
    try {
      relevantContext = await memoryManagerRef.current.searchRelevantContext(
        content.trim(),
        MEMORY_RETRIEVAL_K
      );
      if (relevantContext) {
        apiMessages.push({
          role: 'system',
          content: `以下是与当前对话相关的记忆：\n\n${relevantContext}`,
        });
      }
    } catch (err) {
      console.error('Failed to retrieve memories:', err);
    }
  }

  // 添加用户消息
  apiMessages.push({ role: 'user', content: content.trim() });

  // 创建 AbortController
  abortControllerRef.current = new AbortController();

  try {
    const assistantMessageId = generateId();
    let assistantContent = '';

    // 创建空助手消息
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setMessages((prev) => {
      const newMessages = [...prev, assistantMessage];
      saveMessages(newMessages);
      return newMessages;
    });

    // 使用新的 ChatService
    for await (const chunk of ChatService.streamChat(apiMessages, {
      providerId: selectedProvider,
      model: selectedModel,
      signal: abortControllerRef.current.signal,
    })) {
      if (abortControllerRef.current?.signal.aborted) {
        break;
      }

      assistantContent += chunk;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: assistantContent }
            : msg
        )
      );
    }

    // 保存记忆
    if (assistantContent.trim() && memoryManagerRef.current?.isInitialized()) {
      try {
        await memoryManagerRef.current.addMemory(
          `用户: ${content.trim()}\n助手: ${assistantContent.trim()}`,
          { sessionId: 'current' }
        );
        const count = await memoryManagerRef.current.getMemoryCount();
        setMemoryCount(count);
      } catch (err) {
        console.error('Failed to save memory:', err);
      }
    }

  } catch (err) {
    console.error('Chat error:', err);
    const errorMessage = err instanceof Error ? err.message : '发生未知错误';

    setError({
      message: errorMessage,
      timestamp: Date.now(),
      recoverable: !errorMessage.includes('API Key'),
    });

    // 添加错误消息
    const errorSystemMessage: Message = {
      id: generateId(),
      role: 'system',
      content: `错误: ${errorMessage}`,
      timestamp: Date.now(),
    };
    setMessages((prev) => {
      const newMessages = [...prev, errorSystemMessage];
      saveMessages(newMessages);
      return newMessages;
    });
  } finally {
    setLoading(false);
    abortControllerRef.current = null;
  }
}, [selectedProvider, selectedModel, messages, saveMessages, configuredProviders]);
```

**Step 2: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "refactor: 使用 ChatService 替换原有 OpenRouter 客户端"
```

---

## Task 13: 更新 App.tsx - 更新头部 UI

**Files:**
- Modify: `src/sidepanel/App.tsx`

**Step 1: 更新头部添加提供商选择器**

找到 header 部分，在 ModelSelector 之前添加 ProviderSelector：
```typescript
{/* 标题和提供商/模型选择器 */}
<div className="flex items-center gap-2">
  <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
    Browser Pal
  </h1>

  {/* 提供商选择器 */}
  <div className="hidden sm:block">
    <ProviderSelector
      value={selectedProvider}
      onChange={handleProviderChange}
      configuredProviders={configuredProviders}
    />
  </div>

  {/* 模型选择器 */}
  <div className="hidden sm:block">
    <ModelSelector
      providerId={selectedProvider}
      value={selectedModel}
      onChange={(model) => {
        setSelectedModel(model);
        ProviderStore.setSelectedModel(model);
      }}
    />
  </div>
</div>
```

**Step 2: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "feat: 头部添加提供商和模型选择器"
```

---

## Task 14: 更新设置面板 - 多提供商配置

**Files:**
- Modify: `src/sidepanel/App.tsx`

**Step 1: 更新 SettingsModal 组件**

找到 SettingsModal 组件，在 API Key 配置部分添加多提供商支持：

首先添加状态来跟踪输入：
```typescript
const [providerApiKeys, setProviderApiKeys] = useState<Record<string, string>>({});
```

然后在 API Key 配置区域替换为：
```typescript
{/* API Key 配置 */}
<div>
  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
    <Key className="w-4 h-4" />
    API 密钥配置
  </label>

  <div className="space-y-4">
    {/* OpenAI */}
    <div>
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">OpenAI</div>
      <div className="flex gap-2">
        <input
          type="password"
          value={providerApiKeys.openai || ''}
          onChange={(e) => setProviderApiKeys(prev => ({ ...prev, openai: e.target.value }))}
          placeholder="sk-..."
          className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm"
        />
        <button
          onClick={() => handleSaveProviderKey('openai', providerApiKeys.openai)}
          disabled={!providerApiKeys.openai?.trim()}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
        >
          保存
        </button>
        {configuredProviders.includes('openai') && (
          <button
            onClick={() => handleClearProviderKey('openai')}
            className="px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors text-sm"
          >
            清除
          </button>
        )}
      </div>
      {configuredProviders.includes('openai') && (
        <div className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <Check className="w-3 h-3" /> 已配置
        </div>
      )}
    </div>

    {/* Anthropic */}
    <div>
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">Anthropic</div>
      <div className="flex gap-2">
        <input
          type="password"
          value={providerApiKeys.anthropic || ''}
          onChange={(e) => setProviderApiKeys(prev => ({ ...prev, anthropic: e.target.value }))}
          placeholder="sk-ant-..."
          className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm"
        />
        <button
          onClick={() => handleSaveProviderKey('anthropic', providerApiKeys.anthropic)}
          disabled={!providerApiKeys.anthropic?.trim()}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
        >
          保存
        </button>
        {configuredProviders.includes('anthropic') && (
          <button
            onClick={() => handleClearProviderKey('anthropic')}
            className="px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors text-sm"
          >
            清除
          </button>
        )}
      </div>
      {configuredProviders.includes('anthropic') && (
        <div className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <Check className="w-3 h-3" /> 已配置
        </div>
      )}
    </div>

    {/* OpenRouter */}
    <div>
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">OpenRouter</div>
      <div className="flex gap-2">
        <input
          type="password"
          value={providerApiKeys.openrouter || ''}
          onChange={(e) => setProviderApiKeys(prev => ({ ...prev, openrouter: e.target.value }))}
          placeholder="sk-or-..."
          className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm"
        />
        <button
          onClick={() => handleSaveProviderKey('openrouter', providerApiKeys.openrouter)}
          disabled={!providerApiKeys.openrouter?.trim()}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
        >
          保存
        </button>
        {configuredProviders.includes('openrouter') && (
          <button
            onClick={() => handleClearProviderKey('openrouter')}
            className="px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors text-sm"
          >
            清除
          </button>
        )}
      </div>
      {configuredProviders.includes('openrouter') && (
        <div className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <Check className="w-3 h-3" /> 已配置
        </div>
      )}
    </div>
  </div>

  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
    从各提供商官网获取 API Key
  </p>
</div>
```

**Step 2: 添加处理函数**

```typescript
// 保存提供商 API Key
const handleSaveProviderKey = useCallback(async (providerId: string, apiKey: string) => {
  if (apiKey?.trim()) {
    await ProviderStore.setApiKey(providerId as ProviderId, apiKey.trim());

    // 更新已配置列表
    const apiKeys = await ProviderStore.getApiKeys();
    const configured = Object.keys(apiKeys) as ProviderId[];
    setConfiguredProviders(configured);

    // 如果是第一个配置的提供商，设为当前选中
    if (configured.length === 1) {
      setSelectedProvider(providerId as ProviderId);
      await ProviderStore.setSelectedProvider(providerId as ProviderId);
      const defaultModel = getDefaultModel(providerId as ProviderId);
      setSelectedModel(defaultModel);
      await ProviderStore.setSelectedModel(defaultModel);
    }
  }
}, []);

// 清除提供商 API Key
const handleClearProviderKey = useCallback(async (providerId: string) => {
  await ProviderStore.removeApiKey(providerId as ProviderId);

  // 更新已配置列表
  const apiKeys = await ProviderStore.getApiKeys();
  const configured = Object.keys(apiKeys) as ProviderId[];
  setConfiguredProviders(configured);

  // 如果清除的是当前提供商，切换到另一个
  if (selectedProvider === providerId && configured.length > 0) {
    const newProvider = configured[0];
    setSelectedProvider(newProvider);
    await ProviderStore.setSelectedProvider(newProvider);
    const defaultModel = getDefaultModel(newProvider);
    setSelectedModel(defaultModel);
    await ProviderStore.setSelectedModel(defaultModel);
  }
}, [selectedProvider]);
```

**Step 3: 添加 useEffect 加载现有 API Keys**

```typescript
// 加载提供商 API Keys 用于设置面板
useEffect(() => {
  const loadApiKeysForSettings = async () => {
    const apiKeys = await ProviderStore.getApiKeys();
    setProviderApiKeys(apiKeys);
  };

  if (showSettings) {
    loadApiKeysForSettings();
  }
}, [showSettings]);
```

**Step 4: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "feat: 设置面板支持多提供商 API Key 配置"
```

---

## Task 15: 更新设置面板 - 显示当前使用

**Files:**
- Modify: `src/sidepanel/App.tsx`

**Step 1: 在设置面板添加当前使用显示**

在模型选择下方添加：
```typescript
{/* 分割线 */}
<hr className="border-gray-200 dark:border-gray-700" />

{/* 当前使用 */}
<div>
  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    当前使用
  </div>
  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
    {PROVIDERS[selectedProvider].name} - {getProviderModels(selectedProvider).find(m => m.id === selectedModel)?.name || selectedModel}
  </div>
</div>
```

**Step 2: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "feat: 设置面板显示当前使用的提供商和模型"
```

---

## Task 16: 迁移现有 OpenRouter 配置

**Files:**
- Modify: `src/sidepanel/App.tsx`

**Step 1: 添加迁移逻辑**

在组件挂载时添加一次性迁移：
```typescript
// 迁移现有的 OpenRouter API Key
useEffect(() => {
  const migrateExistingConfig = async () => {
    try {
      // 检查是否已经迁移过
      const migrated = await chrome.storage.local.get('openrouter_migrated');
      if (migrated.openrouter_migrated) {
        return;
      }

      // 读取旧的 OpenRouter API Key
      const oldKey = await chrome.storage.local.get('openrouter_api_key');
      if (oldKey.openrouter_api_key) {
        // 迁移到新结构
        await ProviderStore.setApiKey('openrouter', oldKey.openrouter_api_key as string);

        // 删除旧键
        await chrome.storage.local.remove('openrouter_api_key');

        // 标记已迁移
        await chrome.storage.local.set({ openrouter_migrated: true });

        console.log('Migrated existing OpenRouter API Key');
      }
    } catch (err) {
      console.error('Failed to migrate config:', err);
    }
  };

  migrateExistingConfig();
}, []);
```

**Step 2: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "feat: 添加现有 OpenRouter 配置迁移逻辑"
```

---

## Task 17: 添加单元测试

**Files:**
- Create: `src/lib/providers/config.test.ts`
- Create: `src/lib/storage/provider-store.test.ts`

**Step 1: 创建配置测试**

Create `src/lib/providers/config.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { PROVIDERS, getProviderConfig, getAllProviders, getProviderModels, isValidProvider, isValidModel } from './config';

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
```

**Step 2: 创建存储测试**

Create `src/lib/storage/provider-store.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderStore } from './provider-store';

// Mock chrome.storage.local
const mockStorage = new Map<string, unknown>();

vi.mock('../chrome-extension', () => ({
  chrome: {
    storage: {
      local: {
        get: vi.fn((keys) => {
          const result: Record<string, unknown> = {};
          if (typeof keys === 'string') {
            if (mockStorage.has(keys)) {
              result[keys] = mockStorage.get(keys);
            }
          } else if (Array.isArray(keys)) {
            keys.forEach(key => {
              if (mockStorage.has(key)) {
                result[key] = mockStorage.get(key);
              }
            });
          }
          return Promise.resolve(result);
        }),
        set: vi.fn((items) => {
          Object.entries(items).forEach(([key, value]) => {
            mockStorage.set(key, value);
          });
          return Promise.resolve();
        }),
        remove: vi.fn((keys) => {
          if (typeof keys === 'string') {
            mockStorage.delete(keys);
          } else if (Array.isArray(keys)) {
            keys.forEach(key => mockStorage.delete(key));
          }
          return Promise.resolve();
        }),
      },
    },
  },
}));

// 声明 chrome 全局变量
declare global {
  const chrome: typeof import('../chrome-extension').chrome;
}

describe('ProviderStore', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  describe('getApiKeys', () => {
    it('should return empty object when no keys stored', async () => {
      const keys = await ProviderStore.getApiKeys();
      expect(keys).toEqual({});
    });

    it('should return stored API keys', async () => {
      mockStorage.set('provider_api_keys', { openai: 'sk-test' });
      const keys = await ProviderStore.getApiKeys();
      expect(keys).toEqual({ openai: 'sk-test' });
    });
  });

  describe('setApiKey', () => {
    it('should store API key for provider', async () => {
      await ProviderStore.setApiKey('openai', 'sk-test');
      expect(mockStorage.get('provider_api_keys')).toEqual({ openai: 'sk-test' });
    });

    it('should preserve existing keys when adding new one', async () => {
      mockStorage.set('provider_api_keys', { anthropic: 'sk-ant-test' });
      await ProviderStore.setApiKey('openai', 'sk-test');
      expect(mockStorage.get('provider_api_keys')).toEqual({
        anthropic: 'sk-ant-test',
        openai: 'sk-test',
      });
    });
  });

  describe('removeApiKey', () => {
    it('should remove API key for provider', async () => {
      mockStorage.set('provider_api_keys', { openai: 'sk-test', anthropic: 'sk-ant-test' });
      await ProviderStore.removeApiKey('openai');
      expect(mockStorage.get('provider_api_keys')).toEqual({ anthropic: 'sk-ant-test' });
    });
  });

  describe('getSelectedProvider', () => {
    it('should return default provider when none stored', async () => {
      const provider = await ProviderStore.getSelectedProvider();
      expect(provider).toBe('openrouter');
    });

    it('should return stored provider', async () => {
      mockStorage.set('selected_provider', 'openai');
      const provider = await ProviderStore.getSelectedProvider();
      expect(provider).toBe('openai');
    });
  });
});
```

**Step 3: 运行测试**

Run:
```bash
npm test
```

Expected: 所有测试通过

**Step 4: Commit**

```bash
git add src/lib/providers/config.test.ts src/lib/storage/provider-store.test.ts
git commit -m "test: 添加提供商和存储单元测试"
```

---

## Task 18: 构建验证

**Files:**
- None (build verification)

**Step 1: 运行构建**

Run:
```bash
npm run build
```

Expected: 构建成功，无 TypeScript 错误

**Step 2: 运行 Lint**

Run:
```bash
npm run lint
```

Expected: 无 lint 错误

**Step 3: Commit**

```bash
git commit --allow-empty -m "chore: 验证构建和 lint 通过"
```

---

## Task 19: 更新 README 文档

**Files:**
- Modify: `README.md`

**Step 1: 更新特性说明**

在 README.md 中更新特性部分：
```markdown
## ✨ 特性

### 🎯 核心功能
- **原生 Chrome SidePanel API** - 集成 Chrome 原生侧边栏
- **多提供商支持** - 支持 OpenAI、Anthropic、OpenRouter
- **Vercel AI SDK** - 统一接口，流畅切换
- **SSE 流式响应** - 实时流式聊天体验
- **本地记忆系统** - 基于 LangChain.js + IndexedDB
- **全局快捷键** - `Cmd/Ctrl+Shift+L` 快速打开/关闭
```

**Step 2: 添加配置说明**

```markdown
### 配置 API Keys

1. 打开侧边栏
2. 点击右上角设置图标
3. 在 "API 密钥配置" 部分配置你想使用的提供商：

**OpenAI**
- 访问 [platform.openai.com](https://platform.openai.com/api-keys)
- 创建 API Key
- 粘贴到输入框并保存

**Anthropic**
- 访问 [console.anthropic.com](https://console.anthropic.com/)
- 创建 API Key
- 粘贴到输入框并保存

**OpenRouter**
- 访问 [openrouter.ai/keys](https://openrouter.ai/keys)
- 创建 API Key
- 粘贴到输入框并保存

4. 配置完成后，在顶部选择器中切换提供商和模型
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: 更新 README 多提供商说明"
```

---

## Task 20: 最终验证和清理

**Files:**
- Modify: `src/lib/openai.ts` (可选：标记为废弃)

**Step 1: 标记旧文件为废弃（可选）**

在 `src/lib/openai.ts` 顶部添加：
```typescript
/**
 * @deprecated 请使用 src/lib/services/chat-service.ts 替代
 * 此文件保留用于向后兼容，将在未来版本中移除
 */
```

**Step 2: 最终测试**

Run:
```bash
npm test
npm run build
npm run lint
```

Expected: 全部通过

**Step 3: Commit**

```bash
git add src/lib/openai.ts
git commit -m "chore: 标记旧 OpenRouter 客户端为废弃"
```

---

## 完成检查清单

- [ ] 所有任务完成
- [ ] 测试全部通过
- [ ] 构建成功
- [ ] 无 lint 错误
- [ ] README 更新
- [ ] 向后兼容（现有配置可迁移）

---

## 总结

完成所有任务后，你的 Chrome 扩展将支持：

1. **三个 AI 提供商**：OpenAI、Anthropic、OpenRouter
2. **统一接口**：使用 Vercel AI SDK
3. **流畅切换**：提供商和模型联动选择
4. **独立配置**：每个提供商独立 API Key 管理
5. **向后兼容**：自动迁移现有 OpenRouter 配置
