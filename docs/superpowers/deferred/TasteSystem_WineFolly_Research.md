![1774727117201](image/TasteSystem_WineFolly_Research/1774727117201.png)# Taste System: Wine Folly Research + Integrated Design

Date: 2026-03-26
Last implementation sync: 2026-05-21
Status: Core taste design implemented; descriptor-level scoring, deeper typicity, and unified customer taste preferences are intentionally deferred.

## Current Conclusion

The current implementation is good enough for the next game slice.

Implemented taste work now covers the important gameplay path:

- a compact 12-key hidden anchor model,
- Wine Folly-inspired 14 flavor families,
- descriptor values grouped under those families for display,
- computed `tasteQualityIndex`,
- wine score composition from `tasteQualityIndex` and `structureIndex`,
- Taste Quality UI breakdown,
- contract requirements that separate `tasteQuality` from site/land requirements.

The remaining taste research should stay as a tuning and extension backlog. Descriptor-level scoring, deeper typicity, and unified customer taste preferences are intentionally deferred.

## Objective

Build a large Taste system that feeds `tasteQualityIndex` as a true flavor-family quality index from 0 to 1. All wines carry all flavor dimensions, but with different strengths.

Design goals:

1. `tasteQualityIndex` is built from flavor-family subcomponents, similar to how `structureIndex` is built from structure subcomponents.
2. Flavor modeling follows Wine Folly ideas: primary/secondary/tertiary flavor, wheel families, climate/process/aging effects.
3. Hidden backend wine anchors constrain evolution so wines feel physically plausible, not like free sliders.
4. Existing rule ideas can be migrated, but the rule engine can be enhanced or replaced if the new system is better.
5. Terminology is clean:
   - `Aroma` remains the Structure concept parameter.
   - `Flavor` is used for Taste-system families and descriptors.
   - `Taste Quality` is the score/readout for family balance.
6. `Balance` is renamed to `Structure` as the concept and index.

## Key Wine Folly Findings Applied To Game Design

1. Layered flavor origin should be core:
   - Primary flavor: grape + vineyard environment.
   - Secondary flavor: fermentation and microbiology.
   - Tertiary flavor: aging, oak, oxidative/evolutionary notes.
2. Family-first wheel modeling works well for game architecture:
   - Floral, citrus, tree fruit, tropical fruit, red fruit, black fruit, dried fruit, spice, vegetable, earth, microbial, oak aging, general aging, faults.
3. Structure and flavor are separate systems:
   - Structure traits such as acidity, sweetness, tannin, and body are not the same as flavor families.
   - Both are scored independently, then composed at the top level.
4. Climate/geography/process effects are not cosmetic:
   - Warmth and harvest timing shift fruit expression and concentration.
   - Altitude/diurnal conditions influence freshness and style.
   - Fermentation and aging strongly shift secondary/tertiary profile.
5. Harmony/clash should be explicit and tunable:
   - Flavor combinations can add synergy or clash.
   - The current implementation has family target dependencies and a compatibility matrix; further tuning is expected.

## Terminology and Renaming Decisions

1. `Balance` concept is renamed to `Structure`.
2. `Balance Score` becomes `Structure Index`.
3. `Aroma` remains a structure parameter in backend and frontend terminology.
4. `Flavor` is the umbrella term for Taste-system families and descriptors.
5. `tasteQualityIndex` is the implemented taste outcome metric.
6. Ripeness remains agricultural only in this project:
   - No Wine Folly flavor-ripeness term.
   - The style axis can still be modeled as tart/fresh through ripe/jammy/dried, but it is not called ripeness in tasting terminology.

## Implemented Taste Model

### Flavor Families

Each family exists on every wine on a 0-1 scale:

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

Implementation:

- Types: `FLAVOR_FAMILY_IDS`, `WineFlavorFamilyProfile` in `src/lib/types/types.ts`
- Profile service: `src/lib/services/wine/taste/wineTasteProfileService.ts`
- Labels: `src/lib/constants/taste/flavorFamilyLabels.ts`
- UI: `WineTasteWheel`, `WineTasteProfilePanel`, `WineTasteQualityBreakdown`

### Descriptors

Descriptors are second-level display values. They are grouped under families, shown in the Taste UI, and are not currently scored directly.

Implemented descriptors:

| Family | Descriptors |
|---|---|
| `flower` | `floralLift`, `whiteFloral` |
| `citrus` | `citrusZest`, `grapefruit`, `orangeZest` |
| `treeFruit` | `orchardFruit`, `greenApple`, `yellowApple`, `pearNotes`, `whitePeach`, `stoneMelon` |
| `tropicalFruit` | `tropicalNotes`, `tropicalIsland` |
| `redFruit` | `redBerry` |
| `blackFruit` | `darkFruit` |
| `driedFruit` | `driedConcentrated`, `honeyed` |
| `spiceFlavor` | `pepperBakingSpice` |
| `vegetable` | `herbalGreen` |
| `earth` | `earthMineral`, `graphiteMineral` |
| `microbial` | `yeastLees` |
| `oakAging` | `oakToastVanilla` |
| `generalAging` | `bottleEvolved`, `leatheryTobacco` |
| `faults` | `faultEdge` |

Future descriptor scoring should add a typicity layer inside each family. It should not replace the family-level score.

### Structure Channels

Current structure channels:

- `acidity`
- `aroma`
- `body`
- `spice`
- `sweetness`
- `tannins`

These channels produce `structureIndex`. Planned extension such as `bitterness` remains out of scope.

## Hidden Wine Anchors

The current persisted anchor model is compact and implemented as `WineAnchorValues` in `src/lib/types/types.ts`.

Anchors are upstream hidden wine identity. `WineCharacteristics`, structure channels, taste families, descriptors, and indexes are downstream tasted/player-facing outputs. Harvest and process anchor code must not read harvested `WineCharacteristics` to avoid circularity.

Current persisted anchor keys:

| Anchor | Role |
|---|---|
| `sugarPotential` | Sugar/ripeness identity. |
| `acidPotential` | Acid retention identity. |
| `phenolicPotential` | Tannin/color/skin identity. |
| `aromaticPotential` | Aroma expression identity. |
| `bodyPotential` | Body/alcohol/texture identity. |
| `extractionState` | Crushing and extraction process state. |
| `fermentationState` | Fermentation method and progress state. |
| `leesState` | Lees/autolysis process state. |
| `oxidationPressure` | Oxidation tendency from grape, acid, health, ripeness, and features. |
| `maturationState` | Aging/spice/cellar evolution state. |
| `terroirExpression` | Site expression from suitability, soil, altitude, vine age, row competition, and health. |
| `processFootprint` | Accumulated feature/process footprint. |

Implementation:

| Area | File | Role |
|---|---|---|
| Harvest + shared math | `src/lib/services/wine/anchors/wineAnchorService.ts` | `computeHarvestWineAnchors`, `WINE_ANCHOR_KEYS`, neutral defaults, current-shape database parser |
| Crush/ferment/features | `src/lib/services/wine/anchors/wineAnchorProcess.ts` | Applies process and feature deltas to anchors |
| Characteristic bridge | `src/lib/services/wine/anchors/wineAnchorCharacteristicBridge.ts` | Connects anchors to characteristic update paths |

`parseWineAnchorsFromDb` only reads the current compact anchor keys. Unknown old field names are ignored; there is no compatibility mapping for removed anchor shapes.

### Implemented Keys Grouped

The current 12 anchors preserve the design intent of the older research model, but at a gameplay-appropriate level of detail.

**Juice and chemistry**

- `sugarPotential`
- `acidPotential`
- `phenolicPotential`
- `bodyPotential`

**Aroma and site identity**

- `aromaticPotential`
- `terroirExpression`

**Winery process state**

- `extractionState`
- `fermentationState`
- `leesState`
- `processFootprint`

**Aging, risk, and evolution**

- `oxidationPressure`
- `maturationState`

### Research To Current Mapping

This was consolidation, not omission of design intent:

| Research intent | Current implementation | Future expansion path |
|---|---|---|
| Juice sugar, alcohol potential, and harvest maturity | `sugarPotential` plus structure `sweetness` and body effects | Add explicit alcohol estimate only if alcohol becomes a user-facing variable. |
| Acidity and freshness | `acidPotential`, structure `acidity`, citrus/tree-fruit flavor nudges | Add pH/TA style sub-model only if vineyard chemistry becomes gameplay. |
| Phenolics, skin extraction, color | `phenolicPotential` and `extractionState` | Add color or bitterness if red-wine identity needs finer scoring. |
| Aromatic intensity and variety character | `aromaticPotential`, grape nudges, flavor-family base profiles | Add grape-specific descriptor typicity targets. |
| Soil, altitude, aspect, vine age, health | `terroirExpression` and site-driven harvest anchors | Add terroir descriptor weights by region/soil when regional identity matters more. |
| Fermentation, lees, oak, bottle evolution | `fermentationState`, `leesState`, `maturationState`, `processFootprint` | Add process-source registry if deterministic recomputation needs full provenance. |
| Oxidation/fault pressure | `oxidationPressure` and `faults` family | Add fault-specific descriptors and customer tolerance by market segment. |

## Current Taste Quality Scoring

`src/lib/services/wine/taste/tasteQualityIndexService.ts` computes `tasteQualityIndex` from:

1. the current 14-family `WineFlavorFamilyProfile`,
2. base red/white family targets,
3. grape-specific target nudges,
4. dependency rules that move targets/ranges based on the current profile,
5. family weights,
6. distance from each accepted family range.

The service returns:

- `tasteQualityIndex`,
- per-family current value,
- ideal value,
- accepted range,
- family score,
- weight,
- reasons.

`src/lib/services/wine/winescore/wineScoreCalculation.ts` then composes:

```ts
wineScore = (tasteQualityIndex + structureIndex) / 2;
```

Estimated price uses the resulting `wineScore`, score curve multiplier, land value price multiplier, feature price multiplier, and prestige multipliers.

## Contract and UI Integration

Implemented:

- `ContractRequirement.type = 'tasteQuality'` validates against computed `getTasteQualityIndex(wine)`.
- `landValue`, `country`, `region`, `altitude`, and `aspect` remain site/land requirements, not taste substitutes.
- The Taste tab keeps the radar wheel and adds a read-only Taste Quality breakdown.
- Wine log, highscores, and achievements use bottling snapshots / persisted winelog values for historical records.

## Current End-To-End Flow

1. Initialize compact anchors from grape + vineyard + agricultural state + process choices.
2. Compute/update structure channels under anchor and process influence.
3. Compute `structureIndex`.
4. Apply active feature effects into declared target paths.
5. Compute flavor families from anchors, characteristics, grape identity, features, and aging.
6. Compute descriptors from family values and supporting inputs for display.
7. Compute `tasteQualityIndex` from family targets, weights, and dependencies.
8. Compose final `wineScore` from `structureIndex` and `tasteQualityIndex`.
9. Use score and price outputs for UI, contracts, highscores, achievements, finance, and sales.

## Pipeline After Current Phase

The current family-level model is the accepted first implementation. The next pipeline should extend it without replacing it:

1. Keep compact anchors as the persistent hidden identity.
2. Derive the 14 flavor-family profile from anchors, grape identity, structure channels, features, process state, and aging.
3. Derive descriptors below each family using a small floor so every wine has every descriptor without flattening the profile.
4. Compute family-level Taste Quality exactly as today.
5. Add optional descriptor typicity scoring inside the family layer.
6. Add a harmony score from the compatibility matrix and family intensities.
7. Add a complexity score from how many non-fault families/descriptors are meaningfully present.
8. Add an intensity score from weighted family strength, with faults treated as a penalty.
9. Combine these into `tasteQualityIndex` only after UI and contract expectations are updated.

## Game-Concept Connections

The taste system can become a broader game design layer without changing current terminology:

| Game concept | Current connection | Future idea |
|---|---|---|
| Vineyard place | Site factors shape anchors and terroir expression | Regional descriptor targets and regional typicity bonuses. |
| Player process choices | Crushing, fermentation, features, and aging shift anchors and taste families | Process-origin badges in the Taste UI. |
| Wine style | Red/white targets and grape nudges drive current ranges | Named style/archetype targets for contracts and customers. |
| Customer demand | Contracts can require `tasteQuality` | Unified customer preference model across structure, taste, price, region, and style. |
| Risk/reward | Faults and feature effects influence profile and price | Segment-specific tolerance for rusticity, oak, oxidation, or green notes. |

## Synergy and Clash Architecture

The current implementation already has family dependency rules and `tasteCompatibilityMatrix.ts`. A future engine can replace or deepen those rules by making harmony a first-class sub-score.

### Proposed Engine

1. Normalize each family value to a stable 0-1 profile.
2. Evaluate pairwise compatibility with a matrix of synergy/clash coefficients.
3. Weight each pair by the product of the two family intensities.
4. Convert the weighted average into a 0-1 harmony score.
5. Penalize faults separately so faults do not become "interesting complexity" by accident.
6. Feed harmony into `tasteQualityIndex` after validating that it improves player legibility.

### Example Harmony Formula

```ts
const pairWeight = familyA.value * familyB.value;
const harmonyRaw =
  sum(compatibility[familyA.id][familyB.id] * pairWeight) /
  sum(pairWeight);

const harmony = clamp01(0.5 + 0.5 * harmonyRaw);
```

This matches the intent of the current compatibility matrix. It should remain family-level until descriptor targets are mature.

## Descriptor Normalization

Keep a small descriptor floor so every wine has every descriptor without flattening profiles:

```ts
const MIN_TASTE_FLOOR = 0.005;

raw[descriptorId] =
  base[descriptorId] +
  terroirDelta[descriptorId] +
  processDelta[descriptorId] +
  agingDelta[descriptorId] +
  featureDelta[descriptorId] +
  interactionDelta[descriptorId];

descriptor[descriptorId] = clamp01(
  MIN_TASTE_FLOOR + (1 - MIN_TASTE_FLOOR) * sigmoid(raw[descriptorId])
);
```

Current status: `MIN_TASTE_FLOOR` exists in `tasteNormalization.ts`, and descriptors are generated for display. The missing piece is a descriptor-source table with explicit deltas and typicity targets.

## Future Taste Quality Formula

The current score uses family target fit. A future formula could blend family fit with harmony, complexity, intensity, and typicity:

```ts
tasteQualityIndex = clamp01(
  0.45 * familyTargetFit +
  0.25 * harmony +
  0.15 * complexity +
  0.10 * intensity +
  0.05 * descriptorTypicity
);
```

This replaces the older draft's `tasteIndex` label with the canonical `tasteQualityIndex` name. The weights are a proposal, not implemented behavior.

## What Is Deferred

The following remain future work:

- descriptor-level typicity scoring,
- customer taste preferences,
- a unified market-preference model that covers both structure and taste,
- deeper structure-flavor interaction tuning,
- source-impact registry for any future process penalties that must persist through deterministic recomputation,
- splitting compact anchors into more chemistry-specific keys if gameplay needs it.

## Suggested File-Level Architecture

Current files:

- `src/lib/types/types.ts` - `WineAnchorValues`, flavor family ids, descriptor ids, profile types.
- `src/lib/services/wine/anchors/wineAnchorService.ts` - anchor initialization, defaults, current database parsing.
- `src/lib/services/wine/anchors/wineAnchorProcess.ts` - anchor process updates.
- `src/lib/services/wine/taste/wineTasteProfileService.ts` - family and descriptor profile generation.
- `src/lib/services/wine/taste/tasteQualityIndexService.ts` - family-level taste quality scoring.
- `src/lib/services/wine/taste/tasteCrossDomain.ts` - structure to flavor nudges.
- `src/lib/services/wine/taste/tasteNormalization.ts` - taste normalization.
- `src/lib/constants/taste/flavorFamilyLabels.ts` - UI labels and descriptions.
- `src/lib/constants/taste/tasteCompatibilityMatrix.ts` - family compatibility matrix.
- `src/components/ui/components/WineTasteWheel.tsx` - taste wheel.
- `src/components/ui/components/WineTasteProfilePanel.tsx` - Taste tab panel.
- `src/components/ui/components/WineTasteQualityBreakdown.tsx` - Taste Quality breakdown.

## Rollout Status

| Step | Status |
|---|---|
| Lock terminology and target data model | Done for Structure, Flavor, anchors, and Taste Quality. |
| Implement anchor storage and initialization | Done. |
| Rename balance concept to structure | Done in current runtime/docs touched by this pass. |
| Implement flavor families and descriptors | Done for family/descriptor generation and UI display. |
| Implement taste quality score | Done at family level. |
| Connect contracts to taste quality and site requirements | Done. |
| Implement descriptor scoring | Deferred. |
| Implement customer taste preferences | Deferred until a unified structure+taste market preference model exists. |

## References

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

- The Wine Folly mapping is adapted for game design; it is not a claim of enological precision.
- The current family-level `tasteQualityIndex` is accepted as the gameplay score for now.
- Descriptor scoring and customer taste preferences should not be wired into outcomes without updating `CONTEXT.md` and `docs/WineSystem_VariableRelationshipMap.md`.
