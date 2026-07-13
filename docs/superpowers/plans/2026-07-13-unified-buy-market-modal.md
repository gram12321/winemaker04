# Unified Buy Market Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate grape and storage-vessel dialogs with one Buy Market dialog driven by registered market-domain adapters.

**Architecture:** The shell owns dialog state, domain tabs, selection, errors, and closing after a successful purchase. Domain adapters own typed offer mapping, domain table/detail content, purchase requirements, fulfillment, and lifecycle hooks; the generic service dispatches through the same registry.

**Tech Stack:** React, TypeScript, Vitest, Supabase-backed market services.

---

### Task 1: Register Buy Market domains

**Files:**
- Create: `src/lib/services/market/buyMarketDomainRegistry.ts`
- Modify: `src/lib/services/market/buyMarketService.ts`
- Modify: `src/lib/services/market/buyMarketLifecycleService.ts`
- Test: `tests/market/buyMarketDomainRegistry.test.ts`

- [ ] Define a registry keyed by `BuyMarketWareGroup` for load, purchase, seasonal refresh, and weekly lifecycle behavior.
- [ ] Route generic purchase and lifecycle calls through the registry instead of conditional grape/cask branches.
- [ ] Verify unknown or unregistered domains return a clear error.

### Task 2: Make domain UI content dialog-free

**Files:**
- Create: `src/components/ui/market/GrapeMarketPanel.tsx`
- Modify: `src/components/ui/market/StorageVesselMarketModal.tsx`
- Modify: `src/components/ui/market/BuyMarketModal.tsx`
- Test: `tests/market/BuyMarketModal.test.tsx`

- [ ] Move grape-specific controls, columns, storage assignment, and rich detail panels into a grape panel.
- [ ] Convert the vessel modal into a vessel panel with no `Dialog` ownership.
- [ ] Keep one shell dialog with tabs, a common close path, and domain-specific panels.

### Task 3: Document and verify

**Files:**
- Modify: `CONTEXT.md`
- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `docs/WineSystem_VariableRelationshipMap.md`

- [ ] Record the registered-domain/separate-adapter seam.
- [ ] Run focused market tests, TypeScript, production build, and `git diff --check`.
