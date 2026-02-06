import { describe, it, expect } from 'vitest';
import type {
  AgentState,
  ToolDefinition,
  ToolResult,
  ToolContext,
  ToolExecutor,
} from './types';

describe('Agent Types', () => {
  describe('AgentState', () => {
    it('should allow creating valid agent state', () => {
      const state: AgentState = {
        id: 'test-id',
        status: 'idle',
        tools: [],
        context: {},
        lastUpdated: Date.now(),
      };

      expect(state.id).toBe('test-id');
      expect(state.status).toBe('idle');
      expect(state.tools).toEqual([]);
      expect(state.context).toEqual({});
      expect(state.lastUpdated).toBeDefined();
    });

    it('should allow all status values', () => {
      const statuses: AgentState['status'][] = ['idle', 'thinking', 'executing', 'error'];

      statuses.forEach(status => {
        const state: AgentState = {
          id: 'test',
          status,
          tools: [],
          context: {},
          lastUpdated: Date.now(),
        };
        expect(state.status).toBe(status);
      });
    });
  });

  describe('ToolDefinition', () => {
    it('should create valid tool definition', () => {
      const tool: ToolDefinition = {
        name: 'navigate',
        description: 'Navigate to a URL',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string' },
          },
          required: ['url'],
        },
        requiresConfirmation: false,
      };

      expect(tool.name).toBe('navigate');
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.required).toContain('url');
    });
  });

  describe('ToolResult', () => {
    it('should create successful tool result', () => {
      const result: ToolResult = {
        toolName: 'navigate',
        success: true,
        data: { url: 'https://example.com' },
        timestamp: Date.now(),
      };

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ url: 'https://example.com' });
    });

    it('should create failed tool result with error', () => {
      const result: ToolResult = {
        toolName: 'navigate',
        success: false,
        error: 'Navigation failed',
        timestamp: Date.now(),
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation failed');
    });

    it('should allow metadata', () => {
      const result: ToolResult = {
        toolName: 'test',
        success: true,
        timestamp: Date.now(),
        metadata: {
          duration: 100,
          retries: 1,
        },
      };

      expect(result.metadata?.duration).toBe(100);
    });
  });

  describe('ToolContext', () => {
    it('should allow optional properties', () => {
      const context1: ToolContext = {};
      const context2: ToolContext = {
        tabId: 1,
        url: 'https://example.com',
      };

      expect(context1.tabId).toBeUndefined();
      expect(context2.tabId).toBe(1);
      expect(context2.url).toBe('https://example.com');
    });
  });

  describe('ToolExecutor', () => {
    it('should define valid executor interface', () => {
      const executor: ToolExecutor = {
        name: 'test',
        description: 'Test tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
          required: ['input'],
        },
        execute: async (params, _context) => {
          return {
            toolName: 'test',
            success: true,
            data: params,
            timestamp: Date.now(),
          };
        },
      };

      expect(executor.name).toBe('test');
      expect(typeof executor.execute).toBe('function');
    });
  });
});
