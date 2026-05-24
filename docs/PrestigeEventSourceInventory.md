# Prestige Event Source Inventory
Date: 2026-05-24
Status: Current code audit of prestige event creators

This document lists the current producers of `prestige_events` rows. It focuses on creators first; a full consumer inventory can be added as a follow-up.

## Format Decision

Markdown is the best fit for the current inventory. The source list is small enough to read as documentation, and each row needs source files, formulas, decay behavior, caveats, and event semantics. CSV would only be useful later if we want automated validation or balancing exports.

## Ledger Semantics

| Concept | Current behavior |
|---|---|
| Storage | Prestige events are stored in `prestige_events` through `insertPrestigeEvent()` or `upsertPrestigeEventBySource()` in `src/lib/database/customers/prestigeEventsDB.ts`. |
| Permanent event | `decay_rate = 0`. These rows are not selected by weekly decay and are usually recalculated/upserted by source id. |
| Decaying event | `0 < decay_rate < 1`. Weekly decay multiplies `amount_base` by `decay_rate`; rows are deleted when absolute amount falls below `0.001`. |
| Penalty event | Negative `amount_base`. Decay still multiplies toward zero, so penalties fade over time. |
| Source id | `source_id` links vineyard-specific events, source-specific permanent rows, or synthetic sources such as `research_<projectId>`. |
| Payload | `payload` carries display and calculation context; UI derives labels from this metadata where possible. |

Weekly decay is applied by `decayPrestigeEventsOneWeek()` in `src/lib/services/prestige/prestigeDecayService.ts`, currently triggered from `src/hooks/usePrestigeAndVineyardValueUpdates.ts` when the observed game week changes.

## Permanent And Recalculated Sources

| Creator | Event type | Source id | Amount inputs | Decay | Write path |
|---|---|---|---|---|---|
| Company net worth | `company_finance` | `company_net_worth` | Company value and `getMaxLandValue()` | `0` | `initializeBasePrestigeEvents()`, `updateCompanyValuePrestige()`, and `usePrestigeUpdates()` call `updateBasePrestigeEvent()` in `src/lib/services/prestige/prestigeService.ts`. |
| Vineyard vine age | `vineyard_age` | `<vineyardId>_age` | Vine age, grape suitability, density modifier | `0` | `createVineyardFactorPrestigeEvents()` upserts via `updateBasePrestigeEvent()`. Triggered by prestige initialization, vineyard creation/purchase, final planting, and partial planting density changes. |
| Vineyard land value | `vineyard_land` | `<vineyardId>_land` | Land value per hectare, hectares, grape suitability, density modifier | `0` | Same vineyard factor path as `vineyard_age`. |
| Aged cellar collection | `cellar_collection` | `aged_wine_inventory` | Bottled non-oxidized wines aged at least 5 years, bottle count, estimated price, average/oldest age | `0` | `updateCellarCollectionPrestige()` in `prestigeService.ts`, called weekly from `processGameTick()` in `src/lib/services/core/gameTick.ts`. |
| Admin prestige grant | `admin_cheat` | `null` | Manual admin amount | `0` | `adminAddPrestigeToCompany()` in `src/lib/services/admin/adminService.ts`. Development/admin-only; event type is written with `as any` and is not part of `PrestigeEventType`. |

## Decaying One-Off Sources

| Creator | Event type | Source id | Amount inputs | Decay | Write path |
|---|---|---|---|---|---|
| Starting-condition family story | `company_story` by default | `null` | Country starting prestige config | Configured, currently `0.999` for France, Italy, and Germany | `applyStartingConditions()` in `src/lib/services/core/startingConditionsService.ts`; config lives in `src/lib/constants/startingConditions.ts`. |
| Wine order fulfillment, vineyard-linked | `vineyard_sale` | Vineyard id | Fulfilled sale value and base vineyard prestige factor | `0.95` | `fulfillWineOrder()` in `src/lib/services/sales/salesService.ts` calls `addVineyardSalePrestigeEvent()`. |
| Wine order fulfillment, no vineyard fallback | `sale` | `null` | Fulfilled sale value, volume, company assets | `0.95` | `fulfillWineOrder()` fallback path calls `addSalePrestigeEvent()` only when the wine batch has no vineyard id. |
| Contract fulfillment | `sale` | `null` | Contract revenue and bottle quantity | `0.95` | `fulfillContract()` in `src/lib/services/sales/contractService.ts` calls `addSalePrestigeEvent()`. |
| Wine feature manifestation | `wine_feature` | `null` for company level, vineyard id for vineyard level | Feature config, batch size, taste quality, current company/vineyard prestige | Config-driven | `handleManifestation()` in `src/lib/services/wine/features/featureService.ts` calls `addFeaturePrestigeEvent()`. |
| Sale of wine with a prestige-aware feature | `wine_feature` | `null` for company level, vineyard id for vineyard level | Feature config, sale value, volume, current prestige, vineyard context | Config-driven | `fulfillWineOrder()` detects present features and calls `addFeaturePrestigeEvent(..., 'sale')`. |
| Planting completion | `vineyard_achievement` | Vineyard id | Base vineyard prestige multiplied by `0.1` | `0.90` | `completePlanting()` in `src/lib/services/vineyard/vineyardService.ts` calls `addVineyardAchievementPrestigeEvent('planting', ...)`. The helper supports `aging`, `improvement`, and `harvest`, but no current code path calls those variants. |
| Achievement unlock, company | `achievement` | `null` | Tier prestige amount from `achievementLevels` | Tier half-life formula | `spawnAchievementPrestigeEvents()` in `src/lib/services/user/achievementService.ts`. |
| Achievement unlock, qualifying vineyard | `vineyard_achievement` | Vineyard id | Company tier amount divided by `100` | Tier half-life formula accelerated by vineyard multiplier | Same achievement service path; emitted only for achievement sets created with `includeVineyard`. |
| Research completion reward | `achievement` | `research_<projectId>` | `ResearchProject.prestigeReward` | `0.98` | `researchManager.ts` calls `addResearchPrestigeEvent()` when a completed project has a positive prestige reward. Starting research unlocks do not create prestige events. |
| Incomplete bookkeeping spillover | `penalty` | `bookkeeping_penalty` | Spillover penalty amount and incomplete task count | `0.90` | `bookkeepingManager.ts` calls `insertPrestigeEvent()` through `applyPrestigePenalty()`. |
| Emergency quick loan | `company_finance` | `null` | `EMERGENCY_QUICK_LOAN.PRESTIGE_PENALTY`, currently `-15` | `0.99735` | `loanService.ts` in `src/lib/features/loanLender/services/finance/`. |
| Forced loan restructure | `company_finance` | `null` | `EMERGENCY_RESTRUCTURE.PRESTIGE_PENALTY`, currently `-35` | `0.998667` | `loanService.ts`. |
| Loan missed payment warning #2 | `company_finance` | `null` | `LOAN_MISSED_PAYMENT_PENALTIES.WARNING_2.PRESTIGE_PENALTY`, currently `-25` | `0.998667` | `loanService.ts`. |
| Loan default | `company_finance` | `null` | `LOAN_DEFAULT.PRESTIGE_PENALTY`, currently `-75` | `0.999334` | `loanService.ts`. |

## Wine Feature Prestige Configs

All feature prestige events are written as `wine_feature`. Company-level rows use `source_id = null`; vineyard-level rows use the vineyard id. Amounts are dynamic unless noted.

| Feature | Trigger | Level | Base amount | Decay | Max impact | Source config |
|---|---|---|---:|---:|---:|---|
| Oxidation | Manifestation | Company | `-0.05` | `0.995` | `-5.0` | `src/lib/constants/wineFeatures/oxidation.ts` |
| Oxidation | Manifestation | Vineyard | `-0.5` | `0.98` | `-10.0` | `oxidation.ts` |
| Oxidation | Sale | Company | `-0.1` | `0.995` | `-10.0` | `oxidation.ts` |
| Oxidation | Sale | Vineyard | `-0.2` | `0.98` | `-8.0` | `oxidation.ts` |
| Green flavor | Manifestation | Company | `-0.02` | `0.995` | `-3.0` | `src/lib/constants/wineFeatures/greenFlavor.ts` |
| Green flavor | Manifestation | Vineyard | `-0.3` | `0.98` | `-8.0` | `greenFlavor.ts` |
| Green flavor | Sale | Company | `-0.05` | `0.995` | `-8.0` | `greenFlavor.ts` |
| Green flavor | Sale | Vineyard | `-0.1` | `0.98` | `-5.0` | `greenFlavor.ts` |
| Stuck fermentation | Manifestation | Company | `-0.08` | `0.995` | `-4.0` | `src/lib/constants/wineFeatures/stuckFermentation.ts` |
| Stuck fermentation | Manifestation | Vineyard | `-0.4` | `0.98` | `-9.0` | `stuckFermentation.ts` |
| Stuck fermentation | Sale | Company | `-0.08` | `0.995` | `-9.0` | `stuckFermentation.ts` |
| Stuck fermentation | Sale | Vineyard | `-0.15` | `0.98` | `-6.0` | `stuckFermentation.ts` |
| Terroir | Sale | Company | `0.05` | `0.998` | `8.0` | `src/lib/constants/wineFeatures/terroir.ts` |
| Terroir | Sale | Vineyard | `0.08` | `0.995` | `12.0` | `terroir.ts` |
| Bottle aging | Sale | Company | `0.05` | `0.998` | `15.0` | `src/lib/constants/wineFeatures/bottleAging.ts` |

Active feature configs without prestige effects currently include Noble Rot and Grey Rot. `lateHarvest.ts` exists but is not in the active feature registry in `commonFeaturesUtil.ts`.

## Achievement Prestige Pattern

Tiered achievements are generated by `createTieredAchievements()` in `src/lib/services/user/achievementService.ts`.

| Tier | Company amount | Company decay target |
|---|---:|---|
| 1 | `0.1` | 50 percent retained after 1 year |
| 2 | `5` | 50 percent retained after 5 years |
| 3 | `50` | 50 percent retained after 25 years |
| 4 | `350` | 50 percent retained after 75 years |
| 5 | `1000` | 50 percent retained after 100 years |

Vineyard achievement rows, where enabled, use `company amount / 100` and a shorter half-life controlled by the achievement set's `vineyardDecayMultiplier`.

## Research Prestige Pattern

Research completion creates prestige only for projects with `prestigeReward > 0`. The shared reward formula in `src/lib/constants/researchConstants.ts` is:

```text
prestigeReward = clamp((complexity * 2) - 2, 1, 15)
```

The event decays at `0.98` weekly retention. Research unlocks and `permanentEffects` are separate progression systems and should not be counted as prestige event creators unless they also call `addResearchPrestigeEvent()`.

## Current Aggregation Consumers

These are the main consumers discovered during the creator audit. A future pass should expand this into a full consumer matrix.

| Consumer | Uses prestige for |
|---|---|
| `calculateCurrentPrestige()` | Sums prestige events into total, company, and vineyard prestige; persists vineyard prestige snapshots back to vineyards. |
| Header and prestige modal | Displays total prestige and event breakdowns. |
| Wine price calculation | Applies company and vineyard prestige multipliers to estimated price and sales displays. |
| Land value modifier | Uses bounded vineyard prestige as part of site/static quality and vineyard value calculations. |
| Research eligibility | Uses current prestige as a project gate. |
| Customer/order/contract systems | Use prestige for market access, customer generation, relationship effects, and offer/chance calculations. |
| Achievements | Some achievement conditions check company or vineyard prestige thresholds. |
| Share/company valuation systems | Treat prestige as one of the growth or expectation signals. |

## Audit Notes

| Note | Detail |
|---|---|
| Company value formula inconsistency | `initializeBasePrestigeEvents()` and `updateCompanyValuePrestige()` use `log(companyValue / maxLandValue + 1)`, while `usePrestigeUpdates()` writes `log(companyValue / maxLandValue + 1) * 2` to the same `company_net_worth` source. |
| Company-level `wine_feature` aggregation | `calculateCurrentPrestige()` classifies every `wine_feature` row as vineyard prestige by event type, even when the row has `source_id = null` and payload level `company`. |
| Vineyard age refresh gap | `updateVineyardAges()` increments vine age but does not directly call `updateBaseVineyardPrestigeEvent()`. Existing comments imply annual aging updates base prestige, but the current write paths found are initialization, vineyard creation/purchase, planting, and partial planting density changes. |
| Declared but unused event types | `contract`, `vineyard_base`, and `vineyard_region` are declared or referenced for display/breakdown but no active creator was found. |
| Written but undeclared event type | `admin_cheat` is inserted by admin tooling with `as any`, but is not part of `PrestigeEventType`. |
