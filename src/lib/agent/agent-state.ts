/**
 * Agent State Management
 * Tracks the agent's execution state including task, phase, iterations, tool calls, thoughts, and results
 */

/**
 * Phase of the agent's execution
 */
export type AgentPhase =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'evaluating'
  | 'completed'
  | 'failed';

/**
 * Represents a thought during the planning phase
 */
export interface AgentThought {
  /** The thought content */
  thought: string;
  /** Confidence level of the thought (0-1) */
  confidence: number;
  /** Reasoning or explanation for the thought */
  reasoning?: string;
  /** Timestamp when thought was generated */
  timestamp: number;
}

/**
 * Represents an action being executed
 */
export interface AgentAction {
  /** Name of the tool to execute */
  toolName: string;
  /** Arguments for the tool */
  arguments: Record<string, unknown>;
}

/**
 * Represents a tool call made by the agent
 */
export interface ToolCallRecord {
  /** Unique identifier for the tool call */
  id: string;
  /** Name of the tool being called */
  toolName: string;
  /** Arguments passed to the tool */
  arguments: Record<string, unknown>;
  /** Result of the tool call */
  result?: unknown;
  /** Error message if the call failed */
  error?: string;
  /** Whether the call was successful */
  success?: boolean;
  /** Timestamp when the call was made */
  timestamp: number;
  /** Duration of the tool execution in milliseconds */
  duration: number;
}

/**
 * Complete agent state tracking object
 */
export interface AgentState {
  /** Unique identifier for the agent session */
  id: string;
  /** The current task the agent is working on */
  task: string;
  /** Current phase of execution */
  phase: AgentPhase;
  /** Number of iterations completed */
  iterations: number;
  /** Maximum number of iterations allowed */
  maxIterations: number;
  /** Current thought or reasoning (legacy string format) */
  thought: string;
  /** Next action the agent plans to take (legacy string format) */
  nextAction: string;
  /** Current thought or reasoning */
  currentThought: AgentThought | null;
  /** Next action the agent plans to take */
  currentAction: AgentAction | null;
  /** History of tool calls made */
  toolCalls: ToolCallRecord[];
  /** Final result when task is complete */
  result?: unknown;
  /** Error message if task failed */
  error?: string;
  /** Timestamp when state was created */
  createdAt: number;
  /** Timestamp when state was created (alias for createdAt) */
  startedAt: number;
  /** Timestamp of last state update */
  updatedAt: number;
  /** Timestamp when task completed or failed */
  completedAt?: number;
}

/**
 * Creates the initial state for an agent session
 * @param task - The task the agent should perform
 * @param maxIterations - Maximum number of iterations allowed (default: 50)
 * @returns A new AgentState object with initial values
 */
export function createInitialState(task: string, maxIterations: number = 50): AgentState {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    task,
    phase: 'idle',
    iterations: 0,
    maxIterations,
    thought: '',
    nextAction: '',
    currentThought: null,
    currentAction: null,
    toolCalls: [],
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Adds a tool call to the state's history
 * @param state - Current agent state
 * @param call - Tool call details
 * @returns Updated agent state with the new tool call
 */
export function addToolCall(
  state: AgentState,
  call: Partial<ToolCallRecord> & { toolName: string; arguments: Record<string, unknown> }
): AgentState {
  const now = Date.now();
  const fullCall: ToolCallRecord = {
    id: call.id || crypto.randomUUID(),
    toolName: call.toolName,
    arguments: call.arguments,
    result: call.result,
    error: call.error,
    success: call.success,
    timestamp: call.timestamp || now,
    duration: call.duration || 0,
  };
  return {
    ...state,
    toolCalls: [...state.toolCalls, fullCall],
    updatedAt: now,
  };
}

/**
 * Increments the iteration counter
 * @param state - Current agent state
 * @returns Updated agent state with incremented iterations
 */
export function incrementIterations(state: AgentState): AgentState {
  return {
    ...state,
    iterations: state.iterations + 1,
    updatedAt: Date.now(),
  };
}

/**
 * Updates the phase of the agent
 * @param state - Current agent state
 * @param phase - New phase to set
 * @returns Updated agent state with new phase
 */
export function setPhase(state: AgentState, phase: AgentPhase): AgentState {
  return {
    ...state,
    phase,
    updatedAt: Date.now(),
  };
}

/**
 * Sets the current thought as a string
 * @param state - Current agent state
 * @param thought - The thought content
 * @returns Updated agent state with new thought
 */
export function setThought(state: AgentState, thought: string): AgentState {
  return {
    ...state,
    thought: thought,
    updatedAt: Date.now(),
  };
}

/**
 * Sets the next action as a string
 * @param state - Current agent state
 * @param action - The next action description
 * @returns Updated agent state with new next action
 */
export function setNextAction(state: AgentState, action: string): AgentState {
  return {
    ...state,
    nextAction: action,
    updatedAt: Date.now(),
  };
}

/**
 * Marks the task as completed with a result
 * @param state - Current agent state
 * @param result - The result of the completed task
 * @returns Updated agent state with the result and completed phase
 */
export function completeTask(state: AgentState, result: unknown): AgentState {
  const now = Date.now();
  return {
    ...state,
    phase: 'completed',
    result,
    completedAt: now,
    updatedAt: now,
  };
}

/**
 * Marks the task as failed with an error message
 * @param state - Current agent state
 * @param error - The error message
 * @returns Updated agent state with the error and failed phase
 */
export function failTask(state: AgentState, error: string): AgentState {
  const now = Date.now();
  return {
    ...state,
    phase: 'failed',
    error,
    completedAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// State Creation Functions (Expected by Tests)
// ============================================================================

/**
 * Creates a completed state from the current state
 * @param state - Current agent state
 * @returns Updated agent state marked as completed
 */
export function createCompletedState(state: AgentState): AgentState {
  return completeTask(state, { success: true });
}

/**
 * Creates a failed state from the current state
 * @param state - Current agent state
 * @param errorMessage - The error message
 * @returns Updated agent state marked as failed
 */
export function createFailedState(state: AgentState, errorMessage: string): AgentState {
  return failTask(state, errorMessage);
}

// ============================================================================
// Phase Update Functions (Expected by Tests)
// ============================================================================

/**
 * Updates state to planning phase with thought
 * @param state - Current agent state
 * @param thought - The planning thought with confidence and timestamp
 * @returns Updated agent state in planning phase
 */
export function updateToPlanningPhase(
  state: AgentState,
  thought: { thought: string; confidence?: number; timestamp: number; reasoning?: string }
): AgentState {
  return {
    ...state,
    phase: 'planning',
    currentThought: {
      thought: thought.thought,
      confidence: thought.confidence ?? 0.8,
      reasoning: thought.reasoning || '',
      timestamp: thought.timestamp,
    },
    iterations: state.iterations + 1,
    updatedAt: Date.now(),
  };
}

/**
 * Updates state to executing phase with action
 * @param state - Current agent state
 * @param action - The next action details
 * @returns Updated agent state in executing phase
 */
export function updateToExecutingPhase(
  state: AgentState,
  action: { toolName: string; arguments: Record<string, unknown> }
): AgentState {
  return {
    ...state,
    phase: 'executing',
    currentAction: {
      toolName: action.toolName,
      arguments: action.arguments,
    },
    updatedAt: Date.now(),
  };
}

/**
 * Updates state to evaluating phase with tool result
 * @param state - Current agent state
 * @param toolRecord - The tool call record with result
 * @returns Updated agent state in evaluating phase
 */
export function updateToEvaluatingPhase(
  state: AgentState,
  toolRecord: ToolCallRecord
): AgentState {
  return {
    ...state,
    phase: 'evaluating',
    currentAction: null,
    toolCalls: [...state.toolCalls, toolRecord],
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Utility Functions (Expected by Tests)
// ============================================================================

/**
 * Checks if the agent should continue execution
 * @param state - Current agent state
 * @param maxIterations - Maximum iterations allowed
 * @returns True if agent should continue
 */
export function shouldContinue(state: AgentState, maxIterations: number): boolean {
  const terminalPhases: AgentPhase[] = ['completed', 'failed'];
  return (
    !terminalPhases.includes(state.phase) &&
    state.iterations < maxIterations
  );
}

/**
 * Returns the Chinese display name for a phase
 * @param phase - The phase to get display name for
 * @returns Chinese display name
 */
export function getPhaseDisplayName(phase: AgentPhase): string {
  const displayNames: Record<AgentPhase, string> = {
    idle: '等待任务',
    planning: '规划中',
    executing: '执行中',
    evaluating: '评估中',
    completed: '已完成',
    failed: '失败',
  };
  return displayNames[phase];
}

