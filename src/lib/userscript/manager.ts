/**
 * UserScript Manager
 * Manages user scripts including listing, enabling, disabling, and removing scripts
 */

/**
 * Script metadata extracted from Tampermonkey header
 */
export interface ScriptMetadata {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  homepage?: string;
  matchPatterns?: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  grants?: string[];
  runAt?: 'document-start' | 'document-body' | 'document-end' | 'document-idle';
}

/**
 * UserScript information
 */
export interface UserScriptInfo {
  id: string;
  name: string;
  enabled: boolean;
  version?: string;
  description?: string;
  matches: string[];
  permissions: string[];
  runAt?: string;
  lastUpdated?: number;
  createdAt: number;
}

/**
 * List installed user scripts
 * @returns List of installed scripts with metadata
 */
export async function listUserScripts(): Promise<{
  success: boolean;
  scripts?: UserScriptInfo[];
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      chrome.userScripts.getScripts((scripts) => {
        const scriptInfos: UserScriptInfo[] = scripts.map((script) => ({
          id: script.id,
          name: script.name,
          enabled: true,
          matches: [],
          permissions: [],
          createdAt: 0,
        }));
        resolve({
          success: true,
          scripts: scriptInfos,
        });
      });
    } catch (error) {
      resolve({
        success: false,
        scripts: [],
        error: error instanceof Error ? error.message : 'Failed to list scripts',
      });
    }
  });
}

/**
 * Enable a user script
 * @param scriptId - The ID of the script to enable
 * @returns Success status
 */
export async function enableScript(scriptId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      chrome.userScripts.update(
        { ids: [scriptId], enabled: true } as chrome.userScripts.UserScriptOptions & { ids: string[] },
        () => {
          resolve({ success: true });
        }
      );
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable script',
      });
    }
  });
}

/**
 * Disable a user script
 * @param scriptId - The ID of the script to disable
 * @returns Success status
 */
export async function disableScript(scriptId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      chrome.userScripts.update(
        { ids: [scriptId], enabled: false } as chrome.userScripts.UserScriptOptions & { ids: string[] },
        () => {
          resolve({ success: true });
        }
      );
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable script',
      });
    }
  });
}

/**
 * Remove a user script
 * @param scriptId - The ID of the script to remove
 * @returns Success status
 */
export async function removeScript(scriptId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      chrome.userScripts.unregister({ ids: [scriptId] }, () => {
        resolve({ success: true });
      });
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove script',
      });
    }
  });
}

/**
 * Parse script metadata from code
 * @param code - The script code to parse
 * @returns Parsed metadata
 */
export function parseScriptMetadata(code: string): ScriptMetadata {
  const metadata: ScriptMetadata = {
    name: 'Unnamed Script',
    grants: [],
  };

  // Match @header pattern
  const headerMatch = code.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
  if (headerMatch) {
    const headerContent = headerMatch[1];

    // Parse individual fields
    const parseField = (field: string): string | undefined => {
      const match = headerContent.match(new RegExp(`@${field}\\s+(.+)`));
      return match ? match[1].trim() : undefined;
    };

    const parseMultiField = (field: string): string[] => {
      const regex = new RegExp(`@${field}\\s+(.+)`, 'g');
      const matches = headerContent.match(regex);
      return matches ? matches.map((m) => m.replace(`@${field}`, '').trim()) : [];
    };

    metadata.name = parseField('name') || 'Unnamed Script';
    metadata.version = parseField('version');
    metadata.description = parseField('description');
    metadata.author = parseField('author');
    metadata.homepage = parseField('homepage');
    metadata.matchPatterns = parseMultiField('match');
    metadata.includePatterns = parseMultiField('include');
    metadata.excludePatterns = parseMultiField('exclude');
    metadata.grants = parseMultiField('grant');
    metadata.runAt = parseField('run-at') as ScriptMetadata['runAt'];
  }

  return metadata;
}

/**
 * Validate script code
 * @param code - The script code to validate
 * @returns Validation result
 */
export function validateScriptCode(code: string): {
  valid: boolean;
  error?: string;
} {
  // Check for empty code
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Script code is empty' };
  }

  // Check for UserScript header
  const hasHeader = /\/\/ ==UserScript==/.test(code);
  if (!hasHeader) {
    return { valid: false, error: 'Missing UserScript header (@ ==UserScript ==)' };
  }

  // Check for name in header
  const hasName = /@name\s+/i.test(code);
  if (!hasName) {
    return { valid: false, error: 'Missing @name in script header' };
  }

  // Check for match pattern
  const hasMatch = /@match\s+/i.test(code) || /@include\s+/i.test(code);
  if (!hasMatch) {
    return { valid: false, error: 'Missing @match or @include pattern' };
  }

  return { valid: true };
}
