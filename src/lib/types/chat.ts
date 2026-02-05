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
