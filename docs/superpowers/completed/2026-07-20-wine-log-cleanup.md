# Wine Log Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the isolated Wine Log feature, remove dead code and unsafe local types, reduce repeated analytics work, and preserve existing behavior.

**Architecture:** Keep `wineLogFeature` as the only host-facing seam. Keep persistence in `wineLogDB.ts`, domain calculations in the Wine Log service, and presentation in feature UI components. Internal analytics helpers may be reshaped, but no new public facade methods are added.

**Tech Stack:** TypeScript, React, Vitest, Supabase adapters.

---

### Task 1: Remove dead statistics service API

**Files:**
- Modify: `src/lib/features/wineLog/services/wineLogService.ts`
- Test: `tests/features/wineLog/wineLogService.test.ts`

- [x] Confirm `calculateVineyardStats` and `VineyardStats` have no consumers.
- [x] Delete the unused interface, function, and associated dead helper usage.
- [x] Run Wine Log and lifecycle tests.

### Task 2: Tighten Wine Log types and internal analytics inputs

**Files:**
- Modify: `src/lib/database/core/wineLogDB.ts`
- Modify: `src/lib/features/wineLog/services/wineLogService.ts`
- Modify: `src/lib/features/wineLog/ui/ProductionHistoryTab.tsx`

- [x] Replace `any` characteristics and vineyard collections with existing shared types.
- [x] Introduce a feature-local analytics input type instead of positional `any[]`/loosely typed arguments.
- [x] Preserve the existing analytics result shape and UI behavior.

### Task 3: Share vineyard comparison calculations

**Files:**
- Modify: `src/lib/features/wineLog/services/wineLogService.ts`
- Modify: `src/lib/features/wineLog/ui/VineyardStatisticsTab.tsx`
- Add/modify: `tests/features/wineLog/wineLogService.test.ts`

- [x] Add a service-level calculation that derives all vineyard analytics from one snapshot and shared ranking aggregates.
- [x] Update the statistics tab to consume the precomputed per-vineyard results.
- [x] Add tests for multi-vineyard ranking behavior.

### Task 4: Index live batch lookup and clean local constants/comments

**Files:**
- Modify: `src/lib/features/wineLog/ui/WineLogPage.tsx`
- Modify: `src/lib/features/wineLog/ui/ProductionHistoryTab.tsx`
- Modify: `src/lib/features/wineLog/ui/VineyardStatisticsTab.tsx`

- [x] Build a memoized lookup for current batches while preserving the existing matching policy.
- [x] Promote stable page/aging values to named feature-local constants where useful.
- [x] Remove comments that only restate the code.

### Task 5: Verify and sanitize

**Files:**
- Inspect: `src/lib/features/wineLog/`, `src/lib/database/core/wineLogDB.ts`, `tests/features/wineLog/`

- [x] Run focused Wine Log, winery lifecycle, Achievements, and Admin wiring tests.
- [x] Run TypeScript checking.
- [x] Run `git diff --check` and scan for stale/dead Wine Log symbols and direct persistence bypasses.
- [x] Run the repository sanitation checks required by `skills/winemaker-game/SKILL.md`.
