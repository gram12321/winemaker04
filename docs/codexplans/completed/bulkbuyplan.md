# Bulk Buy Harvest-Equivalent Batch Plan

## Summary

Refactor batch creation so normal harvests and buy-market offers share the same internal harvest-derived batch builder, while keeping `createWineBatchFromHarvest()` as the real-vineyard wrapper. Buy-market offers will persist pseudo-vineyard source inputs and a generated preview snapshot, and the Buy Grapes modal will render that exact preview before purchase. Market-origin batches will remain non-vineyard inventory, but they will carry enough origin snapshot data for downstream winery UI to render without looking up a real vineyard row.

## Key Changes

### 1. Extract a shared harvest-derived batch builder
- Keep `createWineBatchFromHarvest()` as the public real-vineyard entrypoint and preserve its current caller contract.
- Add a shared internal builder that accepts normalized harvest-source inputs and returns a fully initialized batch payload:
  - harvest anchors
  - modified characteristics
  - initialized features
  - harvest-trigger results
  - structure/taste/price snapshots
- Add a market wrapper that builds the same normalized input shape from offer provenance and calls the shared builder.
- Keep harvest-batch combine logic only in the real-vineyard wrapper. Market purchases always create discrete lots.

### 2. Define explicit market-state derivation rules
- Offer previews and purchased batches must be generated in two stages:
  1. build the equivalent grape-stage batch from pseudo-vineyard harvest inputs
  2. advance it into the offered state
- For `grapes` offers:
  - use the grape-stage batch directly
- For `must_ready` offers:
  - apply the same crush-stage transformations the winery path would apply, using a fixed market crush profile defined in the market service
- For `must_fermenting` offers:
  - start from the crushed batch, apply a fixed market fermentation setup profile, and set deterministic fermentation progress from stored offer data rather than random purchase-time rolls
- The fixed market crush/fermentation profiles must be explicit constants in the buy-market domain so preview and purchase always match.

### 3. Persist offer provenance plus deterministic preview
- Extend buy-offer persistence with:
  - pseudo-vineyard provenance inputs
  - a deterministic preview seed/version
  - a generated preview snapshot used by both modal rendering and purchase
- The preview snapshot should include:
  - characteristics
  - wine anchors
  - initial features/risk state
  - land value / structure / taste snapshots
  - state-specific fields needed for must and fermenting offers
  - readable origin summary for UI
- Regeneration rule:
  - provenance inputs are the source of truth
  - preview snapshot is a cached derivative
  - whenever weekly decay or seasonal refresh changes an offer materially, regenerate the full preview from provenance inputs and overwrite the cached preview
- Add a `previewVersion` or equivalent compatibility marker so stale cached previews can be regenerated safely after logic changes.

### 4. Handle existing offers and fallback loading safely
- Existing `grape_market_buy_offers` rows will not have provenance or preview data.
- On market load and on purchase:
  - if an offer is missing required preview/provenance fields, regenerate or refresh it before display/purchase
  - if regeneration is not possible from old data, drop the stale offer row and replace it through the normal refresh path
- The plan should not rely on one-off manual cleanup; runtime fallback behavior must be part of the implementation.

### 5. Add market-origin batch snapshot support for downstream UI
- Extend `WineBatch` with an origin snapshot for market-created lots:
  - source kind
  - supplier identity
  - pseudo-vineyard provenance summary
  - cached preview-derived display fields needed after purchase
- Downstream winery/batch detail UI must branch on source kind:
  - vineyard-origin batches continue using vineyard-backed breakdowns
  - market-origin batches render a snapshot-based origin/quality panel instead of attempting vineyard lookup
- Explicitly do not try to make land-value factor breakdown compute from a fake vineyard record. Market-origin batches should show stored origin/preview context, not vineyard factor recomputation.

### 6. Lock pricing/prestige behavior for market-origin batches
- Purchased market batches should use the shared batch pricing logic from their generated batch values.
- Company prestige still applies.
- Vineyard prestige does not apply to market-origin batches and must be `undefined`/`0`.
- This rule should be the same for modal preview and final purchased batch.

### 7. Upgrade the Buy Grapes modal to show the exact purchase result
- The modal should render the cached preview snapshot from each offer rather than ad hoc inferred values.
- Show:
  - origin / terroir summary
  - state label and processing context
  - core characteristics / structure-facing signals
  - taste-quality signal
  - initial feature and risk preview
- Reuse existing winery batch display components where they can consume preview-shaped data without requiring a persisted inventory batch.
- The purchase path must consume the same provenance/preview data that the modal displayed.

## Public API / Type Changes

- Add a normalized “harvest source input” type for the shared internal builder.
- Keep `createWineBatchFromHarvest()` stable for existing vineyard callers; add a separate market-facing creator instead of widening the existing public signature.
- Extend `BuyMarketOfferRow` with provenance, preview cache, and preview compatibility/version fields.
- Extend `WineBatch` with a market-origin snapshot field and source discriminator.
- Add explicit market processing-profile constants/types for crush and fermentation preview rules.

## Test Plan

- Shared builder tests:
  - vineyard harvest path still produces current harvest-equivalent batches
  - market provenance inputs produce a fully initialized grape-stage batch with anchors, characteristics, features, harvest triggers, taste quality, and pricing snapshots
- Market state tests:
  - `grapes`, `must_ready`, and `must_fermenting` offers each produce deterministic previews and purchased batches
  - purchased batch values match preview snapshot values for all three states
  - fermenting progress is deterministic from stored offer data
- Buy-market persistence tests:
  - offer generation writes provenance and preview snapshot
  - weekly decay regenerates the cached preview when quality/state-derived values change
  - stale or legacy offers without preview data are refreshed or replaced before use
- UI tests:
  - Buy Grapes modal renders terroir/source summary, characteristics, and feature/risk preview from offer snapshot
  - market-origin purchased batches render detail views without vineyard lookup failures
- Regression tests:
  - existing vineyard lifecycle and winery harvest tests remain green
  - existing buy-market transaction, quantity decrement, and supplier-cap behavior remain unchanged

## Assumptions

- `tasteProfile` remains computed on demand and is not persisted as a first-class batch field.
- Market offers use explicit fixed processing profiles for crush and fermentation rather than trying to simulate arbitrary supplier winery decisions.
- Market provenance inputs are the canonical source; cached previews are disposable derivatives.
- Market purchases remain discrete lots and are never merged through vineyard harvest combine rules.
- Market-origin detail UI shows snapshot-based origin/quality context rather than full vineyard factor recomputation.
