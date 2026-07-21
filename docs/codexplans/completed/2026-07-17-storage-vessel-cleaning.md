# Storage Vessel Cleaning Implementation Plan

Status: Completed. Cleanliness persistence, dirty-on-fill behavior, cancellable cleaning activities, Equipment actions, and atomic completion are implemented and verified.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a vessel that has held wine dirty and unavailable for further allocation until a cancellable Cleaning Vessel maintenance activity completes.

**Architecture:** This is a clean cutover of the existing Storage Vessel model. Add one persisted `cleanliness` field (`clean` or `dirty`) directly to `StorageVessel` and `storage_vessels`; it is independent of allocation-derived `occupancy` and equipment `operationalStatus`. Mark a vessel dirty only after it receives wine. Cleanliness is currently a warning/display state; future condition penalties may make it consequential. Cleaning is a second typed Maintenance activity alongside Empty Vessel, with an atomic completion command.

**Tech Stack:** React 19, TypeScript, Vitest, Supabase/Postgres.

**Clean-cutover rules:** Do not add a compatibility type, fallback reads, data backfill, compatibility migration, or deprecated-function re-export. This is still development-phase schema: modify the existing Storage Vessel foundation migration and replace obsolete function definitions/consumers in place. Remove any superseded database function or code path rather than retaining it.

---

## File structure

| Path | Responsibility after this work |
|---|---|
| `migrations/20260718100000_add_storage_vessel_cleanliness.sql` | Defines the clean-cutover cleanliness column, allocation/fill triggers, and cleaning RPC. |
| `src/lib/types/storageVessels.ts` | Adds `StorageVesselCleanliness` and makes `cleanliness` required on `StorageVessel`. |
| `src/lib/database/winery/storageVesselsDB.ts` | Maps cleanliness, exposes the one cleaning-completion database command, and removes superseded wrappers. |
| `src/lib/services/wine/winery/storageVesselAllocationService.ts` | Counts/selects operational, available vessels; cleanliness is currently warning-only. |
| `src/lib/services/wine/winery/storageVesselMaintenanceService.ts` | Owns both Empty Vessel and Clean Vessel start/completion rules. |
| `src/lib/services/activity/workcalculators/storageVesselMaintenanceWorkCalculator.ts` | Calculates named emptying and cleaning work estimates from existing Maintenance constants. |
| `src/lib/services/activity/activitymanagers/activityManager.ts` | Dispatches Maintenance completion explicitly by activity type. |
| `src/components/pages/Equipment.tsx` | Displays cleanliness and starts a cleaning activity for empty dirty vessels. |

### Task 1: Replace the vessel persistence model and commands

**Files:**

- Create: `migrations/20260718100000_add_storage_vessel_cleanliness.sql`
- Modify: `src/lib/types/storageVessels.ts`
- Modify: `src/lib/database/winery/storageVesselsDB.ts`
- Test: `tests/wine/storageVesselMaintenanceService.test.ts`

- [ ] **Step 1: Write failing type and database-mapping tests.**

Assert that every loaded vessel has required `cleanliness: 'clean' | 'dirty'`.

- [ ] **Step 2: Replace the existing schema shape.**

Add the cleanliness column in the new migration with no backfill. Development databases are recreated from the current schema when necessary.

- [ ] **Step 3: Replace affected RPC definitions.**

Require `operational_status = 'operational'` in allocation paths. Whenever an allocation receives positive `filled_litres`, mark that vessel dirty. Cover grape-market purchase, append-harvest, and the TypeScript activation path. Emptying, full consumption/sale, and bottling release allocations but leave vessels dirty.

Use database triggers to enforce clean allocation and mark vessels dirty on positive fill, then add `complete_clean_storage_vessel`. Do not retain obsolete contracts or duplicate every allocation RPC in this migration.

- [ ] **Step 4: Modify existing types and mapper in place.**

Add `StorageVesselCleanliness` and required `cleanliness` to `StorageVessel`, row parsing, row writing, and purchased-vessel creation. Add only the canonical `completeCleanStorageVessel` DB wrapper; remove any superseded wrapper or consumer.

- [ ] **Step 5: Run focused checks.**

Run: `npx vitest run tests/wine/storageVesselMaintenanceService.test.ts tests/wine/storageVesselAllocationService.test.ts`

Expected: PASS, with no removed RPC/wrapper imports.

### Task 2: Enforce clean storage and implement Cleaning Vessel

**Files:**

- Modify: `src/lib/services/wine/winery/storageVesselAllocationService.ts`
- Modify: `src/lib/services/wine/winery/storageVesselMaintenanceService.ts`
- Modify: `src/lib/services/activity/workcalculators/storageVesselMaintenanceWorkCalculator.ts`
- Modify: `src/lib/services/activity/activitymanagers/activityManager.ts`
- Test: `tests/wine/storageVesselMaintenanceService.test.ts`
- Test: `tests/wine/storageVesselAllocationService.test.ts`
- Test: `tests/activity/activityLifecycle.test.ts`

- [ ] **Step 1: Write failing lifecycle tests.**

Cover: dirty vessels remain allocatable but display a warning; an empty dirty vessel starts one cancellable `clean_storage_vessel` activity; clean, occupied, or already-cleaning vessels are rejected; completion makes it clean; cancellation leaves it dirty.

- [ ] **Step 2: Modify existing availability and capacity logic.**

Do not require `vessel.cleanliness === 'clean'` in availability calculations; cleanliness is currently warning-only. Keep availability based on operational state, occupancy, and active activities.

- [ ] **Step 3: Add the typed activity in the existing maintenance service.**

Use `targetId: vessel.id`, `WorkCategory.MAINTENANCE`, and `isCancellable: true`, so existing conflict detection prevents concurrent cleaning/emptying. Calculate cleaning work from `vessel.capacityLitres` using existing Maintenance constants, with cleaning-specific factor labels.

- [ ] **Step 4: Replace unconditional Maintenance completion with explicit dispatch.**

Dispatch only `empty_storage_vessel` and `clean_storage_vessel`, send matching notifications, and fail clearly for an unknown type. Do not leave an implicit Empty Vessel fallback.

- [ ] **Step 5: Run focused lifecycle tests.**

Run: `npx vitest run tests/wine/storageVesselMaintenanceService.test.ts tests/wine/storageVesselAllocationService.test.ts tests/activity/activityLifecycle.test.ts`

Expected: PASS.

### Task 3: Present and start cleaning from Equipment

**Files:**

- Modify: `src/components/pages/Equipment.tsx`
- Test: existing component coverage, or create `tests/components/equipment.test.tsx`

- [ ] **Step 1: Write the failing Equipment interaction test.**

Assert that an empty dirty vessel shows `Dirty` and `Clean Vessel`; confirmation starts the activity. A clean vessel has no cleaning action, and active cleaning disables the action and shows progress.

- [ ] **Step 2: Modify the existing vessel row in place.**

Show occupancy, operational status, and cleanliness together. Reuse the current WarningModal pattern for confirmation/error state. Only show Clean Vessel for an empty, dirty, operational vessel; do not add a cleaning page or Winery action.

- [ ] **Step 3: Run component and lifecycle tests.**

Run: `npx vitest run tests/components/equipment.test.tsx tests/wine/storageVesselMaintenanceService.test.ts tests/activity/activityLifecycle.test.ts`

Expected: PASS.

### Task 4: Verify lifecycle and update docs

**Files:**

- Modify: `docs/WineSystem_VariableRelationshipMap.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `readme.md`
- Test: `tests/wine/wineryLifecycle.test.ts`, `tests/sales/buyGrapeMarketService.test.ts`

- [ ] **Step 1: Cover actual wine-contact boundaries.**

Verify harvest, bulk purchase, and appended harvest make filled vessels dirty; Empty Vessel, full sale, and bottling leave released vessels dirty; cleaning is required before reallocation.

- [ ] **Step 2: Update lifecycle documentation.**

State: clean operational vessels are allocatable; wine contact makes them dirty; releasing wine does not clean them; Cleaning Vessel is cancellable Maintenance. Remove wording that says cleaning is deferred.

- [ ] **Step 3: Run verification.**

Run: `npx vitest run tests/wine/storageVesselMaintenanceService.test.ts tests/wine/storageVesselAllocationService.test.ts tests/activity/activityLifecycle.test.ts tests/wine/wineryLifecycle.test.ts tests/sales/buyGrapeMarketService.test.ts`

Run: `npx tsc -p tsconfig.json --noEmit`

Run: `git diff --check`

Expected: all checks pass, and no source imports a removed function or describes cleaning as deferred.

## Plan self-review

- Covers the complete rule: wine contact dirties a vessel; no allocation can reuse it before cleaning completes.
- Preserves Empty Vessel while making Maintenance dispatch explicit for both known activity types.
- Uses a deliberate clean cutover: no legacy-data support, backfill, fallback, deprecated wrapper, or compatibility migration.
