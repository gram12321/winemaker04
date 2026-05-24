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

## Decay Translation

For balancing, this document treats "0-ish" as 1 percent of the original event amount remaining. The database cleanup threshold is stricter and absolute: rows are deleted when `abs(amount_base) < 0.001`, so actual deletion time depends on the starting event size.

| Weekly retention | Half-life | 0-ish level | Current use |
|---:|---:|---:|---|
| `0` | Permanent until recalculated or removed | Not applicable | Company value, vineyard age/land, cellar collection, admin grants |
| `0.90` | 6.6 weeks / 0.13 years | 43.7 weeks / 0.8 years | Planting completion, bookkeeping spillover |
| `0.95` | 13.5 weeks / 0.26 years | 89.8 weeks / 1.7 years | Sales and contracts |
| `0.98` | 34.3 weeks / 0.66 years | 227.9 weeks / 4.4 years | Research, vineyard-level negative wine features |
| `0.995` | 138.3 weeks / 2.66 years | 918.7 weeks / 17.7 years | Company-level negative wine features, terroir vineyard sales |
| `0.99735` | 261.2 weeks / 5.02 years | 1735.5 weeks / 33.4 years | Emergency quick loan |
| `0.998` | 346.2 weeks / 6.66 years | 2300.3 weeks / 44.2 years | Company-level positive wine features |
| `0.998667` | 519.6 weeks / 9.99 years | 3452.4 weeks / 66.4 years | Forced loan restructure, missed payment warning #2 |
| `0.999` | 692.8 weeks / 13.32 years | 4602.9 weeks / 88.5 years | Starting-condition family story |
| `0.999334` | 1040.4 weeks / 20.01 years | 6912.4 weeks / 132.9 years | Loan default |

## Permanent And Recalculated Sources

These rows do not decay. Their balance impact is controlled by recalculation frequency and formula scale, not half-life.

| Creator | Event type | Source id | Event size / formula | Decay interpretation | Write path |
|---|---|---|---|---|---|
| Company net worth | `company_finance` | `company_net_worth` | `ln(companyValue / maxLandValue + 1)`. Example: 1x max land value = `+0.69`, 10x = `+2.40`, 100x = `+4.62`, 1000x = `+6.91`. No hard cap. | Permanent recalculated row. | `initializeBasePrestigeEvents()`, `updateCompanyValuePrestige()`, and `usePrestigeUpdates()` call `updateBasePrestigeEvent()` in `src/lib/services/prestige/prestigeService.ts`. |
| Vineyard vine age | `vineyard_age` | `<vineyardId>_age` | `max(0, asym(age01 * grapeSuitability) - 1) * densityModifier`. Dynamic and unbounded by the event writer; density modifier ranges `0.5` to `1.5`. | Permanent recalculated row. | `createVineyardFactorPrestigeEvents()` upserts via `updateBasePrestigeEvent()`. Triggered by prestige initialization, vineyard creation/purchase, final planting, partial planting density changes, and annual vineyard age updates. |
| Vineyard land value | `vineyard_land` | `<vineyardId>_land` | `max(0, asym(squash(ln(landValuePerHa / maxLandValue + 1) * suitability)) - 1) * sqrt(hectares) * densityModifier`. Dynamic and grows with site value and vineyard size. | Permanent recalculated row. | Same vineyard factor path as `vineyard_age`. |
| Aged cellar collection | `cellar_collection` | `aged_wine_inventory` | `sqrt(sum(sqrt(ageYears - 4) * 0.1 * ln(bottles + 1) * ln(price * 10 + 1) * 0.01))` for bottled, non-oxidized wines aged at least 5 years. Dynamic with diminishing returns; no hard cap. | Permanent recalculated row. | `updateCellarCollectionPrestige()` in `prestigeService.ts`, called weekly from `processGameTick()` in `src/lib/services/core/gameTick.ts`. |
| Admin prestige grant | `admin_cheat` | `null` | Manual admin amount. Arbitrary size. | Permanent one-off row. | `adminAddPrestigeToCompany()` in `src/lib/services/admin/adminService.ts`. Development/admin-only; event type is part of `PrestigeEventType`. |

## Decaying One-Off Sources

| Creator | Event type | Source id | Event size / formula | Decay interpretation | Write path |
|---|---|---|---|---|---|
| Starting-condition family story | `company_story` by default | `null` | France `+5`, Italy `+2`, Germany `+1`; Spain and United States currently have no starting prestige event. | `0.999`: half-life 13.3 years; 0-ish after 88.5 years. | `applyStartingConditions()` in `src/lib/services/core/startingConditionsService.ts`; config lives in `src/lib/constants/startingConditions.ts`. |
| Wine order fulfillment, vineyard-linked | `vineyard_sale` | Vineyard id | `(saleValue / 10000) * max(0.1, vineyardPrestige)`. No hard cap in the helper, so high-value sales from high-prestige vineyards can scale sharply. | `0.95`: half-life 13.5 weeks; 0-ish after 1.7 years. | `fulfillWineOrder()` in `src/lib/services/sales/salesService.ts` calls `addVineyardSalePrestigeEvent()`. |
| Wine order fulfillment, no vineyard fallback | `sale` | `null` | `saleValue / 10000`, then scaled by log volume, log value, and sqrt company assets; capped at `+10`. | `0.95`: half-life 13.5 weeks; 0-ish after 1.7 years. | `fulfillWineOrder()` fallback path calls `addSalePrestigeEvent()` only when the wine batch has no vineyard id. |
| Contract fulfillment | `sale` | `null` | Same company sale formula as wine order fallback; capped at `+10`. | `0.95`: half-life 13.5 weeks; 0-ish after 1.7 years. | `fulfillContract()` in `src/lib/services/sales/contractService.ts` calls `addSalePrestigeEvent()`. |
| Wine feature manifestation | `wine_feature` | `null` for company level, vineyard id for vineyard level | Feature base amount scaled by batch size, taste quality, and current company/vineyard prestige; clamped by feature `maxImpact`. Current caps range from `-10` to `+12`. | Config-driven; see feature table. | `handleManifestation()` in `src/lib/services/wine/features/featureService.ts` calls `addFeaturePrestigeEvent()`. |
| Sale of wine with a prestige-aware feature | `wine_feature` | `null` for company level, vineyard id for vineyard level | Company rows are dynamic: feature base amount scaled by sale value, volume, and current company prestige, then clamped by company `maxImpact`. Vineyard rows currently write the configured vineyard `baseAmount` only; sale value, volume, vineyard prestige, and vineyard `maxImpact` are not applied in the current helper. | Config-driven; see feature table. | `fulfillWineOrder()` detects present features and calls `addFeaturePrestigeEvent(..., 'sale')`. |
| Planting completion | `vineyard_achievement` | Vineyard id | `baseVineyardPrestige * 0.1`. Because base vineyard prestige is permanent age plus land prestige, size is dynamic and currently uncapped. | `0.90`: half-life 6.6 weeks; 0-ish after 0.8 years. | `completePlanting()` in `src/lib/services/vineyard/vineyardService.ts` calls `addVineyardAchievementPrestigeEvent('planting', ...)`. The helper supports `aging`, `improvement`, and `harvest`, but no current code path calls those variants. |
| Achievement unlock, company | `achievement` | `null` | Tiered one-off: `+0.1`, `+5`, `+50`, `+350`, or `+1000`. | Tier half-life formula; see achievement table. | `spawnAchievementPrestigeEvents()` in `src/lib/services/user/achievementService.ts`. |
| Achievement unlock, qualifying vineyard | `vineyard_achievement` | Vineyard id | Company tier amount divided by `100`: `+0.001`, `+0.05`, `+0.5`, `+3.5`, or `+10`. | Tier half-life formula accelerated by vineyard multiplier; see achievement table. | Same achievement service path; emitted only for achievement sets created with `includeVineyard`. |
| Research completion reward | `achievement` | `research_<projectId>` | `clamp((complexity * 2) - 2, 1, 15)`. Current configured projects mostly yield `+2` to `+15`. | `0.98`: half-life 34.3 weeks; 0-ish after 4.4 years. | `researchManager.ts` calls `addResearchPrestigeEvent()` when a completed project has a positive prestige reward. Starting research unlocks do not create prestige events. |
| Incomplete bookkeeping spillover | `penalty` | `bookkeeping_penalty` | `-(currentPrestige * 0.1 * incompleteBookkeepingTaskCount)`. Dynamic percentage penalty; scales with current prestige and number of missed bookkeeping tasks. | `0.90`: half-life 6.6 weeks; 0-ish after 0.8 years. | `bookkeepingManager.ts` calls `insertPrestigeEvent()` through `applyPrestigePenalty()`. |
| Emergency quick loan | `company_finance` | `null` | `-15`. | `0.99735`: half-life 5.0 years; 0-ish after 33.4 years. | `loanService.ts` in `src/lib/features/loanLender/services/finance/`. |
| Forced loan restructure | `company_finance` | `null` | `-35`. | `0.998667`: half-life 10.0 years; 0-ish after 66.4 years. | `loanService.ts`. |
| Loan missed payment warning #2 | `company_finance` | `null` | `-25`. | `0.998667`: half-life 10.0 years; 0-ish after 66.4 years. | `loanService.ts`. |
| Loan default | `company_finance` | `null` | `-75`. | `0.999334`: half-life 20.0 years; 0-ish after 132.9 years. | `loanService.ts`. |

## Wine Feature Prestige Configs

All feature prestige events are written as `wine_feature`. Company-level rows use `source_id = null`; vineyard-level rows use the vineyard id. Amounts are dynamic and are clamped by `maxImpact`.

Feature sale prestige is triggered by `feature.isPresent`; the current sale prestige formulas do not directly multiply by feature `severity`. Severity can still influence sale value indirectly through quality, price, and customer effects.

| Feature | Trigger | Level | Base amount | Final size range | Decay interpretation | Source config |
|---|---|---|---:|---:|---|---|
| Oxidation | Manifestation | Company | `-0.05` | `0` to `-5.0` | `0.995`: half-life 2.7 years; 0-ish after 17.7 years. | `src/lib/constants/wineFeatures/oxidation.ts` |
| Oxidation | Manifestation | Vineyard | `-0.5` | `0` to `-10.0` | `0.98`: half-life 0.66 years; 0-ish after 4.4 years. | `oxidation.ts` |
| Oxidation | Sale | Company | `-0.1` | `0` to `-10.0` | `0.995`: half-life 2.7 years; 0-ish after 17.7 years. | `oxidation.ts` |
| Oxidation | Sale | Vineyard | `-0.2` | Current write is fixed `-0.2` | `0.98`: half-life 0.66 years; 0-ish after 4.4 years. | `oxidation.ts` |
| Green flavor | Manifestation | Company | `-0.02` | `0` to `-3.0` | `0.995`: half-life 2.7 years; 0-ish after 17.7 years. | `src/lib/constants/wineFeatures/greenFlavor.ts` |
| Green flavor | Manifestation | Vineyard | `-0.3` | `0` to `-8.0` | `0.98`: half-life 0.66 years; 0-ish after 4.4 years. | `greenFlavor.ts` |
| Green flavor | Sale | Company | `-0.05` | `0` to `-8.0` | `0.995`: half-life 2.7 years; 0-ish after 17.7 years. | `greenFlavor.ts` |
| Green flavor | Sale | Vineyard | `-0.1` | Current write is fixed `-0.1` | `0.98`: half-life 0.66 years; 0-ish after 4.4 years. | `greenFlavor.ts` |
| Stuck fermentation | Manifestation | Company | `-0.08` | `0` to `-4.0` | `0.995`: half-life 2.7 years; 0-ish after 17.7 years. | `src/lib/constants/wineFeatures/stuckFermentation.ts` |
| Stuck fermentation | Manifestation | Vineyard | `-0.4` | `0` to `-9.0` | `0.98`: half-life 0.66 years; 0-ish after 4.4 years. | `stuckFermentation.ts` |
| Stuck fermentation | Sale | Company | `-0.08` | `0` to `-9.0` | `0.995`: half-life 2.7 years; 0-ish after 17.7 years. | `stuckFermentation.ts` |
| Stuck fermentation | Sale | Vineyard | `-0.15` | Current write is fixed `-0.15` | `0.98`: half-life 0.66 years; 0-ish after 4.4 years. | `stuckFermentation.ts` |
| Terroir | Sale | Company | `0.05` | `0` to `+8.0` | `0.998`: half-life 6.7 years; 0-ish after 44.2 years. | `src/lib/constants/wineFeatures/terroir.ts` |
| Terroir | Sale | Vineyard | `0.08` | Current write is fixed `+0.08` | `0.995`: half-life 2.7 years; 0-ish after 17.7 years. | `terroir.ts` |
| Bottle aging | Sale | Company | `0.05` | `0` to `+15.0` | `0.998`: half-life 6.7 years; 0-ish after 44.2 years. | `src/lib/constants/wineFeatures/bottleAging.ts` |

Active feature configs without prestige effects currently include Noble Rot and Grey Rot. `lateHarvest.ts` exists but is not in the active feature registry in `commonFeaturesUtil.ts`.

## Achievement Prestige Pattern

Tiered achievements are generated by `createTieredAchievements()` in `src/lib/services/user/achievementService.ts`.

| Tier | Company amount | Company half-life | Company 0-ish level | Vineyard amount |
|---|---:|---:|---:|---:|
| 1 | `+0.1` | 1 year | 6.6 years | `+0.001` |
| 2 | `+5` | 5 years | 33.2 years | `+0.05` |
| 3 | `+50` | 25 years | 166.1 years | `+0.5` |
| 4 | `+350` | 75 years | 498.3 years | `+3.5` |
| 5 | `+1000` | 100 years | 664.4 years | `+10` |

Vineyard achievement rows, where enabled, use `company amount / 100` and a shorter half-life controlled by the achievement set's `vineyardDecayMultiplier`.

| Vineyard achievement group | Multiplier | Vineyard half-life range | Vineyard 0-ish range |
|---|---:|---:|---:|
| Vineyard time and vineyard prestige achievements | `0.3` | 0.3 to 30 years | 2.0 to 199.3 years |
| Vineyard wine variety, bottle production, and sales count achievements | `0.4` | 0.4 to 40 years | 2.7 to 265.8 years |

## Research Prestige Pattern

Research completion creates prestige only for projects with `prestigeReward > 0`. The shared reward formula in `src/lib/constants/researchConstants.ts` is:

```text
prestigeReward = clamp((complexity * 2) - 2, 1, 15)
```

The event decays at `0.98` weekly retention. Research unlocks and `permanentEffects` are separate progression systems and should not be counted as prestige event creators unless they also call `addResearchPrestigeEvent()`.

| Complexity | Prestige reward |
|---:|---:|
| 1 | `+1` |
| 2 | `+2` |
| 3 | `+4` |
| 4 | `+6` |
| 5 | `+8` |
| 6 | `+10` |
| 7 | `+12` |
| 8 | `+14` |
| 9+ | `+15` |

## Current Scale Observations

| Observation | Balance implication |
|---|---|
| Prestige events no longer follow a 0 to 1 scale. | The ledger now mixes sub-1 vineyard achievement rows, ordinary `+1` to `+15` events, loan penalties up to `-75`, and achievement rewards up to `+1000`. |
| Achievement tiers dominate the positive scale. | Tier 4 and 5 achievements are both very large and extremely long-lived, so they can overwhelm sales, research, and feature events. |
| Loan penalties are not just temporary setbacks. | The amounts are medium-to-large and their 0-ish levels are 33 to 133 years, making them long-term reputation scars. |
| Sales are short-lived but can stack. | Company sales cap at `+10`, but vineyard sales have no hard cap and scale with current vineyard prestige. Multiple sales can accumulate before the 1.7-year 0-ish point. |
| Feature events are capped but can last longer than research. | Company-level feature rows at `0.995` can remain visible for 17.7 years to 1 percent; positive feature rows at `0.998` last 44.2 years to 1 percent. |
| Permanent rows are formula-scale risks. | Company value, vineyard base prestige, and cellar collection do not decay, so formula tuning matters more than event lifetime tuning. |

## Expected Impact Overview

This section estimates practical balance impact by combining amount, trigger frequency, stackability, and game phase. It is intentionally not a precise simulation; it is a map of where prestige pressure is likely to come from.

| Source family | Likely practical impact | Frequency and phase | Stackability | Existing-prestige scaling | Balance read |
|---|---|---|---|---|---|
| Starting-condition story | Low early baseline: `+1` to `+5`. | Once at game start for configured countries. | Does not stack except with other starting sources. | No. | Flavorful opening reputation, not a major long-term balance driver despite long decay. |
| Company net worth | Low-to-medium but permanent; grows logarithmically with company value. | Always present after initialization and recalculation. | Single company row, not transaction-stacking. | Indirectly scales with assets, not prestige. | Stable background reputation. It should not dominate unless company values become extreme. |
| Vineyard age and land base | Medium permanent floor per vineyard; size depends on site, age, suitability, hectares, and density. | Created per vineyard and refreshed on relevant vineyard changes. | Stacks across owned vineyards and feeds vineyard sale scaling. | Indirectly self-amplifies because regular vineyard sales use base vineyard prestige as a multiplier. | Important because it is both permanent and a multiplier input for later sale prestige. |
| Aged cellar collection | Low-to-medium permanent collection signal with strong diminishing returns. | Weekly recalculated after aged non-oxidized bottled inventory exists. | Aggregates across qualifying bottles and vintages into one row. | No. | More of a prestige floor for patient cellar strategy than a spike source. |
| Regular vineyard wine sales | Medium-to-high recurring source; formula has no hard cap. | Every fulfilled wine order tied to a vineyard. | Stacks per sale and across vineyards; decays to 0-ish after 1.7 years. | Yes, through base vineyard prestige multiplier. | Main repeatable positive prestige loop. High-prestige vineyards can generate large sale rows even before feature prestige is counted. |
| Company sale fallback and contracts | Medium recurring source capped at `+10` per event. | Contracts and sales without vineyard id. | Stacks per fulfilled contract/order. | No; scales with sale value, volume, and company assets. | Strong but bounded transaction prestige. Less risky than vineyard sales because of the cap. |
| Terroir feature sales | Common positive feature source. Terroir is spawned active on new batches and can trigger sale prestige whenever present wine is sold. | Potentially every sale from normal vineyard wine. | Stacks with regular sale prestige and with repeated sales; company rows are dynamic and long-lived, vineyard rows are currently fixed `+0.08`. | Company row yes; vineyard sale row no in current implementation. | Likely the most common positive feature prestige. Company-side long decay means it can accumulate even if individual rows are capped. |
| Bottle-aging feature sales | Potentially high positive source; company cap `+15`. | Bottled wines become bottle-aging-present after feature processing. Larger impact is expected from aged, high-value bottles, but the prestige formula does not directly use bottle-aging severity. | Stacks per sale of bottled wine where the feature is present. | Company row yes. | Powerful patient-cellar signal through sale value, but currently also capable of rewarding low-severity bottle-aging sales once the feature is present. |
| Oxidation | High negative when it happens; strongest fault caps among active negative features. | Accumulates from harvest/weekly processing and is worsened by fragile grapes, oxygen exposure, and some process choices. | Manifestation event happens once per batch; sale penalty can repeat for every sale of affected wine. Company and vineyard rows can both be written. | Manifestation rows yes; company sale row yes; vineyard sale row currently no. | Correctly severe as a brand-damage event. Biggest danger is repeated sales of the same flawed batch creating multiple penalties. |
| Green flavor | Medium negative; usually player-avoidable through harvest timing and crushing choices. | Triggered by underripe harvest and crushing decisions. | Manifestation once; sale penalty repeats on affected wine sales. | Manifestation rows yes; company sale row yes; vineyard sale row currently no. | Good candidate for a softer but common learning penalty. Since it can repeat on sale, the sale route may matter more than the initial manifestation. |
| Stuck fermentation | Medium-to-high negative; lower frequency but serious technical failure. | Triggered by fermentation method/temperature risk, especially risky red/cool/extended setups. | Manifestation once; sale penalty repeats on affected wine sales. | Manifestation rows yes; company sale row yes; vineyard sale row currently no. | Less common than green flavor, but should feel more serious when it occurs. |
| Research rewards | Medium one-off progression source: usually `+2` to `+15`. | On research completion for projects with prestige rewards. | Stacks across completed projects, but each project is one-off. | No. | Predictable mid-game prestige income. It is unlikely to dominate achievement tiers but can outsize individual sales/features early. |
| Achievement unlocks | Very high at upper tiers: `+50`, `+350`, `+1000`. | One-off per tier per achievement family; low tiers can arrive early, high tiers are late-game. | Many achievement families can unlock over time, and chained tier unlocks can produce bursts. | No. | Dominant long-term positive prestige source. Tier 4/5 rewards are more like historical legacy than normal events. |
| Vineyard achievement unlocks | Low-to-medium per row: `+0.001` to `+10`, shorter than company achievement lifetime. | Only achievement families with `includeVineyard`. | Stacks per qualifying vineyard and achievement tier. | No. | Usually secondary compared with company achievements, but can matter if many vineyards qualify. |
| Planting completion | Usually low-to-medium and short-lived. | On final planting completion. | Stacks by vineyard/planting event. | Indirectly yes because amount is `baseVineyardPrestige * 0.1`. | Mostly a short celebratory boost unless base vineyard prestige is already high. |
| Bookkeeping spillover | Potentially high negative percentage hit. | When bookkeeping tasks remain incomplete. | Repeated misses can stack. | Yes; amount is `currentPrestige * 0.1 * incompleteTaskCount`. | This already implements the "famous house is punished harder" design pattern, but fades quickly. |
| Loan penalties | Medium-to-large fixed negative scars: `-15` to `-75`. | Only on emergency borrowing, restructure, missed payment warning #2, and default. | Stacks with multiple loan events. | No. | Long-lived brand damage. If late-game companies should suffer proportionally more, this is the clearest fixed-amount candidate for prestige scaling. |

## Existing Prestige Scaling Audit

| Scaling pattern | Current sources | Notes |
|---|---|---|
| Already scales harder with current reputation | Feature manifestation company rows, feature manifestation vineyard rows, company feature sale rows, bookkeeping spillover. | This already matches the "small winery mistake vs famous Champagne scandal" idea for several wine-quality and operations events. |
| Indirectly scales with reputation-like state | Regular vineyard sales and planting completion. | These use base vineyard prestige rather than total current prestige; this rewards prestigious sites but does not react to company fame directly. |
| Scales with wealth or transaction size instead | Company sale fallback and contract sales. | These are capped at `+10` and use assets, sale value, and volume, not current prestige. |
| Fixed-size regardless of fame | Starting story, research rewards, achievement rewards, vineyard achievement rewards, loan penalties. | Fixed-size rewards are easiest to reason about, but fixed penalties can become too soft in late game. |
| Config suggests dynamic but current write is fixed | Vineyard feature sale rows. | In `addFeaturePrestigeEvent()`, vineyard sale dynamic calculation returns `levelConfig.baseAmount`; sale value, volume, vineyard prestige, and `maxImpact` are not applied for these rows. |
| Feature severity is not a direct prestige multiplier on sale | Company and vineyard feature sale rows. | Sale prestige checks whether the feature is present, then uses sale value, volume, reputation, or fixed base amount. Severity only affects prestige indirectly if it changes quality, price, or sale value first. |

## Balancing Hypotheses

| Hypothesis | Why it matters | First tuning lever to consider |
|---|---|---|
| Decay is broadly serving the intended brand-memory role. | Bad events and major reputation events linger, which matches the design goal. | Keep decay mostly stable unless a source is explicitly meant to be seasonal noise. |
| Frequency and stackability are now more important than raw event caps. | Terroir, regular sales, and flawed-wine sale penalties can repeat, while research and achievements are one-off. | Audit high-frequency sources before changing rare event sizes. |
| Fixed loan penalties may under-punish famous late-game companies. | `-75` is severe early, but much less meaningful against tier-4/tier-5 achievement prestige. | Add a current-prestige multiplier or percentage component to loan/default penalties if late-game scandal severity is desired. |
| Achievement tier rewards define the prestige endgame. | `+350` and `+1000` with multi-century 0-ish levels dwarf most normal gameplay events. | Decide whether achievement prestige is meant to be legacy score or active market reputation. |
| Vineyard sale prestige is the largest uncapped repeatable positive loop. | It scales from sale value and base vineyard prestige, and repeats every vineyard-linked order. | Consider a soft cap, diminishing return, or current-year/event-frequency dampener if runaway sale prestige appears. |
| Vineyard feature sale prestige may be unintentionally too small. | Configs carry vineyard sale scaling and caps, but the current helper writes fixed base amounts. | Either document this as intentional vineyard-local noise, or implement the intended dynamic vineyard sale calculation. |
| Feature sale prestige may be too binary. | A 1 percent-present feature and a 100 percent-present feature both qualify for sale prestige; severity only affects prestige indirectly through price/quality. | Consider multiplying feature sale prestige by severity if feature maturity/fault severity should matter directly. |

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
| Company value formula | `calculateCompanyValuePrestige()` is the shared formula for company net-worth prestige. `initializeBasePrestigeEvents()`, `updateCompanyValuePrestige()`, and `usePrestigeUpdates()` now use the same `log(companyValue / maxLandValue + 1)` calculation. |
| Company-level `wine_feature` aggregation | `calculateCurrentPrestige()` now treats `wine_feature` rows with `source_id = null` or payload level `company` as company prestige; vineyard-level feature rows remain vineyard prestige. |
| Vineyard age refresh | `updateVineyardAges()` now refreshes base vineyard prestige after a planted vineyard's age advances. |
| Event type cleanup | `admin_cheat` is declared in `PrestigeEventType`; stale `contract`, `vineyard_base`, and `vineyard_region` type/breakdown references have been removed from active prestige typing and classification. |
