# Admin Feature Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dev-only Admin feature a small host-facing module, development-only in production builds, and portable between compatible Winemaker hosts.

**Architecture:** Keep `getAdminFeature()` as the sole host seam, exposing availability and page rendering only. Keep commands, Test Lab dependencies, persistence adapters, and host option loading inside the active implementation. The Test Lab runner is explicitly constructed with its dependencies; the UI receives a presentation-oriented Test Lab module.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Supabase adapters.

---

### Task 1: Narrow the host-facing Admin interface

**Files:** `src/lib/features/admin/featureTypes.ts`, `index.ts`, `noop.ts`, `active.ts`, `App.tsx`, `Header.tsx`, `wineModal.tsx`

- [ ] Expose only availability and page rendering through the public barrel.
- [ ] Move dashboard/Test Lab command shapes to feature-internal types.
- [ ] Add a facade contract test for default no-op and active configuration.

### Task 2: Make the active adapter development-only

**Files:** `src/main.tsx`, `tests/admin/adminFeatureFacade.test.ts`

- [ ] Dynamically load and configure the active adapter only when `import.meta.env.DEV` is true.
- [ ] Leave production on the default no-op adapter.
- [ ] Verify with TypeScript/build output that production has no active admin chunk.

### Task 3: Centralize Test Lab dependencies

**Files:** `src/lib/features/admin/services/testLab/testLabRunner.ts`, `src/lib/features/admin/active.ts`, `components/TestLabPage.tsx`, `components/AdminDashboard.tsx`, tests/admin

- [ ] Replace optional command injection and self-import fallbacks with an explicitly created runner.
- [ ] Move dynamic option loading behind the Test Lab module so UI does not import persistence/domain modules.
- [ ] Preserve Test Lab behavior through targeted tests.

### Task 4: Contain persistence and document host requirements

**Files:** `src/lib/database/index.ts`, admin persistence imports, `src/lib/features/admin/README.md`, `readme.md`, `docs/PROJECT_INFO.md`, `docs/AIdocs/AIDescriptions_coregame.md`

- [ ] Remove admin-only destructive adapters from the global database barrel.
- [ ] Document compatible-host requirements, the server test endpoint, and loopback gating.
- [ ] Update ownership documentation.

### Task 5: Verify and sanitize

**Files:** changed files and `tests/admin/`

- [ ] Run targeted Admin tests, then the full test suite, type/build checks, and `git diff --check`.
- [ ] Run the repository architecture sanitation sweep and address relevant findings.

## Coverage check

- Narrow public interface: Task 1.
- Development-only physical loading: Task 2.
- Test Lab dependency seam and UI persistence leak: Task 3.
- Global persistence-barrel exposure and export documentation: Task 4.
- Public seam tests and completion hygiene: Task 5.
