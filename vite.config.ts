import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'path';
import fs from 'fs';

// 插件：处理 sidepanel.html 中的脚本引用
function sidepanelPlugin(): Plugin {
  return {
    name: 'sidepanel-handler',
    enforce: 'post',
    writeBundle() {
      const sidepanelPath = path.resolve(__dirname, 'dist/src/sidepanel/sidepanel.html');
      if (fs.existsSync(sidepanelPath)) {
        let content = fs.readFileSync(sidepanelPath, 'utf-8');
        // 修复路径：sidepanel.html在dist/src/sidepanel/目录下
        // 相对于该目录，sidepanel.js在../../，assets在../../assets/
        // 处理绝对路径
        content = content.replace(/src="\/sidepanel\.js"/g, 'src="../../sidepanel.js"');
        content = content.replace(/href="\/assets\//g, 'href="../../assets/');
        // 处理相对路径（如果存在）
        content = content.replace(/src="\.\/sidepanel\.js"/g, 'src="../../sidepanel.js"');
        content = content.replace(/href="\.\/assets\//g, 'href="../../assets/');
        fs.writeFileSync(sidepanelPath, content);
      }
    }
  };
}

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(__dirname, 'src/sidepanel/sidepanel.html'),
        background: path.resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // 根据入口点名称生成固定的文件名
          if (chunkInfo.name === 'sidepanel') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || '';
          if (info.endsWith('.css')) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    sourcemap: mode === 'development',
    minify: mode === 'production' ? 'esbuild' : false,
    target: 'es2020',
  },
  plugins: [
    react(),
    crx({
      manifest: {
        manifest_version: 3,
        name: 'BrowserCopilot - AI Browser Agent',
        version: '2.0.0',
        description: 'AI-powered browser automation with screenshot and user script capabilities',
        side_panel: {
          default_path: 'src/sidepanel/sidepanel.html',
        },
        permissions: ['sidePanel', 'tabs', 'scripting', 'userScripts', 'offscreen', 'storage'],
        host_permissions: ['<all_urls>'],
        background: {
          service_worker: 'src/background/index.ts',
          type: 'module',
        },
        content_scripts: [
          {
            matches: ['<all_urls>'],
            js: ['src/contents/inject.ts'],
            run_at: 'document_idle',
          },
        ],
      },
      contentScripts: {
        injectCss: true,
      },
    }),
    sidepanelPlugin(),
  ],
  optimizeDeps: {
    include: ['react', 'react-dom', 'webextension-polyfill'],
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
}));
