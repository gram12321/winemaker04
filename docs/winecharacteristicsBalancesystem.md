# Wine Characteristics Balance System

## Overview
Hybrid system combining v1's dynamic balance calculations with v3's React/TypeScript architecture.

## Implementation Strategy
- **Phase 1**: Basic balance calculation with flat values
- **Phase 2**: Dynamic range adjustments
- **Phase 3**: Archetype matching system
- **Phase 4**: Regional characteristics and grape suitability

## Core Components

### Data Structures
```typescript
interface WineCharacteristics {
  acidity: number;
  aroma: number;
  body: number;
  spice: number;
  sweetness: number;
  tannins: number;
}

interface BalanceResult {
  score: number; // 0-1
  archetype?: string;
  qualifies: boolean;
  dynamicRanges: Record<keyof WineCharacteristics, [number, number]>;
}
```

### Hooks
- `useWineBalance(wineBatch: WineBatch) -> BalanceResult`
- `useDynamicRanges(characteristics: WineCharacteristics) -> AdjustedRanges`

### Services
- `BalanceCalculator`: Core balance math
- `ArchetypeMatcher`: Wine style matching (placeholder)
- `RegionalCharacteristics`: Regional modifiers (placeholder)

### Components
- `BalanceVisualizer`: Real-time characteristic bars
- `WineCharacteristics`: Form for editing characteristics

## Phase 1 Implementation ✅ COMPLETED
- Accepted ranges are per characteristic (not per grape):
  - acidity `[0.4, 0.6]`, aroma `[0.3, 0.7]`, body `[0.4, 0.8]`, spice `[0.35, 0.65]`, sweetness `[0.4, 0.6]`, tannins `[0.35, 0.65]`
- Grape-specific base characteristics are deterministic (per grape) and used as-is at batch creation
- Balance calculation uses average penalty with a global ×2 scaling (see Formula below)
- Flat placeholders for regional/terroir modifiers (not applied yet)
- No archetype matching
- No synergy bonuses

### Implemented Components:
- `WineCharacteristics` interface with 6 characteristics (acidity, aroma, body, spice, sweetness, tannins)
- `BalanceResult` interface for balance analysis results
- `BalanceCalculator` service with basic balance calculation
- `useWineBalance` hook for React integration
- `CharacteristicBar` component with visual balance ranges and built-in expandable/collapsible functionality
- Database integration for wine characteristics storage
- Winery page integration showing balance for all wine batches (active and completed)
- Winepedia page with clickable grape varieties showing characteristics
- Constants moved to centralized location (`BASE_BALANCED_RANGES`, `BASE_GRAPE_CHARACTERISTICS`, and `GRAPE_VARIETY_INFO` in constants.ts)
- Removed unnecessary wrapper functions and random variation
- Grape-specific characteristics now differentiate wine varieties

### Formula (Current)
Let the accepted range for a characteristic be `[min, max]` and midpoint `m = (min + max)/2`. For each characteristic value `x`:

1) DistanceInside: `|x − m|`

2) DistanceOutside: `max(min − x, 0)` if `x < min`; `max(x − max, 0)` if `x > max`; otherwise `0`

3) Penalty: `2 × DistanceOutside`

4) TotalDistance: `DistanceInside + Penalty`

5) Cross-trait scaling: multiply `TotalDistance` by any applicable cross-trait multipliers

6) Aggregate and map to score:
- `averageDeduction = mean(TotalDistance_i)` over all 6 characteristics
- `score = max(0, 1 − 2 × averageDeduction)`

Notes:
- Characteristics are fixed per grape at creation in Phase 1; thus, all batches of the same grape currently yield the same balance score.
- Updating `BASE_BALANCED_RANGES` immediately affects scores across the app.

## Placeholders
- Archetype system: Return empty array
- Regional characteristics: Return flat `0.5` values
- Grape suitability: Return flat `0.5` values
- Synergy bonuses: Return `0`

## Phase 2: Dynamic Range Adjustments
- Implement `balanceAdjustments` system from v1
- Characteristics influence ideal ranges of other characteristics
- Example: High acidity shifts sweetness range down
- Penalty multipliers for out-of-range characteristics
- Real-time range updates in UI

## Phase 3: Archetype Matching System
- Define wine style archetypes (Bordeaux, Burgundy, etc.)
- Each archetype has specific characteristic requirements
- Regional and grape variety restrictions
- Processing method requirements (ecological, crushing methods)
- Qualification scoring and best match detection

## Phase 4: Regional & Grape Integration
- Regional characteristic modifiers based on soil, climate, altitude
- Grape variety suitability scores per region
- Vintage year effects on characteristics
- Terroir influence on balance calculations
- Synergy bonuses for optimal characteristic combinations

## Agreements (Design Decisions)
- Quality (vine health, ripeness, viticulture, handling) is independent from Balance. High quality does not automatically mean higher balance.
- We do not increase characteristic magnitudes directly with quality. Quality should influence economics and stability, not push traits toward midpoints.
- Vineyard conditions may adjust the starting characteristics at batch creation (future work), e.g.:
  - Late harvest (higher ripeness): sweetness ↑, body ↑, acidity ↓, aroma often ↑
  - Early harvest: sweetness ↓, body ↓, acidity ↑
  - Environmental factors (water stress, exposure, cool/warm vintage) provide deterministic deltas
- Processing steps (fermentation/aging/blending) may later shift characteristics; this is separate from quality.

## Legacy v1 Balance System (Reference)
- Base accepted ranges per characteristic (same as current).
- Dynamic range adjustments: being above/below midpoint in one trait shifts accepted ranges of others (config of rules per trait and direction).
- Penalty multipliers: high/low in one trait scales penalties for others (cross-trait penalty keys).
- Out-of-range penalties: superlinear growth with distance (stepwise doubling by 0.1 increments).
- Synergy bonuses: capped bonus when certain trait combinations align (e.g., acidity+tannins high; body≈spice; aroma>body with moderate sweetness).
- Dynamic balance score: compute deductions with adjusted ranges and multipliers, apply synergy reduction, decay, then invert/average to 0–1.
- Archetype layer: compute archetype score; if qualified, use max(archetypeScore, dynamicScore).
- Final mapping: piecewise curve to shape player-facing score (polynomial/log/linear/exponential/logistic/sigmoid segments).

## Modernized Implementation Ideas (No-code plan)
- Separation of concerns:
  - Deterministic starting traits = grape base + vineyard deltas (ripeness/region/stress); independent from quality.
  - Balance engine = pure function of traits + typed config; no DB calls.
  - Archetypes and synergies layered on top; computed independently and displayed, not silently replacing scores.
- Config-driven rules (TypeScript):
  - Define per-trait range-shift rules and penalty multipliers in a typed config object.
  - Keep caps and weights in config for rapid tuning; unit-test each rule.
- Smooth math and normalization:
  - Replace stepwise outside penalties with continuous curves (e.g., quadratic outside, optional exponential tail for far-outliers).
  - Normalize by range width; allow per-trait weights.
  - Use a single monotonic final mapping curve for UX consistency.
- Synergy model:
  - Treat as a percentage reduction to total deduction with a strict cap (e.g., ≤ 15%).
  - Express conditions declaratively (predicates over traits) in config.
- Observability:
  - Return telemetry from the engine (per-trait distances, adjusted ranges, penalties, synergies, final score) for a small in-app calibration panel.
- Rollout plan:
  1) Introduce per-trait range shifts (config + UI preview of adjusted ranges).
  2) Add penalty multipliers and normalization.
  3) Add capped synergies and per-trait weights.
  4) Surface archetype scoring read-only (no replacement), showing best match and reasons.
  5) Add vineyard starting deltas at batch creation (ripeness/weather/region).
