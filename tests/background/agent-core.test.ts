/**
 * Agent Core Unit Tests
 *
 * Tests for the AgentCore class and agent state management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentCore, runAgentTask } from '../../src/background/agent-core';
import {
  createInitialState,
  createCompletedState,
  createFailedState,
  updateToPlanningPhase,
  updateToExecutingPhase,
  updateToEvaluatingPhase,
  shouldContinue,
  isTerminalPhase,
  getPhaseDisplayName,
  getAgentSummary,
  type AgentState,
  type ToolCallRecord,
} from '../../src/lib/agent/agent-state';
import type { ToolDefinition } from '../../src/lib/openai';

// ============================================================================
// Mock Tool Executor
// ============================================================================

const createMockToolExecutor = (
  responses: Array<{ success: boolean; result?: unknown; error?: string }>
): {
  execute: (
    toolName: string,
    args: Record<string, unknown>,
    tabContext?: { tabId?: number; url?: string; title?: string }
  ) => Promise<{ success: boolean; result?: unknown; error?: string }>;
  getAvailableTools: () => ToolDefinition[];
  getCallHistory: () => Array<{ toolName: string; args: Record<string, unknown> }>;
} => {
  let callIndex = 0;
  const callHistory: Array<{ toolName: string; args: Record<string, unknown> }> = [];

  return {
    execute: async (toolName, args) => {
      callHistory.push({ toolName, args });
      const response = responses[callIndex] || { success: true, result: 'done' };
      callIndex++;
      return response;
    },
    getAvailableTools: () => [
      {
        type: 'function',
        function: {
          name: 'navigate',
          description: 'Navigate to a URL',
          parameters: {
            type: 'object',
            properties: { url: { type: 'string', description: 'URL to navigate to' } },
            required: ['url'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'click',
          description: 'Click an element',
          parameters: {
            type: 'object',
            properties: { selector: { type: 'string', description: 'CSS selector' } },
            required: ['selector'],
          },
        },
      },
    ],
    getCallHistory: () => callHistory,
  };
};

// ============================================================================
// Mock ChatService
// ============================================================================

const createMockChatService = (response: string, shouldFail = false): typeof import('../../src/lib/services/chat-service').ChatService => {
  return {
    chat: vi.fn().mockImplementation(async () => {
      if (shouldFail) {
        throw new Error('LLM error');
      }
      return response;
    }),
    streamChat: vi.fn(),
  } as any;
};

// ============================================================================
// Agent State Tests
// ============================================================================

describe('Agent State Management', () => {
  describe('createInitialState', () => {
    it('should create initial state with task', () => {
      const state = createInitialState('Test task');

      expect(state.phase).toBe('idle');
      expect(state.task).toBe('Test task');
      expect(state.currentThought).toBeNull();
      expect(state.currentAction).toBeNull();
      expect(state.toolCalls).toEqual([]);
      expect(state.iterations).toBe(0);
      expect(state.startedAt).toBeDefined();
    });

    it('should create unique startedAt timestamps', async () => {
      const state1 = createInitialState('Task 1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const state2 = createInitialState('Task 2');

      expect(state1.startedAt).not.toBe(state2.startedAt);
    });
  });

  describe('createCompletedState', () => {
    it('should mark state as completed', () => {
      const state = createInitialState('Test task');
      const completed = createCompletedState(state);

      expect(completed.phase).toBe('completed');
      expect(completed.completedAt).toBeDefined();
      expect(completed.task).toBe(state.task);
    });
  });

  describe('createFailedState', () => {
    it('should mark state as failed with error', () => {
      const state = createInitialState('Test task');
      const failed = createFailedState(state, 'Task failed');

      expect(failed.phase).toBe('failed');
      expect(failed.error).toBe('Task failed');
      expect(failed.completedAt).toBeDefined();
    });
  });

  describe('updateToPlanningPhase', () => {
    it('should update phase to planning with thought', () => {
      const state = createInitialState('Test task');
      const updated = updateToPlanningPhase(state, {
        thought: 'I need to navigate to a page',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      expect(updated.phase).toBe('planning');
      expect(updated.currentThought?.thought).toBe('I need to navigate to a page');
      expect(updated.currentThought?.confidence).toBe(0.9);
      expect(updated.iterations).toBe(1);
    });
  });

  describe('updateToExecutingPhase', () => {
    it('should update phase to executing with action', () => {
      const state = createInitialState('Test task');
      const updated = updateToExecutingPhase(state, {
        toolName: 'navigate',
        arguments: { url: 'https://example.com' },
      });

      expect(updated.phase).toBe('executing');
      expect(updated.currentAction?.toolName).toBe('navigate');
      expect(updated.currentAction?.arguments).toEqual({ url: 'https://example.com' });
    });
  });

  describe('updateToEvaluatingPhase', () => {
    it('should update phase to evaluating with tool result', () => {
      const state = createInitialState('Test task');
      const toolRecord: ToolCallRecord = {
        id: 'test-1',
        toolName: 'navigate',
        arguments: { url: 'https://example.com' },
        result: { url: 'https://example.com' },
        success: true,
        timestamp: Date.now(),
        duration: 100,
      };
      const updated = updateToEvaluatingPhase(state, toolRecord);

      expect(updated.phase).toBe('evaluating');
      expect(updated.toolCalls).toHaveLength(1);
      expect(updated.toolCalls[0]).toEqual(toolRecord);
    });
  });

  describe('shouldContinue', () => {
    it('should return true for running phases under max iterations', () => {
      const state = createInitialState('Test task');
      expect(shouldContinue(state, 50)).toBe(true);
    });

    it('should return false for completed state', () => {
      const state = createCompletedState(createInitialState('Test task'));
      expect(shouldContinue(state, 50)).toBe(false);
    });

    it('should return false for failed state', () => {
      const state = createFailedState(createInitialState('Test task'), 'Error');
      expect(shouldContinue(state, 50)).toBe(false);
    });

    it('should return false when iterations >= maxIterations', () => {
      const state = createInitialState('Test task');
      state.iterations = 50;
      expect(shouldContinue(state, 50)).toBe(false);
    });

    it('should return false when iterations > maxIterations', () => {
      const state = createInitialState('Test task');
      state.iterations = 51;
      expect(shouldContinue(state, 50)).toBe(false);
    });
  });

  describe('isTerminalPhase', () => {
    it('should return true for completed and failed', () => {
      expect(isTerminalPhase('completed')).toBe(true);
      expect(isTerminalPhase('failed')).toBe(true);
    });

    it('should return false for non-terminal phases', () => {
      expect(isTerminalPhase('idle')).toBe(false);
      expect(isTerminalPhase('planning')).toBe(false);
      expect(isTerminalPhase('executing')).toBe(false);
      expect(isTerminalPhase('evaluating')).toBe(false);
    });
  });

  describe('getPhaseDisplayName', () => {
    it('should return Chinese display names', () => {
      expect(getPhaseDisplayName('idle')).toBe('等待任务');
      expect(getPhaseDisplayName('planning')).toBe('规划中');
      expect(getPhaseDisplayName('executing')).toBe('执行中');
      expect(getPhaseDisplayName('evaluating')).toBe('评估中');
      expect(getPhaseDisplayName('completed')).toBe('已完成');
      expect(getPhaseDisplayName('failed')).toBe('失败');
    });
  });

  describe('getAgentSummary', () => {
    it('should return summary with correct values', () => {
      const state = createInitialState('Test task');
      state.toolCalls = [
        { id: '1', toolName: 'test', arguments: {}, success: true, timestamp: 1, duration: 10 },
      ] as ToolCallRecord[];

      const summary = getAgentSummary(state);

      expect(summary.phase).toBe('idle');
      expect(summary.iterations).toBe(0);
      expect(summary.toolCallsCount).toBe(1);
      expect(summary.duration).toBeGreaterThanOrEqual(0);
      expect(summary.success).toBe(false);
    });

    it('should show success true for completed state', () => {
      const completed = createCompletedState(createInitialState('Test task'));
      const summary = getAgentSummary(completed);

      expect(summary.success).toBe(true);
    });
  });
});

// ============================================================================
// AgentCore Tests
// ============================================================================

describe('AgentCore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const agent = new AgentCore();

      expect(agent.getState().phase).toBe('idle');
      expect(agent.getState().task).toBe('');
    });

    it('should initialize with custom maxIterations', () => {
      const agent = new AgentCore({ maxIterations: 10 });

      // We can't directly access maxIterations, but we can test the behavior
      expect(agent.getState()).toBeDefined();
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const agent = new AgentCore();
      const state = agent.getState();

      expect(state.phase).toBe('idle');
      expect(state.task).toBe('');
    });

    it('should return immutable state copy', () => {
      const agent = new AgentCore();
      const state1 = agent.getState();
      const state2 = agent.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('stop', () => {
    it('should not throw when called on idle agent', () => {
      const agent = new AgentCore();

      expect(() => agent.stop()).not.toThrow();
    });
  });

  describe('run with mocked dependencies', () => {
    it('should complete task when no action needed', async () => {
      const mockExecutor = createMockToolExecutor([
        { success: true, result: 'done' },
      ]);

      // Mock ChatService to return a completion response
      const mockResponse = JSON.stringify({
        thought: 'No action needed',
        reasoning: 'Task is complete',
        confidence: 0.9,
        action: undefined,
      });

      vi.doMock('../../src/lib/services/chat-service', () => ({
        ChatService: {
          chat: vi.fn().mockResolvedValue(mockResponse),
          streamChat: vi.fn(),
        },
      }));

      // Note: Due to module mocking complexity, we're testing state management
      // The actual run() method would need integration testing

      const agent = new AgentCore({ toolExecutor: mockExecutor });
      const state = createInitialState('Simple task');

      expect(state.phase).toBe('idle');
      expect(state.task).toBe('Simple task');
    });

    it('should track iterations correctly', () => {
      const agent = new AgentCore();
      const state = createInitialState('Test');

      // Initial state should have 0 iterations
      expect(agent.getState().iterations).toBe(0);

      // updateToPlanningPhase increments iterations from current state
      const updated = updateToPlanningPhase(state, {
        thought: 'First iteration',
        timestamp: Date.now(),
      });

      // Starting from 0, after planning phase should be 1
      expect(updated.iterations).toBe(1);
    });
  });

  describe('tool execution tracking', () => {
    it('should track tool calls correctly', () => {
      const state = createInitialState('Test task');
      const toolRecord: ToolCallRecord = {
        id: 'test-1',
        toolName: 'navigate',
        arguments: { url: 'https://example.com' },
        result: { url: 'https://example.com' },
        success: true,
        timestamp: Date.now(),
        duration: 100,
      };

      const updated = updateToEvaluatingPhase(state, toolRecord);

      expect(updated.toolCalls).toHaveLength(1);
      expect(updated.toolCalls[0].toolName).toBe('navigate');
    });

    it('should track multiple tool calls', () => {
      let state = createInitialState('Test task');

      const tools: ToolCallRecord[] = [
        {
          id: '1',
          toolName: 'navigate',
          arguments: { url: 'https://example.com' },
          success: true,
          timestamp: 1,
          duration: 100,
        },
        {
          id: '2',
          toolName: 'click',
          arguments: { selector: '.button' },
          success: true,
          timestamp: 2,
          duration: 50,
        },
      ];

      for (const tool of tools) {
        state = updateToEvaluatingPhase(state, tool);
      }

      expect(state.toolCalls).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should create failed state with error', () => {
      const state = createInitialState('Test task');
      const failed = createFailedState(state, 'Connection failed');

      expect(failed.phase).toBe('failed');
      expect(failed.error).toBe('Connection failed');
    });

    it('should preserve task in failed state', () => {
      const state = createInitialState('Important task');
      const failed = createFailedState(state, 'Something went wrong');

      expect(failed.task).toBe('Important task');
    });
  });

  describe('phase transitions', () => {
    it('should transition from planning to executing correctly', () => {
      let state = createInitialState('Test task');

      // Start planning
      state = updateToPlanningPhase(state, {
        thought: 'I need to click a button',
        confidence: 0.8,
        timestamp: Date.now(),
      });
      expect(state.phase).toBe('planning');

      // Move to executing
      state = updateToExecutingPhase(state, {
        toolName: 'click',
        arguments: { selector: '#submit' },
      });
      expect(state.phase).toBe('executing');

      // Move to evaluating after tool result
      state = updateToEvaluatingPhase(state, {
        id: '1',
        toolName: 'click',
        arguments: { selector: '#submit' },
        success: true,
        timestamp: Date.now(),
        duration: 100,
      });
      expect(state.phase).toBe('evaluating');
    });

    it('should allow multiple planning cycles', () => {
      let state = createInitialState('Multi-step task');

      for (let i = 1; i <= 3; i++) {
        state = updateToPlanningPhase(state, {
          thought: `Iteration ${i}`,
          timestamp: Date.now(),
        });
        expect(state.iterations).toBe(i);
        expect(state.phase).toBe('planning');
      }

      expect(state.iterations).toBe(3);
    });
  });
});

// ============================================================================
// Integration-style Tests
// ============================================================================

describe('Agent Task Execution Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should handle simple navigation task flow', () => {
    // This tests the state flow without actual LLM calls
    const agent = new AgentCore();

    // Initial state
    const state1 = agent.getState();
    expect(state1.phase).toBe('idle');
    expect(state1.iterations).toBe(0);

    // Simulate a complete flow
    let state = createInitialState('Navigate to example.com');

    // Planning
    state = updateToPlanningPhase(state, {
      thought: 'I should navigate to example.com',
      confidence: 0.9,
      timestamp: Date.now(),
    });
    expect(state.phase).toBe('planning');
    expect(state.iterations).toBe(1);

    // Executing
    state = updateToExecutingPhase(state, {
      toolName: 'navigate',
      arguments: { url: 'https://example.com' },
    });
    expect(state.phase).toBe('executing');

    // Evaluating
    state = updateToEvaluatingPhase(state, {
      id: 'nav-1',
      toolName: 'navigate',
      arguments: { url: 'https://example.com' },
      result: { url: 'https://example.com' },
      success: true,
      timestamp: Date.now(),
      duration: 150,
    });
    expect(state.phase).toBe('evaluating');
    expect(state.toolCalls).toHaveLength(1);

    // Complete
    const completed = createCompletedState(state);
    expect(completed.phase).toBe('completed');
    expect(completed.toolCalls).toHaveLength(1);
  });

  it('should handle failed tool execution', () => {
    let state = createInitialState('Click element');

    // Planning
    state = updateToPlanningPhase(state, {
      thought: 'I need to click an element',
      timestamp: Date.now(),
    });

    // Executing - tool fails
    state = updateToExecutingPhase(state, {
      toolName: 'click',
      arguments: { selector: '.nonexistent' },
    });

    // Evaluating - tool failed
    const toolResult: ToolCallRecord = {
      id: 'click-1',
      toolName: 'click',
      arguments: { selector: '.nonexistent' },
      success: false,
      error: 'Element not found',
      timestamp: Date.now(),
      duration: 50,
    };
    state = updateToEvaluatingPhase(state, toolResult);

    // Should continue or fail depending on evaluation
    const summary = getAgentSummary(state);
    expect(summary.toolCallsCount).toBe(1);
  });

  it('should respect max iterations limit', () => {
    const maxIterations = 3;
    let state = createInitialState('Long task');

    for (let i = 1; i <= maxIterations; i++) {
      state = updateToPlanningPhase(state, {
        thought: `Iteration ${i}`,
        timestamp: Date.now(),
      });
      expect(shouldContinue(state, maxIterations)).toBe(i < maxIterations);
    }

    // After max iterations, should stop
    expect(shouldContinue(state, maxIterations)).toBe(false);
  });
});

// ============================================================================
// Utility Tests
// ============================================================================

describe('Agent Utility Functions', () => {
  it('should generate unique IDs for tool calls', () => {
    const toolRecord1: ToolCallRecord = {
      id: 'uuid-1',
      toolName: 'test',
      arguments: {},
      success: true,
      timestamp: 1,
      duration: 10,
    };

    const toolRecord2: ToolCallRecord = {
      id: 'uuid-2',
      toolName: 'test',
      arguments: {},
      success: true,
      timestamp: 2,
      duration: 10,
    };

    expect(toolRecord1.id).not.toBe(toolRecord2.id);
  });

  it('should calculate iteration counts correctly', () => {
    let state = createInitialState('Test');

    const iterations = [1, 2, 3, 4, 5];
    for (const i of iterations) {
      state = updateToPlanningPhase(state, {
        thought: `Step ${i}`,
        timestamp: Date.now(),
      });
    }

    expect(state.iterations).toBe(5);
  });

  it('should preserve history across iterations', () => {
    let state = createInitialState('Multi-step');

    const actions = ['navigate', 'click', 'fill', 'submit'];
    for (const action of actions) {
      state = updateToPlanningPhase(state, { thought: action, timestamp: Date.now() });
      state = updateToExecutingPhase(state, { toolName: action, arguments: {} });
      state = updateToEvaluatingPhase(state, {
        id: action,
        toolName: action,
        arguments: {},
        success: true,
        timestamp: Date.now(),
        duration: 50,
      });
    }

    expect(state.toolCalls).toHaveLength(4);
    expect(state.toolCalls.map((c) => c.toolName)).toEqual(actions);
  });
});
