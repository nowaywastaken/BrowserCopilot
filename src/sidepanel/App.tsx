import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { Message } from './components/MessageBubble';
import { OpenRouterClient, ChatMessage } from '../lib/openai';
import { LocalMemoryManager } from '../lib/memory';
import {
  Settings,
  Key,
  Moon,
  Sun,
  Trash2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

// Declare chrome API for extension context
declare const chrome: {
  storage: {
    local: {
      get: (keys: string | string[]) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
    };
  };
};

// Storage keys
const STORAGE_KEYS = {
  API_KEY: 'openrouter_api_key',
  MESSAGES: 'chat_messages',
  DARK_MODE: 'dark_mode',
};

// System prompt
const SYSTEM_PROMPT = `你是 Browser Pal，一个智能浏览器助手。你的任务是：
1. 帮助用户浏览和理解当前网页内容
2. 回答用户的问题，提供有用的建议
3. 记住用户的偏好和重要信息
4. 用简洁清晰的方式回复

当前时间: ${new Date().toLocaleString('zh-CN')}`;

// Generate unique ID
const generateId = (): string => {
  return crypto.randomUUID();
};

function App() {
  // State
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);

  // Refs
  const memoryManagerRef = useRef<LocalMemoryManager | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize dark mode
  useEffect(() => {
    const savedDarkMode = localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Load API key from storage
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        const storedKey = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
        if (storedKey[STORAGE_KEYS.API_KEY]) {
          const key = storedKey[STORAGE_KEYS.API_KEY] as string;
          setApiKey(key);
          setApiKeyInput(key);
        }
      } catch (err) {
        console.error('Failed to load API key:', err);
      }
    };
    loadApiKey();
  }, []);

  // Load messages from storage
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const storedMessages = await chrome.storage.local.get(STORAGE_KEYS.MESSAGES);
        if (storedMessages[STORAGE_KEYS.MESSAGES]) {
          const msgs = storedMessages[STORAGE_KEYS.MESSAGES] as Message[];
          setMessages(msgs);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };
    loadMessages();
  }, []);

  // Initialize memory system
  useEffect(() => {
    const initMemory = async () => {
      if (!apiKey) return;

      try {
        memoryManagerRef.current = new LocalMemoryManager({
          apiKey,
          similarityK: 4,
          maxMemories: 100,
        });

        const success = await memoryManagerRef.current.init();
        if (success) {
          const count = await memoryManagerRef.current.getMemoryCount();
          setMemoryCount(count);
          console.log('Memory system initialized with', count, 'memories');
        }
      } catch (err) {
        console.error('Failed to initialize memory system:', err);
      }
    };

    initMemory();
  }, [apiKey]);

  // Save messages to storage
  const saveMessages = useCallback(async (msgs: Message[]) => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.MESSAGES]: msgs });
    } catch (err) {
      console.error('Failed to save messages:', err);
    }
  }, []);

  // Save API key
  const saveApiKey = async (key: string) => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: key });
      setApiKey(key);
    } catch (err) {
      console.error('Failed to save API key:', err);
    }
  };

  // Handle send message
  const handleSend = useCallback(async (content: string) => {
    if (!apiKey) {
      setError('请先设置 OpenRouter API Key');
      setShowSettings(true);
      return;
    }

    if (!content.trim()) return;

    setLoading(true);
    setError(null);

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
    };

    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      saveMessages(newMessages);
      return newMessages;
    });

    // Prepare messages for API
    const apiMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add recent messages (last 10)
    const recentMessages = messages.slice(-10);
    for (const msg of recentMessages) {
      apiMessages.push({ role: msg.role, content: msg.content });
    }

    // Retrieve relevant memories
    let relevantContext = '';
    if (memoryManagerRef.current?.isInitialized()) {
      try {
        relevantContext = await memoryManagerRef.current.searchRelevantContext(content.trim(), 3);
        if (relevantContext) {
          apiMessages.push({
            role: 'system',
            content: `以下是与当前对话相关的记忆：\n\n${relevantContext}`
          });
        }
      } catch (err) {
        console.error('Failed to retrieve memories:', err);
      }
    }

    // Add user message
    apiMessages.push({ role: 'user', content: content.trim() });

    // Create abort controller for stopping
    abortControllerRef.current = new AbortController();

    // Create client and stream
    const client = new OpenRouterClient({ apiKey });

    try {
      const assistantMessageId = generateId();
      let assistantContent = '';

      // Create empty assistant message
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
      };

      setMessages(prev => {
        const newMessages = [...prev, assistantMessage];
        saveMessages(newMessages);
        return newMessages;
      });

      // Stream response
      for await (const chunk of client.streamChat(apiMessages)) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          assistantContent += delta;
          setMessages(prev => {
            const newMessages = prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: assistantContent }
                : msg
            );
            saveMessages(newMessages);
            return newMessages;
          });
        }
      }

      // Save assistant message to memory
      if (assistantContent.trim() && memoryManagerRef.current?.isInitialized()) {
        try {
          await memoryManagerRef.current.addMemory(
            `用户: ${content.trim()}\n助手: ${assistantContent.trim()}`,
            { sessionId: 'current' }
          );
          const count = await memoryManagerRef.current.getMemoryCount();
          setMemoryCount(count);
        } catch (err) {
          console.error('Failed to save memory:', err);
        }
      }

    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = err instanceof Error ? err.message : '发生未知错误';
      setError(errorMessage);

      // Add error message
      const errorSystemMessage: Message = {
        id: generateId(),
        role: 'system',
        content: `错误: ${errorMessage}`,
      };
      setMessages(prev => {
        const newMessages = [...prev, errorSystemMessage];
        saveMessages(newMessages);
        return newMessages;
      });
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [apiKey, messages, saveMessages]);

  // Handle stop
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setLoading(false);
  }, []);

  // Save API key handler
  const handleSaveApiKey = async () => {
    if (apiKeyInput.trim()) {
      await saveApiKey(apiKeyInput.trim());
      setShowSettings(false);

      // Reinitialize memory system with new API key
      if (memoryManagerRef.current) {
        memoryManagerRef.current = new LocalMemoryManager({
          apiKey: apiKeyInput.trim(),
          similarityK: 4,
          maxMemories: 100,
        });
        await memoryManagerRef.current.init();
      }
    }
  };

  // Clear all data
  const handleClearData = async () => {
    if (confirm('确定要清除所有聊天记录和记忆吗？此操作不可恢复。')) {
      setMessages([]);
      saveMessages([]);
      await chrome.storage.local.remove(STORAGE_KEYS.MESSAGES);

      if (memoryManagerRef.current) {
        await memoryManagerRef.current.clear();
        setMemoryCount(0);
      }
    }
  };

  // Clear API key
  const handleClearApiKey = async () => {
    await chrome.storage.local.remove(STORAGE_KEYS.API_KEY);
    setApiKey('');
    setApiKeyInput('');
    memoryManagerRef.current = null;
    setMemoryCount(0);
  };

  return (
    <div className={clsx(
      'min-h-screen transition-colors duration-200',
      darkMode ? 'dark bg-gray-900' : 'bg-gray-50'
    )}>
      {/* Main content */}
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">BP</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
              Browser Pal
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Memory count badge */}
            <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
              {memoryCount} 条记忆
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Settings button */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded"
            >
              ×
            </button>
          </div>
        )}

        {/* Chat window */}
        <div className="flex-1 overflow-hidden">
          <ChatWindow
            messages={messages}
            onSend={handleSend}
            onStop={handleStop}
            loading={loading}
            disabled={!apiKey}
          />
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                设置
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ×
              </button>
            </div>

            {/* Modal content */}
            <div className="p-4 space-y-4">
              {/* API Key section */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Key className="w-4 h-4" />
                  OpenRouter API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-..."
                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput.trim()}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    保存
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  从 <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">openrouter.ai</a> 获取 API Key
                </p>
              </div>

              {/* API Key status */}
              <div className="flex items-center gap-2 text-sm">
                {apiKey ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">API Key 已设置</span>
                    <button
                      onClick={handleClearApiKey}
                      className="ml-auto text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      清除
                    </button>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400">请设置 API Key 以开始对话</span>
                  </>
                )}
              </div>

              {/* Divider */}
              <hr className="border-gray-200 dark:border-gray-700" />

              {/* Memory section */}
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    记忆存储
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {memoryCount} 条记忆
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  记忆系统使用向量检索来存储和检索对话历史
                </p>
              </div>

              {/* Data management */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleClearData}
                  className="w-full px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  清除所有数据
                </button>
              </div>

              {/* Model info */}
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  <strong>当前模型:</strong> anthropic/claude-3-opus-20240229
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  使用 OpenRouter 作为 API 聚合层，支持多种 AI 模型
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
