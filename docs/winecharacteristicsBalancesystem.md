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
- Static base ranges: `[0.4, 0.6]` for all characteristics
- Simple distance calculation from midpoint
- Flat regional modifiers: `0.5` for all regions
- No archetype matching
- No synergy bonuses

### Implemented Components:
- `WineCharacteristics` interface with 6 characteristics (acidity, aroma, body, spice, sweetness, tannins)
- `BalanceResult` interface for balance analysis results
- `BalanceCalculator` service with basic balance calculation
- `useWineBalance` hook for React integration
- `BalanceVisualizer` component for UI display
- Database integration for wine characteristics storage
- Winery page integration showing balance for all wine batches
- Winepedia page with clickable grape varieties showing characteristics
- Fixed React hooks order issues by creating separate components for wine batch cards

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
