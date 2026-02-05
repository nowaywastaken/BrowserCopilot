import React from 'react';
import { clsx } from 'clsx';
import type { ProviderId } from '../../lib/types/provider';
import { getProviderModels } from '../../lib/providers';

interface ModelSelectorProps {
  providerId: ProviderId;
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  providerId,
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  const models = getProviderModels(providerId);

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={clsx(
          'appearance-none',
          'px-3 py-1.5 pr-8',
          'bg-gray-100 dark:bg-gray-700',
          'border border-gray-200 dark:border-gray-600',
          'rounded-lg',
          'text-sm',
          'text-gray-700 dark:text-gray-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors'
        )}
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

export type { AIModel } from '../../lib/types/provider';
