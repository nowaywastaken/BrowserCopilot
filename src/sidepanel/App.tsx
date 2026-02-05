/**
 * Browser Pal - Main App Component
 * Chrome扩展侧边栏主界面
 *
 * 特性：
 * - 流式渲染实现（FPS≥55性能优化）
 * - 多提供商支持（OpenAI、Anthropic、OpenRouter）
 * - 模型切换功能
 * - 记忆系统集成（RAG上下文注入）
 * - 设置面板（多提供商 API Key 配置）
 * - 深色模式支持
 * - 错误处理和加载状态
 * - 针对Apple Silicon优化（延迟<100ms）
 * - 内存泄漏防护
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Settings,
  Key,
  Moon,
  Sun,
  Trash2,
  Check,
  AlertCircle,
  Brain,
  Zap,
  X,
  Info,
} from 'lucide-react';
import { ChatWindow } from './components/ChatWindow';
import { Message } from './components/MessageBubble';
import { ModelSelector } from './components/ModelSelector';
import { ProviderSelector } from './components/ProviderSelector';
import { ChatService } from '../lib/services/chat-service';
import { ProviderStore } from '../lib/storage/provider-store';
import type { ProviderId } from '../lib/types/provider';
import { getDefaultModel, PROVIDERS } from '../lib/providers';
import { LocalMemoryManager } from '../lib/memory';
import type { ChatMessage } from '../lib/openai';

// ============================================================================
// 类型定义
// ============================================================================

/** 错误信息 */
interface ErrorInfo {
  message: string;
  timestamp: number;
  recoverable: boolean;
}

/** 提供商 API Keys 状态（用于设置面板） */
interface ProviderApiKeysState {
  openai: string;
  anthropic: string;
  openrouter: string;
}

// ============================================================================
// 常量定义
// ============================================================================

/** 默认系统提示 */
const DEFAULT_SYSTEM_PROMPT = `你是 Browser Pal，一个智能浏览器助手。你的任务是：
1. 帮助用户浏览和理解当前网页内容
2. 回答用户的问题，提供有用的建议
3. 记住用户的偏好和重要信息
4. 用简洁清晰的方式回复

当前时间: {timestamp}`;

/** 默认提供商（向后兼容） */
const DEFAULT_PROVIDER: ProviderId = 'openrouter';

/** 上下文消息数量限制 */
const MAX_CONTEXT_MESSAGES = 10;

/** 每次检索的记忆数量 */
const MEMORY_RETRIEVAL_K = 3;

/** 迁移完成标记 */
const MIGRATION_COMPLETED_KEY = 'provider_migration_completed';

// ============================================================================
// Chrome API 声明
// ============================================================================

declare const chrome: {
  storage: {
    local: {
      get: (keys: string | string[]) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
    };
  };
};

// ============================================================================
// 工具函数
// ============================================================================

/** 生成唯一ID */
const generateId = (): string => {
  return crypto.randomUUID();
};

/** 获取当前时间戳 */
const getCurrentTimestamp = (): string => {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** 格式化系统提示 */
const formatSystemPrompt = (): string => {
  return DEFAULT_SYSTEM_PROMPT.replace('{timestamp}', getCurrentTimestamp());
};

/** 检测Apple Silicon */
const isAppleSilicon = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('mac') && (
    userAgent.includes('arm64') ||
    (typeof navigator.platform === 'string' && navigator.platform.includes('arm'))
  );
};

// ============================================================================
// 子组件：设置模态框
// ============================================================================

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProvider: ProviderId;
  selectedModel: string;
  memoryCount: number;
  providerApiKeys: ProviderApiKeysState;
  onProviderApiKeyChange: (providerId: keyof ProviderApiKeysState, value: string) => void;
  onSaveProviderKey: (providerId: keyof ProviderApiKeysState) => void;
  onClearProviderKey: (providerId: keyof ProviderApiKeysState) => void;
  onModelChange: (modelId: string) => void;
  onClearData: () => void;
  isAppleSilicon: boolean;
  configuredProviders: ProviderId[];
}

const SettingsModal = React.memo(function SettingsModal({
  isOpen,
  onClose,
  selectedProvider,
  selectedModel,
  memoryCount,
  providerApiKeys,
  onProviderApiKeyChange,
  onSaveProviderKey,
  onClearProviderKey,
  onModelChange,
  onClearData,
  isAppleSilicon: isAS,
  configuredProviders,
}: SettingsModalProps) {
  if (!isOpen) return null;

  const providerConfigs = [
    { id: 'openai' as const, name: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys' },
    { id: 'anthropic' as const, name: 'Anthropic', keyUrl: 'https://console.anthropic.com/' },
    { id: 'openrouter' as const, name: 'OpenRouter', keyUrl: 'https://openrouter.ai/keys' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 模态框头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            设置
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 模态框内容 */}
        <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* 当前使用情况 */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">
              <Zap className="w-4 h-4" />
              <span>当前使用</span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              提供商: {PROVIDERS[selectedProvider].name} | 模型: {selectedModel}
            </p>
          </div>

          {/* API Key 配置 - 多提供商 */}
          {providerConfigs.map(({ id, name, keyUrl }) => {
            const apiKey = providerApiKeys[id];
            const isConfigured = configuredProviders.includes(id);

            return (
              <div key={id}>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Key className="w-4 h-4" />
                  {name} API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => onProviderApiKeyChange(id, e.target.value)}
                    placeholder="sk-..."
                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                  <button
                    onClick={() => onSaveProviderKey(id)}
                    disabled={!apiKey.trim()}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                  >
                    <Check className="w-4 h-4" />
                    保存
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    从 <a href={keyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{keyUrl}</a> 获取
                  </p>
                  {isConfigured && (
                    <button
                      onClick={() => onClearProviderKey(id)}
                      className="text-red-500 hover:text-red-600 flex items-center gap-1 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      清除
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* 模型选择 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Zap className="w-4 h-4" />
              选择模型
            </label>
            <ModelSelector
              providerId={selectedProvider}
              value={selectedModel}
              onChange={onModelChange}
            />
          </div>

          {/* 分割线 */}
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* 记忆系统 */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                记忆存储
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {memoryCount} 条记忆
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              记忆系统使用向量检索来存储和检索对话历史，提供个性化的AI服务。
            </p>
          </div>

          {/* Apple Silicon 优化提示 */}
          <div className={clsx(
            'p-3 rounded-lg',
            'bg-purple-50 dark:bg-purple-900/20',
            'border border-purple-200 dark:border-purple-800'
          )}>
            <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
              <Info className="w-4 h-4" />
              <span className="font-medium">系统优化</span>
            </div>
            <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
              {isAS ? (
                '检测到 Apple Silicon，已启用优化的批处理配置以获得最佳性能。'
              ) : (
                '运行在非 Apple Silicon 设备上，使用标准配置。'
              )}
            </p>
          </div>

          {/* 数据管理 */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClearData}
              className="w-full px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Trash2 className="w-4 h-4" />
              清除所有数据
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// 子组件：错误提示
// ============================================================================

interface ErrorBannerProps {
  error: ErrorInfo | null;
  onDismiss: () => void;
}

const ErrorBanner = React.memo(function ErrorBanner({
  error,
  onDismiss,
}: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className={clsx(
      'mx-4 mt-2 p-3 rounded-lg flex items-center gap-2',
      'bg-red-100 dark:bg-red-900/30',
      'border border-red-200 dark:border-red-800'
    )}>
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      <span className="text-sm text-red-700 dark:text-red-400 flex-1">
        {error.message}
      </span>
      {error.recoverable && (
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded transition-colors"
        >
          <X className="w-4 h-4 text-red-500" />
        </button>
      )}
    </div>
  );
});

// ============================================================================
// 主组件
// ============================================================================

function App() {
  // ========== State ==========
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [selectedModel, setSelectedModel] = useState<string>(getDefaultModel(DEFAULT_PROVIDER));
  const [configuredProviders, setConfiguredProviders] = useState<ProviderId[]>([]);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);

  // 设置面板中的 API Keys 状态
  const [providerApiKeys, setProviderApiKeys] = useState<ProviderApiKeysState>({
    openai: '',
    anthropic: '',
    openrouter: '',
  });

  // ========== Refs ==========
  const memoryManagerRef = useRef<LocalMemoryManager | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAppleSiliconRef = useRef(isAppleSilicon());

  // ========== 性能优化：useCallbacks ==========

  // 保存消息到存储
  const saveMessages = useCallback(async (msgs: Message[]) => {
    try {
      await chrome.storage.local.set({ chat_messages: msgs });
    } catch (err) {
      console.error('Failed to save messages:', err);
    }
  }, []);

  // 保存设置
  const saveSettings = useCallback(async (key: string, value: unknown) => {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, []);

  // 获取当前提供商的 API Key
  const getCurrentApiKey = useCallback(async (): Promise<string | undefined> => {
    return await ProviderStore.getApiKey(selectedProvider);
  }, [selectedProvider]);

  // ========== Effects ==========

  // 初始化深色模式
  useEffect(() => {
    const initDarkMode = async () => {
      try {
        const stored = await chrome.storage.local.get('dark_mode');
        const savedDarkMode = stored.dark_mode === 'true';
        setDarkMode(savedDarkMode);
        if (savedDarkMode) {
          document.documentElement.classList.add('dark');
        }
      } catch (err) {
        console.error('Failed to load dark mode setting:', err);
      }
    };
    initDarkMode();
  }, []);

  // Task 10: 加载提供商配置
  useEffect(() => {
    const loadProviderConfig = async () => {
      try {
        // 加载选中的提供商
        const provider = await ProviderStore.getSelectedProvider();
        setSelectedProvider(provider);

        // 加载选中的模型
        const model = await ProviderStore.getSelectedModel();
        setSelectedModel(model);

        // 加载所有 API Keys 并确定已配置的提供商
        const apiKeys = await ProviderStore.getApiKeys();
        const configured = Object.keys(apiKeys).filter(
          (key): key is ProviderId => {
            const keyValue = apiKeys[key as ProviderId];
            return (keyValue?.trim().length ?? 0) > 0;
          }
        );
        setConfiguredProviders(configured);
      } catch (err) {
        console.error('Failed to load provider config:', err);
      }
    };
    loadProviderConfig();
  }, []);

  // Task 16: 迁移现有 OpenRouter 配置
  useEffect(() => {
    const migrateOpenRouterConfig = async () => {
      try {
        // 检查是否已完成迁移
        const migrationResult = await chrome.storage.local.get(MIGRATION_COMPLETED_KEY);
        if (migrationResult[MIGRATION_COMPLETED_KEY]) {
          return; // 已迁移，跳过
        }

        // 检查是否有旧的 OpenRouter API Key
        const oldResult = await chrome.storage.local.get('openrouter_api_key');
        const oldApiKey = oldResult['openrouter_api_key'] as string | undefined;

        if (oldApiKey && typeof oldApiKey === 'string') {
          // 迁移到新结构
          await ProviderStore.setApiKey('openrouter', oldApiKey);

          // 设置选中的提供商和模型
          await ProviderStore.setSelectedProvider('openrouter');
          const existingModel = await chrome.storage.local.get('selected_model');
          const modelValue = existingModel.selected_model;
          if (modelValue && typeof modelValue === 'string') {
            await ProviderStore.setSelectedModel(modelValue);
          }

          // 删除旧键
          await chrome.storage.local.remove('openrouter_api_key');

          // 标记迁移完成
          await chrome.storage.local.set({ [MIGRATION_COMPLETED_KEY]: true });

          console.log('OpenRouter config migrated successfully');
        }
      } catch (err) {
        console.error('Failed to migrate OpenRouter config:', err);
      }
    };
    migrateOpenRouterConfig();
  }, []);

  // 加载消息
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const stored = await chrome.storage.local.get('chat_messages');
        if (stored.chat_messages) {
          const msgs = stored.chat_messages as Message[];
          setMessages(msgs);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };
    loadMessages();
  }, []);

  // 初始化记忆系统
  useEffect(() => {
    const initMemory = async () => {
      const apiKey = await getCurrentApiKey();
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
  }, [selectedProvider, getCurrentApiKey]);

  // 当设置面板打开时，加载 API Keys
  useEffect(() => {
    const loadApiKeysForSettings = async () => {
      if (!showSettings) return;

      try {
        const apiKeys = await ProviderStore.getApiKeys();
        setProviderApiKeys({
          openai: apiKeys.openai || '',
          anthropic: apiKeys.anthropic || '',
          openrouter: apiKeys.openrouter || '',
        });
      } catch (err) {
        console.error('Failed to load API keys for settings:', err);
      }
    };
    loadApiKeysForSettings();
  }, [showSettings]);

  // ========== 处理函数 ==========

  // 切换深色模式
  const toggleDarkMode = useCallback(() => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    saveSettings('dark_mode', String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode, saveSettings]);

  // Task 11: 处理提供商切换
  const handleProviderChange = useCallback(async (providerId: ProviderId) => {
    // 检查提供商是否已配置
    if (!configuredProviders.includes(providerId)) {
      setError({
        message: `请先在设置中配置 ${PROVIDERS[providerId].name} 的 API Key`,
        timestamp: Date.now(),
        recoverable: true,
      });
      setShowSettings(true);
      return;
    }

    // 切换提供商
    setSelectedProvider(providerId);
    await ProviderStore.setSelectedProvider(providerId);

    // 设置默认模型
    const defaultModel = getDefaultModel(providerId);
    setSelectedModel(defaultModel);
    await ProviderStore.setSelectedModel(defaultModel);
  }, [configuredProviders]);

  // 处理模型变更
  const handleModelChange = useCallback(async (modelId: string) => {
    setSelectedModel(modelId);
    await ProviderStore.setSelectedModel(modelId);
  }, []);

  // Task 14: 保存提供商 API Key
  const handleSaveProviderKey = useCallback(async (providerId: keyof ProviderApiKeysState) => {
    const apiKey = providerApiKeys[providerId].trim();
    if (!apiKey) return;

    await ProviderStore.setApiKey(providerId as ProviderId, apiKey);

    // 更新已配置提供商列表
    if (!configuredProviders.includes(providerId as ProviderId)) {
      setConfiguredProviders([...configuredProviders, providerId as ProviderId]);
    }

    // 清空输入框
    setProviderApiKeys(prev => ({ ...prev, [providerId]: '' }));

    // 如果当前没有选中的提供商，或者刚刚配置的是当前提供商，重新初始化记忆系统
    if (providerId === selectedProvider) {
      if (memoryManagerRef.current) {
        memoryManagerRef.current = new LocalMemoryManager({
          apiKey,
          similarityK: 4,
          maxMemories: 100,
        });
        await memoryManagerRef.current.init();
      }
    }
  }, [providerApiKeys, configuredProviders, selectedProvider]);

  // Task 14: 清除提供商 API Key
  const handleClearProviderKey = useCallback(async (providerId: keyof ProviderApiKeysState) => {
    await ProviderStore.removeApiKey(providerId as ProviderId);

    // 更新已配置提供商列表
    setConfiguredProviders(prev => prev.filter(p => p !== providerId));

    // 如果清除的是当前提供商的 key，清空记忆系统
    if (providerId === selectedProvider) {
      memoryManagerRef.current = null;
      setMemoryCount(0);
    }
  }, [selectedProvider]);

  // 清除所有数据
  const handleClearData = useCallback(async () => {
    if (confirm('确定要清除所有聊天记录和记忆吗？此操作不可恢复。')) {
      setMessages([]);
      saveMessages([]);
      await chrome.storage.local.remove('chat_messages');

      if (memoryManagerRef.current) {
        await memoryManagerRef.current.clear();
        setMemoryCount(0);
      }
    }
  }, [saveMessages]);

  // Task 12: 发送消息 - 使用 ChatService
  const handleSend = useCallback(async (content: string) => {
    const apiKey = await getCurrentApiKey();
    if (!apiKey) {
      setError({
        message: `请先在设置中配置 ${PROVIDERS[selectedProvider].name} 的 API Key`,
        timestamp: Date.now(),
        recoverable: true,
      });
      setShowSettings(true);
      return;
    }

    if (!content.trim()) return;

    setLoading(true);
    setError(null);

    // 添加用户消息
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => {
      const newMessages = [...prev, userMessage];
      saveMessages(newMessages);
      return newMessages;
    });

    // 准备API消息
    const apiMessages: ChatMessage[] = [
      { role: 'system', content: formatSystemPrompt() },
    ];

    // 添加最近的上下文消息
    const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
    for (const msg of recentMessages) {
      apiMessages.push({ role: msg.role, content: msg.content });
    }

    // 检索相关记忆
    let relevantContext = '';
    if (memoryManagerRef.current?.isInitialized()) {
      try {
        relevantContext = await memoryManagerRef.current.searchRelevantContext(
          content.trim(),
          MEMORY_RETRIEVAL_K
        );
        if (relevantContext) {
          apiMessages.push({
            role: 'system',
            content: `以下是与当前对话相关的记忆：\n\n${relevantContext}`,
          });
        }
      } catch (err) {
        console.error('Failed to retrieve memories:', err);
      }
    }

    // 添加用户消息
    apiMessages.push({ role: 'user', content: content.trim() });

    // 创建AbortController
    abortControllerRef.current = new AbortController();

    try {
      const assistantMessageId = generateId();
      let assistantContent = '';

      // 创建空助手消息
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setMessages((prev) => {
        const newMessages = [...prev, assistantMessage];
        saveMessages(newMessages);
        return newMessages;
      });

      // 使用 ChatService 进行流式响应
      for await (const chunk of ChatService.streamChat(apiMessages, {
        providerId: selectedProvider,
        model: selectedModel,
        signal: abortControllerRef.current.signal,
      })) {
        assistantContent += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: assistantContent }
              : msg
          )
        );
      }

      // 保存到记忆
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

      setError({
        message: errorMessage,
        timestamp: Date.now(),
        recoverable: !errorMessage.includes('API Key'),
      });

      // 添加错误消息
      const errorSystemMessage: Message = {
        id: generateId(),
        role: 'system',
        content: `错误: ${errorMessage}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => {
        const newMessages = [...prev, errorSystemMessage];
        saveMessages(newMessages);
        return newMessages;
      });
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [selectedProvider, selectedModel, messages, saveMessages, getCurrentApiKey]);

  // 停止生成
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setLoading(false);
  }, []);

  // 清除错误
  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  // ========== 渲染 ==========

  return (
    <div
      className={clsx(
        'min-h-screen transition-colors duration-200',
        darkMode ? 'dark bg-gray-900' : 'bg-gray-50'
      )}
    >
      {/* 主内容 */}
      <div className="h-screen flex flex-col">
        {/* 头部 */}
        <header
          className={clsx(
            'flex items-center justify-between px-4 py-3',
            'bg-white dark:bg-gray-800',
            'border-b border-gray-200 dark:border-gray-700',
            'shadow-sm'
          )}
        >
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm">BP</span>
            </div>

            {/* 标题、提供商选择器和模型选择器 */}
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
                Browser Pal
              </h1>

              {/* Task 13: 提供商选择器 */}
              <div className="hidden sm:block">
                <ProviderSelector
                  value={selectedProvider}
                  onChange={handleProviderChange}
                  configuredProviders={configuredProviders}
                />
              </div>

              {/* 模型选择器 */}
              <div className="hidden sm:block">
                <ModelSelector
                  providerId={selectedProvider}
                  value={selectedModel}
                  onChange={handleModelChange}
                />
              </div>
            </div>
          </div>

          {/* 头部操作 */}
          <div className="flex items-center gap-2">
            {/* 记忆计数 */}
            <div
              className={clsx(
                'hidden sm:flex items-center gap-1.5 px-2.5 py-1',
                'bg-gray-100 dark:bg-gray-700',
                'rounded-lg text-xs',
                'text-gray-600 dark:text-gray-300'
              )}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>{memoryCount}</span>
            </div>

            {/* 深色模式切换 */}
            <button
              onClick={toggleDarkMode}
              className={clsx(
                'p-2 rounded-lg',
                'text-gray-600 dark:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'transition-colors'
              )}
              title={darkMode ? '切换到浅色模式' : '切换到深色模式'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* 设置按钮 */}
            <button
              onClick={() => setShowSettings(true)}
              className={clsx(
                'p-2 rounded-lg',
                'text-gray-600 dark:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'transition-colors'
              )}
              title="设置"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 错误提示 */}
        <ErrorBanner error={error} onDismiss={handleDismissError} />

        {/* 聊天窗口 */}
        <div className="flex-1 overflow-hidden">
          <ChatWindow
            messages={messages}
            onSend={handleSend}
            onStop={handleStop}
            loading={loading}
            disabled={!configuredProviders.includes(selectedProvider)}
          />
        </div>
      </div>

      {/* Task 14 & 15: 设置模态框 - 多提供商配置和当前使用显示 */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        memoryCount={memoryCount}
        providerApiKeys={providerApiKeys}
        onProviderApiKeyChange={(providerId, value) => {
          setProviderApiKeys(prev => ({ ...prev, [providerId]: value }));
        }}
        onSaveProviderKey={handleSaveProviderKey}
        onClearProviderKey={handleClearProviderKey}
        onModelChange={handleModelChange}
        onClearData={handleClearData}
        isAppleSilicon={isAppleSiliconRef.current}
        configuredProviders={configuredProviders}
      />
    </div>
  );
}

export default App;
