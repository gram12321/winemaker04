# Task 3 report — actual work and XP activity lifecycle

## Completed scope

- Refactored `progressActivities()` to calculate a shared preliminary staff-work allocation, resolve the actual persistable progress, proportionally clamp that allocation, then award XP only from the applied shares.
- Final-tick clamping, weather pauses/reductions, and harvest storage limits now all affect XP because XP is issued after the resolved `completedWork` delta.
- Added `getActivityGrapeContext()` in `activityWorkContext.ts`. It accepts a validated, snapshotted `GrapeVariety` only for Planting, Harvesting, Crushing, and Fermentation. It is used by tick calculation/XP, activity-progress preview, and assignment preview. Clearing, maintenance, and administrative activities cannot gain grape XP from an incidental `params.grape` value.
- Updated harvest partial-progress results to return the actual permitted `completedWork`, merged activity params, and optional pause status. `handlePartialHarvesting()` no longer writes the activity record itself. `activityManager` owns one combined activity update containing work, harvest params, and pause state.
- Storage clipping translates the permitted harvest quantity back into permitted work. The blocked remainder receives neither completed work nor XP.
- Updated assignment/progress preview work calculation to use the shared calculator, grape-context resolver, weather impact, and permanent research work multipliers used by the tick.
- Confirmed `completeActivityNow()` remains a direct completion path and awards no XP.
- Corrected stale calculator JSDoc that described the former 20%/1x–2x specialization model.

## Tests added/updated

`tests/activity/activityLifecycle.test.ts` now checks:

- final-tick XP equals the persisted final progress delta;
- a non-grape activity with an incidental grape parameter gets only broad-skill XP;
- storage-clipped harvesting awards only permitted work and persists progress/params/status exactly once;
- only validated grape snapshots on grape-aware categories resolve to grape context.

## Verification

Passed with safe dummy Supabase environment values:

```powershell
$env:VITE_SUPABASE_URL='http://127.0.0.1:54321'
$env:VITE_SUPABASE_ANON_KEY='test-key'
npx vitest run tests/activity/activityLifecycle.test.ts tests/activity/workCalculator.test.ts
git diff --check
```

Result: 2 files passed, 29 tests passed; `git diff --check` passed.

`npx tsc --noEmit --pretty false` was also run. Its failures are existing/in-progress Task 1 clean-cutover updates in staff UI/database/search files (`specializations`/`SPECIALIZED_ROLES` references), not Task 3 lifecycle code.

## Files touched by Task 3

- `src/lib/services/activity/activitymanagers/activityManager.ts`
- `src/lib/services/activity/activityWorkContext.ts`
- `src/lib/services/activity/index.ts`
- `src/lib/services/vineyard/vineyardManager.ts`
- `src/lib/services/activity/workcalculators/workCalculator.ts` (JSDoc only; calculator APIs were supplied by Task 2)
- `src/components/ui/modals/activitymodals/StaffAssignmentModal.tsx`
- `tests/activity/activityLifecycle.test.ts`

## Review-fix addendum

### Persistence is now the activity-tick gate

`progressActivities()` stores the combined progress/harvest-param update before
awarding XP or queuing completion. If `updateActivityInDb()` returns `false`, it
logs the failure and skips both actions. This keeps XP and completion effects
consistent with the persisted activity record.

Added lifecycle coverage proving a failed final-tick persistence attempt leaves
the activity present with its old work, awards no XP, and does not run removal.

### Shared assignment-preview context

Added exported `getActivityStaffWorkContext()`. It resolves, in one place:

- active-activity task counts (substituting the modal's candidate assignment
  for the current activity);
- validated grape context;
- permanent all-staff and research-specific work effects; and
- current weather work multiplier.

The weekly tick and activity-progress preview both use this helper. The staff
assignment modal now asynchronously resolves the same helper and feeds its
context into the shared allocation calculator; it no longer assumes every
candidate has only one task or omits weather/research effects.

Added parity coverage asserting the preview context and tick calculator receive
the same multitask count, Pinot Noir snapshot, severe-weather multiplier, and
research options.

### Review-fix verification

Re-ran with safe dummy Supabase environment values:

```powershell
$env:VITE_SUPABASE_URL='http://127.0.0.1:54321'
$env:VITE_SUPABASE_ANON_KEY='test-key'
npx vitest run tests/activity/activityLifecycle.test.ts tests/activity/workCalculator.test.ts
git diff --check
```

Result: 2 files passed, 31 tests passed; `git diff --check` passed.

The narrowed TypeScript output contained no Task 3 manager/context errors. It
continues to report the in-progress clean-cutover work in Staff Assignment and
staff-search code (`SPECIALIZED_ROLES` and `specializations` references), which
is outside this task's review fixes.
