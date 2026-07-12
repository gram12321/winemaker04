# Task 2 Report: Move operation validation behind the weather boundary

## Implementation

- Added final creation-time validation in `activityManager.ts` for planting and harvesting activities.
  - Loads the target vineyard and passes the current `WeatherWeekContext`, operation, explicit season, and vineyard `status`/`ripeness` to `resolveWeatherOperationImpact` through `@/lib/features/weather`.
  - Rejects an unavailable weather operation before activity conflict checks or persistence, preserving existing non-weather validation and conflict behavior.
  - Does not apply weather work/progress multipliers; that remains Task 3 work.
- Replaced `Vineyard.tsx`'s local Winter planting rule with the shared resolver and its returned reason in the disabled action tooltip.
- Added weather operation checks to the planting and harvesting option modals. Their submit controls and disabled messages now use the resolver result; unavailable submissions also show the concise resolver reason.
- Preserved the Winter transition cleanup in `vineyardManager.ts`; it was not changed.
- Added lifecycle regressions covering Winter planting rejection and weather-permitted planting/harvesting creation.

## Self-review

- All weather imports use the public feature barrel (`@/lib/features/weather`).
- Service validation uses the requested current weather context and explicit season, rather than duplicating seasonal rules.
- Weather rejection occurs before `saveActivityToDb`, so direct service callers cannot create Winter planting activities.
- Existing generic activity creation, assignment, notification, conflict, and vineyard transition behavior were left intact.
- No runtime progress multiplier or pause behavior was implemented.

## Verification

- `npx tsc -p tsconfig.json --noEmit` — passed.
- `git diff --check` — passed.
- `npm test -- tests/activity/activityLifecycle.test.ts tests/vineyard/vineyardLifecycle.test.ts` — passed: 2 files, 11 tests.

The Winter rejection test intentionally emits the activity-manager warning: `Cannot create planting activity: Planting is unavailable in Winter.`

## Scope / concerns

- Only Task 2 implementation files, its specified activity lifecycle test, and this report were changed. `tests/vineyard/vineyardLifecycle.test.ts` was run unchanged because it already protects the required Winter cleanup behavior.
- The workspace contained pre-existing unrelated edits and untracked Task 1/weather files; they were preserved. No commit was created.

## Review findings follow-up

### Exact changes

- Added `createActivityWithResult` alongside the existing `createActivity` API. It preserves existing callers' `string | null` contract while returning `{ activityId, reason? }` to callers that need a rejection explanation.
- Weather rejections now return the exact `resolveWeatherOperationImpact` reason through this result, including `Planting is unavailable in Winter.`
- Changed `PlantingOptionsModal` to create the planting activity first. That service call resolves the current game state at submission time and performs the authoritative weather validation before `initializePlanting` is allowed to mutate the vineyard.
- If planting initialization subsequently fails, the newly created activity is cancelled and the existing initialization error is shown.
- Changed both planting and harvest modals to display a service-supplied rejection reason rather than replacing it with the generic creation failure message.
- Extended the lifecycle regression to set a prior Summer state, advance it to Winter before creation, and assert that the detailed service result rejects the operation, returns the concise reason, and does not persist an activity. The legacy `createActivity` return contract is also asserted.
- No Task 3 work multiplier or runtime progress behavior was added.

### Exact verification command and output

Command:

```text
npx tsc -p tsconfig.json --noEmit; git diff --check; npm test -- tests/activity/activityLifecycle.test.ts tests/vineyard/vineyardLifecycle.test.ts
```

Output:

```text
Test Files  2 passed (2)
Tests       11 passed (11)
```

`npx tsc -p tsconfig.json --noEmit` and `git diff --check` completed successfully before the test command. The intentional Winter rejection regression emitted the expected manager warning twice (once for the detailed API and once for the compatibility wrapper):

```text
Cannot create planting activity: Planting is unavailable in Winter.
```
