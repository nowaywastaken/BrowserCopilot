/**
 * Chrome Extension API Type Declarations
 * Augments the Chrome types with userScripts API
 */

declare namespace chrome.userScripts {
  interface UserScriptOptions {
    id?: string;
    matches?: string[];
    runAt?: 'document-start' | 'document-body' | 'document-end' | 'document-idle';
    grants?: string[];
    meta?: {
      name?: string;
      version?: string;
      description?: string;
      author?: string;
      homepage?: string;
      runAt?: string;
    };
  }

  interface RegisteredUserScript {
    id: string;
    path: string;
    url: string;
    name: string;
    origin: number;
  }

  function register(
    scripts: UserScriptOptions & { code: string },
    callback?: () => void
  ): void;
  function register(
    scripts: UserScriptOptions[],
    callback?: () => void
  ): void;

  function update(
    scripts: UserScriptOptions & { ids: string[] },
    callback?: () => void
  ): void;

  function unregister(
    scripts: { ids: string[] },
    callback?: () => void
  ): void;

  function getScripts(
    callback: (scripts: RegisteredUserScript[]) => void
  ): void;
}

// Augment Window interface
declare global {
  interface Window {
    chrome: {
      tabs: {
        query: (options: {
          active?: boolean;
          currentWindow?: boolean;
        }) => Promise<
          Array<{
            id?: number;
            url?: string;
            title?: string;
            favIconUrl?: string;
            incognito?: boolean;
            active?: boolean;
            windowId?: number;
          }>
        >;
        sendMessage: (
          tabId: number,
          message: Record<string, unknown>
        ) => Promise<Record<string, unknown>>;
        captureVisibleTab: (
          windowId: number,
          options?: { format?: string; quality?: number }
        ) => Promise<string>;
        update: (tabId: number, props: { url?: string }) => Promise<void>;
      };
      scripting: {
        executeScript: (options: {
          target: { tabId: number };
          func: (...args: unknown[]) => unknown;
          args?: unknown[];
        }) => Promise<
          Array<{ result?: unknown; error?: { message: string } }>
        >;
      };
      sidePanel: {
        open: (options: { tabId: number }) => Promise<void>;
      };
      storage: {
        local: {
          get: (
            keys: string | string[] | null | Record<string, unknown>
          ) => Promise<Record<string, unknown>>;
          set: (items: Record<string, unknown>) => Promise<void>;
          remove: (keys: string | string[]) => Promise<void>;
          clear: () => Promise<void>;
        };
      };
      userScripts: typeof chrome.userScripts;
      runtime: typeof chrome.runtime;
    };
  }
}
