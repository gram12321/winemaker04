![1774727117201](image/TasteSystem_WineFolly_Research/1774727117201.png)# Taste System: Wine Folly Research + Integrated Design

Date: 2026-03-26

## Objective

Build a large `Taste` system that feeds `tasteIndex` as a true flavor index (0-1), where all wines carry all flavor dimensions but with different strengths.

Design goals:

1. `tasteIndex` is built from flavor subcomponents, similar to how the current `balance` index is built from structure subcomponents.
2. Flavor modeling follows Wine Folly ideas (primary/secondary/tertiary, wheel families, climate/process/aging effects).
3. Hidden backend wine anchors constrain evolution so wines feel physically plausible (not free sliders).
4. Existing rule ideas can be migrated, but the rules engine can be enhanced or replaced if the new system is better.
5. Terminology is cleaned up:
- `Aroma` is reserved for the Structure concept parameter.
- `Flavor` is used for the Taste system (Primary Fruit Flavor, Tertiary Flavor, etc.).
6. Current `Balance` is renamed to `Structure` as the concept and index.

## Key Wine Folly Findings (Applied to Game Design)

1. Layered flavor origin should be core:
- Primary flavor: grape + vineyard environment.
- Secondary flavor: fermentation and microbiology.
- Tertiary flavor: aging, oak, oxidative/evolutionary notes.

2. Family-first wheel modeling works well for game architecture:
- Floral, citrus, tree fruit, tropical fruit, red fruit, black fruit, dried fruit, spice, vegetable, earth, microbial, oak aging, general aging, faults.

3. Structure and flavor are separate systems:
- Structure traits (acidity, sweetness, tannin, body, etc.) are not the same as flavor families.
- Both should be scored independently, then composed at top level.

4. Climate/geography/process effects are not cosmetic:
- Warmth and harvest timing shift fruit expression and concentration.
- Altitude/diurnal conditions influence freshness and style.
- Fermentation and aging strongly shift secondary/tertiary profile.

5. Harmony/clash should be explicit and tunable:
- Flavor combinations can add synergy or clash (for example tropical fruit + leather).
- This can be represented in a dedicated interaction model and tuned over time.

## Terminology and Renaming Decisions

1. `Balance` concept is renamed to `Structure`.
2. `Balance Score` becomes `Structure Index`.
3. `Aroma` remains a structure parameter in both backend/frontend terminology.
4. `Flavor` is the umbrella term for Taste-system families and descriptors.
5. Ripeness remains agricultural only in this project:
- No Wine Folly flavor-ripeness term.
- The style axis can still be modeled as `tart -> ripe -> jammy/dried`, but it is not called "ripeness" in tasting terminology.

## Integrated Taste Model

This combines the two previous concepts instead of replacing one with the other.

### Flavor Families (Wheel-Aligned, Top Level)

1. `flower`
2. `citrus`
3. `treeFruit`
4. `tropicalFruit`
5. `redFruit`
6. `blackFruit`
7. `driedFruit`
8. `spiceFlavor`
9. `vegetable`
10. `earth`
11. `microbial`
12. `oakAging`
13. `generalAging`
14. `faults`

Each family exists on every wine on a `0-1` scale.

### Descriptor Families (Second Level)

Flavor families can hold deeper descriptors. Example mapping:

1. Fruit descriptors:
- citrus, orchard fruit, stone/melon, tropical, red fruit, black fruit, dried fruit

2. Floral/green descriptors:
- floral, herbal, vegetal/pyrazine

3. Spice/earth descriptors:
- pepper spice, sweet spice, organic earth, mineral earth

4. Secondary descriptors:
- yeast bread, malolactic butter/cream, lees doughy

5. Tertiary descriptors:
- oak vanilla, oak toast/coconut, tobacco/cedar, coffee/cocoa, leather, nutty oxidative

6. Fault descriptors:
- volatile acidity, reductive sulfur, oxidized/cooked
- Fault flavor output is derived from Feature state/events; the Feature system remains simulation source of truth for fault and non-fault behavior.
- Features modify declared targets (structure channels, flavor descriptors, and/or anchors), then indexes are recomputed from those results.

### Structure Channels (renamed from Balance channels)

Current channels:
- `acidity`, `aroma`, `body`, `spice`, `sweetness`, `tannins`

Planned extension:
- `bitterness`

These channels produce `structureIndex`.

## Data Model Sketch

```ts
type FlavorFamilyId =
  | 'flower' | 'citrus' | 'treeFruit' | 'tropicalFruit'
  | 'redFruit' | 'blackFruit' | 'driedFruit'
  | 'spiceFlavor' | 'vegetable' | 'earth'
  | 'microbial' | 'oakAging' | 'generalAging' | 'faults';
```

```ts
type TasteDescriptorId =
  | 'citrus' | 'orchardFruit' | 'stoneMelonFruit' | 'tropicalFruit'
  | 'redFruit' | 'blackFruit' | 'driedFruit'
  | 'floral' | 'herbal' | 'vegetalPyrazine'
  | 'pepperSpice' | 'sweetSpice' | 'organicEarth' | 'mineralEarth'
  | 'yeastBread' | 'mlfButterCream' | 'leesDoughy'
  | 'oakVanilla' | 'oakCoconutToast' | 'tobaccoCedar'
  | 'coffeeCocoa' | 'leather' | 'nuttyOxidative'
  | 'volatileAcidity' | 'reductiveSulfur' | 'oxidizedCooked';

type TasteVector = Record<TasteDescriptorId, number>; // 0..1
type FlavorFamilyVector = Record<FlavorFamilyId, number>; // 0..1
```

```ts
interface TasteMetrics {
  intensity: number;     // 0..1
  complexity: number;    // 0..1
  harmony: number;       // 0..1
  typicity: number;      // 0..1
  layerBalance: number;  // 0..1 (primary/secondary/tertiary integration)
}
```

## Hidden Wine Anchors (Expanded Core Design)

All anchor ideas are part of the main design (not split into v1/v1.5 tiers).
Terroir/process influences should prefer an anchor-mediated path as canonical flow; direct and anchor paths are only combined when explicitly marked as intentional stacking.

### Chemical Anchors

1. `residualSugar`
2. `alcoholABV`
3. `pH`
4. `totalAcidity`
5. `phenolicLoad`
6. `anthocyaninLoad` (red color/depth potential)
7. `aromaticPotential`
8. `glycerolMouthfeel`
9. `volatileAcidityPotential`
10. `oxidationSensitivity`

### Vineyard/Terroir Anchors

1. `grapeVarietyProfile`
2. `grapeColor`
3. `vineAge`
4. `altitude`
5. `aspect`
6. `soilProfile`
7. `windExposure`
8. `seasonHeatLoad`
9. `diurnalShift`
10. `vineyardHealth`

These anchor effects should not be duplicated by parallel direct modifiers on the same target unless intentional stacking is declared and tuned.

### Process Anchors

1. `harvestTiming`
2. `fermentationMethod`
3. `fermentationTemperatureCurve`
4. `macerationIntensity`
5. `oakProgram` (type/toast/time)
6. `leesContact`
7. `bottleAgingState`
8. `featureHistory` (noble rot, oxidation, green flavor, etc.)

Anchor entries should carry status in implementation (`active`, `derived_partial`, `placeholder_todo`) so not-yet-implemented concepts stay explicit design intent.

### Game-Concept Connections

Anchors are directly linked to existing gameplay concepts:

1. Ripeness (agricultural):
- feeds sugar/acid/phenolic anchor initialization.

2. Sweetness, Tannins, Aroma, Body:
- remain structure channels, but are constrained by anchors.

3. Structure Index:
- computed from structure channels and structure interaction logic.

4. Grape Type and Vine Age:
- seed baseline flavor families and anchor ceilings/floors.

5. Altitude and future wind/weather systems:
- modify anchor drift and flavor/structure transformations.
6. Source-impact registry:
- Maintain a source -> target path map (`direct`, `anchor`, or intentional stacked) for migration safety and to avoid accidental double influence.
7. Implementation visibility:
- Explicitly mark placeholder anchors (for example `glycerolMouthfeel`, `windExposure`, `oakProgram`, `leesContact`) with `placeholder_todo` status until runtime systems exist.

## Synergy/Clash Architecture (Can Replace Current Rules)

The new model can replace the current rule implementation if desired.
Key requirement: migrate useful old ideas, not necessarily old formulas.

### Proposed Engine

1. `structureInteractions`:
- synergy/clash over structure channels.

2. `flavorInteractions`:
- synergy/clash over flavor families/descriptors.

3. `crossDomainInteractions`:
- structure <-> flavor coupling (for example high tannin supports black-fruit/oak styles, high acidity supports citrus/fresh styles).

### Migration Principle from Existing Rules

Keep the idea-level knowledge from current rules:

1. Sweetness-acidity tension.
2. Body-tannin coupling.
3. Aroma-body mismatch penalties.
4. Style synergies like balanced acidity/sweetness and structured reds.

But migrate into the new engine using unified data structures and updated naming (`Structure`).

### Example Harmony Formula (Flavor Domain)

```ts
harmonyRaw =
  sum_{a<b}(C[a][b] * flavor[a] * flavor[b]) /
  sum_{a<b}(flavor[a] * flavor[b]);

harmony = clamp01(0.5 + 0.5 * harmonyRaw);
```

`C[a][b]` can be positive (synergy) or negative (clash).

### Descriptor Normalization (Restored from Original Draft)

Keep a small descriptor floor so every wine has every descriptor without flattening profiles:

```ts
MIN_TASTE_FLOOR = 0.005;

raw[d] = base[d]
  + terroirDelta[d]
  + processDelta[d]
  + agingDelta[d]
  + featureDelta[d]
  + interactionDelta[d];

profile[d] = clamp01(
  MIN_TASTE_FLOOR + (1 - MIN_TASTE_FLOOR) * sigmoid((raw[d] - 0.5) * 4)
);
```

### Taste Index Composition (Restored from Original Draft)

```ts
tasteIndex = clamp01(
  0.45 * harmony +
  0.25 * complexity +
  0.20 * intensity +
  0.10 * typicity
);
```

## Calculation Flow (End-to-End)

1. Initialize anchors from grape + vineyard + agricultural state + process choices.
2. Compute structure channels under anchor constraints.
3. Compute `structureIndex` (renamed from balance index).
4. Apply active feature effects (fault and non-fault) into declared target paths.
5. Generate flavor descriptor vector (primary/secondary/tertiary transforms).
6. Aggregate descriptor -> family vectors (including `faults` family from feature-informed descriptors).
7. Run flavor synergy/clash engine.
8. Compute `tasteIndex` from flavor profile + harmony/complexity/intensity.
9. Compose final wine score from `structureIndex` and `tasteIndex`.

## Suggested File-Level Architecture

1. `src/lib/types/taste.ts`
2. `src/lib/types/anchors.ts`
3. `src/lib/constants/taste/flavorFamilies.ts`
4. `src/lib/constants/taste/tasteDescriptors.ts`
5. `src/lib/constants/taste/tasteCompatibilityMatrix.ts`
6. `src/lib/constants/anchors/anchorRanges.ts`
7. `src/lib/services/wine/structure/structureIndexService.ts`
8. `src/lib/services/wine/taste/tasteProfileService.ts`
9. `src/lib/services/wine/taste/tasteIndexService.ts`
10. `src/lib/services/wine/anchors/wineAnchorService.ts`

## Rollout Strategy

1. Lock terminology and target data model (`Structure`, `Flavor`, anchor set).
2. Implement anchor storage + initialization.
3. Rename balance concept to structure concept across UI/service layer.
4. Implement flavor families + descriptors.
5. Implement new interaction engine (migrating old rule ideas).
6. Connect Taste tab and contracts/customer preference systems to new flavor outputs.

## Migration Notes (Current Codebase)

1. Finance double-count issue:
- Status: addressed in current implementation by removing extra quality multiplication on top of `estimatedPrice` in finance asset valuation.

2. Crushing quality penalty reset risk:
- Status: intentionally deferred to taste-system redesign.
- Current limitation: feature recomputation rebuilds `tasteIndex` from `bornTasteIndex` baseline, so non-feature process penalties (for example pressing-intensity penalty at crushing) can be overwritten unless carried in baseline/source model.
- Required in redesign:
  - explicit source-impact registry path for process penalties (`direct` vs `anchor`),
  - persistent baseline model for taste inputs (not reconstructed from current value),
  - deterministic recompute pipeline that preserves process deltas and then applies feature deltas in ordered stages.

## References (Wine Folly)

- https://winefolly.com/tips/wine-aroma-wheel-100-flavors/
- https://winefolly.com/deep-dive/how-to-taste-wine-develop-palate/
- https://winefolly.com/deep-dive/blind-wine-tasting-grid-pdf/
- https://winefolly.com/deep-dive/wine-tasting-terms-to-use/
- https://winefolly.com/tips/5-reasons-why-great-wine-starts-with-geography/
- https://winefolly.com/deep-dive/an-intro-to-santa-barbara-wine-country/
- https://winefolly.com/deep-dive/simple-food-and-wine-pairing/
- https://winefolly.com/tips/basic-wine-and-food-pairing-chart/
- https://winefolly.com/grapes/sangiovese/
- https://winefolly.com/wine-basics/sauvignon-blanc/
- https://winefolly.com/deep-dive/guide-to-barbera-wine/
- https://winefolly.com/grapes/chardonnay/
- https://winefolly.com/grapes/pinot-noir/
- https://winefolly.com/grapes/tempranillo/
- https://winefolly.com/grapes/zinfandel/

## Inference Notes

- Type models, anchors, interaction architecture, and formulas are implementation proposals inferred from Wine Folly concepts and current game design direction.
