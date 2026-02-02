import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// 清理每个测试后的渲染
afterEach(() => {
  cleanup();
});

// Mock Chrome API
global.chrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
  sidePanel: {
    open: vi.fn().mockImplementation((_, callback) => callback?.()),
    setPanelBehavior: vi.fn().mockImplementation((_, callback) => callback?.()),
  },
  commands: {
    onCommand: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn().mockResolvedValue({}),
    getURL: vi.fn().mockReturnValue('chrome-extension://test-id/'),
    lastError: null,
  },
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, active: true }]),
    create: vi.fn().mockResolvedValue({}),
    onActivated: {
      addListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
    },
  },
  notifications: {
    create: vi.fn().mockResolvedValue(''),
  },
} as any;

// Mock crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn().mockReturnValue('test-uuid-1234-5678'),
  },
  writable: true,
});

// Mock fetch API
global.fetch = vi.fn();

// Mock IndexedDB
global.indexedDB = {
  open: vi.fn(),
} as any;

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(() => callback(performance.now()), 0);
};

global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

// Mock performance.now
global.performance = {
  now: vi.fn().mockReturnValue(0),
} as any;