# 多提供商 AI 聊天助手设计文档

**日期**: 2026-02-05
**项目**: Browser Pal - Chrome 侧边栏 AI 助手
**目标**: 支持多个 AI 提供商（OpenAI、Anthropic、OpenRouter）

## 一、概述

将现有的 OpenRouter 单提供商架构改造为支持多提供商的统一架构，使用 Vercel AI SDK 作为统一接口层。

### 支持的提供商

| 提供商 | 说明 | 主要模型 |
|--------|------|----------|
| OpenAI | 官方 API | GPT-4o、GPT-4o Mini、o1-preview、o1-mini |
| Anthropic | 官方 API | Claude 3.5 Sonnet、Claude 3 Opus、Claude 3 Haiku |
| OpenRouter | 聚合平台 | 所有主流模型（通过 OpenRouter） |

### 核心技术

- **Vercel AI SDK**: 统一的多提供商接口 (`ai` 包)
- **Chrome Storage Local**: 持久化存储
- **React 18**: UI 框架
- **TypeScript**: 类型安全

## 二、架构设计

### 2.1 项目结构

```
src/lib/
├── providers/
│   ├── index.ts              # 提供商工厂和注册表
│   ├── openai.ts             # OpenAI 配置
│   ├── anthropic.ts          # Anthropic 配置
│   └── openrouter.ts         # OpenRouter 配置
├── types/
│   └── chat.ts               # 聊天类型定义
└── storage/
    └── provider-store.ts     # Chrome Storage 封装

src/sidepanel/
├── components/
│   ├── ProviderSelector.tsx  # 提供商选择器（新增）
│   └── ModelSelector.tsx     # 模型选择器（改造）
└── App.tsx                   # 主应用（集成新逻辑）
```

### 2.2 核心接口

```typescript
// 提供商配置
interface ProviderConfig {
  id: string;
  name: string;
  baseURL?: string;
  models: AIModel[];
}

// 统一的模型格式
interface AIModel {
  id: string;
  name: string;
  provider: string;
}

// 存储结构
interface StoredSettings {
  providerApiKeys: {
    openai?: string;
    anthropic?: string;
    openrouter?: string;
  };
  selectedProvider: 'openai' | 'anthropic' | 'openrouter';
  selectedModel: string;
  messages: Message[];
  darkMode: boolean;
}
```

### 2.3 数据流

```
用户选择提供商
      ↓
ProviderSelector 更新 selectedProvider
      ↓
ModelSelector 根据 selectedProvider 显示对应模型
      ↓
用户选择模型 → 更新 selectedModel
      ↓
发送消息时，根据 selectedProvider 和 selectedModel
      ↓
创建对应的 Vercel AI SDK 实例
      ↓
streamText() 统一调用
      ↓
流式渲染响应
```

## 三、UI 设计

### 3.1 头部布局

```
┌─────────────────────────────────────────────────────────┐
│ [BP] Browser Pal  [OpenAI ▼] [GPT-4o ▼]  [🧠3] [🌙] [⚙️] │
└─────────────────────────────────────────────────────────┘
     Logo          提供商选择   模型选择    记忆 主题 设置
```

### 3.2 设置面板

```
┌────────────────────────────────────────┐
│ 设置                            [×]    │
├────────────────────────────────────────┤
│ 🔑 API 密钥配置                         │
│                                        │
│ OpenAI              [输入框] [保存]    │
│ ✓ 已配置                          [清除]│
│                                        │
│ Anthropic           [输入框] [保存]    │
│ ⚠ 未配置                            │
│                                        │
│ OpenRouter          [输入框] [保存]    │
│ ✓ 已配置                          [清除]│
│                                        │
├────────────────────────────────────────┤
│ 当前使用：OpenAI - GPT-4o              │
├────────────────────────────────────────┤
│ 记忆存储                3 条记忆        │
│                                        │
│ [清除所有数据]                         │
└────────────────────────────────────────┘
```

## 四、Vercel AI SDK 集成

### 4.1 依赖安装

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic
```

### 4.2 提供商实例创建

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

function createProviderInstance(providerId: string, apiKey: string) {
  switch (providerId) {
    case 'openai':
      return openai({ apiKey });
    case 'anthropic':
      return anthropic({ apiKey });
    case 'openrouter':
      return createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
      });
  }
}
```

### 4.3 统一调用接口

```typescript
import { streamText } from 'ai';

async function* streamChat(
  providerId: string,
  model: string,
  messages: ChatMessage[]
) {
  const apiKey = await getApiKey(providerId);
  const provider = createProviderInstance(providerId, apiKey);

  const result = streamText({
    model: provider(model),
    messages,
  });

  for await (const chunk of result.textStream) {
    yield chunk;
  }
}
```

## 五、错误处理

| 错误类型 | 处理策略 |
|----------|----------|
| NO_API_KEY | 提示配置 API Key，打开设置面板 |
| INVALID_API_KEY | 显示错误信息，引导重新配置 |
| NETWORK_ERROR | 自动重试（3次），显示重试状态 |
| QUOTA_EXCEEDED | 提示配额用完，建议检查账户 |

## 六、实施步骤

### 阶段一：基础设施
1. 安装 Vercel AI SDK 依赖
2. 创建 `src/lib/providers/` 目录结构
3. 实现提供商配置和注册表
4. 实现 Chrome Storage 封装

### 阶段二：核心功能
1. 实现提供商工厂函数
2. 改造 App.tsx 的聊天逻辑
3. 替换现有 OpenRouter 客户端为 Vercel AI SDK
4. 添加提供商切换逻辑

### 阶段三：UI 组件
1. 创建 ProviderSelector 组件
2. 改造 ModelSelector 组件支持联动
3. 更新设置面板支持多提供商配置
4. 更新头部布局

### 阶段四：测试和优化
1. 单元测试
2. 集成测试
3. 错误处理验证
4. 性能优化

## 七、向后兼容

- 保留现有的 OpenRouter 配置和数据
- 默认提供商设为 OpenRouter（现有行为）
- 自动迁移现有存储结构

## 八、未来扩展

- 添加更多提供商（Google Gemini、Mistral 等）
- 支持自定义 API 端点
- 添加提供商使用统计
- 支持多提供商并行对比
