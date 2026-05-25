# Buy / Sell Grape Market â€” Symmetry Analysis
**Date:** 2026-05-24  
**Author:** AI analysis (Copilot)  
**Status:** Completed/resolved. Code-verified on 2026-05-25 and moved to `docs/superpowers/completed/`.
**Scope:** Compare `buyGrapeMarketService.ts`, `sellGrapesService.ts`, `BuyFromMarketModal.tsx`, `SellGrapesModal.tsx`, `grapeBuyerMarketService.ts`, `grapeSupplierMarketService.ts`, `grapeBuyerLoyaltyService.ts`, `grapeSupplierLoyaltyService.ts`

---

## Summary

The two systems were built incrementally (sell-side first, buy-side second) and share a common design language. Most asymmetries are **intentional** and consistent with the design. A small number of gaps are **unintentional** and should be addressed.

Legend: âœ… Intentional asymmetry | âš  Unintentional gap | âœ” Symmetric

### Implementation status update (2026-05-24)

All previously listed **Medium** and **Low/Cosmetic** gaps (G1â€“G8) have now been implemented and resolved in code, while keeping the anti-arbitrage spread/penalty untouched.

- G1 resolved: Buy-side quality now mirrors sell-side asymmetrical quality curve.
- G2 resolved: Buy-side state premiums now match sell-side values for `must_ready` and `must_fermenting`.
- G3 resolved: Shared buyer/supplier research key coupling is now explicit via shared constants.
- G4 resolved: Buy flow now enforces supplier remaining seasonal capacity at purchase time.
- G5 resolved: Buy modal now includes trust gain preview before purchase.
- G6 resolved: `SellGrapesModal` now includes `DialogDescription` for accessibility.
- G7 resolved: Buy modal uses `Ã—` for multiplier display to match sell modal.
- G8 resolved: Buyer/supplier profile label styling is now aligned.

---

## 1. Pricing Formula

### Formula structure

| Factor | Sell side | Buy side | Notes |
|---|---|---|---|
| Base price | â‚¬3.00/kg | â‚¬2.90/kg | Then +22% spread added on buy side |
| Net effective base | ~â‚¬3.00/kg sell | ~â‚¬3.54/kg buy (at flat multipliers) | Spread creates meaningful buy > sell gap âœ… |
| Quality formula | `wineScore Ã— calculateAsymmetricalMultiplier(wineScore)` | `qualityScore Ã— calculateAsymmetricalMultiplier(qualityScore)` | Aligned âœ” |
| Prestige | +bonus (up to +30%) | â€“discount (down to -30%) | Opposite direction â€” intentional âœ… |
| Relationship | Multiplier increases price | Multiplier decreases price (discount) | Opposite direction â€” intentional âœ… |
| State premium | grapes 1.0, must_ready 1.08, must_fermenting 1.15 | grapes 1.0, must_ready 1.08, must_fermenting 1.15 | Aligned âœ” |
| Market spread | `1/(1+0.22)` penalty on sell price | `Ã—(1+0.22)` markup on buy price | Mirrors correctly âœ” |
| Floor price | Per-buyer (0 for bulk, 0.80â€“1.20 for cooperative) | Global floor: â‚¬0.80/kg (`BUY_MARKET_MIN_PRICE`) | Different mechanism âœ… |
| Favorite grape bonus | Primary +18%, secondary +10% | **None** | Buy side has no concept âœ… |
| Buyer/Supplier multiplier | Per-buyer profile multiplier (priceMultiplier field) | Per-supplier base_price_multiplier | Equivalent role âœ” |
| Season / economy / year cycle | Embedded in buyer demandFactors | Embedded in offer demandFactors | Same structure âœ” |
| Volatility | Carried as demandFactors on buyer | Carried as demandFactors on offer | Same structure âœ” |

### Resolved pricing parity notes

The previous quality-curve and processed-state premium gaps are resolved. Buy-side quality now mirrors the sell-side asymmetrical quality curve, and buy-side `must_ready` / `must_fermenting` state premiums match sell-side values. The buy market still applies its fixed spread so buy prices remain above sell prices for anti-arbitrage.

---

## 2. Counterparty Pools

| Dimension | Sell side | Buy side | Notes |
|---|---|---|---|
| Bulk counterparty | `bulk_buyer` â€” 14,000 kg/season cap | `bulk_supplier` â€” 22,000 kg/season cap | Supply > demand gap intentional âœ… |
| Seasonal pool | 3â€“7 rotating buyers per season | 3â€“7 rotating suppliers per season | Symmetric count range âœ” |
| Cooperative counterparty | `winzergenossenschaft` (Germany only) | **None** | Intentional design; sell-side only âœ… |
| Offer count | ~3â€“7 buyers active simultaneously | **8â€“12 individual offers** generated from 3â€“7 suppliers | Buy side generates more simultaneous choices âœ… |
| Research keys | Shared market slot/country keys | Shared market slot/country keys | Explicit shared contract via constants âœ” |

### Shared research keys (âš  needs documentation)

`grapeSupplierMarketService` reads `grape_buyer_slots` and `grape_buyer_country_access` â€” the same research keys as the sell-side buyer market. This means one research upgrade simultaneously unlocks more seller slots AND more supplier slots. This could be intentional (one upgrade opens both sides of the market) but it is currently undocumented, and the naming (`grape_buyer_*`) doesn't clearly indicate it applies to the supply side.

**Recommendation:** Document this explicitly or rename the supply-side usage to `grape_supplier_slots` / `grape_supplier_country_access` if the intent is to keep them independent.

---

## 3. Loyalty / Relationship Systems

| Dimension | Sell side (buyer loyalty) | Buy side (supplier trust) | Notes |
|---|---|---|---|
| Type name | `BuyerLoyaltyLevel` | `SupplierLoyaltyLevel` | Consistent naming âœ” |
| Level range | **0â€“10** | **0â€“5** | Sell side goes deeper âœ… |
| Direction | Higher level = **higher price received** (multiplier â‰¥ 1) | Higher level = **lower price paid** (down to 0.93x) | Both correct directionally âœ… |
| Persistence bonus | Not applicable (no offer persistence concept) | Higher trust = higher `persistenceBonus` (up to +30% chance) | Buy-side only, intentional âœ… |
| Yearly growth cap | Scales with consecutive years + company value | Scales with consecutive years + company value | Symmetric mechanism âœ” |
| Loyalty preview before action | âœ… Shows "+X points this sale" with cap warning | âœ… Shows "+X points this purchase" with cap warning | Aligned âœ” |
| Trust icon thresholds | `getLoyaltyIcon`: â‰¤3 = â—”, â‰¤7 = â—• | `getTrustIcon`: â‰¤2 = â—”, â‰¤4 = â—• | Different thresholds, probably due to different level scales; acceptable âœ… |
| Terminology in UI | "Buyer Loyalty" / "loyalty score" | "Supplier Trust" / "trust score" | Intentionally distinct branding âœ… |
| kg tracking field | `totalKgSold` | `totalKgPurchased` | Symmetric âœ” |

---

## 4. Offer Lifecycle

| Dimension | Sell side | Buy side | Notes |
|---|---|---|---|
| Offer representation | Buyers are permanent/seasonal profiles (no per-offer entity) | Each offer is a DB row with full state | Intentional architecture difference âœ… |
| Quality decay | No â€” sellers present their own batches | Weekly: grapes -0.012/wk, must_ready -0.008/wk, must_fermenting -0.005/wk | Buy-side only, intentional âœ… |
| Price recalculation | Static per season (demandFactors updated at season refresh) | Recalculated weekly on decay tick | Buy side is more dynamic âœ… |
| Offer persistence | N/A (buyers always available per season) | `is_persistent` flag; up to 3 carryover offers on refresh | Buy-side only âœ… |
| Seasonal refresh | `grapeBuyerMarketService` rotation | `refreshBuyGrapeMarketForSeason()` | Both hooked into gameTick âœ” |
| Supply / capacity enforcement | Per-buyer hard cap enforced at sell time in service | Per-offer `available_kg` reduced on purchase and per-supplier seasonal capacity re-checked at purchase time | Aligned guardrails âœ” |

### Resolved supplier-cap guardrail

The previous buy-side seasonal supplier-cap gap is resolved. The purchase path now re-checks supplier remaining seasonal capacity before completing a buy, aligning the guardrail with sell-side buyer cap enforcement.

---

## 5. UI / Modal

### Structural layout

Both modals share the same 3-panel grid (volatility / relationship / price summary) + MarketOfferTable. The shared structure is good.

| Feature | BuyFromMarketModal | SellGrapesModal | Notes |
|---|---|---|---|
| Shared component (MarketOfferTable) | âœ… | âœ… | âœ” |
| Volatility outlook panel | âœ… | âœ… | âœ” |
| Relationship / loyalty panel | SupplierTrustPanel | BuyerLoyaltyPanel | Both present âœ” |
| Cooperative panel | None | CooperativeMembershipPanel (Germany only) | Intentional âœ… |
| Price summary panel | âœ… | âœ… | âœ” |
| Expandable formula details | âœ… | âœ… | âœ” |
| Loyalty / trust gain preview | **Not shown** | âœ… shown pre-confirm | Missing on buy side âš  |
| Quantity control | Absolute kg (MarketQuickBuyRowAction, per row) | Percentage slider (per row, converts to kg) | Intentional â€” buy is offer-quantity-based, sell is batch-fraction-based âœ… |
| State filter | âœ… (Grapes / Must / Fermenting) | **Not present** | Sell-side has one batch, filter not needed âœ… |
| Grape filter | Filters all-grape offers | Filters by buyer favorite grapes | Different semantics but both useful âœ” |
| Show more / pagination | Defaults to 5, expandable | Shows all buyers (no pagination) | Justified â€” buy has more offers âœ… |
| Weeks on market badge | âœ… | None | Only buy-side offers decay âœ… |
| Batch info column | None | âœ… (Batch column shows grape/kg/quality/state) | Intentional âœ… |
| Favorite grape column | None | âœ… | Intentional âœ… |
| DialogDescription (a11y) | âœ… | âœ… | Aligned âœ” |
| Sell/Buy button label | "Buy for â‚¬X" | "Sell for â‚¬X" | âœ” |
| Default selection | First offer (highest quality sort) | Prefers non-bulk buyer | Minor difference; sell-side avoids bulk buyer as default âœ… |

### Label wording consistency

The price summary panel now uses `Ã—{value}` consistently on both sides, and the volatility profile labels are styled consistently (`text-blue-300 font-medium`).

---

## 6. Transaction Recording

| Dimension | Sell | Buy |
|---|---|---|
| Category | `GRAPE_SALES` (positive) | `SUPPLIES` (negative) | âœ… correct |
| Notification | "Sold X kg of [grape] to [buyer] for [amount]" | "Purchased X kg of [grape] ([state]) from [supplier] for [amount]" | âœ” |
| Topic update | `triggerTopicUpdate('wine_batches')` | `triggerTopicUpdate('wine_batches')` | âœ” |
| Funds check | Not enforced in service (assumed sufficient) | âœ… enforced before purchase | Buy side correctly validates âœ” |

---

## 7. Purchased Batch Construction (Buy-side only)

When a buy-side offer is purchased, a synthetic `WineBatch` is created in `buildPurchasedBatch()`. Notable:

- `vineyardId` is hardcoded to `'market_purchase'`
- `vineyardName` is set to `"[supplier] ([state label])"`
- All wine characteristics (acidity, aroma, body, spice, sweetness, tannins) are set to symmetric values of `0.5` or `quality_score` â€” no per-grape varietal character
- `landValueModifierHarvestSnapshot` is hardcoded to `0.5`
- `wineAnchors` are set uniformly from `quality_score`
- `fermentationProgress` for `must_fermenting` is random `5â€“65%`

There is no sell-side equivalent (sell removes existing batches from inventory, not creates). This section has no symmetry issue.

**Potential balance note:** All characteristic dimensions are set to `quality_score` or `0.5`, meaning a high-quality purchased batch has uniformly balanced characteristics. Real grapes would have varietal-specific profiles. This flattens strategic variety selection for purchased material.

---

## 8. Consolidated Asymmetry Register

### Intentional asymmetries (well-designed, acceptable)

1. Buy price > Sell price via 22% spread â€” anti-arbitrage mechanism
2. Prestige: SELL gets bonus, BUY gets discount â€” higher prestige winery can negotiate better prices
3. Relationship direction: Sell loyalty raises price, buy trust lowers price
4. Cooperative (sell-only, Germany) â€” designed sell-side only
5. Offer decay (buy-only) â€” buy-side offers age, sell-side batches are owned inventory
6. Favorite grape bonus (sell-only) â€” buyer preference rewarded on sell side
7. Bulk supply > bulk demand â€” 22,000 kg supply vs 14,000 kg demand cap
8. 8â€“12 simultaneous buy offers vs 3â€“7 sell buyers â€” buy market more granular
9. Sell side slider (%) vs buy side absolute kg control â€” correct for each context
10. Loyalty levels 0â€“10 (sell) vs 0â€“5 (buy) â€” sell relationships modeled at greater depth
11. Persistence bonus on buy-side trust (no sell-side equivalent)

### Unintentional gaps (status)

| # | Category | Description | Original Severity | Status |
|---|---|---|---|---|
| G1 | Pricing | Quality formula curve mismatch | Medium | Resolved |
| G2 | Pricing | State premium mismatch for must states | Medium | Resolved |
| G3 | Research | Shared key coupling lacked explicit shared contract | Medium | Resolved |
| G4 | Balance | Missing per-supplier seasonal cap check at buy execution | Medium | Resolved |
| G5 | UX | Buy modal lacked trust gain preview | Low | Resolved |
| G6 | UX | `SellGrapesModal` missing `DialogDescription` | Low | Resolved |
| G7 | UI | `x` vs `Ã—` inconsistency in buy modal formulas | Cosmetic | Resolved |
| G8 | UI | Profile label style mismatch in volatility panels | Cosmetic | Resolved |

---

## 9. Recommendations

### Current state

The previously recommended Medium and Low fixes have been completed.

### Completed actions

- Quality multiplier parity implemented between buy and sell pricing.
- State premium parity implemented for buy-side `must_ready` and `must_fermenting`.
- Shared market research keys centralized through explicit constants.
- Supplier seasonal capacity guardrail added to buy execution path.
- Buy-side trust preview added.
- Sell modal accessibility description added.
- Multiplier symbol and profile label styling aligned.

### Optional follow-up

- Add a short note in project documentation (`CONTEXT.md` or equivalent) that buyer and supplier seasonal slot/country unlocks intentionally share the same research progression keys.

