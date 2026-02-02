/**
 * Chat Window Component
 * 聊天窗口组件，包含消息列表和输入区域
 * 
 * 特性：
 * - 消息列表展示
 * - 自动滚动优化（requestAnimationFrame）
 * - 空状态提示
 * - 性能优化（虚拟滚动准备）
 * - 滚动检测和底部提示
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  Bot,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { MessageBubble, Message } from './MessageBubble';
import { InputArea } from './InputArea';

// ============================================================================
// 类型定义
// ============================================================================

interface ChatWindowProps {
  messages: Message[];
  onSend: (content: string) => void;
  onStop: () => void;
  loading?: boolean;
  disabled?: boolean;
}

// ============================================================================
// 常量定义
// ============================================================================

/** 自动滚动容差值（像素） */
const SCROLL_TOLERANCE = 50;

/** 滚动动画持续时间（毫秒） */
const SCROLL_DURATION = 300;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 平滑滚动到底部
 */
const smoothScrollToBottom = (
  container: HTMLElement,
  duration: number = SCROLL_DURATION
): void => {
  const start = container.scrollTop;
  const end = container.scrollHeight - container.clientHeight;
  const change = end - start;
  const startTime = performance.now();

  const animateScroll = (currentTime: number): void => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 使用缓动函数
    const easeOutQuad = 1 - (1 - progress) * (1 - progress);

    container.scrollTop = start + change * easeOutQuad;

    if (progress < 1) {
      requestAnimationFrame(animateScroll);
    }
  };

  requestAnimationFrame(animateScroll);
};

/**
 * 检查是否接近底部
 */
const isNearBottom = (
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  tolerance: number = SCROLL_TOLERANCE
): boolean => {
  return scrollHeight - scrollTop - clientHeight < tolerance;
};

// ============================================================================
// 子组件：空状态
// ============================================================================

interface EmptyStateProps {
  onQuickAction: (message: string) => void;
}

const EmptyState = React.memo(function EmptyState({ onQuickAction }: EmptyStateProps) {
  const quickActions = useMemo(() => [
    { label: '你好，请介绍一下自己', message: '你好，请介绍一下自己' },
    { label: '总结当前页面', message: '帮我总结当前页面的内容' },
    { label: '提取关键信息', message: '帮我提取当前页面的关键信息' },
    { label: '解答问题', message: '回答我关于当前页面的问题' },
  ], []);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
      {/* 图标 */}
      <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
        <Bot className="w-8 h-8 text-white" />
      </div>

      {/* 标题 */}
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
        开始对话
      </h3>

      {/* 描述 */}
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        输入你的问题，我会基于网页内容和记忆来回答你。
        我会记住我们的对话内容，以便提供更好的服务。
      </p>

      {/* 快捷操作 */}
      <div className="flex flex-wrap justify-center gap-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onQuickAction(action.message)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium',
              'transition-all duration-200',
              'hover:scale-105 active:scale-95',
              'bg-gradient-to-r from-blue-500 to-blue-600',
              'text-white shadow-md hover:shadow-lg',
              'flex items-center gap-2'
            )}
          >
            <Sparkles className="w-4 h-4" />
            {action.label}
          </button>
        ))}
      </div>

      {/* 提示 */}
      <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
        按 Enter 发送消息，Shift+Enter 换行
      </p>
    </div>
  );
});

// ============================================================================
// 子组件：加载指示器
// ============================================================================

interface LoadingIndicatorProps {
  message?: string;
}

const LoadingIndicator = React.memo(function LoadingIndicator({
  message = 'AI 正在思考...'
}: LoadingIndicatorProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex gap-1.5">
        <span
          className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {message}
      </span>
    </div>
  );
});

// ============================================================================
// 子组件：滚动到底部按钮
// ============================================================================

interface ScrollToBottomButtonProps {
  onClick: () => void;
  unreadCount?: number;
}

const ScrollToBottomButton = React.memo(function ScrollToBottomButton({
  onClick,
  unreadCount,
}: ScrollToBottomButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'absolute bottom-24 right-6',
        'w-10 h-10',
        'bg-white dark:bg-gray-700',
        'shadow-lg rounded-full',
        'flex items-center justify-center',
        'text-gray-600 dark:text-gray-300',
        'hover:bg-gray-100 dark:hover:bg-gray-600',
        'transition-all duration-200',
        'ring-2 ring-white dark:ring-gray-700',
        'hover:scale-105 active:scale-95'
      )}
      title="滚动到底部"
    >
      <ChevronDown className="w-5 h-5" />

      {/* 未读消息数 */}
      {unreadCount && unreadCount > 0 && (
        <span className={clsx(
          'absolute -top-1 -right-1',
          'w-5 h-5',
          'bg-red-500 text-white',
          'rounded-full text-xs font-medium',
          'flex items-center justify-center'
        )}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
});

// ============================================================================
// 主组件
// ============================================================================

export const ChatWindow = React.memo(function ChatWindow({
  messages,
  onSend,
  onStop,
  loading = false,
  disabled = false,
}: ChatWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const isFirstRender = useRef(true);

  // 过滤消息
  const { displayMessages, systemMessages } = useMemo(() => {
    const system = messages.filter((m) => m.role === 'system');
    const display = messages.filter((m) => m.role !== 'system');
    return { systemMessages: system, displayMessages: display };
  }, [messages]);

  // 检查是否为空
  const isEmpty = displayMessages.length === 0 && systemMessages.length === 0;

  // 自动滚动到底部
  const scrollToBottom = useCallback((smooth: boolean = true) => {
    if (messagesEndRef.current) {
      if (smooth) {
        smoothScrollToBottom(containerRef.current!);
      } else {
        containerRef.current!.scrollTop = containerRef.current!.scrollHeight;
      }
      setUnreadCount(0);
    }
  }, []);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const nearBottom = isNearBottom(scrollTop, scrollHeight, clientHeight);

    setIsAtBottom(nearBottom);

    if (!nearBottom && !loading) {
      // 用户手动滚动，更新未读计数
      const totalHeight = scrollHeight - clientHeight;
      const hiddenMessages = Math.ceil((totalHeight - scrollTop) / 100); // 估算未读消息数
      setUnreadCount(Math.min(hiddenMessages, 99));
    } else {
      setUnreadCount(0);
    }
  }, [loading]);

  // 防抖滚动处理
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;

    const handleScrollEvent = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScrollEvent, { passive: true });
    return () => container.removeEventListener('scroll', handleScrollEvent);
  }, [handleScroll]);

  // 新消息到达时自动滚动
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (messages.length > 0) {
      // 如果用户在底部或正在加载，自动滚动
      if (isAtBottom || loading) {
        scrollToBottom(true);
      }
    }
  }, [messages.length, isAtBottom, loading, scrollToBottom]);

  // 快捷操作
  const handleQuickAction = useCallback((message: string) => {
    onSend(message);
  }, [onSend]);

  // 获取最后一个助手消息（用于显示打字机效果）
  const lastAssistantMessage = useMemo(() => {
    return displayMessages.filter((m) => m.role === 'assistant').slice(-1)[0];
  }, [displayMessages]);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* 消息容器 */}
      <div
        ref={containerRef}
        className={clsx(
          'flex-1 overflow-y-auto',
          'px-4 py-4 space-y-4',
          'scroll-smooth',
          'scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600',
          'scrollbar-track-transparent'
        )}
      >
        {/* 空状态 */}
        {isEmpty && (
          <EmptyState onQuickAction={handleQuickAction} />
        )}

        {/* 非空状态 */}
        {!isEmpty && (
          <>
            {/* 系统消息 */}
            {systemMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* 用户和助手消息 */}
            {displayMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={loading && message.id === lastAssistantMessage?.id}
              />
            ))}

            {/* 加载指示器 */}
            {loading && (
              <LoadingIndicator />
            )}
          </>
        )}

        {/* 滚动锚点 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 滚动到底部按钮 */}
      {!isAtBottom && !isEmpty && (
        <ScrollToBottomButton
          onClick={() => scrollToBottom(true)}
          unreadCount={unreadCount}
        />
      )}

      {/* 输入区域 */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <InputArea
          onSend={onSend}
          onStop={onStop}
          disabled={disabled}
          loading={loading}
        />
      </div>
    </div>
  );
});

// ============================================================================
// 导出
// ============================================================================

export type { ChatWindowProps };
