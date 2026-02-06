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
});
