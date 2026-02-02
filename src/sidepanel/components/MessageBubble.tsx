/**
 * Message Bubble Component
 * 消息气泡组件，支持Markdown渲染、代码高亮、消息操作
 * 
 * 特性：
 * - Markdown 完整渲染
 * - 代码块复制功能
 * - 消息操作菜单（复制、重新生成等）
 * - 用户/助手/系统消息样式区分
 * - 打字机效果优化
 * - 性能优化（React.memo）
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  Copy,
  Check,
  RotateCcw,
  MoreVertical,
  Trash2,
  Edit,
  Share2,
  Bot,
  User,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

// ============================================================================
// 类型定义
// ============================================================================

/** 消息角色类型 */
export type MessageRole = 'user' | 'assistant' | 'system';

/** 消息接口 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp?: number;
}

/** 消息气泡属性 */
export interface MessageBubbleProps {
  message: Message;
  /** 是否正在加载（显示打字机效果） */
  isStreaming?: boolean;
  /** 是否显示操作菜单 */
  showActions?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 复制回调 */
  onCopy?: (content: string) => void;
  /** 重新生成回调 */
  onRegenerate?: () => void;
  /** 删除回调 */
  onDelete?: () => void;
  /** 编辑回调 */
  onEdit?: () => void;
}

// ============================================================================
// 常量定义
// ============================================================================

/** 角色标签 */
const ROLE_LABELS: Record<MessageRole, string> = {
  user: '你',
  assistant: 'AI',
  system: '系统',
};

/** 角色颜色配置 */
const ROLE_CONFIG: Record<MessageRole, {
  avatarBg: string;
  avatarIcon: React.ReactNode;
  bubbleBg: string;
  bubbleText: string;
  labelColor: string;
}> = {
  user: {
    avatarBg: 'bg-blue-500',
    avatarIcon: <User className="w-4 h-4" />,
    bubbleBg: 'bg-blue-500 text-white rounded-br-sm',
    bubbleText: 'text-white',
    labelColor: 'text-blue-200',
  },
  assistant: {
    avatarBg: 'bg-gradient-to-br from-purple-500 to-blue-500',
    avatarIcon: <Bot className="w-4 h-4" />,
    bubbleBg: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm',
    bubbleText: 'text-gray-800 dark:text-gray-100',
    labelColor: 'text-gray-500 dark:text-gray-400',
  },
  system: {
    avatarBg: 'bg-amber-500',
    avatarIcon: <AlertCircle className="w-4 h-4" />,
    bubbleBg: 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-200',
    bubbleText: 'text-amber-900 dark:text-amber-200',
    labelColor: 'text-amber-600 dark:text-amber-400',
  },
};

// ============================================================================
// 工具函数
// ============================================================================

/** 复制到剪贴板 */
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
};

/** 格式化时间 */
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================================================
// 子组件：操作菜单
// ============================================================================

interface ActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

interface ActionMenuProps {
  message: Message;
  isUser: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const ActionMenu = React.memo(function ActionMenu({
  message,
  isUser,
  onCopy,
  onRegenerate,
  onDelete,
  onEdit,
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 操作项配置
  const actions: ActionItem[] = useMemo(() => {
    const items: ActionItem[] = [
      {
        id: 'copy',
        label: '复制内容',
        icon: <Copy className="w-4 h-4" />,
        onClick: onCopy,
      },
      {
        id: 'share',
        label: '分享',
        icon: <Share2 className="w-4 h-4" />,
        onClick: () => copyToClipboard(message.content),
      },
    ];

    // 用户消息支持编辑
    if (isUser) {
      items.push({
        id: 'edit',
        label: '编辑',
        icon: <Edit className="w-4 h-4" />,
        onClick: onEdit,
      });
    }

    // 助手消息支持重新生成
    if (!isUser) {
      items.push({
        id: 'regenerate',
        label: '重新生成',
        icon: <RotateCcw className="w-4 h-4" />,
        onClick: onRegenerate,
      });
    }

    // 所有消息支持删除
    items.push({
      id: 'delete',
      label: '删除',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: onDelete,
      destructive: true,
    });

    return items;
  }, [message.content, isUser, onCopy, onRegenerate, onDelete, onEdit]);

  return (
    <div className="relative" ref={menuRef}>
      {/* 触发按钮 */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'p-1.5 rounded-lg',
          'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          'transition-all duration-150',
          'opacity-0 group-hover:opacity-100',
          'focus:opacity-100'
        )}
        title="更多操作"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div
          className={clsx(
            'absolute top-full right-0 mt-1',
            'bg-white dark:bg-gray-800',
            'border border-gray-200 dark:border-gray-600',
            'rounded-lg shadow-lg',
            'py-1 min-w-[140px]',
            'z-50'
          )}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2',
                'text-sm text-left',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'transition-colors duration-150',
                action.destructive
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-700 dark:text-gray-200'
              )}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// 子组件：复制成功提示
// ============================================================================

interface CopySuccessProps {
  show: boolean;
}

const CopySuccess = React.memo(function CopySuccess({ show }: CopySuccessProps) {
  return (
    <div
      className={clsx(
        'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'flex items-center gap-1.5 px-2 py-1 rounded-md',
        'bg-green-500 text-white text-xs',
        'transition-all duration-200',
        show ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      )}
    >
      <Check className="w-3 h-3" />
      <span>已复制</span>
    </div>
  );
});

// ============================================================================
// 子组件：系统消息
// ============================================================================

interface SystemMessageProps {
  message: Message;
}

const SystemMessage = React.memo(function SystemMessage({ message }: SystemMessageProps) {
  return (
    <div className="flex justify-center py-2">
      <div
        className={clsx(
          'flex items-center gap-2 px-4 py-1.5 rounded-full text-sm',
          'bg-amber-100 dark:bg-amber-900/30',
          'text-amber-700 dark:text-amber-300',
          'border border-amber-200 dark:border-amber-700/50'
        )}
      >
        <AlertCircle className="w-3.5 h-3.5" />
        <span>{message.content}</span>
      </div>
    </div>
  );
});

// ============================================================================
// 主组件
// ============================================================================

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isStreaming = false,
  showActions = true,
  className,
  onCopy,
  onRegenerate,
  onDelete,
  onEdit,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const config = ROLE_CONFIG[message.role];
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // 复制处理
  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(message.content);
    if (success) {
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      onCopy?.(message.content);
    }
  }, [message.content, onCopy]);

  // 重新生成处理
  const handleRegenerate = useCallback(() => {
    onRegenerate?.();
  }, [onRegenerate]);

  // 删除处理
  const handleDelete = useCallback(() => {
    onDelete?.();
  }, [onDelete]);

  // 编辑处理
  const handleEdit = useCallback(() => {
    onEdit?.();
  }, [onEdit]);

  // 过滤系统消息
  if (isSystem) {
    return <SystemMessage message={message} />;
  }

  return (
    <div
      className={clsx(
        'flex gap-3 group',
        isUser ? 'flex-row-reverse' : 'flex-row',
        className
      )}
    >
      {/* 头像 */}
      <div
        className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-full',
          'flex items-center justify-center',
          'text-white',
          config.avatarBg
        )}
      >
        {config.avatarIcon}
      </div>

      {/* 消息内容 */}
      <div
        className={clsx(
          'flex flex-col max-w-[75%]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* 角色标签和时间 */}
        <div className="flex items-center gap-2 mb-1">
          <span className={clsx('text-xs', config.labelColor)}>
            {ROLE_LABELS[message.role]}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatTime(new Date())}
          </span>
        </div>

        {/* 消息气泡 */}
        <div
          className={clsx(
            'relative px-4 py-2.5 rounded-2xl shadow-sm',
            'transition-all duration-200',
            config.bubbleBg
          )}
        >
          {/* 复制成功提示 */}
          <CopySuccess show={copied} />

          {/* 内容 */}
          <div className={clsx(config.bubbleText)}>
            {isUser ? (
              // 用户消息：纯文本
              <p className="whitespace-pre-wrap leading-relaxed">
                {message.content}
              </p>
            ) : (
              // AI消息：Markdown渲染
              <MarkdownRenderer
                content={message.content}
                typewriter={isStreaming}
                typewriterSpeed={15}
              />
            )}
          </div>
        </div>

        {/* 消息元数据 */}
        <div className="flex items-center gap-2 mt-1">
          {/* 令牌估算 */}
          {message.role === 'assistant' && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {Math.ceil(message.content.length / 4)} tokens
            </span>
          )}

          {/* 操作菜单 */}
          {showActions && (
            <ActionMenu
              message={message}
              isUser={isUser}
              onCopy={handleCopy}
              onRegenerate={handleRegenerate}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          )}
        </div>

        {/* 流式提示 */}
        {isStreaming && (
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 dark:text-gray-500">
            <Sparkles className="w-3 h-3 animate-pulse" />
            <span>正在生成...</span>
          </div>
        )}
      </div>
    </div>
  );
});

// 导出已在类型定义部分完成
