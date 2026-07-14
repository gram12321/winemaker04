# Narrow Service Boundary Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove obsolete compatibility shims and tighten a small set of obvious service-to-database leaks without attempting a repo-wide architecture rewrite.

**Architecture:** Keep `*DB.ts` files as CRUD-only persistence modules and keep services as orchestration/domain logic. This pass removes unused or test-only compatibility APIs, moves a few inventory persistence calls behind `inventoryService`, and updates docs so the written boundary matches the actual codebase direction.

**Tech Stack:** TypeScript, Vitest, Vite, Supabase persistence modules

---

## File Structure

- Modify: `src/lib/services/vineyard/vineyardService.ts`
  - Remove the unused `plantVineyard()` compatibility wrapper.
- Modify: `src/lib/services/finance/financeService.ts`
  - Remove the unused `calculateNetWorth` alias export.
- Modify: `src/lib/services/wine/winery/inventoryService.ts`
  - Add explicit inventory persistence/read helpers so higher-level sales services do not need to import `inventoryDB` directly.
- Modify: `src/lib/services/sales/buyGrapeMarketService.ts`
  - Replace direct inventory DB persistence with `inventoryService` seams and remove the `BUY_MARKET_FIXED_SPREAD` compatibility re-export.
- Modify: `src/lib/services/sales/salesService.ts`
  - Replace direct inventory DB reads/writes with `inventoryService` seams.
- Modify: `src/lib/services/sales/contractService.ts`
  - Replace direct inventory DB reads/writes with `inventoryService` seams.
- Modify: `tests/sales/buyGrapeMarketService.test.ts`
  - Import `BUY_MARKET_FIXED_SPREAD` from constants instead of the service shim.
- Modify: `tests/sales/grapeBuyerMarket.test.ts`
  - Import buyer-market constants from constants instead of the service shim.
- Modify: `src/lib/services/sales/grapeBuyerMarketService.ts`
  - Remove constant compatibility re-exports after tests no longer depend on them.
- Modify: `docs/PROJECT_INFO.md`
  - Update boundary guidance and note which compatibility shims were intentionally removed.

### Task 1: Remove Dead Compatibility APIs

**Files:**
- Modify: `src/lib/services/vineyard/vineyardService.ts`
- Modify: `src/lib/services/finance/financeService.ts`
- Test: `tests/vineyard/vineyardLifecycle.test.ts`
- Test: `tests/finance/loanLifecycle.test.ts`

- [ ] **Step 1: Write the failing search-based regression check**

Use ripgrep to prove the compatibility exports are no longer referenced anywhere else in the repo before deleting them:

```powershell
rg -n "\bplantVineyard\b|\bcalculateNetWorth\b" src tests
```

Expected before removal:
- one hit for `plantVineyard` in `src/lib/services/vineyard/vineyardService.ts`
- one hit for `calculateNetWorth` in `src/lib/services/finance/financeService.ts`

- [ ] **Step 2: Verify the compatibility symbols are isolated**

Run:

```powershell
rg -n "\bplantVineyard\b|\bcalculateNetWorth\b" src tests
```

Expected:
- no callers outside the defining files

- [ ] **Step 3: Remove the compatibility exports**

Delete the compatibility-only wrapper and alias so the files expose only the active API:

```ts
// src/lib/services/vineyard/vineyardService.ts
// Remove:
export async function plantVineyard(vineyardId: string, grape: GrapeVariety, density?: number): Promise<boolean> {
  await initializePlanting(vineyardId, grape);
  return await completePlanting(vineyardId, density || DEFAULT_VINE_DENSITY);
}

// src/lib/services/finance/financeService.ts
// Remove:
export const calculateNetWorth = calculateCompanyValue;
```

- [ ] **Step 4: Run targeted tests and build after the removals**

Run:

```powershell
npm test -- tests/vineyard/vineyardLifecycle.test.ts tests/finance/loanLifecycle.test.ts
npm run build
```

Expected:
- tests pass
- build exits `0`

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/vineyard/vineyardService.ts src/lib/services/finance/financeService.ts
git commit -m "refactor: remove dead compatibility service exports"
```

### Task 2: Add Inventory Service Seams And Remove Service-Level Inventory DB Imports

**Files:**
- Modify: `src/lib/services/wine/winery/inventoryService.ts`
- Modify: `src/lib/services/sales/buyGrapeMarketService.ts`
- Modify: `src/lib/services/sales/salesService.ts`
- Modify: `src/lib/services/sales/contractService.ts`
- Test: `tests/sales/buyGrapeMarketService.test.ts`
- Test: `tests/sales/contractLifecycle.test.ts`
- Test: `tests/sales/salesOrderLifecycle.test.ts`

- [ ] **Step 1: Write the failing tests around the public inventory seam usage**

Add or extend tests so the public sales flows continue to work while no longer relying on direct `inventoryDB` imports in those services:

```ts
test('buy-market purchase still creates inventory through the service seam', async () => {
  const result = await purchaseBuyGrapeOffer(existingOfferId, 500);
  expect(result.success).toBe(true);

  const batches = await getAllWineBatches();
  expect(batches.some(batch => batch.quantity === 500)).toBe(true);
});

test('order fulfillment still updates bottle inventory through the service seam', async () => {
  const fulfilled = await fulfillWineOrder(existingOrderId);
  expect(fulfilled).toBe(true);
});

test('contract fulfillment still deducts wine inventory through the service seam', async () => {
  const result = await fulfillContract(existingContractId, [{ wineBatchId: existingBatchId, quantity: 24 }]);
  expect(result.success).toBe(true);
});
```

- [ ] **Step 2: Run the targeted tests to establish the red baseline**

Run:

```powershell
npm test -- tests/sales/buyGrapeMarketService.test.ts tests/sales/salesOrderLifecycle.test.ts tests/sales/contractLifecycle.test.ts
```

Expected:
- current baseline passes before the refactor, confirming the tests cover the flows to preserve

- [ ] **Step 3: Add explicit inventory service helpers**

Expose the needed persistence helpers from `inventoryService` so higher-level services can stop importing `inventoryDB` directly:

```ts
// src/lib/services/wine/winery/inventoryService.ts
export async function getInventoryBatchById(batchId: string): Promise<WineBatch | null> {
  const batches = await loadWineBatches();
  return batches.find(batch => batch.id === batchId) ?? null;
}

export async function saveInventoryBatch(batch: WineBatch): Promise<void> {
  await saveWineBatch(batch);
  triggerGameUpdate();
}
```

- [ ] **Step 4: Replace direct inventory DB usage in sales services**

Update the higher-level sales services to use the new seam instead of importing `inventoryDB` directly:

```ts
// src/lib/services/sales/buyGrapeMarketService.ts
import { getAllWineBatches, saveInventoryBatch } from '../wine/winery/inventoryService';

// purchase path
await saveInventoryBatch(purchasedBatch);

// src/lib/services/sales/salesService.ts
import { getInventoryBatchById, saveInventoryBatch } from '../wine/winery/inventoryService';

const wineBatch = await getInventoryBatchById(order.wineBatchId);
await saveInventoryBatch(updatedBatch);

// src/lib/services/sales/contractService.ts
import { getAllWineBatches, getInventoryBatchById, saveInventoryBatch } from '../wine/winery/inventoryService';

const wineBatch = await getInventoryBatchById(selectedWine.wineBatchId);
await saveInventoryBatch(updatedBatch);
```

Notes for this step:
- keep the existing business behavior unchanged
- preserve the current game-update side effects
- when `contractService` needs the full batch list, replace the dynamic `loadWineBatches()` import with `getAllWineBatches()`

- [ ] **Step 5: Run the targeted tests and the build**

Run:

```powershell
npm test -- tests/sales/buyGrapeMarketService.test.ts tests/sales/salesOrderLifecycle.test.ts tests/sales/contractLifecycle.test.ts
npm run build
```

Expected:
- all targeted tests pass
- build exits `0`

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/wine/winery/inventoryService.ts src/lib/services/sales/buyGrapeMarketService.ts src/lib/services/sales/salesService.ts src/lib/services/sales/contractService.ts tests/sales/buyGrapeMarketService.test.ts tests/sales/salesOrderLifecycle.test.ts tests/sales/contractLifecycle.test.ts
git commit -m "refactor: route sales inventory persistence through inventory service"
```

### Task 3: Remove Service-Level Constant Compatibility Re-Exports

**Files:**
- Modify: `src/lib/services/sales/buyGrapeMarketService.ts`
- Modify: `src/lib/services/sales/grapeBuyerMarketService.ts`
- Modify: `tests/sales/buyGrapeMarketService.test.ts`
- Modify: `tests/sales/grapeBuyerMarket.test.ts`

- [ ] **Step 1: Write the failing import cleanup**

Change the tests to import the constants from `@/lib/constants` instead of service files:

```ts
// tests/sales/buyGrapeMarketService.test.ts
import { BUY_MARKET_FIXED_SPREAD } from '@/lib/constants';
import { computeBuyOfferPricePerKg, getBuyOfferStateLabel } from '@/lib/services/sales/buyGrapeMarketService';

// tests/sales/grapeBuyerMarket.test.ts
import { BASE_SEASONAL_BUYER_COUNT, BULK_BASE_SEASON_LIMIT_KG } from '@/lib/constants';
```

- [ ] **Step 2: Run the targeted tests to confirm imports still resolve**

Run:

```powershell
npm test -- tests/sales/buyGrapeMarketService.test.ts tests/sales/grapeBuyerMarket.test.ts
```

Expected:
- tests still pass with constants imported from the constants barrel

- [ ] **Step 3: Remove the service compatibility re-exports**

Delete the shim exports once the tests no longer depend on them:

```ts
// src/lib/services/sales/buyGrapeMarketService.ts
// Remove:
export { BUY_MARKET_FIXED_SPREAD } from '@/lib/constants';

// src/lib/services/sales/grapeBuyerMarketService.ts
// Remove:
export {
  BASE_SEASONAL_BUYER_COUNT,
  BULK_BASE_SEASON_LIMIT_KG,
  BUYER_ECONOMY_LIMIT_MULTIPLIERS,
  BUYER_ECONOMY_PRICE_MULTIPLIERS,
  BUYER_ECONOMY_VOLATILITY_AMPLITUDE,
  BUYER_ECONOMY_VOLATILITY_PRESSURE,
  BUYER_SEASON_LIMIT_MULTIPLIERS,
  BUYER_SEASON_PRICE_MULTIPLIERS,
  BUYER_WEATHER_VOLATILITY_PRESSURE,
  COUNTRY_MULTIPLIER_RANGE,
  MAX_SEASONAL_BUYER_COUNT,
  WEATHER_INTENSITY_MULTIPLIER,
} from '@/lib/constants';
```

- [ ] **Step 4: Run the targeted tests and build**

Run:

```powershell
npm test -- tests/sales/buyGrapeMarketService.test.ts tests/sales/grapeBuyerMarket.test.ts
npm run build
```

Expected:
- tests pass
- build exits `0`

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/sales/buyGrapeMarketService.ts src/lib/services/sales/grapeBuyerMarketService.ts tests/sales/buyGrapeMarketService.test.ts tests/sales/grapeBuyerMarket.test.ts
git commit -m "refactor: remove service constant compatibility shims"
```

### Task 4: Update Project Documentation

**Files:**
- Modify: `docs/PROJECT_INFO.md`

- [ ] **Step 1: Update the documented boundary rule**

Add a short rules section that matches the actual post-cleanup direction:

```md
## Current Boundary Rules

- `*DB.ts` files own persistence and row mapping.
- UI and hooks should not import database modules directly.
- Higher-level services should prefer existing service seams over direct `database/*` imports when a clear domain seam already exists.
- Compatibility exports should not remain in service files without active callers.
```

- [ ] **Step 2: Note the cleanup examples**

Document the concrete examples from this pass:

```md
- Removed dead compatibility exports such as `plantVineyard()` and `calculateNetWorth`.
- Removed sales-service constant re-export shims after tests were updated to import from `@/lib/constants`.
- Inventory persistence in buy-market and wine-sales flows now routes through `inventoryService`.
```

- [ ] **Step 3: Run the build as the final repository-wide verification**

Run:

```powershell
npm run build
```

Expected:
- build exits `0`

- [ ] **Step 4: Commit**

```bash
git add docs/PROJECT_INFO.md
git commit -m "docs: clarify service and database boundary rules"
```

## Self-Review

- Spec coverage:
  - compatibility cleanup is covered by Task 1 and Task 3
  - narrow service/DB tightening is covered by Task 2
  - docs alignment is covered by Task 4
- Placeholder scan:
  - no `TODO`, `TBD`, or unresolved path placeholders remain
- Type consistency:
  - `getInventoryBatchById()` and `saveInventoryBatch()` are defined in Task 2 before later tasks use them
