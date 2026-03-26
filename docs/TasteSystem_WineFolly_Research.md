# Taste System: Wine Folly Research and Architecture Proposal

Date: 2026-03-24

## Objective

Design a large underlying `Taste` system that feeds `tasteIndex`, where every wine has every taste descriptor on a `0-1` scale, then is ranked by harmony/fit between descriptors.

This document uses Wine Folly as the primary source and maps it to the current game architecture (`tasteIndex` already exists and feeds `wineScore`).

## Key Wine Folly Findings (Applied to Game Design)

1. Aroma/taste should be modeled in layers by origin:
- Primary aromas: grape + growing environment.
- Secondary aromas: fermentation (yeast/MLF/lees).
- Tertiary aromas: aging and oak.
- Source: https://winefolly.com/tips/wine-aroma-wheel-100-flavors/ and https://winefolly.com/deep-dive/how-to-taste-wine-develop-palate/

2. Flavor space should be grouped into broad families first:
- Fruit families (citrus, orchard/tree fruit, stone/melon, tropical, red fruit, black fruit), then floral/herb/vegetal/spice/earth/oak.
- Source: https://winefolly.com/deep-dive/blind-wine-tasting-grid-pdf/

3. Structure and flavor are separate but connected:
- Structure dimensions include sweetness, body, acidity, alcohol, tannin/phenolic bitterness; balance and complexity are evaluated separately.
- Source: https://winefolly.com/deep-dive/blind-wine-tasting-grid-pdf/

4. Climate/elevation/weather strongly move flavor outcomes:
- Warmer climates push ripeness, sweetness, alcohol, bolder fruit.
- Cooler climates preserve acidity/minerality/freshness.
- Elevation and diurnal shift preserve acidity and can increase structure.
- Wind/fog/cool nights can extend season and reduce sugar accumulation while still ripening.
- Source: https://winefolly.com/tips/5-reasons-why-great-wine-starts-with-geography/ and https://winefolly.com/deep-dive/an-intro-to-santa-barbara-wine-country/

5. Ripeness is a style axis, not just a quality axis:
- Fruit style spans tart -> ripe -> overripe/jammy/cooked/dried.
- Source: https://winefolly.com/deep-dive/blind-wine-tasting-grid-pdf/

6. Pairing/harmony can be formalized with interactions:
- Tannin can clash in certain combinations (example: chocolate + tannic red can amplify bitterness).
- Acidity can cleanse rich/fatty sensations.
- Source: https://winefolly.com/tips/basic-wine-and-food-pairing-chart/ and https://winefolly.com/deep-dive/simple-food-and-wine-pairing/

## Proposed Taste Palette (V1)

All descriptors exist on every wine (`0-1`). Most non-dominant descriptors will sit near a low floor.

Suggested descriptor floor:
- `MIN_TASTE_FLOOR = 0.005` (keeps "all tastes exist" true without flattening profiles)

### Descriptor Families

1. Primary Fruit:
- `citrus`, `orchardFruit`, `stoneMelonFruit`, `tropicalFruit`, `redFruit`, `blackFruit`, `driedFruit`

2. Floral/Herbal/Vegetal:
- `floral`, `herbal`, `vegetalPyrazine`

3. Spice/Earth:
- `pepperSpice`, `sweetSpice`, `organicEarth`, `mineralEarth`

4. Secondary (Fermentation):
- `yeastBread`, `mlfButterCream`, `leesDoughy`

5. Tertiary (Aging/Oak):
- `oakVanilla`, `oakCoconutToast`, `tobaccoCedar`, `coffeeCocoa`, `leather`, `nuttyOxidative`

6. Fault/Stress Markers (kept separate from quality score in V1):
- `volatileAcidity`, `reductiveSulfur`, `oxidizedCooked`

### Structure Channels (already aligned with Wine Folly + current game)

- `sweetness`, `acidity`, `tannin`, `body`, `alcohol`, `phenolicBitterness`

## Architecture Proposal

### Core Data Model

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

type TasteVector = Record<TasteDescriptorId, number>; // all 0..1
```

```ts
interface TasteMetrics {
  intensity: number;   // 0..1
  complexity: number;  // 0..1
  harmony: number;     // 0..1
  typicity: number;    // 0..1
}
```

### Suggested New Files

- `src/lib/types/taste.ts`
- `src/lib/constants/taste/tasteDescriptors.ts`
- `src/lib/constants/taste/grapeBaseTasteProfiles.ts`
- `src/lib/constants/taste/tasteEffectMatrices.ts`
- `src/lib/constants/taste/tasteCompatibilityMatrix.ts`
- `src/lib/services/wine/taste/tasteProfileService.ts`
- `src/lib/services/wine/taste/tasteIndexService.ts`

### Type Integration

Add optional fields to `WineBatch` and `WineLogEntry`:
- `tasteProfile?: TasteVector`
- `tasteMetrics?: TasteMetrics`

Keep `tasteIndex` as the final summarized score (`0-1`).

## Calculation Pipeline

1. Base vector from grape variety:
- Seed with grape archetype profiles (e.g., Sauvignon Blanc = high `vegetalPyrazine`/`citrus`/`acidity`; Sangiovese = `redFruit` + `herbal` + `tannin` + `acidity`; Primitivo = `blackFruit` + `sweetSpice` + `body`).

2. Environment modifiers:
- Inputs: `ripeness`, temperature/warmth, altitude, wind/fog, soil, vintage weather.
- Effects:
- Warmth/ripeness push tart -> ripe/jammy and raise alcohol/body.
- Altitude/diurnal shift preserve acidity and increase elegance.
- Wind/fog/cool nights reduce over-sugaring while preserving freshness.

3. Process modifiers:
- Fermentation choices adjust `yeastBread`, `mlfButterCream`, `leesDoughy`.
- Oak aging adjusts `oakVanilla`, `oakCoconutToast`, `sweetSpice`, `tobaccoCedar`.
- Bottle aging shifts down fresh primary fruit and shifts up tertiary notes (`driedFruit`, `nuttyOxidative`, `leather`, `coffeeCocoa`).

4. Existing feature modifiers:
- Plug current wine features (oxidation, green flavor, noble rot, etc.) directly into descriptor deltas.

5. Normalize:

```ts
raw[d] = base[d]
  + envDelta[d]
  + processDelta[d]
  + agingDelta[d]
  + featureDelta[d];

profile[d] = clamp01(
  MIN_TASTE_FLOOR + (1 - MIN_TASTE_FLOOR) * sigmoid((raw[d] - 0.5) * 4)
);
```

## Harmony and Taste Index Design

Use a compatibility matrix `C[a][b]` in `[-1, +1]`.

- Positive examples (synergy): `tropicalFruit + oakVanilla`, `redFruit + organicEarth`, `blackFruit + tobaccoCedar`.
- Negative examples (clash): `tropicalFruit + leather` (your pineapple/leather example), `floral + coffeeCocoa`, `vegetalPyrazine + driedFruit`.

Pairwise harmony:

```ts
harmonyRaw =
  sum_{a<b}(C[a][b] * profile[a] * profile[b]) /
  sum_{a<b}(profile[a] * profile[b]);

harmony = clamp01(0.5 + 0.5 * harmonyRaw);
```

Other metrics:
- `intensity`: average of top N descriptors.
- `complexity`: normalized entropy of active descriptors.
- `typicity`: distance to grape/style target profile.

Taste index:

```ts
tasteIndex = clamp01(
  0.45 * harmony +
  0.25 * complexity +
  0.20 * intensity +
  0.10 * typicity
);
```

Note:
- Keep `tasteIndex` focused on flavor profile quality/harmony.
- `wineScore` already averages `tasteIndex` with `balance`, so avoid heavy double counting of structure quality inside `tasteIndex`.

## Grape Seeds for Current Game Varieties (V1 Calibration)

Use Wine Folly primary flavor + taste profile pages as starting priors for:
- `Barbera` (high acidity, low tannin, red/dark fruit, herbaceous options)
- `Chardonnay` (lemon/apple baseline; butter/vanilla strongly process-dependent)
- `Pinot Noir` (red fruit, floral/earthy options, lower tannin, higher acidity)
- `Primitivo` via Zinfandel profile (ripe black/red fruit, spice, higher alcohol/body)
- `Sauvignon Blanc` (green/herbal, citrus/tropical, high acidity)
- `Tempranillo` (cherry/dried fig/cedar/tobacco/dill, medium-high tannin/acidity)
- `Sangiovese` (cherry/tomato/herbal/savory, medium-high tannin/acidity)

## Rollout Plan

1. Phase 1:
- Add descriptor model + grape base profiles + deterministic profile generation from current known inputs (`grape`, `ripeness`, existing characteristics/features).

2. Phase 2:
- Add environment matrices for altitude, temperature, and wind/weather when those systems land.

3. Phase 3:
- Add process/aging matrices tied to fermentation + bottle aging services.

4. Phase 4:
- Add compatibility matrix and compute `harmony` + new `tasteIndex`.
- Expose taste breakdown UI and enable future contract/customer taste requirements.

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

- The exact descriptor list, matrix weights, and formula coefficients are implementation proposals inferred from Wine Folly concepts, not direct Wine Folly formulas.
