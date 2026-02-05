/**
 * Chrome Extension API Mock for Testing
 * This file provides a mock implementation of chrome.storage for testing purposes.
 */

export const chrome = {
  storage: {
    local: {
      get: async (_keys: string | string[] | null | Record<string, unknown>): Promise<Record<string, unknown>> => {
        // Mock implementation - in real tests this will be replaced by vi.mock
        return {};
      },
      set: async (_items: Record<string, unknown>): Promise<void> => {
        // Mock implementation
      },
      remove: async (_keys: string | string[]): Promise<void> => {
        // Mock implementation
      },
      clear: async (): Promise<void> => {
        // Mock implementation
      },
    },
  },
};
