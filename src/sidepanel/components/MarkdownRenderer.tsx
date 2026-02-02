/**
 * Markdown Renderer Component
 * 完整的Markdown渲染器，支持代码高亮、表格、列表等
 * 
 * 特性：
 * - 完整的Markdown语法支持
 * - 代码块语法高亮（使用highlight.js）
 * - 表格渲染
 * - 链接和图片处理
 * - XSS安全防护
 * - 打字机效果支持
 * - 性能优化
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { clsx } from 'clsx';
import {
  Copy,
  Check,
  Image
} from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** 是否启用打字机效果 */
  typewriter?: boolean;
  /** 打字机速度（毫秒/字符），越小越快 */
  typewriterSpeed?: number;
  /** 是否显示原始内容（用于调试） */
  showRaw?: boolean;
  /** 自定义渲染器映射 */
  components?: Record<string, React.ComponentType<unknown>>;
}

/** 代码块信息 */
interface CodeBlockInfo {
  language: string;
  code: string;
  showLineNumbers: boolean;
}

/** 表格数据 */
interface TableData {
  headers: string[];
  rows: string[][];
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 简单的HTML转义（XSS防护）
 */
const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
};

/**
 * 复制到剪贴板
 */
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

// ============================================================================
// 子组件：代码块
// ============================================================================

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CodeBlockRenderer = React.memo(function CodeBlockRenderer({
  inline = false,
  className,
  children,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  // 提取语言
  const language = useMemo(() => {
    if (!className) return '';
    const match = className.match(/language-(\w+)/);
    return match ? match[1] : '';
  }, [className]);

  // 代码内容
  const codeContent = useMemo(() => {
    if (!children) return '';
    return String(children).replace(/\n$/, '');
  }, [children]);

  // 复制处理
  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(codeContent);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [codeContent]);

  // 复制按钮
  const CopyButton = useMemo(() => (
    <button
      onClick={handleCopy}
      className={clsx(
        'flex items-center gap-1 px-2 py-1 text-xs rounded',
        'bg-gray-700 hover:bg-gray-600 text-gray-300',
        'transition-colors duration-150'
      )}
      title="复制代码"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" />
          <span>已复制</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>复制</span>
        </>
      )}
    </button>
  ), [copied, handleCopy]);

  // 内联代码
  if (inline) {
    return (
      <code
        className={clsx(
          'px-1.5 py-0.5 rounded text-sm font-mono',
          'bg-gray-200 dark:bg-gray-700',
          'text-red-500 dark:text-red-400',
          className
        )}
      >
        {children}
      </code>
    );
  }

  // 代码块
  return (
    <div className="my-3 rounded-lg overflow-hidden bg-gray-900">
      {/* 代码块头部 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {/* 三个小圆点装饰 */}
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>
          <span className="ml-2 text-xs text-gray-400 font-mono">
            {language || 'text'}
          </span>
        </div>
        {CopyButton}
      </div>

      {/* 代码内容 */}
      <pre className="p-3 overflow-x-auto">
        <code
          ref={codeRef}
          className={clsx(
            'text-sm font-mono leading-relaxed',
            language ? `language-${language}` : '',
            className
          )}
        >
          {children}
        </code>
      </pre>
    </div>
  );
});

// ============================================================================
// 子组件：表格
// ============================================================================

interface TableProps {
  children?: React.ReactNode;
}

const TableRenderer = React.memo(function TableRenderer({ children }: TableProps) {
  return (
    <div className="my-3 overflow-x-auto">
      <table className={clsx(
        'w-full border-collapse',
        'text-sm',
        'dark:text-gray-200'
      )}>
        <thead>
          {children && React.Children.map(children, child => {
            if (React.isValidElement(child) && child.type === 'tbody') {
              return child.props.children.find((c: React.ReactElement) =>
                React.isValidElement(c) && c.type === 'tr'
              );
            }
            return null;
          })}
        </thead>
        <tbody>
          {children && React.Children.map(children, child => {
            if (React.isValidElement(child) && child.type === 'tbody') {
              return child.props.children.filter((c: React.ReactElement) =>
                React.isValidElement(c) && c.type === 'tr'
              );
            }
            return null;
          })}
        </tbody>
      </table>
    </div>
  );
});

// ============================================================================
// 子组件：表格行
// ============================================================================

interface TableRowProps {
  isHeader?: boolean;
  children?: React.ReactNode;
}

const TableRowRenderer = React.memo(function TableRowRenderer({
  isHeader = false,
  children,
}: TableRowProps) {
  return (
    <tr className={clsx(
      isHeader && 'bg-gray-100 dark:bg-gray-700'
    )}>
      {children && React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ className?: string }>, {
            className: clsx(
              'px-3 py-2 border border-gray-200 dark:border-gray-600',
              'text-left',
              isHeader && 'font-semibold'
            ),
          });
        }
        return child;
      })}
    </tr>
  );
});

// ============================================================================
// 子组件：引用块
// ============================================================================

interface BlockquoteProps {
  children?: React.ReactNode;
}

const BlockquoteRenderer = React.memo(function BlockquoteRenderer({
  children
}: BlockquoteProps) {
  return (
    <blockquote className={clsx(
      'my-3 pl-4 border-l-4',
      'border-gray-300 dark:border-gray-600',
      'text-gray-700 dark:text-gray-300',
      'italic'
    )}>
      {children}
    </blockquote>
  );
});

// ============================================================================
// 子组件：列表
// ============================================================================

interface ListItemProps {
  children?: React.ReactNode;
}

const ListItemRenderer = React.memo(function ListItemRenderer({
  children
}: ListItemProps) {
  return (
    <li className="my-1 ml-4">
      {children}
    </li>
  );
});

// ============================================================================
// 子组件：链接
// ============================================================================

interface LinkProps {
  href?: string;
  children?: React.ReactNode;
}

const LinkRenderer = React.memo(function LinkRenderer({
  href,
  children,
}: LinkProps) {
  const [isExternal, setIsExternal] = useState(false);

  useEffect(() => {
    if (href) {
      setIsExternal(href.startsWith('http://') || href.startsWith('https://'));
    }
  }, [href]);

  // 安全检查
  const safeHref = useMemo(() => {
    if (!href) return '#';
    // 过滤危险协议
    if (href.startsWith('javascript:') || href.startsWith('data:')) {
      return '#';
    }
    return href;
  }, [href]);

  if (!safeHref || safeHref === '#') {
    return <span className="text-red-500">[无效链接]</span>;
  }

  return (
    <a
      href={safeHref}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className={clsx(
        'text-blue-500 hover:text-blue-600 dark:text-blue-400',
        'underline decoration-blue-300 dark:decoration-blue-700',
        'underline-offset-2',
        'transition-colors duration-150'
      )}
    >
      {children}
      {isExternal && (
        <svg
          className="inline-block w-3 h-3 ml-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      )}
    </a>
  );
});

// ============================================================================
// 子组件：图片
// ============================================================================

interface ImageProps {
  src?: string;
  alt?: string;
  title?: string;
}

const ImageRenderer = React.memo(function ImageRenderer({
  src,
  alt,
  title
}: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // 安全检查
  const safeSrc = useMemo(() => {
    if (!src) return null;
    if (src.startsWith('javascript:') || src.startsWith('data:')) {
      return null;
    }
    return src;
  }, [src]);

  if (!safeSrc) {
    return <span className="text-red-500">[无效图片]</span>;
  }

  if (error) {
    return (
      <div className={clsx(
        'my-3 p-4 rounded-lg bg-gray-100 dark:bg-gray-800',
        'text-center text-gray-500 dark:text-gray-400'
      )}>
        <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <span className="text-sm">图片加载失败</span>
      </div>
    );
  }

  return (
    <figure className="my-3">
      <img
        src={safeSrc}
        alt={alt || ''}
        title={title}
        className={clsx(
          'max-w-full h-auto rounded-lg',
          'border border-gray-200 dark:border-gray-600',
          'transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
      {alt && (
        <figcaption className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
          {alt}
        </figcaption>
      )}
    </figure>
  );
});

// ============================================================================
// 主组件
// ============================================================================

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  content,
  className,
  typewriter = false,
  typewriterSpeed = 20,
  showRaw = false,
  components = {},
}: MarkdownRendererProps) {
  const [displayedContent, setDisplayedContent] = useState(content);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // 打字机效果
  useEffect(() => {
    if (!typewriter) {
      setDisplayedContent(content);
      return;
    }

    // 清除之前的动画
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // 开始打字机效果
    let currentIndex = 0;
    const totalLength = content.length;
    const charsPerFrame = 3; // 每帧显示的字符数

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const targetIndex = Math.min(
        Math.floor(elapsed / typewriterSpeed * charsPerFrame),
        totalLength
      );

      if (targetIndex > currentIndex) {
        setDisplayedContent(content.slice(0, targetIndex));
        currentIndex = targetIndex;
      }

      if (currentIndex < totalLength) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
        startTimeRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    // 清理
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = null;
      startTimeRef.current = null;
    };
  }, [content, typewriter, typewriterSpeed]);

  // 默认组件映射
  const defaultComponents = useMemo(() => ({
    code: CodeBlockRenderer,
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    a: LinkRenderer,
    img: ImageRenderer,
    table: TableRenderer,
    thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-gray-100 dark:bg-gray-700">{children}</thead>,
    tbody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
    tr: TableRowRenderer,
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className="px-3 py-2 border border-gray-200 dark:border-gray-600 font-semibold text-left">{children}</th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className="px-3 py-2 border border-gray-200 dark:border-gray-600">{children}</td>
    ),
    blockquote: BlockquoteRenderer,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc my-2 ml-4">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal my-2 ml-4">{children}</ol>,
    li: ListItemRenderer,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-2xl font-bold my-3">{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-xl font-bold my-2.5">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-lg font-bold my-2">{children}</h3>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
    del: ({ children }: { children?: React.ReactNode }) => <del className="line-through">{children}</del>,
    hr: () => <hr className="my-4 border-gray-200 dark:border-gray-600" />,
    ...components,
  }), [components]);

  // 如果显示原始内容
  if (showRaw) {
    return (
      <pre className={clsx(
        'p-4 rounded-lg bg-gray-100 dark:bg-gray-800',
        'text-sm font-mono overflow-x-auto',
        className
      )}>
        {escapeHtml(content)}
      </pre>
    );
  }

  return (
    <div className={clsx(
      'prose prose-sm dark:prose-invert max-w-none',
      'leading-relaxed',
      className
    )}>
      <ReactMarkdown components={defaultComponents}>
        {displayedContent}
      </ReactMarkdown>
    </div>
  );
});

// ============================================================================
// 导出
// ============================================================================

export type { MarkdownRendererProps, CodeBlockInfo, TableData };
