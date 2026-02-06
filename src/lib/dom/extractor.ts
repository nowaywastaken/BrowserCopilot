/**
 * DOM Extractor Module
 * Uses chrome.tabs.sendMessage to communicate with content script
 * and extract HTML/text content from web pages
 */

export interface DOMCaptureOptions {
  /** CSS selector to extract specific element (optional, defaults to full document) */
  selector?: string;
  /** Whether to include element attributes in the extraction (default: false) */
  includeAttributes?: boolean;
  /** Maximum depth for DOM traversal (default: unlimited) */
  maxDepth?: number;
}

export interface DOMMetadata {
  /** Current page URL */
  url: string;
  /** Current page title */
  title: string;
  /** Viewport dimensions */
  viewport: {
    width: number;
    height: number;
  };
}

export interface DOMData {
  /** HTML content of the extracted element/document */
  html: string;
  /** Text content of the extracted element/document */
  text: string;
  /** Page metadata */
  metadata: DOMMetadata;
}

export interface DOMResult {
  /** Whether the capture was successful */
  success: boolean;
  /** DOM data if successful */
  data?: DOMData;
  /** Error message if capture failed */
  error?: string;
}

/**
 * Captures DOM content from the current active tab
 *
 * @param options - Optional configuration for DOM capture
 * @returns Promise resolving to DOMResult
 */
export async function captureDOM(
  options: DOMCaptureOptions = {}
): Promise<DOMResult> {
  const { selector, includeAttributes = false, maxDepth } = options;

  try {
    // First, get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      return {
        success: false,
        error: 'No active tab found',
      };
    }

    // Send message to content script to capture DOM
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'captureDOM',
      selector,
      includeAttributes,
      maxDepth,
    });

    if (response && response.success) {
      return {
        success: true,
        data: {
          html: response.html,
          text: response.text,
          metadata: {
            url: response.metadata.url,
            title: response.metadata.title,
            viewport: response.metadata.viewport,
          },
        },
      };
    }

    return {
      success: false,
      error: response?.error || 'Failed to capture DOM',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('DOM capture failed:', error);
    return {
      success: false,
      error: `DOM capture failed: ${errorMessage}`,
    };
  }
}

/**
 * Extracts text content from a specific element by selector
 *
 * @param selector - CSS selector for the target element
 * @returns Promise resolving to the text content
 */
export async function extractText(selector: string): Promise<string> {
  const result = await captureDOM({ selector });
  if (result.success && result.data) {
    return result.data.text;
  }
  throw new Error(result.error || 'Failed to extract text');
}

/**
 * Extracts HTML content from a specific element by selector
 *
 * @param selector - CSS selector for the target element
 * @returns Promise resolving to the HTML content
 */
export async function extractHTML(selector: string): Promise<string> {
  const result = await captureDOM({ selector });
  if (result.success && result.data) {
    return result.data.html;
  }
  throw new Error(result.error || 'Failed to extract HTML');
}
