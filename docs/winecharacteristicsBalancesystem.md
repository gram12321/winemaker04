# Wine Characteristics Balance System

## Implementation Status ✅ COMPLETED

### Core System
- **6 Characteristics**: acidity, aroma, body, spice, sweetness, tannins (0-1 scale)
- **Per-characteristic ranges**: acidity [0.4,0.6], aroma [0.3,0.7], body [0.4,0.8], spice [0.35,0.65], sweetness [0.4,0.6], tannins [0.35,0.65]
- **Balance formula**: `score = max(0, 1 - 2 × averageDeduction)` where:
  - **Inside Distance**: `|value - midpoint|` (always calculated)
  - **Outside Distance**: distance beyond range bounds (0 if within range)
  - **Penalty**: `2 × Outside Distance`
  - **Total Distance**: `Inside Distance + Penalty`

### Dynamic Range Adjustments ✅
- **Config-driven**: `DYNAMIC_ADJUSTMENTS` with range shifts and penalty multipliers
- **Cross-trait effects**: High acidity shifts sweetness range down, high body shifts spice/tannins up
- **UI**: `DynamicRangeTab` with interactive sliders and live preview

### Cross-Trait System ✅  
- **Dynamic range adjustments**: High acidity shifts sweetness range down, high body shifts spice/tannins up
- **Penalty multipliers**: Cross-trait penalty scaling based on characteristic deviations
- **7 synergy rules**: acidity+tannins, body+spice, aroma+body+sweetness combinations
- **Penalty reduction**: Synergies reduce deduction (not add bonus)
- **UI**: `CrossTraitPenaltyTab` with interactive visualization

### Harvest Specific Characteristics ✅
- **Harvest modifiers**: `harvestCharacteristics.ts` applies ripeness, quality, altitude, suitability effects
- **Ripeness**: Late harvest → sweetness↑, acidity↓, tannins↑, body↑, aroma↑
- **Quality**: Influences body, aroma, tannins (color-aware: reds boost tannins more)
- **Altitude**: Higher → acidity↑, aroma↑, body↓
- **Suitability**: Better regions → body↑, aroma↑

### Services & Components
- **Services**: `calculateWineBalance()`, `deriveHarvestCharacteristics()`, `getSynergyReductions()`
- **Hooks**: `useWineBalance()`, `useWineBatchBalance()`, `useFormattedBalance()`, `useBalanceQuality()`
- **UI**: `WineCharacteristicsDisplay`, `CharacteristicBar` with dynamic ranges
- **Winepedia Integration**: `DynamicRangeTab` and `CrossTraitPenaltyTab` with enhanced `CharacteristicBar`
- **Winery Integration**: Updated `Winery.tsx` to use new characteristic display system

### Design Decisions
- **Quality independence**: Quality affects economics/stability, not balance directly
- **Deterministic**: No randomness; grape base + vineyard modifiers = starting characteristics
- **Simple mapping**: Linear `1 - 2 × averageDeduction` (not v1's complex piecewise curve)
