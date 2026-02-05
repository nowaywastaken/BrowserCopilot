/**
 * UserScript Manager - AutoMonkey Integration
 *
 * Lists installed Tampermonkey scripts by querying AutoMonkey's IndexedDB storage.
 * Uses chrome.runtime.sendMessage to communicate with AutoMonkey's background service worker.
 */

import { AUTOMONKEY_EXTENSION_ID } from './constants';

export interface ScriptInfo {
  id: string;
  name: string;
  namespace?: string;
  version?: string;
  enabled: boolean;
  fileUrl?: string;
  description?: string;
  author?: string;
  matches?: string[];
}

export interface ListResult {
  success: boolean;
  scripts?: ScriptInfo[];
  error?: string;
}

/**
 * Lists all installed user scripts by querying AutoMonkey's IndexedDB.
 *
 * @returns Promise resolving to a ListResult
 */
export async function listUserScripts(): Promise<ListResult> {
  try {
    const response = await chrome.runtime.sendMessage(
      AUTOMONKEY_EXTENSION_ID,
      {
        action: 'get_all_scripts',
      }
    );

    if (response?.success) {
      return {
        success: true,
        scripts: response.scripts || [],
      };
    }

    return {
      success: false,
      error: response?.error || 'Failed to list scripts',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to communicate with AutoMonkey: ${errorMessage}`,
    };
  }
}
