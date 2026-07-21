# Prestige Deep Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Prestige's path-only facade with a compact, intent-level feature seam that owns ledger persistence, company scoping, calculations, and presentation.

**Architecture:** External modules state domain outcomes such as a loan penalty, achievement unlock, or starting-condition grant. Prestige turns those inputs into ledger rows internally, captures the active company once at each operation entry, and never exposes its database row type. The installed facade keeps only lifecycle, reads, event commands, calculations, and UI composition.

**Tech Stack:** React 19, TypeScript 5, Vitest, Supabase/Postgres, Vite.

---

### Task 1: Lock down the public seam

**Files:**
- Modify: `src/lib/features/prestige/featureTypes.ts`
- Modify: `src/lib/features/prestige/feature.tsx`
- Modify: `tests/features/prestige/prestigeFeature.test.ts`
- Create: `tests/features/prestige/prestigeCompanyScope.test.ts`

- [ ] Define explicit intent inputs for Finance, Achievements, Activities, Company setup, and Admin.
- [ ] Remove `ledger` and all internal `ReturnType`/database-row references from the exported interface.
- [ ] Test the reduced facade shape, explicit internal company selection, and absence of legacy production exports.

### Task 2: Make Prestige own persistence and company snapshots

**Files:**
- Modify: `src/lib/features/prestige/database/prestigeEventsDB.ts`
- Modify: `src/lib/features/prestige/services/prestigeService.ts`
- Modify: `src/lib/features/prestige/services/prestigeDecayService.ts`

- [ ] Require company IDs inside the database adapter.
- [ ] Capture the active company once at each public Prestige operation and thread it through reads, event writes, and decay.
- [ ] Move generic ledger-row construction behind named Prestige commands.

### Task 3: Migrate callers and simplify UI composition

**Files:**
- Modify: Prestige callers under `src/lib/features/` and `src/lib/services/`
- Modify: `src/components/layout/Header.tsx`
- Modify: related unit tests

- [ ] Replace ledger writes with domain intent commands.
- [ ] Use the small facade namespaces only; remove redundant dynamic forwarding wrappers.
- [ ] Render the lazy modal only after Prestige data has been requested.

### Task 4: Verify and document

**Files:**
- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`

- [ ] Run focused Prestige and consumer tests, the full suite, production build, and `git diff --check`.
- [ ] Confirm no production deep imports or public raw-ledger interface remains.
