# Phase 2 Readiness: Early-Balance Volatility to Weather Expansion
**Date:** 2026-05-23  
**Status:** Ready for implementation planning

## 1. Purpose and Lineage
This document is the continuation of the early balance work, not a separate track.

Primary source lineage:
- `docs/superpowers/plans/2026-05-20-early-game-balance-founder-economy.md`
  - Section 9 (`Bulk Grape Sales Status`)
  - The volatility and market-behavior iteration around bulk grape sales

This spec documents:
- what has already been shipped in the volatility-focused slice
- how weather was introduced to support that slice
- what Phase 2 should implement next

## 2. What We Actually Did (Volatility-Centered)

### 2.1 Early-Balance Context
Work started from early-game cashflow/bankruptcy pressure and the need for stronger Year 1 survival channels.

Main shipped path:
- bulk grape sales and dynamic buyer market
- buyer loyalty and seasonal demand caps
- richer buyer metadata and market explanation

### 2.2 Volatility Model Evolution
The key focus was to move from flat/static multipliers toward explainable macro volatility.

Current volatility stack in the sell-side grape buyer market is deterministic and season-static:
- season pressure
- economy pressure
- weather pressure (state + intensity)
- sentiment shock
- year-cycle multiplier

Then buyer-specific response is applied using existing metadata:
- `buyerCategory`
- `dealStyle`
- `originTag`

This means volatility is both macro-driven and buyer-sensitive.

### 2.3 Weather Was Added to Support Volatility (and Future Systems)
Weather was introduced as a top-level mechanic because it was already planned for:
- ripeness growth
- vineyard health
- taste/anchor channels

The implemented Weather model:
- seasonal forecast (pattern + confidence)
- weekly realized weather
- week-ahead forecast
- mostly reliable forecast behavior with occasional misses

Weather now contributes directly to market volatility as a real causal driver, not only abstract randomness.

## 3. Current Implemented Scope Snapshot

### 3.1 Core Systems Now Active
- top-level weather runtime state and weekly updates
- deterministic weather generation service
- weather integration in grape buyer volatility
- buyer sensitivity layer from category/style/origin metadata
- economy + weather + volatility documentation in Winepedia
- weather topbar badge linked to Winepedia weather tab

### 3.2 UI/Explanation Status
- volatility is surfaced in modal-level context instead of repeated per-buyer tooltip noise
- reason text is present (price outlook and demand outlook)
- economy and weather impacts are now documented in Winepedia tabs

## 4. Clarification: Volatility vs Seasonal Demand
To avoid ambiguity from prior wording, current status is:

- Seasonal demand model: implemented
  - season multipliers
  - economy multipliers
  - year-cycle influence
  - company scaling and relationship/research influences

- Volatility model: implemented
  - deterministic seasonal macro pressure
  - weather contribution
  - sentiment shock
  - buyer sensitivity response

- Optional future layer (not required now):
  - explicit handcrafted global event cards/shocks

## 5. Phase 2 Objective (Next)
Phase 2 should extend the same Weather framework into agriculture outcomes.

Primary objective:
- apply weather to vineyard health and ripeness progression

Design intent:
- keep the volatility architecture coherent across market and farming systems
- preserve explainability and determinism

## 6. Phase 2 Design Direction

### 6.1 Target Domains
- vineyard health update logic
- ripeness progression logic
- weekly tick flow where weather is already available
- player-facing explanation surfaces for weather contribution

### 6.2 Effect Model Principles
- season remains climate baseline
- weather acts as bounded weekly deviation around baseline
- state and intensity jointly define impact strength
- clamp all modifiers to safe ranges

Example direction:
- severe heat/storm weeks increase stress and suppress health gains
- mild clear periods stabilize or slightly improve growth consistency
- frost/snow in sensitive windows reduce ripeness momentum more strongly

### 6.3 Guardrails
- avoid season/weather double counting
- avoid runaway compounding from stacked multipliers
- keep deterministic behavior for reproducibility and balancing

## 7. Verification Requirements Before Closing Phase 2
- deterministic replay check with same company/year/season/week context
- multi-season balance check (no collapse/exploit trends)
- regression check to ensure current grape-market volatility behavior remains intact
- UI check that weather reasons remain concise and non-duplicated
- build and targeted tests pass

Suggested tests:
- unit tests for weather-to-health and weather-to-ripeness modifiers
- integration test for weekly tick applying weather effects
- table-driven tests for severe states (Frost/Heat/Storm)

## 8. Recommended Implementation Sequence
1. Define weather-to-health and weather-to-ripeness modifier tables/helpers.
2. Integrate modifiers into weekly simulation with strict clamping.
3. Add concise reason payloads where values change.
4. Update Winepedia Weather tab with agriculture impact explanations.
5. Run deterministic and balance verification.
6. Tune constants.

## 9. Out of Scope for Phase 2
- taste/anchor weather channels (Phase 3)
- forecast-confidence-altering research upgrades (Phase 4)
- broad economy-system rewrites unrelated to weather-agriculture coupling

## 10. Summary
This project segment came from early-game balance work and became a volatility-first market iteration. Weather was introduced to make volatility causal, consistent, and reusable. Phase 2 should now capitalize on that foundation by applying weather to vineyard health and ripeness with the same deterministic, explainable approach.