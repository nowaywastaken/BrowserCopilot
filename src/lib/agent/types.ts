/**
 * Agent System Type Definitions
 * Core types for the agent-based browser automation system
 */

/**
 * Represents the current state and context of an agent session
 */
export interface AgentState {
  /** Unique identifier for the agent session */
  id: string;
  /** Current status of the agent */
  status: 'idle' | 'thinking' | 'executing' | 'error';
  /** Available tools for this agent */
  tools: ToolDefinition[];
  /** Current conversation/memory context */
  context: Record<string, unknown>;
  /** Timestamp of last state update */
  lastUpdated: number;
}

/**
 * Definition of a tool that the agent can invoke
 */
export interface ToolDefinition {
  /** Unique name identifier for the tool */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Parameters for the tool (JSON Schema format) */
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Whether the tool requires user confirmation before execution */
  requiresConfirmation?: boolean;
}

/**
 * Result returned after tool execution
 */
export interface ToolResult {
  /** The tool that was executed */
  toolName: string;
  /** Whether the execution was successful */
  success: boolean;
  /** The result data from the tool */
  data?: unknown;
  /** Error message if execution failed */
  error?: string;
  /** Timestamp of execution */
  timestamp: number;
  /** Any metadata about the execution */
  metadata?: Record<string, unknown>;
}

/**
 * Context passed to tool executors during execution
 */
export interface ToolContext {
  /** The active tab ID */
  tabId?: number;
  /** The current page URL */
  url?: string;
}

/**
 * Tool executor interface - used by AgentCore
 */
export interface ToolExecutor {
  /** Unique name identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /** Parameters schema */
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      minimum?: number;
      maximum?: number;
    }>;
    required?: string[];
  };
  /** Execute the tool with given parameters and context */
  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
