import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
        '**/*.spec.ts',
        '**/*.test.ts',
        'tests/e2e/',
        // Exclude UI components (React components)
        'src/sidepanel/**',
        'src/contents/**',
        // Exclude deprecated/openai.ts (use chat-service instead)
        'src/lib/openai.ts',
        // Exclude complex integration files
        'src/lib/memory.ts',
        'src/lib/storage.ts',
      ],
    },
  },
});