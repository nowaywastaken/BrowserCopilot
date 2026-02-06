import { streamText, generateText } from 'ai';
import type { ChatMessage, ChatOptions } from '../types/chat';
import type { ProviderId } from '../types/provider';
import { createProviderInstance } from '../providers';
import { ProviderStore } from '../storage/provider-store';
import { detectIntent, type IntentResult } from '../agent/intent-detector';
import type { AgentState } from '../agent/agent-state';

// Re-export IntentResult for use by UI components
export type { IntentResult } from '../agent/intent-detector';

/**
 * Agent task start payload
 */
export interface AgentTaskPayload {
  task: string;
  tabId?: number;
  options?: {
    maxIterations?: number;
    systemPrompt?: string;
  };
}

/**
 * Agent state update message from background
 */
export interface AgentStateUpdateMessage {
  type: 'AGENT_STATE_UPDATE';
  state: AgentState;
  tabId: number;
}

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
      messages: messages as any, // Cast to AI SDK's CoreMessage type
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      abortSignal: options.signal,
    } as any);

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
      messages: messages as any, // Cast to AI SDK's CoreMessage type
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      abortSignal: options.signal,
    } as any);

    return result.text;
  }

  /**
   * Detect if a message indicates an agent mode request
   * Uses the intent detector to classify the user's intent
   *
   * @param message - The user's message to analyze
   * @returns Promise resolving to IntentResult with intent classification
   */
  static async detectAgentMode(message: string): Promise<IntentResult> {
    return detectIntent(message);
  }

  /**
   * Run an agent task in the background
   * Sends a START_AGENT_TASK message to the background script
   *
   * @param task - The task description for the agent
   * @param onStateUpdate - Optional callback for receiving state updates
   * @returns Promise resolving to the final agent state
   */
  static async runAgent(
    task: string,
    onStateUpdate?: (state: AgentState) => void
  ): Promise<AgentState> {
    return new Promise((resolve, reject) => {
      // Send message to start agent task
      chrome.runtime.sendMessage(
        {
          type: 'START_AGENT_TASK',
          payload: { task },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response || !response.success) {
            reject(new Error(response?.error || 'Failed to start agent task'));
            return;
          }

          // Set up listener for state updates
          const stateUpdateListener = (
            message: AgentStateUpdateMessage,
            _sender: chrome.runtime.MessageSender,
            _sendResponse: (response?: unknown) => void
          ): void => {
            if (message.type === 'AGENT_STATE_UPDATE' && onStateUpdate) {
              onStateUpdate(message.state);

              // Check if terminal state, then resolve or cleanup
              if (message.state.phase === 'completed' || message.state.phase === 'failed') {
                resolve(message.state);
              }
            }
          };

          // Add listener for state updates
          (chrome.runtime.onMessage as any).addListener(stateUpdateListener);

          // Set up a timeout to resolve if no terminal state is received
          const timeoutId = setTimeout(() => {
            (chrome.runtime.onMessage as any).removeListener(stateUpdateListener);
            // Try to get final state
            chrome.runtime.sendMessage(
              { type: 'GET_AGENT_STATE' },
              (stateResponse: { success: boolean; data?: AgentState }) => {
                if (stateResponse && stateResponse.success) {
                  resolve(stateResponse.data as AgentState);
                } else {
                  reject(new Error('Agent task timeout'));
                }
              }
            );
          }, 60000); // 60 second timeout

          // Prevent unused variable warning
          void timeoutId;
        }
      );
    });
  }

  /**
   * Stop the current agent task
   *
   * @returns Promise resolving to true if stopped successfully
   */
  static async stopAgent(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'STOP_AGENT_TASK' },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(response?.success ?? false);
        }
      );
    });
  }

  /**
   * Get the current agent state
   *
   * @returns Promise resolving to the current AgentState or null if no agent is running
   */
  static async getAgentState(): Promise<AgentState | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_AGENT_STATE' },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          if (response?.success) {
            resolve(response.data as AgentState);
          } else {
            resolve(null);
          }
        }
      );
    });
  }
}
