![1774727117201](image/TasteSystem_WineFolly_Research/1774727117201.png)# Taste System: Wine Folly Research + Integrated Design

Date: 2026-03-26 · Phase 1 anchors doc sync: 2026-03-28

## Objective

Build a large `Taste` system that feeds `tasteIndex` as a true flavor index (0-1), where all wines carry all flavor dimensions but with different strengths.

Design goals:

1. `tasteIndex` is built from flavor subcomponents, similar to how the `structureIndex` is built from structure subcomponents.
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

## Hidden Wine Anchors

Terroir and process influences should prefer an **anchor-mediated** path as the canonical flow. **Phase 1** introduces a single persisted schema (`WineAnchorValues`, 0–1) and services that own harvest initialization and process updates. The research lists below (lab-style chemistry, separate wind vs heat, oak program details, etc.) remain **design targets** where phase 1 uses **merged fields**; future phases can split or add keys without changing the overall direction.

### Phase 1 (implemented)

**Purpose:** Anchors are **upstream** (hidden wine identity). `WineCharacteristics`, structure channels, and future flavor vectors are **downstream** — what the player tastes. Harvest and process anchor code must **not** read harvested `WineCharacteristics`, to avoid circularity with taste/structure recomputation.

**Storage:** `WineBatch.wineAnchors` (JSONB), type `WineAnchorValues` in `src/lib/types/types.ts`. Defaults and DB parsing: `DEFAULT_WINE_ANCHOR_VALUES`, `parseWineAnchorsFromDb`, `combineWineAnchorSets` in `src/lib/services/wine/anchors/wineAnchorService.ts`.

**Code:**

| Area | File | Role |
|------|------|------|
| Harvest + shared math | `wineAnchorService.ts` | `computeHarvestWineAnchors`, `weightedMean`, grape/ site priors, `WINE_ANCHOR_KEYS` |
| Crush / ferment / features | `wineAnchorProcess.ts` | `applyCrushingToWineAnchors`, `applyFermentationSetupToWineAnchors`, `applyWeeklyFermentationContactToWineAnchors`, `applyFeatureLayerAnchors` |

**Pipeline (after phase 1):**

1. **Harvest:** `computeHarvestWineAnchors(vineyard, grape, { minAltitude, maxAltitude, ripeness, landValueModifier })` — `GRAPE_CONST`, variety priors, suitability metrics, ripeness, vineyard state (no tasted stats).
2. **Crushing:** updates `crushingExtraction`, `skinContactEvolution`.
3. **Fermentation setup:** updates `fermentationProfile`, `leesContact`, `skinContactEvolution`.
4. **Weekly fermentation:** further `skinContactEvolution`, `leesContact`.
5. **Feature / cellar layer:** `applyFeatureLayerAnchors` — `oxidativeCharacter`, `cellarEvolution`, `featureFootprint` from features, batch aging signals, grape priors (not `batch.characteristics`).

**Implemented keys (`WineAnchorValues`) — grouped:**

- **Juice and chemistry:** `residualSugar`, `alcoholPotential`, `juiceAcidity` (single axis; not separate pH + TA), `phenolicExtract`, `aromaticIntensity`, `textureRichness`
- **Process (winery):** `leesContact`, `crushingExtraction`, `fermentationProfile`, `skinContactEvolution`
- **Terroir:** `regionalTypicity`, `soilAffinity`, `solarClimateFit`
- **Vineyard:** `vineAgeCharacter`, `rowCompetition`, `siteWildness`, `siteAltitude`, `aspectWarmth`, `microclimateBlend`, `vineyardHealth`, `harvestTiming`
- **Grape identity and cellar life:** `varietyCharacter`, `colorIntensity`, `oxidativeCharacter`, `cellarEvolution`, `featureFootprint`

**Research → phase 1 mapping (consolidation, not omission of intent):**

| Research / expanded design | Phase 1 |
|----------------------------|---------|
| `alcoholABV` | `alcoholPotential` |
| `pH`, `totalAcidity` | `juiceAcidity` (one scalar) |
| `phenolicLoad`, anthocyanin / red depth | `phenolicExtract`, `colorIntensity` |
| `aromaticPotential` | `aromaticIntensity` |
| `glycerolMouthfeel` | `textureRichness` |
| `oxidationSensitivity` | `oxidativeCharacter` (harvest + feature paths) |
| `grapeVarietyProfile`, color | `varietyCharacter`, `colorIntensity` + grape constants |
| `vineAge`, altitude, aspect, soil, heat, diurnal, wind | `vineAgeCharacter`, `siteAltitude`, `aspectWarmth`, `soilAffinity`, `microclimateBlend` (bundles wind / heat / diurnal feel), `solarClimateFit`, `regionalTypicity` |
| `windExposure` | folded into `microclimateBlend` (no separate key yet) |
| `fermentationMethod`, temperature curve | `fermentationProfile` (scalar from method + temperature) |
| `macerationIntensity` | `skinContactEvolution`, `crushingExtraction` |
| `leesContact` | `leesContact` |
| `oakProgram` | not a dedicated anchor; tertiary oak-like evolution partly via `cellarEvolution` and features when present |
| `bottleAgingState` | `cellarEvolution` + batch aging inputs in feature layer |
| `featureHistory` | `featureFootprint`, `oxidativeCharacter` |
| `volatileAcidityPotential` | not a separate anchor yet |



### Game-Concept Connections (phase 1 and beyond)

1. **Ripeness (agricultural):** feeds sugar, alcohol, acid, phenolic, and timing anchors at harvest.
2. **Structure channels** (`acidity`, `aroma`, `body`, etc.): remain the tasted/derived layer; anchors constrain initialization and evolution paths where services connect them.
3. **Structure index:** computed from structure channels (and interactions), not from anchors directly.
4. **Grape type and vine age:** seed priors for harvest anchors; future flavor families will consume anchor + structure outputs.
5. **Source–impact registry:** still a migration target — avoid double-applying the same real-world cause via both a direct modifier and an anchor bump unless intentionally stacked and tuned.

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

**Phase 1 covers step 1** (anchors from grape, vineyard, ripeness, then crush/ferment/feature updates) **and participates in step 4** where feature services update batches and anchor layer. Steps 5–8 remain **target design**; current game still uses existing characteristics / `tasteIndex` plumbing where implemented.

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

**Phase 1 (in place):**

- `WineAnchorValues`, `WineAnchorId` — `src/lib/types/types.ts` (standalone `anchors.ts` optional later)
- `src/lib/services/wine/anchors/wineAnchorService.ts` — harvest anchors, defaults, parse/merge
- `src/lib/services/wine/anchors/wineAnchorProcess.ts` — crush, ferment, weekly contact, feature-layer anchors

**Still planned (not required for phase 1):**

1. `src/lib/types/taste.ts` (or equivalent) for flavor-only types
2. `src/lib/constants/taste/flavorFamilies.ts`
3. `src/lib/constants/taste/tasteDescriptors.ts`
4. `src/lib/constants/taste/tasteCompatibilityMatrix.ts`
5. `src/lib/constants/anchors/anchorRanges.ts` (optional tuning)
6. `src/lib/services/wine/structure/structureIndexService.ts` (naming may differ; structure index exists in codebase)
7. `src/lib/services/wine/taste/tasteProfileService.ts`
8. `src/lib/services/wine/taste/tasteIndexService.ts`

## Rollout Strategy

1. Lock terminology and target data model (`Structure`, `Flavor`, anchor set). — **Ongoing; phase 1 locks `WineAnchorValues`.**
2. Implement anchor storage + initialization. — **Done (JSONB + harvest + process + feature layer updates).**
3. Rename balance concept to structure concept across UI/service layer. — **Done in codebase (structure index / naming).**
4. Implement flavor families + descriptors. — **Not started (taste wheel layer).**
5. Implement new interaction engine (migrating old rule ideas). — **Not started.**
6. Connect Taste tab and contracts/customer preference systems to new flavor outputs. — **Not started.**

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

- Flavor-family types, descriptor vectors, synergy matrices, and taste-index formulas in this doc remain **design proposals** until implemented.
- **`WineAnchorValues` and phase 1 services** are **implemented** and take precedence over the older expanded bullet lists (chemical/vineyard/process) where the two differ; those lists remain useful as a **conceptual backlog** for splitting merged fields (e.g. `juiceAcidity` → pH + TA) when gameplay needs it.
