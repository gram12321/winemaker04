# Generic Buy Goods Suppliers Implementation Plan

**Status:** Implemented. Rechecked on 2026-07-17; this document is retained as a historical implementation record.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed storage-vessel catalogue offers with supplier-generated cask offers and migrate grape procurement onto shared Buy Goods supplier, pricing, scaling, and offer-lifecycle mechanics.

**Architecture:** `market_buy_offers` remains the generic offer ledger. A new Buy Goods layer owns supplier relations keyed by goods domain, common company/prestige scaling, price composition, and rotating-offer helpers. Grape and Storage Vessel adapters own only their supplier pools, payload generation, domain pricing inputs, and fulfillment.

**Tech Stack:** React, TypeScript, Supabase/Postgres, Vitest.

---

### Task 1: Generic supplier relationship persistence

**Files:** migrations; `src/lib/database/market/`; `src/lib/services/market/buyGoods/`; grape relationship call sites.

- [ ] Rename the grape-only supplier loyalty table to a generic Buy Goods supplier relationship table and add the goods-domain key.
- [ ] Move relationship records, trust calculation, price multiplier, and purchase recording to the generic service. Use `unitsPurchased`, not kilograms, in its public contract.
- [ ] Update grapes to use domain `grapes`; casks use domain `storage_vessels`.
- [ ] Add focused tests for domain isolation and relationship price discounts.

### Task 2: Generic offer scaling and price composition

**Files:** `src/lib/services/market/buyGoods/`, market constants, grape price service/tests.

- [ ] Extract company-value/prestige availability scaling and common price composition into shared functions.
- [ ] Preserve grape-specific state, preview, and market-demand factors as adapter-provided multipliers.
- [ ] Support cask size, quality, and supplier-relationship multipliers without grape concepts.
- [ ] Verify higher quality/size has a higher cask price and a stronger relationship reduces it.

### Task 3: Cask supplier offers

**Files:** storage-vessel constants, `src/lib/services/market/storageVessels/`, storage-vessel market adapter/tests.

- [ ] Replace the static cask catalogue with cask-only supplier profiles and rotating offers.
- [ ] Generate 250 L, 500 L, and 1,000 L casks with deterministic 0-1 quality and company/prestige-scaled availability.
- [ ] Persist offers in `market_buy_offers`; record a supplier-domain purchase after fulfillment.
- [ ] Preserve the current individual-vessel fulfillment and modal-close behavior.

### Task 4: Shared Buy Market lifecycle and UI

**Files:** market lifecycle/service, cask modal, docs/tests.

- [ ] Refresh grape and cask offers through shared lifecycle entry points; keep grape decay adapter-specific.
- [ ] Show cask supplier relationship and quality/size price factors in the cask market UI.
- [ ] Remove fixed-catalogue language and constants.
- [ ] Update game docs, run focused tests, TypeScript, and diff checks.
