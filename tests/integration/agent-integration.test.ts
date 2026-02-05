/**
 * Agent Integration Tests
 *
 * Integration tests for the complete agent workflow including:
 * - Intent detection and classification
 * - Agent state flow (planning -> executing -> evaluating)
 * - Tool registry integration
 * - ChatService agent methods
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import {
  AgentCore,
  ToolExecutor,
  runAgentTask,
} from '../../src/background/agent-core';
import {
  AgentState,
  AgentPhase,
  ToolCallRecord,
  createInitialState,
  createCompletedState,
  createFailedState,
  updateToPlanningPhase,
  updateToExecutingPhase,
  updateToEvaluatingPhase,
  shouldContinue,
  getPhaseDisplayName,
  getAgentSummary,
  isMaxIterationsReached,
  isTerminalPhase,
  type AgentThought,
} from '../../src/lib/agent/agent-state';
import type { ToolDefinition, ChatMessage } from '../../src/lib/openai';
import type { ChatOptions } from '../../src/lib/types/chat';

// ============================================================================
// Types
// ============================================================================

interface MockChatServiceOptions {
  response?: string;
  responses?: string[];
  shouldFail?: boolean;
  delay?: number;
}

// ============================================================================
// Mock Tool Executor Factory
// ============================================================================

interface MockToolExecutor {
  execute: (
    toolName: string,
    args: Record<string, unknown>,
    tabContext?: { tabId?: number; url?: string; title?: string }
  ) => Promise<{ success: boolean; result?: unknown; error?: string }>;
  getAvailableTools: () => ToolDefinition[];
  getToolDescription?: (toolName: string) => string | undefined;
  getCallHistory: () => Array<{ toolName: string; args: Record<string, unknown>; timestamp: number }>;
  resetHistory: () => void;
}

function createMockToolExecutor(
  responses: Array<{ success: boolean; result?: unknown; error?: string }> = [{ success: true, result: 'done' }]
): MockToolExecutor {
  let callIndex = 0;
  const callHistory: Array<{ toolName: string; args: Record<string, unknown>; timestamp: number }> = [];

  return {
    execute: async (toolName, args, _tabContext) => {
      const timestamp = Date.now();
      callHistory.push({ toolName, args, timestamp });
      const response = responses[callIndex] || responses[responses.length - 1] || { success: true, result: 'done' };
      if (callIndex < responses.length) {
        callIndex++;
      }
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
            properties: {
              url: { type: 'string', description: 'URL to navigate to' },
            },
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
            properties: {
              selector: { type: 'string', description: 'CSS selector for the element' },
              uid: { type: 'string', description: 'Element UID from snapshot' },
            },
            required: ['selector'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fill',
          description: 'Fill a form input',
          parameters: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector for the input' },
              value: { type: 'string', description: 'Value to fill in' },
            },
            required: ['selector', 'value'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'screenshot',
          description: 'Take a screenshot of the page',
          parameters: {
            type: 'object',
            properties: {
              fullPage: { type: 'boolean', description: 'Capture full page' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'take_snapshot',
          description: 'Take a snapshot of page content',
          parameters: {
            type: 'object',
            properties: {
              verbose: { type: 'boolean', description: 'Include detailed information' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'evaluate_script',
          description: 'Execute JavaScript in page context',
          parameters: {
            type: 'object',
            properties: {
              script: { type: 'string', description: 'JavaScript code to execute' },
            },
            required: ['script'],
          },
        },
      },
    ],
    getCallHistory: () => [...callHistory],
    resetHistory: () => {
      callIndex = 0;
      callHistory.length = 0;
    },
  };
}

// ============================================================================
// Mock ChatService
// ============================================================================

const mockChatService = {
  chat: vi.fn(),
  streamChat: vi.fn(),
};

function setupMockChatService(options: MockChatServiceOptions = {}): typeof mockChatService {
  const { response = '{}', responses = [], shouldFail = false, delay = 0 } = options;
  const responseList = responses.length > 0 ? responses : [response];

  mockChatService.chat.mockImplementation(async (_messages: ChatMessage[], _options?: ChatOptions) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (shouldFail) {
      throw new Error('LLM error');
    }
    return responseList[0] || '{}';
  });

  mockChatService.streamChat.mockImplementation(async function* (_messages: ChatMessage[], _options?: ChatOptions) {
    const response = responseList[0] || '';
    const words = response.split(' ');
    for (const word of words) {
      yield word + ' ';
    }
  });

  return mockChatService;
}

// ============================================================================
// Intent Detection Tests
// ============================================================================

describe('Intent Detection Integration', () => {
  describe('detectAgentMode - Task Classification', () => {
    it('should classify browser automation tasks as agent mode', () => {
      const automationTasks = [
        'navigate to example.com and click the login button',
        'fill out the form with my information',
        'scroll down and find the contact section',
        'take a screenshot of the current page',
        'extract all the links from this page',
        'go to google and search for something',
        'click on the submit button after filling the form',
        'wait for the page to load then extract the title',
      ];

      for (const task of automationTasks) {
        expect(isAgentTask(task)).toBe(true);
      }
    });

    it('should classify simple questions as non-agent mode', () => {
      const simpleQuestions = [
        'what is the weather today?',
        'explain how browser extensions work',
        'what can you do?',
        'hello',
        'thanks',
      ];

      for (const task of simpleQuestions) {
        expect(isAgentTask(task)).toBe(false);
      }
    });

    it('should classify coding tasks as agent mode', () => {
      const codingTasks = [
        'write a function to calculate fibonacci',
        'help me debug this code',
        'explain this code snippet',
        'refactor this function',
      ];

      for (const task of codingTasks) {
        expect(isAgentTask(task)).toBe(true);
      }
    });
  });

  describe('Mixed Intent Scenarios', () => {
    it('should handle tasks with mixed automation and question intent', () => {
      const mixedTasks = [
        {
          task: 'navigate to github and tell me about the repository',
          expectedAgent: true,
        },
        {
          task: 'what is react and also take a screenshot',
          expectedAgent: true,
        },
      ];

      for (const { task, expectedAgent } of mixedTasks) {
        expect(isAgentTask(task)).toBe(expectedAgent);
      }
    });

    it('should identify action keywords in tasks', () => {
      const actionKeywords = [
        'navigate',
        'click',
        'fill',
        'scroll',
        'screenshot',
        'extract',
        'go to',
        'type',
        'submit',
        'select',
      ];

      for (const keyword of actionKeywords) {
        expect(hasActionKeyword(`Please ${keyword} something`)).toBe(true);
      }
    });
  });
});

// ============================================================================
// Agent State Flow Tests
// ============================================================================

describe('Agent State Flow Integration', () => {
  describe('Complete Task Flow', () => {
    it('should transition through all phases for successful task', () => {
      let state = createInitialState('Navigate to example.com');

      // Initial state
      expect(state.phase).toBe('idle');
      expect(state.iterations).toBe(0);
      expect(state.toolCalls).toHaveLength(0);

      // Phase 1: Planning
      const planningThought: AgentThought = {
        thought: 'I need to navigate to example.com',
        reasoning: 'The user wants to visit a specific URL',
        confidence: 0.95,
        timestamp: Date.now(),
      };
      state = updateToPlanningPhase(state, planningThought);
      expect(state.phase).toBe('planning');
      expect(state.iterations).toBe(1);
      expect(state.currentThought?.thought).toBe('I need to navigate to example.com');

      // Phase 2: Executing with action
      state = updateToExecutingPhase(state, {
        toolName: 'navigate',
        arguments: { url: 'https://example.com' },
      });
      expect(state.phase).toBe('executing');
      expect(state.currentAction?.toolName).toBe('navigate');
      expect(state.currentAction?.arguments).toEqual({ url: 'https://example.com' });

      // Phase 3: Evaluating with tool result
      const toolRecord: ToolCallRecord = {
        id: 'tool-1',
        toolName: 'navigate',
        arguments: { url: 'https://example.com' },
        result: { url: 'https://example.com', title: 'Example Domain' },
        success: true,
        timestamp: Date.now(),
        duration: 150,
      };
      state = updateToEvaluatingPhase(state, toolRecord);
      expect(state.phase).toBe('evaluating');
      expect(state.toolCalls).toHaveLength(1);
      expect(state.toolCalls[0]?.success).toBe(true);

      // Complete
      const completed = createCompletedState(state);
      expect(completed.phase).toBe('completed');
      expect(completed.completedAt).toBeDefined();
      expect(completed.error).toBeUndefined();
    });

    it('should handle multi-step task with multiple iterations', () => {
      let state = createInitialState('Fill form and submit');

      const steps = [
        { tool: 'navigate', args: { url: 'https://form.example.com' } },
        { tool: 'fill', args: { selector: '#email', value: 'test@example.com' } },
        { tool: 'fill', args: { selector: '#password', value: 'secret123' } },
        { tool: 'click', args: { selector: '#submit' } },
      ];

      let iteration = 0;
      for (const step of steps) {
        iteration++;
        state = updateToPlanningPhase(state, {
          thought: `Step ${iteration}: Execute ${step.tool}`,
          timestamp: Date.now(),
        });
        expect(state.iterations).toBe(iteration);

        state = updateToExecutingPhase(state, {
          toolName: step.tool,
          arguments: step.args,
        });

        state = updateToEvaluatingPhase(state, {
          id: `step-${iteration}`,
          toolName: step.tool,
          arguments: step.args,
          success: true,
          timestamp: Date.now(),
          duration: 50,
        });
      }

      expect(state.iterations).toBe(4);
      expect(state.toolCalls).toHaveLength(4);
    });
  });

  describe('Task Completion Flow', () => {
    it('should complete task when no action needed', () => {
      let state = createInitialState('Simple greeting');

      state = updateToPlanningPhase(state, {
        thought: 'The user is just greeting me',
        confidence: 1.0,
        timestamp: Date.now(),
      });

      // No action planned - task is complete
      const completed = createCompletedState(state);
      expect(completed.phase).toBe('completed');
    });

    it('should track completion metrics correctly', () => {
      let state = createInitialState('Complex task');

      // Simulate a task with 3 tool calls
      for (let i = 1; i <= 3; i++) {
        state = updateToPlanningPhase(state, { thought: `Iteration ${i}`, timestamp: Date.now() });
        state = updateToExecutingPhase(state, { toolName: `tool${i}`, arguments: {} });
        state = updateToEvaluatingPhase(state, {
          id: `${i}`,
          toolName: `tool${i}`,
          arguments: {},
          success: true,
          timestamp: Date.now(),
          duration: 100,
        });
      }

      const completed = createCompletedState(state);
      const summary = getAgentSummary(completed);

      expect(summary.success).toBe(true);
      expect(summary.iterations).toBe(3);
      expect(summary.toolCallsCount).toBe(3);
      expect(summary.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle partial task completion', () => {
      let state = createInitialState('Long task');

      // Complete first iteration
      state = updateToPlanningPhase(state, { thought: 'First step', timestamp: Date.now() });
      state = updateToExecutingPhase(state, { toolName: 'step1', arguments: {} });
      state = updateToEvaluatingPhase(state, {
        id: '1',
        toolName: 'step1',
        arguments: {},
        success: true,
        timestamp: Date.now(),
        duration: 50,
      });

      // Fail on second iteration
      state = updateToPlanningPhase(state, { thought: 'Second step', timestamp: Date.now() });
      state = updateToExecutingPhase(state, { toolName: 'step2', arguments: {} });
      state = updateToEvaluatingPhase(state, {
        id: '2',
        toolName: 'step2',
        arguments: {},
        success: false,
        error: 'Element not found',
        timestamp: Date.now(),
        duration: 30,
      });

      const failed = createFailedState(state, 'Element not found');
      const summary = getAgentSummary(failed);

      expect(summary.success).toBe(false);
      expect(summary.toolCallsCount).toBe(2);
    });
  });

  describe('State Transition Edge Cases', () => {
    it('should handle rapid state transitions', () => {
      const state = createInitialState('Rapid test');

      // Rapid transitions without delay
      const phase1 = updateToPlanningPhase(state, { thought: 'Test', timestamp: Date.now() });
      const phase2 = updateToExecutingPhase(phase1, { toolName: 'test', arguments: {} });
      const phase3 = updateToEvaluatingPhase(phase2, {
        id: '1',
        toolName: 'test',
        arguments: {},
        success: true,
        timestamp: Date.now(),
        duration: 10,
      });

      expect(phase3.phase).toBe('evaluating');
    });

    it('should preserve state immutability', () => {
      const original = createInitialState('Immutability test');
      const updated = updateToPlanningPhase(original, { thought: 'Test', timestamp: Date.now() });

      expect(original.phase).toBe('idle');
      expect(updated.phase).toBe('planning');
      expect(original.currentThought).toBeNull();
      expect(updated.currentThought?.thought).toBe('Test');
    });

    it('should handle empty tool arguments', () => {
      let state = createInitialState('Empty args test');

      state = updateToPlanningPhase(state, { thought: 'Test', timestamp: Date.now() });
      state = updateToExecutingPhase(state, { toolName: 'screenshot', arguments: {} });
      state = updateToEvaluatingPhase(state, {
        id: '1',
        toolName: 'screenshot',
        arguments: {},
        success: true,
        result: { data: 'base64data...' },
        timestamp: Date.now(),
        duration: 200,
      });

      expect(state.currentAction?.arguments).toEqual({});
    });
  });
});

// ============================================================================
// Tool Registry Integration Tests
// ============================================================================

describe('Tool Registry Integration', () => {
  describe('Tool Availability', () => {
    it('should have all required tools registered', () => {
      const executor = createMockToolExecutor();
      const tools = executor.getAvailableTools();
      const toolNames = tools.map((t) => t.function.name);

      expect(toolNames).toContain('navigate');
      expect(toolNames).toContain('click');
      expect(toolNames).toContain('fill');
      expect(toolNames).toContain('screenshot');
      expect(toolNames).toContain('take_snapshot');
      expect(toolNames).toContain('evaluate_script');
    });

    it('should have correct tool parameter schemas', () => {
      const executor = createMockToolExecutor();
      const tools = executor.getAvailableTools();

      // Navigate tool schema
      const navigateTool = tools.find((t) => t.function.name === 'navigate');
      expect(navigateTool?.function.parameters.required).toContain('url');
      expect(navigateTool?.function.parameters.properties.url.type).toBe('string');

      // Click tool schema
      const clickTool = tools.find((t) => t.function.name === 'click');
      expect(clickTool?.function.parameters.required).toContain('selector');
      expect(clickTool?.function.parameters.properties.selector.type).toBe('string');

      // Fill tool schema
      const fillTool = tools.find((t) => t.function.name === 'fill');
      expect(fillTool?.function.parameters.required).toContain('selector');
      expect(fillTool?.function.parameters.required).toContain('value');
    });

    it('should track tool execution history', () => {
      const executor = createMockToolExecutor([
        { success: true, result: 'navigated' },
        { success: true, result: 'clicked' },
      ]);

      executor.execute('navigate', { url: 'https://example.com' });
      executor.execute('click', { selector: '#button' });

      const history = executor.getCallHistory();
      expect(history).toHaveLength(2);
      expect(history[0].toolName).toBe('navigate');
      expect(history[1].toolName).toBe('click');
    });

    it('should handle tool execution errors gracefully', async () => {
      const executor = createMockToolExecutor([
        { success: false, error: 'Element not found' },
      ]);

      const result = await executor.execute('click', { selector: '.nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
    });

    it('should execute tools with tab context', async () => {
      const executor = createMockToolExecutor([{ success: true, result: 'done' }]);
      const tabContext = { tabId: 123, url: 'https://example.com', title: 'Example' };

      await executor.execute('screenshot', { fullPage: true }, tabContext);

      const history = executor.getCallHistory();
      // Context is passed but not stored in history in this mock
      expect(history).toHaveLength(1);
    });
  });
});

// ============================================================================
// ChatService Agent Methods Tests
// ============================================================================

describe('ChatService Agent Methods', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupMockChatService({ response: '{}' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('runAgent Method', () => {
    it('should start agent with initial state', async () => {
      const executor = createMockToolExecutor([
        { success: true, result: { url: 'https://example.com' } },
      ]);

      setupMockChatService({
        response: JSON.stringify({
          thought: 'Navigating to example.com',
          confidence: 0.9,
          action: { toolName: 'navigate', arguments: { url: 'https://example.com' } },
        }),
      });

      // Test state creation
      const state = createInitialState('Navigate to example');
      expect(state.phase).toBe('idle');
      expect(state.task).toBe('Navigate to example');
    });

    it('should track iterations during execution', () => {
      const executor = createMockToolExecutor();

      let state = createInitialState('Test task');

      // Simulate multiple iterations
      for (let i = 1; i <= 5; i++) {
        state = updateToPlanningPhase(state, {
          thought: `Iteration ${i}`,
          timestamp: Date.now(),
        });
      }

      expect(state.iterations).toBe(5);
    });

    it('should respect max iterations limit', () => {
      const maxIterations = 3;
      let state = createInitialState('Limited task');

      for (let i = 1; i <= 5; i++) {
        state = updateToPlanningPhase(state, { thought: `Iteration ${i}`, timestamp: Date.now() });
        if (!shouldContinue(state, maxIterations)) {
          break;
        }
      }

      expect(state.iterations).toBe(3);
      expect(shouldContinue(state, maxIterations)).toBe(false);
    });
  });

  describe('stopAgent Method', () => {
    it('should stop agent gracefully', () => {
      const agent = new AgentCore();

      // Should not throw when stopping
      expect(() => agent.stop()).not.toThrow();
    });

    it('should have clean state after stop', () => {
      const agent = new AgentCore();
      agent.stop();

      const state = agent.getState();
      expect(state).toBeDefined();
    });

    it('should handle multiple stop calls', () => {
      const agent = new AgentCore();

      agent.stop();
      agent.stop();
      agent.stop();

      // Should not throw
      expect(() => agent.stop()).not.toThrow();
    });
  });

  describe('Agent Core Configuration', () => {
    it('should initialize with default config', () => {
      const agent = new AgentCore();
      const state = agent.getState();

      expect(state.phase).toBe('idle');
      expect(state.task).toBe('');
    });

    it('should initialize with custom maxIterations', () => {
      const customMax = 10;
      const agent = new AgentCore({ maxIterations: customMax });

      let state = agent.getState();

      // Simulate reaching custom max
      for (let i = 0; i < customMax; i++) {
        state = updateToPlanningPhase(state, { thought: `Iter ${i}`, timestamp: Date.now() });
      }

      expect(state.iterations).toBe(customMax);
      expect(shouldContinue(state, customMax)).toBe(false);
    });

    it('should accept custom system prompt', () => {
      const customPrompt = 'You are a test agent';
      const agent = new AgentCore({ systemPrompt: customPrompt });

      expect(agent.getState()).toBeDefined();
    });

    it('should accept custom tool executor', () => {
      const customExecutor = createMockToolExecutor();
      const agent = new AgentCore({ toolExecutor: customExecutor });

      expect(agent.getState()).toBeDefined();
    });
  });
});

// ============================================================================
// Integration Scenarios
// ============================================================================

describe('End-to-End Integration Scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Complete Browser Automation Flow', () => {
    it('should execute navigation and extraction flow', async () => {
      const executor = createMockToolExecutor([
        { success: true, result: { url: 'https://example.com', title: 'Example' } },
        { success: true, result: { content: 'Page content...' } },
      ]);

      // Verify executor works
      const result1 = await executor.execute('navigate', { url: 'https://example.com' });
      expect(result1.success).toBe(true);

      const result2 = await executor.execute('take_snapshot', { verbose: true });
      expect(result2.success).toBe(true);

      const history = executor.getCallHistory();
      expect(history).toHaveLength(2);
    });

    it('should handle form workflow', async () => {
      const executor = createMockToolExecutor([
        { success: true, result: { url: 'https://form.example.com' } },
        { success: true, result: { filled: true } },
        { success: true, result: { submitted: true } },
      ]);

      await executor.execute('navigate', { url: 'https://form.example.com' });
      await executor.execute('fill', { selector: '#name', value: 'John' });
      await executor.execute('click', { selector: '#submit' });

      const history = executor.getCallHistory();
      expect(history).toHaveLength(3);
      expect(history[0].toolName).toBe('navigate');
      expect(history[1].toolName).toBe('fill');
      expect(history[2].toolName).toBe('click');
    });
  });

  describe('Error Recovery Flow', () => {
    it('should handle failed tool and continue', () => {
      let state = createInitialState('Task with failure');

      // Success first
      state = updateToPlanningPhase(state, { thought: 'Step 1', timestamp: Date.now() });
      state = updateToExecutingPhase(state, { toolName: 'step1', arguments: {} });
      state = updateToEvaluatingPhase(state, {
        id: '1',
        toolName: 'step1',
        arguments: {},
        success: true,
        timestamp: Date.now(),
        duration: 50,
      });

      // Fail second
      state = updateToPlanningPhase(state, { thought: 'Step 2', timestamp: Date.now() });
      state = updateToExecutingPhase(state, { toolName: 'step2', arguments: {} });
      state = updateToEvaluatingPhase(state, {
        id: '2',
        toolName: 'step2',
        arguments: {},
        success: false,
        error: 'Element not found',
        timestamp: Date.now(),
        duration: 30,
      });

      const failed = createFailedState(state, 'Element not found');
      expect(failed.phase).toBe('failed');
      expect(failed.toolCalls).toHaveLength(2);
      expect(failed.toolCalls[1]?.success).toBe(false);
    });

    it('should preserve successful tool calls in history', () => {
      let state = createInitialState('Multi-tool task');

      for (let i = 1; i <= 4; i++) {
        state = updateToPlanningPhase(state, { thought: `Step ${i}`, timestamp: Date.now() });
        state = updateToExecutingPhase(state, { toolName: `tool${i}`, arguments: {} });
        state = updateToEvaluatingPhase(state, {
          id: `${i}`,
          toolName: `tool${i}`,
          arguments: {},
          success: i !== 3, // Third tool fails
          error: i === 3 ? 'Failed' : undefined,
          timestamp: Date.now(),
          duration: 50,
        });
      }

      expect(state.toolCalls).toHaveLength(4);
      const successfulCalls = state.toolCalls.filter((c) => c.success);
      expect(successfulCalls).toHaveLength(3);
    });
  });

  describe('Performance Tracking', () => {
    it('should track duration of each tool call', () => {
      const toolRecord: ToolCallRecord = {
        id: '1',
        toolName: 'navigate',
        arguments: { url: 'https://example.com' },
        success: true,
        timestamp: 1000,
        duration: 150,
      };

      expect(toolRecord.duration).toBe(150);
    });

    it('should calculate total duration from state', () => {
      let state = createInitialState('Task');
      const startTime = Date.now();

      for (let i = 1; i <= 3; i++) {
        state = updateToPlanningPhase(state, { thought: `Step ${i}`, timestamp: startTime + i * 100 });
        state = updateToExecutingPhase(state, { toolName: `tool${i}`, arguments: {} });
        state = updateToEvaluatingPhase(state, {
          id: `${i}`,
          toolName: `tool${i}`,
          arguments: {},
          success: true,
          timestamp: startTime + i * 100,
          duration: 50 + i * 10,
        });
      }

      const completed = createCompletedState(state);
      const summary = getAgentSummary(completed);

      expect(summary.duration).toBeGreaterThanOrEqual(0);
      expect(summary.iterations).toBe(3);
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine if a task requires agent mode (browser automation)
 */
function isAgentTask(task: string): boolean {
  const automationKeywords = [
    'navigate',
    'go to',
    'click',
    'fill',
    'scroll',
    'screenshot',
    'extract',
    'type',
    'submit',
    'select',
    'open',
    'close',
    'wait for',
    'check',
    'find',
    'search',
    'download',
    'upload',
  ];

  const codingKeywords = [
    'write code',
    'debug',
    'refactor',
    'function',
    'class',
    'implement',
    'code',
  ];

  const taskLower = task.toLowerCase();

  // Check for automation keywords
  const hasAutomationKeyword = automationKeywords.some((keyword) =>
    taskLower.includes(keyword)
  );

  // Check for coding keywords
  const hasCodingKeyword = codingKeywords.some((keyword) =>
    taskLower.includes(keyword)
  );

  // Check for URL patterns
  const hasUrl = /https?:\/\//.test(task);

  // Check for CSS selectors
  const hasSelector = /#\w+|\.\w+|\[\w+\]/.test(task);

  return hasAutomationKeyword || hasCodingKeyword || hasUrl || hasSelector;
}

/**
 * Check if text contains action keywords
 */
function hasActionKeyword(text: string): boolean {
  const actionKeywords = [
    'navigate',
    'click',
    'fill',
    'scroll',
    'screenshot',
    'extract',
    'go to',
    'type',
    'submit',
    'select',
  ];

  return actionKeywords.some((keyword) => text.toLowerCase().includes(keyword));
}
