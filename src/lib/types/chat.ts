/**
 * 聊天相关类型
 *
 * 注意：部分类型（MessageRole, ChatMessage, ToolCall, ToolDefinition）
 * 在现有代码库中已定义于 src/lib/openai.ts
 * 此文件提供统一导出，用于 Vercel AI SDK 集成
 */

// 导入现有类型
import type { MessageRole, ChatMessage, ToolCall, ToolDefinition } from '../openai';

// 重新导出以提供统一访问点
export type { MessageRole, ChatMessage, ToolCall, ToolDefinition };

/** 聊天选项 - 扩展自现有 RequestConfig */
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  signal?: AbortSignal;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}
