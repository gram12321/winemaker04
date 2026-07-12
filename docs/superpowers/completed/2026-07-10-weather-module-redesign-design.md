# Weather Module Redesign

**Date:** 2026-07-10  
**Status:** Implemented 2026-07-11  
**Scope:** Replace the active weather implementation and operational UI. This is not constrained by the historical Phase 1/2 implementation documents.

## 1. Goal

Make weather a small, trustworthy weekly system that players can use to understand next week's vineyard outlook without reading implementation math. Preserve weather as a modifier of normal vineyard health and ripeness progression, with yield and harvest quality changing only through those existing vineyard values.

Weather must have one authoritative calculation path shared by the weekly tick, Vineyard page, Weather Center, grape markets, and Winepedia reference material.

## 2. Product Decisions

### Keep

- Weekly global weather, a seasonal outlook, a next-week forecast, and forecast confidence.
- The six current weather states: `Clear`, `Rain`, `Heat`, `Frost`, `Storm`, and `Snow`.
- All five current intensity tiers: `VeryMild`, `Mild`, `Moderate`, `Severe`, and `Extreme`.
- Season as the baseline source of ripeness growth/decline and health decline/recovery.
- Weather as a bounded modifier of that baseline.
- Site differentiation through aspect, altitude, grape-site suitability, and soil.
- Weather's current indirect vineyard consequences: health and ripeness affect yield; health and ripeness are captured in harvest quality/anchor calculations.
- Current grape buyer and grape supplier market volatility as a separate weather consumer.
- Weather-owned operation limits for planting and harvesting: Winter prevents starting planting, severe weather slows outdoor work, and extreme conditions can pause a week's work. Harvest remains soft-limited outside its existing lifecycle rules.

### Remove or replace

- The competing player-facing concepts of raw weather delta, weather pressure, state factor, intensity factor, raw site response, clamp range, and progression multiplier.
- The existing operational Weather Center's debug-style panels and planned-feature placeholders.
- Duplicated weather breakdowns in the Vineyard page.
- The split weather implementation across finance, vineyard, sales, generic service barrels, and UI imports.
- Recomputed-on-login weather facts that can differ from the in-session weather chain.
- Duplicate actual-harvest and expected-yield formulas.

### Non-goals

- Severe event chains, mitigation actions, weather research, weather achievements, or direct weather-to-taste/wine-score effects.
- Weather-based annual limits for clearing; clearing's once-per-year availability remains a vineyard-maintenance rule outside the weather module.
- Changes to market design beyond replacing its direct weather-table dependency with the weather module's market context.

## 3. Authoritative Weekly Model

### 3.1 Weather fact and forecast

Each game week has a persisted weather fact:

```ts
type WeatherWeekContext = {
  date: GameDate;
  state: WeatherState;
  intensity: WeatherIntensity;
  seasonalPattern: WeatherForecastPattern;
  forecast: {
    state: WeatherState;
    intensity: WeatherIntensity;
    confidence: WeatherForecastConfidence;
  };
};
```

The current fact and next-week forecast are company-scoped GameState data. The generator remains deterministic for reproducible development and tests, but persisted values are the runtime source of truth after a week is resolved. Reloading must therefore preserve current weather, the seasonal pattern, and the forecast exactly.

### 3.2 Vineyard equation

The vineyard system continues to calculate a normal seasonal delta first. Weather then changes only the magnitude of that same delta:

```text
effective weather multiplier = 1 + (base weather multiplier - 1) × site exposure
final weekly delta = normal seasonal delta × effective weather multiplier
weather contribution = final weekly delta - normal seasonal delta
```

`site exposure` is a bounded multiplier around `1`. Values above `1` amplify the relevant weather deviation; values below `1` buffer it. It is built from the existing aspect, altitude, suitability, and soil inputs, but those parts are internal implementation details rather than operational UI fields.

Weather multiplier tuning lives in named weather constants indexed by weather state, intensity, and metric (`ripeness` or `health`). The five intensity tiers remain first-class entries in that table. Site exposure must be bounded independently so it cannot overwhelm season baseline or turn a normal weather condition into a destructive event.

The same projection accepts all current baseline inputs, including planting-progress scaling and the research health-decay multiplier. A preview and the tick must call the same calculation with the same inputs.

### 3.3 Metric semantics

- Ripeness: weather modifies normal seasonal ripeness increase and normal winter ripeness decline. It does not create ripeness movement where the vineyard lifecycle has no baseline movement.
- Health: weather modifies normal health decline or legitimate recovery. It does not create magical recovery for a vineyard whose baseline cannot move.
- Yield: no direct weather multiplier exists. Actual and expected yield both consume the resulting persisted health and ripeness through one shared calculator.
- Harvest quality: no direct weather input exists. Existing harvest calculations receive the resulting vineyard health/ripeness snapshot.

## 4. Tick Contract

When the player advances time into a new week:

1. Advance the calendar and resolve/persist that new week's weather fact and forecast.
2. Apply each vineyard's weekly progression using the new actual weather.
3. Progress activities. Harvest work completed on this tick therefore uses the weather-adjusted vineyard state for that week.
4. Run the remaining weekly systems using their appropriate current-week context.

This gives the forecast a clear player contract: the next-week forecast visible before advancing is the weather that will influence the next tick's vineyard state and harvest outcomes. Forecast misses remain possible according to confidence.

## 5. Weather Module Boundary

Create `src/lib/features/weather/` as the weather owner. It borrows the focused public-contract discipline of `researchUpgrade`, but does **not** introduce an `active`/`noop` feature switch: weather is core gameplay.

The module exposes a small public facade only:

```ts
resolveWeatherWeek(input): WeatherWeekContext;
resolveSeasonalWeatherForecast(companyId, year, season): SeasonalWeatherForecast;
getWeatherForecast(gameState): WeatherWeekContext['forecast'];
projectVineyardWeek(input): VineyardWeeklyProjection;
getWeatherMarketContext(weather): WeatherMarketContext;
getWeatherOperationImpact(input): WeatherOperationImpact;
buildWeatherCenterModel(input): WeatherCenterModel;
```

Exact signatures may be finalized in the implementation plan, but the ownership rules are fixed:

- `core/gameTick.ts` resolves and persists weather, then passes `WeatherWeekContext` onward.
- Vineyard services request a complete weekly projection; they do not access weather factors, site formulas, or clamps.
- Market services request `WeatherMarketContext`; they do not import weather constants directly.
- Activity and vineyard services request `WeatherOperationImpact` for planting and harvesting availability, work speed, and forced pauses; clearing retains its separate annual maintenance rule.
- UI requests presentation models and does not import calculation constants or reconstruct formulas.
- Database reads/writes remain under `src/lib/database/`; the weather module owns no direct UI persistence code.

Existing baseline vineyard functions may remain under vineyard services, but weather-specific composition and public projection ownership move into the module.

## 6. Operational UI

### 6.1 Header

Keep a compact current-weather badge and link to Weather Center. Its tooltip shows only current weather, next-week forecast, and forecast confidence.

### 6.2 Vineyard page

Each planted vineyard gets one compact next-week weather signal. Health and ripeness tooltips retain their useful outcome explanation, but weather content is limited to:

- forecast state and intensity;
- normal change;
- weather contribution;
- projected next value;
- a plain-language site note when the site materially amplifies or buffers the effect.

Do not show coefficient stacks, raw pressure, clamp ranges, or formulas. The page must obtain a shared projection rather than build weather UI state itself.

### 6.3 Weather Center

Rebuild Weather Center around a decision-oriented forecast surface:

1. Current weather, next-week forecast, confidence, and seasonal outlook.
2. Three concise outlooks: ripening, vine health, and grape-market conditions.
3. The retained centerpiece, **Vineyard Weather Impact Preview**, with rows for vineyard, concise site note, ripeness current-to-projected, health current-to-projected, and an expandable plain-language explanation.
4. An empty state for companies without planted vineyards.

Delete Model Legend, Trigger Matrix, Site Modifier Forecast, visible formula cards, comparison/debug cards, raw response meters, and all planned-alert placeholders. No player action system is implied by the page.

## 7. Winepedia Technical Reference

Technical explanation removed from operational UI moves to the Winepedia Weather tab, following the role already established by `WineQualityTab.tsx` for bulk-buy mechanics.

Winepedia owns the durable reference material:

- weather states and all five intensity tiers;
- seasonal-pattern and forecast-confidence behavior;
- state/intensity multiplier matrices for ripeness and health;
- the baseline × weather multiplier equation;
- site-exposure inputs, bounds, and activation rules;
- current-weather market pressure derivation;
- planting and harvesting operation limits, including the exclusion of clearing's annual rule;
- explicit scope statement: weather affects vineyards, grape markets, and planting/harvesting operations, not direct wine score.

Winepedia may read module-provided reference models. It must not import raw implementation constants from private weather files.

## 8. Data, Persistence, and Compatibility

- Extend company-scoped GameState persistence and the relevant migration so weather fact, forecast, seasonal pattern, and confidence survive reloads.
- Treat the persisted current weather fact as authoritative. Existing rows initialize through a defined deterministic setup path when their weather fields are absent; do not add broad legacy-shape branches.
- Keep shared weather type definitions centralized and align documentation with all five intensity tiers.
- The old phase design documents remain historical context; active docs must describe this design after implementation.

## 9. Cleanup Targets — Completed

The following were deleted or replaced after their consumers moved to the module facade:

- the former finance weather resolver, vineyard impact service, and Weather Center service
- weather composition inside `src/lib/services/vineyard/vineyardProgressionService.ts`
- raw weather exports from `src/lib/services/index.ts`
- formula and coefficient UI in `WeatherCenter.tsx` and `Vineyard.tsx`
- duplicated expected-yield calculation in either `vineyardManager.ts` or `vineyardService.ts`
- obsolete Weather Center and impact-service tests

The exact removal sequence must preserve imports until the module facade has replaced each consumer.

## 10. Verification Requirements

The implementation plan must cover:

- deterministic weather generation and exact reload persistence;
- forecast hit/miss behavior for every confidence level;
- all states × all five intensity tiers;
- site exposure boundaries and player-safe reason output;
- tick/preview parity, including planting progress and research health-decay effects;
- winter ripeness decline behavior;
- harvest yield parity between displayed and actual yield;
- grape buyer and supplier market context through the module API;
- Weather Center, Vineyard tooltip, Header, and Winepedia rendering contracts;
- deletion of old direct imports and stale documentation language.

## 11. Success Criteria

- A player can tell what next week's weather will do to each vineyard in seconds.
- A developer can find weather rules and public entry points under one module owner.
- Tick, preview, harvest, and market consumers use the same weather truth.
- Reloading does not change a resolved weather week.
- Technical mechanics remain inspectable in Winepedia without overwhelming operational pages.
- Existing indirect weather effects on ripeness, health, yield, and harvest quality are preserved and auditable.
