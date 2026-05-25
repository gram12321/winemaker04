# Prestige Balance Recommendations
Date: 2026-05-24
Status: Implemented balance pass, retained as design record

This document turns the prestige event inventory into actionable balance recommendations and records the implemented balance changes. It defines targets, before/after expectations, decay expectations, and implementation levers.

## Recommendation Summary

| Decision | Recommendation |
|---|---|
| Decay | Keep most current decay rates. Long brand memory is intentional and generally working. Tune event amount and stackability before changing decay. |
| Positive repeatable events | Add caps or soft caps. Repeatable sales and feature-sale events can outweigh larger one-off rewards over time. |
| Negative scandal events | Add bounded current-prestige scaling where the event represents public brand damage. Famous companies should take larger hits, but caps should prevent unrecoverable spirals. |
| Identity rows | Do not scale permanent company/vineyard/cellar rows by current prestige. They represent state, not public scandal. |
| Progression rewards | Do not scale research or achievements by current prestige. That would compound runaway. |
| Feature sales | Make sale prestige severity-aware. A barely-present positive feature should not grant the same prestige as a fully developed feature. |
| Achievements | Active achievement prestige is reduced now; a legacy-vs-market prestige split remains a possible future architecture. |

## Implemented Changes

| Area | Implemented behavior |
|---|---|
| Regular vineyard sales | Direct vineyard-prestige multiplication is replaced by log value/volume scaling, normalized vineyard prestige, and a `+15` soft cap. |
| Feature sales | Sale prestige uses direct feature severity: positive rows use `severity ^ 1.25`; fault rows use `0.4 + 0.6 * severity`. |
| Vineyard feature sales | Vineyard sale rows now use the same dynamic sale formula path as company rows, with vineyard prestige and configured caps. |
| Partial orders and contracts | Feature sale prestige uses actual fulfilled value/quantity. Contract fulfillment now emits feature-on-sale prestige when sold batches have present prestige-aware features. |
| Loan penalties | Emergency quick loan, missed-payment warning #2, forced restructure, and default penalties add bounded current-prestige components. |
| Achievements | Active tier values are now `+0.1`, `+3`, `+20`, `+100`, `+300`. |
| Planting completion | Planting celebration prestige is soft-capped around `+2`; other vineyard achievement event types retain the previous `baseVineyardPrestige * 0.1` formula. |

## Shared Recommendation Vocabulary

Use these terms consistently when implementing later.

| Term | Proposed meaning |
|---|---|
| Current prestige tiers | Early `1-10`, mid `100`, late `1000+`, legendary `5000+`. |
| Soft cap | `sign(amount) * cap * (1 - exp(-abs(amount) / cap))`. Keeps growth visible while preventing extreme spikes. |
| Brand exposure scaling | Bounded multiplier or percentage component used only for scandals and quality failures. It should grow with current prestige but never be unbounded. |
| Severity scaling | Feature sale prestige should multiply by feature severity or a severity curve. Positive features can use a stricter curve; faults can keep a floor because even mild public faults can hurt. |
| 0-ish | 1 percent of original amount remaining. Actual database deletion still depends on `abs(amount_base) < 0.001`. |

Suggested severity curves:

| Feature class | Suggested curve | Reason |
|---|---|---|
| Positive feature sale prestige | `severity ^ 1.25` | Low-severity terroir or bottle aging should produce little reputation benefit. Mature expression still matters. |
| Fault feature sale prestige | `0.4 + 0.6 * severity` | Any sold fault can damage trust, but severe faults should hurt more. |
| Manifestation prestige | Keep current quality/batch/prestige formula first. Severity is less relevant at manifestation because manifestation is already the public discovery event. |

Reference examples below use these rough scenarios:

| Scenario | Current prestige | Sale value | Sale volume | Base vineyard prestige | Feature severity |
|---|---:|---:|---:|---:|---:|
| Early | `10` | `EUR 2k` | `100` bottles | `0.5` | `0.25` |
| Mid | `100` | `EUR 25k` | `1k` bottles | `5` | `0.60` |
| Late | `1000` | `EUR 250k` | `10k` bottles | `50` | `1.00` |

The examples are directional, not simulator output.

## Event Recommendations

### Permanent And Recalculated Rows

| Event family | Current impact and decay | Recommendation | Before to after expectation | Explanation and lever |
|---|---|---|---|---|
| Company net worth | `ln(companyValue / maxLandValue + 1)`, permanent `decay_rate = 0`. Example: 1x benchmark = `+0.69`, 100x = `+4.62`, 1000x = `+6.91`. | Keep as-is. Do not scale by current prestige. | No change. Early low background floor; late still single-digit unless company value is extreme. | This is an identity/state row, not a public event. Lever: `calculateCompanyValuePrestige()` in `src/lib/services/prestige/prestigeService.ts`. |
| Vineyard vine age | Permanent upsert from vine age, suitability, and density modifier. Dynamic and uncapped at writer level. | Keep as-is for now. Add a soft cap only if real saves show old-vine prestige dominating. | No immediate change. Early young vines remain low; old high-suitability vines remain a meaningful vineyard identity source. | Age prestige should be stable site identity. Current-prestige scaling would create feedback. Lever: `computeVineyardPrestigeFactors()` in `prestigeService.ts`. |
| Vineyard land value | Permanent upsert from land value per hectare, suitability, hectares, and density. | Keep as-is for now. Monitor large-hectare sites because `sqrt(hectares)` can still make big estates matter. | No immediate change. Good land remains a base prestige source and sale multiplier input. | This is acceptable as a static site signal. If tuned later, soft-cap `landScaled` rather than adding decay. Lever: `computeVineyardPrestigeFactors()`. |
| Aged cellar collection | Permanent weekly recalculation using aged non-oxidized inventory with strong diminishing returns. | Keep as-is. | No change. Early none; mid small floor; late patient-cellar identity. | Formula already has nested diminishing returns and excludes oxidized wine. Lever: `updateCellarCollectionPrestige()` in `prestigeService.ts`. |
| Admin prestige grant | Manual permanent amount. | Keep outside normal balance. | No change. | Admin-only tool should remain arbitrary but visible in audit. Lever: `adminAddPrestigeToCompany()` in `src/lib/services/admin/adminService.ts`. |

### Starting And Progression Rewards

| Event family | Current impact and decay | Recommendation | Before to after expectation | Explanation and lever |
|---|---|---|---|---|
| Starting-condition story | France `+5`, Italy `+2`, Germany `+1`, Spain/US none. `0.999` decay: 13.3-year half-life, 88.5 years to 0-ish. | Keep current values. Optional future parity: Spain/US `+0.5` to `+1` only if starts feel too flat. | No balance change. Early flavor boost; mid/late residue. | Starting prestige is authored flavor. Do not scale by current prestige and do not grant prestige for pre-unlocked starting research. Lever: `startingConditions.ts` and `startingConditionsService.ts`. |
| Research completion | `clamp((complexity * 2) - 2, 1, 15)`, `0.98` decay: 0.66-year half-life, 4.4 years to 0-ish. | Keep fixed. Do not add fame scaling. | No change. Early `+1` to `+6` matters; mid `+8` to `+15` is useful; late minor beside achievements. | Research should reward difficulty and unlock utility, not snowball existing fame. Lever: `researchConstants.ts`, `researchManager.ts`, `addResearchPrestigeEvent()`. |
| Company achievements | Previous tiers: `+0.1`, `+5`, `+50`, `+350`, `+1000`; half-lives 1, 5, 25, 75, 100 years. | Implemented fallback reduction: active tiers are now `+0.1`, `+3`, `+20`, `+100`, `+300`. | Tier 5 no longer defines the economy alone. Achievements remain long-lived milestones but no longer dwarf sales, research, and scandals as severely. | A future split between legacy prestige and market-active prestige is still cleaner architecture, but reduced active values are the pragmatic balance step. Lever: `achievementLevels` in `src/lib/constants/achievementConstants.ts`. |
| Vineyard achievements | Company tier amount divided by `100`: `+0.001`, `+0.05`, `+0.5`, `+3.5`, `+10`, with faster vineyard half-life. | Keep values. If many vineyards duplicate rewards too easily, tighten qualifying-vineyard selection rather than increasing decay. | No immediate change. Early tiny; mid local identity; late can stack across estate but stays secondary. | Vineyard achievements already use smaller amounts and faster decay. Do not add current-prestige scaling. Lever: `createTieredAchievements()` and `includeVineyard` achievement sets. |

### Sales And Contract Events

| Event family | Current impact and decay | Recommendation | Before to after expectation | Explanation and lever |
|---|---|---|---|---|
| Regular vineyard wine sales | Previously `(saleValue / 10000) * max(0.1, baseVineyardPrestige)`, no cap. | Implemented: log value/volume plus normalized vineyard-prestige multiplier and a `+15` soft cap. Decay remains `0.95`: 0.26-year half-life, 1.7 years to 0-ish. | Example before: early `+0.10`, mid `+12.5`, late `+1250`. After: early stays small, mid is bounded, late approaches `+15`. | This was the largest uncapped repeatable positive loop. Lever: `calculateVineyardSalePrestige()` in `src/lib/services/prestige/prestigeCalculator.ts`. |
| Company sale fallback | Company-level `sale`; uses `saleValue / 10000`, log value/volume, cash-based assets factor, capped at `+10`, `0.95` decay. | Keep cap and decay. Rename or fix `companyAssets` because it currently uses cash, not total company value. | No main balance change. Small sales remain low; mid/late can hit `+10` cap. | This source is already bounded. The issue is naming/input accuracy more than balance. Lever: `addSalePrestigeEvent()` in `prestigeService.ts`. |
| Contract fulfillment | Uses company sale formula, capped at `+10`, `0.95` decay. | Implemented: base contract sale prestige stays unchanged, and contract fulfillment emits feature-on-sale prestige when sold batches have present prestige-aware features. | Selling flawed/terroir/aged wine through contracts now has the same reputation consequences as orders. | Contracts no longer bypass feature reputation. Lever: `fulfillContract()` in `src/lib/services/sales/contractService.ts`. |
| Partial order feature sale values | Regular sale prestige uses actual fulfillable value/quantity. | Implemented: feature prestige also uses actual fulfilled value and quantity. | Partial fulfillment no longer overstates feature prestige. Example: fulfilling 25 percent of an order creates about 25 percent of the feature sale exposure before log effects. | This is consistency, not a decay change. Lever: `fulfillWineOrder()` in `salesService.ts` and `addFeaturePrestigeEvent()`. |

### Wine Feature Events

| Event family | Current impact and decay | Recommendation | Before to after expectation | Explanation and lever |
|---|---|---|---|---|
| Feature manifestation, company | Config says dynamic by batch size, quality, and company prestige. Current manifestation caller does not pass current company prestige, so company manifestation defaults to prestige `1`. Decay usually `0.995`. | Pass current company prestige into manifestation context. Keep caps and decay. | Before: a famous company can receive a company manifestation hit similar to a small company. After: early remains small, mid grows visibly, late can approach configured cap for major public failures. | This aligns with the "major Champagne brand scandal" design without changing decay. Lever: `handleManifestation()` in `featureService.ts` and `addFeaturePrestigeEvent()`. |
| Feature manifestation, vineyard | Dynamic by batch size, quality, and vineyard prestige; decays at `0.98` for negative vineyard features. | Keep current formula and decay. Verify weight naming so future config tuning works. | No major change. High-prestige vineyards already take larger manifestation hits, capped by feature. | Current behavior matches intent. The config uses `prestigeWeight`, while calculators expect `companyPrestigeWeight` or `vineyardPrestigeWeight`; current defaults hide this. Lever: wine feature constants and `prestigeCalculator.ts`. |
| Positive feature sale, company: terroir | Dynamic and capped `+8`, `0.998` decay: 6.7-year half-life, 44.2 years to 0-ish. Previously triggered by `isPresent`, not severity. | Implemented: multiply by `severity ^ 1.25`. Keep cap and decay. | Before: low-severity terroir could grant full sale prestige. After: severity `0.25` gives about 18 percent, severity `0.60` about 53 percent, severity `1.0` full effect. | Terroir is common and repeatable, so maturity should matter. Lever: `addFeaturePrestigeEvent()` and `calculateFeatureSalePrestigeWithReputation()`. |
| Positive feature sale, vineyard: terroir | Config says dynamic/capped `+12`; previous write was fixed `+0.08`, `0.995` decay. | Implemented: vineyard dynamic sale formula uses sale value, volume, vineyard prestige, severity curve, and configured cap. | Before: always `+0.08`. After: early small, mid visible, late meaningful but capped by config. | This fixes a config/code mismatch and makes terroir vineyard reputation real without making it runaway. Lever: `addFeaturePrestigeEvent()` vineyard sale branch. |
| Positive feature sale, company: bottle aging | Dynamic and capped `+15`, `0.998` decay. Previously triggered by `isPresent`, not severity. | Implemented: multiply by `severity ^ 1.25`. | Before: newly bottled/low-severity bottle aging could qualify. After: meaningful reputation comes from actually aged wine. Mature high-value sales still matter. | Bottle aging now rewards patience more directly. Lever: bottle-aging feature sale path in `addFeaturePrestigeEvent()`. |
| Fault feature sale, company: oxidation | Dynamic and capped `-10`, `0.995` decay. Previously triggered by `isPresent`, not severity. | Implemented: multiply by `0.4 + 0.6 * severity`; keep cap and decay. | Before: mild and severe oxidation could create the same formula exposure. After: mild still hurts, severe can approach full penalty. | Selling flawed wine is public brand damage; severity should matter but not reduce mild faults to zero. Lever: feature sale calculation. |
| Fault feature sale, vineyard: oxidation | Config says dynamic/capped `-8`; previous write was fixed `-0.2`, `0.98` decay. | Implemented: vineyard dynamic sale formula uses sale value, volume, vineyard prestige, fault severity, and configured cap. | Before: always `-0.2`. After: mild/common cases stay smaller; severe high-volume sale can become meaningful and approach cap. | Fixed vineyard scandals were too small for famous vineyards. Lever: `addFeaturePrestigeEvent()` vineyard sale branch. |
| Fault feature sale: green flavor | Company dynamic cap `-8`; vineyard previous write was fixed `-0.1`; decays `0.995` company and `0.98` vineyard. | Implemented: same severity-aware dynamic pattern. | Before: vineyard sale was always `-0.1`. After: mild/common learning mistakes stay smaller; severe high-volume sale can become meaningful. | Green flavor remains softer than oxidation but no longer invisible when sold repeatedly. Lever: `greenFlavor.ts` config plus feature sale calculation. |
| Fault feature sale: stuck fermentation | Company dynamic cap `-9`; vineyard previous write was fixed `-0.15`; decays `0.995` company and `0.98` vineyard. | Implemented: same severity-aware dynamic pattern. | Before: vineyard sale was always `-0.15`. After: rare serious technical failures hurt more when publicly sold. | Stuck fermentation is rarer and more serious than green flavor. Lever: `stuckFermentation.ts` config plus feature sale calculation. |
| Feature sale in contracts | Contract fulfillment previously did not emit feature-on-sale prestige. | Implemented: apply the same feature sale logic to contracts when wine batch context exists. | Flawed contract sales can hurt and premium feature contract sales can help. | Reputation no longer depends on sales channel. Lever: `contractService.ts`. |

### Vineyard Events

| Event family | Current impact and decay | Recommendation | Before to after expectation | Explanation and lever |
|---|---|---|---|---|
| Planting completion | Previous formula `baseVineyardPrestige * 0.1`, uncapped. | Implemented: planting uses a soft cap around `+2`; decay remains `0.90`: 6.6-week half-life, 0.8 years to 0-ish. | Example base prestige `0.5`: `+0.05 -> +0.05`; base `5`: `+0.5 -> +0.44`; base `50`: `+5 -> about +1.84`. | Planting should feel good, but a premium-site planting should not become a large exploit. Lever: `addVineyardAchievementPrestigeEvent()` in `prestigeService.ts`. |

### Operational And Finance Penalties

| Event family | Current impact and decay | Recommendation | Before to after expectation | Explanation and lever |
|---|---|---|---|---|
| Bookkeeping spillover | `-(currentPrestige * 0.1 * incompleteTaskCount)`, `0.90` decay. | Keep percentage model. Add a cycle cap only if testing shows unrecoverable spirals, for example max `25 percent` of current prestige per bookkeeping cycle. | One missed task: current and after remain `-10 percent`. Three missed tasks: current `-30 percent`; with cap, after max `-25 percent`. | This already implements fame-scaled operational embarrassment and decays quickly after cleanup. Lever: `calculateBookkeepingSpillover()` and `applyPrestigePenalty()`. |
| Emergency quick loan | Fixed `-15`, `0.99735` decay: 5-year half-life, 33.4 years to 0-ish. | Add bounded fame component: `-15 - min(10, currentPrestige * 0.01)`. | Prestige `10`: `-15 -> -15.1`; prestige `100`: `-15 -> -16`; prestige `1000+`: `-15 -> -25`. | Emergency borrowing should be embarrassing but not devastating. Lever: `EMERGENCY_QUICK_LOAN` and loan service insertion. |
| Missed payment warning #2 | Fixed `-25`, `0.998667` decay: 10-year half-life, 66.4 years to 0-ish. | Add bounded fame component: `-25 - min(25, currentPrestige * 0.02)`. | Prestige `10`: `-25 -> -25.2`; prestige `100`: `-25 -> -27`; prestige `1000+`: `-25 -> -50`. | A famous house missing payments should matter more than a small house's administrative slip. Lever: `LOAN_MISSED_PAYMENT_PENALTIES.WARNING_2`. |
| Forced loan restructure | Fixed `-35`, `0.998667` decay. | Add bounded fame component: `-35 - min(75, currentPrestige * 0.04)`. | Prestige `10`: `-35 -> -35.4`; prestige `100`: `-35 -> -39`; prestige `1000+`: `-35 -> -110`. | Public forced restructure is a major brand event, especially late game. Lever: `EMERGENCY_RESTRUCTURE`. |
| Loan default | Fixed `-75`, `0.999334` decay: 20-year half-life, 132.9 years to 0-ish. | Add bounded fame component: `-75 - min(175, currentPrestige * 0.08)`. | Prestige `10`: `-75 -> -75.8`; prestige `100`: `-75 -> -83`; prestige `1000`: `-75 -> -155`; legendary `5000+`: cap at `-250`. | Default is the clearest "famous brand scandal" source. It should still matter against tier 4 and tier 5 prestige without becoming infinite. Lever: `LOAN_DEFAULT`. |

## Implementation Priority Record

| Priority | Change | Why first |
|---:|---|---|
| 1 | Add soft cap to regular vineyard sale prestige. | Implemented. It was the largest uncapped repeatable positive loop. |
| 2 | Make feature sale prestige severity-aware. | Implemented. Fixes binary low-severity prestige and affects both positive and negative feature sales. |
| 3 | Implement dynamic vineyard feature sale rows. | Implemented. Config and code now agree. |
| 4 | Add feature-on-sale prestige for contracts and use actual fulfilled values for partial orders. | Implemented. Aligns sales channels and avoids overstated feature exposure. |
| 5 | Add bounded fame component to loan penalties. | Implemented. Best match for the "famous company scandal" design. |
| 6 | Decide achievement role: legacy score vs active market reputation. | Pragmatic reduction implemented; legacy/active split remains future architecture. |
| 7 | Cap planting completion at about `+2`. | Implemented with a soft cap. |

## Open Design Decisions

| Decision | Recommended default |
|---|---|
| Should achievement prestige remain part of market-facing prestige? | Reduced active amounts now. Split legacy/active prestige later if consumers still need historical greatness separate from market reputation. |
| Should positive feature sale prestige scale with current company prestige? | Keep existing company scaling, but cap and severity-scale it. Do not add unbounded fame feedback. |
| Should fixed research rewards scale with fame? | No. Research should reflect project difficulty. |
| Should all negative events scale with fame? | No. Scale public scandals and operations failures; do not scale normal authored setup or state rows. |
| Should decay be shortened? | Not now. Current decay supports long brand memory. Tune amount, caps, and stacking first. |
