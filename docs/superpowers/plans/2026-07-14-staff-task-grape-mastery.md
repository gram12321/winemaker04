# Staff Task Specialization and Grape Mastery Implementation Plan

Status: Proposed implementation plan. No runtime code is changed by this document.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add task specialization and grape mastery to Winemaker while preserving the existing broad-skill activity model and accurately carrying staff contributions across multi-stage wine production.

**Architecture:** Task specialization and grape mastery are independent overlays on the existing one-primary-skill-per-activity calculation. Only provenance-bearing production activities record the per-tick production contribution ledger; all activities retain the existing broad-skill XP behavior. Completed production stages convert their immutable ledger slices into durable provenance on the vineyard or wine batch. Historical provenance is never reconstructed from current team membership, so staff can join, leave, or be fired without rewriting past work.

**Tech Stack:** React, TypeScript, Supabase/Postgres JSONB migrations, Vitest, existing activity/tick, vineyard, winery, inventory, staff, and wine-log services.

---

## Confirmed design decisions

- Do not introduce mixed work profiles such as “80% planting / 20% harvest”. Each activity still maps to one broad skill through `activityConstants.ts`.
- Add task specialization as a second competency layer for planting, harvesting, crushing, and fermentation. Clearing and maintenance remain explicit policy decisions because clearing is composite and maintenance is a current broad skill/activity, but neither is a provenance-bearing production stage in the MVP.
- Keep legacy `Staff.specializations` intact. For the MVP, learned task mastery lives in `experience` under `task:<taskId>`; do not add a second numeric task-specialization field until innate aptitude semantics, recruitment, wages, and UI are defined. If innate aptitude is later added, use a separately named `taskAptitudes` field.
- Store learned mastery in the existing `Staff.experience` record with namespaced keys: `task:<taskId>` and `grape:<variety>`.
- Use contribution-weighted grape mastery. A worker’s influence is proportional to their applied work on that stage, not to the number of people assigned or a simple team average.
- Record only work that was actually applied to `Activity.completedWork`; team diminishing returns, weather modifiers, and storage-capacity limits must not create phantom provenance or XP.
- Phase one attributes planting, harvesting, crushing, and fermentation setup. Ongoing fermentation, bottling, aging, and sales are currently direct or automatic flows and need separate staff activities before they can receive staff effects.
- A production ledger slice is required only for planting, harvesting, crushing, and fermentation setup. Non-production categories—including maintenance and clearing—do not create task/grape XP or production provenance in this MVP.
- `WineBatch.quantity` remains the canonical provenance quantity in kilograms. Harvest portions are rounded to two decimal kilograms before both batch persistence and provenance allocation; update the storage-backed RPC to persist that decimal quantity without `ROUND(...)` to an integer.
- When storage limits a harvest portion, apply only the proportional activity work that produced the persisted portion: `appliedWork = requestedWork * (actualHarvestKg / requestedHarvestKg)`. Pause with the un-applied remainder still outstanding. The XP allocation and ledger slice use that same applied-work delta.
- Use one Postgres `apply_production_activity_tick` RPC/transaction for every provenance-bearing tick. It must insert a unique `(company_id, activity_id, game_tick_key)` receipt, update activity progress and params, increment staff experience, and apply the vineyard/batch/provenance mutation (including partial harvest) in one transaction. A receipt conflict returns the already-applied result without re-awarding XP or emitting another portion.
- Start with bounded quality modifiers, not a hard “wine quality cannot exceed mastery” cap. A cap can be evaluated after the provenance ledger has production data.

## File structure

| Path | Responsibility after this work |
|---|---|
| `src/lib/types/types.ts` | Task-specialization, provenance, and ledger contracts while preserving save compatibility. |
| `src/lib/constants/activityConstants.ts` | Canonical task IDs and activity-to-task/grape mapping. |
| `src/lib/services/staff/staffCompetencyService.ts` | Pure calculation of broad skill, task modifier, grape modifier, and XP awards. |
| `src/lib/services/production/productionContributionService.ts` | Per-tick ledger allocation and stage-summary aggregation. |
| `src/lib/services/production/productionProvenanceService.ts` | Stage handoff and quantity-weighted provenance merging. |
| `src/lib/services/activity/activitymanagers/activityManager.ts` | Orchestrates pure calculation and the transactional production-tick RPC; completion consumes its returned post-tick snapshot. |
| `src/lib/database/core/staffDB.ts` | Persists existing namespaced experience; no new task-specialization column is required for the MVP. |
| `src/lib/database/activities/activityDB.ts` | Persists generic activity params and exposes the production-tick RPC adapter. |
| `src/lib/database/activities/vineyardDB.ts` | Persists vineyard planting/production provenance. |
| `src/lib/database/activities/inventoryDB.ts` | Persists wine-batch provenance and merge updates. |
| `src/lib/services/wine/winery/inventoryService.ts` | Creates, merges, and carries provenance through partial harvest and batch transforms. |
| `src/lib/services/user/wineLogService.ts` and `src/lib/database/core/wineLogDB.ts` | Freeze final provenance into the bottled wine log. |
| `src/components/ui/modals/activitymodals/StaffAssignmentModal.tsx` and staff pages | Display expected contribution and mastery without moving business rules into React. |
| `tests/staff/*`, `tests/activity/*`, `tests/vineyard/*`, `tests/wine/*` | Contract, conservation, lifecycle, persistence, and stage-handoff coverage. |

## Task 1: Define compatible competency and provenance contracts

**Files:**

- Modify: `src/lib/types/types.ts:837-920`
- Modify: `src/lib/constants/activityConstants.ts:93-140`
- Create: `src/lib/constants/staffCompetencyConstants.ts`
- Create: `tests/staff/staffCompetencyContracts.test.ts`

- [ ] Add string-literal task IDs for planting, harvesting, crushing, and fermentation, plus a `TaskSpecializationMap` type keyed by those IDs.
- [ ] Keep `specializations: string[]` unchanged. Learned task mastery uses `experience[task:<taskId>]`; missing values are neutral.
- [ ] Add `ProductionContributionLedger`, `ProductionContributorSlice`, and `ProductionProvenance` types. Each per-staff slice must contain `appliedWork`, immutable `taskMasterySnapshot`, immutable `grapeMasterySnapshot` when applicable, and any derived weighted values; do not use ambiguous `taskMasteryWork` or `grapeMasteryWork` fields as the sole historical record.
- [ ] Make `productionProvenance: ProductionProvenance` required on loaded `Vineyard`, `WineBatch`, and `WineLogEntry` runtime objects. The database columns remain nullable for legacy rows; mappers materialize a version-one empty object.
- [ ] Add a single mapping function contract from `WorkCategory` plus activity params to `{ primarySkill, taskId?: TaskSpecializationId, grapeVariety?: GrapeVariety, recordsProvenance: boolean }`. Use `WORK_CATEGORY_INFO` as the source of the primary skill; task IDs are optional for non-MVP categories, including administration, finance, search, building, upgrading, and maintenance.
- [ ] Snapshot grape identity from activity params at activity creation, and make harvest/batch creation consume this snapshot rather than a later mutable `vineyard.grape` lookup.
- [ ] Define a `ProductionTickReceipt` contract keyed by company, activity, and a durable game-tick key, with a replayable `ActivityTickResult` payload.
- [ ] Write contract tests proving legacy staff and batches load with neutral values, all current categories resolve to their existing broad skill, only supported production categories opt into task/grape provenance, and a legacy-null provenance column loads as an empty object.

## Task 2: Implement the pure competency engine

**Files:**

- Create: `src/lib/services/staff/staffCompetencyService.ts`
- Modify: `src/lib/services/activity/workcalculators/workCalculator.ts:97-194`
- Create: `tests/staff/staffCompetencyService.test.ts`

- [ ] Implement `calculateStaffWork(staff, activityContext)` returning raw broad-skill work, task modifier, grape modifier, final raw work, and mastery snapshot. Keep the existing broad-skill lookup as the first step and preserve the current `maintenance` skill/category.
- [ ] Keep this task pure: it returns work and XP allocation instructions but does not edit `activityManager.ts`, make database calls, or award XP. Task 3 owns integration.
- [ ] Implement bounded task and grape modifiers as named constants. Use a neutral value of `1.0`; centralize the existing grape XP multiplier before adding task mastery so modifiers cannot stack unpredictably.
- [ ] Implement `calculateAppliedContribution(rawContributions, teamModifier, environmentalModifier, remainingWork)` so the sum of individual applied contributions equals the exact persisted progress delta after team scaling, weather, storage-capacity limits, and final-tick clamping.
- [ ] Award `skill:<broadSkill>`, `task:<taskId>` when present, and `grape:<variety>` when present from each person’s applied contribution. Snapshot mastery before awarding XP so one person cannot gain a larger share merely because their XP changed during the tick.
- [ ] Keep `workCalculator.ts` as a compatibility wrapper where existing callers require it; the new service owns all modifier math.
- [ ] For storage-limited harvests, make the caller resolve the actual harvested-to-requested ratio before passing the final progress delta to the pure allocation function.
- [ ] Test monotonicity, neutral legacy behavior, team-diminishing-return conservation, final-tick clamping, and prevention of runaway task-plus-grape stacking.
- [ ] Include storage-ratio allocation and production-only task/grape XP in these pure tests.

## Task 3: Persist and update the per-tick activity ledger

**Files:**

- Modify: `src/lib/services/activity/activitymanagers/activityManager.ts:453-535`
- Modify: `src/lib/database/activities/activityDB.ts:14-80`
- Create: `migrations/<timestamp>_production_activity_tick_rpc.sql`
- Modify: `src/lib/types/types.ts` activity params typing
- Create: `src/lib/services/production/productionContributionService.ts`
- Create: `tests/activity/activityContributionLedger.test.ts`

- [ ] Refactor `progressActivities()` around one `ActivityTickResult` containing the applied work delta, per-staff allocations, merged params, and the post-tick activity snapshot. Persist `completed_work` and the complete merged `params` together; do not rely on blind JSON merge semantics.
- [ ] Extend `ActivityTickResult` with requested work, actual applied work, and any emitted harvest portion. The storage-limited portion reduces progress proportionally and leaves the un-applied remainder outstanding.
- [ ] Store the active ledger in `activity.params.productionContributionLedger`; preserve harvest/storage fields such as `harvestedSoFar`, `harvestBaseline`, `storagePlanId`, and `outputBatchId` in the same composite update.
- [ ] Record ledger slices only for provenance-bearing production categories. Non-production activities retain broad-skill XP but have no production ledger, task XP, grape XP, or provenance in this MVP.
- [ ] Ensure assignment changes, team changes, staff removal, and worker replacement affect only future ticks. A fired worker remains in completed historical slices but cannot receive future slices.
- [ ] Implement the chosen `apply_production_activity_tick` RPC: a unique `(company_id, activity_id, game_tick_key)` receipt atomically applies staff XP, activity progress/params, harvest batch/RPC changes, and provenance. A receipt replay returns the stored `ActivityTickResult` and emits no new XP or harvest portion.
- [ ] Make `completeActivityNow()` use the same competency, ledger, and completion path, or explicitly mark it as a development-only bypass with tests proving it cannot produce production provenance.
- [ ] Route `completeActivityNow()` through that same production-tick/completion path with an explicit development tick key; it must not bypass provenance or emit duplicate harvest output.
- [ ] Test worker join, worker leave, direct reassignment, team snapshot behavior, final-tick clamping, storage-capacity blocking/resume, retry safety, and exact equality between summed ledger work and persisted `completedWork`.

## Task 4: Add durable database persistence and migrations

**Files:**

- Create: `migrations/<timestamp>_staff_task_grape_provenance.sql`
- Modify: `src/lib/database/core/staffDB.ts`
- Modify: `src/lib/database/activities/vineyardDB.ts:17-120`
- Modify: `src/lib/database/activities/inventoryDB.ts:65-260`
- Modify: `src/lib/database/core/wineLogDB.ts`
- Create: `tests/database/staffProvenancePersistence.test.ts`

- [ ] Do not add a task-specialization column in the MVP; learned task mastery remains in the existing `experience` JSONB. If innate `taskAptitudes` are approved later, add them in a separate migration with explicit semantics.
- [ ] Add nullable `production_provenance` JSONB to vineyards, wine batches, and wine-log rows, with version validation in application code and indexes only if provenance queries require them.
- [ ] Update every single-row, load, update, and bulk mapper for vineyards, inventory, and Wine Log, including `bulkUpdateVineyards`, `bulkUpdateWineBatches`, full-row upsert helpers, and Wine Log insert/load mapping. A field missing from an old row must deserialize as an empty version-one provenance object.
- [ ] Update storage-backed harvest RPC migrations and arguments so provenance is preserved by `append_storage_backed_harvest_batch` and bottling functions. Change the harvest RPC to persist the canonical two-decimal kilogram `p_quantity` without integer `ROUND(...)`.
- [ ] Preserve arbitrary existing `experience` keys so current saves continue to support `grape:<variety>` XP and new `task:<taskId>` keys without a data migration.
- [ ] Add round-trip tests for populated, empty, and legacy-null JSONB values, decimal partial-harvest batch updates, RPC receipt replay, and Wine Log provenance snapshots.

## Task 5: Finalize production stages into provenance

**Files:**

- Create: `src/lib/services/production/productionProvenanceService.ts`
- Modify: `src/lib/services/vineyard/vineyardService.ts:285-340`
- Modify: `src/lib/services/vineyard/vineyardManager.ts:794-870`
- Modify: `src/lib/services/wine/winery/inventoryService.ts:133-241,541-734`
- Modify: `src/lib/services/wine/winery/crushingWorkCalculator.ts` completion path
- Modify: `src/lib/services/activity/workcalculators/fermentationWorkCalculator.ts` completion path
- Modify: the storage-backed harvest RPC migration/function used by `inventoryService.ts`
- Modify: `src/lib/services/wine/winery/fermentationManager.ts:67-120` for the required Wine Log snapshot
- Create: `tests/production/productionProvenanceService.test.ts`

- [ ] Implement `summarizeStage(ledger, stage, quantityKg)` using immutable contribution-weighted task and grape mastery snapshots, retaining contributor IDs, applied-work totals, and canonical two-decimal kilogram quantity for explainability and conservation.
- [ ] For a storage-limited partial harvest, derive `actualAppliedWork` from the persisted portion's ratio to requested yield, create the batch and slice in the same transaction, then pause with the remaining work still incomplete.
- [ ] At planting completion, attach the completed planting summary to the vineyard. Later planting activity by another worker must append a new stage summary, not replace the old one.
- [ ] For partial harvest, return an explicit portion result containing actual applied work, yield, and the current ledger slice. Pass only that slice into `createWineBatchFromHarvest` and the storage-backed append path; never pass the cumulative harvest ledger to every partial batch.
- [ ] Ensure completion receives the post-tick activity snapshot. Flush only an unproduced residual portion; never recreate a portion already emitted by the partial-harvest handler.
- [ ] When `combineWineBatches` merges batches, quantity-weight each provenance stage using the same canonical persisted decimal kilogram quantity as characteristics, anchors, and breakdown data. Test stage-quantity conservation before and after every merge.
- [ ] At crushing and fermentation-setup completion, append stage summaries to the resulting batch. Do not attribute ongoing automatic fermentation, direct bottling, aging, or direct sales until those flows have staff activities.
- [ ] Copy the final immutable batch summary into the required Wine Log snapshot through `wineLogService`, `wineLogDB`, the bottling RPC, and `WineLogEntry`. Wine Log is the required durable historical surface because inventory batches can later be consumed or deleted.
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
- [ ] Leave commits to the human owner unless commit authorization is explicitly provided. Keep each task independently reviewable for subagent handoff without requiring AI-created commits.

## MVP boundary and later extensions

The MVP ends after Task 5 plus neutral, bounded outcome plumbing from Task 6: task/grape mastery, exact per-tick accounting, and provenance through planting, storage-aware harvesting, crushing, and fermentation setup. It does not invent new work categories or assign provenance to maintenance/clearing until their competency semantics are explicitly defined.

Later plans can add recurring staff activities for fermentation supervision, aging, bottling, and sales. Those activities should emit the same ledger contract, so they extend the model rather than creating a second attribution system.

## Acceptance criteria

- Existing saves load with unchanged output when no task specialization or provenance is present.
- A worker’s contribution is weighted by actual applied work, including team, weather, final-tick, and proportional storage-capacity modifiers; production ledger slices sum exactly to their production activity progress.
- Staff joining, leaving, reassignment, and firing affect only future work; historical stage provenance remains immutable.
- Planting, partial harvest, crushing, and fermentation setup carry the correct historical staff and mastery snapshots into the resulting vineyard or batch.
- Batch merges preserve provenance with the same canonical persisted decimal-kilogram weighting used for other batch properties.
- Task and grape effects are bounded, stage-specific, applied once, and explainable to the player.
- No UI module owns competency formulas, no activity uses mixed skill weights, and no current staff roster is used to rewrite completed production history.

## Execution and delegation order

Use subagent-driven development with a task reviewer after every implementation task. After Task 1 contracts are frozen, the strictly pure Task 2 competency/unit-test work and Task 4 migration/mapper work may run in parallel if they do not edit the same files. The activity tick/RPC, storage-backed partial harvest, stage handoffs, and outcome integration must run sequentially because they share `types.ts`, `activityManager.ts`, vineyard/inventory mappers, RPC contracts, and batch creation.

Recommended order is: contracts and category policy; pure allocation engine; persistence/migration; composite activity tick; storage-aware partial harvest; planting/harvest/crushing/fermentation handoffs; bounded outcomes; UI and documentation; final verification.
