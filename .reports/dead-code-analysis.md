# Dead Code Analysis Report

**Generated:** 2026-02-07
**Project:** BrowserCopilot (browser-pal)
**Analysis Tools:** knip, depcheck, ts-prune

---

## Executive Summary

The codebase analysis identified significant dead code and unused dependencies. Most unused code consists of:

1. **Unused files** - Files not imported anywhere
2. **Unused exports** - Functions/classes exported but never imported
3. **Unused dependencies** - npm packages not imported in source code
4. **Duplicate code patterns** - Deprecated patterns that have been replaced

---

## Analysis Results

### Category 1: Unused Files (8 files)

| File | Size | Reason | Status |
|------|------|--------|--------|
| `src/background/index.ts` | 1,258 lines | Referenced in manifest.json as service_worker | **KEEP** (manifest reference) |
| `src/contents/inject.ts` | 273 lines | Referenced in manifest.json as content_script | **KEEP** (manifest reference) |
| `src/lib/chrome-extension.ts` | 25 lines | Test mock, not used in app | **SAFE TO DELETE** |
| `src/lib/storage.ts` | 800+ lines | Not imported anywhere | **SAFE TO DELETE** |
| `src/lib/providers/config.test.ts` | 136 lines | Tests unused config file | **DELETE WITH config.ts** |
| `src/lib/storage/provider-store.test.ts` | 94 lines | Tests ProviderStore (IS used) | **KEEP** |
| `src/sidepanel/globals.css` | Referenced in sidepanel.html | **KEEP** |
| `test-build.cjs` | 221 lines | Build verification script, not used | **SAFE TO DELETE** |

### Category 2: Unused Exports (15 functions/classes)

| Export | Type | File | Reason | Status |
|--------|------|------|--------|--------|
| `isTerminalPhase` | function | `src/lib/agent/agent-state.ts` | Internal use only | **SAFE TO REMOVE** |
| `getAgentSummary` | function | `src/lib/agent/agent-state.ts` | Internal use only | **SAFE TO REMOVE** |
| `createMemoryManager` | function | `src/lib/memory.ts` | Never called | **SAFE TO REMOVE** |
| `addMemory` | function | `src/lib/memory.ts` | Never called | **SAFE TO REMOVE** |
| `searchMemories` | function | `src/lib/memory.ts` | Never called | **SAFE TO REMOVE** |
| `getRAGContext` | function | `src/lib/memory.ts` | Never called | **SAFE TO REMOVE** |
| `OpenRouterClient` | class | `src/lib/openai.ts` | Replaced by Vercel AI SDK | **SAFE TO REMOVE** |
| `createOpenRouterClient` | function | `src/lib/openai.ts` | Replaced by Vercel AI SDK | **SAFE TO REMOVE** |
| `sendMessage` | function | `src/lib/openai.ts` | Replaced by chat-service.ts | **SAFE TO REMOVE** |
| `streamMessage` | function | `src/lib/openai.ts` | Replaced by chat-service.ts | **SAFE TO REMOVE** |
| `OpenRouterError` | class | `src/lib/openai.ts` | Not used | **SAFE TO REMOVE** |
| `MODEL_PRICING` | constant | `src/lib/openai.ts` | Not used | **SAFE TO REMOVE** |
| `isValidDataUrl` | function | `src/lib/screenshot/capture.ts` | Never called | **SAFE TO REMOVE** |
| `STORAGE_KEYS` | constant | `src/lib/types/provider.ts` | Not imported | **SAFE TO REMOVE** |
| `default` (export) | component | `AgentExecutionView.tsx` | Duplicate named export | **SAFE TO REMOVE** |

### Category 3: Unused Exported Types (40 types)

Many types are exported but never imported. These are safe to remove:

**From agent/**: `ToolParameterSchema`, `ToolDefinition`, `PlanningResponse`, `EvaluationResponse`

**From memory/**: `Memory`, `MemoryMetadata`, `MemoryManagerConfig`, `SearchResult`, `RAGContext`, `MemoryStats`, `LocalMemoryManagerConfig`, `LocalMemory`

**From openai/**: `AIModel`, `StreamChunk`, `ChatCompletionResponse`, `OpenRouterConfig`, `RequestConfig`, `OpenRouterClientConfig`, `OpenRouterRequestConfig`

**From screenshot/**: `ScreenshotCaptureOptions`, `ScreenshotData`, `ScreenshotResult`

**From services/**: `IntentResult`

**From types/**: `MessageRole`, `ToolCall`, `StorageKey`

**From userscript/**: `InstallOptions`, `InstallResult`, `ScriptMetadata`

**From components/**: Props types (`ChatWindowProps`, `InputAreaProps`, etc.)

### Category 4: Unused Dependencies

| Package | Version | Used By | Status |
|---------|---------|---------|--------|
| `openai` | ^4.28.4 | No imports in src/ | **SAFE TO REMOVE** |
| `tailwind-merge` | ^2.2.1 | No imports in src/ | **SAFE TO REMOVE** |
| `@testing-library/user-event` | ^14.5.2 | No imports | **SAFE TO REMOVE** |

### Category 5: Duplicate Code

**1. OpenAI/OpenRouter Clients**
- Old: `src/lib/openai.ts` (OpenRouterClient class - 500+ lines)
- New: `src/lib/providers/index.ts` (Vercel AI SDK integration)
- Status: Both exist, old one is unused

**2. Storage Systems**
- Old: `src/lib/storage.ts` (UnifiedStorage - 800+ lines)
- New: `src/lib/storage/provider-store.ts` (ProviderStore - lighter implementation)
- Status: Old file not imported anywhere

---

## Risk Assessment

### HIGH RISK (Do Not Modify)
- `src/background/index.ts` - Manifest service_worker reference
- `src/contents/inject.ts` - Manifest content_script reference
- `src/sidepanel/globals.css` - Referenced in HTML

### MEDIUM RISK (Test Before Removal)
- Exported types from `src/lib/openai.ts` - Verify no dynamic imports
- Exported types from `src/lib/memory.ts` - Verify no dynamic imports

### LOW RISK (Safe to Remove)
- `test-build.cjs` - Standalone script
- `src/lib/chrome-extension.ts` - Isolated mock file
- `src/lib/storage.ts` - Not imported anywhere
- Unused dependencies (`openai`, `tailwind-merge`, `@testing-library/user-event`)
- Unused exports within used files

---

## Recommended Cleanup Actions

### Phase 1: Safe Removals (No Risk)

1. **Delete test-build.cjs** - Build script not used
2. **Delete src/lib/chrome-extension.ts** - Mock not imported
3. **Delete src/lib/storage.ts** - 800+ lines unused
4. **Remove unused dependencies**: `openai`, `tailwind-merge`, `@testing-library/user-event`

### Phase 2: Clean Up Unused Exports (Test After)

5. **Remove unused exports from src/lib/openai.ts**
6. **Remove unused exports from src/lib/memory.ts**
7. **Remove unused exports from src/lib/agent/agent-state.ts**
8. **Remove duplicate default export from AgentExecutionView.tsx**

### Phase 3: Remove Unused Types (Optional)

9. Remove unused exported types for cleaner API (40+ types)

---

## Estimated Impact

| Metric | Value |
|--------|-------|
| Files to delete | 4 |
| Lines of code to remove | ~2,500 |
| Dependencies to remove | 3 |
| Bundle size reduction | ~150 KB (estimated) |

---

## Files to Create/Update

- `docs/DELETION_LOG.md` - Track all deletions
- Update package.json (remove dependencies)
- Update imports in test files if needed

---

## Testing Strategy

Before each removal:
1. Run `npm test` to verify baseline
2. Make the change
3. Run `npm test` again
4. Run `npm run build` to verify production build
5. If any failure, rollback with `git revert`

---

## Notes

- The `openai` package is NOT the same as `@ai-sdk/openai`. The Vercel AI SDK packages are used instead.
- `clsx` IS used (many imports found) - do NOT remove
- The manifest.json references must be kept in sync with file deletions
