/**
 * Browser Pal - Service Worker (Manifest V3)
 * Core background script handling extension lifecycle, global shortcuts,
 * sidepanel communication, and AI agent task management
 *
 * Architecture:
 * - Uses Chrome Extension Manifest V3 Service Worker
 * - Supports global shortcuts (Cmd/Ctrl+Shift+L) to trigger sidepanel
 * - Communicates with sidepanel via chrome.runtime.onMessage
 * - Manages AI agent tasks with AgentCore integration
 */

import browser from 'webextension-polyfill';
import { AgentCore } from './agent-core';
import type { ToolExecutor, ToolResult, ToolContext } from '../lib/agent/tool-executor';
import type { AgentState } from '../lib/agent/agent-state';
import type { ToolDefinition } from '../lib/openai';

// ============================================================================
// Type Definitions
// ============================================================================

/** Sidebar state */
interface SidePanelState {
  isOpen: boolean;
  lastActiveTabId: number | null;
  lastOpenTime: number;
}

/** Message types for general extension operations */
type MessageType =
  | 'PING'
  | 'GET_STATE'
  | 'SET_STATE'
  | 'OPEN_SIDEPANEL'
  | 'CLOSE_SIDEPANEL'
  | 'TOGGLE_SIDEPANEL'
  | 'NOTIFY'
  | 'LOG';

/** Agent message types */
type AgentMessageType =
  | 'START_AGENT_TASK'
  | 'STOP_AGENT_TASK'
  | 'AGENT_STATE_UPDATE'
  | 'EXECUTE_TOOL'
  | 'GET_AGENT_STATE'
  | 'GET_AVAILABLE_TOOLS';

/** Combined message type */
type ExtendedMessageType = MessageType | AgentMessageType;

/** Extension message interface */
interface ExtensionMessage {
  type: ExtendedMessageType;
  payload?: unknown;
  tabId?: number;
}

/** Extension message response interface */
interface ExtensionMessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Agent task start payload */
interface AgentTaskPayload {
  task: string;
  tabId?: number;
  options?: {
    maxIterations?: number;
    systemPrompt?: string;
  };
}

/** Tool execution payload */
interface ToolExecutionPayload {
  toolName: string;
  arguments: Record<string, unknown>;
  tabId?: number;
}

/** Agent state update message */
interface AgentStateUpdateMessage {
  type: 'AGENT_STATE_UPDATE';
  state: AgentState;
  tabId: number;
}

/** Log level */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Update interval info */
interface UpdateIntervalInfo {
  intervalId: ReturnType<typeof setInterval>;
  tabId: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  STATE: 'bp_state',
  SETTINGS: 'bp_settings',
  API_KEY: 'bp_api_key',
} as const;

const DEFAULT_STATE: SidePanelState = {
  isOpen: false,
  lastActiveTabId: null,
  lastOpenTime: 0,
};

const STATE_UPDATE_INTERVAL_MS = 500;

// ============================================================================
// Logging System
// ============================================================================

class Logger {
  private static readonly PREFIX = '[Browser Pal]';
  private static readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private static currentLevel: LogLevel = 'info';

  static setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private static shouldLog(level: LogLevel): boolean {
    return this.LOG_LEVELS[level] >= this.LOG_LEVELS[this.currentLevel];
  }

  private static formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `${this.PREFIX} [${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  static debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  static info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  static warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  static error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }
}

// ============================================================================
// State Management
// ============================================================================

class StateManager {
  private state: SidePanelState = { ...DEFAULT_STATE };
  private listeners: Set<(state: SidePanelState) => void> = new Set();

  async init(): Promise<void> {
    try {
      const result = await browser.storage.local.get(STORAGE_KEYS.STATE);
      if (result[STORAGE_KEYS.STATE]) {
        this.state = { ...DEFAULT_STATE, ...result[STORAGE_KEYS.STATE] };
      }
      Logger.info('State manager initialized', this.state);
    } catch (error) {
      Logger.error('State manager initialization failed', error);
      throw error;
    }
  }

  getState(): SidePanelState {
    return { ...this.state };
  }

  async setState(updates: Partial<SidePanelState>): Promise<void> {
    this.state = { ...this.state, ...updates };
    await browser.storage.local.set({ [STORAGE_KEYS.STATE]: this.state });
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.getState());
      } catch (error) {
        Logger.error('State listener execution failed', error);
      }
    });
  }

  subscribe(listener: (state: SidePanelState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

const stateManager = new StateManager();

// ============================================================================
// Sidebar Management
// ============================================================================

class SidePanelManager {
  private openingTabs: Set<number> = new Set();

  /**
   * Get the current active tab
   */
  private async getCurrentTab(): Promise<browser.Tabs.Tab | null> {
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tabs[0] || null;
    } catch (error) {
      Logger.error('Failed to get current tab', error);
      return null;
    }
  }

  /**
   * Open the sidebar
   */
  async open(): Promise<boolean> {
    const tab = await this.getCurrentTab();
    if (!tab?.id) {
      Logger.warn('Cannot get current tab, cannot open sidebar');
      return false;
    }

    const tabId = tab.id;

    // Prevent duplicate opens
    if (this.openingTabs.has(tabId)) {
      Logger.debug('Sidebar is already opening, skipping duplicate request');
      return true;
    }

    this.openingTabs.add(tabId);

    try {
      await new Promise<void>((resolve, reject) => {
        chrome.sidePanel.open({ tabId }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      await stateManager.setState({
        isOpen: true,
        lastActiveTabId: tabId,
        lastOpenTime: Date.now(),
      });

      Logger.info('Sidebar opened', { tabId });
      return true;
    } catch (error) {
      Logger.error('Failed to open sidebar', error);
      return false;
    } finally {
      this.openingTabs.delete(tabId);
    }
  }

  /**
   * Close the sidebar
   */
  async close(): Promise<boolean> {
    const tab = await this.getCurrentTab();
    if (!tab?.id) {
      Logger.warn('Cannot get current tab, cannot close sidebar');
      return false;
    }

    try {
      await stateManager.setState({
        isOpen: false,
        lastActiveTabId: null,
      });

      // Notify sidebar to close
      await this.notifySidePanel('CLOSE_REQUEST');

      Logger.info('Sidebar close request sent');
      return true;
    } catch (error) {
      Logger.error('Failed to close sidebar', error);
      return false;
    }
  }

  /**
   * Toggle sidebar state
   */
  async toggle(): Promise<boolean> {
    const state = stateManager.getState();
    return state.isOpen ? this.close() : this.open();
  }

  /**
   * Send notification to sidebar
   */
  private async notifySidePanel(
    action: string,
    data?: unknown
  ): Promise<void> {
    try {
      await browser.runtime.sendMessage({
        type: 'SIDEPANEL_ACTION',
        action,
        data,
      });
    } catch {
      // Sidebar may not be open, ignore error
      Logger.debug('Failed to notify sidebar (may not be open)');
    }
  }
}

const sidePanelManager = new SidePanelManager();

// ============================================================================
// Agent Management
// ============================================================================

/**
 * Active agent instances per tab
 * Map<tabId, AgentCore>
 */
const activeAgents: Map<number, AgentCore> = new Map();

/**
 * Active update intervals per tab
 * Map<tabId, UpdateIntervalInfo>
 */
const updateIntervals: Map<number, UpdateIntervalInfo> = new Map();

/**
 * Background tool executor for agent tools
 */
class BackgroundToolExecutor implements ToolExecutor {
  name = 'background';
  description = 'Background tool executor for browser automation';
  parameters = {
    type: 'object' as const,
    properties: {},
  };

  private toolExecutors: Map<string, (args: Record<string, unknown>, tabId: number) => Promise<{ success: boolean; data?: unknown; error?: string }>> = new Map();

  constructor() {
    // Register default tool handlers
    this.registerToolHandler('navigate', this.handleNavigate.bind(this));
    this.registerToolHandler('click', this.handleClick.bind(this));
    this.registerToolHandler('fill', this.handleFill.bind(this));
    this.registerToolHandler('executeScript', this.handleExecuteScript.bind(this));
    this.registerToolHandler('getPageInfo', this.handleGetPageInfo.bind(this));
    this.registerToolHandler('captureScreenshot', this.handleCaptureScreenshot.bind(this));
    this.registerToolHandler('captureDOM', this.handleCaptureDOM.bind(this));
  }

  /**
   * Register a tool handler
   */
  registerToolHandler(
    toolName: string,
    handler: (args: Record<string, unknown>, tabId: number) => Promise<{ success: boolean; data?: unknown; error?: string }>
  ): void {
    this.toolExecutors.set(toolName, handler);
  }

  /**
   * Execute a tool
   */
  async execute(
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const toolName = params.toolName as string || '';
    const args = { ...params };
    delete (args as Record<string, unknown>).toolName;

    const tabId = context.tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;

    if (!tabId) {
      return {
        toolName,
        success: false,
        error: 'No tab context provided',
        timestamp: Date.now(),
      };
    }

    const handler = this.toolExecutors.get(toolName);
    if (!handler) {
      return {
        toolName,
        success: false,
        error: `Unknown tool: ${toolName}`,
        timestamp: Date.now(),
      };
    }

    try {
      const result = await handler(args, tabId);
      return {
        toolName,
        success: result.success,
        data: result.data,
        error: result.error,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        toolName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get available tools
   */
  getAvailableTools(): ToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'navigate',
          description: 'Navigate to a URL',
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to navigate to',
              },
            },
            required: ['url'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'click',
          description: 'Click on an element by selector',
          parameters: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the element',
              },
            },
            required: ['selector'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fill',
          description: 'Fill in a form field',
          parameters: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the input element',
              },
              value: {
                type: 'string',
                description: 'Value to fill in',
              },
            },
            required: ['selector', 'value'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'executeScript',
          description: 'Execute JavaScript in the page context',
          parameters: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'JavaScript code to execute',
              },
            },
            required: ['code'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getPageInfo',
          description: 'Get basic page information',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
    ];
  }

  /**
   * Handle navigation
   */
  private async handleNavigate(args: Record<string, unknown>, tabId: number): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const url = args.url as string;
    if (!url) {
      return { success: false, error: 'URL is required' };
    }

    try {
      await chrome.tabs.update(tabId, { url });
      return { success: true, data: { url, tabId } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Navigation failed' };
    }
  }

  /**
   * Handle click
   */
  private async handleClick(args: Record<string, unknown>, tabId: number): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const selector = args.selector as string;
    if (!selector) {
      return { success: false, error: 'Selector is required' };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel: string) => {
          const element = document.querySelector(sel) as HTMLElement;
          if (!element) {
            return { success: false, error: 'Element not found' };
          }
          element.click();
          return { success: true };
        },
        args: [selector],
      });

      if (results[0]?.result && (results[0].result as { success?: boolean }).success) {
        return { success: true, data: { selector } };
      }
      return { success: false, error: (results[0].result as { error?: string })?.error || 'Click failed' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Click failed' };
    }
  }

  /**
   * Handle fill form field
   */
  private async handleFill(args: Record<string, unknown>, tabId: number): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const selector = args.selector as string;
    const value = args.value as string;

    if (!selector || value === undefined) {
      return { success: false, error: 'Selector and value are required' };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel: string, val: string) => {
          const element = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement;
          if (!element) {
            return { success: false, error: 'Element not found' };
          }
          element.value = val;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        },
        args: [selector, value],
      });

      if (results[0]?.result && (results[0].result as { success?: boolean }).success) {
        return { success: true, data: { selector, value } };
      }
      return { success: false, error: (results[0].result as { error?: string })?.error || 'Fill failed' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Fill failed' };
    }
  }

  /**
   * Handle script execution
   */
  private async handleExecuteScript(args: Record<string, unknown>, tabId: number): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const code = args.code as string;
    if (!code) {
      return { success: false, error: 'Code is required' };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: ((scriptCode: string) => {
          const executeFn = new Function('code', 'return eval(code)');
          return executeFn(scriptCode);
        }) as (scriptCode: string) => unknown,
        args: [code],
      });

      return { success: true, data: results[0]?.result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Script execution failed' };
    }
  }

  /**
   * Handle get page info
   */
  private async handleGetPageInfo(_args: Record<string, unknown>, tabId: number): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const tab = await chrome.tabs.get(tabId);
      return {
        success: true,
        data: {
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          incognito: tab.incognito,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get page info' };
    }
  }

  /**
   * Handle capture screenshot
   */
  private async handleCaptureScreenshot(args: Record<string, unknown>, tabId: number): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const quality = (args.quality as 'low' | 'medium' | 'high') || 'high';
      const qualityMap = { low: 50, medium: 75, high: 92 };

      const dataUrl = await chrome.tabs.captureVisibleTab(tabId, {
        format: 'jpeg',
        quality: qualityMap[quality],
      });

      return { success: true, data: { dataUrl, quality } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Screenshot failed' };
    }
  }

  /**
   * Handle capture DOM
   */
  private async handleCaptureDOM(args: Record<string, unknown>, tabId: number): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'captureDOM',
        selector: args.selector,
        includeAttributes: args.includeAttributes,
        maxDepth: args.maxDepth,
      });

      if (response && response.success) {
        return { success: true, data: response };
      }
      return { success: false, error: response?.error || 'DOM capture failed' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'DOM capture failed' };
    }
  }
}

const backgroundToolExecutor = new BackgroundToolExecutor();

/**
 * Agent task manager class
 */
class AgentManager {
  /**
   * Start an agent task for a specific tab
   */
  async startTask(payload: AgentTaskPayload, senderTabId?: number): Promise<ExtensionMessageResponse> {
    const tabId = payload.tabId ?? senderTabId;

    if (!tabId) {
      return { success: false, error: 'No tab ID provided' };
    }

    // Check if there's already an active agent for this tab
    if (activeAgents.has(tabId)) {
      return { success: false, error: 'An agent task is already running for this tab' };
    }

    const task = payload.task;
    if (!task) {
      return { success: false, error: 'Task is required' };
    }

    Logger.info('Starting agent task', { tabId, task: task.substring(0, 100) });

    try {
      // Create a new agent instance
      const agent = new AgentCore({
        maxIterations: payload.options?.maxIterations ?? 50,
        systemPrompt: payload.options?.systemPrompt,
        toolExecutor: backgroundToolExecutor,
      });

      // Store the agent
      activeAgents.set(tabId, agent);

      // Set up periodic state updates
      const intervalId = setInterval(() => {
        this.sendStateUpdate(tabId);
      }, STATE_UPDATE_INTERVAL_MS);

      updateIntervals.set(tabId, { intervalId, tabId });

      // Run the agent task (async, don't await)
      this.runAgentTask(agent, tabId, task);

      // Send initial state
      this.sendStateUpdate(tabId);

      return { success: true, data: { message: 'Agent task started' } };
    } catch (error) {
      Logger.error('Failed to start agent task', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start agent task',
      };
    }
  }

  /**
   * Run agent task asynchronously
   */
  private async runAgentTask(agent: AgentCore, tabId: number, task: string): Promise<void> {
    try {
      Logger.debug('Running agent task', { tabId });
      const finalState = await agent.run(task);

      Logger.info('Agent task completed', {
        tabId,
        phase: finalState.phase,
        iterations: finalState.iterations,
      });

      // Send final state
      this.sendStateUpdate(tabId);
    } catch (error) {
      Logger.error('Agent task error', { tabId, error });
    } finally {
      // Cleanup
      this.cleanup(tabId);
    }
  }

  /**
   * Stop the agent task for a specific tab
   */
  stopTask(tabId: number): ExtensionMessageResponse {
    const agent = activeAgents.get(tabId);

    if (agent) {
      Logger.info('Stopping agent task', { tabId });
      agent.stop();
      activeAgents.delete(tabId);

      // Clear update interval
      const intervalInfo = updateIntervals.get(tabId);
      if (intervalInfo) {
        clearInterval(intervalInfo.intervalId);
        updateIntervals.delete(tabId);
      }

      // Send final state update
      const state = agent.getState();
      this.sendStateUpdate(tabId, state);

      return { success: true, data: { message: 'Agent task stopped' } };
    }

    return { success: false, error: 'No active agent task for this tab' };
  }

  /**
   * Get agent state for a specific tab
   */
  getState(tabId: number): ExtensionMessageResponse {
    const agent = activeAgents.get(tabId);

    if (agent) {
      return { success: true, data: agent.getState() };
    }

    return { success: false, error: 'No active agent for this tab' };
  }

  /**
   * Send state update to sidebar
   */
  private sendStateUpdate(tabId: number, state?: AgentState): void {
    const agentState = state ?? activeAgents.get(tabId)?.getState();

    if (!agentState) {
      return;
    }

    const message: AgentStateUpdateMessage = {
      type: 'AGENT_STATE_UPDATE',
      state: agentState,
      tabId,
    };

    try {
      // Send to sidebar (no specific tab needed for sidebar communication)
      browser.runtime.sendMessage(message).catch((error) => {
        Logger.debug('Failed to send state update to sidebar', error);
      });
    } catch {
      // Sidebar may not be open
    }
  }

  /**
   * Cleanup agent resources
   */
  private cleanup(tabId: number): void {
    // Remove agent from active map
    activeAgents.delete(tabId);

    // Clear update interval
    const intervalInfo = updateIntervals.get(tabId);
    if (intervalInfo) {
      clearInterval(intervalInfo.intervalId);
      updateIntervals.delete(tabId);
    }

    Logger.debug('Agent cleanup completed', { tabId });
  }

  /**
   * Get available tools
   */
  getAvailableTools(): ToolDefinition[] {
    return backgroundToolExecutor.getAvailableTools();
  }

  /**
   * Execute a tool directly (fallback)
   */
  async executeTool(payload: ToolExecutionPayload, senderTabId?: number): Promise<ExtensionMessageResponse> {
    const tabId = payload.tabId ?? senderTabId;

    if (!tabId) {
      return { success: false, error: 'No tab ID provided' };
    }

    try {
      const result = await backgroundToolExecutor.execute(
        { toolName: payload.toolName, ...payload.arguments },
        { tabId }
      );

      if (result.success) {
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  /**
   * Cleanup all agents when sidebar is closed or tab is removed
   */
  cleanupAll(): void {
    for (const tabId of activeAgents.keys()) {
      this.cleanup(tabId);
    }
    Logger.info('All agent tasks cleaned up');
  }
}

const agentManager = new AgentManager();

// ============================================================================
// Message Handler
// ============================================================================

class MessageHandler {
  /**
   * Handle messages from content scripts or sidebar
   */
  async handleMessage(
    message: ExtensionMessage,
    sender: browser.Runtime.MessageSender
  ): Promise<ExtensionMessageResponse> {
    Logger.debug('Received message', { type: message.type, sender: sender.id });

    // Get tab ID from sender or message
    const senderTabId = sender.tab?.id;

    try {
      switch (message.type) {
        // General extension messages
        case 'PING':
          return { success: true, data: { pong: true, timestamp: Date.now() } };

        case 'GET_STATE':
          return { success: true, data: stateManager.getState() };

        case 'SET_STATE':
          if (message.payload && typeof message.payload === 'object') {
            await stateManager.setState(message.payload as Partial<SidePanelState>);
            return { success: true, data: stateManager.getState() };
          }
          return { success: false, error: 'Invalid state data' };

        case 'OPEN_SIDEPANEL':
          const openResult = await sidePanelManager.open();
          return { success: openResult };

        case 'CLOSE_SIDEPANEL':
          const closeResult = await sidePanelManager.close();
          return { success: closeResult };

        case 'TOGGLE_SIDEPANEL':
          const toggleResult = await sidePanelManager.toggle();
          return { success: toggleResult };

        case 'NOTIFY':
          await this.handleNotification(message.payload);
          return { success: true };

        case 'LOG':
          this.handleLog(message.payload);
          return { success: true };

        // Agent messages
        case 'START_AGENT_TASK':
          return await agentManager.startTask(message.payload as AgentTaskPayload, senderTabId);

        case 'STOP_AGENT_TASK':
          return agentManager.stopTask(senderTabId ?? (message.payload as { tabId?: number })?.tabId ?? 0);

        case 'GET_AGENT_STATE':
          return agentManager.getState(senderTabId ?? (message.payload as { tabId?: number })?.tabId ?? 0);

        case 'GET_AVAILABLE_TOOLS':
          return { success: true, data: agentManager.getAvailableTools() };

        case 'EXECUTE_TOOL':
          return await agentManager.executeTool(message.payload as ToolExecutionPayload, senderTabId);

        default:
          return { success: false, error: `Unknown message type: ${message.type}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Message handling failed', { type: message.type, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Handle notification messages
   */
  private async handleNotification(payload: unknown): Promise<void> {
    if (!payload || typeof payload !== 'object') return;

    const { title, message } = payload as {
      title?: string;
      message?: string;
      type?: 'info' | 'warning' | 'error';
    };

    if (!title || !message) return;

    try {
      await browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.svg',
        title,
        message,
      });
    } catch (error) {
      Logger.error('Failed to create notification', error);
    }
  }

  /**
   * Handle log messages
   */
  private handleLog(payload: unknown): void {
    if (!payload || typeof payload !== 'object') return;

    const { level, message, data } = payload as {
      level?: LogLevel;
      message?: string;
      data?: unknown;
    };

    if (!message) return;

    switch (level) {
      case 'debug':
        Logger.debug(message, data);
        break;
      case 'warn':
        Logger.warn(message, data);
        break;
      case 'error':
        Logger.error(message, data);
        break;
      default:
        Logger.info(message, data);
    }
  }
}

const messageHandler = new MessageHandler();

// ============================================================================
// Lifecycle Management
// ============================================================================

/**
 * Extension installed - initialize
 */
browser.runtime.onInstalled.addListener((details) => {
  Logger.info('Browser Pal extension installed', { reason: details.reason });

  // Initialize state
  stateManager.init().catch((error) => {
    Logger.error('Failed to initialize state', error);
  });

  // Set sidebar behavior
  chrome.sidePanel.setPanelBehavior(
    { openPanelOnActionClick: true },
    () => {
      if (chrome.runtime.lastError) {
        Logger.error('Failed to set sidebar behavior', chrome.runtime.lastError);
      } else {
        Logger.info('Sidebar behavior set successfully');
      }
    }
  );

  // Handle first install
  if (details.reason === 'install') {
    browser.tabs.create({
      url: browser.runtime.getURL('welcome.html'),
    }).catch((error) => {
      Logger.error('Failed to open welcome page', error);
    });
  } else if (details.reason === 'update') {
    Logger.info('Extension updated', { previousVersion: details.previousVersion });
  }
});

/**
 * Extension startup (browser start or reload)
 */
browser.runtime.onStartup.addListener(() => {
  Logger.info('Browser Pal extension started');

  // Reinitialize state
  stateManager.init().catch((error) => {
    Logger.error('Failed to initialize state on startup', error);
  });

  // Ensure sidebar behavior is set
  chrome.sidePanel.setPanelBehavior(
    { openPanelOnActionClick: true },
    () => {
      if (chrome.runtime.lastError) {
        Logger.error('Failed to set sidebar behavior on startup', chrome.runtime.lastError);
      }
    }
  );
});

// ============================================================================
// Keyboard Shortcut Listener
// ============================================================================

browser.commands.onCommand.addListener(async (command) => {
  Logger.info('Received shortcut command', { command });

  if (command === 'toggle_sidebar') {
    const result = await sidePanelManager.toggle();
    Logger.info('Sidebar toggle result', { result });
  }
});

// ============================================================================
// Message Listener
// ============================================================================

browser.runtime.onMessage.addListener((
  message: ExtensionMessage,
  sender: browser.Runtime.MessageSender,
  sendResponse: (response: ExtensionMessageResponse) => void
) => {
  messageHandler
    .handleMessage(message, sender)
    .then((response) => {
      sendResponse(response);
    })
    .catch((error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Message handling exception', error);
      sendResponse({ success: false, error: errorMessage });
    });

  // Return true to indicate async response
  return true;
});

// ============================================================================
// Tab Event Listeners
// ============================================================================

/**
 * Tab activation changed - update state
 */
browser.tabs.onActivated.addListener(async (activeInfo) => {
  Logger.debug('Tab activated', { tabId: activeInfo.tabId });

  const state = stateManager.getState();
  if (state.isOpen && state.lastActiveTabId !== activeInfo.tabId) {
    try {
      await chrome.sidePanel.open({ tabId: activeInfo.tabId });
      await stateManager.setState({ lastActiveTabId: activeInfo.tabId });
    } catch (error) {
      Logger.error('Failed to open sidebar after tab switch', error);
    }
  }
});

/**
 * Tab closed - cleanup
 */
browser.tabs.onRemoved.addListener((tabId) => {
  Logger.debug('Tab closed', { tabId });

  // Cleanup agent for this tab
  if (activeAgents.has(tabId)) {
    agentManager.stopTask(tabId);
  }

  const state = stateManager.getState();
  if (state.lastActiveTabId === tabId) {
    stateManager.setState({
      isOpen: false,
      lastActiveTabId: null,
    }).catch((error) => {
      Logger.error('Failed to cleanup tab state', error);
    });
  }
});

/**
 * Tab updated - check if we need to re-inject content script
 */
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    Logger.debug('Tab loading, checking agent state', { tabId });
  }
});

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Global error handler
 */
self.addEventListener('error', (event) => {
  Logger.error('Service Worker uncaught error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  });
});

/**
 * Unhandled promise rejection
 */
self.addEventListener('unhandledrejection', (event) => {
  Logger.error('Unhandled Promise rejection', {
    reason: event.reason,
  });
});

// ============================================================================
// Exports (for testing)
// ============================================================================

export {
  Logger,
  StateManager,
  SidePanelManager,
  MessageHandler,
  AgentManager,
  stateManager,
  sidePanelManager,
  agentManager,
  activeAgents,
};
