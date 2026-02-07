# Test Coverage Improvement Plan (Revised)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Increase overall test coverage from current 49.35% to 80%+ (realistic target)

**Rationale:**
- Some modules (pure type definitions, complex agent-core run loop) are difficult to test
- Focus on high-impact, testable modules
- 80% is a practical target for a Chrome extension project

---

## Current Coverage Status (Fixed 2026-02-07)

**Final Results After Memory Leak Fix:**
- Test Files: 17 passed
- Tests: **389 passed**
- Overall Coverage: **52.83%**
- Duration: 2.83s (no memory issues!)

| Module | Current % | Target % | Status |
|--------|-----------|----------|--------|
| **Core Modules (100% covered)** |
| agent-state.ts | 100% | 100% | Done |
| extractor.ts | 100% | 100% | Done |
| provider-store.ts | 100% | 100% | Done |
| config.ts | 100% | 100% | Done |
| **High Coverage (90%+)** |
| installer.ts | 89.89% | 95% | Partial |
| intent-detector.ts | 87.85% | 90% | Partial |
| capture.ts | 92.1% | 95% | Partial |
| **Good Coverage (70%+)** |
| chat-service.ts | 79.84% | 80% | Done |
| tool-executor.ts | 67.51% | 85% | Partial |
| **Excluded (complex deps)** |
| memory.ts | Excluded | N/A | LangChain |
| background/index.ts | 0% | N/A | Chrome SW |

---

## Memory Leak Fix Applied

**Root Cause:** Subagent created oversized test files (2100+ lines)
- `tool-executor.test.ts`: 2101 lines
- `background/index.test.ts`: 1373 lines

**Solution:** Split into properly sized files (300-500 lines each)
- `tool-executor-capture.test.ts`: ~100 lines
- `tool-executor-nav.test.ts`: ~150 lines
- `tool-executor-script.test.ts`: ~180 lines

---

## Plan Status

### Completed
- [x] chat-service.ts: 64% → 79.84% (+15.84pp)
- [x] tool-executor.ts: 26% → 67.51% (+41pp) - Fixed from memory leak
- [x] Split oversized test files to prevent memory issues

### Pending (Not Recommended)
- background/index.ts: 0% → 80% (requires complex Chrome API mocking)
- 95% per-module target: Unrealistic for some modules

---

## Key Test Files Created

| File | Tests | Coverage Target |
|------|-------|-----------------|
| `tests/lib/agent/tool-executor-capture.test.ts` | 7 | screenshot/DOM capture |
| `tests/lib/agent/tool-executor-nav.test.ts` | 14 | navigate/click/fill |
| `tests/lib/agent/tool-executor-script.test.ts` | 16 | script/page info/summary |
| `tests/lib/services/chat-service.test.ts` | 58 | chat/streamChat/agent ops |

---

## Testing Best Practices Applied

1. **File Size Control**: Each test file 100-200 lines
2. **Focused Tests**: Each file tests one executor group
3. **Proper Cleanup**: vi.resetModules() after each test
4. **Module Isolation**: Mock dependencies at module level
5. **Incremental**: Run small batches, verify, continue
