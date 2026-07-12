### Task 1: Types, resolver, and weather persistence

**Files:**
- Create: `src/lib/constants/weatherConstants.ts`, `src/lib/features/weather/weatherTypes.ts`, `src/lib/features/weather/weatherResolver.ts`, `src/lib/features/weather/index.ts`, `tests/weather/weatherResolver.test.ts`, `migrations/20260710100000_add_game_state_weather_context.sql`
- Modify: `src/lib/types/types.ts`, `src/lib/constants/index.ts`, `src/lib/database/core/gamestateDB.ts`

- [ ] Write failing tests for deterministic resolution, all five intensity values, forecast confidence hit/miss behavior, and database weather-field round trips.
- [ ] Run `npm test -- tests/weather/weatherResolver.test.ts` and confirm it fails because the module is absent.
- [ ] Implement and export:

```ts
export interface WeatherWeekContext {
  date: GameDate;
  state: WeatherState;
  intensity: WeatherIntensity;
  seasonalPattern: WeatherForecastPattern;
  forecast: { state: WeatherState; intensity: WeatherIntensity; confidence: WeatherForecastConfidence };
}
export function resolveWeatherWeek(input: ResolveWeatherWeekInput): WeatherWeekContext;
```

- [ ] Add nullable weather columns to `game_state`; map all six fields through database save/load; keep the current five-tier union unchanged.
- [ ] Run `npm test -- tests/weather/weatherResolver.test.ts` and confirm it passes.

Global constraints: preserve all six weather states and five intensity tiers; only the weather module owns resolution constants; keep weather facts company-scoped; do not commit.
