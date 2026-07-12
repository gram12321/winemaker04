# Task 1 report: Types, resolver, and weather persistence

## Status

DONE

## Files changed

- Created `src/lib/constants/weatherConstants.ts` with the weather resolution tables, all six states, all five intensity tiers, forecast hit rates, and forecast neighbors.
- Created `src/lib/features/weather/weatherTypes.ts`, `weatherResolver.ts`, and `index.ts` with the public `WeatherWeekContext`, `ResolveWeatherWeekInput`, and `resolveWeatherWeek` contract.
- Updated `src/lib/constants/index.ts` to export the weather constants.
- Updated `src/lib/database/core/gamestateDB.ts` to save and load all six company-scoped weather fields.
- Annotated the existing GameState weather fields in `src/lib/types/types.ts` as persisted company-scoped context.
- Created `migrations/20260710100000_add_game_state_weather_context.sql` with nullable game-state weather columns.
- Created `tests/weather/weatherResolver.test.ts`.

## TDD evidence

### RED

Command:

```text
npm test -- tests/weather/weatherResolver.test.ts
```

Result: failed as expected before implementation because `@/lib/features/weather` did not exist (`Failed to resolve import`).

### GREEN

Command:

```text
npm test -- tests/weather/weatherResolver.test.ts
```

Result: passed after implementation. Final run is recorded below.

## Final verification

```text
npm test -- tests/weather/weatherResolver.test.ts
```

Result: 1 test file passed; 7 tests passed.

```text
git diff --check
```

Result: passed with no whitespace errors.

## Self-review

- The resolver is deterministic from company id, game date, seasonal pattern, confidence, and prior state.
- The tests cover deterministic output, all six states, all five intensities, forecast hit/miss behavior for Low/Medium/High confidence, and database save/load mapping for all six weather fields.
- Resolution constants live only in the new weather constants module. No runtime consumer was migrated in this task; later tasks own that integration and removal work.
- The migration uses nullable columns, preserving existing company rows until the subsequent resolver/tick integration initializes their weather context.
- No commits were created.

## Concerns

- This contract task intentionally does not yet wire the new resolver into the game tick or replace the existing finance weather service. Those are later-plan integrations; retaining the old service temporarily avoids breaking current consumers.
