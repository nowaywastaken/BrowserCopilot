/**
 * Agent Execution View Component
 * Displays agent execution progress, tool calls, thoughts, and results
 *
 * Features:
 * - Phase badge with icons (planning, executing, evaluating, completed, failed)
 * - Progress bar showing iteration progress
 * - Thought bubble with current reasoning
 * - Tool call list with expandable details
 * - Stop button to abort agent
 * - Final result display
 * - Error display
 */

import React, { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Brain,
  Play,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  X,
  Terminal,
  Eye,
} from 'lucide-react';
import type { AgentState, AgentPhase } from '../../lib/agent/agent-state';

// ============================================================================
// 类型定义
// ============================================================================

/** AgentExecutionView 属性 */
export interface AgentExecutionViewProps {
  /** 当前代理状态 */
  agentState: AgentState | null;
  /** 是否正在运行 */
  isRunning: boolean;
  /** 停止代理回调 */
  onStop: () => void;
  /** 返回聊天模式回调 */
  onBackToChat: () => void;
}

// ============================================================================
// 常量定义
// ============================================================================

/** 阶段配置 */
const PHASE_CONFIG: Record<AgentPhase, {
  label: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  idle: {
    label: '等待任务',
    icon: <Brain className="w-4 h-4" />,
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    textColor: 'text-gray-600 dark:text-gray-300',
    borderColor: 'border-gray-200 dark:border-gray-600',
  },
  planning: {
    label: '规划中',
    icon: <Brain className="w-4 h-4" />,
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-200 dark:border-purple-700',
  },
  executing: {
    label: '执行中',
    icon: <Zap className="w-4 h-4" />,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-200 dark:border-blue-700',
  },
  evaluating: {
    label: '评估中',
    icon: <Eye className="w-4 h-4" />,
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-700',
  },
  completed: {
    label: '已完成',
    icon: <CheckCircle className="w-4 h-4" />,
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-200 dark:border-green-700',
  },
  failed: {
    label: '失败',
    icon: <XCircle className="w-4 h-4" />,
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-200 dark:border-red-700',
  },
};

/** 工具调用状态配置 */
const TOOL_CALL_STATUS_CONFIG = {
  success: {
    icon: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
  error: {
    icon: <XCircle className="w-3.5 h-3.5 text-red-500" />,
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  pending: {
    icon: <Clock className="w-3.5 h-3.5 text-amber-500" />,
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
};

// ============================================================================
// 工具函数
// ============================================================================

/** 格式化持续时间 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

/** 格式化时间戳 */
const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// ============================================================================
// 子组件：阶段徽章
// ============================================================================

interface PhaseBadgeProps {
  phase: AgentPhase;
}

const PhaseBadge = React.memo(function PhaseBadge({ phase }: PhaseBadgeProps) {
  const config = PHASE_CONFIG[phase];

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full',
        'text-sm font-medium border',
        config.bgColor,
        config.textColor,
        config.borderColor
      )}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
});

// ============================================================================
// 子组件：工具调用项
// ============================================================================

interface ToolCallItemProps {
  call: {
    id: string;
    toolName: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    success?: boolean;
    timestamp: number;
    duration: number;
  };
}

const ToolCallItem = React.memo(function ToolCallItem({ call }: ToolCallItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig =
    call.success === true
      ? TOOL_CALL_STATUS_CONFIG.success
      : call.success === false
      ? TOOL_CALL_STATUS_CONFIG.error
      : TOOL_CALL_STATUS_CONFIG.pending;

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div
      className={clsx(
        'rounded-lg border overflow-hidden',
        'bg-white dark:bg-gray-800',
        'border-gray-200 dark:border-gray-700'
      )}
    >
      {/* 头部：工具名称和状态 */}
      <button
        onClick={toggleExpand}
        aria-expanded={isExpanded}
        aria-controls={`tool-call-${call.id}`}
        className={clsx(
          'w-full px-3 py-2 flex items-center gap-3',
          'text-left hover:bg-gray-50 dark:hover:bg-gray-700',
          'transition-colors duration-150'
        )}
      >
        {/* 展开/收起图标 */}
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}

        {/* 状态图标 */}
        <div className={clsx('p-1 rounded', statusConfig.bgColor)}>
          {statusConfig.icon}
        </div>

        {/* 工具名称 */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {call.toolName}
          </span>
        </div>

        {/* 元信息 */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>{formatDuration(call.duration)}</span>
          <span>{formatTime(call.timestamp)}</span>
        </div>
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div
          id={`tool-call-${call.id}`}
          className={clsx(
            'px-3 py-3 border-t',
            'bg-gray-50 dark:bg-gray-700/50',
            'border-gray-200 dark:border-gray-700'
          )}
        >
          {/* 参数 */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Terminal className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                参数
              </span>
            </div>
            <pre
              className={clsx(
                'p-2 rounded text-xs',
                'bg-gray-100 dark:bg-gray-900',
                'text-gray-700 dark:text-gray-300',
                'overflow-x-auto'
              )}
            >
              {JSON.stringify(call.arguments, null, 2)}
            </pre>
          </div>

          {/* 结果 */}
          {call.result !== undefined && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {call.success ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                )}
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  结果
                </span>
              </div>
              <pre
                className={clsx(
                  'p-2 rounded text-xs',
                  'bg-gray-100 dark:bg-gray-900',
                  'text-gray-700 dark:text-gray-300',
                  'overflow-x-auto'
                )}
              >
                {typeof call.result === 'string'
                  ? call.result
                  : JSON.stringify(call.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// 子组件：最终结果
// ============================================================================

interface FinalResultProps {
  result: unknown;
  duration: number;
}

const FinalResult = React.memo(function FinalResult({
  result,
  duration,
}: FinalResultProps) {
  return (
    <div
      className={clsx(
        'p-4 rounded-lg',
        'bg-green-50 dark:bg-green-900/20',
        'border border-green-200 dark:border-green-700'
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
        <span className="font-medium text-green-700 dark:text-green-300">
          任务完成
        </span>
        <span className="text-xs text-green-600 dark:text-green-400">
          ({formatDuration(duration)})
        </span>
      </div>
      <pre
        className={clsx(
          'p-3 rounded text-sm',
          'bg-white dark:bg-gray-800',
          'text-gray-800 dark:text-gray-200',
          'overflow-x-auto'
        )}
      >
        {typeof result === 'string'
          ? result
          : JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
});

// ============================================================================
// 主组件
// ============================================================================

export const AgentExecutionView = React.memo(function AgentExecutionView({
  agentState,
  isRunning,
  onStop,
  onBackToChat,
}: AgentExecutionViewProps) {
  // 计算运行时间
  const duration = agentState
    ? agentState.completedAt
      ? agentState.completedAt - agentState.startedAt
      : Date.now() - agentState.startedAt
    : 0;

  // 任务描述
  const task = agentState?.task || '未知任务';

  // 是否为终止状态
  const isTerminal =
    agentState?.phase === 'completed' || agentState?.phase === 'failed';

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div
        className={clsx(
          'flex items-center justify-between px-4 py-3',
          'bg-white dark:bg-gray-800',
          'border-b border-gray-200 dark:border-gray-700'
        )}
      >
        <div className="flex items-center gap-3">
          {/* 返回按钮 */}
          {isTerminal && (
            <button
              onClick={onBackToChat}
              className={clsx(
                'p-1.5 rounded-lg',
                'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'transition-colors'
              )}
              title="返回聊天"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          )}

          {/* 标题和阶段 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              智能代理
            </h2>
            {agentState && <PhaseBadge phase={agentState.phase} />}
          </div>
        </div>

        {/* 右侧操作 */}
        {isRunning && (
          <button
            onClick={onStop}
            className={clsx(
              'flex items-center gap-2 px-4 py-2',
              'bg-red-100 dark:bg-red-900/30',
              'text-red-700 dark:text-red-300',
              'rounded-lg',
              'hover:bg-red-200 dark:hover:bg-red-900/50',
              'transition-colors duration-150',
              'text-sm font-medium'
            )}
          >
            <X className="w-4 h-4" />
            <span>停止</span>
          </button>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 任务描述 */}
        <div
          className={clsx(
            'p-3 rounded-lg',
            'bg-gray-100 dark:bg-gray-700',
            'border border-gray-200 dark:border-gray-600'
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Play className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              当前任务
            </span>
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200">{task}</p>
        </div>

        {/* 工具调用历史 */}
        {agentState !== null && agentState.toolCalls.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                工具调用 ({agentState.toolCalls.length})
              </span>
            </div>
            <div className="space-y-2">
              {agentState.toolCalls.map((call) => (
                <ToolCallItem key={call.id} call={call} />
              ))}
            </div>
          </div>
        ) : null}

        {/* 最终结果 */}
        {isTerminal && agentState?.result ? (
          <FinalResult result={agentState.result} duration={duration} />
        ) : null}

        {/* 空状态 */}
        {!agentState ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
            <Brain className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">等待代理任务...</p>
          </div>
        ) : null}
      </div>

      {/* 底部状态栏 */}
      {agentState ? (
        <div
          className={clsx(
            'px-4 py-2 text-xs',
            'bg-gray-50 dark:bg-gray-800/50',
            'border-t border-gray-200 dark:border-gray-700',
            'text-gray-500 dark:text-gray-400',
            'flex items-center justify-between'
          )}
        >
          <span>运行时间: {formatDuration(duration)}</span>
          <span>迭代: {agentState.iterations}/{agentState.maxIterations}</span>
        </div>
      ) : null}
    </div>
  );
});

export default AgentExecutionView;
