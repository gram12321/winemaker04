# Project Context
Date: 2026-05-20

This file holds stable domain language for the winery management game. Variable flow and dependency diagrams live in [docs/WineSystem_VariableRelationshipMap.md](docs/WineSystem_VariableRelationshipMap.md).

## Wine System Glossary

| Term | Meaning | Examples |
|---|---|---|
| Site Factors | Vineyard and region context that exists before player processing choices | `country`, `region`, `soil`, `altitude`, `aspect`, `landValue`, `density`, `overgrowth`, `vineAge`, `vineyardHealth`, `ripeness` |
| Intrinsic Grape Traits | Grape-inherent properties with direct gameplay effects | `grapeColor`, `naturalYield`, `fragile`, `proneToOxidation`, base structure constants |
| Anchors | Persisted hidden wine identity state, compact and multi-source | `sugarPotential`, `acidPotential`, `terroirExpression` |
| Process Controls | Player actions in winery and vineyard operations | crush method/options, fermentation method/temperature, harvest timing choices |
| Structure Layer | Player-facing structural channels and structure index | `acidity`, `aroma`, `body`, `spice`, `sweetness`, `tannins`, `structureIndex` |
| Taste Layer | Flavor-family and descriptor model used for taste wheel and taste quality | 14 families, descriptors grouped under families |
| Lifecycle Modifiers | Ongoing evolving systems after wine creation | feature severities, bottle aging, prestige effects |
| Outcome Metrics | Economy and progression outputs | wine score, price, contracts, highscores, achievements |
| Snapshot | Immutable historical capture at event boundaries | harvest snapshot, bottling snapshot, winelog snapshot |

## Core Variable Groups

### Site Factors

| Variable | Description | Main use |
|---|---|---|
| `country`, `region` | Geographic identity of the vineyard. | Suitability, contracts, customer requirements, flavor/terroir context. |
| `soil` | Soil type list on the vineyard. | Grape suitability, minerality/terroir contribution. |
| `altitude` | Vineyard elevation. | Grape suitability, acidity/sugar balance, contract requirements. |
| `aspect` | Vineyard sun orientation. | Heat/sun suitability, sugar/acidity tendencies. |
| `density` | Vine density. | Row competition, yield/work scaling, terroir expression. |
| `overgrowth` | Vegetation, debris, and uproot pressure. | Site wildness, land value penalties, vineyard work. |
| `vineAge` | Age of planted vines. | Vine maturity, yield baseline, terroir/maturation contribution. |
| `vineyardHealth` | Vineyard condition on a 0-1 scale. | Yield, anchor quality, oxidation pressure, terroir expression. |
| `ripeness` | Harvest readiness on a 0-1 scale. | Yield, sugar/acid balance, harvest anchor creation. |
| `landValue` | Static land value per hectare. | Land value modifier, price path, land-value contract requirements. |

### Intrinsic Grape Traits

| Variable | Description | Main use |
|---|---|---|
| `grapeColor` | Red or white grape identity. | Taste family balance, phenolic/tannin expectations, contract requirements. |
| `naturalYield` | Grape yield potential. | Harvest output and economy. |
| `fragile` | Sensitivity to handling and work pressure. | Risk and process sensitivity. |
| `proneToOxidation` | Oxidation vulnerability. | Feature risk, oxidation pressure, lifecycle behavior. |
| `baseCharacteristics` | Base structure values by grape. | Initial structure channels and anchor creation. |

## Wine Anchors

Current persisted anchor model:

| Anchor | Description |
|---|---|
| `sugarPotential` | Sugar/ripeness identity, shaped by grape, ripeness, warmth, and harvest timing. |
| `acidPotential` | Acid retention identity, shaped by grape, ripeness, altitude, and sun exposure. |
| `phenolicPotential` | Tannin/color/skin identity, especially relevant for red wines. |
| `aromaticPotential` | Aroma expression identity from grape and site signal. |
| `bodyPotential` | Body/alcohol/texture identity. |
| `extractionState` | Crushing and extraction process state. |
| `fermentationState` | Fermentation method and progress state. |
| `leesState` | Lees/autolysis process state. |
| `oxidationPressure` | Oxidation tendency from grape, acid, health, ripeness, and features. |
| `maturationState` | Aging/spice/cellar evolution state. |
| `terroirExpression` | Site expression from suitability, soil, altitude, vine age, row competition, and health. |
| `processFootprint` | Accumulated feature/process footprint. |

Legacy 26-anchor JSON may still be parsed by migration code, but gameplay logic should use the compact 12-anchor model.

## Structure Variables

| Variable | Description |
|---|---|
| `acidity` | Freshness and acid structure. |
| `aroma` | Aromatic structural intensity. |
| `body` | Weight and texture. |
| `spice` | Spice/maturation structural signal. |
| `sweetness` | Sweetness and sugar impression. |
| `tannins` | Tannin/phenolic structure. |
| `structureIndex` | Aggregate score from structural channels, ideal ranges, penalties, and synergies. |

Base balanced ranges:

| Channel | Base accepted range |
|---|---|
| `acidity` | 0.40-0.60 |
| `aroma` | 0.30-0.70 |
| `body` | 0.40-0.80 |
| `spice` | 0.35-0.65 |
| `sweetness` | 0.40-0.60 |
| `tannins` | 0.35-0.65 |

## Taste Variables

The taste layer has 14 flavor families. Descriptors are children of families and are display-only for now.

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

`tasteQualityIndex` is computed from the flavor-family profile, family ideal ranges, family weights, and compatibility rules. It is not the same thing as `landValueModifier`.

## Outcome Variables and Parameters

| Variable or parameter | Description |
|---|---|
| `landValueModifier` | Current 0-1 wine-side site/static quality modifier derived from vineyard land value, prestige, density, and overgrowth pressure. |
| `tasteQualityIndex` | Current 0-1 taste balance score computed from the 14 taste families. |
| `wineScore` | Overall score. Current implementation uses `(tasteQualityIndex + structureIndex) / 2`. |
| `estimatedPrice` | Current estimated bottle price. |
| `BASE_RATE_PER_BOTTLE` | Price model base rate, currently 25. |
| `LAND_VALUE_MIN_MULTIPLIER` | Land value price multiplier floor, currently 0.2. |
| `LAND_VALUE_MAX_MULTIPLIER` | Land value price multiplier ceiling, currently 3.0. |
| `PRESTIGE_MAX_BONUS` | Max normalized prestige price bonus, currently +250%. |
| `MAX_PRICE` | Per-bottle price cap, currently 99,999,999.99. |

Estimated price is driven by wine score, score curve multiplier, land value price multiplier, feature price multiplier, company prestige, and vineyard prestige.

## Process and Contract Parameters

| Parameter | Description |
|---|---|
| `fermentationProgress` | Batch progress through fermentation, from 0 to 100. |
| `fermentationOptions.method` | Fermentation method selected by the player, currently Basic, Temperature Controlled, or Extended Maceration. |
| `fermentationOptions.temperature` | Fermentation temperature selected by the player, currently Ambient, Cool, or Warm. |
| `features` | Active or evolving wine features, including risks, faults, positive features, and lifecycle effects. |
| `agingProgress` | Weeks aged in bottle after bottling. |
| `ContractRequirement.type` | Customer requirement category, such as `tasteQuality`, `structureIndex`, `landValue`, `country`, `region`, `grape`, `grapeColor`, `altitude`, `aspect`, `characteristicMin`, `characteristicMax`, or `characteristicDeviation`. |
| `ContractRequirement.value` | Requirement threshold or target. Its unit depends on requirement type: 0-1 score, absolute land value, vintage year/age, or characteristic threshold. |

## Snapshot Variables

| Snapshot | Description |
|---|---|
| `landValueModifierHarvestSnapshot` | Immutable site/static value captured at harvest. |
| `structureIndexHarvestSnapshot` | Immutable structure score captured at harvest. |
| `tasteQualityIndexHarvestSnapshot` | Immutable taste quality captured at harvest. |
| `tasteQualityIndexBottlingSnapshot` | Immutable taste quality captured at bottling. |
| `landValueModifierBottlingSnapshot` | Immutable land value modifier captured at bottling. |
| `structureIndexBottlingSnapshot` | Immutable structure score captured at bottling. |
| `wineScoreBottlingSnapshot` | Immutable wine score captured at bottling. |
| `WineLogEntry.wineScore` | Persisted historical wine score used by achievements and historical displays. |

## Naming Policy

- Business logic should not use fallback aliases for renamed fields.
- Database persistence should prefer explicit names such as `taste_quality_index`, `structure_index`, and `wine_score`.
- Snapshot fields must be explicit about event timing: harvest, current, or bottling.
