/**
 * Tool Executor Interface and Registry
 * Defines the interface and registry for all browser automation tools
 */

import { ToolDefinition, ToolResult, ToolExecutor, ToolContext } from './types';
import { captureScreenshot } from '../screenshot/capture';
import { captureDOM, type DOMCaptureOptions } from '../dom/extractor';

/**
 * Tool parameter schema
 */
export interface ToolParameterSchema {
  type: string;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

// ============================================================================
// Tool Parameter Types
// ============================================================================

type ScreenshotQuality = 'low' | 'medium' | 'high';

// ============================================================================
// Tool 1: Capture Screenshot
// ============================================================================

const captureScreenshotExecutor: ToolExecutor = {
  name: 'captureScreenshot',
  description: 'Capture a screenshot of the current viewport. Use this when the user wants to see what the page looks like or needs visual analysis.',
  parameters: {
    type: 'object',
    properties: {
      quality: {
        type: 'string',
        description: 'Screenshot quality level: low (faster, smaller), medium (balanced), high (best quality)',
        enum: ['low', 'medium', 'high'],
      },
      returnToUser: {
        type: 'boolean',
        description: 'Whether to return the screenshot data to the user (default: true)',
      },
    },
    required: ['quality'],
  },
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const quality = (params.quality as 'low' | 'medium' | 'high') || 'high';
    const returnToUser = params.returnToUser !== false;

    try {
      const result = await captureScreenshot({ quality, returnToUser });

      if (result.success && result.data) {
        // Return structured result with screenshot data
        return {
          toolName: 'captureScreenshot',
          success: true,
          data: {
            width: result.data.width,
            height: result.data.height,
            devicePixelRatio: result.data.devicePixelRatio,
            hasDataUrl: !!result.data.dataUrl,
          },
          timestamp: Date.now(),
        };
      }

      return {
        toolName: 'captureScreenshot',
        success: false,
        error: result.error || 'Screenshot capture failed',
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'captureScreenshot',
        success: false,
        error: `Screenshot capture failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool 2: Capture DOM
// ============================================================================

const captureDOMExecutor: ToolExecutor = {
  name: 'captureDOM',
  description: 'Extract the DOM structure of the current page or a specific element. Use this to understand page structure, find elements, or extract content.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector to target specific element (e.g., "#main", ".content", "button.login")',
      },
      includeAttributes: {
        type: 'boolean',
        description: 'Whether to include element attributes like id, class, href, etc. (default: false)',
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum depth to traverse the DOM tree. Lower values are faster. (default: unlimited)',
        minimum: 1,
        maximum: 20,
      },
    },
  },
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const options: DOMCaptureOptions = {
      selector: params.selector as string | undefined,
      includeAttributes: params.includeAttributes as boolean | undefined,
      maxDepth: params.maxDepth as number | undefined,
    };

    try {
      const result = await captureDOM(options);

      if (result.success && result.data) {
        return {
          toolName: 'captureDOM',
          success: true,
          data: {
            html: result.data.html,
            text: result.data.text,
            textLength: result.data.text.length,
            metadata: result.data.metadata,
          },
          timestamp: Date.now(),
        };
      }

      return {
        toolName: 'captureDOM',
        success: false,
        error: result.error || 'DOM capture failed',
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'captureDOM',
        success: false,
        error: `DOM capture failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool 3: Capture Page Analysis
// ============================================================================

const capturePageAnalysisExecutor: ToolExecutor = {
  name: 'capturePageAnalysis',
  description: 'Perform comprehensive page analysis including both screenshot and DOM extraction. Use this when you need complete page information for complex tasks.',
  parameters: {
    type: 'object',
    properties: {
      screenshotQuality: {
        type: 'string',
        description: 'Quality level for screenshot capture',
        enum: ['low', 'medium', 'high'],
      },
      domMaxDepth: {
        type: 'number',
        description: 'Maximum depth for DOM tree traversal (1-20)',
        minimum: 1,
        maximum: 20,
      },
      returnToUser: {
        type: 'boolean',
        description: 'Whether to return the screenshot data to the user (default: true)',
      },
    },
  },
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const screenshotQuality = (params.screenshotQuality as 'low' | 'medium' | 'high') || 'high';
    const domMaxDepth = params.domMaxDepth as number | undefined;
    const returnToUser = params.returnToUser !== false;

    try {
      // Capture both screenshot and DOM in parallel
      const [screenshotResult, domResult] = await Promise.all([
        captureScreenshot({ quality: screenshotQuality, returnToUser }),
        captureDOM({ maxDepth: domMaxDepth }),
      ]);

      const hasScreenshot = screenshotResult.success;
      const hasDOM = domResult.success;

      if (!hasScreenshot && !hasDOM) {
        return {
          toolName: 'capturePageAnalysis',
          success: false,
          error: 'Both screenshot and DOM capture failed',
          timestamp: Date.now(),
        };
      }

      return {
        toolName: 'capturePageAnalysis',
        success: hasScreenshot || hasDOM,
        data: {
          screenshot: hasScreenshot ? {
            width: screenshotResult.data?.width,
            height: screenshotResult.data?.height,
            devicePixelRatio: screenshotResult.data?.devicePixelRatio,
            hasDataUrl: !!screenshotResult.data?.dataUrl,
          } : null,
          dom: hasDOM ? {
            textLength: domResult.data?.text.length,
            title: domResult.data?.metadata.title,
            url: domResult.data?.metadata.url,
          } : null,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'capturePageAnalysis',
        success: false,
        error: `Page analysis failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool 4: Get Element Info
// ============================================================================

const getElementInfoExecutor: ToolExecutor = {
  name: 'getElementInfo',
  description: 'Get detailed information about a specific element on the page including its attributes, position, and properties.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector to identify the target element (required)',
      },
    },
    required: ['selector'],
  },
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const selector = params.selector as string;

    if (!selector) {
      return {
        toolName: 'getElementInfo',
        success: false,
        error: 'Selector is required',
        timestamp: Date.now(),
      };
    }

    try {
      // Get element info by executing script in the page context
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;

      if (!tabId) {
        return {
          toolName: 'getElementInfo',
          success: false,
          error: 'No active tab found',
          timestamp: Date.now(),
        };
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel: string) => {
          const element = document.querySelector(sel) as HTMLElement;
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          const rect = element.getBoundingClientRect();
          return {
            success: true,
            data: {
              tagName: element.tagName,
              id: element.id,
              className: element.className,
              textContent: element.textContent?.substring(0, 500) || '',
              innerHTML: element.innerHTML.substring(0, 500),
              href: (element as HTMLAnchorElement).href || null,
              src: (element as HTMLImageElement).src || null,
              visible: rect.width > 0 && rect.height > 0,
              position: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
              attributes: Array.from(element.attributes).reduce((acc, attr) => {
                acc[attr.name] = attr.value;
                return acc;
              }, {} as Record<string, string>),
            },
          };
        },
        args: [selector],
      });

      const scriptResult = results[0]?.result;
      if (scriptResult && scriptResult.success) {
        return {
          toolName: 'getElementInfo',
          success: true,
          data: scriptResult.result,
          timestamp: Date.now(),
        };
      }

      return {
        toolName: 'getElementInfo',
        success: false,
        error: scriptResult?.error || 'Failed to get element info',
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'getElementInfo',
        success: false,
        error: `Get element info failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool 5: Execute Script
// ============================================================================

const executeScriptExecutor: ToolExecutor = {
  name: 'executeScript',
  description: 'Execute arbitrary JavaScript code in the context of the page. Use this for page interactions, data extraction, or automation tasks.',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript code to execute (required). The code runs in the page context.',
      },
    },
    required: ['code'],
  },
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const code = params.code as string;

    if (!code) {
      return {
        toolName: 'executeScript',
        success: false,
        error: 'Code is required',
        timestamp: Date.now(),
      };
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;

      if (!tabId) {
        return {
          toolName: 'executeScript',
          success: false,
          error: 'No active tab found',
          timestamp: Date.now(),
        };
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (scriptCode: string) => {
          try {
            const func = new Function(scriptCode);
            const evalResult = func();
            return {
              success: true,
              output: typeof evalResult === 'object' ? JSON.stringify(evalResult) : String(evalResult),
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Script execution failed',
            };
          }
        },
        args: [code],
      });

      const executionResult = results[0]?.result;
      if (executionResult && executionResult.success) {
        return {
          toolName: 'executeScript',
          success: true,
          data: { output: executionResult.output },
          timestamp: Date.now(),
        };
      }

      return {
        toolName: 'executeScript',
        success: false,
        error: executionResult?.error || 'Script execution failed',
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'executeScript',
        success: false,
        error: `Script execution failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool 6: Get Page Info
// ============================================================================

const getPageInfoExecutor: ToolExecutor = {
  name: 'getPageInfo',
  description: 'Retrieve metadata and information about the current page including URL, title, and viewport dimensions.',
  parameters: {
    type: 'object',
    properties: {},
  },
  async execute(_params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (!activeTab) {
        return {
          toolName: 'getPageInfo',
          success: false,
          error: 'No active tab found',
          timestamp: Date.now(),
        };
      }

      return {
        toolName: 'getPageInfo',
        success: true,
        data: {
          url: activeTab.url,
          title: activeTab.title,
          favIconUrl: activeTab.favIconUrl,
          incognito: activeTab.incognito,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'getPageInfo',
        success: false,
        error: `Get page info failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool 7: Install User Script
// ============================================================================

const installUserScriptExecutor: ToolExecutor = {
  name: 'installUserScript',
  description: 'Install a Tampermonkey script for the current page. Use this to create custom browser automation scripts.',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Tampermonkey script code to install (required). Must include @name and @match directives.',
      },
    },
    required: ['code'],
  },
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const code = params.code as string;

    if (!code) {
      return {
        toolName: 'installUserScript',
        success: false,
        error: 'Script code is required',
        timestamp: Date.now(),
      };
    }

    try {
      // Use the installUserScript function from userscript module
      const { installUserScript } = await import('../userscript/installer');
      const result = await installUserScript({ code });

      if (result.success) {
        return {
          toolName: 'installUserScript',
          success: true,
          data: {
            scriptId: result.scriptId,
            name: result.script?.name,
          },
          timestamp: Date.now(),
        };
      }

      return {
        toolName: 'installUserScript',
        success: false,
        error: result.error || 'Failed to install script',
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'installUserScript',
        success: false,
        error: `Script installation failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool 8: List User Scripts
// ============================================================================

const listUserScriptsExecutor: ToolExecutor = {
  name: 'listUserScripts',
  description: 'List all installed user scripts for the current page. Returns script names and IDs.',
  parameters: {
    type: 'object',
    properties: {},
  },
  async execute(_params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      const { listUserScripts } = await import('../userscript/manager');
      const result = await listUserScripts();

      if (result.success) {
        return {
          toolName: 'listUserScripts',
          success: true,
          data: {
            scripts: result.scripts?.map((s) => ({
              id: s.id,
              name: s.name,
              enabled: s.enabled,
            })),
            count: result.scripts?.length || 0,
          },
          timestamp: Date.now(),
        };
      }

      return {
        toolName: 'listUserScripts',
        success: false,
        error: result.error || 'Failed to list scripts',
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'listUserScripts',
        success: false,
        error: `List scripts failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool 9: Navigate
// ============================================================================

const navigateExecutor: ToolExecutor = {
  name: 'navigate',
  description: 'Navigate to a specific URL. Use this to open new pages or navigate within the current tab.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to navigate to (required). Can be a full URL or relative path.',
      },
    },
    required: ['url'],
  },
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const url = params.url as string;

    if (!url) {
      return {
        toolName: 'navigate',
        success: false,
        error: 'URL is required',
        timestamp: Date.now(),
      };
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (activeTab?.id) {
        await chrome.tabs.update(activeTab.id, { url });
      } else {
        await chrome.tabs.create({ url });
      }

      return {
        toolName: 'navigate',
        success: true,
        data: { url },
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'navigate',
        success: false,
        error: `Navigation failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool 10: Click Element
// ============================================================================

const clickElementExecutor: ToolExecutor = {
  name: 'clickElement',
  description: 'Click on a specific element on the page identified by a CSS selector.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector to identify the element to click (required)',
      },
      button: {
        type: 'string',
        description: 'Mouse button: left, middle, right (default: left)',
        enum: ['left', 'middle', 'right'],
      },
      clickCount: {
        type: 'number',
        description: 'Number of clicks (1 for single click, 2 for double click)',
        minimum: 1,
        maximum: 2,
      },
    },
    required: ['selector'],
  },
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const selector = params.selector as string;
    const button = (params.button as string) || 'left';
    const clickCount = (params.clickCount as number) || 1;

    if (!selector) {
      return {
        toolName: 'clickElement',
        success: false,
        error: 'Selector is required',
        timestamp: Date.now(),
      };
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;

      if (!tabId) {
        return {
          toolName: 'clickElement',
          success: false,
          error: 'No active tab found',
          timestamp: Date.now(),
        };
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel: string, btn: string, count: number) => {
          const element = document.querySelector(sel) as HTMLElement;
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          const buttonMap: Record<string, number> = { left: 0, middle: 1, right: 2 };
          const mouseEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            button: buttonMap[btn] || 0,
            detail: count,
          });

          if (count === 2) {
            element.dispatchEvent(new MouseEvent('dblclick', {
              bubbles: true,
              cancelable: true,
              view: window,
              button: buttonMap[btn] || 0,
            }));
          } else {
            element.dispatchEvent(mouseEvent);
          }

          return { success: true };
        },
        args: [selector, button, clickCount],
      });

      const result = results[0]?.result;
      if (result && result.success) {
        return {
          toolName: 'clickElement',
          success: true,
          data: { selector, clicked: true },
          timestamp: Date.now(),
        };
      }

      return {
        toolName: 'clickElement',
        success: false,
        error: result?.error || 'Click failed',
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'clickElement',
        success: false,
        error: `Click failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool 11: Fill Form
// ============================================================================

const fillFormExecutor: ToolExecutor = {
  name: 'fillForm',
  description: 'Fill in a form input or textarea with the specified value.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the input/textarea element (required)',
      },
      value: {
        type: 'string',
        description: 'Value to fill into the form field (required)',
      },
    },
    required: ['selector', 'value'],
  },
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const selector = params.selector as string;
    const value = params.value as string;

    if (!selector || value === undefined) {
      return {
        toolName: 'fillForm',
        success: false,
        error: 'Selector and value are required',
        timestamp: Date.now(),
      };
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;

      if (!tabId) {
        return {
          toolName: 'fillForm',
          success: false,
          error: 'No active tab found',
          timestamp: Date.now(),
        };
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel: string, val: string) => {
          const element = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement;
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          // Focus and set value
          element.focus();
          element.value = val;

          // Dispatch input and change events
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));

          return { success: true };
        },
        args: [selector, value],
      });

      const result = results[0]?.result;
      if (result && result.success) {
        return {
          toolName: 'fillForm',
          success: true,
          data: { selector, filled: true },
          timestamp: Date.now(),
        };
      }

      return {
        toolName: 'fillForm',
        success: false,
        error: result?.error || 'Fill form failed',
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'fillForm',
        success: false,
        error: `Fill form failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool 12: Scroll
// ============================================================================

const scrollExecutor: ToolExecutor = {
  name: 'scroll',
  description: 'Scroll the page or a specific element. Positive Y scrolls down, negative Y scrolls up.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for element to scroll (optional, scrolls window if not provided)',
      },
      x: {
        type: 'number',
        description: 'Horizontal scroll offset in pixels (default: 0)',
      },
      y: {
        type: 'number',
        description: 'Vertical scroll offset in pixels (required if selector not provided)',
      },
      behavior: {
        type: 'string',
        description: 'Scroll behavior: smooth or auto (default: auto)',
        enum: ['auto', 'smooth'],
      },
    },
  },
  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const selector = params.selector as string | undefined;
    const x = (params.x as number) || 0;
    const y = (params.y as number) || 0;
    const behavior = (params.behavior as string) || 'auto';

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;

      if (!tabId) {
        return {
          toolName: 'scroll',
          success: false,
          error: 'No active tab found',
          timestamp: Date.now(),
        };
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel: string | undefined, dx: number, dy: number, beh: string) => {
          const target = sel
            ? document.querySelector(sel)
            : window;

          if (!target) {
            return { success: false, error: 'Scroll target not found' };
          }

          if ('scrollBy' in target) {
            (target as Window).scrollBy({
              left: dx,
              top: dy,
              behavior: beh as ScrollBehavior,
            });
          }

          return { success: true };
        },
        args: [selector, x, y, behavior],
      });

      const result = results[0]?.result;
      if (result && result.success) {
        return {
          toolName: 'scroll',
          success: true,
          data: { selector: selector || 'window', scrolled: true },
          timestamp: Date.now(),
        };
      }

      return {
        toolName: 'scroll',
        success: false,
        error: result?.error || 'Scroll failed',
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolName: 'scroll',
        success: false,
        error: `Scroll failed: ${errorMessage}`,
        timestamp: Date.now(),
      };
    }
  },
};

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * All available tool executors
 */
const ALL_TOOLS: ToolExecutor[] = [
  captureScreenshotExecutor,
  captureDOMExecutor,
  capturePageAnalysisExecutor,
  getElementInfoExecutor,
  executeScriptExecutor,
  getPageInfoExecutor,
  installUserScriptExecutor,
  listUserScriptsExecutor,
  navigateExecutor,
  clickElementExecutor,
  fillFormExecutor,
  scrollExecutor,
];

/**
 * Create a new tool registry containing all available tools
 * @returns Map of tool names to ToolExecutor instances
 */
export function createToolRegistry(): Map<string, ToolExecutor> {
  const registry = new Map<string, ToolExecutor>();
  for (const tool of ALL_TOOLS) {
    registry.set(tool.name, tool);
  }
  return registry;
}

/**
 * Get tool definitions for agent integration
 * @param registry The tool registry to extract definitions from
 * @returns Array of ToolDefinition objects
 */
export function getToolDefinitions(registry: Map<string, ToolExecutor>): ToolDefinition[] {
  const definitions: ToolDefinition[] = [];
  for (const [, executor] of registry) {
    definitions.push({
      name: executor.name,
      description: executor.description,
      parameters: executor.parameters,
    });
  }
  return definitions;
}

// Re-export types
export type { ToolContext, ToolResult, ToolDefinition } from './types';
export type { ToolExecutor } from './types';

// ============================================================================
// Export all tools and types
// ============================================================================

export type {
  ScreenshotQuality,
};

export {
  captureScreenshotExecutor,
  captureDOMExecutor,
  capturePageAnalysisExecutor,
  getElementInfoExecutor,
  executeScriptExecutor,
  getPageInfoExecutor,
  installUserScriptExecutor,
  listUserScriptsExecutor,
  navigateExecutor,
  clickElementExecutor,
  fillFormExecutor,
  scrollExecutor,
  ALL_TOOLS,
};
