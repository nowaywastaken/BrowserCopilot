/**
 * Agent State Management Tests
 * Tests for the agent state management module
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  addToolCall,
  setPhase,
  incrementIterations,
  setThought,
  setNextAction,
  completeTask,
  failTask,
  createCompletedState,
  createFailedState,
  updateToPlanningPhase,
  updateToExecutingPhase,
  updateToEvaluatingPhase,
  shouldContinue,
  getPhaseDisplayName,
  type AgentPhase,
} from '../../../src/lib/agent/agent-state';

describe('Agent State Management', () => {
  describe('createInitialState', () => {
    it('creates correct initial state with default maxIterations', () => {
      const task = 'Navigate to example.com and find the login button';
      const state = createInitialState(task);

      expect(state.id).toBeDefined();
      expect(state.id).not.toBe('');
      expect(state.task).toBe(task);
      expect(state.phase).toBe('idle');
      expect(state.iterations).toBe(0);
      expect(state.maxIterations).toBe(50);
      expect(state.toolCalls).toEqual([]);
      expect(state.thought).toBe('');
      expect(state.nextAction).toBe('');
      expect(state.result).toBeUndefined();
      expect(state.error).toBeUndefined();
      expect(state.createdAt).toBeDefined();
      expect(state.updatedAt).toBeDefined();
    });

    it('creates correct initial state with custom maxIterations', () => {
      const task = 'Test task';
      const maxIterations = 25;
      const state = createInitialState(task, maxIterations);

      expect(state.task).toBe(task);
      expect(state.maxIterations).toBe(maxIterations);
    });
  });

  describe('addToolCall', () => {
    it('adds tool call to history', () => {
      const state = createInitialState('Test task');
      const toolName = 'navigate';
      const args = { url: 'https://example.com' };

      const newState = addToolCall(state, {
        toolName,
        arguments: args,
        success: true,
        result: { url: 'https://example.com' },
      });

      expect(newState.toolCalls.length).toBe(1);
      expect(newState.toolCalls[0].toolName).toBe(toolName);
      expect(newState.toolCalls[0].arguments).toEqual(args);
      expect(newState.toolCalls[0].id).toBeDefined();
      expect(newState.toolCalls[0].timestamp).toBeDefined();
      expect(newState.toolCalls[0].success).toBe(true);
      expect(newState.toolCalls[0].result).toEqual({ url: 'https://example.com' });
    });

    it('appends to existing tool calls', () => {
      const state = createInitialState('Test task');
      const stateWithFirstCall = addToolCall(state, {
        toolName: 'tool1',
        arguments: { key: 'value1' },
        success: true,
      });
      const stateWithSecondCall = addToolCall(stateWithFirstCall, {
        toolName: 'tool2',
        arguments: { key: 'value2' },
        success: true,
      });

      expect(stateWithSecondCall.toolCalls.length).toBe(2);
      expect(stateWithSecondCall.toolCalls[0].toolName).toBe('tool1');
      expect(stateWithSecondCall.toolCalls[1].toolName).toBe('tool2');
    });

    it('records failed tool calls with error', () => {
      const state = createInitialState('Test task');
      const newState = addToolCall(state, {
        toolName: 'navigate',
        arguments: { url: 'https://example.com' },
        success: false,
        error: 'Navigation failed: page not found',
      });

      expect(newState.toolCalls.length).toBe(1);
      expect(newState.toolCalls[0].success).toBe(false);
      expect(newState.toolCalls[0].error).toBe('Navigation failed: page not found');
    });

    it('updates the updatedAt timestamp', () => {
      const state = createInitialState('Test task');
      const originalUpdatedAt = state.updatedAt;

      // Small delay to ensure different timestamp
      const newState = addToolCall(state, {
        toolName: 'tool',
        arguments: {},
        success: true,
      });

      expect(newState.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe('setPhase', () => {
    it('updates phase correctly', () => {
      const state = createInitialState('Test task');
      const newState = setPhase(state, 'planning');

      expect(newState.phase).toBe('planning');
    });

    it('can update to any valid phase', () => {
      const phases: AgentPhase[] = ['idle', 'planning', 'executing', 'evaluating', 'completed', 'failed'];

      phases.forEach((phase) => {
        const state = createInitialState('Test task');
        const newState = setPhase(state, phase);

        expect(newState.phase).toBe(phase);
      });
    });

    it('updates the updatedAt timestamp', () => {
      const state = createInitialState('Test task');
      const newState = setPhase(state, 'executing');

      expect(newState.updatedAt).toBeGreaterThanOrEqual(state.updatedAt);
    });
  });

  describe('incrementIterations', () => {
    it('increases counter by one', () => {
      const state = createInitialState('Test task');
      const newState = incrementIterations(state);

      expect(newState.iterations).toBe(1);
    });

    it('can be called multiple times', () => {
      let state = createInitialState('Test task');

      state = incrementIterations(state);
      expect(state.iterations).toBe(1);

      state = incrementIterations(state);
      expect(state.iterations).toBe(2);

      state = incrementIterations(state);
      expect(state.iterations).toBe(3);
    });

    it('does not modify other state properties', () => {
      const state = createInitialState('Test task');
      const newState = incrementIterations(state);

      expect(newState.id).toBe(state.id);
      expect(newState.task).toBe(state.task);
      expect(newState.toolCalls).toEqual(state.toolCalls);
    });
  });

  describe('setThought', () => {
    it('sets the current thought', () => {
      const state = createInitialState('Test task');
      const thought = 'I need to first navigate to the page';
      const newState = setThought(state, thought);

      expect(newState.thought).toBe(thought);
    });

    it('overwrites previous thought', () => {
      const state = createInitialState('Test task');
      const stateWithThought = setThought(state, 'First thought');
      const newState = setThought(stateWithThought, 'Second thought');

      expect(newState.thought).toBe('Second thought');
    });
  });

  describe('setNextAction', () => {
    it('sets the next action', () => {
      const state = createInitialState('Test task');
      const action = 'click on login button';
      const newState = setNextAction(state, action);

      expect(newState.nextAction).toBe(action);
    });

    it('overwrites previous next action', () => {
      const state = createInitialState('Test task');
      const stateWithAction = setNextAction(state, 'First action');
      const newState = setNextAction(stateWithAction, 'Second action');

      expect(newState.nextAction).toBe('Second action');
    });
  });

  describe('completeTask', () => {
    it('marks task as completed with result', () => {
      const state = createInitialState('Test task');
      const result = { success: true, message: 'Task completed' };
      const newState = completeTask(state, result);

      expect(newState.phase).toBe('completed');
      expect(newState.result).toEqual(result);
    });

    it('can handle various result types', () => {
      const state = createInitialState('Test task');

      // String result
      const stringResult = completeTask(state, 'Task done');
      expect(stringResult.result).toBe('Task done');

      // Object result
      const objectResult = completeTask(state, { data: [1, 2, 3] });
      expect(objectResult.result).toEqual({ data: [1, 2, 3] });

      // Array result
      const arrayResult = completeTask(state, ['item1', 'item2']);
      expect(arrayResult.result).toEqual(['item1', 'item2']);
    });
  });

  describe('failTask', () => {
    it('marks task as failed with error message', () => {
      const state = createInitialState('Test task');
      const error = 'Navigation failed: page not found';
      const newState = failTask(state, error);

      expect(newState.phase).toBe('failed');
      expect(newState.error).toBe(error);
    });

    it('can be called after some iterations', () => {
      let state = createInitialState('Test task');
      state = setPhase(state, 'executing');
      state = incrementIterations(state);
      state = incrementIterations(state);

      const failedState = failTask(state, 'Tool execution failed');

      expect(failedState.phase).toBe('failed');
      expect(failedState.iterations).toBe(2);
      expect(failedState.error).toBe('Tool execution failed');
    });
  });

  describe('state immutability', () => {
    it('all functions return new state objects', () => {
      const originalState = createInitialState('Test task');

      const functions = [
        () => addToolCall(originalState, { toolName: 'tool', arguments: {}, success: true }),
        () => setPhase(originalState, 'planning'),
        () => incrementIterations(originalState),
        () => setThought(originalState, 'thought'),
        () => setNextAction(originalState, 'action'),
        () => completeTask(originalState, 'result'),
        () => failTask(originalState, 'error'),
      ];

      functions.forEach((fn) => {
        const newState = fn();
        expect(newState).not.toBe(originalState);
      });
    });
  });

  // ============================================================================
  // Uncovered Functions Tests (lines 252-367)
  // ============================================================================

  describe('createCompletedState', () => {
    it('creates a completed state with success result', () => {
      const state = createInitialState('Test task');
      const completedState = createCompletedState(state);

      expect(completedState.phase).toBe('completed');
      expect(completedState.result).toEqual({ success: true });
      expect(completedState.completedAt).toBeDefined();
    });

    it('preserves the original state properties', () => {
      const state = createInitialState('Test task');
      const completedState = createCompletedState(state);

      expect(completedState.id).toBe(state.id);
      expect(completedState.task).toBe(state.task);
      expect(completedState.iterations).toBe(state.iterations);
    });

    it('updates the updatedAt timestamp', () => {
      const state = createInitialState('Test task');
      const completedState = createCompletedState(state);

      expect(completedState.updatedAt).toBeGreaterThanOrEqual(state.updatedAt);
    });
  });

  describe('createFailedState', () => {
    it('creates a failed state with error message', () => {
      const state = createInitialState('Test task');
      const errorMessage = 'Task failed due to timeout';
      const failedState = createFailedState(state, errorMessage);

      expect(failedState.phase).toBe('failed');
      expect(failedState.error).toBe(errorMessage);
      expect(failedState.completedAt).toBeDefined();
    });

    it('preserves the original state properties', () => {
      const state = createInitialState('Test task');
      state.iterations = 5;
      const failedState = createFailedState(state, 'Error');

      expect(failedState.id).toBe(state.id);
      expect(failedState.task).toBe(state.task);
      expect(failedState.iterations).toBe(5);
    });
  });

  describe('updateToPlanningPhase', () => {
    it('updates state to planning phase with thought', () => {
      const state = createInitialState('Test task');
      const thought = {
        thought: 'I need to analyze the page first',
        confidence: 0.9,
        reasoning: 'Starting with page analysis',
        timestamp: Date.now(),
      };
      const planningState = updateToPlanningPhase(state, thought);

      expect(planningState.phase).toBe('planning');
      expect(planningState.currentThought?.thought).toBe(thought.thought);
      expect(planningState.currentThought?.confidence).toBe(0.9);
      expect(planningState.currentThought?.reasoning).toBe(thought.reasoning);
      expect(planningState.iterations).toBe(1);
    });

    it('uses default confidence when not provided', () => {
      const state = createInitialState('Test task');
      const planningState = updateToPlanningPhase(state, {
        thought: 'Thinking...',
        timestamp: Date.now(),
      });

      expect(planningState.currentThought?.confidence).toBe(0.8);
    });

    it('defaults empty reasoning to empty string', () => {
      const state = createInitialState('Test task');
      const planningState = updateToPlanningPhase(state, {
        thought: 'Thinking...',
        timestamp: Date.now(),
      });

      expect(planningState.currentThought?.reasoning).toBe('');
    });
  });

  describe('updateToExecutingPhase', () => {
    it('updates state to executing phase with action', () => {
      const state = createInitialState('Test task');
      const action = {
        toolName: 'navigate',
        arguments: { url: 'https://example.com' },
      };
      const executingState = updateToExecutingPhase(state, action);

      expect(executingState.phase).toBe('executing');
      expect(executingState.currentAction?.toolName).toBe('navigate');
      expect(executingState.currentAction?.arguments).toEqual({ url: 'https://example.com' });
    });

    it('clears previous action if any', () => {
      const state = createInitialState('Test task');
      state.currentAction = { toolName: 'previous', arguments: {} };
      const newState = updateToExecutingPhase(state, {
        toolName: 'new',
        arguments: { x: 1 },
      });

      expect(newState.currentAction?.toolName).toBe('new');
    });
  });

  describe('updateToEvaluatingPhase', () => {
    it('updates state to evaluating phase with tool record', () => {
      const state = createInitialState('Test task');
      const toolRecord = {
        id: 'call-1',
        toolName: 'click',
        arguments: { selector: '#button' },
        success: true,
        timestamp: Date.now(),
        duration: 100,
      };
      const evaluatingState = updateToEvaluatingPhase(state, toolRecord);

      expect(evaluatingState.phase).toBe('evaluating');
      expect(evaluatingState.currentAction).toBeNull();
      expect(evaluatingState.toolCalls.length).toBe(1);
      expect(evaluatingState.toolCalls[0].toolName).toBe('click');
    });

    it('appends to existing tool calls', () => {
      const state = createInitialState('Test task');
      const stateWithCall = addToolCall(state, {
        toolName: 'navigate',
        arguments: { url: 'https://example.com' },
        success: true,
      });
      const toolRecord = {
        id: 'call-2',
        toolName: 'click',
        arguments: { selector: '#button' },
        success: true,
        timestamp: Date.now(),
        duration: 100,
      };
      const evaluatingState = updateToEvaluatingPhase(stateWithCall, toolRecord);

      expect(evaluatingState.toolCalls.length).toBe(2);
    });
  });

  describe('shouldContinue', () => {
    it('returns true for non-terminal phases with iterations remaining', () => {
      const state = createInitialState('Test task');

      expect(shouldContinue(state, 50)).toBe(true);
    });

    it('returns false for completed phase', () => {
      const state = createInitialState('Test task');
      state.phase = 'completed';

      expect(shouldContinue(state, 50)).toBe(false);
    });

    it('returns false for failed phase', () => {
      const state = createInitialState('Test task');
      state.phase = 'failed';

      expect(shouldContinue(state, 50)).toBe(false);
    });

    it('returns false when iterations reach maxIterations', () => {
      const state = createInitialState('Test task');
      state.iterations = 50;

      expect(shouldContinue(state, 50)).toBe(false);
    });

    it('returns true when iterations are below maxIterations', () => {
      const state = createInitialState('Test task');
      state.iterations = 49;

      expect(shouldContinue(state, 50)).toBe(true);
    });

    it('handles all non-terminal phases', () => {
      const nonTerminalPhases: AgentPhase[] = ['idle', 'planning', 'executing', 'evaluating'];

      nonTerminalPhases.forEach((phase) => {
        const state = createInitialState('Test task');
        state.phase = phase;

        expect(shouldContinue(state, 50)).toBe(true);
      });
    });
  });

  describe('getPhaseDisplayName', () => {
    it('returns Chinese display names for all phases', () => {
      expect(getPhaseDisplayName('idle')).toBe('等待任务');
      expect(getPhaseDisplayName('planning')).toBe('规划中');
      expect(getPhaseDisplayName('executing')).toBe('执行中');
      expect(getPhaseDisplayName('evaluating')).toBe('评估中');
      expect(getPhaseDisplayName('completed')).toBe('已完成');
      expect(getPhaseDisplayName('failed')).toBe('失败');
    });

    it('handles all valid AgentPhase values', () => {
      const phases: AgentPhase[] = ['idle', 'planning', 'executing', 'evaluating', 'completed', 'failed'];

      phases.forEach((phase) => {
        const displayName = getPhaseDisplayName(phase);
        expect(typeof displayName).toBe('string');
        expect(displayName.length).toBeGreaterThan(0);
      });
    });
  });
});
