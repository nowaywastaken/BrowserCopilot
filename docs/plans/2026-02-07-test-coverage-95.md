# Test Coverage Improvement Plan (95% Target)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Increase overall test coverage from current 43.08% to 95%

**Architecture:** Systematic test coverage approach - analyze each module's uncovered lines, create targeted tests, and verify coverage metrics after each module completion.

**Tech Stack:** Vitest, TypeScript, Vite, Chrome Extension MV3

---

## Current Coverage Analysis

| Module | Current % | Target % | Gap | Priority |
|--------|-----------|----------|-----|----------|
| src/background/agent-core.ts | 15.4% | 95% | 79.6% | P0 |
| src/lib/agent/tool-executor.ts | 39.24% | 95% | 55.76% | P0 |
| src/lib/memory.ts | varies | 95% | ~50% | P1 |
| src/background/index.ts | 0% | 95% | 95% | P1 |
| src/lib/agent/types.ts | 0% | 95% | 95% | P1 |
| src/lib/openai.ts | types only | 90% | N/A | P2 |
| src/lib/screenshot/* | ~100% | 100% | 0% | Done |
| src/lib/dom/extractor.ts | 100% | 100% | 0% | Done |
| src/lib/userscript/* | ~100% | 100% | 0% | Done |
| src/lib/providers/* | 100% | 100% | 0% | Done |

---

## Coverage Targets by Module

### Task 1: src/background/agent-core.ts (Target: 95%)
**Current:** 15.4% | **Uncovered:** Lines 95-710, 720-727

**Files:**
- Test: `tests/background/agent-core.test.ts` (existing, needs expansion)

**Test Cases Needed:**
1. `AgentLogger` class (lines 118-148)
   - `setEnabled()` method
   - All logging methods (debug, info, warn, error)
2. `AgentCore` class constructor (lines 160-168)
   - Default config
   - Custom config
   - Default tool executor creation
3. `createDefaultToolExecutor()` (lines 173-214)
   - Unknown tool handling
   - Error handling in execution
4. `setToolExecutor()` method (lines 219-221)
5. `getState()` method (lines 226-228)
6. `stop()` method (lines 233-239)
7. `run()` method - main loop (lines 244-304)
   - Max iterations reached
   - Error handling
   - Successful completion
8. `planningPhase()` (lines 312-352)
   - No action returned
   - AbortError handling
   - ChatService failure
9. `executingPhase()` (lines 360-434)
   - No action to execute
   - Tool execution success
   - Tool execution error
10. `evaluatingPhase()` (lines 442-478)
    - No tool executed
    - LLM evaluation success
    - LLM evaluation failure (fallback)
11. `fallbackEvaluation()` (lines 483-514)
    - Error in result
    - Success === false
    - Fallback continuation
12. `evaluateWithoutTool()` (lines 519-527)
13. `buildPlanningMessages()` (lines 533-568)
    - First iteration with screenshot
    - Subsequent iterations
    - Task with history
14. `captureInitialScreenshot()` (lines 573-593)
    - No active tab
    - Chrome API error
15. `formatToolHistory()` (lines 598-606)
16. `parsePlanningResponse()` (lines 611-634)
    - Valid JSON response
    - JSON parse failure
    - Text fallback
17. `extractActionFromText()` (lines 639-660)
    - Navigate action
    - Click action
    - No action extracted
18. `parseEvaluationResponse()` (lines 665-686)
    - Valid JSON
    - JSON parse failure
19. `getCurrentTabContext()` (lines 691-710)
    - Tab found
    - No tab / error
20. `runAgentTask()` utility function (lines 720-727)

---

### Task 2: src/lib/agent/tool-executor.ts (Target: 95%)
**Current:** 39.24% | **Uncovered:** Lines 177-214, 987-1058

**Files:**
- Test: `tests/lib/agent/tool-executor.test.ts` (existing, needs expansion)

**Test Cases Needed:**
1. `captureScreenshotExecutor` (lines 31-87)
   - Quality parameter handling
   - returnToUser parameter
   - captureScreenshot failure
2. `captureDOMExecutor` (lines 93-155)
   - DOM capture success
   - DOM capture failure
   - Options handling
3. `capturePageAnalysisExecutor` (lines 161-236)
   - Both succeed
   - Screenshot only
   - DOM only
   - Both fail
4. `getElementInfoExecutor` (lines 242-343)
   - Missing selector
   - No active tab
   - Element not found
   - Script execution error
5. `executeScriptExecutor` (lines 349-433)
   - Missing code
   - No active tab
   - Script execution error
   - Script success
6. `getPageInfoExecutor` (lines 439-481)
   - No active tab
   - Page info success
7. `installUserScriptExecutor` (lines 487-545)
   - Missing code
   - Installation success
   - Installation failure
8. `listUserScriptsExecutor` (lines 551-595)
   - List success
   - List failure
9. `navigateExecutor` (lines 601-652)
   - Missing URL
   - Navigation with existing tab
   - Navigation creating new tab
   - Navigation error
10. `clickElementExecutor` (lines 658-768)
    - Missing selector
    - No active tab
    - Element not found
    - Click success with single click
    - Click success with double click
    - Click failure
11. `fillFormExecutor` (lines 774-864)
    - Missing selector or value
    - No active tab
    - Element not found
    - Fill success
    - Fill failure
12. `scrollExecutor` (lines 994-1088)
    - Window scroll
    - Element scroll
    - Scroll target not found
    - Scroll success
    - Scroll failure
13. `summarizePageExecutor` (lines 870-988)
    - No active tab
    - Summary success
    - Summary failure
14. `createToolRegistry()` (lines 1117-1123)
15. `getToolDefinitions()` (lines 1130-1140)

---

### Task 3: src/lib/memory.ts (Target: 95%)
**Current:** 16 tests | **Target:** 60+ tests needed

**Files:**
- Test: `tests/unit/memory.test.ts` (existing)

**Test Cases Needed:**
1. `LocalMemoryManager` constructor (lines 163-184)
   - Missing API key
   - Valid config
   - Apple Silicon detection
2. `init()` method (lines 190-235)
   - Already initialized (idempotent)
   - Concurrent initialization
   - Init failure
3. `doInit()` private method (lines 204-235)
4. `loadMemoriesFromDB()` (lines 240-273)
   - No stored memories
   - With expired memories filtering
   - Load success
5. `batchAddToVectorStore()` (lines 278-299)
   - Empty array
   - Single batch
   - Multiple batches (Apple Silicon)
6. `ensureInitialized()` (lines 304-308)
7. `addMemory()` (lines 313-349)
   - Basic add
   - With custom metadata
8. `addMemories()` (lines 354-386)
   - Batch add success
9. `getRAGContext()` (lines 391-437)
   - Empty results
   - With filtered results
   - Token limit reached
10. `searchMemories()` (lines 442-458)
    - Custom k parameter
11. `searchRelevantContext()` (lines 463-476)
    - Empty results
    - Formatted output
12. `getAllMemories()` (lines 481-484)
13. `getMemory()` (lines 489-495)
14. `getMemoryCount()` (lines 500-502)
15. `getStats()` (lines 507-535)
    - Empty cache
    - With memories
16. `deleteMemory()` (lines 540-559)
    - Delete success
    - Delete failure
17. `clear()` (lines 564-584)
    - Clear success
18. `updateImportance()` (lines 589-597)
    - Update success
    - Memory not found
19. `isInitialized()` (lines 602-604)
20. `destroy()` (lines 609-615)
21. `memoryToDocument()` private (lines 624-638)
22. `extractMemoryFromDocument()` private (lines 643-658)
23. `persistMemories()` private (lines 663-671)
24. `rebuildVectorStore()` private (lines 676-685)
25. `updateAccessStats()` private (lines 690-696)
26. `maybeCleanup()` private (lines 701-709)
27. `cleanup()` private (lines 714-749)
    - Expired memory
    - Low importance
    - Max memories exceeded

---

### Task 4: src/background/index.ts (Target: 95%)
**Current:** 0% | **Target:** 95%

**Files:**
- Test: Create `tests/background/index.test.ts`

**Test Cases Needed:**
1. `Logger` class (lines 122-169)
   - setLevel()
   - All log levels
   - Message formatting
2. `StateManager` class (lines 175-218)
   - init() success/failure
   - getState()
   - setState()
   - subscribe/unsubscribe
   - Listener error handling
3. `SidePanelManager` class (lines 226-345)
   - getCurrentTab()
   - open() - success, no tab, duplicate, error
   - close() - success, no tab, error
   - toggle()
   - notifySidePanel()
4. `BackgroundToolExecutor` class (lines 368-710)
   - constructor - all default handlers
   - registerToolHandler()
   - execute() - no tab, unknown tool, success, error
   - getAvailableTools()
   - handleNavigate()
   - handleClick()
   - handleFill()
   - handleExecuteScript()
   - handleGetPageInfo()
   - handleCaptureScreenshot()
   - handleCaptureDOM()
5. `AgentManager` class (lines 717-926)
   - startTask() - success, no tab, already running, missing task
   - stopTask() - success, no agent
   - getState() - success, no agent
   - sendStateUpdate()
   - cleanup()
   - executeTool() - success, failure, no tab
   - cleanupAll()
6. `MessageHandler` class (lines 934-1063)
   - handleMessage() - all message types
   - handleNotification()
   - handleLog()

---

### Task 5: src/lib/agent/types.ts (Target: 95%)
**Current:** 0% | **Target:** 95%

**Files:**
- Test: `tests/lib/agent/types.test.ts` (existing - 8 tests, needs expansion)

**Test Cases Needed:**
1. `AgentState` interface
2. `ToolDefinition` interface
3. `ToolResult` interface
4. `ToolContext` interface
5. `ToolExecutor` interface

---

### Task 6: src/lib/openai.ts (Target: 90%)
**Current:** Types only | **Target:** 90%

**Files:**
- Test: Create `tests/lib/openai.test.ts` (if needed)

**Test Cases Needed:**
1. Type definitions verification
2. Type compatibility tests

---

## Coverage Verification Commands

```bash
# Run coverage report
npm run test:coverage

# View detailed coverage for specific file
npm run test:coverage -- --reporter=verbose | grep <filename>

# Watch mode with coverage
npm run test:watch -- --coverage
```

---

## Subagent Task Distribution

| Subagent | Module | Estimated Tests | Coverage Goal |
|----------|--------|-----------------|---------------|
| Subagent 1 | agent-core.ts | 80 tests | 95% |
| Subagent 2 | tool-executor.ts | 60 tests | 95% |
| Subagent 3 | memory.ts | 60 tests | 95% |
| Subagent 4 | background/index.ts | 80 tests | 95% |
| Subagent 5 | types.ts + openai.ts | 20 tests | 90% |

---

## Plan Complete and saved to `docs/plans/2026-02-07-test-coverage-95.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development
- Stay in this session
- Fresh subagent per task + code review

**If Parallel Session chosen:**
- Guide them to open new session in worktree
- **REQUIRED SUB-SKILL:** New session uses superpowers:executing-plans
