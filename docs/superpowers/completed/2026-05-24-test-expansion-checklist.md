# Test Expansion Checklist (From 2026-05-24 Audit)

Status: Historical/superseded for weather coverage as of 2026-07-11. The weather module redesign replaced the former weather-impact and Weather Center services and their tests; see `docs/superpowers/specs/2026-07-10-weather-module-redesign-design.md`. Non-weather checklist entries remain historical audit context only.

> Historical record only. References below to the former weather-impact service and Weather Center service do not describe current runtime or active test ownership.

Source: coverage gaps listed in `docs/superpowers/plans/2026-05-24-founder-economy-implementation-audit.md`.

## Priority A - Weather Impact Service
- [x] Add dedicated unit tests for weather impact coefficients, seasonal adjustment, and response labeling.
- [ ] Add clamp/boundary regression cases for extreme site-response conditions.
- [ ] Add deterministic fixtures for soil/aspect/altitude combinations used in balancing.

## Priority B - Buy Market Integration Depth
- [x] Extend tests for weekly buy-offer decay by state with persisted-row assertions.
- [x] Add purchase-side effect tests: inventory batch creation, transaction write, and market row update.
- [x] Add supplier seasonal-cap enforcement tests for partial/blocked purchases.

## Priority C - Weather Center Behavior
- [x] Add service-level tests for weather center row construction and summary aggregation.
- [x] Add page-level rendering tests for empty/loaded rows and key metric cards.

## Priority D - Research Unlock Regressions
- [x] Add regression tests for contract/channel unlock filtering from research unlocks.
- [x] Add regression tests for unlock-bound market breadth changes (buyer slots/countries/multipliers).

## Implementation Start (This Pass)
- Implemented now: Priority A first slice in tests/vineyard/weatherImpactService.test.ts.
- Implemented now: Priority B weekly decay slice in tests/sales/buyGrapeMarketDecay.test.ts.
- Implemented now: Priority B purchase-side + supplier-cap slices in tests/sales/buyGrapeMarketService.test.ts.
- Implemented now: Priority C weather center service + page rendering slices in tests/vineyard/weatherCenterService.test.ts and tests/vineyard/weatherCenterPage.test.ts.
- Implemented now: Priority D contract channel and buyer breadth unlock regressions in tests/sales/contractGenerationUnlocks.test.ts and tests/sales/grapeBuyerMarket.test.ts.
- Next recommended slice: Priority A clamp/boundary extremes and deterministic balancing fixtures.
