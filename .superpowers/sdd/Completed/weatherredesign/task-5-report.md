# Task 5 Report: Presentation models, compact UI, and Winepedia reference

Status: DONE

## Delivered

- Added `weatherPresentationService` behind the public `@/lib/features/weather` facade.
  - Creates a weather-week context from game state.
  - Provides module-owned weather icons and labels.
  - Builds compact Weather Center models, Vineyard tooltip models, and a complete Winepedia reference model.
- Replaced the Weather Center with only the operational decision surfaces: current conditions, next-week forecast and confidence, seasonal outlook, three global outlooks, and Vineyard Weather Impact Preview.
- Simplified Vineyard operational tooltips to normal change, weather contribution, projected level, and a concise site note. Removed coefficient/site-factor/formula rendering.
- Updated the Header and buy/sell market presentations to use module-owned weather labels/icons, with current and next-week wording distinguished.
- Replaced Winepedia Weather with the technical reference: formula, six-state/five-intensity vineyard matrix, market derivation matrix, site bounds, forecast behavior, and implemented scope.
- Deleted `weatherCenterService.ts` and its obsolete tests after all consumers migrated.

## Verification

- `npm test -- tests/weather/weatherPresentationService.test.ts tests/vineyard/weatherCenterPage.test.ts` — 5 passed.
- `npx tsc --noEmit` — passed.
- `git diff --check` — passed.
- Stale-import search for the deleted Weather Center service and its public functions — no matches.

## Scope notes

- No tick, persistence, or market mechanics were changed in this task.
- No commits were created.

## Reviewer-fix follow-up

- Removed the Header seasonal-outlook line.
- Added an expandable, plain-language “Why this forecast?” explanation for each Weather Center vineyard row.
- Extended Winepedia’s market reference to render the complete state × intensity numeric price/supply derivation matrix.
- Removed weather-volatility multiplier badges, risk/pressure labels, and raw pricing formulas from the buy/sell operational surfaces while retaining concise market outlook labels.
- Removed the unused buy-modal weather icon helper and used `getWeatherLabel()` in the sell modal.
- Re-ran focused tests, `npx tsc --noEmit`, and `git diff --check`: all passed.

## Final reviewer-fix follow-up

- Header’s next-week forecast now includes its confidence tier without restoring a seasonal-outlook line.
- Weather Center now shows each row’s site note directly and retains its separate expandable explanation.
- Added focused assertions for forecast confidence, the visible site note/disclosure, and numeric market-matrix cells.
