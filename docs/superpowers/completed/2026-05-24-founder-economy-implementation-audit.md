# Winemaker Implementation Audit (Founder Economy Lineage)
Date: 2026-05-24
Scope anchor: founder-economy design thread and downstream systems from v0.24+ (bulk buy/sell market, weather, research, achievements)

Status: Completed historical audit, superseded by the 2026-07-14 documentation review. Its founder-economy conclusions remain useful as lineage: the founder compensation slice is implemented, while broader onboarding/equity ideas remain deferred because the public-company/share runtime is intentionally inactive.

## Executive Summary
The founder-economy initiative has materially shipped in adjacent mechanics (bulk grape sell/buy economy, weather layer, research progression hardening), but the original founder-specific labor/equity model is still mostly unimplemented.

High-confidence status:
- Implemented strongly: bulk grape market ecosystem (sell + buy + supplier/buyer loyalty + seasonal/weekly lifecycle), weather phase 1 and most of phase 2, research gates and progression enforcement.
- Partially implemented: generic market UI shell usage, test depth for buy-market and weather systems, weather docs alignment, “planned” weather alerts/recommendations.
- Partially implemented from the founder-economy spec core: founder profit-share wage replacement, yearly Founder Return distribution, founder buyout, `isFounder` persistence, and UI are shipped. Founder equity table, story-triggered family reveals, startup bankruptcy advisor step, country archetypes, and tests remain open.

## Baseline Timeline (v0.24+)
Based on current version history in docs/versionlog.md:
- v0.24-0.24a: research upgrade, grape buyer foundations.
- v0.25-0.251J: bulk grape buy/sell systems, supplier market/loyalty, weather system expansion.

## Design Doc Status Matrix

### 1) docs/superpowers/deferred/2026-05-20-early-game-balance-founder-economy.md
Status: Partially Implemented (adjacent systems shipped; founder wage/profit-share slice now shipped; broader founder onboarding remains open)

Implemented:
- Bulk/cooperative bridge income exists on sell side.
  - src/lib/services/sales/sellGrapesService.ts
  - src/lib/services/sales/cooperativeService.ts
  - migrations/20260521000000_add_cooperative_membership.sql
- Buy-from-market supply bridge exists.
  - src/lib/services/sales/buyGrapeMarketService.ts
  - src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx
  - migrations/20260523090000_add_grape_market_buy_offers.sql
  - migrations/20260524120000_add_grape_market_suppliers.sql
- Starting-condition balancing was tuned (cash/loans/pre-unlocks by country).
  - src/lib/constants/startingConditions.ts
  - src/lib/services/core/startingConditionsService.ts

Implemented since the original audit:
- Founder wage replacement through `staff.isFounder` and zero wages.
  - src/lib/services/user/staffService.ts
  - src/lib/services/finance/wageService.ts
- Yearly Founder Return distributions.
- Manual founder buyout conversion to salaried employee.
- Founder Panel UI in Finance.
- Staff `is_founder` persistence.
  - src/lib/database/core/staffDB.ts
  - migrations/20260525000000_add_is_founder_to_staff.sql

Still missing from original founder concept:
- Founder equity persistence table from design suggestion.
  - No founder_equity migration/table present under migrations/
- Story-triggered family member reveals and progressive staffing events.
  - No dedicated story event system in current core services for this flow.
- Startup bankruptcy advisor step in company creation flow.
  - No dedicated startup risk forecast setup step found in creation path.
- Founder-specific tests.

Notes:
- Germany still starts with 4 staff in starting conditions, so the specific “reduce initial wage burden via staged reveals/founder model” remains unresolved at architecture level.

### 2) docs/superpowers/completed/2026-05-23-bulk-grape-buy-market-execution.md
Status: Mostly Implemented

Implemented:
- Persistence layer for buy offers.
  - src/lib/database/sales/buyMarketOffersDB.ts
- Buy market service lifecycle entry points.
  - src/lib/services/sales/buyGrapeMarketService.ts
  - includes getBuyGrapeMarketOffers, refreshBuyGrapeMarketForSeason, processWeeklyBuyGrapeOfferDecay, purchaseBuyGrapeOffer
- Winery integration and modal flow.
  - src/components/pages/Winery.tsx
  - src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx
- Tick integration (weekly decay + seasonal refresh).
  - src/lib/services/core/gameTick.ts
- Sales page is now bottled-wine centric.
  - src/components/pages/Sales.tsx

Partial/misaligned vs execution-plan intent:
- Generic MarketWindow component exists but is not used by BuyFromMarketModal (modal directly uses Dialog).
  - src/components/ui/market/MarketWindow.tsx
  - src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx
- Planned service test depth not fully realized.
  - tests/sales/buyGrapeMarketService.test.ts currently validates spread/state-label basics, but does not fully cover decay-by-state integration or purchase side effects with DB/inventory assertions.

### 3) docs/superpowers/completed/2026-05-23-bulk-grape-buy-market-design.md
Status: Implemented with targeted intentional asymmetries

Implemented:
- Winery-owned Buy Grapes entry and modal.
  - src/components/pages/Winery.tsx
- Hybrid lifecycle (seasonal refresh + trusted carry-over + weekly quality decay).
  - src/lib/services/sales/buyGrapeMarketService.ts
- State support for grapes/must_ready/must_fermenting and purchased-batch creation in selected state.
  - src/lib/services/sales/buyGrapeMarketService.ts
- Shared market-driver parity with sell-side demand context + spread anti-arbitrage.
  - src/lib/services/sales/buyGrapeMarketService.ts
  - src/lib/services/sales/sellGrapesService.ts
- Supplier market + loyalty systems for buy side.
  - src/lib/services/sales/grapeSupplierMarketService.ts
  - src/lib/services/sales/grapeSupplierLoyaltyService.ts

Open quality/maintenance items:
- Generic shell reuse remains partial (MarketWindow not actually wiring the buy modal).
- Test suite depth for end-to-end buy lifecycle still thin relative to doc ambition.

### 4) docs/superpowers/completed/2026-05-23-weather-forecast-volatility-design.md
Status: Implemented (Phase 1 complete, and surpassed)

Implemented:
- Weather domain types in shared types.
  - src/lib/types/types.ts
- Seasonal forecast + weekly realization + week-ahead forecast with confidence-hit modeling.
  - src/lib/services/finance/weatherService.ts
- Tick integration writes weather context each week.
  - src/lib/services/core/gameTick.ts
- Header weather exposure and navigation.
  - src/components/layout/Header.tsx
  - src/App.tsx
- Grape market volatility integration includes weather pressure fields.
  - src/lib/services/sales/grapeBuyerMarketService.ts
  - src/lib/services/sales/buyGrapeMarketService.ts

### 5) docs/superpowers/completed/2026-05-23-weather-phase-2-readiness-design.md
Status: Largely Implemented (with explicit deferred parts still deferred)

Implemented:
- Deterministic weather impact service for vineyard ripeness/health deltas.
  - src/lib/services/vineyard/weatherImpactService.ts
- Site coupling dimensions included: aspect, altitude, terroir, soil response classes.
  - src/lib/services/vineyard/weatherImpactService.ts
- Game tick passes weather context to vineyard updates.
  - src/lib/services/core/gameTick.ts
  - src/lib/services/vineyard/vineyardManager.ts
- Dedicated Weather Center page with per-vineyard impact table and model visibility.
  - src/components/pages/WeatherCenter.tsx
  - src/lib/services/vineyard/weatherCenterService.ts
- Alerts shell present and explicitly marked planned.
  - src/components/pages/WeatherCenter.tsx

Intentionally deferred and still deferred (matches spec):
- Severe weather event damage mechanics.
- Recommended action engine.
- Weather-linked achievements/research triggers.

Drift/staleness found:
- WeatherTab still states vineyard impact as “planned next slices,” which is stale now that phase-2 mechanics are present.
  - src/components/pages/winepedia/WeatherTab.tsx

### 6) docs/superpowers/specs/2026-05-21-research-mechanic-design.md
Status: Mostly Implemented for core gating; future tracks still pending

Implemented:
- requiredPrestige + prerequisites gates and eligibility checks.
  - src/lib/constants/researchConstants.ts
  - src/lib/services/research/researchEligibilityService.ts
- Achievement/company-value/buyer-loyalty gates present.
  - src/lib/constants/researchConstants.ts
  - src/lib/services/research/researchEligibilityService.ts
- Grant economics updated (basic and advanced positive ROI values).
  - src/lib/constants/researchConstants.ts
- Enforcement points for key unlock types:
  - fermentation_technology: src/components/ui/modals/activitymodals/FermentationOptionsModal.tsx
  - staff_limit: src/components/ui/modals/activitymodals/HireStaffModal.tsx
  - vineyard_size and related caps: src/components/ui/modals/activitymodals/LandSearchOptionsModal.tsx and src/lib/services/vineyard/vineyardCapacityService.ts
  - contract_type: src/lib/services/sales/contractGenerationService.ts
  - grape-buyer progression unlocks (slots/countries/multipliers): src/lib/services/sales/grapeBuyerMarketService.ts
- startingResearch head-start application.
  - src/lib/constants/startingConditions.ts
  - src/lib/services/core/startingConditionsService.ts
- Permanent effects aggregation (minimum slice) and application.
  - src/lib/services/research/researchPermanentEffectsService.ts
  - src/lib/services/vineyard/vineyardManager.ts

Still not implemented from design’s future tracks:
- Equipment unlock gameplay system.
- Vineyard-technique dedicated gameplay track.
- Achievement-triggered research visibility layer (distinct from hard eligibility).
- Site-conditional research availability.

### 7) docs/superpowers/completed/buy-sell-grape-symmetry-analysis.md
Status: Aligned with codebase direction

Current code appears consistent with the documented resolved asymmetries/gaps:
- Spread parity mechanism between buy and sell.
  - src/lib/services/sales/buyGrapeMarketService.ts
  - src/lib/services/sales/sellGrapesService.ts
- Supplier seasonal capacity check during buy purchase path exists.
  - src/lib/services/sales/buyGrapeMarketService.ts
- Trust/loyalty ecosystem present on both sides.
  - src/lib/services/sales/grapeBuyerLoyaltyService.ts
  - src/lib/services/sales/grapeSupplierLoyaltyService.ts

## Existing + New Mechanic Exploration Snapshot

Existing mechanics expanded:
- Sell-side grape market became a full buyer ecosystem (bulk, seasonal, cooperative, loyalty, limits, volatility).
- Research became progression-critical for market access scaling (buyer slots, country pools, multipliers).

New mechanics introduced:
- Buy-side grape market with persisted offers, supplier identities, and quality decay.
- Weather as top-level weekly simulation input affecting both markets and vineyards.
- Weather Center as operations-facing planning surface.

Cross-system coupling now in place:
- Tick -> weather generation -> vineyard/weather impacts + market volatility + buy-offer lifecycle updates.
- Research unlocks -> market breadth/caps -> economic throughput.
- Achievement progression -> research eligibility for market growth tiers.

## Likely Next Work (Priority)
1. Founder economy core implementation pass
- Add founder lifecycle model (staff founder flag/state + compensation mode) and founder-equity persistence.
- Replace early-game founder wages with explicit distribution rule and conversion milestones.
- Add minimal startup viability advisor before company confirmation.

2. Weather documentation and onboarding cleanup
- Update Winepedia WeatherTab to reflect shipped phase-2 vineyard integration.
- Clarify what is live vs planned in Weather Center copy and docs.

3. Test depth expansion in highest-risk economic loops
- Add integration tests for buy market decay/purchase side effects and supplier cap enforcement paths.
- Add deterministic unit tests for weatherImpactService coefficient and clamp behavior.
- Add contract/channel unlock regression tests tied to research unlock changes.

4. Generic market UI consolidation
- Either migrate BuyFromMarketModal onto MarketWindow or remove unused shell to reduce drift.

5. Research roadmap closure decisions
- Decide whether equipment/vineyard-technique tracks are still in-scope, and either implement minimal slices or mark explicitly deferred in current design docs.

## Risk Register
- Balance risk: founder wage pressure is now solved for starts that use `isFounder`, but founder return percentage, buyout cost, and no-payout lean years still need balance attention.
- Drift risk: old audit notes and in-game copy can lag behind the now-shipped founder/weather/market slices.
- Regression risk: buy/sell + weather + research are tightly coupled; weak integration tests increase break risk during balancing changes.
- UX risk: parallel market abstractions (generic shell vs bespoke modal) can diverge and increase maintenance cost.

## Test Coverage Gaps
Strong:
- Core market scaffolding tests exist.
  - tests/sales/grapeBuyerMarket.test.ts
  - tests/sales/buyGrapeMarketService.test.ts
- Research eligibility/permanent-effect tests exist.
  - tests/research/researchEligibility.test.ts
  - tests/research/researchPermanentEffectsService.test.ts
- Tick weather fields are covered at smoke level.
  - tests/core/gameTick.test.ts
- Vineyard weather impact and Weather Center behavior tests now exist.
  - tests/vineyard/weatherImpactService.test.ts
  - tests/vineyard/weatherCenterService.test.ts
  - tests/vineyard/weatherCenterPage.test.ts

Gaps:
- buyGrapeMarketService test file is lighter than design acceptance depth (limited assertion breadth).
- No explicit founder-economy mechanic tests for yearly Founder Return distribution, buyout conversion, or finance panel behavior.
- Current full suite still has two failing research panel visibility expectations.

## Bottom Line
The branch of work has successfully delivered a large economic and simulation expansion around the founder-economy initiative. The founder compensation core is now shipped, while the remaining founder gaps are startup advisory UX, story-triggered staff reveals, automatic conversion milestones, a possible `founder_equity` table, broader country archetypes, and founder-specific tests.
