/**
 * Agent Core Loop
 *
 * The core agent execution loop that coordinates planning, execution, and
 * evaluation phases using an LLM to decide actions and a tool executor
 * to perform browser operations.
 *
 * Architecture:
 * - While loop: planning -> executing -> evaluating
 * - Each iteration: LLM planning -> tool execution -> result evaluation
 * - Continues until task completion, failure, or max iterations
 */

import { ChatService } from '../lib/services/chat-service';
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
} from '../lib/agent/agent-state';
import type { ChatMessage, ToolDefinition } from '../lib/openai';

// ============================================================================
// Types
// ============================================================================

/** Tool executor interface */
export interface ToolExecutor {
  execute(
    toolName: string,
    args: Record<string, unknown>,
    tabContext?: { tabId?: number; url?: string; title?: string }
  ): Promise<{ success: boolean; result?: unknown; error?: string }>;
  getAvailableTools(): ToolDefinition[];
  getToolDescription?(toolName: string): string | undefined;
}

/** Agent core configuration */
export interface AgentCoreConfig {
  maxIterations?: number;
  systemPrompt?: string;
  toolExecutor?: ToolExecutor;
}

/** Planning response from LLM */
export interface PlanningResponse {
  thought: string;
  reasoning?: string;
  confidence: number;
  action?: {
    toolName: string;
    arguments: Record<string, unknown>;
  };
}

/** Evaluation response from LLM */
export interface EvaluationResponse {
  isComplete: boolean;
  reasoning: string;
  shouldContinue: boolean;
}

// ============================================================================
// Prompts
// ============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are BrowserCopilot, an intelligent browser automation assistant.

Your capabilities:
- Navigate web pages
- Click elements and fill forms
- Take screenshots
- Read page content
- Execute JavaScript in page context
- Extract and summarize information

Process:
1. PLAN: Analyze the task and decide what to do next
2. EXECUTE: Perform the action using tools
3. EVALUATE: Check if the task is complete or needs more steps

Guidelines:
- Think step by step before taking actions
- Be precise with element selectors
- Handle errors gracefully
- Ask for clarification if the task is ambiguous
- Focus on completing the user's goal efficiently

Output format:
Return your thinking and action in JSON format with:
- thought: Your reasoning about what to do
- reasoning: Additional context if needed
- confidence: How confident you are (0-1)
- action: The tool to call with arguments (if any needed)`;

const EVALUATION_PROMPT = `Based on the tool execution result, determine if the task is complete.

Task: {task}
Tool called: {toolName}
Arguments: {arguments}
Result: {result}

Evaluate:
1. Was the action successful?
2. Does this complete the original task?
3. Should we continue with more steps?

Respond in JSON format:
- isComplete: boolean - whether the task is finished
- reasoning: string - your assessment
- shouldContinue: boolean - whether to take another action`;

// ============================================================================
// Logger
// ============================================================================

class AgentLogger {
  private static enabled = true;

  static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  static debug(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.debug(`[Agent] ${message}`, ...args);
    }
  }

  static info(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.info(`[Agent] ${message}`, ...args);
    }
  }

  static warn(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.warn(`[Agent] ${message}`, ...args);
    }
  }

  static error(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.error(`[Agent] ${message}`, ...args);
    }
  }
}

// ============================================================================
// Agent Core
// ============================================================================

export class AgentCore {
  private config: Required<AgentCoreConfig>;
  private state: AgentState;
  private abortController: AbortController | null = null;
  private toolExecutor: ToolExecutor;

  constructor(config?: AgentCoreConfig) {
    this.config = {
      maxIterations: config?.maxIterations ?? 50,
      systemPrompt: config?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      toolExecutor: config?.toolExecutor ?? this.createDefaultToolExecutor(),
    };
    this.toolExecutor = this.config.toolExecutor;
    this.state = createInitialState('');
  }

  /**
   * Create a default tool executor if none provided
   */
  private createDefaultToolExecutor(): ToolExecutor {
    return {
      execute: async () => ({ success: false, error: 'No tool executor configured' }),
      getAvailableTools: () => [],
    };
  }

  /**
   * Set a custom tool executor
   */
  setToolExecutor(executor: ToolExecutor): void {
    this.toolExecutor = executor;
  }

  /**
   * Get the current state
   */
  getState(): Readonly<AgentState> {
    return { ...this.state };
  }

  /**
   * Abort the current execution
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    AgentLogger.info('Agent execution stopped');
  }

  /**
   * Main execution method - runs the agent loop
   */
  async run(task: string): Promise<AgentState> {
    // Initialize state with task
    this.state = createInitialState(task);
    this.abortController = new AbortController();

    AgentLogger.info(`Starting agent task: ${task}`);
    AgentLogger.info(`Max iterations: ${this.config.maxIterations}`);

    try {
      // Main execution loop
      while (shouldContinue(this.state, this.config.maxIterations)) {
        AgentLogger.debug(`Iteration ${this.state.iterations}, Phase: ${getPhaseDisplayName(this.state.phase)}`);

        // Phase 1: Planning
        const planningResult = await this.planningPhase();
        if (planningResult.shouldStop) {
          break;
        }

        // Phase 2: Executing
        const executingResult = await this.executingPhase();
        if (executingResult.shouldStop) {
          break;
        }

        // Phase 3: Evaluating
        const evaluatingResult = await this.evaluatingPhase({
          toolName: executingResult.toolName,
          arguments: executingResult.arguments,
          result: executingResult.result,
        });
        if (evaluatingResult.isComplete) {
          this.state = createCompletedState(this.state);
          AgentLogger.info('Task completed successfully');
          break;
        }

        // Continue loop for more iterations
        if (!evaluatingResult.shouldContinue) {
          this.state = createFailedState(this.state, 'Evaluation decided to stop');
          AgentLogger.warn('Agent decided to stop without completing task');
          break;
        }
      }

      // Check if max iterations reached
      if (!isTerminalPhase(this.state.phase)) {
        this.state = createFailedState(
          this.state,
          `Max iterations (${this.config.maxIterations}) reached without completion`
        );
        AgentLogger.warn(`Max iterations reached after ${this.state.iterations} iterations`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state = createFailedState(this.state, errorMessage);
      AgentLogger.error(`Agent execution failed: ${errorMessage}`, error);
    }

    return this.state;
  }

  /**
   * Planning Phase
   *
   * Uses LLM to analyze the task and decide what action to take next.
   * Returns whether the agent should stop (no action needed).
   */
  private async planningPhase(): Promise<{ shouldStop: boolean }> {
    AgentLogger.debug('Starting planning phase');

    // Build conversation history for context
    const messages = this.buildPlanningMessages();

    try {
      const response = await ChatService.chat(messages, {
        signal: this.abortController?.signal,
        temperature: 0.7,
      });

      const parsed = this.parsePlanningResponse(response);

      // Update state with planning result
      this.state = updateToPlanningPhase(this.state, {
        thought: parsed.thought,
        reasoning: parsed.reasoning,
        confidence: parsed.confidence,
        timestamp: Date.now(),
      });

      AgentLogger.debug(`Planning thought: ${parsed.thought.substring(0, 100)}...`);

      if (!parsed.action) {
        // No action needed - task is complete or we need more context
        AgentLogger.debug('No action planned - will evaluate task completion');
        return { shouldStop: false };
      }

      // Move to executing phase with the planned action
      this.state = updateToExecutingPhase(this.state, parsed.action);
      return { shouldStop: false };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      AgentLogger.error('Planning phase failed', error);
      throw error;
    }
  }

  /**
   * Executing Phase
   *
   * Executes the planned action using the tool executor.
   * Returns the result of the tool execution.
   */
  private async executingPhase(): Promise<{
    shouldStop: boolean;
    toolName: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }> {
    AgentLogger.debug('Starting executing phase');

    const action = this.state.currentAction;

    if (!action) {
      AgentLogger.debug('No action to execute - moving to evaluation');
      return { shouldStop: false, toolName: '', arguments: {}, result: null };
    }

    const { toolName, arguments: args } = action;
    const startTime = Date.now();

    try {
      AgentLogger.info(`Executing tool: ${toolName}`);
      AgentLogger.debug(`Tool arguments: ${JSON.stringify(args)}`);

      // Get tab context
      const tabContext = await this.getCurrentTabContext();

      // Execute the tool
      const result = await this.toolExecutor.execute(toolName, args, tabContext);
      const duration = Date.now() - startTime;

      // Create tool call record
      const toolRecord: ToolCallRecord = {
        id: crypto.randomUUID(),
        toolName,
        arguments: args,
        result: result.result,
        success: result.success,
        error: result.error,
        timestamp: startTime,
        duration,
      };

      // Update state with result
      this.state = updateToEvaluatingPhase(this.state, toolRecord);

      AgentLogger.info(`Tool execution completed: ${toolName}, success: ${result.success}`);

      return {
        shouldStop: false,
        toolName,
        arguments: args,
        result: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;

      const toolRecord: ToolCallRecord = {
        id: crypto.randomUUID(),
        toolName,
        arguments: args,
        success: false,
        error: errorMessage,
        timestamp: startTime,
        duration,
      };

      this.state = updateToEvaluatingPhase(this.state, toolRecord);

      AgentLogger.error(`Tool execution failed: ${toolName}, error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Evaluating Phase
   *
   * Evaluates the result of the tool execution and determines
   * whether the task is complete.
   */
  private async evaluatingPhase(toolExecutionResult: {
    toolName: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }): Promise<EvaluationResponse> {
    AgentLogger.debug('Starting evaluating phase');

    // If no tool was executed, evaluate task directly
    if (!toolExecutionResult.toolName) {
      return this.evaluateWithoutTool();
    }

    const { toolName, arguments: args, result } = toolExecutionResult;

    try {
      // Use LLM to evaluate the result
      const prompt = EVALUATION_PROMPT
        .replace('{task}', this.state.task)
        .replace('{toolName}', toolName)
        .replace('{arguments}', JSON.stringify(args))
        .replace('{result}', JSON.stringify(result || 'No result'));

      const response = await ChatService.chat(
        [{ role: 'user', content: prompt }],
        { signal: this.abortController?.signal, temperature: 0.3 }
      );

      return this.parseEvaluationResponse(response);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      // Fallback to simple evaluation on LLM failure
      AgentLogger.warn('Evaluation LLM failed, using fallback evaluation');
      return this.fallbackEvaluation(toolExecutionResult);
    }
  }

  /**
   * Fallback evaluation when LLM is unavailable
   */
  private fallbackEvaluation(
    toolExecutionResult: { toolName: string; result: unknown }
  ): EvaluationResponse {
    const { result } = toolExecutionResult;

    // Simple heuristic: check if the result indicates success
    const resultObj = result as { success?: boolean; error?: string };

    if (resultObj.error) {
      return {
        isComplete: false,
        reasoning: `Tool execution failed with error: ${resultObj.error}`,
        shouldContinue: false, // Stop on tool failure
      };
    }

    if (resultObj.success === false) {
      return {
        isComplete: false,
        reasoning: 'Tool reported failure',
        shouldContinue: false,
      };
    }

    // For now, always continue in fallback mode
    // The LLM should make the real decision
    return {
      isComplete: false,
      reasoning: 'Fallback evaluation: continuing with more steps',
      shouldContinue: true,
    };
  }

  /**
   * Evaluate when no tool was executed
   */
  private evaluateWithoutTool(): EvaluationResponse {
    // If no action was taken, we need more information or the task is complete
    // For now, we'll complete the task if no action was planned
    return {
      isComplete: true,
      reasoning: 'No further action needed',
      shouldContinue: false,
    };
  }

  /**
   * Build planning messages for LLM
   */
  private buildPlanningMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // System prompt
    messages.push({ role: 'system', content: this.config.systemPrompt });

    // Task description
    messages.push({
      role: 'user',
      content: `Task: ${this.state.task}\n\n${
        this.state.toolCalls.length > 0
          ? `History of actions taken:\n${this.formatToolHistory()}`
          : 'Please plan your first action.'
      }`,
    });

    return messages;
  }

  /**
   * Format tool call history for LLM context
   */
  private formatToolHistory(): string {
    return this.state.toolCalls
      .slice(-10) // Last 10 calls
      .map((call, i) => {
        const status = call.success ? 'OK' : 'FAIL';
        return `${i + 1}. [${status}] ${call.toolName}: ${JSON.stringify(call.arguments)}`;
      })
      .join('\n');
  }

  /**
   * Parse planning response from LLM
   */
  private parsePlanningResponse(response: string): PlanningResponse {
    try {
      // Try to parse as JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<PlanningResponse>;
        return {
          thought: parsed.thought || 'Analyzing task',
          reasoning: parsed.reasoning,
          confidence: parsed.confidence ?? 0.5,
          action: parsed.action,
        };
      }
    } catch {
      AgentLogger.warn('Failed to parse planning response as JSON');
    }

    // Fallback: treat response as text and try to extract intent
    return {
      thought: response,
      confidence: 0.5,
      action: this.extractActionFromText(response),
    };
  }

  /**
   * Extract action from text response (fallback)
   */
  private extractActionFromText(text: string): PlanningResponse['action'] {
    // Simple pattern matching for common actions
    const textLower = text.toLowerCase();

    if (textLower.includes('navigate') || textLower.includes('go to')) {
      const urlMatch = text.match(/https?:\/\/[^\s]+/) || text.match(/["']([^"']+)["']/);
      return {
        toolName: 'navigate',
        arguments: { url: urlMatch ? urlMatch[1] : text.replace(/.*(navigate|go to)\s*/i, '').replace(/["']/g, '') },
      };
    }

    if (textLower.includes('click')) {
      return {
        toolName: 'click',
        arguments: { selector: 'body' }, // Will need more specific selector
      };
    }

    // No action extracted
    return undefined;
  }

  /**
   * Parse evaluation response from LLM
   */
  private parseEvaluationResponse(response: string): EvaluationResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<EvaluationResponse>;
        return {
          isComplete: parsed.isComplete ?? false,
          reasoning: parsed.reasoning || '',
          shouldContinue: parsed.shouldContinue ?? !parsed.isComplete,
        };
      }
    } catch {
      AgentLogger.warn('Failed to parse evaluation response as JSON');
    }

    // Fallback: assume not complete and continue
    return {
      isComplete: false,
      reasoning: 'Could not parse evaluation',
      shouldContinue: true,
    };
  }

  /**
   * Get current tab context for tool execution
   */
  private async getCurrentTabContext(): Promise<{
    tabId?: number;
    url?: string;
    title?: string;
  }> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (tab?.id) {
        return {
          tabId: tab.id,
          url: tab.url,
          title: tab.title,
        };
      }
    } catch {
      AgentLogger.debug('Could not get tab context');
    }
    return {};
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if state is a terminal state
 */
function isTerminalPhase(phase: AgentPhase): boolean {
  return phase === 'completed' || phase === 'failed';
}

/**
 * Create and run an agent with default configuration
 */
export async function runAgentTask(
  task: string,
  toolExecutor?: ToolExecutor,
  config?: AgentCoreConfig
): Promise<AgentState> {
  const agent = new AgentCore({ toolExecutor, ...config });
  return agent.run(task);
}
