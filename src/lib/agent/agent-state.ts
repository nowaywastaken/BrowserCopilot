/**
 * Agent State Management
 *
 * Manages the state of the agent execution loop including:
 * - Current phase (planning, executing, evaluating, completed, failed)
 * - Current thought and action
 * - Tool call history
 * - Iteration tracking
 */

// ============================================================================
// Types
// ============================================================================

/** Agent execution phases */
export type AgentPhase =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'evaluating'
  | 'completed'
  | 'failed';

/** Agent thought and action structure */
export interface AgentThought {
  thought: string;
  reasoning?: string;
  confidence?: number;
  timestamp: number;
}

/** Tool call record */
export interface ToolCallRecord {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  success: boolean;
  error?: string;
  timestamp: number;
  duration: number;
}

/** Complete agent state */
export interface AgentState {
  phase: AgentPhase;
  task: string;
  currentThought: AgentThought | null;
  currentAction: {
    toolName: string;
    arguments: Record<string, unknown>;
  } | null;
  toolCalls: ToolCallRecord[];
  iterations: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

/** Agent configuration */
export interface AgentConfig {
  maxIterations?: number;
  systemPrompt?: string;
}

// ============================================================================
// State Factory Functions
// ============================================================================

/**
 * Create initial agent state
 */
export function createInitialState(task: string, _config?: AgentConfig): AgentState {
  return {
    phase: 'idle',
    task,
    currentThought: null,
    currentAction: null,
    toolCalls: [],
    iterations: 0,
    startedAt: Date.now(),
  };
}

/**
 * Create completed state from current state
 */
export function createCompletedState(state: AgentState): AgentState {
  return {
    ...state,
    phase: 'completed',
    completedAt: Date.now(),
  };
}

/**
 * Create failed state from current state with error message
 */
export function createFailedState(state: AgentState, error: string): AgentState {
  return {
    ...state,
    phase: 'failed',
    completedAt: Date.now(),
    error,
  };
}

/**
 * Create planning state update
 */
export function updateToPlanningPhase(
  state: AgentState,
  thought: AgentThought
): AgentState {
  return {
    ...state,
    phase: 'planning',
    currentThought: thought,
    currentAction: null,
    iterations: state.iterations + 1,
  };
}

/**
 * Create executing state update with action
 */
export function updateToExecutingPhase(
  state: AgentState,
  action: { toolName: string; arguments: Record<string, unknown> }
): AgentState {
  return {
    ...state,
    phase: 'executing',
    currentAction: action,
  };
}

/**
 * Create evaluating state update with tool result
 */
export function updateToEvaluatingPhase(
  state: AgentState,
  toolResult: ToolCallRecord
): AgentState {
  return {
    ...state,
    phase: 'evaluating',
    toolCalls: [...state.toolCalls, toolResult],
  };
}

/**
 * Check if agent should continue running
 */
export function shouldContinue(state: AgentState, maxIterations: number): boolean {
  if (state.phase === 'completed' || state.phase === 'failed') {
    return false;
  }
  if (state.iterations >= maxIterations) {
    return false;
  }
  return true;
}

/**
 * Check if max iterations reached
 */
export function isMaxIterationsReached(state: AgentState, maxIterations: number): boolean {
  return state.iterations >= maxIterations && state.phase !== 'completed' && state.phase !== 'failed';
}

/**
 * Check if phase is a terminal state
 */
export function isTerminalPhase(phase: AgentPhase): boolean {
  return phase === 'completed' || phase === 'failed';
}

/**
 * Get phase display name
 */
export function getPhaseDisplayName(phase: AgentPhase): string {
  const names: Record<AgentPhase, string> = {
    idle: '等待任务',
    planning: '规划中',
    executing: '执行中',
    evaluating: '评估中',
    completed: '已完成',
    failed: '失败',
  };
  return names[phase];
}

/**
 * Get agent summary from state
 */
export function getAgentSummary(state: AgentState): {
  phase: string;
  iterations: number;
  toolCallsCount: number;
  duration: number;
  success: boolean;
} {
  const duration = (state.completedAt || Date.now()) - state.startedAt;
  return {
    phase: state.phase,
    iterations: state.iterations,
    toolCallsCount: state.toolCalls.length,
    duration,
    success: state.phase === 'completed',
  };
}
