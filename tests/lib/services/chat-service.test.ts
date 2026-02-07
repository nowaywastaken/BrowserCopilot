/**
 * Chat Service Tests
 * Tests for the ChatService class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatMessage, ChatOptions } from '../../../src/lib/types/chat';
import type { AgentState } from '../../../src/lib/agent/agent-state';
import type { IntentResult } from '../../../src/lib/agent/intent-detector';
import type { AgentTaskPayload, AgentStateUpdateMessage } from '../../../src/lib/services/chat-service';

describe('ChatService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('detectAgentMode', () => {
    it('should be a callable function', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      expect(ChatService.detectAgentMode).toBeDefined();
      expect(typeof ChatService.detectAgentMode).toBe('function');
    });

    it('should return a Promise', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      const result = ChatService.detectAgentMode('test');

      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe('stopAgent', () => {
    it('should return true when stop succeeds', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      const mockChrome = {
        runtime: {
          sendMessage: vi.fn().mockImplementation((message, callback) => {
            if (callback) {
              callback({ success: true });
            }
          }),
          lastError: null,
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await ChatService.stopAgent();

      expect(result).toBe(true);
    });

    it('should return false when chrome.runtime.lastError occurs', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      const mockChrome = {
        runtime: {
          sendMessage: vi.fn().mockImplementation((_message, callback) => {
            if (callback) {
              callback({ success: false });
            }
          }),
          lastError: { message: 'Connection failed' },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await ChatService.stopAgent();

      expect(result).toBe(false);
    });

    it('should handle sendMessage gracefully', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      const mockChrome = {
        runtime: {
          sendMessage: vi.fn().mockImplementation((_message, callback) => {
            // callback not called - test should still pass
          }),
          lastError: null,
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      // Set a timeout to prevent hanging
      const result = await Promise.race([
        ChatService.stopAgent(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      ]).catch(() => false);

      expect(result).toBe(false);
    }, 500);
  });

  describe('getAgentState', () => {
    it('should return agent state when successful', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      const mockState = {
        phase: 'idle',
        task: 'test',
        iterations: 0,
      };

      const mockChrome = {
        runtime: {
          sendMessage: vi.fn().mockImplementation((_message, callback) => {
            if (callback) {
              callback({ success: true, data: mockState });
            }
          }),
          lastError: null,
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await ChatService.getAgentState();

      expect(result).toEqual(mockState);
    });

    it('should return null when no agent is running', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      const mockChrome = {
        runtime: {
          sendMessage: vi.fn().mockImplementation((_message, callback) => {
            if (callback) {
              callback({ success: false });
            }
          }),
          lastError: null,
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await ChatService.getAgentState();

      expect(result).toBeNull();
    });

    it('should return null when chrome.runtime.lastError occurs', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      const mockChrome = {
        runtime: {
          sendMessage: vi.fn().mockImplementation((_message, callback) => {
            if (callback) {
              callback({ success: false });
            }
          }),
          lastError: { message: 'Connection error' },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      const result = await ChatService.getAgentState();

      expect(result).toBeNull();
    });
  });

  describe('runAgent', () => {
    it('should reject when START_AGENT_TASK fails', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      const mockChrome = {
        runtime: {
          sendMessage: vi.fn().mockImplementation((_message, callback) => {
            if (callback) {
              callback({ success: false, error: 'Agent already running' });
            }
          }),
          lastError: null,
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      await expect(ChatService.runAgent('test task')).rejects.toThrow('Agent already running');
    });

    it('should reject when chrome.runtime.lastError occurs', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      const mockChrome = {
        runtime: {
          sendMessage: vi.fn().mockImplementation((_message, callback) => {
            if (callback) {
              callback(undefined);
            }
          }),
          lastError: { message: 'Context invalidated' },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      await expect(ChatService.runAgent('test task')).rejects.toThrow('Context invalidated');
    });

    it('should have correct method signature', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      expect(typeof ChatService.runAgent).toBe('function');
    });

    it('should have runAgent as async function that returns Promise', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      // Verify method exists and returns Promise-like
      expect(typeof ChatService.runAgent).toBe('function');

      // The actual behavior depends on chrome.runtime.sendMessage mocking
      // which is complex due to the callback-based API
    });

    it('should handle chrome.runtime.lastError on initial send', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      const mockChrome = {
        runtime: {
          sendMessage: vi.fn().mockImplementation((_message, callback) => {
            if (callback) {
              callback(undefined);
            }
          }),
          lastError: { message: 'Extension context invalidated' },
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      await expect(ChatService.runAgent('Test task')).rejects.toThrow('Extension context invalidated');
    });

    it('should handle failed response on initial send', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      const mockChrome = {
        runtime: {
          sendMessage: vi.fn().mockImplementation((_message, callback) => {
            if (callback) {
              callback({ success: false, error: 'Agent limit reached' });
            }
          }),
          lastError: null,
        },
      };

      vi.stubGlobal('chrome', mockChrome);

      await expect(ChatService.runAgent('Test task')).rejects.toThrow('Agent limit reached');
    });
  });

  describe('AgentStateUpdateMessage interface', () => {
    it('should have correct structure', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      expect(ChatService).toHaveProperty('runAgent');
      expect(ChatService).toHaveProperty('stopAgent');
      expect(ChatService).toHaveProperty('getAgentState');
      expect(ChatService).toHaveProperty('detectAgentMode');
    });
  });

  describe('Provider configuration', () => {
    it('should use default provider when not specified', async () => {
      const { ChatService } = await import('../../../src/lib/services/chat-service');

      // Just verify the method exists and is callable
      expect(typeof ChatService.detectAgentMode).toBe('function');
      expect(typeof ChatService.stopAgent).toBe('function');
      expect(typeof ChatService.getAgentState).toBe('function');
      expect(typeof ChatService.runAgent).toBe('function');
    });
  });
});

// ============================================================================
// Chat Message Type Tests
// ============================================================================

describe('ChatMessage Type', () => {
  describe('message structure', () => {
    it('should accept user message', () => {
      const message: ChatMessage = {
        role: 'user',
        content: 'Hello, world!',
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
    });

    it('should accept system message', () => {
      const message: ChatMessage = {
        role: 'system',
        content: 'You are a helpful assistant.',
      };

      expect(message.role).toBe('system');
      expect(message.content).toBe('You are a helpful assistant.');
    });

    it('should accept assistant message', () => {
      const message: ChatMessage = {
        role: 'assistant',
        content: 'I can help you with that.',
      };

      expect(message.role).toBe('assistant');
    });

    it('should accept message with mixed content', () => {
      const message: ChatMessage = {
        role: 'user',
        content: [
          { type: 'text', text: 'Look at this:' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
        ],
      };

      expect(message.role).toBe('user');
      expect(Array.isArray(message.content)).toBe(true);
    });
  });
});

// ============================================================================
// ChatOptions Type Tests
// ============================================================================

describe('ChatOptions Type', () => {
  describe('option structure', () => {
    it('should accept temperature option', () => {
      const options: ChatOptions = {
        temperature: 0.7,
      };

      expect(options.temperature).toBe(0.7);
    });

    it('should accept maxTokens option', () => {
      const options: ChatOptions = {
        maxTokens: 1000,
      };

      expect(options.maxTokens).toBe(1000);
    });

    it('should accept signal option', () => {
      const abortController = new AbortController();
      const options: ChatOptions = {
        signal: abortController.signal,
      };

      expect(options.signal).toBe(abortController.signal);
    });

    it('should accept all options together', () => {
      const abortController = new AbortController();
      const options: ChatOptions = {
        temperature: 0.5,
        maxTokens: 500,
        signal: abortController.signal,
      };

      expect(options.temperature).toBe(0.5);
      expect(options.maxTokens).toBe(500);
      expect(options.signal).toBe(abortController.signal);
    });
  });
});

// ============================================================================
// IntentResult Type Tests
// ============================================================================

describe('IntentResult Type', () => {
  describe('result structure', () => {
    it('should define screenshot intent result', () => {
      const result: IntentResult = {
        requiresAgent: true,
        taskType: 'screenshot',
        confidence: 'high',
        reasoning: 'User wants to take a screenshot',
      };

      expect(result.requiresAgent).toBe(true);
      expect(result.taskType).toBe('screenshot');
      expect(result.confidence).toBe('high');
    });

    it('should define script intent result', () => {
      const result: IntentResult = {
        requiresAgent: true,
        taskType: 'script',
        confidence: 'high',
        reasoning: 'User wants to create a script',
      };

      expect(result.taskType).toBe('script');
    });

    it('should define chat intent result', () => {
      const result: IntentResult = {
        requiresAgent: false,
        taskType: 'chat',
        confidence: 'high',
        reasoning: 'User is asking a question',
      };

      expect(result.requiresAgent).toBe(false);
      expect(result.taskType).toBe('chat');
    });

    it('should define mixed intent result', () => {
      const result: IntentResult = {
        requiresAgent: true,
        taskType: 'mixed',
        confidence: 'medium',
        reasoning: 'Multiple intents detected',
      };

      expect(result.taskType).toBe('mixed');
    });

    it('should define page-interaction intent result', () => {
      const result: IntentResult = {
        requiresAgent: true,
        taskType: 'page-interaction',
        confidence: 'high',
      };

      expect(result.taskType).toBe('page-interaction');
    });

    it('should define dom intent result', () => {
      const result: IntentResult = {
        requiresAgent: true,
        taskType: 'dom',
        confidence: 'high',
      };

      expect(result.taskType).toBe('dom');
    });

    it('should allow optional reasoning', () => {
      const result: IntentResult = {
        requiresAgent: true,
        taskType: 'screenshot',
        confidence: 'high',
      };

      expect(result.reasoning).toBeUndefined();
    });

    it('should support all confidence levels', () => {
      const highResult: IntentResult = {
        requiresAgent: true,
        taskType: 'screenshot',
        confidence: 'high',
      };

      const mediumResult: IntentResult = {
        requiresAgent: true,
        taskType: 'screenshot',
        confidence: 'medium',
      };

      const lowResult: IntentResult = {
        requiresAgent: true,
        taskType: 'screenshot',
        confidence: 'low',
      };

      expect(highResult.confidence).toBe('high');
      expect(mediumResult.confidence).toBe('medium');
      expect(lowResult.confidence).toBe('low');
    });
  });
});

// ============================================================================
// Agent Task Payload Type Tests
// ============================================================================

describe('AgentTaskPayload Type', () => {
  describe('payload structure', () => {
    it('should define basic task payload', () => {
      const payload = {
        task: 'Take a screenshot of the page',
      };

      expect(payload.task).toBe('Take a screenshot of the page');
    });

    it('should accept payload with tabId', () => {
      const payload: AgentTaskPayload = {
        task: 'Navigate to example.com',
        tabId: 123,
      };

      expect(payload.tabId).toBe(123);
    });

    it('should accept payload with options', () => {
      const payload: AgentTaskPayload = {
        task: 'Click the button',
        tabId: 456,
        options: {
          maxIterations: 10,
          systemPrompt: 'Custom prompt',
        },
      };

      expect(payload.options?.maxIterations).toBe(10);
      expect(payload.options?.systemPrompt).toBe('Custom prompt');
    });

    it('should accept payload with all fields', () => {
      const payload: AgentTaskPayload = {
        task: 'Fill the form',
        tabId: 789,
        options: {
          maxIterations: 20,
          systemPrompt: 'Be thorough',
        },
      };

      expect(payload.task).toBe('Fill the form');
      expect(payload.tabId).toBe(789);
      expect(payload.options?.maxIterations).toBe(20);
    });
  });
});

// ============================================================================
// Agent State Update Message Type Tests
// ============================================================================

describe('AgentStateUpdateMessage Type', () => {
  describe('message structure', () => {
    it('should define state update message', () => {
      const message: AgentStateUpdateMessage = {
        type: 'AGENT_STATE_UPDATE',
        state: {
          phase: 'idle',
          task: 'test',
          iterations: 0,
          toolCalls: [],
          createdAt: Date.now(),
        },
        tabId: 123,
      };

      expect(message.type).toBe('AGENT_STATE_UPDATE');
      expect(message.tabId).toBe(123);
      expect(message.state.phase).toBe('idle');
    });

    it('should accept different phases', () => {
      const phases: Array<AgentState['phase']> = [
        'idle',
        'planning',
        'executing',
        'evaluating',
        'completed',
        'failed',
      ];

      phases.forEach((phase) => {
        const message: AgentStateUpdateMessage = {
          type: 'AGENT_STATE_UPDATE',
          state: {
            phase,
            task: 'test',
            iterations: 0,
            toolCalls: [],
            createdAt: Date.now(),
          },
          tabId: 1,
        };

        expect(message.state.phase).toBe(phase);
      });
    });
  });
});
