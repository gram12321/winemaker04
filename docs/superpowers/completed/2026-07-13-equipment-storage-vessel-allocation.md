# Equipment and Cellar Vessel Allocation Plan

**Status:** Implemented. Rechecked on 2026-07-17; this document is retained as a historical implementation record.

**Goal:** Make storage vessels a required, capacity-limited part of production. Every non-bottled `WineBatch` must have an active Cellar Vessel allocation before it can be created or processed. Bottled batches require no vessel and release their allocation. Add an Equipment page that can later aggregate machinery without flattening different equipment families into one generic persistence shape.

**Baseline:** `marketmodal` already provides generic Buy Market offers and individually owned `storage_vessels`. This plan replaces its intentionally deferred allocation seam. It has no legacy-data migration, compatibility read, or grandfathered batch path.

## Confirmed decisions

- **Equipment** is the top-level player-facing domain and page.
- **Cellar Vessels** is the player-facing category. `StorageVessel` remains the TypeScript and persistence family name for the current implementation.
- Casks, steel tanks, concrete tanks, and containers are Storage Vessel variants. Machinery is a future Equipment family, not a Storage Vessel variant.
- A purchased vessel remains an individual asset with immutable type, material, and fixed litre capacity.
- Every non-bottled batch needs storage. `grapes`, `must_ready`, and `must_fermenting` are all liquid/production inventory for this rule. `bottled` batches are explicitly exempt.
- A batch may be assigned to one or more vessels. A vessel is dedicated to one reserved or active batch at a time in v1; different batches must not share a vessel.
- Vessel selection is required when a batch is created: vineyard harvest and market-grape purchase. Crushing and fermentation retain and display the batch's existing allocation. They offer transfer only as an explicit later action, rather than forcing a redundant re-selection at every stage.
- `0.5 L per kg` is an explicit **temporary bootstrap value**, not a permanent production formula. It initializes a harvested batch's stored volume only, and is derived from the current bottling conversion of `1.5 kg` per standard `0.75 L` bottle.
- Batch volume in litres is a separate persisted production value. Future crushing conversion, fermentation loss, diffusion, angel's share, transfers, and other approved mechanisms change that value through a dedicated service; they must never rewrite a global kg-to-litre constant.
- Vessel material/type has no taste, structure, price, risk, yield, or work effect in this release. Allocation records provide the future effect seam; no effect function is wired into wine processing yet.
- No backwards compatibility is required. Existing unbottled rows without a storage plan are invalid under the new model and are not supported.

## Why an allocation plan is required

A single `wine_batches.vessel_id` cannot represent a mature harvest that needs several vessels. Treating free litres as one pooled company value would permit different wines to share a physical cask and would make future vessel effects ambiguous.

The chosen model is a batch-owned allocation plan:

```text
Equipment page
  -> Storage Vessel asset (one physical cask/tank)
  -> Storage allocation plan (one active production lot)
  -> one or more vessel allocations
  -> WineBatch
```

The plan is created before a harvest activity or market batch exists. This permits capacity to be reserved safely and gives incremental harvest output a stable destination. The `WineBatch` then references its plan once it is first persisted.

## Data model and database invariants

### Storage Vessel assets

Retain `storage_vessels` as the physical-asset table. Replace its overloaded `state` field with an equipment-condition field:

- `operational_status`: `operational | maintenance | retired`

The player-visible occupancy label is computed from allocation plans, not stored on the vessel:

- **Available:** operational vessel with no reserved or active allocation.
- **Reserved:** selected for an unfinished harvest activity.
- **In use:** assigned to an active unbottled batch.
- **Maintenance / Retired:** unavailable regardless of allocation capacity.

Capacity, material, and vessel type are immutable after purchase. Acquisition price and source offer remain provenance fields.

### Storage allocation plans

Create `storage_vessel_allocation_plans` with company ownership, a generated ID, optional harvest `activity_id`, optional `wine_batch_id`, and status:

- `reserved`: capacity committed to an activity or market-purchase command before the batch exists.
- `active`: attached to one non-bottled batch.
- `released`: no longer occupies vessels after bottling or full batch removal.

Store the plan's required litres, creation game date, activation game date, and release game date. A plan is the storage identity recorded on `WineBatch`, not an opaque vessel ID. Its current required litres come from the batch's persisted current volume, not directly from its kg quantity after harvest.

### Vessel allocations

Create `storage_vessel_allocations` with company ownership, `plan_id`, `vessel_id`, assigned capacity in litres, and filled litres. A plan can have many rows; a vessel can have at most one row whose plan is `reserved` or `active`.

Use a partial unique index over active/reserved allocations so two client actions cannot claim the same vessel. Foreign keys and RLS follow the existing company-scoped tables.

### Wine batch constraint

Add `storage_plan_id` and `volume_litres` to `wine_batches`. `volume_litres` is the current physical liquid volume used for vessel occupancy; `quantity` retains its existing kg-or-bottles meaning. Add a database check:

```sql
state = 'bottled' OR (storage_plan_id IS NOT NULL AND volume_litres IS NOT NULL)
```

The allocation service validates that a referenced non-bottled batch has an active plan with enough assigned vessel capacity. The service is the only public route for creating, attaching, transferring, or releasing a plan.

## Storage volume and capacity policy

Create named constants in `storageVesselConstants.ts`:

- `STORAGE_VESSEL_INITIAL_HARVEST_LITRES_PER_KG = 0.5`
- `STORAGE_VESSEL_CAPACITY_UNIT = 'L'`

`initializeHarvestVolumeLitres(quantityKg)` uses the bootstrap value and rounds upward to whole litres. It is the only v1 use of that ratio. Non-bottled batches keep their current kg quantity model, while `volumeLitres` becomes the storage-capacity source of truth.

The current crushing workflow already applies a method-specific yield multiplier to `WineBatch.quantity`. The volume service becomes the single place where that workflow can later apply an approved crushing conversion to `volumeLitres`. Fermentation loss, diffusion, angel's share, and future operations follow the same explicit `volumeLitres` update path. Their formulas and timing are deliberately out of scope for this release.

At bootstrap capacity, a 225 L cask holds the volume initialized from up to 450 kg, and a 500 L cask from up to 1,000 kg. These examples are temporary capacity examples, not promises about later crushing or maturation yields.

Selected vessels must provide at least the required litres. A selected vessel is exclusive to that batch in v1 even if its final filled volume is below its physical capacity. This avoids unapproved blending and keeps future vessel-specific wine effects attributable.

## Domain services and commands

Create `storageVesselAllocationService` as the only rule owner for capacity and assignment. It exposes service-level commands rather than database calls to UI modules:

- `getStorageCapacitySummary()` and `getAvailableStorageVessels()` for presentation.
- `createHarvestStoragePlan(vineyard, expectedYieldKg, vesselIds)` to validate and reserve capacity before an activity starts.
- `initializeHarvestVolumeLitres(quantityKg)` to establish a newly harvested batch's temporary v1 volume.
- `activateStoragePlanForBatch(planId, batchId, volumeLitres)` when the first harvest output or market purchase creates its batch.
- `recordBatchStorageVolume(batchId, volumeLitres, reason)` after partial harvest, an approved processing conversion, or partial bulk sale.
- `assertBatchHasUsableStorage(batchId)` before crushing or fermentation begins.
- `releaseStoragePlanForBatch(batchId)` after bottling or deletion of the final quantity.

The database module owns reads/writes and an RPC owns the atomic reservation claim. The RPC verifies company ownership, operational condition, all selected vessel IDs, exclusive availability, and total capacity before creating the plan and allocation rows.

## Production flow

### Vineyard harvest

1. `HarvestOptionsModal` loads the capacity summary and requires a multi-vessel selection. It displays expected kg, required litres, selected litres, and shortfall.
2. The harvest-start command generates both an activity ID and an output batch ID, creates the activity, and atomically reserves the selected vessels through the allocation service. The activity stores `storagePlanId` and `outputBatchId` in its params.
3. Partial harvesting appends to `outputBatchId`; it does not merge into an unrelated compatible grape batch. The first append initializes `volumeLitres` and activates the reserved plan; every append updates filled litres from that persisted volume.
4. If dynamic yield would exceed the reserved capacity, harvesting pauses before persisting excess grapes. The activity reports the exact additional litre capacity required. The player must add vessels to the plan before resuming.
5. Cancelling a harvest releases its still-reserved plan. Completed harvests leave an active batch plan.

### Market-grape purchase

The Grape Procurement adapter receives selected vessel IDs as purchase input. It reserves/activates a plan and creates the purchased batch through one service operation. This applies to offers already in `grapes`, `must_ready`, or `must_fermenting` state; no market purchase can create an unassigned non-bottled batch.

### Crushing and fermentation

Crushing and fermentation preserve the active batch plan. Their modal includes a compact **Cellar Vessels** panel showing the allocated vessels, total assigned capacity, current required volume, and remaining unused assigned volume.

The service calls `assertBatchHasUsableStorage()` before it creates either activity. No vessel selection is required at these steps because it is the same physical production lot. Crushing may later become the first operation to apply an approved `volumeLitres` conversion using its existing yield information; this allocation release does not define that formula. A later dedicated Transfer Batch action may change a plan's vessels only when no conflicting production activity exists.

### Bottling, selling, and deletion

- Successful bottling marks the batch bottled and releases its allocation plan. Bottled stock has no vessel requirement.
- A partial bulk sale reduces `volumeLitres` in the same proportion as the sold batch quantity, then updates filled litres while keeping the vessel dedicated to the remaining batch.
- A full bulk sale or any valid non-bottled batch deletion releases the plan.
- The existing sell-side market remains separate from Buy Market; it only calls the allocation release/update service as an inventory lifecycle side effect.

## UI design

### Equipment page

Add an `Equipment` route and header navigation item. It is an aggregation surface, not a generic asset database.

The initial page shows:

- Total, available, reserved, and in-use Cellar Vessel capacity.
- Individual vessel cards/table rows: type, material, capacity, operational status, occupancy, assigned batch, acquisition price, and source offer.
- An entry point to Buy Market filtered to Storage Vessels.

The page has no pretend Machinery section. Future Machinery supplies its own service, persistence, and presentation adapter, then contributes a real section to the Equipment page.

### Operation modals

- Harvest: required multi-select capacity planner with an unavailable state when selected capacity is insufficient.
- Crushing/Fermentation: read-only allocation summary plus an actionable failure reason for invalid unassigned data; no redundant picker.
- Buy Market / Grape Procurement: capacity planner appears in the purchase confirmation for grape-derived offers.
- Winery batch cards and Wine Details: show the current vessel allocation summary for every non-bottled batch.

UI components consume service-prepared view models and emit selected vessel IDs. They do not calculate capacity, mutate allocations, or query Supabase directly.

## Equipment architecture boundary

Do not create a universal `equipment_assets` table or a universal effect interface now. Storage Vessels have capacity, material, occupancy, and future wine-contact effects. Machinery will have capability, work modifiers, condition, and possibly assignment to vineyard operations. Those are different persistence and rule shapes.

Use a small Equipment read-model registry only at the page boundary. Each family owns its database module, service, types, constants, and UI presentation. Buy Market already provides the analogous adapter seam for purchasing.

## Explicit non-goals

- No legacy batch migration, fallback, synthetic starter vessels, or old vessel-state compatibility.
- No bottle vessel, bottle storage capacity, bottling equipment, or cellar-rack system.
- No sharing a vessel between active batches.
- No batch blending, transfer workflow, cleaning, depreciation, maintenance actions, or vessel sale flow.
- No vessel material/type effect on anchors, characteristics, `structureIndex`, `tasteQualityIndex`, price, risks, yield, or work.
- No dynamic crushing conversion, fermentation loss, diffusion, angel's share, or other volume-loss formula beyond initializing harvest volume with the explicit temporary bootstrap value.
- No machinery implementation.
- No buy/sell market unification.

## Verification requirements

- Database tests: capacity and unique active-allocation constraints, company/RLS isolation, and plan lifecycle transitions.
- Service tests: insufficient capacity rejection, one and many vessel allocation, atomic contention failure, partial-harvest volume updates, overflow pause, activity cancellation release, crush/ferment validation, bottling release, partial/full bulk-sale behaviour, and grape-market purchase rejection without capacity.
- UI tests: harvest capacity planner, market capacity requirement, operation allocation panels, and Equipment summary/list rendering.
- Regression tests: vineyard lifecycle, winery lifecycle, grape procurement, sell grapes, activity cancellation, and game tick activity progression.
- Run focused suites, full `npm test`, `npx tsc --noEmit`, production build, and `git diff --check` before implementation handoff.

## Acceptance criteria

- It is impossible through supported services or database constraints to persist a non-bottled batch without an active storage plan.
- It is impossible for two reserved/active production lots to claim the same vessel.
- Harvest cannot start without enough selected vessel capacity, and incremental harvest cannot overflow its reserved capacity.
- Grape-market purchases cannot create grapes, must, or fermenting inventory without selected vessel capacity.
- Crushing and fermentation retain and validate the batch allocation without requiring repetitive selection.
- Bottling and complete non-bottled inventory removal release capacity.
- Equipment displays real individual Cellar Vessel assets and accurate occupancy/capacity totals.
- Existing wine quality, score, pricing, risk, yield, and work calculations remain unchanged. The only new v1 physical-volume calculation is the explicitly temporary harvest bootstrap value; later operations must modify persisted `volumeLitres` through the volume service.
