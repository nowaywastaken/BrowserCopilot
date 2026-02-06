# BrowserCopilot Agent Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate SnapChrome screenshot functionality and AutoMonkey script management into BrowserCopilot, creating an AI Agent that can autonomously execute browser automation tasks through tool calling.

**Architecture:** This plan merges three projects into a unified Chrome extension:
1. **BrowserCopilot** - Main extension with AI sidebar, providers, memory system
2. **SnapChrome** - Screenshot capture with DPR/color space handling
3. **AutoMonkey** - UserScript management and installation

The unified architecture uses a Background Service Worker as the agent control center, with modular tool executors for screenshot, DOM, script management, and page interaction. Tools are defined using Vercel AI SDK's `tools` parameter for native function calling support.

**Tech Stack:**
- React 18 + TypeScript 5+
- Vite 5 + CRXJS (Chrome Extension bundler)
- Vercel AI SDK (streamText, generateText, tools)
- Chrome Extension APIs (sidePanel, tabs, scripting, userScripts, offscreen)
- IndexedDB for script storage
- Tailwind CSS for UI

---

## Phase 1: Project Structure & Configuration

### Task 1: Create Unified Project Structure

**Files:**
- Create: `src/background/index.ts`
- Create: `src/background/agent-core.ts`
- Create: `src/background/tools/`
- Create: `src/background/tools/screenshot.ts`
- Create: `src/background/tools/dom.ts`
- Create: `src/background/tools/script.ts`
- Create: `src/background/tools/userscript.ts`
- Create: `src/offscreen/`
- Create: `src/offscreen/index.html`
- Create: `src/offscreen/offscreen.ts`
- Create: `src/contents/`
- Create: `src/contents/inject.ts`
- Create: `src/lib/agent/`
- Create: `src/lib/agent/types.ts`
- Create: `src/lib/agent/intent-detector.ts`
- Create: `src/lib/screenshot/`
- Create: `src/lib/userscript/`
- Modify: `src/sidepanel/App.tsx` (add Agent mode)
- Modify: `src/lib/services/chat-service.ts` (add agent support)
- Modify: `manifest.json` (merge permissions)
- Modify: `vite.config.ts` (configure build)

**Step 1: Create directory structure**

```bash
cd /Users/nowaywastaken/Documents/BrowserCopilot-agent-planning
mkdir -p src/background/tools src/offscreen src/contents src/lib/agent src/lib/screenshot src/lib/userscript
```

**Step 2: Define agent types**

```typescript
// src/lib/agent/types.ts
export interface AgentState {
  task: string;
  originalRequest: string;
  phase: 'planning' | 'executing' | 'evaluating' | 'completed' | 'failed';
  iterations: number;
  maxIterations: number;
  toolCalls: Array<{
    id: string;
    tool: string;
    input: unknown;
    output: unknown;
    timestamp: number;
    success: boolean;
    error?: string;
  }>;
  currentThought?: string;
  nextAction?: string;
  finalResult?: unknown;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    enum?: string[];
    required?: boolean;
  }>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

**Step 3: Create manifest merge**

```typescript
// Add to manifest.json permissions:
{
  "permissions": [
    "sidePanel",
    "tabs",
    "scripting",
    "userScripts",
    "offscreen"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

---

### Task 2: Update Vite Configuration for New Structure

**Files:**
- Modify: `vite.config.ts`

**Step 1: Update vite config**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    crx({
      manifest: {
        name: 'BrowserCopilot - AI Browser Agent',
        version: '2.0.0',
        description: 'AI-powered browser automation with screenshot and user script capabilities',
        manifest_version: 3,
        side_panel: {
          default_path: 'sidepanel.html',
        },
        permissions: [
          'sidePanel',
          'tabs',
          'scripting',
          'userScripts',
          'offscreen',
          'storage',
        ],
        host_permissions: ['<all_urls>'],
        background: {
          service_worker: 'src/background/index.ts',
          type: 'module',
        },
        content_scripts: [
          {
            matches: ['<all_urls>'],
            js: ['src/contents/inject.js'],
            run_at: 'document_idle',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

---

## Phase 2: Agent Core Implementation

### Task 3: Implement Agent State Management

**Files:**
- Create: `src/lib/agent/types.ts`
- Create: `src/lib/agent/agent-state.ts`

**Step 1: Write failing test**

```typescript
// tests/lib/agent/agent-state.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentState, createInitialState } from '../../../src/lib/agent/agent-state';

describe('AgentState', () => {
  it('should create initial state with task', () => {
    const state = createInitialState('Test task');
    expect(state.task).toBe('Test task');
    expect(state.originalRequest).toBe('Test task');
    expect(state.phase).toBe('planning');
    expect(state.iterations).toBe(0);
    expect(state.toolCalls).toHaveLength(0);
  });

  it('should add tool call to history', () => {
    const state = createInitialState('Test task');
    const updated = state.addToolCall({
      tool: 'captureScreenshot',
      input: { quality: 'high' },
      output: { dataUrl: 'base64...' },
      success: true,
    });
    expect(updated.toolCalls).toHaveLength(1);
    expect(updated.toolCalls[0].tool).toBe('captureScreenshot');
  });

  it('should update phase correctly', () => {
    const state = createInitialState('Test task');
    const updated = state.setPhase('executing');
    expect(updated.phase).toBe('executing');
  });
});
```

**Step 2: Run test**

```bash
npm test -- tests/lib/agent/agent-state.test.ts
Expected: FAIL (agent-state module not found)
```

**Step 3: Write minimal implementation**

```typescript
// src/lib/agent/types.ts
export interface ToolCall {
  id: string;
  tool: string;
  input: unknown;
  output: unknown;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface AgentState {
  task: string;
  originalRequest: string;
  phase: 'planning' | 'executing' | 'evaluating' | 'completed' | 'failed';
  iterations: number;
  maxIterations: number;
  toolCalls: ToolCall[];
  currentThought?: string;
  nextAction?: string;
  finalResult?: unknown;
  error?: string;
}

export function createInitialState(task: string, maxIterations = 50): AgentState {
  return {
    task,
    originalRequest: task,
    phase: 'planning',
    iterations: 0,
    maxIterations,
    toolCalls: [],
  };
}
```

**Step 4: Run test**

```bash
npm test -- tests/lib/agent/agent-state.test.ts
Expected: FAIL (createInitialState not exported from agent-state.ts)
```

**Step 5: Create agent-state module**

```typescript
// src/lib/agent/agent-state.ts
import type { AgentState, ToolCall } from './types';

export function createInitialState(task: string, maxIterations = 50): AgentState {
  return {
    task,
    originalRequest: task,
    phase: 'planning',
    iterations: 0,
    maxIterations,
    toolCalls: [],
  };
}

export function addToolCall(
  state: AgentState,
  call: Omit<ToolCall, 'id' | 'timestamp'>
): AgentState {
  return {
    ...state,
    toolCalls: [
      ...state.toolCalls,
      {
        ...call,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    ],
  };
}

export function setPhase(state: AgentState, phase: AgentState['phase']): AgentState {
  return { ...state, phase };
}

export function incrementIterations(state: AgentState): AgentState {
  return { ...state, iterations: state.iterations + 1 };
}

export function setThought(state: AgentState, thought: string): AgentState {
  return { ...state, currentThought: thought };
}

export function setNextAction(state: AgentState, action: string): AgentState {
  return { ...state, nextAction: action };
}

export function completeTask(state: AgentState, result: unknown): AgentState {
  return {
    ...state,
    phase: 'completed',
    finalResult: result,
  };
}

export function failTask(state: AgentState, error: string): AgentState {
  return {
    ...state,
    phase: 'failed',
    error,
  };
}
```

**Step 6: Run test**

```bash
npm test -- tests/lib/agent/agent-state.test.ts
Expected: PASS
```

**Step 7: Commit**

```bash
git add src/lib/agent/ tests/lib/agent/
git commit -m "feat(agent): add agent state management with type definitions"
```

---

### Task 4: Implement Intent Detector

**Files:**
- Create: `src/lib/agent/intent-detector.ts`
- Create: `tests/lib/agent/intent-detector.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { detectIntent } from '../../../src/lib/agent/intent-detector';

describe('IntentDetector', () => {
  it('should identify agent task - screenshot', async () => {
    const result = await detectIntent('截个屏看看这个页面');
    expect(result.requiresAgent).toBe(true);
  });

  it('should identify agent task - script', async () => {
    const result = await detectIntent('帮我写个脚本自动点击按钮');
    expect(result.requiresAgent).toBe(true);
  });

  it('should identify chat only - question', async () => {
    const result = await detectIntent('什么是 DOM？');
    expect(result.requiresAgent).toBe(false);
  });
});
```

**Step 2: Run test**

```bash
npm test -- tests/lib/agent/intent-detector.test.ts
Expected: FAIL (module not found)
```

**Step 3: Write implementation**

```typescript
// src/lib/agent/intent-detector.ts
import { ChatService } from '../services/chat-service';

export interface IntentResult {
  requiresAgent: boolean;
  taskType?: 'screenshot' | 'script' | 'dom' | 'mixed' | 'page-interaction';
  confidence: number;
}

const AGENT_TRIGGERS = [
  '截屏', '截图', '截图看看', 'capture', 'screenshot',
  '写脚本', '脚本', 'userscript', 'tampermonkey',
  '点击', '自动点击', '自动操作',
  '获取元素', '查看DOM', '分析页面',
  '帮我', '帮我做', '帮我处理',
];

const CHAT_ONLY_TRIGGERS = [
  '是什么', '什么是', '解释一下', '什么意思',
  '告诉我', '帮我理解', '概念', '原理',
];

export async function detectIntent(message: string): Promise<IntentResult> {
  // Simple keyword-based detection first
  const lowerMessage = message.toLowerCase();

  const hasAgentTrigger = AGENT_TRIGGERS.some(trigger =>
    lowerMessage.includes(trigger.toLowerCase())
  );

  const hasChatTrigger = CHAT_ONLY_TRIGGERS.some(trigger =>
    lowerMessage.includes(trigger.toLowerCase())
  );

  // If clearly agent task
  if (hasAgentTrigger && !hasChatTrigger) {
    return {
      requiresAgent: true,
      taskType: inferTaskType(message),
      confidence: 0.9,
    };
  }

  // If clearly chat only
  if (hasChatTrigger && !hasAgentTrigger) {
    return { requiresAgent: false, confidence: 0.9 };
  }

  // Use LLM for ambiguous cases
  return await useLLMJudge(message);
}

function inferTaskType(message: string): IntentResult['taskType'] {
  const lower = message.toLowerCase();
  if (lower.includes('脚本') || lower.includes('script')) return 'script';
  if (lower.includes('截图') || lower.includes('screenshot')) return 'screenshot';
  if (lower.includes('dom') || lower.includes('元素')) return 'dom';
  if (lower.includes('点击') || lower.includes('交互')) return 'page-interaction';
  return 'mixed';
}

async function useLLMJudge(message: string): Promise<IntentResult> {
  const prompt = `
判断这个用户消息是否需要执行浏览器自动化任务。

用户消息: "${message}"

浏览器自动化任务包括：
- 截图、分析页面
- 获取或修改页面元素
- 执行 JavaScript 代码
- 编写或安装用户脚本

如果是自动化任务，返回 JSON: {"requiresAgent": true, "taskType": "...", "confidence": 0.7}
如果是普通聊天，返回 JSON: {"requiresAgent": false, "confidence": 0.7}

只返回 JSON，不要其他内容。
`;

  try {
    const result = await ChatService.chat([
      { role: 'user', content: prompt },
    ]);
    return JSON.parse(result);
  } catch {
    // Fallback: assume chat only
    return { requiresAgent: false, confidence: 0.5 };
  }
}
```

**Step 4: Run test**

```bash
npm test -- tests/lib/agent/intent-detector.test.ts
Expected: PASS
```

**Step 5: Commit**

```bash
git add src/lib/agent/ tests/lib/agent/
git commit -m "feat(agent): add intent detection for agent vs chat mode"
```

---

### Task 5: Implement Tool Executor Interface

**Files:**
- Create: `src/lib/agent/tool-executor.ts`
- Create: `src/lib/agent/tool-registry.ts`
- Create: `tests/lib/agent/tool-executor.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { ToolExecutor, createToolRegistry } from '../../../src/lib/agent/tool-executor';

describe('ToolExecutor', () => {
  it('should define screenshot tool', () => {
    const registry = createToolRegistry();
    const tool = registry.get('captureScreenshot');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('captureScreenshot');
    expect(tool?.parameters.quality).toBeDefined();
  });

  it('should define all required tools', () => {
    const registry = createToolRegistry();
    const tools = [
      'captureScreenshot',
      'captureDOM',
      'capturePageAnalysis',
      'getElementInfo',
      'executeScript',
      'getPageInfo',
      'installUserScript',
      'listUserScripts',
    ];
    for (const name of tools) {
      expect(registry.has(name), `Tool ${name} not found`).toBe(true);
    }
  });
});
```

**Step 2: Run test**

```bash
npm test -- tests/lib/agent/tool-executor.test.ts
Expected: FAIL
```

**Step 3: Write implementation**

```typescript
// src/lib/agent/tool-executor.ts
import type { ToolDefinition } from './types';

export interface ToolExecutor {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    enum?: string[];
    required?: boolean;
  }>;

  execute(
    params: Record<string, unknown>,
    context: {
      tabId: number;
      signal: AbortSignal;
    }
  ): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
}

export function createToolRegistry(): Map<string, ToolExecutor> {
  const registry = new Map<string, ToolExecutor>();

  // Register all tools
  registry.set('captureScreenshot', screenshotTool);
  registry.set('captureDOM', domTool);
  registry.set('capturePageAnalysis', pageAnalysisTool);
  registry.set('getElementInfo', getElementInfoTool);
  registry.set('executeScript', executeScriptTool);
  registry.set('getPageInfo', getPageInfoTool);
  registry.set('installUserScript', installUserScriptTool);
  registry.set('listUserScripts', listUserScriptsTool);

  return registry;
}

export function getToolDefinitions(registry: Map<string, ToolExecutor>): ToolDefinition[] {
  return Array.from(registry.values()).map(executor => ({
    name: executor.name,
    description: executor.description,
    parameters: executor.parameters,
  }));
}

// Tool definitions
export const screenshotTool: ToolExecutor = {
  name: 'captureScreenshot',
  description: 'Capture a screenshot of the current browser viewport. Returns base64 image data.',
  parameters: {
    quality: {
      type: 'string',
      description: 'Image quality: low (faster, smaller), medium (balanced), high (best quality)',
      enum: ['low', 'medium', 'high'],
    },
    returnToUser: {
      type: 'boolean',
      description: 'Whether to show the screenshot to the user',
    },
  },
  async execute(params, context) {
    // Implementation in Task 6
    return { success: false, error: 'Not implemented' };
  },
};

export const domTool: ToolExecutor = {
  name: 'captureDOM',
  description: 'Extract the DOM structure from the current page. Returns HTML and text content.',
  parameters: {
    selector: {
      type: 'string',
      description: 'Optional CSS selector to extract specific element only',
    },
    includeAttributes: {
      type: 'boolean',
      description: 'Include element attributes in the output',
    },
    maxDepth: {
      type: 'number',
      description: 'Maximum nesting depth to traverse',
    },
  },
  async execute(params, context) {
    return { success: false, error: 'Not implemented' };
  },
};

export const pageAnalysisTool: ToolExecutor = {
  name: 'capturePageAnalysis',
  description: 'Capture both screenshot and DOM for comprehensive page analysis.',
  parameters: {
    screenshotQuality: {
      type: 'string',
      description: 'Quality for screenshot',
      enum: ['low', 'medium', 'high'],
    },
    domMaxDepth: {
      type: 'number',
      description: 'Maximum depth for DOM extraction',
    },
  },
  async execute(params, context) {
    return { success: false, error: 'Not implemented' };
  },
};

export const getElementInfoTool: ToolExecutor = {
  name: 'getElementInfo',
  description: 'Get detailed information about a specific element using CSS selector.',
  parameters: {
    selector: {
      type: 'string',
      description: 'CSS selector to target the element',
      required: true,
    },
  },
  async execute(params, context) {
    return { success: false, error: 'Not implemented' };
  },
};

export const executeScriptTool: ToolExecutor = {
  name: 'executeScript',
  description: 'Execute JavaScript code in the context of the current page.',
  parameters: {
    code: {
      type: 'string',
      description: 'JavaScript code to execute',
      required: true,
    },
  },
  async execute(params, context) {
    return { success: false, error: 'Not implemented' };
  },
};

export const getPageInfoTool: ToolExecutor = {
  name: 'getPageInfo',
  description: 'Get basic page information including URL, title, cookies, and localStorage.',
  parameters: {},
  async execute(params, context) {
    return { success: false, error: 'Not implemented' };
  },
};

export const installUserScriptTool: ToolExecutor = {
  name: 'installUserScript',
  description: 'Install a Tampermonkey/GreaseMonkey user script.',
  parameters: {
    code: {
      type: 'string',
      description: 'Complete user script code with metadata block',
      required: true,
    },
  },
  async execute(params, context) {
    return { success: false, error: 'Not implemented' };
  },
};

export const listUserScriptsTool: ToolExecutor = {
  name: 'listUserScripts',
  description: 'List all installed user scripts.',
  parameters: {},
  async execute(params, context) {
    return { success: false, error: 'Not implemented' };
  },
};
```

**Step 4: Run test**

```bash
npm test -- tests/lib/agent/tool-executor.test.ts
Expected: PASS
```

**Step 5: Commit**

```bash
git add src/lib/agent/ tests/lib/agent/
git commit -m "feat(agent): add tool executor interface and registry"
```

---

## Phase 3: Tool Implementation

### Task 6: Implement Screenshot Tools

**Files:**
- Create: `src/lib/screenshot/capture.ts`
- Create: `src/lib/screenshot/processor.ts`
- Create: `tests/lib/screenshot/capture.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ScreenshotCapture', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should capture visible tab', async () => {
    // Mock chrome.tabs
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123, active: true }]),
        captureVisibleTab: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
      },
    });

    const { captureScreenshot } = await import('../../../src/lib/screenshot/capture');
    const result = await captureScreenshot({ quality: 'high' });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.width).toBeDefined();
  });
});
```

**Step 2: Run test**

```bash
npm test -- tests/lib/screenshot/capture.test.ts
Expected: FAIL
```

**Step 3: Implement screenshot capture**

```typescript
// src/lib/screenshot/capture.ts
export interface ScreenshotResult {
  success: boolean;
  data?: {
    dataUrl: string;
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  error?: string;
}

export interface ScreenshotOptions {
  quality?: 'low' | 'medium' | 'high';
  returnToUser?: boolean;
}

const QUALITY_MAP = {
  low: 50,
  medium: 75,
  high: 100,
};

export async function captureScreenshot(
  options: ScreenshotOptions = {}
): Promise<ScreenshotResult> {
  const { quality = 'medium', returnToUser = false } = options;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      return { success: false, error: 'Cannot access current tab' };
    }

    // Capture viewport
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: QUALITY_MAP[quality],
    });

    // Get device info
    const [info] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        dpr: window.devicePixelRatio,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      }),
    });

    const dpr = info.result?.dpr || 1;
    const width = info.result?.innerWidth || 0;
    const height = info.result?.innerHeight || 0;

    return {
      success: true,
      data: {
        dataUrl,
        width: Math.round(width * dpr),
        height: Math.round(height * dpr),
        devicePixelRatio: dpr,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Screenshot failed',
    };
  }
}
```

**Step 4: Implement DPR-aware processor (from SnapChrome)**

```typescript
// src/lib/screenshot/processor.ts
export interface ProcessedScreenshot {
  dataUrl: string;
  logicalWidth: number;
  logicalHeight: number;
  devicePixelRatio: number;
}

export function processScreenshotForDisplay(
  dataUrl: string,
  devicePixelRatio: number,
  quality: 'low' | 'medium' | 'high' = 'medium'
): ProcessedScreenshot {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const logicalWidth = Math.round(img.width / devicePixelRatio);
      const logicalHeight = Math.round(img.height / devicePixelRatio);

      canvas.width = logicalWidth;
      canvas.height = logicalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Cannot create canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, logicalWidth, logicalHeight);

      resolve({
        dataUrl: canvas.toDataURL('image/png', QUALITY_MAP[quality] / 100),
        logicalWidth,
        logicalHeight,
        devicePixelRatio,
      });
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}
```

**Step 5: Run test**

```bash
npm test -- tests/lib/screenshot/capture.test.ts
Expected: PASS (with mocked chrome APIs)
```

**Step 6: Commit**

```bash
git add src/lib/screenshot/ tests/lib/screenshot/
git commit -m "feat(screenshot): implement screenshot capture with quality control"
```

---

### Task 7: Implement DOM Tools

**Files:**
- Create: `src/lib/dom/extractor.ts`
- Create: `tests/lib/dom/extractor.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('DOMExtractor', () => {
  it('should extract page HTML', async () => {
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
        sendMessage: vi.fn().mockResolvedValue({
          html: '<html><body>Test</body></html>',
          text: 'Test',
          metadata: { url: 'https://example.com', title: 'Test', viewport: { width: 1920, height: 1080 } },
        }),
      },
    });

    const { captureDOM } = await import('../../../src/lib/dom/extractor');
    const result = await captureDOM({});

    expect(result.success).toBe(true);
    expect(result.data?.html).toContain('<html>');
  });
});
```

**Step 2: Run test**

```bash
npm test -- tests/lib/dom/extractor.test.ts
Expected: FAIL
```

**Step 3: Implement DOM extraction**

```typescript
// src/lib/dom/extractor.ts
export interface DOMResult {
  success: boolean;
  data?: {
    html: string;
    text: string;
    metadata: {
      url: string;
      title: string;
      viewport: { width: number; height: number };
    };
  };
  error?: string;
}

export interface DOMOptions {
  selector?: string;
  includeAttributes?: boolean;
  maxDepth?: number;
}

export async function captureDOM(options: DOMOptions = {}): Promise<DOMResult> {
  const { selector, includeAttributes = true, maxDepth = 50 } = options;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      return { success: false, error: 'Cannot access current tab' };
    }

    // Send message to content script for extraction
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'captureDOM',
      selector,
      includeAttributes,
      maxDepth,
    });

    return { success: true, data: response };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'DOM extraction failed',
    };
  }
}
```

**Step 4: Implement content script**

```typescript
// src/contents/inject.ts
interface DOMCaptureMessage {
  action: 'captureDOM';
  selector?: string;
  includeAttributes?: boolean;
  maxDepth?: number;
}

function extractElement(element: Element, includeAttributes: boolean, depth: number): unknown {
  if (depth <= 0) return '[max-depth]';

  const result: Record<string, unknown> = {
    tagName: element.tagName.toLowerCase(),
  };

  if (includeAttributes) {
    result.attributes = Object.fromEntries(
      Array.from(element.attributes).map(a => [a.name, a.value])
    );
  }

  if (element.children.length > 0 && depth > 1) {
    result.children = Array.from(element.children)
      .slice(0, 100) // Limit children
      .map(child => extractElement(child, includeAttributes, depth - 1));
  }

  return result;
}

chrome.runtime.onMessage.addListener((message: DOMCaptureMessage, sender, sendResponse) => {
  if (message.action === 'captureDOM') {
    try {
      let rootElement: Element = document.documentElement;

      if (message.selector) {
        rootElement = document.querySelector(message.selector) || document.documentElement;
      }

      const extracted = extractElement(
        rootElement,
        message.includeAttributes ?? true,
        message.maxDepth ?? 50
      );

      sendResponse({
        html: rootElement.outerHTML,
        text: document.body.innerText,
        metadata: {
          url: window.location.href,
          title: document.title,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        },
      });
    } catch (error) {
      sendResponse({ error: error instanceof Error ? error.message : 'Extraction failed' });
    }

    return true; // Async response
  }
});
```

**Step 5: Run test**

```bash
npm test -- tests/lib/dom/extractor.test.ts
Expected: PASS
```

**Step 6: Commit**

```bash
git add src/lib/dom/ src/contents/inject.ts tests/lib/dom/
git commit -m "feat(dom): implement DOM extraction with selector support"
```

---

### Task 8: Implement UserScript Tools (AutoMonkey Integration)

**Files:**
- Create: `src/lib/userscript/manager.ts`
- Create: `src/lib/userscript/installer.ts`
- Create: `tests/lib/userscript/manager.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('UserScriptManager', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should install user script via AutoMonkey API', async () => {
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn().mockImplementation((message, callback) => {
          if (message.action === 'open_install_dialog') {
            callback({ success: true });
          }
          return true;
        }),
      },
    });

    const { installUserScript } = await import('../../../src/lib/userscript/installer');
    const script = `// ==UserScript==\n// @name Test\n// ==/UserScript==\nconsole.log('test');`;

    const result = await installUserScript(script);
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test**

```bash
npm test -- tests/lib/userscript/manager.test.ts
Expected: FAIL
```

**Step 3: Implement script installer (AutoMonkey API)**

```typescript
// src/lib/userscript/installer.ts
export interface InstallResult {
  success: boolean;
  scriptId?: string;
  error?: string;
}

export async function installUserScript(code: string): Promise<InstallResult> {
  try {
    // Send to AutoMonkey's install dialog
    // AutoMonkey will parse metadata, show install confirmation, and register script
    await chrome.runtime.sendMessage({
      action: 'open_install_dialog',
      code,
    });

    return {
      success: true,
      // scriptId will be generated by AutoMonkey during installation
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Installation failed',
    };
  }
}
```

**Step 4: Implement script lister**

```typescript
// src/lib/userscript/manager.ts
export interface ScriptInfo {
  id: string;
  name: string;
  enabled: boolean;
  metadata: {
    name: string;
    version?: string;
    description?: string;
    matches: string[];
    grants: string[];
  };
}

export async function listUserScripts(): Promise<{
  success: boolean;
  scripts?: ScriptInfo[];
  error?: string;
}> {
  try {
    // This would integrate with AutoMonkey's IndexedDB storage
    const response = await chrome.runtime.sendMessage({
      action: 'get_all_scripts',
    });

    if (response?.scripts) {
      return {
        success: true,
        scripts: response.scripts.map((s: any) => ({
          id: s.id,
          name: s.metadata.name,
          enabled: s.enabled,
          metadata: {
            name: s.metadata.name,
            version: s.metadata.version,
            description: s.metadata.description,
            matches: s.metadata.matches || [],
            grants: s.metadata.grants || [],
          },
        })),
      };
    }

    return { success: true, scripts: [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list scripts',
    };
  }
}
```

**Step 5: Run test**

```bash
npm test -- tests/lib/userscript/manager.test.ts
Expected: PASS
```

**Step 6: Commit**

```bash
git add src/lib/userscript/ tests/lib/userscript/
git commit -m "feat(userscript): implement AutoMonkey integration for script management"
```

---

## Phase 4: Agent Core Integration

### Task 9: Implement Agent Core Loop

**Files:**
- Create: `src/background/agent-core.ts`
- Create: `tests/background/agent-core.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentCore } from '../../src/background/agent-core';

describe('AgentCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start task and run planning phase', async () => {
    const core = new AgentCore();

    // Mock LLM response for planning
    vi.spyOn(core, 'think').mockResolvedValue({
      thought: 'I need to capture the screenshot first',
      nextAction: 'captureScreenshot',
      actionParams: { quality: 'high' },
    });

    const result = await core.run('Take a screenshot of this page');

    expect(core.state.phase).toBeDefined();
    expect(core.state.toolCalls.length).toBeGreaterThanOrEqual(1);
  });
});
```

**Step 2: Run test**

```bash
npm test -- tests/background/agent-core.test.ts
Expected: FAIL
```

**Step 3: Implement Agent Core**

```typescript
// src/background/agent-core.ts
import type { AgentState } from '../lib/agent/types';
import {
  createInitialState,
  addToolCall,
  setPhase,
  incrementIterations,
  setThought,
  setNextAction,
  completeTask,
  failTask,
} from '../lib/agent/agent-state';
import { createToolRegistry, type ToolExecutor } from '../lib/agent/tool-executor';
import { ChatService } from '../lib/services/chat-service';

export interface AgentConfig {
  maxIterations?: number;
  model?: string;
  provider?: string;
}

export class AgentCore {
  private state: AgentState;
  private toolRegistry: Map<string, ToolExecutor>;
  private abortController: AbortController;

  constructor(config: AgentConfig = {}) {
    this.state = createInitialState(config.maxIterations ?? 50);
    this.toolRegistry = createToolRegistry();
    this.abortController = new AbortController();
  }

  async run(task: string): Promise<AgentState> {
    console.log('[Agent] Starting task:', task);

    while (this.shouldContinue()) {
      // Planning phase
      await this.planningPhase();

      // Execute phase
      await this.executionPhase();

      // Evaluation phase
      await this.evaluationPhase();

      // Increment iteration counter
      this.state = incrementIterations(this.state);
    }

    console.log('[Agent] Task completed:', this.state.phase);
    return this.state;
  }

  private async planningPhase(): Promise<void> {
    this.state = setPhase(this.state, 'planning');

    const prompt = this.buildPlanningPrompt();
    const response = await this.think(prompt);

    this.state = setThought(this.state, response.thought);
    this.state = setNextAction(this.state, response.nextAction);
  }

  private async executionPhase(): Promise<void> {
    if (!this.state.nextAction) return;

    this.state = setPhase(this.state, 'executing');

    const tool = this.toolRegistry.get(this.state.nextAction);
    if (!tool) {
      this.state = addToolCall(this.state, {
        tool: this.state.nextAction,
        input: {},
        output: { error: 'Unknown tool' },
        success: false,
      });
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const result = await tool.execute(
        this.parseActionParams(this.state.nextAction),
        { tabId: tab?.id ?? 0, signal: this.abortController.signal }
      );

      this.state = addToolCall(this.state, {
        tool: tool.name,
        input: this.parseActionParams(this.state.nextAction),
        output: result,
        success: result.success,
      });
    } catch (error) {
      this.state = addToolCall(this.state, {
        tool: tool.name,
        input: this.parseActionParams(this.state.nextAction),
        output: { error: error instanceof Error ? error.message : 'Unknown error' },
        success: false,
      });
    }
  }

  private async evaluationPhase(): Promise<void> {
    this.state = setPhase(this.state, 'evaluating');

    // Check if task is complete
    const prompt = this.buildEvaluationPrompt();
    const response = await this.think(prompt);

    if (response.nextAction === 'complete') {
      this.state = completeTask(this.state, response.thought);
    } else if (response.nextAction === 'fail') {
      this.state = failTask(this.state, response.thought);
    }
  }

  private shouldContinue(): boolean {
    if (this.state.phase === 'completed' || this.state.phase === 'failed') {
      return false;
    }
    if (this.state.iterations >= this.state.maxIterations) {
      this.state = failTask(this.state, 'Max iterations reached');
      return false;
    }
    return true;
  }

  private async think(prompt: string): Promise<{
    thought: string;
    nextAction: string;
    actionParams?: Record<string, unknown>;
  }> {
    try {
      const response = await ChatService.chat([
        { role: 'user', content: prompt },
      ], { signal: this.abortController.signal });

      return this.parseLLMResponse(response);
    } catch (error) {
      return {
        thought: 'Error in thinking',
        nextAction: 'fail',
        actionParams: {},
      };
    }
  }

  private buildPlanningPrompt(): string {
    return `
You are BrowserCopilot Agent. Your task: "${this.state.task}"

Current state:
- Iterations: ${this.state.iterations}/${this.state.maxIterations}
- Previous tool calls: ${this.state.toolCalls.length}

Available tools:
${Array.from(this.toolRegistry.values()).map(t => `- ${t.name}: ${t.description}`).join('\n')}

Think about what to do next. Return your thought and the next tool to call.

Response format:
{
  "thought": "What you're thinking and why",
  "nextAction": "tool_name or 'complete' or 'fail'",
  "actionParams": {}
}
`;
  }

  private buildEvaluationPrompt(): string {
    return `
You are BrowserCopilot Agent. Task: "${this.state.task}"

Recent tool calls:
${this.state.toolCalls.slice(-5).map(c => `- ${c.tool}: ${c.success ? 'success' : 'failed'}`).join('\n')}

Based on the results, should you:
1. Continue with another tool call (specify which)
2. Complete the task (specify what was accomplished)
3. Fail the task (explain why it can't be completed)

Response format:
{
  "thought": "Your evaluation",
  "nextAction": "tool_name, 'complete', or 'fail'",
  "actionParams": {}
}
`;
  }

  private parseLLMResponse(response: string): {
    thought: string;
    nextAction: string;
    actionParams: Record<string, unknown>;
  } {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback parsing
      return {
        thought: response,
        nextAction: 'fail',
        actionParams: {},
      };
    } catch {
      return {
        thought: response,
        nextAction: 'fail',
        actionParams: {},
      };
    }
  }

  private parseActionParams(action: string): Record<string, unknown> {
    // This would parse params from the state based on the action
    // For now, return empty - params come from tool definitions
    return {};
  }

  getState(): AgentState {
    return this.state;
  }

  stop(): void {
    this.abortController.abort();
  }
}
```

**Step 4: Run test**

```bash
npm test -- tests/background/agent-core.test.ts
Expected: PASS (with mocked dependencies)
```

**Step 5: Commit**

```bash
git add src/background/agent-core.ts tests/background/agent-core.test.ts
git commit -m "feat(agent): implement core agent execution loop"
```

---

### Task 10: Integrate Agent into Background Service Worker

**Files:**
- Modify: `src/background/index.ts`
- Create: `tests/background/index.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Background Service Worker', () => {
  it('should handle agent task message', async () => {
    // Mock message listener
    const messages: unknown[] = [];

    // This would test the message routing
  });
});
```

**Step 2: Implement message routing**

```typescript
// src/background/index.ts
import { AgentCore } from './agent-core';
import type { AgentState } from '../lib/agent/types';

// Active agent instances per tab
const activeAgents = new Map<number, AgentCore>();

// Handle messages from sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, task } = message as { action?: string; task?: string };

  if (action === 'start_agent_task' && task) {
    (async () => {
      try {
        const tab = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tab[0]?.id || 0;

        // Create new agent instance
        const agent = new AgentCore();
        activeAgents.set(tabId, agent);

        // Stream updates back to sidepanel
        const updateInterval = setInterval(() => {
          chrome.runtime.sendMessage({
            action: 'agent_state_update',
            state: agent.getState(),
          });
        }, 500);

        // Run agent
        const finalState = await agent.run(task);

        // Send final state
        chrome.runtime.sendMessage({
          action: 'agent_state_update',
          state: finalState,
        });

        // Cleanup
        clearInterval(updateInterval);
        activeAgents.delete(tabId);

        sendResponse({ success: true, state: finalState });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Agent failed',
        });
      }
    })();

    return true; // Async response
  }

  if (action === 'stop_agent_task') {
    const tab = await chrome.tabs.query({ active: true, currentWindow: true });
    const agent = activeAgents.get(tab[0]?.id || 0);

    if (agent) {
      agent.stop();
      activeAgents.delete(tab[0]?.id || 0);
    }

    sendResponse({ success: true });
    return false;
  }

  // Tool execution requests from sidepanel
  if (action === 'execute_tool') {
    const { toolName, params } = message as {
      toolName: string;
      params: Record<string, unknown>;
    };

    (async () => {
      try {
        const executor = getToolExecutor(toolName);
        const result = await executor.execute(params, {
          tabId: sender.tab?.id || 0,
          signal: new AbortSignal(),
        });

        sendResponse({ success: true, result });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Tool execution failed',
        });
      }
    })();

    return true;
  }
});

function getToolExecutor(name: string) {
  // This would get the appropriate executor from registry
  // Implementation details in tool executors
  return {
    execute: async (params: Record<string, unknown>) => ({ success: true, data: params }),
  };
}

console.log('BrowserCopilot Background Service Worker started');
```

**Step 3: Run build test**

```bash
npm run build
Expected: SUCCESS
```

**Step 4: Commit**

```bash
git add src/background/index.ts tests/background/index.test.ts
git commit -m "feat(background): integrate agent core into service worker"
```

---

## Phase 5: SidePanel UI Updates

### Task 11: Update ChatService for Agent Mode

**Files:**
- Modify: `src/lib/services/chat-service.ts`

**Step 1: Update chat service**

```typescript
// src/lib/services/chat-service.ts
import { streamText, generateText } from 'ai';
import type { ChatMessage, ChatOptions } from '../types/chat';
import type { ProviderId } from '../types/provider';
import { createProviderInstance } from '../providers';
import { ProviderStore } from '../storage/provider-store';
import { detectIntent, type IntentResult } from '../agent/intent-detector';

export interface AgentMessage {
  type: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'agent_update';
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: unknown;
  }>;
  toolResults?: Array<{
    id: string;
    name: string;
    output: unknown;
    success: boolean;
  }>;
  agentState?: unknown;
}

export class ChatService {
  static async *streamChat(
    messages: ChatMessage[],
    options: ChatOptions & { providerId?: ProviderId; model?: string } = {}
  ): AsyncGenerator<string, void, unknown> {
    // ... existing implementation for regular chat
  }

  static async detectAgentMode(message: string): Promise<IntentResult> {
    return await detectIntent(message);
  }

  static async runAgent(
    task: string,
    onStateUpdate: (state: unknown) => void
  ): Promise<unknown> {
    // This would call the background agent via message passing
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'start_agent_task',
        task,
      }, (response) => {
        if (response?.success) {
          resolve(response.state);
        } else {
          reject(new Error(response?.error || 'Agent failed'));
        }
      });
    });
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/services/chat-service.ts
git commit -m "feat(chat): add agent mode detection and execution"
```

---

### Task 12: Update App Component with Agent UI

**Files:**
- Modify: `src/sidepanel/App.tsx`
- Create: `src/sidepanel/components/AgentExecutionView.tsx`

**Step 1: Add Agent Execution View component**

```typescript
// src/sidepanel/components/AgentExecutionView.tsx
import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, ChevronDown, ChevronUp, Copy, ExternalLink } from 'lucide-react';

interface ToolCall {
  id: string;
  tool: string;
  input: unknown;
  output: unknown;
  timestamp: number;
  success: boolean;
}

interface AgentState {
  phase: 'planning' | 'executing' | 'evaluating' | 'completed' | 'failed';
  iterations: number;
  toolCalls: ToolCall[];
  currentThought?: string;
  finalResult?: unknown;
  error?: string;
}

interface AgentExecutionViewProps {
  task: string;
  onStop: () => void;
}

export const AgentExecutionView: React.FC<AgentExecutionViewProps> = ({ task, onStop }) => {
  const [state, setState] = useState<AgentState | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    // Subscribe to agent state updates
    const listener = (message: unknown) => {
      const msg = message as { action?: string; state?: AgentState };
      if (msg.action === 'agent_state_update' && msg.state) {
        setState(msg.state);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  if (!state) {
    return (
      <div className="p-4 text-center text-gray-500">
        🤖 正在启动 Agent...
      </div>
    );
  }

  const phaseLabels: Record<string, string> = {
    planning: '📋 规划中',
    executing: '⚙️ 执行中',
    evaluating: '💭 评估中',
    completed: '✅ 已完成',
    failed: '❌ 失败',
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <span className="font-medium">{phaseLabels[state.phase]}</span>
        </div>
        <button
          onClick={onStop}
          className="p-2 text-red-500 hover:bg-red-100 rounded-lg"
          title="停止执行"
        >
          <Square className="w-5 h-5" />
        </button>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>执行进度</span>
          <span>{state.iterations} 次迭代</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(state.iterations * 5, 100)}%` }}
          />
        </div>
      </div>

      {/* Current thought */}
      {state.currentThought && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            💭 {state.currentThought}
          </span>
        </div>
      )}

      {/* Tool calls */}
      {state.toolCalls.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            工具调用历史 ({state.toolCalls.length})
          </button>

          {expanded && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {state.toolCalls.map((call, index) => (
                <div
                  key={call.id}
                  className={`p-2 rounded-lg text-sm ${
                    call.success
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{call.success ? '✅' : '❌'}</span>
                    <span className="font-medium">{call.tool}</span>
                    <span className="text-gray-500 text-xs">
                      {new Date(call.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {call.success && call.output && (
                    <div className="mt-1 text-gray-600 dark:text-gray-400 text-xs">
                      {JSON.stringify(call.output).slice(0, 100)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Final result */}
      {state.phase === 'completed' && state.finalResult && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">
            🎉 任务完成
          </h4>
          <pre className="text-xs overflow-auto max-h-48">
            {JSON.stringify(state.finalResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Error */}
      {state.phase === 'failed' && state.error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">
            ❌ 任务失败
          </h4>
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        </div>
      )}
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/sidepanel/components/AgentExecutionView.tsx
git commit -m "feat(ui): add agent execution view component"
```

---

## Phase 6: Testing & Integration

### Task 13: Integration Testing

**Files:**
- Create: `tests/integration/agent-integration.test.ts`

**Step 1: Write integration test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Agent Integration', () => {
  it('should complete simple screenshot task', async () => {
    // This would be an end-to-end test
    // Requires Chrome extension loaded and automation API
  });

  it('should handle script installation', async () => {
    // Test AutoMonkey integration
  });
});
```

**Step 2: Commit**

```bash
git add tests/integration/
git commit -m "test: add integration tests"
```

---

## Summary

This plan implements the BrowserCopilot Agent integration in 13 bite-sized tasks:

1. **Project Structure** - Create unified directory structure
2. **Vite Config** - Update build configuration
3. **Agent State** - Implement state management
4. **Intent Detector** - Auto-detect agent vs chat mode
5. **Tool Registry** - Define tool interfaces
6. **Screenshot Tools** - Integrate SnapChrome functionality
7. **DOM Tools** - Implement page extraction
8. **UserScript Tools** - Integrate AutoMonkey
9. **Agent Core** - Implement execution loop
10. **Background SW** - Wire up message routing
11. **ChatService** - Add agent support
12. **UI Components** - Add execution view
13. **Testing** - Integration tests

---

**Plan complete and saved to `docs/plans/2026-02-05-agent-integration.md`**

Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
