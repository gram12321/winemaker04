# Buy / Sell Grape Market — Symmetry Analysis
**Date:** 2026-05-24  
**Author:** AI analysis (Copilot)  
**Scope:** Compare `buyGrapeMarketService.ts`, `sellGrapesService.ts`, `BuyFromMarketModal.tsx`, `SellGrapesModal.tsx`, `grapeBuyerMarketService.ts`, `grapeSupplierMarketService.ts`, `grapeBuyerLoyaltyService.ts`, `grapeSupplierLoyaltyService.ts`

---

## Summary

The two systems were built incrementally (sell-side first, buy-side second) and share a common design language. Most asymmetries are **intentional** and consistent with the design. A small number of gaps are **unintentional** and should be addressed.

Legend: ✅ Intentional asymmetry | ⚠ Unintentional gap | ✔ Symmetric

### Implementation status update (2026-05-24)

All previously listed **Medium** and **Low/Cosmetic** gaps (G1–G8) have now been implemented and resolved in code, while keeping the anti-arbitrage spread/penalty untouched.

- G1 resolved: Buy-side quality now mirrors sell-side asymmetrical quality curve.
- G2 resolved: Buy-side state premiums now match sell-side values for `must_ready` and `must_fermenting`.
- G3 resolved: Shared buyer/supplier research key coupling is now explicit via shared constants.
- G4 resolved: Buy flow now enforces supplier remaining seasonal capacity at purchase time.
- G5 resolved: Buy modal now includes trust gain preview before purchase.
- G6 resolved: `SellGrapesModal` now includes `DialogDescription` for accessibility.
- G7 resolved: Buy modal uses `×` for multiplier display to match sell modal.
- G8 resolved: Buyer/supplier profile label styling is now aligned.

---

## 1. Pricing Formula

### Formula structure

| Factor | Sell side | Buy side | Notes |
|---|---|---|---|
| Base price | €3.00/kg | €2.90/kg | Then +22% spread added on buy side |
| Net effective base | ~€3.00/kg sell | ~€3.54/kg buy (at flat multipliers) | Spread creates meaningful buy > sell gap ✅ |
| Quality formula | `wineScore × calculateAsymmetricalMultiplier(wineScore)` | `qualityScore × calculateAsymmetricalMultiplier(qualityScore)` | Aligned ✔ |
| Prestige | +bonus (up to +30%) | –discount (down to -30%) | Opposite direction — intentional ✅ |
| Relationship | Multiplier increases price | Multiplier decreases price (discount) | Opposite direction — intentional ✅ |
| State premium | grapes 1.0, must_ready 1.08, must_fermenting 1.15 | grapes 1.0, must_ready 1.08, must_fermenting 1.15 | Aligned ✔ |
| Market spread | `1/(1+0.22)` penalty on sell price | `×(1+0.22)` markup on buy price | Mirrors correctly ✔ |
| Floor price | Per-buyer (0 for bulk, 0.80–1.20 for cooperative) | Global floor: €0.80/kg (`BUY_MARKET_MIN_PRICE`) | Different mechanism ✅ |
| Favorite grape bonus | Primary +18%, secondary +10% | **None** | Buy side has no concept ✅ |
| Buyer/Supplier multiplier | Per-buyer profile multiplier (priceMultiplier field) | Per-supplier base_price_multiplier | Equivalent role ✔ |
| Season / economy / year cycle | Embedded in buyer demandFactors | Embedded in offer demandFactors | Same structure ✔ |
| Volatility | Carried as demandFactors on buyer | Carried as demandFactors on offer | Same structure ✔ |

### Quality curve divergence (⚠ unintentional gap)

The sell side uses `wineScore × calculateAsymmetricalMultiplier(wineScore)` which rewards high quality nonlinearly. The buy side uses a linear formula `0.55 + score × 1.05`. A 0.9 quality score produces:

- Sell side: depends on `calculateAsymmetricalMultiplier`
- Buy side: `0.55 + 0.9 × 1.05 = 1.495` (capped at 1.7)

These are not mirror curves. Whether the intention was to use the same asymmetric curve on the buy side or deliberately simplify it is not documented. The linear curve means quality improvement is less rewarded on the buy side.

### State premium asymmetry (⚠ unintentional gap)

| State | Sell premium | Buy premium |
|---|---|---|
| grapes | 1.00 | 1.00 |
| must_ready | **1.08** | **1.12** |
| must_fermenting | **1.15** | **1.20** |

Buy-side premiums are higher (1.12 vs 1.08, 1.20 vs 1.15). This makes processed material proportionally more expensive to buy than it is valuable to sell at the same stage. This divergence is undocumented and may be unintentional.

---

## 2. Counterparty Pools

| Dimension | Sell side | Buy side | Notes |
|---|---|---|---|
| Bulk counterparty | `bulk_buyer` — 14,000 kg/season cap | `bulk_supplier` — 22,000 kg/season cap | Supply > demand gap intentional ✅ |
| Seasonal pool | 3–7 rotating buyers per season | 3–7 rotating suppliers per season | Symmetric count range ✔ |
| Cooperative counterparty | `winzergenossenschaft` (Germany only) | **None** | Intentional design; sell-side only ✅ |
| Offer count | ~3–7 buyers active simultaneously | **8–12 individual offers** generated from 3–7 suppliers | Buy side generates more simultaneous choices ✅ |
| Research keys | Shared market slot/country keys | Shared market slot/country keys | Explicit shared contract via constants ✔ |

### Shared research keys (⚠ needs documentation)

`grapeSupplierMarketService` reads `grape_buyer_slots` and `grape_buyer_country_access` — the same research keys as the sell-side buyer market. This means one research upgrade simultaneously unlocks more seller slots AND more supplier slots. This could be intentional (one upgrade opens both sides of the market) but it is currently undocumented, and the naming (`grape_buyer_*`) doesn't clearly indicate it applies to the supply side.

**Recommendation:** Document this explicitly or rename the supply-side usage to `grape_supplier_slots` / `grape_supplier_country_access` if the intent is to keep them independent.

---

## 3. Loyalty / Relationship Systems

| Dimension | Sell side (buyer loyalty) | Buy side (supplier trust) | Notes |
|---|---|---|---|
| Type name | `BuyerLoyaltyLevel` | `SupplierLoyaltyLevel` | Consistent naming ✔ |
| Level range | **0–10** | **0–5** | Sell side goes deeper ✅ |
| Direction | Higher level = **higher price received** (multiplier ≥ 1) | Higher level = **lower price paid** (down to 0.93x) | Both correct directionally ✅ |
| Persistence bonus | Not applicable (no offer persistence concept) | Higher trust = higher `persistenceBonus` (up to +30% chance) | Buy-side only, intentional ✅ |
| Yearly growth cap | Scales with consecutive years + company value | Scales with consecutive years + company value | Symmetric mechanism ✔ |
| Loyalty preview before action | ✅ Shows "+X points this sale" with cap warning | ✅ Shows "+X points this purchase" with cap warning | Aligned ✔ |
| Trust icon thresholds | `getLoyaltyIcon`: ≤3 = ◔, ≤7 = ◕ | `getTrustIcon`: ≤2 = ◔, ≤4 = ◕ | Different thresholds, probably due to different level scales; acceptable ✅ |
| Terminology in UI | "Buyer Loyalty" / "loyalty score" | "Supplier Trust" / "trust score" | Intentionally distinct branding ✅ |
| kg tracking field | `totalKgSold` | `totalKgPurchased` | Symmetric ✔ |

---

## 4. Offer Lifecycle

| Dimension | Sell side | Buy side | Notes |
|---|---|---|---|
| Offer representation | Buyers are permanent/seasonal profiles (no per-offer entity) | Each offer is a DB row with full state | Intentional architecture difference ✅ |
| Quality decay | No — sellers present their own batches | Weekly: grapes -0.012/wk, must_ready -0.008/wk, must_fermenting -0.005/wk | Buy-side only, intentional ✅ |
| Price recalculation | Static per season (demandFactors updated at season refresh) | Recalculated weekly on decay tick | Buy side is more dynamic ✅ |
| Offer persistence | N/A (buyers always available per season) | `is_persistent` flag; up to 3 carryover offers on refresh | Buy-side only ✅ |
| Seasonal refresh | `grapeBuyerMarketService` rotation | `refreshBuyGrapeMarketForSeason()` | Both hooked into gameTick ✔ |
| Supply / capacity enforcement | Per-buyer hard cap enforced at sell time in service | Per-offer `available_kg` reduced on purchase and per-supplier seasonal capacity re-checked at purchase time | Aligned guardrails ✔ |

### Per-supplier seasonal supply cap not enforced at purchase time (⚠ balance gap)

The sell side enforces `effectiveSeasonLimitKg` as a hard cap on each individual sale (checked in `sellGrapes()`). On the buy side, the supplier's `effectiveSeasonSupplyKg` is only used when generating offer `available_kg` at offer creation — it is not re-checked at purchase time. Since a single supplier can back multiple offers simultaneously, a player could buy all of those offers and exceed the supplier's intended seasonal supply cap.

---

## 5. UI / Modal

### Structural layout

Both modals share the same 3-panel grid (volatility / relationship / price summary) + MarketOfferTable. The shared structure is good.

| Feature | BuyFromMarketModal | SellGrapesModal | Notes |
|---|---|---|---|
| Shared component (MarketOfferTable) | ✅ | ✅ | ✔ |
| Volatility outlook panel | ✅ | ✅ | ✔ |
| Relationship / loyalty panel | SupplierTrustPanel | BuyerLoyaltyPanel | Both present ✔ |
| Cooperative panel | None | CooperativeMembershipPanel (Germany only) | Intentional ✅ |
| Price summary panel | ✅ | ✅ | ✔ |
| Expandable formula details | ✅ | ✅ | ✔ |
| Loyalty / trust gain preview | **Not shown** | ✅ shown pre-confirm | Missing on buy side ⚠ |
| Quantity control | Absolute kg (MarketQuickBuyRowAction, per row) | Percentage slider (per row, converts to kg) | Intentional — buy is offer-quantity-based, sell is batch-fraction-based ✅ |
| State filter | ✅ (Grapes / Must / Fermenting) | **Not present** | Sell-side has one batch, filter not needed ✅ |
| Grape filter | Filters all-grape offers | Filters by buyer favorite grapes | Different semantics but both useful ✔ |
| Show more / pagination | Defaults to 5, expandable | Shows all buyers (no pagination) | Justified — buy has more offers ✅ |
| Weeks on market badge | ✅ | None | Only buy-side offers decay ✅ |
| Batch info column | None | ✅ (Batch column shows grape/kg/quality/state) | Intentional ✅ |
| Favorite grape column | None | ✅ | Intentional ✅ |
| DialogDescription (a11y) | ✅ | ✅ | Aligned ✔ |
| Sell/Buy button label | "Buy for €X" | "Sell for €X" | ✔ |
| Default selection | First offer (highest quality sort) | Prefers non-bulk buyer | Minor difference; sell-side avoids bulk buyer as default ✅ |

### Label wording consistency

The price summary panel now uses `×{value}` consistently on both sides, and the volatility profile labels are styled consistently (`text-blue-300 font-medium`).

---

## 6. Transaction Recording

| Dimension | Sell | Buy |
|---|---|---|
| Category | `GRAPE_SALES` (positive) | `SUPPLIES` (negative) | ✅ correct |
| Notification | "Sold X kg of [grape] to [buyer] for [amount]" | "Purchased X kg of [grape] ([state]) from [supplier] for [amount]" | ✔ |
| Topic update | `triggerTopicUpdate('wine_batches')` | `triggerTopicUpdate('wine_batches')` | ✔ |
| Funds check | Not enforced in service (assumed sufficient) | ✅ enforced before purchase | Buy side correctly validates ✔ |

---

## 7. Purchased Batch Construction (Buy-side only)

When a buy-side offer is purchased, a synthetic `WineBatch` is created in `buildPurchasedBatch()`. Notable:

- `vineyardId` is hardcoded to `'market_purchase'`
- `vineyardName` is set to `"[supplier] ([state label])"`
- All wine characteristics (acidity, aroma, body, spice, sweetness, tannins) are set to symmetric values of `0.5` or `quality_score` — no per-grape varietal character
- `landValueModifierHarvestSnapshot` is hardcoded to `0.5`
- `wineAnchors` are set uniformly from `quality_score`
- `fermentationProgress` for `must_fermenting` is random `5–65%`

There is no sell-side equivalent (sell removes existing batches from inventory, not creates). This section has no symmetry issue.

**Potential balance note:** All characteristic dimensions are set to `quality_score` or `0.5`, meaning a high-quality purchased batch has uniformly balanced characteristics. Real grapes would have varietal-specific profiles. This flattens strategic variety selection for purchased material.

---

## 8. Consolidated Asymmetry Register

### Intentional asymmetries (well-designed, acceptable)

1. Buy price > Sell price via 22% spread — anti-arbitrage mechanism
2. Prestige: SELL gets bonus, BUY gets discount — higher prestige winery can negotiate better prices
3. Relationship direction: Sell loyalty raises price, buy trust lowers price
4. Cooperative (sell-only, Germany) — designed sell-side only
5. Offer decay (buy-only) — buy-side offers age, sell-side batches are owned inventory
6. Favorite grape bonus (sell-only) — buyer preference rewarded on sell side
7. Bulk supply > bulk demand — 22,000 kg supply vs 14,000 kg demand cap
8. 8–12 simultaneous buy offers vs 3–7 sell buyers — buy market more granular
9. Sell side slider (%) vs buy side absolute kg control — correct for each context
10. Loyalty levels 0–10 (sell) vs 0–5 (buy) — sell relationships modeled at greater depth
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
| G7 | UI | `x` vs `×` inconsistency in buy modal formulas | Cosmetic | Resolved |
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
