import ReactMarkdown from 'react-markdown';
import { clsx } from 'clsx';
import { CheckCircle, Bot, User } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const roleLabels = {
    user: '你',
    assistant: 'AI',
    system: '系统',
  };

  const roleColors = {
    user: 'bg-blue-500 text-white',
    assistant: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
    system: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  };

  const bubbleColors = {
    user: 'bg-blue-500 text-white rounded-br-sm',
    assistant: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-bl-sm',
    system: 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border border-amber-200 dark:border-amber-700',
  };

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <div className={clsx(
          'flex items-center gap-2 px-4 py-1.5 rounded-full text-sm',
          roleColors.system
        )}>
          <CheckCircle className="w-3.5 h-3.5" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(
      'flex gap-3',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      {/* Avatar */}
      <div className={clsx(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        isUser ? 'bg-blue-500' : 'bg-gray-400 dark:bg-gray-600'
      )}>
        <span className="text-white">
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </span>
      </div>

      {/* Message bubble */}
      <div className={clsx(
        'flex flex-col max-w-[75%]',
        isUser ? 'items-end' : 'items-start'
      )}>
        {/* Role label */}
        <span className={clsx(
          'text-xs px-2 mb-1',
          isUser ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
        )}>
          {roleLabels[message.role]}
        </span>

        {/* Content */}
        <div className={clsx(
          'px-4 py-2.5 rounded-2xl shadow-sm',
          bubbleColors[message.role as keyof typeof bubbleColors]
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code(props) {
                    const { children, className, node, ...rest } = props;
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match && !className;

                    if (isInline) {
                      return (
                        <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-sm font-mono" {...rest}>
                          {children}
                        </code>
                      );
                    }

                    return (
                      <div className="rounded-lg overflow-hidden my-3">
                        <div className="bg-gray-800 px-3 py-1.5 text-xs text-gray-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          {match?.[1] || 'code'}
                        </div>
                        <pre className="bg-gray-900 p-3 overflow-x-auto">
                          <code className={className} {...rest}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    );
                  },
                  pre(props) {
                    return <>{props.children}</>;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
