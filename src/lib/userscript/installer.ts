/**
 * UserScript Installer - AutoMonkey Integration
 *
 * Installs Tampermonkey scripts using AutoMonkey's install dialog.
 * Uses chrome.runtime.sendMessage to communicate with AutoMonkey's background service worker.
 */

import { AUTOMONKEY_EXTENSION_ID } from './constants';

export interface InstallResult {
  success: boolean;
  scriptId?: string;
  error?: string;
}

/**
 * Installs a user script by sending the code to AutoMonkey's install dialog.
 *
 * @param code - The raw JavaScript code of the Tampermonkey script
 * @returns Promise resolving to an InstallResult
 */
export async function installUserScript(code: string): Promise<InstallResult> {
  if (!code || typeof code !== 'string') {
    return {
      success: false,
      error: 'Invalid script code: must be a non-empty string',
    };
  }

  try {
    const response = await chrome.runtime.sendMessage(
      AUTOMONKEY_EXTENSION_ID,
      {
        action: 'open_install_dialog',
        code,
      }
    );

    if (response?.success) {
      return {
        success: true,
        scriptId: response.scriptId,
      };
    }

    return {
      success: false,
      error: response?.error || 'Failed to install script',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to communicate with AutoMonkey: ${errorMessage}`,
    };
  }
}
