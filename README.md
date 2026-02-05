# Browser Pal - AI 侧边栏助手 Chrome 扩展

基于 React 18+、TypeScript 5+、Vite 5+ 和 CRXJS 构建的 Chrome 扩展，提供强大的 AI 助手功能。

## ✨ 特性

### 🎯 核心功能
- **原生 Chrome SidePanel API** - 集成 Chrome 原生侧边栏，独立渲染，样式零泄漏
- **多提供商 AI 接入** - 支持 OpenAI、Anthropic、OpenRouter 等多种 AI 提供商
- **多模型切换** - 支持 GPT-4、Claude 3.5 Sonnet、Llama 3、Gemini 等多种模型，随时切换适应不同场景需求
- **SSE 流式响应** - 实时流式聊天体验，响应无卡顿
- **本地记忆系统** - 基于 LangChain.js + IndexedDB 的向量检索与 RAG 上下文注入
- **全局快捷键** - `Cmd/Ctrl+Shift+L` 快速打开/关闭侧边栏

### ⚡ 性能优化
- **Apple Silicon 优化** - 针对 M 系列芯片优化，延迟 <100ms
- **60fps 流畅 UI** - 硬件加速动画，流畅滚动体验
- **内存泄漏防护** - 完整的 Stream Reader 自动取消和资源清理
- **Manifest V3 合规** - Service Worker 架构，完整 CSP 配置

### 🎨 用户体验
- **现代 UI 设计** - 深色/浅色模式，响应式布局
- **Markdown 渲染** - 完整的 Markdown 支持，代码高亮，表格渲染
- **消息操作** - 复制、重新生成、编辑、删除消息
- **记忆管理** - 查看、清理记忆系统
- **设置面板** - API Key 配置，模型选择，数据管理

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Chrome 114+
- OpenRouter API Key (从 [openrouter.ai/keys](https://openrouter.ai/keys) 获取)

### 安装步骤

1. **克隆仓库**
```bash
git clone <repository-url>
cd browser-pal
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境**
复制 `.env.example` 文件为 `.env` 并设置你的 OpenRouter API Key：
```
VITE_OPENROUTER_API_KEY=your_api_key_here
```

4. **开发模式运行**
```bash
npm run dev
```

5. **构建生产版本**
```bash
npm run build
```

6. **加载扩展到 Chrome**
   1. 打开 Chrome，进入 `chrome://extensions/`
   2. 开启"开发者模式"
   3. 点击"加载已解压的扩展程序"
   4. 选择 `dist` 目录

## 📁 项目结构

```
browser-pal/
├── src/
│   ├── background/           # Service Worker 后台脚本
│   │   └── index.ts          # 扩展生命周期、快捷键监听
│   ├── sidepanel/            # 侧边栏 UI
│   │   ├── App.tsx          # 主应用组件
│   │   ├── main.tsx         # React 入口点
│   │   ├── components/       # UI 组件
│   │   │   ├── ProviderSelector.tsx  # 提供商选择器
│   │   │   └── ModelSelector.tsx     # 模型选择器
│   │   ├── globals.css      # 全局样式
│   │   └── index.css        # Tailwind 样式
│   ├── lib/                 # 核心库
│   │   ├── providers/       # AI 提供商集成
│   │   │   ├── index.ts     # 提供商工厂
│   │   │   └── config.ts    # 提供商配置
│   │   ├── storage/         # 存储层
│   │   │   └── provider-store.ts  # 提供商存储
│   │   ├── services/        # 业务服务
│   │   │   └── chat-service.ts    # 聊天服务
│   │   ├── types/           # 类型定义
│   │   ├── openai.ts        # OpenRouter 客户端 (已废弃)
│   │   └── memory.ts        # 记忆系统
│   └── manifest.json        # Chrome 扩展清单
├── icons/                   # 扩展图标
├── public/                  # 静态资源
├── vite.config.ts          # Vite + CRXJS 配置
└── tailwind.config.js       # Tailwind CSS 配置
```

## 🔧 配置

### API Key 配置

本扩展支持多个 AI 提供商，你可以在扩展的设置面板中配置相应的 API Key：

1. **OpenAI**
   - 获取 API Key: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - 支持模型: GPT-4o、GPT-4o Mini、o1-preview、o1-mini

2. **Anthropic**
   - 获取 API Key: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
   - 支持模型: Claude 3.5 Sonnet、Claude 3 Opus、Claude 3 Haiku

3. **OpenRouter** (默认)
   - 获取 API Key: [openrouter.ai/keys](https://openrouter.ai/keys)
   - 支持模型: 通过 OpenRouter 访问多种模型，包括 Claude 3.5、GPT-4o、Llama 3 70B、Gemini Pro 1.5

配置步骤：
1. 点击侧边栏设置图标（齿轮）
2. 选择"提供商配置"标签
3. 为每个提供商输入对应的 API Key
4. 点击保存按钮

切换提供商和模型：
1. 在侧边栏顶部点击提供商选择器
2. 选择已配置的提供商
3. 在模型选择器中选择具体模型

### Manifest V3 配置
- `manifest_version: 3`
- `side_panel` API 支持
- `commands` 全局快捷键配置
- `permissions` 和 `host_permissions` 最小权限原则
- `content_security_policy` 安全配置

### Vite 配置
- CRXJS 插件集成
- React 快速刷新
- TypeScript 支持
- Tailwind CSS 集成

## 🧪 测试

### 运行测试
```bash
npm test
```

### 测试覆盖
- **单元测试**: 核心功能模块测试
- **集成测试**: OpenRouter API 集成测试
- **性能测试**: Apple Silicon 延迟测试
- **UI 测试**: 侧边栏独立渲染测试
- **流式测试**: SSE 流式响应性能测试

## 📊 性能指标

- **FPS**: ≥55 fps (流式输出)
- **延迟**: <100ms (Apple Silicon)
- **内存使用**: <100MB (典型)
- **启动时间**: <2s (冷启动)

## 🔒 安全性

- **CSP 配置**: 严格的内容安全策略
- **API Key 存储**: 本地加密存储
- **XSS 防护**: Markdown 渲染安全过滤
- **权限最小化**: Chrome 权限最小集

## 🛠️ 开发

### 开发命令
```bash
npm run dev      # 开发模式
npm run build    # 生产构建
npm run preview  # 预览构建
npm run lint     # 代码检查
```

### 代码规范
- TypeScript 严格模式
- ESLint 配置
- Prettier 代码格式化
- Husky Git 钩子

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License

## 🙏 致谢

- [React](https://reactjs.org/) - UI 框架
- [TypeScript](https://www.typescriptlang.org/) - 类型安全
- [Vite](https://vitejs.dev/) - 构建工具
- [CRXJS](https://github.com/crxjs/chrome-extension-tools) - Chrome 扩展开发
- [OpenRouter](https://openrouter.ai/) - AI API 服务
- [LangChain.js](https://js.langchain.com/) - AI 应用框架
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架

---

**Browser Pal** - 你的智能浏览器伴侣 🤖