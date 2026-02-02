import { useRef, useEffect, useState } from 'react';
import { MessageBubble, Message } from './MessageBubble';
import { InputArea } from './InputArea';
import { Bot, Sparkles, MessageSquare } from 'lucide-react';

interface ChatWindowProps {
  messages: Message[];
  onSend: (content: string) => void;
  onStop: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function ChatWindow({
  messages,
  onSend,
  onStop,
  loading = false,
  disabled = false
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAtBottom]);

  // Handle scroll to detect if user is at bottom
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const tolerance = 50;
      const atBottom = scrollHeight - scrollTop - clientHeight < tolerance;
      setIsAtBottom(atBottom);
    }
  };

  // Scroll to bottom button
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Filter out system messages for display (or handle them differently)
  const displayMessages = messages.filter(m => m.role !== 'system');
  const hasSystemMessages = messages.some(m => m.role === 'system');

  // Check if chat is empty
  const isEmpty = displayMessages.length === 0 && !hasSystemMessages;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            Browser Pal
          </h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Sparkles className="w-4 h-4" />
          <span>{messages.length} 条消息</span>
        </div>
      </div>

      {/* Messages container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">
              开始对话
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm">
              输入你的问题，我会基于网页内容和记忆来回答你。
              我会记住我们的对话内容，以便提供更好的服务。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => onSend('你好，请介绍一下自己')}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
              >
                你好，请介绍一下自己
              </button>
              <button
                onClick={() => onSend('帮我总结当前页面的内容')}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-lg text-sm transition-colors"
              >
                总结当前页面
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        {!isEmpty && (
          <>
            {/* System messages at the top */}
            {messages.filter(m => m.role === 'system').map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* User and assistant messages */}
            {displayMessages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm">AI 正在思考...</span>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && !isEmpty && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 w-10 h-10 bg-white dark:bg-gray-700 shadow-lg rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Input area */}
      <InputArea
        onSend={onSend}
        onStop={onStop}
        disabled={disabled}
        loading={loading}
      />
    </div>
  );
}
