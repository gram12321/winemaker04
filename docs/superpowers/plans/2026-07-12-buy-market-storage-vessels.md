# Buy Market and Storage Vessels Implementation Plan

Status: Active pending mainline implementation. Code-checked on 2026-07-14: current `main` still uses the grape-specific buy-market persistence/service path and has no Storage Vessel runtime. A separate development branch contains later storage-market work, but it is not part of this mainline review.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the grape-only buy flow with a real Buy Market module, preserve the existing Grape Procurement behaviour behind an adapter, and introduce individually owned casks as the first Storage Vessels market. A purchased vessel has a fixed capacity and persistent identity. Steel tanks, concrete tanks, containers, and later machinery must be addable without revisiting grape procurement or generic market persistence.

**Architecture:** The Buy Market module owns company-scoped offer persistence, availability claims, browsing, purchase coordination, and lifecycle dispatch. Grape Procurement and Storage Vessels are adapters at that seam: each owns its offer payload, generation, pricing, validation, presentation, and fulfilment. The Storage Vessels module owns individual vessel assets and future allocation/effect seams. Sell-side grape trading remains a separate module; only its inventory persistence leak is repaired.

**Tech Stack:** React, TypeScript, Supabase migrations/adapters, Vitest, existing finance, inventory, game-update, and tick modules.

---

## Confirmed domain decisions

- A Buy Market offer has a waregroup and can represent a finite number of purchasable units.
- Buying cask units creates the same number of individually owned Storage Vessel assets. Each asset has its own identity and a capacity fixed at purchase.
- Initial vessel facts are vessel type, material, capacity, purchase price, state, and provenance from the market offer.
- Casks are the first Storage Vessel variant. Steel tanks, concrete tanks, and containers are later variants of the same adapter.
- Storage Vessels will eventually influence taste, structure, price, vineyard operations, and winery operations. Those effects must be explicit, named, and player-explainable; this plan does not invent their formulas.
- Sell remains independent of Buy Market. The only sell work in scope is routing inventory persistence through `inventoryService` and adding regression coverage.

## Task 1: Define shared market and vessel concepts

**Files:**

- Create: `src/lib/types/market.ts`
- Create: `src/lib/types/storageVessels.ts`
- Modify: `src/lib/types/index.ts` or the current shared-type barrel
- Create: `src/lib/constants/buyMarketConstants.ts`
- Create: `src/lib/constants/storageVesselConstants.ts`
- Modify: `src/lib/constants/index.ts`
- Test: `tests/market/buyMarketContracts.test.ts`
- Test: `tests/wine/storageVesselContracts.test.ts`

- [ ] Define the common persisted Buy Market facts: company ownership, offer identity, waregroup, seller identity, available units, unit label, price, lifecycle dates, and adapter payload.
- [ ] Define the Storage Vessel facts: stable vessel identity, vessel type, material, fixed capacity and unit, acquisition price, state, and source offer identity.
- [ ] Put cask catalogue values and all future tuning in named constants. Do not hard-code price, capacity, material, or availability values in UI or orchestration modules.
- [ ] Decide and name the capacity unit and the later conversion policy required to compare it to `WineBatch.quantity`, which currently represents kg or bottles. Do not silently assume one kilogram equals one litre.
- [ ] Establish contract tests that prevent a generic offer from importing grape fields and prevent a vessel's capacity from being mutable after acquisition.

## Task 2: Replace grape-only offer persistence with Buy Market persistence

**Files:**

- Create: `migrations/<timestamp>_create_buy_market_and_storage_vessels.sql`
- Create: `src/lib/database/market/buyMarketOffersDB.ts`
- Create: `src/lib/database/winery/storageVesselsDB.ts`
- Modify: `src/lib/database/index.ts`
- Retire: `src/lib/database/sales/buyMarketOffersDB.ts`
- Test: `tests/market/buyMarketPersistence.test.ts`

- [ ] Create company-scoped `market_buy_offers` persistence with generic offer fields and a JSON payload owned by its adapter.
- [ ] Use a unique key suitable for multiple waregroups and add indexes for company, waregroup, active availability, and expiry queries.
- [ ] Create company-scoped Storage Vessel persistence with one row per owned vessel, immutable capacity, and durable source-offer provenance.
- [ ] Add RLS policies consistent with the existing company-scoped market tables.
- [ ] Migrate every `grape_market_buy_offers` row into `market_buy_offers`, preserving the grape offer identity, supplier values, lifecycle fields, price, provenance snapshot, and preview snapshot in the grape payload.
- [ ] Add a guarded database availability-claim operation so an offer cannot be oversold. It must be used by purchase orchestration, not by UI code.
- [ ] Switch runtime reads and writes directly to the new module; do not retain a legacy-table fallback or compatibility export.
- [ ] Drop the obsolete grape-only table only after migration copy and expected-row verification are part of the migration.

## Task 3: Build the Buy Market module and migrate Grape Procurement

**Files:**

- Create: `src/lib/services/market/buyMarketService.ts`
- Create: `src/lib/services/market/buyMarketLifecycleService.ts`
- Create: `src/lib/services/market/grapes/grapeProcurementAdapter.ts`
- Create: `src/lib/services/market/grapes/grapeMarketPresentation.ts`
- Modify: `src/lib/services/sales/buyGrapeMarketService.ts` or retire it after callers move
- Modify: `src/lib/services/index.ts`
- Modify: `src/lib/services/core/gameTick.ts`
- Modify: `tests/sales/buyGrapeMarketService.test.ts`
- Modify: `tests/sales/buyGrapeMarketDecay.test.ts`
- Create: `tests/market/buyMarketLifecycle.test.ts`

- [ ] Make the Buy Market module the caller-facing seam for loading offers, claiming units, coordinating purchases, emitting updates, and dispatching weekly/seasonal lifecycle work.
- [ ] Move grape-specific offer generation, trusted carry-over, supplier capacity, quality decay, preview construction, pricing, and inventory-batch fulfilment behind the Grape Procurement adapter.
- [ ] Preserve present grape behaviour exactly: grapes, `must_ready`, and `must_fermenting` offers; state-sensitive decay; supplier trust; preview snapshots; finance transaction; inventory creation; notification; and global update topics.
- [ ] Keep Grape Procurement constants and wine-feature valuation out of generic market modules.
- [ ] Replace grape-specific tick calls with one Buy Market lifecycle call. The lifecycle module delegates to registered adapters; `gameTick.ts` remains thin.
- [ ] Port existing grape tests to the new public seam and add parity assertions for purchase, expiry, seasonal refresh, and weekly decay.

## Task 4: Implement Storage Vessels and the cask adapter

**Files:**

- Create: `src/lib/services/wine/winery/storageVesselService.ts`
- Create: `src/lib/services/market/storageVessels/storageVesselMarketAdapter.ts`
- Create: `src/lib/services/market/storageVessels/caskOfferGenerator.ts`
- Create: `src/lib/services/market/storageVessels/storageVesselPresentation.ts`
- Modify: `src/lib/services/index.ts`
- Modify: `src/lib/services/core/gameTick.ts` only through the Buy Market lifecycle seam
- Test: `tests/wine/storageVesselService.test.ts`
- Test: `tests/market/storageVesselMarketAdapter.test.ts`

- [ ] Create the Storage Vessels module as the sole owner of vessel creation, reads, state changes, and future allocations.
- [ ] Add cask offer generation and pricing through the Storage Vessels adapter. Offers expose the vessel material, fixed capacity, per-vessel price, seller context, and available units.
- [ ] Fulfil a cask purchase by creating one persisted vessel for each purchased unit, then recording the market finance transaction and notification.
- [ ] Preserve the source-offer identifier and acquisition price on every created vessel for future history, valuation, and player explanation.
- [ ] Make cask offer lifecycle explicit (always-available, seasonal, or a defined hybrid) in the adapter and constants; it must not inherit grape decay or supplier-loyalty rules.
- [ ] Add service tests for one and many cask purchases, exhausted availability, insufficient funds, immutable capacity, generated asset identity, and transaction/notification side effects.

## Task 5: Build a generic Buy Market surface and a Winery vessel inventory surface

**Files:**

- Create: `src/components/ui/market/BuyMarketModal.tsx`
- Create: `src/components/ui/market/BuyMarketQuantityAction.tsx` or generalize `MarketQuickBuyRowAction.tsx`
- Create: `src/components/ui/wine/StorageVesselInventory.tsx`
- Create: `src/components/ui/market/grapes/GrapeMarketOfferDetails.tsx`
- Create: `src/components/ui/market/storageVessels/StorageVesselOfferDetails.tsx`
- Modify: `src/components/ui/market/MarketWindow.tsx` or remove it after the deletion test
- Modify: `src/components/ui/index.ts`
- Modify: `src/components/pages/Winery.tsx`
- Retire: `src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx`
- Test: relevant UI/component tests or focused service-backed modal tests

- [ ] Present Grapes and Casks as active waregroups in one Buy Market surface. The modal shell owns loading, selection, generic errors, confirmation, and row updates.
- [ ] Move grape-specific filters, supplier-trust panel, feature signals, price explanation, state labels, and kg wording into the Grape Procurement presentation adapter.
- [ ] Present cask material, capacity, price per vessel, availability, and the number of individual vessels created by the selected purchase.
- [ ] Generalize quantity controls so they use the adapter's unit label rather than hard-coded kilograms.
- [ ] Add a Winery Storage Vessels inventory surface that lists the individual assets a company owns, including their fixed capacity and current state.
- [ ] Keep UI modules presentation-oriented: no direct database imports, price formulas, lifecycle policy, or asset creation in React code.

## Task 6: Add assignment-ready operation seams without premature wine effects

**Files:**

- Create: `src/lib/services/wine/winery/storageVesselAllocationService.ts`
- Create: `src/lib/services/wine/winery/storageVesselEffectService.ts`
- Create: `src/lib/constants/storageVesselEffectConstants.ts` only when an effect is approved
- Modify: shared types only if an approved allocation record requires it
- Test: `tests/wine/storageVesselAllocationService.test.ts`

- [ ] Define an explicit assignment/allocation seam between a Storage Vessel and winery/vineyard operations. It must be capable of checking capacity once the named conversion policy exists.
- [ ] Keep allocations separate from `WineBatch` until the cardinality and capacity policy are approved; do not add an opaque `vesselId` shortcut that cannot represent later splitting, blending, or multiple allocations.
- [ ] Create a no-op effect facade with a stable, service-owned call point for future taste, structure, price, vineyard-operation, and winery-operation effects.
- [ ] Do not alter `wineScore`, `structureIndex`, `tasteQualityIndex`, estimated price, vineyard yield, or operation work in this plan. Future effects must be explicit constants and visible explanations, not hidden multiplier branches.
- [ ] Add tests proving that unassigned vessels and the no-op facade do not change current wine or operation behaviour.

## Task 7: Repair the sell inventory seam and cover the existing flow

**Files:**

- Modify: `src/lib/services/wine/winery/inventoryService.ts`
- Modify: `src/lib/services/sales/sellGrapesService.ts`
- Create: `tests/sales/sellGrapesService.test.ts`

- [ ] Add an inventory-service deletion operation and route sell-side batch read, update, and deletion through `inventoryService`.
- [ ] Preserve existing Sell Grapes UI, buyer selection, buyer loyalty, cooperative rules, market pricing, and notifications.
- [ ] Add regression tests for full and partial sale, invalid state, exhausted buyer capacity, transaction output, buyer-loyalty updates, and inventory updates.

## Task 8: Documentation, verification, and sanitation

**Files:**

- Modify: `CONTEXT.md`
- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `docs/WineSystem_VariableRelationshipMap.md`
- Modify: `readme.md`
- Test: market, sales, wine, and core tick suites

- [ ] Document Buy Market ownership, Grape Procurement and Storage Vessels adapters, individual fixed-capacity vessel assets, and the deliberately deferred effect rules.
- [ ] Update the relationship map so Storage Vessels are shown as future explicit inputs to wine and operations rather than hidden score modifiers.
- [ ] Search for stale grape-only Buy Market names across `src`, `tests`, and docs; remove obsolete imports, exports, and documentation.
- [ ] Run targeted Buy Market, grape, Storage Vessel, sell, inventory, and tick tests, then the full test suite and production build as appropriate for this cross-cutting change.
- [ ] Run `git diff --check`.
- [ ] Run the required architecture sanitation sweep: UI business logic, persistence outside database modules, hard-coded tuning, and barrel/import hygiene.

## Deliberate non-goals

- No unification of sell-side grape trading with Buy Market.
- No cask effect formula for taste, structure, price, vineyard operations, or winery operations before an explicit follow-up design approves it.
- No implicit capacity conversion between WineBatch kg/bottles and vessel capacity.
- No machinery implementation; machinery is a later Buy Market adapter.
- No legacy runtime compatibility reads from `grape_market_buy_offers` after migration.

## Acceptance criteria

- Existing grape procurement has unchanged gameplay outcomes through the new Buy Market seam.
- The Buy Market can browse and purchase both Grape Procurement and Cask offers.
- Each purchased cask creates an individual, company-owned Storage Vessel with immutable fixed capacity and recorded acquisition data.
- Generic market persistence contains no grape-specific columns outside adapter payloads.
- Current wine scores, taste, structure, pricing, vineyard operations, and winery operations remain unchanged until a later explicit vessel-effect implementation.
- Sell Grapes remains behaviourally unchanged while using the inventory-service seam and receiving regression coverage.
