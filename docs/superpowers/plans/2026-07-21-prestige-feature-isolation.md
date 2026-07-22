# Prestige Feature Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the prestige ledger, calculations, decay, persistence, and modal UI behind an installed `prestigeFeature` facade with company-stable operations and no direct prestige-internal imports in host code.

**Architecture:** Create `src/lib/features/prestige/` with a typed facade exposing lifecycle, reads, events, decay, calculations, and lazy UI rendering. Move the existing prestige implementation and database adapter into that feature, then migrate every production consumer to the smallest public namespace. Keep pure calculations free of persistence and keep all database operations explicitly company-scoped.

**Tech Stack:** React 19, TypeScript 5, Vitest, Supabase/Postgres, existing Winemaker feature-facade pattern.

---

### Task 1: Add the feature contract and pure calculation seam

**Files:**
- Create: `src/lib/features/prestige/featureTypes.ts`
- Create: `src/lib/features/prestige/feature.tsx`
- Create: `src/lib/features/prestige/index.ts`
- Move/modify: `src/lib/services/prestige/prestigeCalculator.ts`
- Test: `tests/features/prestige/prestigeFeature.test.ts`

- [ ] Define public types by namespace: lifecycle initialization, reads, event commands, decay, pure calculations, and UI modal props.
- [ ] Expose a single `prestigeFeature` value and lazy UI renderer with `Suspense`; do not expose database adapters or implementation paths.
- [ ] Add facade-shape tests that assert the public namespaces and reject accidental legacy service exports.
- [ ] Move pure calculator ownership under the feature and update its imports without adding compatibility wrappers.
- [ ] Run `npx vitest run tests/features/prestige/prestigeFeature.test.ts` and confirm the contract tests pass.

### Task 2: Move prestige persistence and enforce company-explicit access

**Files:**
- Create: `src/lib/features/prestige/database/prestigeEventsDB.ts`
- Modify: `src/lib/types/types.ts`
- Modify: `src/lib/database/index.ts`
- Test: `tests/prestige/prestigeEventsDB.test.ts`
- Test: `tests/features/prestige/prestigeCompanyScope.test.ts`

- [ ] Move the prestige-events adapter into the feature-owned database directory and remove its public general-database barrel export.
- [ ] Make reads, inserts, updates, deletes, and source-key idempotency accept an explicit company ID; callers may not silently resolve a changed active company during an awaited operation.
- [ ] Preserve current data shape only; do not add legacy payload translation or compatibility branches.
- [ ] Update prestige payload/event types to match current ledger shapes and retain strict company scoping.
- [ ] Add tests for explicit company IDs, source-key idempotency, and no cross-company writes.
- [ ] Run the focused database and company-scope tests.

### Task 3: Move domain services and decay behind the facade

**Files:**
- Create: `src/lib/features/prestige/services/prestigeService.ts`
- Create: `src/lib/features/prestige/services/prestigeDecayService.ts`
- Modify: `src/lib/features/prestige/feature.tsx`
- Delete: `src/lib/services/prestige/prestigeService.ts`
- Delete: `src/lib/services/prestige/prestigeDecayService.ts`
- Delete: `src/lib/services/prestige/prestigeCalculator.ts`
- Test: `tests/prestige/prestigeService.test.ts`
- Test: `tests/prestige/prestigeCalculator.test.ts`

- [ ] Move the domain implementation, preserving behavior while changing imports to feature-local database and calculator modules.
- [ ] Thread company snapshots through asynchronous initialization, aggregation, event creation, and decay operations.
- [ ] Keep calculations and event presentation available only through the public facade namespaces.
- [ ] Add/adjust tests for initialization, aggregation, event idempotency, decay, display data, and vineyard breakdowns through the facade.
- [ ] Run all focused prestige tests and TypeScript checking.

### Task 4: Move and compose the Prestige modal UI

**Files:**
- Create: `src/lib/features/prestige/ui/PrestigeModal.tsx`
- Modify: `src/lib/features/prestige/feature.tsx`
- Modify: `src/lib/features/prestige/featureTypes.ts`
- Modify: `src/components/ui/index.ts`
- Modify: host callers that render `PrestigeModal` (found by `rg`)
- Test: `tests/features/prestige/prestigeFeatureUi.test.tsx`

- [ ] Move the modal under the prestige feature and make it consume typed feature-owned read data.
- [ ] Render it through `prestigeFeature.ui.renderModal` with lazy loading and a local fallback.
- [ ] Remove direct production imports of the old modal path and avoid a facade/UI import cycle.
- [ ] Add a render-contract test covering current company data and event display.

### Task 5: Migrate all production consumers to the public facade

**Files:**
- Modify: `src/lib/services/core/gameState.ts`
- Modify: `src/hooks/usePrestigeAndVineyardValueUpdates.ts`
- Modify: `src/lib/services/sales/salesService.ts`
- Modify: `src/lib/services/sales/contractService.ts`
- Modify: `src/lib/services/sales/forwardContractService.ts`
- Modify: `src/lib/services/sales/relationshipService.ts`
- Modify: `src/lib/services/vineyard/vineyardService.ts`
- Modify: `src/lib/services/vineyard/vineyardManager.ts`
- Modify: `src/lib/services/wine/features/featureService.ts`
- Modify: `src/lib/services/wine/winescore/landValueModifierCalculation.ts`
- Modify: `src/lib/services/wine/winery/inventoryService.ts`
- Modify: `src/lib/features/achievements/achievementService.ts`
- Modify: `src/lib/features/researchUpgrade/services/activity/activitymanagers/researchManager.ts`
- Modify: `src/lib/features/loanLender/services/finance/loanService.ts`
- Modify: `src/lib/features/company/services/startingConditionsService.ts`
- Modify: `src/lib/features/admin/services/testLab/testLabFixtureService.ts`
- Modify: `src/lib/services/index.ts`

- [ ] Replace every direct prestige-service and prestige-database import with the smallest `prestigeFeature` namespace.
- [ ] Remove general service re-exports and direct database access from consumers.
- [ ] Preserve lazy imports only where they are needed to avoid existing initialization cycles.
- [ ] Add completion-boundary regressions for sales, research, loans, vineyard lifecycle, and game-state activation.
- [ ] Run focused consumer tests and search for stale prestige-internal imports across `src` and `tests`.

### Task 6: Documentation and schema review

**Files:**
- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `CONTEXT.md` only if terminology or ownership changes
- Create: `migrations/<timestamp>_prestige_feature_schema.sql` only if the current schema needs a clean-cutover change

- [ ] Document `prestigeFeature` ownership and its public namespaces.
- [ ] Record company-scoped ledger behavior and current event payload shapes.
- [ ] Do not edit `docs/versionlog.md`; that belongs to the human commit workflow.
- [ ] If schema changes are required, create a new forward migration and remove obsolete structures rather than adding legacy compatibility.

### Task 7: Sanitation and integration verification

**Files:**
- Review complete diff and all changed files.

- [ ] Run the architecture sanitation sweep: no business logic in UI, no CRUD outside feature database adapters, no hardcoded tunables, and clean barrel imports.
- [ ] Run focused prestige and consumer tests.
- [ ] Run `npm test` once at the integration gate.
- [ ] Run `npm run build` once at the integration gate to detect facade/UI chunk cycles.
- [ ] Run `git diff --check`.
- [ ] Report exact command results and any unavailable database verification.
