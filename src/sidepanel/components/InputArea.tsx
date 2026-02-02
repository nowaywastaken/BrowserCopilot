import React, { useState, useRef, useEffect } from 'react';
import { Send, StopCircle, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

interface InputAreaProps {
  onSend: (content: string) => void;
  onStop: () => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
}

export function InputArea({
  onSend,
  onStop,
  disabled = false,
  loading = false,
  placeholder = '输入消息...（Enter 发送，Shift+Enter 换行）'
}: InputAreaProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled && !loading) {
      onSend(input.trim());
      setInput('');
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const isEmpty = input.trim().length === 0;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Quick actions */}
      <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Sparkles className="w-3.5 h-3.5" />
        <span>按 Enter 发送，Shift+Enter 换行</span>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="px-4 pb-4">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={clsx(
              'w-full px-4 py-3 pr-24 bg-gray-100 dark:bg-gray-700',
              'border-0 rounded-xl resize-none',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'text-gray-900 dark:text-gray-100',
              'min-h-[44px] max-h-[150px]',
              'transition-all duration-200'
            )}
          />

          {/* Action buttons */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {loading ? (
              <button
                type="button"
                onClick={onStop}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5',
                  'bg-red-500 hover:bg-red-600 text-white',
                  'rounded-lg transition-colors',
                  'text-sm font-medium'
                )}
              >
                <StopCircle className="w-4 h-4" />
                <span>停止</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={disabled || isEmpty}
                className={clsx(
                  'flex items-center justify-center w-9 h-9',
                  'rounded-lg transition-all duration-200',
                  isEmpty || disabled
                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm'
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Character count */}
        {input.length > 0 && (
          <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
            {input.length} 字符
          </div>
        )}
      </form>
    </div>
  );
}
