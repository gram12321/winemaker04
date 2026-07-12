# Task 3 Report: Weather-limited activity progress

## Implementation

Updated `progressActivities` so that it captures the persisted current weather once per weekly tick and resolves the operation impact for active planting and harvesting activities only.

- Severe and extreme weather applies the resolver's work multiplier to the tick's staff contribution.
- Forced pauses produce zero work and zero XP for that tick.
- The multiplier is evaluated every tick, so a changing weather state immediately changes the next contribution.
- Clearing and every other activity category retain a multiplier of `1` and their existing work/XP path.
- Activity `totalWork` is not recalculated or mutated; weather affects only `workThisTick`.
- Existing completion/removal flow remains unchanged after weather-adjusted work reaches `totalWork`.

## Tests added

Added lifecycle coverage for:

- Severe-weather planting slowdown while clearing progresses normally.
- Extreme-storm forced pause with zero planting progress and no planting XP.
- Returning to normal weather on the next tick.
- Harvest completion/removal when weather-adjusted progress reaches total work.

## Self-review

Reviewed the runtime scope and verified the weather branch is guarded to `PLANTING` and `HARVESTING`. The existing workload calculators were deliberately left unchanged: they continue to calculate and store weather-neutral total work, while the new logic applies only during weekly progression. Tick ordering was not changed.

The weather resolver currently requires a vineyard context even though these operational limits only use weather and season. The runtime adapter supplies the category-appropriate minimal context and deliberately avoids adding per-activity database reads to the weekly tick.

## Verification

- `npx tsc -p tsconfig.json --noEmit` passed.
- `git diff --check` passed.
- `npx vitest run tests/activity/activityLifecycle.test.ts tests/weather/weatherTickIntegration.test.ts` passed: 2 files, 10 tests.

## Scope notes

Only Task 3 behavior was added to the activity manager and lifecycle test. The workspace contained pre-existing Task 1/2 and unrelated changes, including prior edits in the same activity manager/test files; those were preserved and not reverted. No commit was created.

## Follow-up review finding fix

Added a weekly-tick seam regression in `tests/core/gameTick.test.ts`. It resolves an Extreme Storm during `processGameTick`, verifies that the identical resolved weather is sent to both vineyard progression operations, and records the weather present when `progressActivities` begins. This proves the activity-progress boundary receives the newly resolved weather only after vineyard progression, without changing tick order.

Added calculator regressions in `tests/activity/activityLifecycle.test.ts` which calculate planting and harvesting total work under Clear/Mild and Extreme Storm weather and assert the totals are identical. The test controls only weather fields while holding all calculator inputs constant.

### Follow-up verification

- `npx tsc -p tsconfig.json --noEmit` passed (exit code 0).
- `git diff --check` passed (exit code 0).

### Exact focused test output

Command:

```text
npx vitest run tests/core/gameTick.test.ts tests/activity/activityLifecycle.test.ts tests/weather/weatherTickIntegration.test.ts
```

Output:

```text
RUN  v4.0.18 C:/GitHub/winemaker04

✓ tests/core/gameTick.test.ts (4 tests) 1300ms
  ✓ makes newly resolved weather available to activity progress after vineyard progression 1290ms
✓ tests/activity/activityLifecycle.test.ts (8 tests) 1699ms
  ✓ creates an active activity, auto-assigns the matching team, and refreshes state 1653ms
✓ tests/weather/weatherTickIntegration.test.ts (3 tests) 2218ms
  ✓ uses persisted weather on company initialization instead of resolving it again 2211ms

Test Files  3 passed (3)
     Tests  15 passed (15)
  Start at  13:03:11
  Duration  4.17s (transform 3.28s, setup 0ms, import 503ms, tests 5.22s, environment 4.50s)

stderr | tests/activity/activityLifecycle.test.ts > activity lifecycle > rejects planting against the current Winter state before saving the activity and returns the weather reason
Cannot create planting activity: Planting is unavailable in Winter.

stderr | tests/activity/activityLifecycle.test.ts > activity lifecycle > rejects planting against the current Winter state before saving the activity and returns the weather reason
Cannot create planting activity: Planting is unavailable in Winter.
```

## Test-isolation follow-up

The weather-neutral calculator regression now explicitly proves that `calculatePlantingWork` consumes the mocked direct `@/lib/services/core/gameState` dependency: it clears the mock, calculates under Clear/Mild, asserts one direct game-state read, replaces only the mock's weather fields with Storm/Extreme, recalculates, and asserts a second direct read while total work remains unchanged. This prevents the regression from accidentally reading an unmocked game-state singleton.

### Exact focused test output

Command:

```text
npx vitest run tests/core/gameTick.test.ts tests/activity/activityLifecycle.test.ts tests/weather/weatherTickIntegration.test.ts
```

Output:

```text
RUN  v4.0.18 C:/GitHub/winemaker04

✓ tests/core/gameTick.test.ts (4 tests) 2394ms
  ✓ makes newly resolved weather available to activity progress after vineyard progression 2354ms
✓ tests/activity/activityLifecycle.test.ts (8 tests) 3257ms
  ✓ creates an active activity, auto-assigns the matching team, and refreshes state 3216ms
✓ tests/weather/weatherTickIntegration.test.ts (3 tests) 3950ms
  ✓ uses persisted weather on company initialization instead of resolving it again 3939ms

Test Files  3 passed (3)
     Tests  15 passed (15)
  Start at  13:05:58
  Duration  8.14s (transform 6.97s, setup 0ms, import 2.49s, tests 9.60s, environment 8.80s)

stderr | tests/activity/activityLifecycle.test.ts > activity lifecycle > rejects planting against the current Winter state before saving the activity and returns the weather reason
Cannot create planting activity: Planting is unavailable in Winter.

stderr | tests/activity/activityLifecycle.test.ts > activity lifecycle > rejects planting against the current Winter state before saving the activity and returns the weather reason
Cannot create planting activity: Planting is unavailable in Winter.
```
