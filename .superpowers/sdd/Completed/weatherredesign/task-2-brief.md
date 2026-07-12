### Task 2: Authoritative vineyard projection

**Files:**
- Create: `src/lib/features/weather/weatherVineyardService.ts`, `tests/weather/weatherVineyardService.test.ts`
- Modify: `src/lib/features/weather/weatherTypes.ts`, `src/lib/features/weather/index.ts`, `src/lib/services/vineyard/vineyardProgressionService.ts`
- Delete: `src/lib/services/vineyard/weatherImpactService.ts`, `tests/vineyard/weatherImpactService.test.ts`

- [ ] Write failing tests for ripeness growth, winter ripeness decline, health decline, zero baseline, bounded site exposure, concise amplified/buffered reason, planting progress, and research health multiplier.
- [ ] Run `npm test -- tests/weather/weatherVineyardService.test.ts` and confirm failure.
- [ ] Implement:

```ts
export function projectVineyardWeek(input: VineyardWeekProjectionInput): VineyardWeeklyProjection;
// effectiveMultiplier = 1 + (baseWeatherMultiplier - 1) * siteExposure
// finalDelta = normalDelta * effectiveMultiplier
// weatherContribution = finalDelta - normalDelta
```

- [ ] Retain only seasonal baseline helpers in `vineyardProgressionService.ts`; remove raw delta/pressure types, duplicate tables, and weather-specific composition.
- [ ] Run `npm test -- tests/weather/weatherVineyardService.test.ts` and confirm it passes.

Global constraints: preserve all six states and five intensities; weather modifies seasonal baseline only; winter decline is included; no direct yield/wine effects; preserve current site inputs but hide coefficient mechanics; do not commit.
