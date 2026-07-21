# Global Asset Market and Used Storage Vessels

**Status:** Completed for the initial global used-vessel market delivery. This replaces the three prior overlapping used-vessel/P2P market notes; generic player-to-player listings remain a future extension described below.

## Goal

Establish a reusable global asset-market foundation, first used by Storage Vessels. A listed asset has one canonical record, evolves deterministically while it is listed, and can be purchased once by any company. The same foundation must later support grapes and other Buy Market goods without creating a second P2P-market architecture.

This is development-phase work: rebuild the relevant database schema and discard incompatible vessel/allocation/listing data. Do not retain `storage_vessels.company_id`, deprecated RPCs, fallback types, data backfills, or compatibility adapters. Ownership is represented exclusively by `ownerKind` and nullable `ownerCompanyId`.

## Existing grape-market behavior to preserve and generalize

The Grape Procurement market already has a richer lifecycle than simple expiry:

- its weekly lifecycle removes exhausted or expired offers;
- it increments `weeksOnMarket`;
- it applies state-specific quality decay with a floor;
- it rebuilds the preview batch and its provenance;
- it recalculates price from the evolved quality plus projected structure, taste, features, and risks;
- seasonal refresh retains/replaces supplier stock deterministically.

That behavior remains grape-domain logic. The generic layer must own only the reusable lifecycle mechanics: game-date arithmetic, visibility intervals, deterministic seeds, projection at an arbitrary date, retirement, and atomic claim/transfer. Each goods adapter owns its own projected state and price calculation.

## Generic global asset-market model

### Canonical asset

Every globally tradable item has one persistent asset record with:

- permanent asset ID and display identity;
- owner (`company` or `npc_market`);
- immutable origin/provenance;
- current persisted state at the moment it was listed or acquired;
- domain-specific payload owned by its adapter.

For Storage Vessels, this is the vessel record itself: name, type, material, quality, condition, cleanliness, fill history, production year, capacity, and future vessel-memory data all transfer intact.

### Global listing

`global_market_listings` is a generic table with one active listing per asset. It stores:

- asset type and asset ID;
- seller kind/identity and listing origin (`npc_generated`, `player_sellback`, later `player_listing`);
- seller company identity is preserved separately from custody; an NPC may hold the asset between player transactions without appearing as the seller;
- status: `active`, `sold`, or `retired`;
- global listing date and deterministic evolution seed;
- immutable starting projection payload/version;
- deterministic retirement date;
- buyer and sale metadata once sold.

The adapter-specific listing table/payload may hold domain state where a generic JSON payload would lose database integrity. The generic listing lifecycle and transfer contracts remain shared.

### Date and visibility rules

For an asset listed at Week 10, Spring 2027:

- no company sees it before that game date;
- every company at or after that date sees the same deterministic projection for its own requested game date;
- it remains visible until its deterministic retirement date or until purchased;
- purchase immediately changes listing status to `sold` globally, so it disappears for every company, including companies earlier in simulated time;
- retirement is evaluated from the requested game date. Do not let one company’s later date permanently erase historical visibility for another company at an earlier date.

## Adapter contract

Each global-asset adapter implements:

```ts
interface GlobalMarketAssetAdapter<TAsset, TProjection> {
  assetType: string;
  project(asset: TAsset, listing: GlobalMarketListing, date: GameDate): TProjection;
  isVisible(projection: TProjection, listing: GlobalMarketListing, date: GameDate): boolean;
  price(projection: TProjection, date: GameDate): number;
  retirementDate(asset: TAsset, listingDate: GameDate): GameDate;
  validateSale(asset: TAsset, seller: CompanyId): SaleEligibility;
  transferPurchase(input: AtomicPurchaseInput): Promise<PurchaseResult>;
}
```

Projection is pure: viewing a listing never writes to the database. Purchase reprojects and prices again inside the atomic database command; client-supplied price or projected state is never authoritative.

## Storage Vessel adapter

### Ownership and cellar behavior

- `StorageVessel.ownerKind` is `company` or `npc_market`.
- `ownerCompanyId` exists only for company-owned vessels.
- Allocation, maintenance, Equipment, and Winery load only `ownerKind = company AND ownerCompanyId = activeCompanyId`.
- NPC-market vessels cannot be allocated, cleaned, emptied, or otherwise operated.

### Used-market projection

The listed vessel is the asset. Its fill history is frozen while listed. The adapter projects condition from its listing snapshot and date with material-specific decay:

```text
oak > chestnut/plastic > ceramic > concrete > stainless steel
```

Condition reaches zero at a deterministic, material-specific retirement date. It is never written during viewing. The adapter recomputes a shared base value from projected condition and the vessel’s capacity, quality, age, material, fill history, and cleanliness. The generic Buy Market relationship layer then applies the buyer’s personal seller multiplier. Buyer prestige and supplier-specific stock terms do not apply to used listings.

Future extensions add weather, temperature, maintenance history, and vessel memory to this projection, not UI code.

### NPC supply

At each season, generate one idempotent, globally shared used vessel for every supported material: oak, chestnut, stainless steel, concrete, ceramic, and plastic. Each has a stable generation key, permanent ID/name, NPC seller, age, condition, fill history, listing date, and calculated retirement date. Generation must be safe when multiple companies open the market in the same season.

### Sell-back

Equipment exposes **Sell to Market** only when a vessel is company-owned, empty, unallocated, operational, and has no related active or paused activity. An atomic command:

1. locks and revalidates vessel, allocation, and activity eligibility;
2. calculates used value at the seller’s game date;
3. pays 70% immediately;
4. transfers the same asset to `npc_market` ownership;
5. creates the global listing with its deterministic projection and retirement date.

Dirty, low-condition, and high-fill-history vessels are sellable; those values remain on the asset.

### Purchase

The Storage Vessel market panel combines quantity-based new supplier rows and used asset rows. Used rows are always quantity one and show the actual vessel name, seller, material, capacity, production year/age, quality, projected condition, fills, cleanliness, and current price.

The atomic used-purchase command locks listing and asset, confirms its game-date window and active status, derives the authoritative projection and price, checks funds, transfers ownership to the buyer, materializes the purchased projection on the vessel, and marks the listing sold. Double purchase must fail.

## Future generic P2P market

The first delivery is NPC-generated supply plus NPC immediate sell-back. Global supplier adapters generate their deterministic goods in TypeScript (including vessel names); SQL persists and validates the supplied rows atomically, without duplicating product-specific naming catalogues. Later player-to-player listings use the same global listing model:

- seller can choose listing terms instead of mandatory NPC sale;
- settlement may be immediate or escrowed according to a future economic design;
- seller identity is the counterparty for the buyer’s generic market relationship, even while NPC escrow holds the asset; current relationship effects are buyer-specific price terms and progression only;
- grapes and future goods can provide their own asset/projection adapters;
- a generic listing browser can combine adapters while each domain keeps its own table, lifecycle, and price logic.

Do not model P2P trade as a Storage Vessel-only feature.

## Clean-cutover migration sequence

1. Drop storage-vessel ownership fields, allocation functions, policies, and tables that depend on `company_id` ownership.
2. Recreate vessel, allocation, and listing schema using only owner fields and explicit foreign keys.
3. Recreate every vessel allocation, emptying, cleaning, bottling, sale, and market RPC against `ownerKind`/`ownerCompanyId`.
4. Add generic global-listing persistence, date/projection helpers, and secure read/atomic mutation commands.
5. Update all TypeScript types, database mappers, services, tests, Equipment, Winery, and Market consumers in the same change.
6. Remove every obsolete function, type field, query, policy, test fixture, and documentation reference. No bridge columns or fallback path remains.

## Verification

- Grape lifecycle still decays/evolves previews and refreshes seasonal stock.
- Generic date helpers correctly handle before-listing, active, retirement, and sold windows.
- NPC vessel generation is deterministic, idempotent, and covers every material.
- Two companies at different game dates receive the correct deterministic vessel projection.
- Sell-back rejects filled, reserved, allocated, inactive, and activity-linked vessels; accepted sale preserves asset ID/history and pays exactly 70%.
- Used purchase validates server-side projection/value, prevents early/retired/double purchase, debits funds, and transfers the same asset.
- Supplier-catalogue purchases and all company-owned vessel production flows work after the clean migration.
- Run focused market/vessel tests, TypeScript, `git diff --check`, and an architecture/RLS review.
