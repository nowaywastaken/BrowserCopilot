/**
 * BrowserCopilot Content Script
 * Handles DOM extraction and other page interaction for the browser agent
 */

console.log('[BrowserCopilot] Content script loaded');

/**
 * Interface for DOM capture request from background/panel
 */
interface DOMCaptureRequest {
  type: 'captureDOM';
  selector?: string;
  includeAttributes?: boolean;
  maxDepth?: number;
}

/**
 * Interface for DOM capture response to be sent back
 */
interface DOMCaptureResponse {
  success: boolean;
  html?: string;
  text?: string;
  metadata?: {
    url: string;
    title: string;
    viewport: {
      width: number;
      height: number;
    };
  };
  error?: string;
}

/**
 * Extracts attributes from an element based on options
 *
 * @param element - The DOM element to extract attributes from
 * @returns Object containing selected attributes
 */
function extractAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};

  // Always include important attributes
  const importantAttrs = ['id', 'class', 'href', 'src', 'alt', 'title', 'name', 'type', 'role'];

  for (const attr of importantAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      attrs[attr] = value;
    }
  }

  return attrs;
}

/**
 * Sanitizes HTML string to remove potentially dangerous content
 * Uses DOMParser for safer parsing instead of regex
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string
 */
function sanitizeHTML(html: string): string {
  // Use DOMParser to safely extract text content
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove all script elements
  doc.querySelectorAll('script').forEach(el => el.remove());

  // Remove event handlers from all elements
  doc.querySelectorAll('*').forEach(el => {
    const eventAttributes = Array.from(el.attributes)
      .filter(attr => attr.name.startsWith('on'));
    eventAttributes.forEach(attr => el.removeAttribute(attr.name));
  });

  // Remove dangerous attributes
  const dangerousAttrs = ['href', 'src', 'action', 'formaction'];
  doc.querySelectorAll('*').forEach(el => {
    dangerousAttrs.forEach(attr => {
      if (attr === 'href' || attr === 'src') {
        const value = el.getAttribute(attr);
        if (value && (value.startsWith('javascript:') || value.startsWith('data:'))) {
          el.removeAttribute(attr);
        }
      } else {
        el.removeAttribute(attr);
      }
    });
  });

  return doc.body.innerHTML;
}

/**
 * Traverses the DOM tree and extracts structure with optional depth limiting
 *
 * @param element - Root element to traverse
 * @param maxDepth - Maximum depth to traverse (undefined = unlimited)
 * @param includeAttrs - Whether to include attributes
 * @param currentDepth - Current depth (internal use)
 * @returns Simplified DOM representation
 */
function traverseDOM(
  element: Element,
  maxDepth: number | undefined,
  includeAttrs: boolean,
  currentDepth: number = 0
): object {
  // Check depth limit
  if (maxDepth !== undefined && currentDepth >= maxDepth) {
    return { text: element.textContent || '' };
  }

  const result: Record<string, unknown> = {
    tagName: element.tagName.toLowerCase(),
  };

  // Include attributes if requested
  if (includeAttrs) {
    result.attributes = extractAttributes(element);
  }

  // Get direct text content (not nested)
  const directText = Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent || '')
    .join('')
    .trim();

  // Process child elements (not text nodes)
  const childElements = Array.from(element.children);

  if (childElements.length > 0) {
    // Has child elements
    const children: object[] = [];
    for (const child of childElements) {
      children.push(traverseDOM(child, maxDepth, includeAttrs, currentDepth + 1));
    }
    result.children = children;

    // Also provide consolidated text
    result.text = element.textContent?.trim() || '';
  } else if (directText) {
    // Leaf node with text
    result.text = directText;
  }

  return result;
}

/**
 * Extracts text content from an element
 *
 * @param element - The DOM element to extract text from
 * @returns Extracted text content
 */
function extractTextContent(element: Element): string {
  // Get text content but clean up whitespace
  let text = element.textContent || '';

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Extracts HTML from an element
 *
 * @param element - The DOM element to extract HTML from
 * @param includeAttrs - Whether to include attributes
 * @returns Extracted HTML string
 */
function extractHTML(element: Element, includeAttrs: boolean): string {
  if (includeAttrs) {
    return element.outerHTML;
  }
  return element.innerHTML;
}

/**
 * Handles DOM capture requests
 *
 * @param request - The capture request
 * @param _sender - Information about the message sender (unused)
 * @param sendResponse - Function to send response back
 */
function handleDOMCapture(
  request: DOMCaptureRequest,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: DOMCaptureResponse) => void
): void {
  try {
    let targetElement: Element;

    if (request.selector) {
      // Extract specific element by selector
      const foundElement = document.querySelector(request.selector);
      if (!foundElement) {
        sendResponse({
          success: false,
          error: `Element not found for selector: ${request.selector}`,
        });
        return;
      }
      targetElement = foundElement;
    } else {
      // Use full document
      targetElement = document.documentElement;
    }

    // Extract data
    const html = extractHTML(targetElement, request.includeAttributes || false);
    const sanitizedHTML = sanitizeHTML(html);
    const text = extractTextContent(targetElement);

    // Get metadata
    const metadata = {
      url: window.location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    // If maxDepth is specified, traverse DOM with depth limiting
    // (structuredData is computed but returned via HTML/text for now)
    if (request.maxDepth !== undefined) {
      const structuredData = traverseDOM(
        targetElement,
        request.maxDepth,
        request.includeAttributes || false
      );
      // structuredData can be used for future structured response format
      console.log('[BrowserCopilot] DOM traversal completed:', structuredData);
    }

    sendResponse({
      success: true,
      html: sanitizedHTML,
      text,
      metadata,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[BrowserCopilot] DOM capture error:', error);
    sendResponse({
      success: false,
      error: `DOM capture failed: ${errorMessage}`,
    });
  }
}

// Register message listener
(chrome.runtime.onMessage as any).addListener((
  message: DOMCaptureRequest,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: DOMCaptureResponse) => void
) => {
  if (message.type === 'captureDOM') {
    handleDOMCapture(message, _sender, sendResponse);
    // Return true to indicate we'll send response asynchronously
    return true;
  }
});

console.log('[BrowserCopilot] Content script ready for DOM capture');
