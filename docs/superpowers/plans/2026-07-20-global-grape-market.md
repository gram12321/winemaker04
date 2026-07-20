# Global Grape Market Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, globally listed grape lots with NPC-backed 70% immediate seller payout, shared buyer-to-seller relationships, and the same state-aware evolution rules as local grape offers.

**Architecture:** Keep the generic Buy Market source, counterparty, visibility, lifecycle, and quote contracts in the market layer. Put grape-specific snapshots, quality/fermentation projection, pricing, and fulfilment in a grape adapter. Local supplier rows and global grape lots both call the same pure projection function; local rows persist the weekly projection while global rows are projected on read for the viewer's game date.

**Tech Stack:** React, TypeScript, Supabase/Postgres RPCs, Vitest.

---

### Task 1: Define deterministic grape-lot lifecycle contracts

**Files:**
- Create: `src/lib/services/market/grapes/globalGrapeMarketLifecycleService.ts`
- Modify: `src/lib/services/sales/buyGrapeMarketService.ts`
- Modify: `src/lib/services/market/buyMarketLifecycleService.ts`
- Test: `tests/market/globalGrapeMarketLifecycle.test.ts`

- [ ] **Step 1: Write failing lifecycle tests** for equal projections at equal dates, state-aware quality decay, fermenting-progress advancement, and retirement at expiry or fermentation completion.
- [ ] **Step 2: Implement a pure projection function** taking a persisted grape snapshot, seed, listing date, and requested game date; return projected batch preview, remaining life, quality, fermentation progress, base value, and visibility.
- [ ] **Step 3: Refactor local grape weekly evolution** to call the same projector and persist its result.
- [ ] **Step 4: Run the lifecycle and existing grape-market tests.**

### Task 2: Persist global grape listings and atomic marketplace operations

**Files:**
- Create: `src/lib/database/market/globalGrapeMarketListingsDB.ts`
- Create: `migrations/<timestamp>_add_global_grape_market.sql`
- Modify: `src/lib/types/market.ts`
- Modify: `src/lib/database/admin/adminDB.ts`
- Test: `tests/market/globalGrapeMarketListings.test.ts`

- [ ] **Step 1: Write failing persistence/service tests** covering date visibility, partial quantities, listing retirement, seller provenance, and 70% payout calculation.
- [ ] **Step 2: Add clean-cutover schema and RPCs** for globally held grape lots/listings, deterministic NPC lot insertion, atomic company sell-back, atomic partial purchase, generic counterparty relationship progression, and grape/global-market admin clearing.
- [ ] **Step 3: Implement TypeScript database mapper and service-facing contracts.**
- [ ] **Step 4: Run focused database/market tests.**

### Task 3: Register global grape generation and market adapters

**Files:**
- Create: `src/lib/services/market/grapes/globalGrapeMarketSupplierService.ts`
- Create: `src/lib/services/market/grapes/globalGrapeMarketService.ts`
- Modify: `src/lib/services/market/buyMarketDomainRegistry.ts`
- Modify: `src/lib/services/market/globalMarketSupplierService.ts`
- Test: `tests/market/globalGrapeMarketAdapter.test.ts`

- [ ] **Step 1: Write failing adapter tests** for deterministic/idempotent seasonal NPC lot generation across grapes, must-ready, and fermenting states.
- [ ] **Step 2: Implement the TypeScript global supplier adapter** using stable seeds and the shared global lifecycle registration seam.
- [ ] **Step 3: Implement global-grape offer mapping and purchase dispatch** so global rows use the generic Buy Market contract but retain grape-specific allocation/fulfilment.
- [ ] **Step 4: Run focused adapter and registry tests.**

### Task 4: Add player global listing flow and Buy Market UI

**Files:**
- Modify: `src/lib/services/sales/sellGrapesService.ts`
- Modify: `src/lib/database/activities/inventoryDB.ts`
- Modify: `src/components/ui/sales/SellGrapesModal.tsx` (or current sale surface)
- Modify: `src/components/ui/market/GrapeMarketPanel.tsx`
- Test: `tests/sales/globalGrapeSellback.test.ts`
- Test: `tests/components/buyMarketPanels.test.ts`

- [ ] **Step 1: Write failing tests** for listed quantities from all sellable states, activity/allocation rejection, 70% immediate payout, and global-row display/purchase.
- [ ] **Step 2: Implement a service-level global-list command** separate from direct buyer sale; preserve direct buyers as an immediate-liquidity route.
- [ ] **Step 3: Add the player action and present global grape rows** with seller/source, projected state/quality/fermentation, shared relationship quote, and partial quantity control.
- [ ] **Step 4: Run focused sale and panel tests.**

### Task 5: Update documentation and verify the cutover

**Files:**
- Modify: `CONTEXT.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/WineSystem_VariableRelationshipMap.md`

- [ ] **Step 1: Document generic global listing responsibilities versus grape-adapter responsibilities.**
- [ ] **Step 2: Document the 70% NPC-guaranteed payout and deterministic viewer-date projection.**
- [ ] **Step 3: Run focused market/sales suites, `npx tsc --noEmit`, and `git diff --check`.**
- [ ] **Step 4: Run the required sanitation sweep for UI/business-logic, persistence-boundary, tuning-constant, and import hygiene issues.**
