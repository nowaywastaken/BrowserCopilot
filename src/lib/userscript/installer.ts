/**
 * UserScript Installer
 * Installs Tampermonkey/GreaseMonkey scripts
 */

import { parseScriptMetadata, validateScriptCode, type UserScriptInfo } from './manager';

/**
 * Script installation options
 */
export interface InstallOptions {
  code: string;
  matches?: string[];
  runAt?: 'document-start' | 'document-body' | 'document-end' | 'document-idle';
}

/**
 * Installation result
 */
export interface InstallResult {
  success: boolean;
  scriptId?: string;
  script?: UserScriptInfo;
  error?: string;
}

/**
 * Install a user script
 * @param options - Installation options
 * @returns Installation result
 */
export async function installUserScript(options: InstallOptions): Promise<InstallResult> {
  const { code, matches, runAt } = options;

  // Validate script code
  const validation = validateScriptCode(code);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  // Parse metadata
  const metadata = parseScriptMetadata(code);

  return new Promise((resolve) => {
    try {
      chrome.userScripts.register(
        {
          code,
          matches: matches || metadata.matchPatterns || ['<all_urls>'],
          runAt: runAt || metadata.runAt || 'document-idle',
          grants: metadata.grants,
        },
        () => {
          // Get the newly registered script
          chrome.userScripts.getScripts((scripts) => {
            const installedScript = scripts.find((s) => s.name === metadata.name);
            if (installedScript) {
              resolve({
                success: true,
                scriptId: installedScript.id,
                script: {
                  id: installedScript.id,
                  name: installedScript.name,
                  enabled: true,
                  matches: [],
                  permissions: [],
                  createdAt: 0,
                },
              });
            } else {
              resolve({
                success: true,
                scriptId: scripts[scripts.length - 1]?.id,
              });
            }
          });
        }
      );
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install script',
      });
    }
  });
}

/**
 * Update an existing user script
 * @param scriptId - The ID of the script to update
 * @param options - Update options
 * @returns Update result
 */
export async function updateUserScript(
  scriptId: string,
  options: Partial<InstallOptions>
): Promise<InstallResult> {
  return new Promise((resolve) => {
    try {
      const updateOptions = {
        ids: [scriptId],
        code: options.code,
        matches: options.matches,
        runAt: options.runAt,
      };

      if (options.code) updateOptions.code = options.code;
      if (options.matches) updateOptions.matches = options.matches;
      if (options.runAt) updateOptions.runAt = options.runAt;

      chrome.userScripts.update(updateOptions, () => {
        resolve({
          success: true,
          scriptId,
        });
      });
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update script',
      });
    }
  });
}

/**
 * Quick install script with minimal options
 * @param code - The script code to install
 * @returns Installation result
 */
export async function quickInstall(code: string): Promise<InstallResult> {
  return installUserScript({
    code,
    matches: ['<all_urls>'],
    runAt: 'document-idle',
  });
}

/**
 * Template for creating a new user script
 * @param name - Script name
 * @param description - Script description
 * @param matchPattern - URL match pattern
 * @returns Template script code
 */
export function createScriptTemplate(
  name: string,
  description: string,
  matchPattern: string = '*://*.example.com/*'
): string {
  return `// ==UserScript==
// @name        ${name}
// @namespace   http://tampermonkey.net/
// @version     1.0
// @description ${description}
// @author      User
// @match       ${matchPattern}
// @grant       none
// @run-at      document-idle
// ==/UserScript==

(function() {
  'use strict';

  // Your code here

})();
`;
}
