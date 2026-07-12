# Task 6 Report: Legacy Removal, Documentation, and Verification

## Status

DONE — final completion verified after the user applied the Supabase migration.

## Delivered

- Moved the final seasonal forecast resolver into the public `@/lib/features/weather` facade as `resolveSeasonalWeatherForecast`.
- Replaced core game-state and tick imports with the weather facade, then deleted the legacy finance weather service and removed its generic services-barrel export.
- Removed the obsolete vineyard weather-impact compatibility service and its legacy test.
- Updated weather integration tests so all weather-module mocks consume the public facade; added the new facade export to the core tick mock.
- Updated active project documentation for five intensity tiers, company-scoped persisted weather facts, shared vineyard projection, Weather Center operational use, and Winepedia technical-reference use.
- Marked the former phase-2 design and the stale test-expansion checklist as historical/superseded, and updated the redesign design status to implemented.

## Verification

| Command | Result |
|---|---|
| `npm test` | Passed: 56 files, 338 tests, 1 skipped. |
| `npx tsc -p tsconfig.json --noEmit` | Passed. |
| `git diff --check` | Passed. |
| Required stale-reference search | No matches under `src` or `tests`; remaining results are version history, historical/superseded documents (including the old checklist), and the implementation plan's deletion record. |

Final sanitation also moved the Sell Grapes modal's remaining market-index calculation into `sellGrapesService`, so the modal no longer owns that technical business logic.

## Notes

- An existing local app instance was found for a rendered smoke check, but the in-app browser connection was rejected by the execution environment before it could load the page. Static verification and the full automated suite passed.
- The user applied `20260710100000_add_game_state_weather_context.sql` in Supabase.
- No commit was created.
