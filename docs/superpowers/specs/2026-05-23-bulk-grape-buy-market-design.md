# Bulk Grape Buy Market Design
**Date:** 2026-05-23  
**Status:** Draft for review

---

## 1. Goal

Introduce a Buy from Market flow for early-game balancing and production flexibility, while establishing a reusable generic market window foundation for future waregroups (tools, barrels, equipment, and others).

This slice is grape-first, winery-first, and intentionally limited to keep delivery risk low.

---

## 2. Scope Decisions (Approved)

### 2.1 Product scope
- Use a generic market window shell now, with Grapes as the active waregroup.
- Place market access in Winery via a Buy Grapes button.
- Keep Sales focused on bottled wine only.
- Remove grape-selling entry points from Sales flows.

### 2.2 Economy behavior
- Buy market must reuse the same season, economy phase, volatility, and cyclical demand behavior family as sell-side grape market.
- Buy pricing uses a fixed spread over mirrored baseline so buying remains more expensive than selling.

### 2.3 Offer lifecycle
- Hybrid lifecycle:
  - seasonal refresh for normal offers
  - trusted supplier carry-over for selected offers
  - weekly quality decay for persisted offers
- Weekly decay is state-sensitive and intentionally simplified relative to full post-harvest simulation.

### 2.4 Batch states in market
- Market offers can be in states:
  - grapes
  - must
  - must_fermenting
- Purchase result creates normal inventory batches in the offered state.
- No special market-only inventory batch type in this slice.

### 2.5 Sell-side expansion dependency
- Expand selling to additional batch states is designed now but implemented in a later slice.
- Current implementation target remains buy-side first.

---

## 3. Architecture

### 3.1 Shared UI market shell (generic)
Create reusable UI components that do not depend on grape-specific business rules.

Candidate location:
- src/components/ui/market

Planned components:
- MarketWindow
- MarketOfferTable
- MarketOfferRowAction (inline quick buy controls + optional details entry)

### 3.2 Grape adapter layer (domain mapping)
Create a grape adapter that maps domain offers to generic table rows and action payloads.

Candidate location:
- src/lib/services/sales

Responsibilities:
- transform domain offer fields into display model
- provide row metadata (state label, quality, freshness, price, tags)
- provide quick-buy defaults and validation hints

### 3.3 Buy-side market service (domain logic)
Add service-layer logic for:
- offer generation and refresh
- weekly decay updates
- trusted carry-over selection
- pricing with shared market drivers + spread
- purchase execution and inventory insertion

Candidate location:
- src/lib/services/sales

### 3.4 Tick integration
Integrate weekly offer updates in existing game tick processing.

Candidate location:
- src/lib/services/core/gameTick.ts

Weekly responsibilities:
- apply quality decay by state
- increment market age counters
- expire stale/depleted offers

Seasonal responsibilities:
- rotate/regenerate baseline offers
- preserve trusted carry-over offers under rules

### 3.5 Page integration
- Winery page gets Buy Grapes button and market window entry.
- Sales page removes grape-specific selling entry points and remains bottled-wine centered.

Candidate locations:
- src/components/pages/Winery.tsx
- src/components/pages/Sales.tsx

---

## 4. Offer Data Model

Design a grape-first but generic-ready offer entity.

### 4.1 Core identity
- offerId
- companyId
- wareGroup (value in this slice: grapes)
- supplierId
- supplierName
- originTag (trusted_carryover, seasonal_rotation, country_special)

### 4.2 Commerce payload
- batchState (grapes, must, must_fermenting)
- grapeVariety
- availableKg
- qualityScore (0..1)
- basePricePerKg
- effectivePricePerKg

### 4.3 Time and aging
- createdYear
- createdSeason
- createdWeek
- lastRefreshedYear
- lastRefreshedSeason
- lastRefreshedWeek
- weeksOnMarket

### 4.4 Decay and expiry controls
- qualityDecayPerWeek
- minQualityFloor
- isPersistent
- expiresAtYear
- expiresAtSeason
- expiresAtWeek

### 4.5 Purchase effects
- decrement availableKg
- remove when depleted
- insert normal inventory batch in offered state
- log finance transaction and user notification

---

## 5. Pricing and Balance Rules

### 5.1 Shared market drivers (parity)
Buy pricing consumes the same demand context dimensions used by sell-side market behavior:
- season pressure
- economy phase pressure
- yearly cycle influence
- deterministic seasonal volatility component

### 5.2 Pricing layers
Final buy price per kg is built from layered multipliers:
1. quality-driven value baseline (shape aligned with sell-side grape logic)
2. state premium layer (grapes < must < must_fermenting)
3. fixed buy spread (anti-arbitrage)
4. clamp bounds for stability

### 5.3 Anti-arbitrage
Guardrails prevent easy buy-then-immediate-sell profit loops:
- fixed spread always applied on buy side
- optional sanity check against mirrored expected sell value
- price clamps to avoid edge spikes producing exploitable gaps

### 5.4 Decay model (simplified but state-aware)
Weekly quality decay rates are state-specific:
- grapes decay fastest
- must decays medium
- must_fermenting decays slowest

Implementation note:
- mimic current post-harvest risk directionality without importing full fermentation/feature simulation complexity into market offers.

---

## 6. UI and Interaction Design

### 6.1 Entry and ownership
- Winery owns grape market actions.
- Buy Grapes button opens Buy from Market window.
- Sales remains bottled-wine focused.

### 6.2 Market window (V1)
- Generic shell with waregroup selector scaffold.
- Grapes enabled.
- Other waregroups can appear as disabled Coming Soon entries for now.

### 6.3 Offer table columns (grape slice)
- Supplier
- State
- Variety
- Available kg
- Quality
- Price per kg
- Freshness or weeks-on-market indicator
- Quick buy controls

### 6.4 Row action pattern (approved hybrid)
- Inline quantity input + Buy action in row for fast execution.
- Optional Details view for compact breakdown when needed.

V1 details should stay compact and avoid heavy modal complexity.

### 6.5 Validation and feedback
- inline validation for quantity and cash constraints
- non-blocking row-level errors
- success updates row inventory and player notifications

---

## 7. Testing Strategy

### 7.1 Service tests
Add focused tests for:
- offer generation by season and economy phase
- deterministic volatility behavior consistency
- trusted carry-over selection logic
- weekly decay by state
- expiry and depletion rules
- buy price layering and spread behavior
- purchase transaction side effects (inventory, finance, notifications)

### 7.2 UI tests
Add targeted tests for:
- Winery Buy Grapes entry visibility and open behavior
- market table rendering and sorting basics
- inline quick-buy validation and action execution
- optional details panel visibility

### 7.3 Integration tests
Validate end-to-end:
- week advancement applies offer decay
- season advancement refreshes offers and preserves trusted carry-over rows
- purchase updates inventory with correct purchased state

### 7.4 Regression checks
- Sales page still supports bottled-wine order and contract flows
- Winery existing crush/ferment/bottle actions remain unaffected

---

## 8. Rollout Plan

### Phase 1 (this slice)
- Generic market UI shell + grape adapter
- Winery Buy Grapes entry
- Buy-side grape market offers for grapes/must/must_fermenting
- parity pricing drivers + fixed spread
- weekly state decay + hybrid persistence
- Sales cleanup for grape-specific entry points

### Phase 2 (next slice)
- Expand sell-side support to additional batch states
- align buy/sell cross-state balancing and UX messaging

### Phase 3 (future)
- enable additional waregroups in generic market shell
- add waregroup filters and richer details behavior
- optional top-level Market navigation when breadth justifies it

---

## 9. Out of Scope for This Slice

- Full waregroup commerce implementation beyond grapes
- Full post-harvest simulation import for market offers
- Advanced global event shock cards
- Expanded sell-side batch-state support implementation

---

## 10. Risks and Mitigations

### Risk: hidden arbitrage gaps
Mitigation:
- fixed spread
- mirrored baseline sanity checks
- clamps and targeted balance tests

### Risk: UI complexity creep
Mitigation:
- keep row actions compact in V1
- make details optional and concise

### Risk: future waregroup mismatch
Mitigation:
- enforce generic UI contract now
- isolate grape-specific mapping in adapter layer

### Risk: lifecycle complexity in tick
Mitigation:
- confine market aging and refresh logic to dedicated service methods invoked from tick
- keep tick integration thin and service-driven

---

## 11. Open Follow-Up Notes

- Sell-side multi-state expansion is intentionally deferred but explicitly designed as the next slice.
- Top-level Market navigation remains a future decision tied to multi-waregroup maturity.
