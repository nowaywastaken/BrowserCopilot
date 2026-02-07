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
// 类型定义（保留用于向后兼容）
// ============================================================================

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
