# Bulk Grape Buy Market Implementation Plan

Status: Completed with minor implementation-shape deviations. Code-verified on 2026-05-25 and moved to `docs/superpowers/completed/`.

Completion notes:
- Buy-offer persistence, service lifecycle, Winery entry, purchase flow, weekly decay, seasonal refresh, and focused tests are implemented.
- The generic market table/action pieces exist, but `BuyFromMarketModal` uses dialog primitives directly instead of the `MarketWindow` wrapper.
- Sell-side multi-state grape sales were implemented after this plan, so deferred sell-side notes are historical.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Winery-first Buy from Market flow for grape-state offers (grapes, must, must_fermenting) using a reusable generic market UI shell and shared market volatility behavior.

**Architecture:** Keep market economics in sales services, keep Supabase persistence in database modules, and keep UI in reusable market components plus a Winery adapter. Integrate weekly decay and seasonal refresh through `gameTick` service hooks while keeping the tick file thin.

**Tech Stack:** React, TypeScript, existing shadCN UI components, Supabase DB layer, Vitest.

---

## File Structure

- Create: `src/lib/database/sales/buyMarketOffersDB.ts`
- Create: `src/lib/services/sales/buyGrapeMarketService.ts`
- Create: `src/components/ui/market/MarketWindow.tsx`
- Create: `src/components/ui/market/MarketOfferTable.tsx`
- Create: `src/components/ui/market/MarketQuickBuyRowAction.tsx`
- Create: `src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx`
- Create: `tests/sales/buyGrapeMarketService.test.ts`
- Modify: `src/components/ui/index.ts`
- Modify: `src/components/pages/Winery.tsx`
- Modify: `src/components/pages/Sales.tsx`
- Modify: `src/components/pages/sales/WineCellarTab.tsx`
- Modify: `src/lib/services/core/gameTick.ts`
- Modify: `src/lib/services/index.ts`

---

### Task 1: Add Buy-Market Offer Persistence Layer

**Files:**
- Create: `src/lib/database/sales/buyMarketOffersDB.ts`

- [ ] **Step 1: Define offer row contract**

```ts
export interface BuyMarketOfferRow {
  company_id: string;
  offer_id: string;
  ware_group: 'grapes';
  supplier_id: string;
  supplier_name: string;
  origin_tag: 'trusted_carryover' | 'seasonal_rotation' | 'country_special';
  batch_state: 'grapes' | 'must_ready' | 'must_fermenting';
  grape_variety: GrapeVariety;
  available_kg: number;
  quality_score: number;
  base_price_per_kg: number;
  effective_price_per_kg: number;
  weeks_on_market: number;
  quality_decay_per_week: number;
  min_quality_floor: number;
  is_persistent: boolean;
  created_year: number;
  created_season: Season;
  created_week: number;
  last_refreshed_year: number;
  last_refreshed_season: Season;
  last_refreshed_week: number;
}
```

- [ ] **Step 2: Implement CRUD helpers**

```ts
export const getCompanyBuyOffers = async (companyId: string) => { /* select */ };
export const upsertBuyOffer = async (row: BuyMarketOfferRow) => { /* upsert */ };
export const upsertBuyOffersBulk = async (rows: BuyMarketOfferRow[]) => { /* bulk upsert */ };
export const updateBuyOffer = async (companyId: string, offerId: string, updates: Partial<BuyMarketOfferRow>) => { /* update */ };
export const deleteBuyOffer = async (companyId: string, offerId: string) => { /* delete */ };
```

- [ ] **Step 3: Verify TypeScript compile for new module**

Run: `npm test -- tests/sales/grapeBuyerMarket.test.ts`
Expected: Existing sales tests still pass.

### Task 2: Implement Buy-Market Service Core

**Files:**
- Create: `src/lib/services/sales/buyGrapeMarketService.ts`
- Modify: `src/lib/services/index.ts`

- [ ] **Step 1: Define service types and constants**

```ts
export type BuyOfferBatchState = 'grapes' | 'must_ready' | 'must_fermenting';
export interface BuyGrapeMarketOffer { /* ui-facing model */ }
export const BUY_MARKET_FIXED_SPREAD = 0.22;
export const STATE_PREMIUMS = { grapes: 1.0, must_ready: 1.12, must_fermenting: 1.2 } as const;
export const STATE_QUALITY_DECAY_PER_WEEK = { grapes: 0.012, must_ready: 0.008, must_fermenting: 0.005 } as const;
```

- [ ] **Step 2: Reuse existing market demand context**

```ts
import {
  BUYER_SEASON_PRICE_MULTIPLIERS,
  BUYER_ECONOMY_PRICE_MULTIPLIERS,
} from './grapeBuyerMarketService';
```

- [ ] **Step 3: Implement pricing composition**

```ts
export function computeBuyOfferPricePerKg(input: PriceInput): number {
  const mirrored = input.basePrice * input.qualityMultiplier * input.seasonMultiplier * input.economyMultiplier * input.yearCycleMultiplier * input.volatilityMultiplier;
  const withState = mirrored * input.statePremium;
  return clamp(withState * (1 + BUY_MARKET_FIXED_SPREAD), input.minClamp, input.maxClamp);
}
```

- [ ] **Step 4: Implement lifecycle entry points**

```ts
export async function getBuyGrapeMarketOffers(): Promise<BuyGrapeMarketOffer[]> { /* load/generate */ }
export async function refreshBuyGrapeMarketForSeason(): Promise<void> { /* rotate + carry-over */ }
export async function processWeeklyBuyGrapeOfferDecay(): Promise<void> { /* state-aware decay */ }
export async function purchaseBuyGrapeOffer(offerId: string, quantityKg: number): Promise<{ success: boolean; error?: string }> { /* purchase */ }
```

- [ ] **Step 5: Export service via barrel**

```ts
export * from './sales/buyGrapeMarketService';
```

- [ ] **Step 6: Verify service-level tests (new + existing)**

Run: `npm test -- tests/sales/grapeBuyerMarket.test.ts tests/sales/buyGrapeMarketService.test.ts`
Expected: Both suites pass.

### Task 3: Add Buy-Market Service Tests

**Files:**
- Create: `tests/sales/buyGrapeMarketService.test.ts`

- [ ] **Step 1: Add pricing parity + spread test**

```ts
it('applies fixed spread above mirrored baseline', () => {
  const value = computeBuyOfferPricePerKg(/* deterministic input */);
  expect(value).toBeGreaterThan(mirroredBaseline);
});
```

- [ ] **Step 2: Add decay-by-state test**

```ts
it('decays grapes faster than must and fermenting', async () => {
  // setup rows for three states
  // run weekly decay
  // assert grapes quality delta > must_ready > must_fermenting
});
```

- [ ] **Step 3: Add purchase writes-inventory-state test**

```ts
it('creates purchased inventory batch in offer state', async () => {
  const result = await purchaseBuyGrapeOffer('offer-1', 200);
  expect(result.success).toBe(true);
  expect(savedBatch.state).toBe('must_ready');
});
```

- [ ] **Step 4: Run test file**

Run: `npm test -- tests/sales/buyGrapeMarketService.test.ts`
Expected: PASS.

### Task 4: Build Generic Market UI Shell

**Files:**
- Create: `src/components/ui/market/MarketWindow.tsx`
- Create: `src/components/ui/market/MarketOfferTable.tsx`
- Create: `src/components/ui/market/MarketQuickBuyRowAction.tsx`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Create generic market window wrapper**

```tsx
export const MarketWindow: React.FC<MarketWindowProps> = ({ isOpen, onClose, title, children }) => (
  <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-6xl">
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
);
```

- [ ] **Step 2: Create generic offer table component**

```tsx
export interface MarketOfferTableColumn<T> { key: string; header: string; render: (row: T) => React.ReactNode; }
export function MarketOfferTable<T>({ rows, columns }: MarketOfferTableProps<T>) { /* table render */ }
```

- [ ] **Step 3: Create reusable quick-buy row action**

```tsx
export const MarketQuickBuyRowAction: React.FC<Props> = ({ maxQuantity, onBuy }) => {
  // inline input + buy button + inline validation
};
```

- [ ] **Step 4: Export components in UI barrel**

```ts
export { MarketWindow } from './market/MarketWindow';
export { MarketOfferTable } from './market/MarketOfferTable';
export { MarketQuickBuyRowAction } from './market/MarketQuickBuyRowAction';
```

### Task 5: Add Winery Buy-From-Market Modal (Grape Adapter)

**Files:**
- Create: `src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Create modal that maps grape offers to generic table rows**

```tsx
const offers = useGameStateWithData(() => getBuyGrapeMarketOffers(), [], { topic: 'wine_batches' });
```

- [ ] **Step 2: Wire inline quick-buy action**

```tsx
const handleBuy = async (offerId: string, quantityKg: number) => {
  const result = await purchaseBuyGrapeOffer(offerId, quantityKg);
  if (!result.success) setRowError(offerId, result.error || 'Purchase failed');
};
```

- [ ] **Step 3: Keep optional compact details panel**

```tsx
<Button variant="ghost" size="sm" onClick={() => setExpandedOfferId(offer.id)}>Details</Button>
```

- [ ] **Step 4: Export modal in UI barrel**

```ts
export { default as BuyFromMarketModal } from './modals/activitymodals/BuyFromMarketModal';
```

### Task 6: Integrate Winery and Simplify Sales

**Files:**
- Modify: `src/components/pages/Winery.tsx`
- Modify: `src/components/pages/Sales.tsx`
- Modify: `src/components/pages/sales/WineCellarTab.tsx`

- [ ] **Step 1: Add Buy Grapes button in Winery page header/action area**

```tsx
<Button onClick={() => setShowBuyMarket(true)} variant="outline" className="text-emerald-700 border-emerald-700">Buy Grapes</Button>
```

- [ ] **Step 2: Mount BuyFromMarketModal in Winery**

```tsx
<BuyFromMarketModal isOpen={showBuyMarket} onClose={() => setShowBuyMarket(false)} />
```

- [ ] **Step 3: Remove grape-selling entry from Sales page and cellar tab props**

```tsx
// Remove onSellGrapesClick prop threading from Sales -> WineCellarTab
```

- [ ] **Step 4: Ensure Sales stays bottled-wine-centric**

Run: `npm test -- tests/sales/*.test.ts`
Expected: sales tests pass and TypeScript stays clean.

### Task 7: Hook Weekly/Seasonal Buy-Market Processing

**Files:**
- Modify: `src/lib/services/core/gameTick.ts`

- [ ] **Step 1: Add weekly decay service call in weekly task list**

```ts
await processWeeklyBuyGrapeOfferDecay();
```

- [ ] **Step 2: Add season refresh call on season transition**

```ts
await refreshBuyGrapeMarketForSeason();
```

- [ ] **Step 3: Keep tick resilient with try/catch wrappers**

```ts
try { await processWeeklyBuyGrapeOfferDecay(); } catch (error) { console.warn(...); }
```

### Task 8: End-to-End Verification

**Files:**
- Test: `tests/sales/buyGrapeMarketService.test.ts`
- Test: `tests/sales/grapeBuyerMarket.test.ts`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/sales/buyGrapeMarketService.test.ts tests/sales/grapeBuyerMarket.test.ts`
Expected: PASS.

- [ ] **Step 2: Run broader regression for touched area**

Run: `npm test -- tests/sales/*.test.ts`
Expected: PASS.

- [ ] **Step 3: Run build check**

Run: `npm run build`
Expected: successful production build.

- [ ] **Step 4: Manual smoke checks**

- Winery page shows Buy Grapes button.
- Buy from Market modal opens and lists offers.
- Inline buy updates available kg and creates inventory batch in offered state.
- Sales page no longer presents grape-selling entry points.

---

## Acceptance Criteria

- Winery contains a Buy Grapes entry that opens Buy from Market.
- Buy offers exist for grapes, must_ready, and must_fermenting states.
- Buy pricing uses shared market drivers and a fixed positive spread over mirrored baseline.
- Weekly state-aware quality decay is applied to persisted offers.
- Trusted supplier carry-over behavior exists at seasonal refresh.
- Purchase flow creates normal inventory batches in the offer state.
- Sales page no longer serves as a grape-selling entry surface.

---

## Deferred (Explicit)

- Sell-side expansion to must_ready and must_fermenting states.
- Top-level Market navigation.
- Non-grape waregroup implementation.
