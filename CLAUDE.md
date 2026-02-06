# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BrowserCopilot** is an AI-powered Chrome extension (Manifest V3) that researches websites and generates Tampermonkey scripts to fulfill user requirements. The project is evolving toward autonomous AI browser agents.

**Core Feature:** AI analyzes web pages progressively (screenshot → targeted DOM → element details) and writes Tampermonkey scripts to automate tasks or modify page behavior.

**Tech Stack:** React 18+, TypeScript 5+, Vite 5, Chrome Extension MV3, Vercel AI SDK, LangChain.js

## Development Commands

```bash
# Core
npm run dev           # Start dev server with HMR
npm run build         # Production build (TypeScript + Vite + CRXJS)
npm run preview       # Preview production build
npm run lint          # ESLint with TypeScript

# Testing
npm test              # Unit tests (Vitest)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:ui       # Vitest UI

# E2E Testing
npm run test:e2e          # Playwright tests
npm run test:e2e:ui       # Playwright UI mode
npm run test:e2e:install   # Install Chromium for Playwright
```

## Architecture

### Core Directories
- `src/background/` - Service Worker: handles lifecycle, shortcuts, message routing, agent execution
- `src/sidepanel/` - React Side Panel UI with streaming chat
- `src/contents/` - Content scripts for DOM extraction
- `src/lib/` - Core library with subdirectories:
  - `agent/` - Agent system (intent detection, tool execution, state machine)
  - `providers/` - AI provider factory (OpenAI, Anthropic, OpenRouter)
  - `services/` - Chat + Agent orchestration
  - `userscript/` - **Tampermonkey script management** (manager.ts, installer.ts)
  - `dom/` - DOM extraction utilities
  - `screenshot/` - Screenshot capture
  - `memory.ts` - RAG memory system with LangChain.js

### Agent Core: `src/background/agent-core.ts`
- **Architecture**: Planning → Executing → Evaluating loop (max 50 iterations)
- **Key method**: `buildPlanningMessages()` - builds context for LLM
- **Current flow**: Task → Screenshot → AI decides next action → Execute → Evaluate → Loop
- **Progressive exploration**: AI decides what info it needs (DOM, element details, etc.)

### Tampermonkey Script Workflow
1. Agent receives screenshot first (automatic on first iteration)
2. AI analyzes visual layout and decides what to explore next
3. AI uses tools progressively: `captureDOM` → `getElementInfo` → etc.
4. AI generates Tampermonkey script with proper headers (@name, @match, @grant)
5. Agent calls `installUserScript` to register the script via Chrome's userScripts API
6. Script runs automatically on matching pages

### Key Files - Tampermonkey Feature
| File | Purpose |
|------|---------|
| `src/lib/userscript/manager.ts` | Script listing, enabling/disabling, metadata parsing |
| `src/lib/userscript/installer.ts` | Script installation, `createScriptTemplate()` utility |
| `src/lib/agent/tool-executor.ts:487-545` | `installUserScript` tool definition |
| `src/background/agent-core.ts` | Agent loop and planning logic |

### Message Flow
Side Panel (React) → chrome.runtime.sendMessage → Background Service Worker → Agent Execution → installUserScript Tool → chrome.userScripts.register

### Agent Phases
`idle` → `planning` → `executing` → `evaluating` → (repeat) → `completed` | `failed`

## Key Agent Tools for Script Generation

| Tool | Purpose |
|------|---------|
| `captureScreenshot` | **First input** - AI sees page visually |
| `captureDOM` | Extract page structure (targeted, not full page) |
| `getElementInfo` | Get details about specific elements |
| `installUserScript` | **Install generated Tampermonkey script** |
| `listUserScripts` | List installed scripts |
| `navigate`, `clickElement`, `fillForm`, `scroll` | Page interaction |

## Code Conventions

- **Imports:** Use `@/` alias for absolute imports (e.g., `import { X } from '@/lib/types'`)
- **Console:** Use structured `Logger` class in background SW for debugging
- **Testing:** Unit tests alongside implementations with `.test.ts` extension
- **UserScript Headers:** Must include `// ==UserScript==` block with @name, @match
- **Agent Loop:** Keep iterations < 50; each iteration = 1 tool call + evaluation

## Chrome Extension Config

- **Global Shortcut:** `Cmd/Ctrl+Shift+L` toggles side panel
- **Permissions:** sidePanel, tabs, scripting, **userScripts**, offscreen, storage
- **Manifest:** userScripts API requires Chrome 120+ or Tampermonkey extension fallback

## UserScript API Reference

```javascript
// ==UserScript==
// @name         Script Name
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Description
// @match        https://example.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';
  // Your code here
})();
```

## Current Limitations & Improvement Areas

1. **DOM Information Overload**: `captureDOM` returns entire page HTML
   - Future: Progressive DOM extraction based on AI's needs

2. **Script Debugging**: No easy way to debug generated scripts
   - Future: Add script validation + auto-fix loop

3. **No Element Stability**: Scripts may break when page structure changes
   - Future: Use data-* attributes for more stable selectors

## Design Philosophy

- **Progressive Exploration**: AI sees screenshot first, then decides what info to explore
- **Think Step by Step**: One tool call per iteration, AI reflects between calls
- **AI-Driven**: Let AI decide what it needs (not pre-loaded with all info)
- **Human-Like**: Mirror how a human programmer would approach the problem
