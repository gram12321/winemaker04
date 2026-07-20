# Generic Buy Market Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make grapes and storage vessels expose one generic Buy Market offer/source/relationship contract while retaining domain-specific pricing, lifecycle, and fulfilment.

**Architecture:** Keep local catalogue persistence and global vessel-asset persistence as separate internal mechanisms. Add a shared market read model and adapter contract that normalizes source, seller, lifecycle, quote, and purchase dispatch. Move grape naming and relationship terminology behind the generic contract; leave grape preview/decay and vessel transfer/condition logic in their adapters.

**Tech Stack:** React, TypeScript, Supabase adapters/RPCs, Vitest.

---

### Task 1: Shared offer and adapter contracts

**Files:**
- Modify: `src/lib/types/market.ts`
- Modify: `src/lib/services/market/buyMarketDomainRegistry.ts`
- Modify: `src/lib/services/market/buyMarketService.ts`
- Modify: `src/lib/services/market/buyMarketOfferSource.ts`
- Test: `tests/market/` relevant market contract tests

- [x] Add a generic offer view contract containing source, seller, unit, quantity, lifecycle dates, base/effective quote, relationship, payload, and purchase mode.
- [x] Extend domain adapters with `getOffers`, optional global generation/lifecycle hooks, and domain purchase input while preserving adapter-owned pricing.
- [x] Add domain-explicit purchase dispatch so global assets do not require a local catalogue row.
- [x] Normalize source labels and relationship terminology to `local_supplier` / `global_market` and `counterparty`.
- [x] Add contract tests for local and global source classification.

### Task 2: Normalize grape adapter

**Files:**
- Modify: `src/lib/services/sales/buyGrapeMarketService.ts`
- Modify: `src/lib/services/market/grapes/grapeMarketOfferPersistence.ts`
- Modify: `src/lib/services/sales/grapeSupplierLoyaltyService.ts`
- Modify: `src/lib/types/market.ts`
- Test: grape market tests

- [x] Expose grape offers through the shared offer view with a stable counterparty and local-supplier source.
- [ ] Replace public `supplierLoyalty`/supplier-only naming with generic counterparty relationship fields while retaining narrow internal aliases only where needed during the same cutover.
- [ ] Keep weekly quality decay, preview regeneration, feature/risk projection, seasonal persistence, and grape-specific pricing unchanged inside the adapter.
- [x] Make source filtering explicit so global grape rows can be added later without returning an artificial empty branch.
- [ ] Verify purchase still passes storage-vessel allocation input and preserves atomic grape fulfilment.

### Task 3: Normalize storage-vessel adapter

**Files:**
- Modify: `src/lib/services/market/storageVessels/storageVesselMarketAdapter.ts`
- Modify: `src/lib/services/market/storageVessels/usedStorageVesselMarketService.ts`
- Modify: `src/lib/services/market/globalMarketSupplierService.ts`
- Test: storage-vessel market tests

- [x] Expose local supplier rows and global listings through the same shared offer view.
- [ ] Preserve vessel-specific condition projection, canonical ownership transfer, sell-back, NPC custody, and single-unit semantics.
- [x] Route global generation through a reusable generic global supplier contract while keeping TypeScript vessel naming and tuning in the vessel adapter.
- [ ] Keep vessel price calculation domain-specific, applying generic counterparty terms after the vessel base value.
- [ ] Verify local quantity purchase and global asset purchase both dispatch through the common market service.

### Task 4: Shared Buy Market modal presentation

**Files:**
- Modify: `src/components/ui/market/BuyMarketModal.tsx`
- Modify: `src/components/ui/market/GrapeMarketPanel.tsx`
- Modify: `src/components/ui/market/StorageVesselMarketPanel.tsx`
- Modify: `src/components/ui/market/BuyMarketCounterpartyPanel.tsx`
- Modify: `src/components/ui/market/MarketOfferTable.tsx`
- Test: market UI tests

- [x] Render source, seller, relationship, quantity/unit, and quote consistently for both domains.
- [ ] Keep grape-specific preview/features/storage-vessel selection and vessel-specific asset details as panel extensions.
- [x] Remove grape’s hard-coded empty global branch and make filtering consume offer source metadata.
- [ ] Keep one-unit global assets as fixed quantity while preserving multi-unit local sliders.
- [ ] Verify all modal source filters, relationship summaries, purchase actions, and empty states.

### Task 5: Persistence and documentation alignment

**Files:**
- Modify: `src/lib/database/market/buyMarketOffersDB.ts`
- Modify: relevant global listing database adapters
- Modify: `CONTEXT.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `docs/WineSystem_VariableRelationshipMap.md`

- [x] Ensure persistence adapters remain behind database modules and the generic read model does not leak Supabase rows into UI.
- [x] Document that local catalogue and global asset stores are intentionally separate behind one market contract.
- [ ] Document that grapes currently have local stock only, while the generic global adapter seam is ready for future grape lots.
- [ ] Remove obsolete supplier-only public terminology and stale claims that imply separate buyer relationship systems.

### Task 6: Verification

- [x] Run focused grape/vessel market tests.
- [x] Run `npx tsc --noEmit`.
- [x] Run `git diff --check`.
- [ ] Run the repository architecture/sanitation sweep for UI business logic, persistence leakage, hardcoded tuning, and import hygiene.
