# Activities Feature Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move activity lifecycle, work calculation, activity UI, and activity persistence orchestration behind `activitiesFeature` while preserving current behavior and allowing current database/types to be replaced without compatibility shims.

**Architecture:** `src/lib/features/activities/` owns activity services, calculators, constants, completion dispatch, and activity-specific React UI. `src/lib/database/activities/activityDB.ts` remains the private CRUD adapter for activity records. Shared `inventoryDB.ts` and `vineyardDB.ts` remain shared database adapters because they are used by wine, sales, finance, and vineyard domains. Other features call `activitiesFeature`; no implementation or legacy barrel is retained.

**Tech Stack:** TypeScript, React, Vite, Vitest, Supabase SQL migrations, existing static feature-facade pattern.

---

## Task 1: Establish the migration inventory and baseline

**Files:**
- Inspect: `src/lib/services/activity/`, `src/lib/database/activities/activityDB.ts`, `src/lib/constants/activityConstants.ts`
- Inspect: `src/components/layout/ActivityPanel.tsx`, `src/components/ui/activities/`, `src/components/ui/modals/activitymodals/`
- Inspect: `src/lib/services/core/gameTick.ts`, `src/lib/services/core/startingConditionsService.ts`
- Inspect: all consumers returned by `rg "services/activity|activityDB|activityConstants" src tests`

- [ ] **Step 1: Record the current public surface**

  Build a checklist of every exported activity lifecycle function, calculator, manager, type, constant, and UI component. Mark each consumer as one of: activity host, staff, vineyard, wine, sales, finance, loan, research, achievements, admin, or test.

- [ ] **Step 2: Verify the baseline**

  Run `npm test` and `npx tsc --noEmit`. Record any pre-existing failures before moving files. Do not change code in this task.

- [ ] **Step 3: Identify current database dependencies**

  Confirm the current `activities` table and all foreign keys that reference it, especially storage-vessel allocation plans. The implementation task must replace the current activity schema and update dependent SQL together; it must not introduce a compatibility table or backfill.

## Task 2: Define the public activity facade

**Files:**
- Create: `src/lib/features/activities/featureTypes.ts`
- Create: `src/lib/features/activities/index.ts`
- Create: `src/lib/features/activities/feature.tsx`
- Test: `tests/features/activities/activitiesFeature.test.ts`

- [ ] **Step 1: Write the facade contract test**

  Import only `activitiesFeature` from `@/lib/features/activities`. Assert that the facade exposes `lifecycle`, `reads`, `work`, `ticks`, `setup`, and `ui`, and that no test needs an implementation path to create or read an activity.

- [ ] **Step 2: Define public types**

  Move the existing `ActivityCreationResult`, `ActivityProgress`, work-preview context/result types, and UI registration types into `featureTypes.ts` or re-export the shared canonical types from `src/lib/types/types.ts`. Use the existing `completeNow` result shape `{ success: boolean; error?: string; activity?: Activity }`; do not add an alias for an old name.

- [ ] **Step 3: Compose the static facade**

  Implement `activitiesFeature` with these namespaces:

  - `lifecycle`: create, create-with-result, update, pause, resume, activate, complete-now, cancel;
  - `reads`: get-all, get-by-id, get-progress;
  - `work`: staff work context, preview, allocation, and category-specific calculations required by external domains;
  - `ticks`: activity progression and bookkeeping trigger;
  - `setup`: activity initialization;
  - `ui`: lazy renderers for the activity panel and activity-owned modal registry.

  Keep `index.ts` limited to the facade and public types. Do not export service files, database adapters, or compatibility forwarding functions.

- [ ] **Step 4: Run the facade test**

  Run `npx vitest run tests/features/activities/activitiesFeature.test.ts`. It should fail until the implementation is wired, then pass after the minimal facade composition exists.

## Task 3: Move activity lifecycle and activity-record persistence

**Files:**
- Move: `src/lib/services/activity/activitymanagers/activityManager.ts` -> `src/lib/features/activities/services/activityManager.ts`
- Move: `src/lib/services/activity/activitymanagers/bookkeepingManager.ts` -> `src/lib/features/activities/services/bookkeepingManager.ts`
- Move: `src/lib/services/activity/activitymanagers/landSearchManager.ts` -> `src/lib/features/activities/services/landSearchManager.ts`
- Move: `src/lib/services/activity/activitymanagers/staffSearchManager.ts` -> `src/lib/features/activities/services/staffSearchManager.ts`
- Keep/modify: `src/lib/database/activities/activityDB.ts`
- Modify: `src/lib/features/activities/feature.tsx`, `src/lib/features/activities/featureTypes.ts`

- [ ] **Step 1: Move the lifecycle implementation**

  Move the four activity managers into the feature and update their relative imports. Preserve current ordering for progress persistence, applied-work calculation, XP award, completion dispatch, activity removal, and game-state refresh.

- [ ] **Step 2: Narrow the database adapter**

  Keep CRUD for activity records in `activityDB.ts`, but make it an internal import of the feature. Add explicit current-shape row mapping and company scoping if the replacement schema requires it. Do not export `activityDB` through `src/lib/database/index.ts` or `src/lib/services/index.ts`.

- [ ] **Step 3: Wire lifecycle and reads to the facade**

  Point the facade methods at the moved services. Remove any direct activity-manager import from production consumers before proceeding to the next task.

- [ ] **Step 4: Run lifecycle tests**

  Run `npx vitest run tests/activity/activityLifecycle.test.ts`. Update mocks to target the feature’s internal modules only where the test is specifically testing internals; add facade-level mocks for host behavior.

## Task 4: Move work context, calculators, and activity constants

**Files:**
- Move: `src/lib/services/activity/activityWorkContext.ts` -> `src/lib/features/activities/services/activityWorkContext.ts`
- Move: `src/lib/services/activity/activityWorkPreviewService.ts` -> `src/lib/features/activities/services/activityWorkPreviewService.ts`
- Move: `src/lib/services/activity/workcalculators/` -> `src/lib/features/activities/services/workcalculators/`
- Move/split: `src/lib/constants/activityConstants.ts` -> `src/lib/features/activities/constants/activityConstants.ts`
- Modify: `src/lib/constants/index.ts`, `src/lib/services/index.ts`, `src/lib/types/types.ts`
- Modify: `src/lib/services/user/staffPresentationService.ts`, `src/lib/utils/icons.tsx`

- [ ] **Step 1: Move calculators without changing formulas**

  Move the existing work calculator files, including planting, harvesting, crushing, fermentation, clearing, bookkeeping, land search, staff search, storage-vessel maintenance, research, lending, take-loan, overgrowth, and vineyard modifiers. Preserve signatures and established `calculateTotalWork()`/allocation behavior.

- [ ] **Step 2: Split activity metadata from staff metadata**

  Put work categories, rates, task metadata, clearing metadata, and activity-only tunables in the feature constants. Keep staff role/specialization definitions in the staff-owned constants. Update `staffPresentationService` and icon lookup to consume the current staff constants or the typed activity catalog rather than the old mixed barrel.

- [ ] **Step 3: Expose only intentional calculation APIs**

  Add the calculation functions needed by research, loan, staff UI, vineyard UI, and activity modals to `activitiesFeature.work`. Remove direct calculator imports from production code. Delete obsolete exports instead of preserving aliases.

- [ ] **Step 4: Run calculation regressions**

  Run `npx vitest run tests/activity/workCalculator.test.ts tests/activity/staffResearchSpeed.test.ts tests/user/staffSearchCalculations.test.ts tests/user/researchCalculations.test.ts tests/finance/loanQuoteService.test.ts tests/vineyard/landSearchAsymmetry.test.ts`.

## Task 5: Remove completion cycles while retaining domain ownership

**Files:**
- Modify: `src/lib/features/activities/services/activityManager.ts`
- Modify: `src/lib/features/loanLender/feature.tsx`, `src/lib/features/loanLender/services/activity/activitymanagers/lenderSearchManager.ts`, `src/lib/features/loanLender/services/activity/activitymanagers/takeLoanManager.ts`
- Modify: `src/lib/features/researchUpgrade/feature.tsx`, `src/lib/features/researchUpgrade/services/activity/activitymanagers/researchManager.ts`
- Modify: `src/lib/features/activities/feature.tsx`
- Test: `tests/features/activities/activityCompletionBoundary.test.ts`

- [ ] **Step 1: Write completion-boundary tests**

  Assert that a lender-search, take-loan, and research activity completes through the corresponding public feature workflow, while planting, harvesting, wine processing, staff search, and land search retain their current completion effects.

- [ ] **Step 2: Make domain workflows call the public activity facade**

  Update loan and research activity creation code to call `activitiesFeature.lifecycle.create` and calculation previews through `activitiesFeature.work`. Remove their imports from `src/lib/services/activity`.

- [ ] **Step 3: Resolve completion workflows without static cycles**

  Replace activity-manager imports of loan/research internals with public-facade calls. If static composition creates a cycle, use a late import of the public facade at completion time or move the smallest completion callback into the feature composition. Do not create a generic registration framework.

- [ ] **Step 4: Verify the boundary**

  Run `npx vitest run tests/features/activities/activityCompletionBoundary.test.ts tests/finance/loanLifecycle.test.ts tests/user/researchCalculations.test.ts` and inspect the Vite build graph for a new feature-cycle warning.

## Task 6: Move activity-owned UI behind the facade

**Files:**
- Move: `src/components/layout/ActivityPanel.tsx` -> `src/lib/features/activities/ui/ActivityPanel.tsx`
- Move: `src/components/ui/activities/ActivityCard.tsx` -> `src/lib/features/activities/ui/ActivityCard.tsx`
- Move: `src/components/ui/activities/activityOptionsModal.tsx` -> `src/lib/features/activities/ui/activityOptionsModal.tsx`
- Move: `src/components/ui/activities/workCalculationTable.tsx` -> `src/lib/features/activities/ui/workCalculationTable.tsx`
- Move: activity-owned files in `src/components/ui/modals/activitymodals/` into `src/lib/features/activities/ui/modals/`
- Modify: host layout/App files, staff UI, vineyard/wine UI, and feature UI consumers

- [ ] **Step 1: Move activity-management components**

  Move the panel, card, generic options modal, work table, staff assignment/search, land search, hiring, planting, harvesting, crushing, fermentation, and clearing activity components. Preserve props and rendered behavior.

- [ ] **Step 2: Keep domain-owned UI in its domain**

  Leave `SellGrapesModal` and other primarily sales, wine, vineyard, loan, or research surfaces with their owning domain. Update their activity calls to use `activitiesFeature`; do not turn domain presentation into activity implementation.

- [ ] **Step 3: Add lazy UI renderers**

  Make `activitiesFeature.ui` the only host entry point for the activity panel and activity modal set. Update layout/App/staff integration to render through that seam and remove direct component imports from outside the feature.

- [ ] **Step 4: Verify UI compilation**

  Run the relevant activity and staff UI tests plus `npx tsc --noEmit`. Confirm lazy loading does not introduce a facade/UI import cycle.

## Task 7: Migrate all production consumers

**Files:**
- Modify: `src/lib/services/core/gameTick.ts`, `src/lib/services/core/startingConditionsService.ts`
- Modify: `src/lib/services/user/staffPresentationService.ts`, `src/components/ui/modals/UImodals/StaffModal.tsx`
- Modify: `src/lib/services/vineyard/vineyardManager.ts`, `src/lib/services/vineyard/vineyardService.ts`, `src/lib/services/vineyard/clearingManager.ts`, `src/lib/services/vineyard/clearingRules.ts`
- Modify: `src/lib/services/wine/winery/storageVesselMaintenanceService.ts`
- Modify: `src/lib/features/achievements/achievementService.ts`, `src/lib/features/researchUpgrade/services/research/researchPresentationService.ts`, `src/lib/features/loanLender/services/finance/loanQuoteService.ts`
- Modify: `src/lib/features/admin/services/adminService.ts`, `src/lib/features/admin/services/testLab/testLabFixtureService.ts`
- Modify: every remaining file reported by `rg "services/activity|activityConstants|activityDB" src`

- [ ] **Step 1: Migrate lifecycle/tick callers**

  Change core tick and initialization to `activitiesFeature.ticks`/`setup`; change host workflows to `activitiesFeature.lifecycle` and `reads`.

- [ ] **Step 2: Migrate work-preview callers**

  Change staff, research, loan, vineyard, wine, and modal consumers to `activitiesFeature.work` or shared types. Keep domain-specific calculations in their owning domain when they are not activity work calculations.

- [ ] **Step 3: Migrate activity-record callers**

  Replace direct `activityDB.ts` imports in vineyard and wine activity lifecycle code with facade reads/lifecycle operations. Shared `inventoryDB.ts` and `vineyardDB.ts` imports remain direct database-layer imports because they are not activity-record persistence.

- [ ] **Step 4: Update tests and mocks**

  Move implementation tests under `tests/features/activities/` where they test feature internals; update integration tests to mock/use `activitiesFeature`. Remove mocks for deleted legacy paths.

- [ ] **Step 5: Scan for forbidden imports**

  Run `rg -n "@/lib/services/activity|@/lib/constants/activityConstants|database/activities/activityDB|src/lib/services/activity" src tests`. The only remaining activity implementation imports should be inside `src/lib/features/activities/` and the private activity database adapter.

## Task 8: Replace the activity database schema

**Files:**
- Create: `migrations/20260718120000_replace_activities_schema.sql`
- Modify: migration/RPC files that reference `activities.id` or activity columns
- Modify: `src/lib/database/activities/activityDB.ts`
- Modify: any current `Activity`/payload types in `src/lib/types/types.ts`

- [ ] **Step 1: Define the current schema only**

  Write the current activity table shape required by the migrated mapper: company ownership, category, status, title, target, params, work totals/progress, and game-date fields. Use current names and constraints; do not preserve renamed columns or legacy JSON shapes.

- [ ] **Step 2: Replace dependent references together**

  Update storage-vessel allocation tables/RPCs and any other foreign keys that reference activity records. Preserve only the current relationship required for active storage allocation.

- [ ] **Step 3: Remove obsolete structures**

  Drop the old activity table/columns and obsolete indexes in the development migration. Do not backfill old rows and do not create compatibility views or aliases.

- [ ] **Step 4: Update the adapter mapper and tests**

  Make `activityDB.ts` map exactly the new row shape. Add a database-row mapping test using the current schema fields and remove tests for retired fields.

## Task 9: Update architecture documentation

**Files:**
- Modify: `readme.md`
- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `CONTEXT.md`
- Modify: `docs/WineSystem_VariableRelationshipMap.md` only if activity/work relationships changed

- [ ] **Step 1: Document feature ownership**

  Add `activities` to the installed-feature facade table and state that activity lifecycle, calculators, activity UI, and activity-record orchestration belong to `activitiesFeature`.

- [ ] **Step 2: Document the staff boundary**

  State that activities consumes staff assignment/work/XP capabilities while staff remains a separate domain and does not import activity internals.

- [ ] **Step 3: Remove stale paths and compatibility claims**

  Search documentation for `services/activity`, old activity barrels, old schema names, or claims that legacy activity data is supported; update them to the current feature path.

## Task 10: Final verification and sanitation

**Files:**
- Verify all modified files and migrations
- Test: activity, core, staff, vineyard, wine, sales, finance, loan, research, achievements, and admin suites

- [ ] **Step 1: Run focused suites**

  Run activity lifecycle/work/facade/completion tests, then the staff, vineyard, wine, loan, research, and core tick suites affected by import changes.

- [ ] **Step 2: Run repository gates**

  Run `npm test`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`. Build is required because feature UI lazy boundaries and cycles are part of this refactor.

- [ ] **Step 3: Run the architecture sanitation sweep**

  Check for business logic in moved UI, CRUD outside database adapters, hardcoded activity tuning, direct implementation imports, barrel drift, and feature-cycle warnings. Fix findings before completion.

- [ ] **Step 4: Confirm development-only database direction**

  Verify the migration contains no backfill, legacy normalization, compatibility view, or old-column alias. Confirm all current consumers use the replacement schema.

- [ ] **Step 5: Report the handoff**

  Summarize moved ownership, removed surfaces, schema changes, verification results, and any operational limitation such as unavailable local Supabase. Do not create a commit unless explicitly requested.
