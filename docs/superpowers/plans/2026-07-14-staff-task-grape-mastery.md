# Staff Task Specialization and Grape Mastery Implementation Plan

Status: Proposed implementation plan. No runtime code is changed by this document.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add task specialization and grape mastery to Winemaker while preserving the existing broad-skill activity model and accurately carrying staff contributions across multi-stage wine production.

**Architecture:** Task specialization and grape mastery are independent overlays on the existing one-primary-skill-per-activity calculation. Every staff activity records a per-tick contribution ledger; completed production stages convert that ledger slice into durable provenance on the vineyard or wine batch. Historical provenance is never reconstructed from current team membership, so staff can join, leave, or be fired without rewriting past work.

**Tech Stack:** React, TypeScript, Supabase/Postgres JSONB migrations, Vitest, existing activity/tick, vineyard, winery, inventory, staff, and wine-log services.

---

## Confirmed design decisions

- Do not introduce mixed work profiles such as “80% planting / 20% harvest”. Each activity still maps to one broad skill through `activityConstants.ts`.
- Add task specialization as a second competency layer: planting, harvesting, clearing, crushing, and fermentation are the initial task IDs.
- Keep legacy `Staff.specializations` intact. Add a separate persisted task-specialization field because the legacy field is used by recruitment, wages, and UI conventions.
- Store learned mastery in the existing `Staff.experience` record with namespaced keys: `task:<taskId>` and `grape:<variety>`.
- Use contribution-weighted grape mastery. A worker’s influence is proportional to their applied work on that stage, not to the number of people assigned or a simple team average.
- Record only work that was actually applied to `Activity.completedWork`; team diminishing returns and weather modifiers must not create phantom provenance.
- Phase one attributes planting, harvesting, crushing, and fermentation setup. Ongoing fermentation, bottling, aging, and sales are currently direct or automatic flows and need separate staff activities before they can receive staff effects.
- Start with bounded quality modifiers, not a hard “wine quality cannot exceed mastery” cap. A cap can be evaluated after the provenance ledger has production data.

## File structure

| Path | Responsibility after this work |
|---|---|
| `src/lib/types/types.ts` | Task-specialization, provenance, and ledger contracts while preserving save compatibility. |
| `src/lib/constants/activityConstants.ts` | Canonical task IDs and activity-to-task/grape mapping. |
| `src/lib/services/staff/staffCompetencyService.ts` | Pure calculation of broad skill, task modifier, grape modifier, and XP awards. |
| `src/lib/services/production/productionContributionService.ts` | Per-tick ledger allocation and stage-summary aggregation. |
| `src/lib/services/production/productionProvenanceService.ts` | Stage handoff and quantity-weighted provenance merging. |
| `src/lib/services/activity/activitymanagers/activityManager.ts` | Calls the contribution engine and atomically persists progress plus ledger params. |
| `src/lib/database/core/staffDB.ts` | Persists task-specialization JSONB and existing namespaced experience. |
| `src/lib/database/activities/activityDB.ts` | Persists generic activity params containing the active ledger. |
| `src/lib/database/activities/vineyardDB.ts` | Persists vineyard planting/production provenance. |
| `src/lib/database/activities/inventoryDB.ts` | Persists wine-batch provenance and merge updates. |
| `src/lib/services/wine/winery/inventoryService.ts` | Creates, merges, and carries provenance through partial harvest and batch transforms. |
| `src/lib/services/user/wineLogService.ts` and `src/lib/database/core/wineLogDB.ts` | Optionally freeze final provenance into the bottled wine log. |
| `src/components/ui/modals/activitymodals/StaffAssignmentModal.tsx` and staff pages | Display expected contribution and mastery without moving business rules into React. |
| `tests/staff/*`, `tests/activity/*`, `tests/vineyard/*`, `tests/wine/*` | Contract, conservation, lifecycle, persistence, and stage-handoff coverage. |

## Task 1: Define compatible competency and provenance contracts

**Files:**

- Modify: `src/lib/types/types.ts:837-920`
- Modify: `src/lib/constants/activityConstants.ts:93-140`
- Create: `src/lib/constants/staffCompetencyConstants.ts`
- Create: `tests/staff/staffCompetencyContracts.test.ts`

- [ ] Add string-literal task IDs for planting, harvesting, clearing, crushing, and fermentation, plus a `TaskSpecializationMap` type keyed by those IDs.
- [ ] Add `taskSpecializations?: Record<TaskSpecializationId, number>` to `Staff`; keep `specializations: string[]` unchanged and treat missing task data as neutral.
- [ ] Add `ProductionContributionLedger`, `ProductionContributorSlice`, and `ProductionProvenance` types. The ledger must contain `version`, `totalAppliedWork`, and per-staff `appliedWork`, `taskMasteryWork`, and `grapeMasteryWork`.
- [ ] Add optional `productionProvenance` to `Vineyard` and `WineBatch`; default absent values to an empty version-one object when loading older saves.
- [ ] Add a single mapping function contract from `WorkCategory` to `{ broadSkill, taskId, grapeVariety? }`; reject unknown categories rather than silently assigning a specialization.
- [ ] Write contract tests proving legacy staff and batches load with neutral values and that every initial activity category resolves to exactly one task ID.

## Task 2: Implement the pure competency engine

**Files:**

- Create: `src/lib/services/staff/staffCompetencyService.ts`
- Modify: `src/lib/services/activity/workcalculators/workCalculator.ts:97-194`
- Modify: `src/lib/services/activity/activitymanagers/activityManager.ts:453-515`
- Create: `tests/staff/staffCompetencyService.test.ts`

- [ ] Implement `calculateStaffWork(staff, activityContext)` returning raw broad-skill work, task modifier, grape modifier, final raw work, and mastery snapshot. Keep the existing broad-skill lookup as the first step.
- [ ] Implement bounded task and grape modifiers as named constants. Use a neutral value of `1.0`; centralize the existing grape XP multiplier before adding task mastery so modifiers cannot stack unpredictably.
- [ ] Implement `calculateAppliedContribution(rawContributions, teamModifier, environmentalModifier, remainingWork)` so the sum of individual applied contributions equals the exact persisted progress delta.
- [ ] Award `skill:<broadSkill>`, `task:<taskId>`, and `grape:<variety>` XP from each person’s applied contribution. Snapshot mastery before awarding XP so one person cannot gain a larger share merely because their XP changed during the tick.
- [ ] Keep `workCalculator.ts` as a compatibility wrapper where existing callers require it; the new service owns all modifier math.
- [ ] Test monotonicity, neutral legacy behavior, team-diminishing-return conservation, final-tick clamping, and prevention of runaway task-plus-grape stacking.

## Task 3: Persist and update the per-tick activity ledger

**Files:**

- Modify: `src/lib/services/activity/activitymanagers/activityManager.ts:453-535`
- Modify: `src/lib/database/activities/activityDB.ts:14-80`
- Modify: `src/lib/types/types.ts` activity params typing
- Create: `src/lib/services/production/productionContributionService.ts`
- Create: `tests/activity/activityContributionLedger.test.ts`

- [ ] Insert ledger allocation in `progressActivities()` after staff work is calculated and before the activity row is written.
- [ ] Store the active ledger in `activity.params.productionContributionLedger`; use JSON merge semantics so harvest-specific fields such as `harvestedSoFar` are not overwritten by a stale activity object.
- [ ] On every tick, append only that tick’s applied slice to the ledger. Do not recompute historical slices from current `assignedStaffIds`.
- [ ] Ensure assignment changes, team changes, staff removal, and worker replacement affect only future ticks. A fired worker remains in completed historical slices but cannot receive future slices.
- [ ] Add idempotency protection using the activity tick/update identity already available to the activity manager, so a retried tick cannot award XP or provenance twice.
- [ ] Test worker join, worker leave, reassignment, final-tick clamping, retry safety, and exact equality between summed ledger work and `completedWork`.

## Task 4: Add durable database persistence and migrations

**Files:**

- Create: `supabase/migrations/<timestamp>_staff_task_grape_provenance.sql`
- Modify: `src/lib/database/core/staffDB.ts`
- Modify: `src/lib/database/activities/vineyardDB.ts:17-120`
- Modify: `src/lib/database/activities/inventoryDB.ts:65-260`
- Modify: `src/lib/database/core/wineLogDB.ts` if final-log provenance is enabled
- Create: `tests/database/staffProvenancePersistence.test.ts`

- [ ] Add nullable `task_specializations` JSONB to the staff table with an empty-object default for new rows.
- [ ] Add nullable `production_provenance` JSONB to vineyards and wine batches, with version validation in application code and indexes only if provenance queries require them.
- [ ] Update single-row save/load, update, and bulk-save mappers for staff, vineyards, and inventory. A field missing from an old row must deserialize as `{}` rather than `undefined` in calculation code.
- [ ] Preserve arbitrary existing `experience` keys so current saves continue to support `grape:<variety>` XP and new `task:<taskId>` keys without a data migration.
- [ ] Add round-trip tests for populated, empty, and legacy-null JSONB values, including partial-harvest batch updates.

## Task 5: Finalize production stages into provenance

**Files:**

- Create: `src/lib/services/production/productionProvenanceService.ts`
- Modify: `src/lib/services/vineyard/vineyardService.ts:285-340`
- Modify: `src/lib/services/vineyard/vineyardManager.ts:794-870`
- Modify: `src/lib/services/wine/winery/inventoryService.ts:133-180,541-700`
- Modify: `src/lib/services/wine/winery/crushingManager.ts:38-100`
- Modify: `src/lib/services/wine/winery/fermentationManager.ts:27-130`
- Create: `tests/production/productionProvenanceService.test.ts`

- [ ] Implement `summarizeStage(ledger, stage, quantity)` using contribution-weighted task and grape mastery, retaining contributor IDs and applied-work totals for explainability.
- [ ] At planting completion, attach the completed planting summary to the vineyard. Later planting activity by another worker must append a new stage summary, not replace the old one.
- [ ] For partial harvest, pass only the current tick’s ledger slice into `createWineBatchFromHarvest`; never pass the cumulative harvest ledger to every partial batch.
- [ ] When `combineWineBatches` merges batches, quantity-weight each provenance stage exactly as existing characteristics, anchors, and breakdown data are merged.
- [ ] At crushing and fermentation-setup completion, append stage summaries to the resulting batch. Do not attribute ongoing automatic fermentation, direct bottling, aging, or direct sales until those flows have staff activities.
- [ ] If wine-log provenance is enabled, copy the final immutable batch summary into the bottling snapshot through `wineLogService`; otherwise document the batch as the canonical historical record.
- [ ] Test a novice planting worker followed years later by an expert winery worker, partial harvest slices, batch merges, and worker removal after stage completion.

## Task 6: Apply bounded staff effects to wine outcomes

**Files:**

- Create: `src/lib/services/production/staffStageOutcomeService.ts`
- Modify: existing wine characteristic/breakdown/anchor calculation service identified by current batch-creation call sites
- Modify: `src/lib/services/wine/winery/inventoryService.ts`
- Create: `tests/production/staffStageOutcomeService.test.ts`

- [ ] Define stage-specific, bounded effects: planting influences establishment/resilience, harvest influences incoming quality and damage, crushing influences extraction/penalty risk, and fermentation setup influences defect/style risk.
- [ ] Use a soft mastery realization such as `0.80 + 0.20 * weightedGrapeMastery` for the first tuning pass; keep the constants in one module and expose the explanation values to callers.
- [ ] Apply each stage once from its immutable provenance summary. Do not recalculate quality from the current staff roster or apply the same stage modifier during every later tick.
- [ ] Preserve current output when provenance is absent, allowing existing saves to behave exactly as before.
- [ ] Test neutral legacy batches, one expert contributor, mixed contributors with different applied-work weights, and repeated recalculation for idempotency.

## Task 7: Expose mastery, expected contribution, and provenance in UI

**Files:**

- Modify: `src/components/ui/modals/activitymodals/StaffAssignmentModal.tsx:58-120`
- Modify: staff management page/components that currently display `skills`, `experience`, and `specializations`
- Create or modify: assignment preview component near the existing staff modal
- Create or modify: vineyard/batch detail component for production provenance
- Create: focused UI/service-backed tests under `tests/ui/staff/`

- [ ] Show task mastery and grape mastery separately from broad skills; label them as learned experience, not innate skill.
- [ ] In assignment previews, show expected work, task modifier, grape modifier, and the resulting share of the current activity without calculating any formulas in React.
- [ ] Show production provenance as a stage timeline with contributor, applied-work share, task mastery snapshot, and grape mastery snapshot.
- [ ] Keep recruitment generation and wage logic on the service side. UI selection may request a task specialization or grape focus but must pass validated IDs to the service.
- [ ] Test rendering of neutral legacy staff, mixed-contributor previews, and a provenance timeline containing a worker who is no longer employed.

## Task 8: Verification, rollout, and documentation

**Files:**

- Modify: `CONTEXT.md`
- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `docs/WineSystem_VariableRelationshipMap.md`
- Create: `docs/superpowers/specs/2026-07-14-staff-task-grape-mastery-design.md` only if the design record is kept separately from this implementation plan

- [ ] Document the two competency overlays, the per-tick ledger, stage handoffs, and the current non-staff-driven production stages.
- [ ] Run focused suites for competency, activity lifecycle, partial harvest, batch merge, persistence, and staff UI; expected result is all targeted tests passing.
- [ ] Run the full test suite and production build after focused tests pass.
- [ ] Run `git diff --check` and search for direct uses of `staff.experience`, `specializations`, and batch creation to ensure all new modifier math goes through the competency/provenance services.
- [ ] Commit each task as a small, reviewable change using messages such as `feat: add staff competency contracts` and `test: cover contribution ledger conservation`.

## MVP boundary and later extensions

The MVP ends after Task 5 plus neutral, bounded outcome plumbing from Task 6: task/grape mastery, exact per-tick accounting, and provenance through planting, harvesting, crushing, and fermentation setup. It does not invent new work categories.

Later plans can add recurring staff activities for fermentation supervision, aging, bottling, and sales. Those activities should emit the same ledger contract, so they extend the model rather than creating a second attribution system.

## Acceptance criteria

- Existing saves load with unchanged output when no task specialization or provenance is present.
- A worker’s contribution is weighted by actual applied work, including team and weather modifiers, and all ledger slices sum exactly to activity progress.
- Staff joining, leaving, reassignment, and firing affect only future work; historical stage provenance remains immutable.
- Planting, partial harvest, crushing, and fermentation setup carry the correct historical staff and mastery snapshots into the resulting vineyard or batch.
- Batch merges preserve provenance with the same quantity weighting used for other batch properties.
- Task and grape effects are bounded, stage-specific, applied once, and explainable to the player.
- No UI module owns competency formulas, no activity uses mixed skill weights, and no current staff roster is used to rewrite completed production history.
