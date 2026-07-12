### Spec Compliance

- ❌ Issues found: the requested deletion of the legacy weather-impact seam is present (`src/lib/services/vineyard/weatherImpactService.ts` and `tests/vineyard/weatherImpactService.test.ts` are deleted in working-tree status), but immediate consumers remain unmigrated. `src/lib/services/vineyard/vineyardManager.ts:13` and `src/lib/services/vineyard/weatherCenterService.ts:3` still import the deleted module, while `src/components/pages/winepedia/WeatherTab.tsx:9` imports its deleted exports. This violates the binding sequencing constraint that removal completes only once consumers move and leaves the application unable to resolve those imports. No tick/UI integration was attempted in the new module itself, as required for this task.
- ✅ The authoritative formula is implemented as specified: `effectiveMultiplier = 1 + (baseMultiplier - 1) * siteExposure`, `finalDelta = normalDelta * effectiveMultiplier`, and `weatherContribution = finalDelta - normalDelta` in `src/lib/features/weather/weatherVineyardService.ts:96-103`.
- ✅ The five intensity tiers and all six states remain represented with exhaustive typed multiplier tables in `src/lib/constants/weatherConstants.ts:78-98`; the existing canonical lists retain `VeryMild`, `Mild`, `Moderate`, `Severe`, and `Extreme` at `src/lib/constants/weatherConstants.ts:11-12`.
- ✅ Weather composes only with seasonal baselines: ripeness and health baselines are calculated before applying the weather multiplier in `src/lib/features/weather/weatherVineyardService.ts:121-138,142-157`. Winter decline is explicitly included at `src/lib/features/weather/weatherVineyardService.ts:121-130`, and a zero baseline returns zero final delta and contribution at `src/lib/features/weather/weatherVineyardService.ts:91-104`.
- ✅ Site mechanics are contained inside the weather projection service (`src/lib/features/weather/weatherVineyardService.ts:27-89`), bounded at `:88`, and exposed as concise player-safe notes at `:107-110,158-159`; the public output does not expose raw coefficients.
- ⚠️ Cannot verify from this task-only review: whether the new multiplier values preserve the design's intended game balance, because the approved specification/brief gives no target numeric values. The Task 3/5 integration should verify the new public `WeatherWeekContext` and projection contract end-to-end.

### Strengths

- `src/lib/features/weather/weatherVineyardService.ts:91-105` centralizes metric projection in one small helper, ensuring ripeness and health use the same authoritative equation without duplicating composition logic.
- `tests/weather/weatherVineyardService.test.ts:42-135` exercises real projection behavior—including winter decline, zero baselines, bounded exposure, planting progress, and research multiplier inputs—rather than mocking the module under test.
- `src/lib/services/vineyard/vineyardProgressionService.ts:45-129` now retains only seasonal-baseline and growth-eligibility concerns; weather-specific pressure/delta composition has been removed from that service.

### Issues

#### Critical (Must Fix)

- None.

#### Important (Should Fix)

- `src/lib/services/vineyard/weatherImpactService.ts` (deleted); `src/lib/services/vineyard/vineyardManager.ts:13`; `src/lib/services/vineyard/weatherCenterService.ts:3`; `src/components/pages/winepedia/WeatherTab.tsx:9`: deleting the exported service while these direct consumers still import it causes unresolved-module/typecheck failures and contradicts the plan-level removal sequencing constraint. Restore the legacy seam temporarily, or migrate all direct consumers in the same atomic change before retaining the deletion. The immediate legacy test mock at `tests/vineyard/weatherCenterService.test.ts:10-11` must move with its service consumer.

#### Minor (Nice to Have)

- `tests/weather/weatherVineyardService.test.ts:106-107`: the exposure-bound assertion duplicates the configured literal limits instead of importing `WEATHER_SITE_EXPOSURE_BOUNDS`; importing the named contract would keep the test aligned if the bound is deliberately retuned.

### Assessment

**Task quality:** Needs fixes

**Reasoning:** The new projection module is compact, formula-correct, and well tested within its scope, but the legacy-service deletion makes the current checkout structurally broken before its scheduled consumers are migrated. That integration issue must be resolved before this task can be trusted as a mergeable unit.
