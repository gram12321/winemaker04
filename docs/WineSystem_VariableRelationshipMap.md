# Wine System Variable Relationship Map
Date: 2026-05-20
Status: Current variable relationship map

Stable terminology, constants, parameters, and variable descriptions live in [CONTEXT.md](../CONTEXT.md). This document focuses on how the main wine-system variables depend on each other through the gameflow.

## 1) Purpose

This map answers three questions:

- Which variables are produced at each stage of wine gameplay?
- Which variables are snapshots, and which continue to change?
- Which subsystems consume each variable later for UI, economy, contracts, highscores, and achievements?

## 2) Reading Rules

- Arrows mean data dependency, not call order.
- Snapshot nodes are frozen values copied from current state at harvest, bottling, or winelog insertion.
- `landValueModifier` and `tasteQualityIndex` are separate signals and should not be treated as aliases.

## 3) Top-Level Gameflow

```mermaid
flowchart LR
  LS["Land search / vineyard setup"] --> VM["Vineyard management"]
  VM --> H["Harvest"]
  H --> WB["Wine batch"]
  WB --> C["Crushing"]
  C --> F["Fermentation"]
  F --> B["Bottling"]
  B --> CE["Cellar evolution"]
  CE --> S["Sales and contracts"]
  B --> WL["Wine log"]
  WL --> PR["Highscores and achievements"]
  S --> ECO["Money, prestige, customer relationships"]
  PR --> ECO
```

## 4) Main Variable Groups

| Group | Produced from | Produces |
|---|---|---|
| Site Factors | Vineyard generation and vineyard state | Land value modifier, suitability, harvest anchors |
| Intrinsic Grape Traits | Grape constants | Base characteristics, yield, risk sensitivity, anchor bias |
| Anchors | Site factors, grape traits, process controls, features | Structure ranges, taste profile, lifecycle risk |
| Structure Layer | Characteristics plus anchor-adjusted ideal ranges | `structureIndex` |
| Taste Layer | Anchors, characteristics, grape color, features, aging | Taste families, descriptors, `tasteQualityIndex` |
| Lifecycle Modifiers | Features, bottle aging, oxidation, prestige | Current taste, price, cellar value, risk |
| Outcome Metrics | Structure, taste quality, land value, lifecycle modifiers | Wine score, price, contract validity, historical records |

## 5) Relationship Invariants

- Site factors and grape traits create the wine's initial identity at harvest.
- Process controls should modify identity through anchors, characteristics, features, or explicit snapshots, not through hidden unrelated side effects.
- Structure and taste are different layers: structure scores physical balance; taste quality scores family balance.
- Land value affects price and contracts as site/static quality; it is not taste quality.
- Bottling snapshots are the historical source for wine log, highscores, and achievement score checks.
- Current cellar values may continue to evolve after bottling; historical snapshots must not drift.

## 6) Subsystem Diagrams

### 6.1 Site, Grape, and Harvest Identity

```mermaid
flowchart LR
  SF["Site Factors\nsoil, altitude, aspect, density,\nhealth, ripeness, landValue"] --> LVM["landValueModifier"]
  SF --> SUIT["Grape suitability"]
  IGT["Intrinsic Grape Traits\ngrapeColor, naturalYield,\nfragile, proneToOxidation,\nbase characteristics"] --> HA["Harvest anchors"]
  SUIT --> HA
  LVM --> HA
  HA --> WB["WineBatch.wineAnchors"]
  LVM --> LVMH["landValueModifierHarvestSnapshot"]
  WB --> SIH["structureIndexHarvestSnapshot"]
  WB --> TQH["tasteQualityIndexHarvestSnapshot\n(taste quality harvest snapshot)"]
```

### 6.2 Process Controls and Winery Mutation

```mermaid
flowchart LR
  WB["Wine batch"] --> PC["Process Controls\ncrushing options,\nfermentation method,\ntemperature"]
  PC --> AD["Anchor deltas"]
  PC --> CD["Characteristic deltas"]
  PC --> FE["Feature risk / feature state"]
  AD --> CA["Current anchors"]
  CD --> CH["Current characteristics"]
  FE --> CA
  FE --> CH
  CA --> TASTE["Taste profile"]
  CA --> STRUCT["Anchor-adjusted structure ranges"]
  CH --> STRUCT
```

### 6.3 Structure Subsystem

```mermaid
flowchart LR
  A["Current anchors"] --> R["Anchor-adjusted ideal ranges"]
  BC["Base balanced ranges"] --> R
  CH["Characteristics\nacidity, aroma, body,\nspice, sweetness, tannins"] --> BAL["Balance scoring"]
  R --> BAL
  RULES["Structure penalties and synergies"] --> BAL
  BAL --> SI["structureIndex"]
  SI --> WS["wineScore"]
  SI --> UI["Structure UI"]
  SI --> CR["Structure contract requirement"]
```

### 6.4 Taste Subsystem

```mermaid
flowchart LR
  A["Current anchors"] --> TF["Taste family profile"]
  CH["Characteristics"] --> TF
  GC["grapeColor"] --> TF
  FE["Features and aging"] --> TF
  TF --> DESC["Descriptors by family\ndisplay-only"]
  TF --> TQB["Family ideal ranges,\nweights, compatibility"]
  TQB --> TQI["tasteQualityIndex"]
  TQI --> WS["wineScore"]
  TQI --> UI["Taste wheel and quality UI"]
  TQI --> CTR["Taste quality contract requirement"]
```

### 6.5 Score, Price, and Market Outcomes

```mermaid
flowchart LR
  TQI["tasteQualityIndex"] --> WS["wineScore"]
  SI["structureIndex"] --> WS
  WS --> BASE["Base price = wineScore * base rate"]
  WS --> CURVE["Score curve multiplier"]
  LVM["landValueModifier"] --> LPM["Land value price multiplier"]
  FE["Feature price effects"] --> FPM["Feature price multiplier"]
  CP["Company prestige"] --> CPM["Company prestige multiplier"]
  VP["Vineyard prestige"] --> VPM["Vineyard prestige multiplier"]
  BASE --> EP["estimatedPrice"]
  CURVE --> EP
  LPM --> EP
  FPM --> EP
  CPM --> EP
  VPM --> EP
  EP --> SALES["Sales offers and cellar value"]
```

### 6.6 Snapshots, History, and Progression

```mermaid
flowchart LR
  CUR["Current wine state"] --> BOTTLE["Bottling event"]
  BOTTLE --> TQB["tasteQualityIndexBottlingSnapshot"]
  BOTTLE --> SIB["structureIndexBottlingSnapshot"]
  BOTTLE --> LVMB["landValueModifierBottlingSnapshot"]
  BOTTLE --> WSB["wineScoreBottlingSnapshot"]
  TQB --> WL["WineLogEntry"]
  SIB --> WL
  LVMB --> WL
  WSB --> WL
  WL --> HS["Highscores"]
  WL --> ACH["Achievements"]
  WL --> HIST["Historical vineyard analytics"]
```

## 7) Contract Relationships

| Contract requirement | Source variable | Notes |
|---|---|---|
| `tasteQuality` | Current computed `tasteQualityIndex` | Validates taste balance, not land value. |
| `structureIndex` | Current `structureIndex` | Validates structure balance. |
| `landValue` | Source vineyard `landValue` | Validates site/static value as absolute value per hectare. |
| `country`, `region` | Source vineyard location | Validates origin requirements. |
| `grape`, `grapeColor` | Wine batch grape identity | Validates variety and color. |
| `altitude`, `aspect` | Source vineyard site factors | Validates site parameters. |
| `characteristicMin`, `characteristicMax`, `characteristicDeviation` | Current wine characteristics | Validates structural channel thresholds or distance. |

## 8) Snapshot Relationship Rules

| Event | Snapshot fields | Consumers |
|---|---|---|
| Harvest | `landValueModifierHarvestSnapshot`, `structureIndexHarvestSnapshot`, `tasteQualityIndexHarvestSnapshot` | UI comparison, batch history, debugging harvest decisions |
| Bottling | `tasteQualityIndexBottlingSnapshot`, `landValueModifierBottlingSnapshot`, `structureIndexBottlingSnapshot`, `wineScoreBottlingSnapshot` | Wine log, highscores, achievements, historical analytics |
| Wine log insertion | `WineLogEntry.tasteQualityIndex`, `WineLogEntry.landValueModifier`, `WineLogEntry.structureIndex`, `WineLogEntry.wineScore` | Vineyard stats, achievements, persistent production history |

## 9) UI Relationship Surfaces

| UI surface | Relationship shown |
|---|---|
| Wine modal overview | Current score, current price, and harvest/current/bottling snapshot comparison. |
| Structure tab | Current characteristics, anchor-adjusted ideal ranges, structure score, penalties, and synergies. |
| Taste tab | Flavor families, descriptors, taste wheel, taste quality family weights and reasons. |
| Land value tab | Vineyard factors behind the land value modifier. |
| Origins tab | Characteristic changes grouped by source/effect. |
| Wine log and vineyard analytics | Bottling snapshots and historical production records. |

## 10) Current Implementation Checkpoints

| Area | Current state |
|---|---|
| Compact anchors | Runtime uses 12-key `WineAnchorValues`; database parsing accepts only the current compact keys. |
| Taste profile | Runtime computes 14 flavor families and descriptor values from anchors, characteristics, grape identity, features, and aging. |
| Taste quality | `tasteQualityIndex` is implemented as a family-level quality score with red/white base targets, grape nudges, dependency rules, family weights, and UI breakdown reasons. |
| Wine log snapshots | Wine log and wine highscores use bottling snapshots for taste quality, structure, land value, and wine score. |
| Achievement wine score | `wine_score_threshold` achievements use finite persisted `WineLogEntry.wineScore`; missing or non-finite scores do not derive a fallback. |
| Contract quality split | `tasteQuality` and `landValue` are separate requirements. |
| Descriptor hierarchy | Descriptors are grouped under flavor families and remain display-only for now. |
| Current conclusion | The family-level taste system is sufficient for now; descriptor scoring and unified customer taste preferences remain deferred. |

## 11) Main Game Variable Relationship Matrix

This table follows the practical gameflow from land purchase through sales and progression.

| Game phase | Player/state inputs | Main variables produced | Main downstream consumers | Player-visible effect |
|---|---|---|---|---|
| Land search and vineyard ownership | Country, region, soil, altitude, aspect, hectares, land value | Site Factors | Suitability, land value modifier, contracts | Land choice changes crop fit, site quality, and future market eligibility. |
| Vineyard maintenance | Health, overgrowth, density, vine age, grape planted | Updated Site Factors and yield conditions | Harvest yield, anchors, land value modifier | Good maintenance improves harvest potential and reduces penalties. |
| Grape identity | Grape constants and planted variety | Intrinsic Grape Traits | Anchors, base characteristics, taste color rules, yield, risk | Variety changes wine style, risks, and customer fit. |
| Harvest | Ripeness, site factors, grape traits | Harvest anchors, harvest snapshots, initial wine batch | Winery processing, structure, taste, lifecycle | Harvest timing freezes the starting identity of the wine. |
| Crushing | Crush method/options, batch state | Extraction anchor changes, characteristic deltas, feature risk | Structure ranges, taste profile, lifecycle | Processing choices push style and risk. |
| Fermentation | Method, temperature, time/progress | Fermentation anchors, current characteristics, features | Taste profile, structure score, bottling readiness | Fermentation completes the main transformation from must to wine. |
| Bottling | Current wine state | Bottling snapshots, `wineScoreBottlingSnapshot`, wine log row | Highscores, achievements, historical analytics | Bottling freezes the historical record while cellar values may continue evolving. |
| Cellar evolution | Features, aging progress, oxidation, bottle aging | Current taste, current price, current score changes | Cellar UI, sales offers, current contract validation | Wine can become more or less valuable after bottling. |
| Sales/contracts | Customer requirements, relationships, market context | Contract validity, orders, revenue | Money, customer relationships, prestige | The market evaluates wine variables against demand. |
| Progression | Wine log, sales, scores, assets | Highscores, achievements, prestige events | Company value, reputation, future opportunities | Historical performance feeds long-term progression. |

## 12) Main Variable Flow Display

```mermaid
flowchart TD
  SF["Site Factors"] --> HA["Harvest anchors"]
  IGT["Intrinsic Grape Traits"] --> HA
  PC["Process Controls"] --> CA["Current anchors"]
  HA --> CA
  PC --> CH["Current characteristics"]
  CA --> CH

  CA --> AR["Anchor-adjusted structure ranges"]
  CH --> SI["structureIndex"]
  AR --> SI

  CA --> TF["Taste families"]
  CH --> TF
  TF --> TQI["tasteQualityIndex"]

  SI --> WS["wineScore"]
  TQI --> WS
  LVM["landValueModifier"] --> PRICE["estimatedPrice"]
  WS --> PRICE
  FE["Feature and prestige multipliers"] --> PRICE

  WS --> SNAP["Bottling snapshots"]
  SI --> SNAP
  TQI --> SNAP
  LVM --> SNAP
  SNAP --> WL["Wine log"]
  WL --> ACH["Achievements"]
  WL --> HS["Highscores"]
  PRICE --> SALES["Sales/contracts"]
  SALES --> ECO["Money, prestige, relationships"]
  ACH --> ECO
  HS --> ECO
```

## 13) Remaining Alignment Work

- Keep anchor parsing strict: unknown anchor keys should be ignored, and new business logic should target only the compact anchor model.
- If descriptor-level taste becomes gameplay-relevant, update this map and `CONTEXT.md` before wiring descriptors into outcomes.
