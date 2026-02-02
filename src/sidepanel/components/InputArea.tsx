/**
 * Input Area Component
 * 输入区域组件，包含文本输入和发送按钮
 * 
 * 特性：
 * - 自动调整高度的textarea
 * - 发送/停止按钮
 * - 快捷键支持（Enter发送，Shift+Enter换行）
 * - 字符计数
 * - 性能优化
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  Send,
  StopCircle,
  Command,
  CornerDownLeft,
} from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

interface InputAreaProps {
  onSend: (content: string) => void;
  onStop: () => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  maxLength?: number;
}

// ============================================================================
// 常量定义
// ============================================================================

/** 默认最大长度 */
const DEFAULT_MAX_LENGTH = 4000;

/** 最大行数限制 */
const MAX_ROWS = 6;

/** 最小高度行数 */
const MIN_ROWS = 1;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 计算textarea高度
 */
const calculateHeight = (
  value: string,
  minRows: number,
  maxRows: number,
  lineHeight: number
): number => {
  const lines = value.split('\n').length;
  const rows = Math.max(minRows, Math.min(lines, maxRows));
  return rows * lineHeight;
};

/**
 * 估算token数量
 */
const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

/**
 * 检查是否是空输入
 */
const isEmptyInput = (input: string): boolean => {
  return input.trim().length === 0;
};

// ============================================================================
// 子组件：发送按钮
// ============================================================================

interface SendButtonProps {
  disabled: boolean;
  onClick: () => void;
}

const SendButton = React.memo(function SendButton({
  disabled,
  onClick,
}: SendButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex items-center justify-center',
        'w-10 h-10 rounded-xl',
        'transition-all duration-200',
        'hover:scale-105 active:scale-95',
        disabled
          ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg'
      )}
      title="发送消息 (Enter)"
    >
      <Send className="w-5 h-5" />
    </button>
  );
});

// ============================================================================
// 子组件：停止按钮
// ============================================================================

interface StopButtonProps {
  onClick: () => void;
}

const StopButton = React.memo(function StopButton({ onClick }: StopButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-4 py-2',
        'bg-red-500 hover:bg-red-600 text-white',
        'rounded-xl transition-all duration-200',
        'hover:scale-105 active:scale-95',
        'shadow-md hover:shadow-lg'
      )}
      title="停止生成"
    >
      <StopCircle className="w-5 h-5" />
      <span className="text-sm font-medium">停止</span>
    </button>
  );
});

// ============================================================================
// 子组件：字符计数器
// ============================================================================

interface CharCountProps {
  current: number;
  max: number;
}

const CharCount = React.memo(function CharCount({ current, max }: CharCountProps) {
  const percentage = (current / max) * 100;
  const isNearLimit = percentage > 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="flex items-center gap-2">
      <div className={clsx(
        'w-16 h-1.5 rounded-full overflow-hidden',
        'bg-gray-200 dark:bg-gray-600'
      )}>
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-300',
            isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-green-500'
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className={clsx(
        'text-xs',
        isAtLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'
      )}>
        {current}/{max}
      </span>
    </div>
  );
});

// ============================================================================
// 子组件：Token估算
// ============================================================================

interface TokenEstimateProps {
  text: string;
}

const TokenEstimate = React.memo(function TokenEstimate({ text }: TokenEstimateProps) {
  const tokens = useMemo(() => estimateTokens(text), [text]);

  return (
    <span className="text-xs text-gray-400 dark:text-gray-500">
      ≈ {tokens} tokens
    </span>
  );
});

// ============================================================================
// 主组件
// ============================================================================

export const InputArea = React.memo(function InputArea({
  onSend,
  onStop,
  disabled = false,
  loading = false,
  placeholder = '输入消息...（Enter 发送，Shift+Enter 换行）',
  maxLength = DEFAULT_MAX_LENGTH,
}: InputAreaProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 行高（根据CSS计算）
  const lineHeight = 24; // 1.5rem = 24px

  // 计算高度
  const textareaHeight = useMemo(() => {
    return calculateHeight(input, MIN_ROWS, MAX_ROWS, lineHeight);
  }, [input]);

  // 是否可以发送
  const canSend = useMemo(() => {
    return !isEmptyInput(input) && !disabled && !loading;
  }, [input, disabled, loading]);

  // 字符数
  const charCount = input.length;

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaHeight}px`;
    }
  }, [input, textareaHeight]);

  // 聚焦处理
  const handleFocus = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  // 输入变化
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    // 限制最大长度
    if (value.length <= maxLength) {
      setInput(value);
    }
  }, [maxLength]);

  // 键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 阻止默认行为（防止插入换行符）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (canSend) {
        handleSubmit();
      }
    }

    // Cmd/Ctrl + Enter 发送
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();

      if (canSend) {
        handleSubmit();
      }
    }
  }, [canSend]);

  // 提交表单
  const handleSubmit = useCallback(() => {
    if (canSend) {
      onSend(input.trim());
      setInput('');

      // 重置高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      // 保持焦点
      textareaRef.current?.focus();
    }
  }, [input, canSend, onSend]);

  // 停止生成
  const handleStop = useCallback(() => {
    onStop();
  }, [onStop]);

  // 点击容器聚焦
  const handleContainerClick = useCallback(() => {
    handleFocus();
  }, [handleFocus]);

  return (
    <div
      ref={containerRef}
      className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
    >
      {/* 快捷键提示 */}
      <div className="px-4 py-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>+</span>
            <CornerDownLeft className="w-3 h-3" />
            <span>发送</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Enter</span>
            <span>发送</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Shift+Enter</span>
            <span>换行</span>
          </div>
        </div>

        {/* Token估算 */}
        {input.length > 0 && (
          <TokenEstimate text={input} />
        )}
      </div>

      {/* 输入区域 */}
      <div className="px-4 pb-4">
        <div
          onClick={handleContainerClick}
          className={clsx(
            'relative rounded-xl overflow-hidden',
            'bg-gray-100 dark:bg-gray-700',
            'transition-all duration-200',
            disabled && 'opacity-50 cursor-not-allowed',
            !disabled && 'ring-2 ring-transparent focus-within:ring-blue-500'
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={MIN_ROWS}
            className={clsx(
              'w-full px-4 py-3',
              'bg-transparent border-0 rounded-xl resize-none',
              'focus:outline-none',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'text-gray-900 dark:text-gray-100',
              'min-h-[48px] max-h-[144px]',
              'leading-relaxed',
              'scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600',
              'scrollbar-track-transparent'
            )}
            style={{
              height: `${textareaHeight}px`,
            }}
          />

          {/* 操作按钮 */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {loading ? (
              <StopButton onClick={handleStop} />
            ) : (
              <SendButton
                disabled={!canSend}
                onClick={handleSubmit}
              />
            )}
          </div>
        </div>

        {/* 字符计数 */}
        {input.length > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <CharCount current={charCount} max={maxLength} />

            {/* 发送提示 */}
            {canSend && (
              <span className="text-xs text-blue-500 dark:text-blue-400">
                按 Enter 发送
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// 导出
// ============================================================================

export type { InputAreaProps };
