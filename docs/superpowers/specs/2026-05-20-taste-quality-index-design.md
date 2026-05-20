# Taste Quality Index Design

Date: 2026-05-20

## Goal

Replace the fixed `QualityIndex = 0.5` placeholder with a computed `tasteQualityIndex` that scores how coherent the current 14-family taste profile is for the wine. The index should feed WineScore directly, alongside `structureIndex`.

## Naming

- `tasteProfile`: the current 14 taste-family values produced by `computeWineTasteProfile`.
- `tasteQualityIndex`: the 0-1 score for how well that profile fits the wine.
- UI label: `Taste Quality`.
- Persisted database columns use `taste_quality_index` naming in this slice. TypeScript compatibility fields may still map to those columns until the wider model rename is completed.

## Model

Taste quality follows the same philosophy as structure quality: high or low values are not inherently good. Each taste family has an ideal value and an accepted range. Those targets move based on:

- wine color: red or white,
- grape identity,
- the current 14-family taste profile,
- explicit taste-family dependency rules.

This first implementation scores only the 14 family layer. Descriptors remain display-only.

Future TODO: descriptor scoring can add finer typicity checks inside each family, such as whether citrus leans toward grapefruit or orange zest. That should be a later layer on top of family balance, not a replacement for the 14-family score.

## Scoring Flow

1. Compute the current `WineFlavorFamilyProfile`.
2. Build base family targets from wine color and grape priors.
3. Apply dependency rules. Example: high `redFruit` increases desired `blackFruit`, `driedFruit`, and `spiceFlavor`, while reducing tolerated `tropicalFruit`.
4. Score each family by distance from its accepted range.
5. Aggregate family scores with weights. Faults carry a high weight and target a low value.
6. Return `tasteQualityIndex` plus a breakdown for UI/debug use.
7. `WineScore = (tasteQualityIndex + structureIndex) / 2`.

## First-Slice Scope

In scope:

- pure scoring service for 14 taste families,
- unit tests for balanced and incoherent profiles,
- `getTasteQualityIndex(batch)` and compatibility `getQualityIndex(batch)` wrapper,
- WineScore and estimated price use computed taste quality,
- database columns renamed to `taste_quality_index`, `taste_quality_index_harvest_snapshot`, and `taste_quality_index_bottling_snapshot`,
- visible labels in touched wine score/quality UI move from "Quality Index" to "Taste Quality",
- contract quality requirements use Taste Quality, while site/land requirements remain separate as site parameters,
- Taste tab gains a structure-like Taste Quality breakdown without replacing the taste radar.

Out of scope:

- descriptor scoring,
- customer taste preferences,

Future TODO: customer taste preferences should be designed as one unified market-preference system covering both structure and taste. Do not add taste-only customer preferences before structure has the same concept.

## Risks

The first rule table will need tuning after playtesting. The service should therefore be data-driven and tested around relative behavior rather than exact final economy balance.
