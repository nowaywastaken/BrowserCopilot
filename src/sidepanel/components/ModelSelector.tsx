/**
 * Model Selector Component
 * 智能模型选择器，支持 GPT-4 / Claude 3 / Llama 3 等主流模型
 * 
 * 特性：
 * - 模型分类展示（按提供商分组）
 * - 实时模型信息显示
 * - 快速切换功能
 * - 性能优化（React.memo, useCallback）
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  Check, 
  Zap, 
  Brain, 
  Sparkles, 
  Globe,
  Clock,
  Info
} from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// 类型定义
// ============================================================================

/** 支持的 AI 模型 */
export type AIModel =
  | 'openai/gpt-4o'
  | 'openai/gpt-4o-mini'
  | 'openai/gpt-4-turbo'
  | 'anthropic/claude-3-opus-20240229'
  | 'anthropic/claude-3-sonnet-20240229'
  | 'anthropic/claude-3-haiku-20240307'
  | 'meta-llama/llama-3-70b-instruct'
  | 'meta-llama/llama-3-8b-instruct'
  | 'google/gemini-1.5-pro-latest'
  | 'google/gemini-1.5-flash-latest';

/** 模型信息 */
export interface ModelInfo {
  id: AIModel;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Meta' | 'Google';
  description: string;
  contextLength: number;
  pricing: {
    input: number; // per 1M tokens
    output: number; // per 1M tokens
  };
  strengths: string[];
  speed: 'fast' | 'medium' | 'slow';
}

// ============================================================================
// 常量定义
// ============================================================================

/** 模型信息映射 */
export const MODEL_INFO_MAP: Record<AIModel, ModelInfo> = {
  'openai/gpt-4o': {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'OpenAI 最新的旗舰多模态模型，平衡性能与速度',
    contextLength: 128000,
    pricing: { input: 5, output: 15 },
    strengths: ['多模态理解', '指令遵循', '创意写作'],
    speed: 'fast',
  },
  'openai/gpt-4o-mini': {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    description: '轻量级快速模型，性价比极高',
    contextLength: 128000,
    pricing: { input: 0.15, output: 0.6 },
    strengths: ['快速响应', '低成本', '日常任务'],
    speed: 'fast',
  },
  'openai/gpt-4-turbo': {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: '高性能长上下文模型',
    contextLength: 128000,
    pricing: { input: 10, output: 30 },
    strengths: ['长上下文', '复杂推理', '代码生成'],
    speed: 'medium',
  },
  'anthropic/claude-3-opus-20240229': {
    id: 'anthropic/claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    description: 'Anthropic 最强大的模型，接近人类级别的推理能力',
    contextLength: 200000,
    pricing: { input: 15, output: 75 },
    strengths: ['深度推理', '长文档分析', '安全性'],
    speed: 'slow',
  },
  'anthropic/claude-3-sonnet-20240229': {
    id: 'anthropic/claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    description: '平衡性能与速度的优秀选择',
    contextLength: 200000,
    pricing: { input: 3, output: 15 },
    strengths: ['平衡性能', '多语言', '代码能力'],
    speed: 'medium',
  },
  'anthropic/claude-3-haiku-20240307': {
    id: 'anthropic/claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    description: '快速响应模型，适合简单任务',
    contextLength: 200000,
    pricing: { input: 0.25, output: 1.25 },
    strengths: ['快速响应', '简单任务', '日常对话'],
    speed: 'fast',
  },
  'meta-llama/llama-3-70b-instruct': {
    id: 'meta-llama/llama-3-70b-instruct',
    name: 'Llama 3 70B',
    provider: 'Meta',
    description: '开源大模型，70B 参数指令调优版本',
    contextLength: 8192,
    pricing: { input: 0.9, output: 0.9 },
    strengths: ['开源免费', '推理能力', '多语言'],
    speed: 'medium',
  },
  'meta-llama/llama-3-8b-instruct': {
    id: 'meta-llama/llama-3-8b-instruct',
    name: 'Llama 3 8B',
    provider: 'Meta',
    description: '轻量级开源模型，资源消耗低',
    contextLength: 8192,
    pricing: { input: 0.2, output: 0.2 },
    strengths: ['资源友好', '快速部署', '基础任务'],
    speed: 'fast',
  },
  'google/gemini-1.5-pro-latest': {
    id: 'google/gemini-1.5-pro-latest',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    description: 'Google 最新多模态模型，超长上下文',
    contextLength: 2000000,
    pricing: { input: 3.5, output: 10.5 },
    strengths: ['超长上下文', '多模态', '代码能力'],
    speed: 'medium',
  },
  'google/gemini-1.5-flash-latest': {
    id: 'google/gemini-1.5-flash-latest',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    description: '轻量快速版本，适合高频调用',
    contextLength: 1000000,
    pricing: { input: 0.35, output: 1.05 },
    strengths: ['快速', '低成本', '多模态'],
    speed: 'fast',
  },
};

/** 提供商图标映射 */
const PROVIDER_ICONS: Record<ModelInfo['provider'], React.ReactNode> = {
  OpenAI: <Zap className="w-4 h-4" />,
  Anthropic: <Brain className="w-4 h-4" />,
  Meta: <Globe className="w-4 h-4" />,
  Google: <Sparkles className="w-4 h-4" />,
};

/** 提供商颜色 */
const PROVIDER_COLORS: Record<ModelInfo['provider'], string> = {
  OpenAI: 'bg-green-500/10 text-green-600 dark:text-green-400',
  Anthropic: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  Meta: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Google: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

/** 按提供商分组模型 */
const MODELS_BY_PROVIDER: Record<ModelInfo['provider'], AIModel[]> = {
  OpenAI: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/gpt-4-turbo'],
  Anthropic: ['anthropic/claude-3-opus-20240229', 'anthropic/claude-3-sonnet-20240229', 'anthropic/claude-3-haiku-20240307'],
  Meta: ['meta-llama/llama-3-70b-instruct', 'meta-llama/llama-3-8b-instruct'],
  Google: ['google/gemini-1.5-pro-latest', 'google/gemini-1.5-flash-latest'],
};

// ============================================================================
// 组件接口
// ============================================================================

interface ModelSelectorProps {
  value: AIModel;
  onChange: (model: AIModel) => void;
  disabled?: boolean;
}

// ============================================================================
// 子组件：模型选项
// ============================================================================

interface ModelOptionProps {
  model: AIModel;
  isSelected: boolean;
  onSelect: () => void;
}

const ModelOption = React.memo(function ModelOption({ 
  model, 
  isSelected, 
  onSelect 
}: ModelOptionProps) {
  const info = MODEL_INFO_MAP[model];
  
  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full px-3 py-2.5 text-left rounded-lg transition-all duration-150',
        'hover:bg-gray-100 dark:hover:bg-gray-700',
        isSelected 
          ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800' 
          : ''
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* 提供商图标 */}
          <div className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            PROVIDER_COLORS[info.provider]
          )}>
            {PROVIDER_ICONS[info.provider]}
          </div>
          
          {/* 模型名称 */}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {info.name}
              </span>
              {isSelected && (
                <Check className="w-4 h-4 text-blue-500" />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {info.description}
            </div>
          </div>
        </div>
        
        {/* 速度指示 */}
        <div className={clsx(
          'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
          info.speed === 'fast' && 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
          info.speed === 'medium' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
          info.speed === 'slow' && 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
        )}>
          <Clock className="w-3 h-3" />
          {info.speed === 'fast' && '快速'}
          {info.speed === 'medium' && '中速'}
          {info.speed === 'slow' && '较慢'}
        </div>
      </div>
      
      {/* 特性标签 */}
      <div className="flex flex-wrap gap-1 mt-2 ml-10">
        {info.strengths.slice(0, 3).map((strength) => (
          <span
            key={strength}
            className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
          >
            {strength}
          </span>
        ))}
      </div>
    </button>
  );
});

// ============================================================================
// 主组件
// ============================================================================

export const ModelSelector = React.memo(function ModelSelector({
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 获取当前模型信息
  const currentModelInfo = useMemo(() => MODEL_INFO_MAP[value], [value]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 切换下拉菜单
  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  // 选择模型
  const handleSelect = useCallback((model: AIModel) => {
    onChange(model);
    setIsOpen(false);
  }, [onChange]);

  // 键盘导航
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Escape':
        setIsOpen(false);
        break;
      case 'Enter':
      case ' ':
        if (!isOpen) {
          event.preventDefault();
          setIsOpen(true);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) setIsOpen(true);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) setIsOpen(true);
        break;
    }
  }, [disabled, isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {/* 选择器触发器 */}
      <button
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-white dark:bg-gray-800',
          'border border-gray-200 dark:border-gray-600',
          'hover:border-gray-300 dark:hover:border-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'transition-all duration-150',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* 当前模型图标 */}
        <div className={clsx(
          'w-7 h-7 rounded-md flex items-center justify-center',
          PROVIDER_COLORS[currentModelInfo.provider]
        )}>
          {PROVIDER_ICONS[currentModelInfo.provider]}
        </div>

        {/* 模型名称 */}
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {currentModelInfo.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {currentModelInfo.provider}
          </div>
        </div>

        {/* 下拉箭头 */}
        <ChevronDown 
          className={clsx(
            'w-4 h-4 text-gray-400 transition-transform duration-150',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={clsx(
            'absolute top-full left-0 right-0 mt-1',
            'bg-white dark:bg-gray-800',
            'border border-gray-200 dark:border-gray-600',
            'rounded-lg shadow-lg',
            'overflow-hidden z-50',
            'max-h-96 overflow-y-auto'
          )}
          role="listbox"
        >
          {/* 分组展示 */}
          {Object.entries(MODELS_BY_PROVIDER).map(([provider, models]) => (
            <div key={provider}>
              {/* 提供商分组标题 */}
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                {provider}
              </div>
              
              {/* 模型选项 */}
              {models.map((modelId) => (
                <ModelOption
                  key={modelId}
                  model={modelId}
                  isSelected={modelId === value}
                  onSelect={() => handleSelect(modelId)}
                />
              ))}
            </div>
          ))}

          {/* 模型信息提示 */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                切换模型可能会影响对话上下文理解。某些模型支持更长的上下文窗口。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// 导出类型
// ============================================================================

export type { ModelSelectorProps };
