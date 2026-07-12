# Task 3 report: Tick contract and shared yield calculation

## Status

DONE_WITH_CONCERNS — Task 3 scope is implemented and no commit was created.

## Changes

- `gameState` now reads persisted weather on company activation and only resolves a new `WeatherWeekContext` when the persisted weather context is absent. It persists the initialized context and persists every weather update through `updateGameState`.
- `gameTick` now calls the weather feature resolver, persists the resolved weekly context, applies ripeness and health progression, then calls `progressActivities`.
- `vineyardManager` now accepts `WeatherWeekContext` and uses `projectVineyardWeek` for both ripeness and health. Planting progress and the research health-decay multiplier are passed to the feature projection.
- Added `calculateVineyardYieldBreakdown(vineyard)` as the single yield calculation source. Actual harvest yield delegates to it; `calculateVineyardExpectedYield` delegates to it while preserving its existing UI breakdown shape.
- Added integration coverage for persisted-versus-absent weather initialization, tick ordering/context propagation, and expected/actual yield parity.

## TDD evidence

### RED

```text
npm test -- tests/weather/weatherTickIntegration.test.ts tests/core/gameTick.test.ts tests/vineyard/yieldCalculator.test.ts
```

Failed as expected before integration: the new shared yield-breakdown export did not exist and the tick still supplied the old weather-context shape/order.

### GREEN

```text
npm test -- tests/weather/weatherTickIntegration.test.ts tests/core/gameTick.test.ts tests/vineyard/yieldCalculator.test.ts
```

Passed: 3 files, 18 tests.

```text
git diff --check
```

Passed.

## Second review-fix evidence

- The winter ripeness projection now receives the already-calculated `plantingProgressRatio`, alongside the research health-decay modifier.
- Added a winter planting lifecycle regression case that asserts both modifier inputs reach the projection.

```text
npm test -- tests/weather/weatherTickIntegration.test.ts tests/core/gameTick.test.ts tests/vineyard/yieldCalculator.test.ts tests/vineyard/vineyardLifecycle.test.ts
```

Passed: 4 files, 25 tests.

```text
git diff --check
```

Passed.

## Concern

`npx tsc -p tsconfig.json --noEmit` still fails in the pre-existing remaining Task 5 consumer `src/lib/services/vineyard/weatherCenterService.ts`, which imports `calculateVineyardWeeklyProjection` removed by Task 2. This task intentionally did not modify UI/Weather Center scope. Task 3's own unused-import errors were fixed before this report.

## Review-fix evidence

- Added tick-level assertions that the resolved weather context is included in the state update and that both ripeness and health progression complete before `progressActivities`.
- Added an integration assertion that every weather-bearing `updateGameState` call persists all resolved weather facts.
- Every `projectVineyardWeek` call from the vineyard manager now receives both applicable modifiers: planting progress and the research health-decay multiplier. A lifecycle regression test verifies that propagation for both ripeness and health paths.
- Renamed the stale economy-only persistence error message to `Failed to save game state to game_state`.

```text
npm test -- tests/weather/weatherTickIntegration.test.ts tests/core/gameTick.test.ts tests/vineyard/yieldCalculator.test.ts tests/vineyard/vineyardLifecycle.test.ts
```

Passed: 4 files, 24 tests.

```text
git diff --check
```

Passed.
