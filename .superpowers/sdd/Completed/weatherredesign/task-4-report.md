# Task 4: Market adapter report

## Status

Complete. No commit created.

## Changes

- Added `weatherMarketService` to the weather feature with the public `WeatherMarketContext` contract and `getWeatherMarketContext(weather)` adapter.
- Kept all six weather states and all five intensity tiers, with bounded price and supply multipliers plus the preserved market explanation text.
- Moved state/intensity-specific market pressure, intensity scaling, and weather themes out of `grapeBuyerMarketConstants.ts` into the weather module.
- Updated the grape buyer market service to create a `WeatherWeekContext` from persisted game state and consume only the weather module API. Seasonal, economy, year-cycle, buyer sensitivity, research, loyalty, and sentiment logic remain in the market service.
- Exported the adapter from the weather feature barrel.
- Added behavior-first coverage for every weather state/intensity combination.

`buyGrapeMarketService.ts` and `sellGrapesService.ts` required no direct edits: they consume market demand factors prepared by `grapeBuyerMarketService` and neither imports or owns direct weather tuning.

## TDD evidence

RED:

```text
npm test -- tests/weather/weatherMarketService.test.ts
30 failed: getWeatherMarketContext is not a function
```

GREEN:

```text
npm test -- tests/weather/weatherMarketService.test.ts tests/sales
8 files passed, 57 tests passed
```

## Verification

- `npm test -- tests/weather/weatherMarketService.test.ts tests/sales` — passed (57 tests)
- `git diff --check` — passed

## Self-review

- Existing multiplier values and weather explanation text are preserved exactly.
- No UI or tick behavior was changed.

## Follow-up: Winepedia technical reference import

- Updated `WeatherTab` to import its unchanged market-pressure and intensity tables from `@/lib/features/weather`, rather than the deleted grape-buyer constants exports.
- Exported those technical tables from `weatherMarketService`; no WeatherTab layout or rendered behavior changed.
- Re-ran `npm test -- tests/weather/weatherMarketService.test.ts tests/sales` — passed (57 tests).
- `npx tsc --noEmit` reaches the Winepedia change without an error, but currently fails on an unrelated concurrent refactor: `weatherCenterService.ts` imports `calculateVineyardWeeklyProjection` from `vineyardProgressionService`, which no longer exports it.
- `git diff --check` — passed.
- No market season, economy, sentiment, buyer sensitivity, loyalty, or research calculation moved into the weather module.

## Task review

PASS — no Critical or Important issues found. The review confirmed that the adapter preserves all six states, five intensity tiers, existing pressure/scaling/theme values, explanatory string construction, and market offer fields while leaving non-weather market logic in its existing service.
