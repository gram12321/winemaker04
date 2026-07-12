# Weather Module Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragmented weather code with one persisted weather module used by vineyard progression, markets, and player-facing forecast surfaces.

**Architecture:** `src/lib/features/weather/` owns deterministic resolution, vineyard projection composition, weather-only market context, and presentation models. Vineyard services retain seasonal baselines. The tick resolves and persists weather, applies vineyard progression, then progresses activities. Operational UI consumes outcomes; Winepedia consumes technical reference models.

**Tech Stack:** React 19, TypeScript, Vitest, Tailwind/ShadCN, Supabase migrations.

---

## Global constraints

- Preserve states `Clear`, `Rain`, `Heat`, `Frost`, `Storm`, `Snow` and intensities `VeryMild`, `Mild`, `Moderate`, `Severe`, `Extreme`.
- Weather is a bounded modifier of normal health/ripeness progression; it has no direct yield, wine-score, or harvest-anchor input.
- Tick, previews, and harvest use the same complete projection inputs, including planting progress and research health-decay multiplier.
- Persist current weather, forecast, seasonal pattern, and confidence company-scoped in `game_state`.
- Operational UI shows outcomes only. Winepedia contains formulas, matrices, factors, bounds, and market derivation.
- No weather events, actions, research, achievements, or activity-work effects.
- Do not commit. The user authorized work in the current `main` workspace.

## Planned file structure

| Path | Responsibility |
|---|---|
| `src/lib/constants/weatherConstants.ts` | All weather tuning and player labels. |
| `src/lib/features/weather/weatherTypes.ts` | Public context, projection, market, and presentation types. |
| `src/lib/features/weather/weatherResolver.ts` | Pure seasonal/current/forecast resolution. |
| `src/lib/features/weather/weatherVineyardService.ts` | Pure baseline × weather projection and site note. |
| `src/lib/features/weather/weatherMarketService.ts` | Weather-only market multipliers and reason. |
| `src/lib/features/weather/weatherPresentationService.ts` | Player-safe Header, Vineyard, Center, and Winepedia models. |
| `src/lib/features/weather/index.ts` | Only supported weather-module imports. |

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

### Task 3: Tick contract and shared yield calculation

**Files:**
- Modify: `src/lib/services/core/gameState.ts`, `src/lib/services/core/gameTick.ts`, `src/lib/services/vineyard/vineyardManager.ts`, `src/lib/services/vineyard/vineyardService.ts`, `src/lib/services/index.ts`
- Create: `tests/weather/weatherTickIntegration.test.ts`
- Modify: `tests/core/gameTick.test.ts`, `tests/vineyard/yieldCalculator.test.ts`

- [ ] Write failing integration tests proving weather is initialized only when absent, persisted every tick, applied before `progressActivities`, and passed with planting/research modifiers to the shared projection.
- [ ] Write yield parity assertions: expected yield and actual harvest yield derive from one `calculateVineyardYieldBreakdown(vineyard)` source.
- [ ] Run `npm test -- tests/weather/weatherTickIntegration.test.ts tests/core/gameTick.test.ts tests/vineyard/yieldCalculator.test.ts` and confirm failure.
- [ ] Integrate resolver and projection. Tick order is: advance calendar, resolve/persist weather, apply vineyard progression, then progress activities.
- [ ] Run the same command and confirm it passes.

### Task 4: Market adapter

**Files:**
- Create: `src/lib/features/weather/weatherMarketService.ts`, `tests/weather/weatherMarketService.test.ts`
- Modify: `src/lib/features/weather/index.ts`, `src/lib/constants/grapeBuyerMarketConstants.ts`, `src/lib/services/sales/grapeBuyerMarketService.ts`, `src/lib/services/sales/buyGrapeMarketService.ts`, `src/lib/services/sales/sellGrapesService.ts`

- [ ] Write failing tests that every state/intensity yields bounded price/supply multipliers and a reason through `WeatherMarketContext`.
- [ ] Run `npm test -- tests/weather/weatherMarketService.test.ts` and confirm failure.
- [ ] Implement `getWeatherMarketContext(weather: WeatherWeekContext): WeatherMarketContext`; leave market-specific season, economy, buyer sensitivity, and sentiment logic in market services.
- [ ] Replace market-service imports of direct weather tables with the module API; preserve market offer fields and explanatory text.
- [ ] Run `npm test -- tests/weather/weatherMarketService.test.ts tests/sales` and confirm it passes.

### Task 5: Presentation models, compact UI, and Winepedia reference

**Files:**
- Create: `src/lib/features/weather/weatherPresentationService.ts`, `tests/weather/weatherPresentationService.test.ts`
- Modify: `src/lib/features/weather/index.ts`, `src/components/pages/WeatherCenter.tsx`, `src/components/pages/Vineyard.tsx`, `src/components/layout/Header.tsx`, `src/components/pages/winepedia/WeatherTab.tsx`, `src/components/ui/modals/activitymodals/SellGrapesModal.tsx`, `src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx`
- Replace: `tests/vineyard/weatherCenterPage.test.ts`
- Delete: `src/lib/services/vineyard/weatherCenterService.ts`, `tests/vineyard/weatherCenterService.test.ts`

- [ ] Write failing tests for a Center model with current weather, forecast, confidence, seasonal outlook, three global outlooks, and concise vineyard rows; a Vineyard tooltip model with normal change, weather contribution, projection, site note; and a Winepedia reference model with technical matrices.
- [ ] Run `npm test -- tests/weather/weatherPresentationService.test.ts tests/vineyard/weatherCenterPage.test.ts` and confirm failure.
- [ ] Rebuild Weather Center with only approved decision surfaces. Retain the Vineyard Weather Impact Preview; delete legend, trigger matrix, site cards/meters, formulas, comparison/debug panels, and planned alerts.
- [ ] Remove coefficient/formula rendering from Vineyard. Keep Header compact. Make buy/sell modals use module-provided weather labels/icons.
- [ ] Build Winepedia Weather as the technical reference, following `WineQualityTab.tsx`: formula, all state × intensity matrices, site rules/bounds, forecast behavior, market derivation, and scope.
- [ ] Run `npm test -- tests/weather/weatherPresentationService.test.ts tests/vineyard/weatherCenterPage.test.ts` and confirm it passes.

### Task 6: Remove legacy seams, synchronize docs, and verify

**Files:**
- Delete: `src/lib/services/finance/weatherService.ts`
- Modify: `src/lib/services/index.ts`, `CONTEXT.md`, `docs/AIdocs/AIDescriptions_coregame.md`, `docs/PROJECT_INFO.md`, `docs/WineSystem_VariableRelationshipMap.md`, `readme.md`, `docs/superpowers/specs/2026-07-10-weather-module-redesign-design.md`

- [ ] Add or adjust regression tests so weather consumers import only `@/lib/features/weather` public exports.
- [ ] Remove all old service imports, raw weather table imports, and obsolete tests only after all consumers use the module facade.
- [ ] Update docs to describe five intensities, persisted weather facts, shared projection, Weather Center's operational role, and Winepedia's technical role.
- [ ] Run complete verification:

```text
npm test
npx tsc -p tsconfig.json --noEmit
git diff --check
rg -n "weatherImpactService|weatherCenterService|finance/weatherService|WEATHER_RIPENESS_DEVIATION_BY_STATE_INTENSITY|WEATHER_HEALTH_DEVIATION_BY_STATE_INTENSITY" src tests docs readme.md CONTEXT.md
```

- [ ] If an app instance is already available, smoke-check Header, Vineyard, Weather Center, Winepedia Weather, and one buy/sell modal. Do not start the dev server solely for this task.

## Plan self-review

- Tasks 1-6 cover persistence, five intensities, tick/preview/harvest parity, market context, compact operational UI, Winepedia technical reference, deletion, documentation, and verification.
- Public names are introduced before later tasks consume them.
- Work is sequential because each task replaces a layer used by the next.
