# Task 2: Authoritative vineyard projection

## Status

DONE_WITH_CONCERNS — Task-scoped module work is complete. No commit was created.

## Changes

- Added `projectVineyardWeek(input)` to the public weather-module facade.
- Added public projection input/output types for normal delta, weather contribution, final delta, projected value, bounded site exposure, and concise site note.
- Moved weather composition into `weatherVineyardService.ts`, preserving seasonal baseline helpers in `vineyardProgressionService.ts`.
- Added named weather constants for all state × intensity vineyard multipliers and site-exposure tuning.
- Removed the old weather-impact service, its tests, and its stale service-barrel export, as requested by Task 2.

## TDD evidence

- RED: `npm test -- tests/weather/weatherVineyardService.test.ts` failed with all 8 tests because `projectVineyardWeek` was not yet exported/implemented.
- GREEN: `npm test -- tests/weather/weatherVineyardService.test.ts` passed: 1 file, 8 tests.
- Verification: `git diff --check` passed.

The new test suite covers ripeness growth, winter ripeness decline, health decline, zero baselines, bounded site exposure, concise amplified/buffered notes, planting progress, and research health-decay multiplier inputs.

## Sanitation sweep

The required Task 2 scope sweep found no UI business logic or misplaced CRUD. It required moving weather tuning out of the service; this was addressed by adding named entries to `src/lib/constants/weatherConstants.ts`.

## Concerns / dependent work

The Task 2 delete instruction conflicts with the plan-level sequencing constraint that legacy seams remain until consumers are migrated. Per controller instruction, the legacy service remains deleted and these immediate dependent tasks must migrate before a full typecheck/full suite:

- `src/lib/services/vineyard/vineyardManager.ts` imports the removed impact context and projection function.
- `src/lib/services/vineyard/weatherCenterService.ts` imports the removed impact types and projection function.
- `src/components/pages/winepedia/WeatherTab.tsx` imports the removed impact-service exports.
- `tests/vineyard/weatherCenterService.test.ts` mocks the removed service.

Task 3 should migrate tick/vineyard-manager usage to `WeatherWeekContext` and `projectVineyardWeek`; Task 5 should replace/remove the Weather Center and Winepedia legacy usages and their tests.

Running both Task 1 and Task 2 tests together passed all 15 assertions but surfaced an existing AuthService unhandled rejection originating from Task 1 test setup. The Task 2 focused command is clean.

## Review-fix evidence

- Restored `weatherImpactService.ts` and its focused compatibility tests through `apply_patch` (no checkout/reset).
- Marked the legacy service as deprecated; new code remains owned by `@/lib/features/weather`.
- Re-ran `npm test -- tests/weather/weatherVineyardService.test.ts tests/vineyard/weatherImpactService.test.ts`: 2 files, 10 tests passed.
- Re-ran `git diff --check`: passed.

## Second review-fix evidence

- Restored the complete eight-direction aspect response mapping in the temporary legacy compatibility seam.
- Added a Northeast heat-response regression test.
- Re-ran `npm test -- tests/weather/weatherVineyardService.test.ts tests/vineyard/weatherImpactService.test.ts`: 2 files, 11 tests passed.
- Re-ran `git diff --check`: passed.
