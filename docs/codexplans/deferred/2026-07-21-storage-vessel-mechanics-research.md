Make vessels a style-and-control system, not a linear “better equipment = better wine” ladder. Steel should make excellent wine; a poorly matched small new oak cask should be able to make it worse.

The existing allocation model already supports this well: one batch can occupy several vessels, so effects must be weighted by each allocation’s `filledLitres`, never by vessel count or nominal capacity. [Storage vessel types and allocations](C:/GitHub/winemaker04-buy-market-storage-vessels/src/lib/types/storageVessels.ts:13)

```text
filled vessel allocations
→ volume-weighted vessel-contact profile
→ anchors and explicit fault risk
→ existing Structure + Taste Quality calculations
→ wineScore
→ existing price calculation
```

This keeps the relationship map intact: no hidden direct edit to `structureIndex`, `tasteQualityIndex`, `wineScore`, or bottle price.

## Catalogue and play styles

Keep the current 250 / 500 / 1,000 L scale initially, then add larger formats only where they create a real decision.

| Vessel | Suggested sizes | Wine direction | Operational tradeoff |
|---|---:|---|---|
| Oak cask | 250, 500, 1,000 L | Wood spice, maturation, some tannin/body integration; small casks have stronger contact | More cleaning, topping, inspection, and per-litre labour |
| Chestnut cask | 500, 1,000, 2,000 L | Stronger, more tannic/oxidative specialist than oak | High mismatch risk; expensive maintenance |
| Stainless tank | 500, 1,000, 2,500 L | Neutral preservation of fruit, acid, and aromatics | Efficient, reliable, less stylistic expression |
| Concrete tank/egg | 750, 1,500, 3,000 L | Mostly neutral; restrained texture and development, not “minerality” | Heavy, costly, difficult to repair/clean if damaged |
| Ceramic amphora | 250, 500, 1,000 L | Neutral-to-gentle porous development; suitable for deliberate specialty styles | Fragile and sanitation-heavy; raw/glazed should eventually differ |
| Food-grade plastic | 1,000, 2,500, 5,000 L | No desirable flavour identity; cheap temporary/bulk capacity | Greater long-contact oxygen/taint risk, especially when worn |

Size should matter differently by material:

- For wood, ceramic, and lightly porous concrete, smaller format means stronger surface-contact effects.
- For steel and plastic, size should mainly affect capacity, thermal stability, and work—not flavour intensity.
- Small vessels enable experiments and split lots; large vessels reduce per-litre labour but can strand capacity and create future headspace risk.

Oak’s gradual oxygen transfer is real, and barrel soundness affects it, so “controlled oxygen” and “uncontrolled oxidation” should remain separate mechanics. [OENO One research](https://oeno-one.eu/article/view/4692)

## Give each existing parameter one job

- `material`: the normal style direction. This is the main sensory variable.
- `qualityScore`: craftsmanship and control, not a direct quality multiplier. High quality means predictable extraction/sealing/lining, less risk, and perhaps slightly lower work. It should not mean “more vanilla” or “+10% bottle price.”
- `condition`: physical integrity. Low condition weakens controlled behaviour and raises leakage, oxygen, sanitation, and repair pressure. It should eventually gate operation at a severe threshold.
- `productionYear` and `fillHistory`: material-specific evolution. Repeated fills should make oak/chestnut progressively neutral; they should not make sound stainless steel flavourless or unusable.
- `cleanliness`: sanitation only. Dirty should create an informed risk choice, not desirable “seasoning.” Wood is genuinely harder to sanitise than inert tanks because microbes can penetrate the stave material. [AWRI barrel guidance](https://www.awri.com.au/industry_support/winemaking_resources/storage-and-packaging/packaging-operations/barrel-cleaning-storage-and-maintenance/)
- `capacity`: logistics first, then contact intensity and work as a secondary effect.

I would retain the current warning-only dirty-vessel rule for the first pass, but make the warning consequential: an emergency dirty allocation is allowed, visibly increases contamination risk, and clean allocation becomes the normal safe choice.

## Where the effects belong

Add the planned-but-missing `storageVesselEffectService` as a pure adapter. It should resolve a player-explainable `StorageVesselContactProfile` from active allocations:

- material mix, weighted by `filledLitres / batch.volumeLitres`;
- size/contact band;
- quality and condition control;
- oxygen and sanitation risk;
- work modifiers;
- plain-language explanations.

Normal vessel behaviour belongs upstream in the anchor/process pipeline:

- Oak/chestnut: bounded maturation and wood-contact effects, plus restrained tannin/body/spice changes.
- Stainless: primarily protection against oxygen loss and reliable process control—not a generic aroma buff.
- Concrete/ceramic: keep largely neutral until there is a dedicated texture/controlled-oxygen source.
- Plastic/poor condition: risk pressure, not a positive style effect.

There is an important current constraint: `maturationState` already contributes to the `oakAging` flavour family, while `processFootprint` contributes to faults. [Taste profile mapping](C:/GitHub/winemaker04-buy-market-storage-vessels/src/lib/services/wine/taste/wineTasteProfileService.ts:107) So concrete and amphora must not be faked by casually increasing those anchors. Either keep them near-neutral in phase one, or introduce a source-specific `woodContactState` / vessel-contact source registry before giving them nuanced flavour effects. Never use vessel choice to raise `terroirExpression`.

Use Wine Features only for threshold events:

- existing `oxidation` risk for leaky, porous, underfilled, or worn vessels;
- a future `cellar_contamination` / spoilage feature for dirty, porous, poor-condition vessels;
- possibly a distinct cellar-maturation feature later, once the game has a real maturation phase.

Do not create an “Oak Vessel” feature on every wine. Normal vessel contact is process context, not a feature with automatic prestige and price semantics.

## Grape difficulty and price

Do not feed the aggregate `calculateGrapeDifficulty()` score into vessel formulas. It includes yield and site suitability, which would create arbitrary double-counting.

Use the real relevant traits instead:

- `proneToOxidation`: sensitivity to porous, dirty, worn, or plastic vessels;
- `fragile`: slightly higher handling/transfer work;
- grape colour, phenolic/aromatic/acid anchors, and aging profile: suitability for wood intensity or controlled oxygen;
- current structure: whether a wood/chestnut effect will integrate or push the wine out of balance.

This should produce a suitability preview, not a hard gate. “Pinot Noir is vulnerable in a dirty, tired cask” is good information; “Pinot Noir cannot use oak” is not.

Bottle price should change indirectly through the established score pipeline. A vessel should affect resale value directly, but not grant a hidden “oak premium” on wine. Add direct style premiums only when customer preferences or contract labels explicitly understand “barrel-aged,” “amphora,” and similar styles.

## Practical rollout order

1. Define legal type/material/size combinations and material-specific market pricing.
2. Add a contact ledger: first positive fill increments `fillHistory` once, records contact date, and preserves provenance through partial emptying.
3. Add the volume-weighted profile and modest, bounded anchor/risk effects.
4. Add material-aware cleaning work, condition wear, repair/reline/rehoop maintenance.
5. Add a real cellar-maturation phase before serious élevage mechanics.
6. Only then implement vessel memory as a compact vessel imprint—not a Wine Feature.

One technical guardrail: do not simply add another unlimited weekly material delta. `processWeeklyFermentation()` currently continues for every `must_fermenting` batch, so vessel contact needs a ledger/cap or a distinct maturation lifecycle to prevent infinite oak/concrete accumulation. [Weekly fermentation flow](C:/GitHub/winemaker04-buy-market-storage-vessels/src/lib/services/wine/winery/fermentationManager.ts:179)

No files were changed.

---

## Proposed implementation plan: Rollout 1 — legal vessel catalogue and material-aware market pricing

**Status:** Completed 2026-07-21. This rollout was deliberately limited to the first research item: it established legal vessel assets and material-aware market value, without adding vessel contact, wine-quality, work, cleanliness-risk, condition-wear, repair, or memory mechanics.

**Completion note:** The shipped implementation introduced the eighteen typed catalogue entries and `catalogueId` on vessels/offers, applied material multipliers to supplier and used-market prices, corrected NPC used-market type generation, migrated existing assets, and updated the market UI/tests. The local supplier implementation currently exposes the full eighteen-entry catalogue to each supplier (54 possible seasonal supplier offers), rather than applying the proposed supplier-family restriction below. That availability split remains a tuning decision for a later market pass.

### Goal

Replace the oak-cask-only supplier catalogue and the used-market assumption that every material is a `cask` with one canonical vessel catalogue. The catalogue must define legal `vesselType` + `material` + fixed-capacity combinations and the material construction multiplier used by both new and used vessel pricing.

The catalogue is a market/equipment identity rule, not a sensory-effect rule. A more expensive material is not yet a wine-quality bonus.

### Confirmed catalogue for this rollout

| Catalogue family | `vesselType` | `material` | Fixed capacities (L) | Initial material-price multiplier |
|---|---|---|---:|---:|
| Oak cask | `cask` | `oak` | 250, 500, 1,000 | 1.40 |
| Chestnut cask | `cask` | `chestnut` | 500, 1,000, 2,000 | 1.25 |
| Stainless tank | `steel_tank` | `stainless_steel` | 500, 1,000, 2,500 | 1.00 |
| Concrete tank / egg | `concrete_tank` | `concrete` | 750, 1,500, 3,000 | 1.20 |
| Ceramic amphora | `container` | `ceramic` | 250, 500, 1,000 | 1.45 |
| Food-grade plastic container | `container` | `plastic` | 1,000, 2,500, 5,000 | 0.55 |

`STORAGE_VESSEL_BASE_PRICE` remains the price of a 250 L stainless reference vessel before quality, supplier terms, relationship, prestige, age, condition, fill, and cleanliness modifiers. The material multiplier is applied directly after the capacity multiplier and before those existing market terms.

This establishes the deliberate ordering: plastic is budget capacity; steel is the neutral baseline; concrete and chestnut are specialist construction; oak and ceramic are premium small-lot assets. Exact multipliers are tuning constants and must be surfaced in the price breakdown; they are not hidden wine-price effects.

### Architecture decision

Introduce a canonical `StorageVesselCatalogueEntry` with a stable `catalogueId`. Every new supplier offer and NPC used listing is created from one catalogue entry. Every newly created vessel stores that immutable `catalogueId` together with its existing type/material/capacity snapshot.

The database must validate the catalogue identity in atomic market commands. TypeScript-only filtering is insufficient because global-NPC listing input and purchase flows reach Supabase RPCs. Keep `vesselType`, `material`, and `capacityLitres` on the physical asset as historical snapshots, but reject any mismatch with its catalogue entry in the database layer.

Local supplier availability should be explicit rather than every supplier selling every format:

| Supplier | Catalogue families |
|---|---|
| Cooperage Duval | Oak cask, Chestnut cask |
| Nordic Cellar Craft | Stainless tank, Food-grade plastic container |
| Heritage Coopers | Concrete tank / egg, Ceramic amphora |

The seasonal supplier market therefore has eighteen legal offers, one for each catalogue entry, before normal availability and retention rules are applied. The globally generated used market retains its current promise of one deterministic NPC asset per material per season; choose its catalogue entry deterministically from that material’s three legal capacities and include the resulting `catalogueId` in its generation key.

### File-level execution plan

#### Task 1: Make the catalogue a typed, validated domain concept

**Files:**

- Modify: `src/lib/types/storageVessels.ts`
- Modify: `src/lib/constants/storageVesselConstants.ts`
- Modify: `src/lib/types/index.ts` and `src/lib/constants/index.ts` only if the normal barrels require it
- Modify: `src/lib/database/winery/storageVesselsDB.ts`
- Create: one clean-cutover migration under `migrations/`
- Test: `tests/wine/storageVesselContracts.test.ts` or the current storage-vessel contract test location

- [ ] Define `StorageVesselCatalogueId` and `StorageVesselCatalogueEntry` with `id`, display label, vessel type, material, capacity, material-price multiplier, and supplier ownership.
- [ ] Replace the universal `STORAGE_VESSEL_SIZES_LITRES` list with the eighteen-entry typed catalogue plus lookup helpers: by ID, by legal type/material/capacity, and by material.
- [ ] Add required `catalogueId` to `StorageVessel` and `StorageVesselOfferPayload`; no fallback or inferred legacy ID remains.
- [ ] Create a canonical database catalogue relation seeded with the same eighteen IDs. Add a required `storage_vessels.catalogue_id` foreign key and database validation that the asset snapshot matches its catalogue row.
- [ ] Update all storage-vessel creation, mapper, test fixture, and admin fixture callers together. This is a development-stage clean cutover: delete/regenerate incompatible dev vessel/listing rows rather than adding a legacy fallback.
- [ ] Prove at the type/service/database boundary that unsupported pairs such as `steel_tank + oak`, `cask + plastic`, or a 250 L stainless tank cannot be created.

#### Task 2: Centralise material-aware pricing

**Files:**

- Modify: `src/lib/services/market/storageVessels/storageVesselMarketAdapter.ts`
- Modify: `src/lib/services/market/storageVessels/usedStorageVesselMarketService.ts`
- Modify: `src/lib/constants/storageVesselConstants.ts`
- Test: `tests/market/storageVesselMarketAdapter.test.ts`
- Test: `tests/market/usedStorageVesselMarketService.test.ts`

- [ ] Add `materialMultiplier` and a readable material/format label to `StorageVesselPriceBreakdown`.
- [ ] Resolve the multiplier from the catalogue entry, never from UI text or a duplicate switch in a caller.
- [ ] Apply the multiplier to both local supplier and used-listing base value before supplier terms, buyer relationship, company prestige, quality, age, condition, fill history, and cleanliness.
- [ ] Preserve the existing quality curve and all existing buyer/seller relationship behavior. Do not use this rollout to change age/fill depreciation, condition decay, or cleanliness semantics; those are later mechanics.
- [ ] Cover the stated multiplier order with deterministic tests and assert that otherwise-identical local/used vessels differ in base value by catalogue material.

#### Task 3: Generate only legal local supplier offers

**Files:**

- Modify: `src/lib/services/market/storageVessels/storageVesselMarketAdapter.ts`
- Modify: `src/lib/services/market/storageVessels/storageVesselNamingService.ts` if presentation needs a format-specific label
- Test: `tests/market/storageVesselMarketAdapter.test.ts`

- [ ] Replace the `supplier × STORAGE_VESSEL_SIZES_LITRES` generator with each supplier’s assigned catalogue entries.
- [ ] Include `catalogueId` in the deterministic offer ID, quality/age/name seed, and all offer payloads so two entries with the same capacity cannot collide.
- [ ] Replace `isCurrentStorageVesselOffer`’s hardcoded `cask`/`oak` check with catalogue validation. Invalid, legacy, or mismatched local offer rows are retired during the normal seasonal refresh.
- [ ] Calculate the expected offer count from catalogue availability, not supplier count times a universal size list.
- [ ] Preserve normal supplier relationship retention and stock availability rules; relationship changes availability/price terms, not the legal catalogue.

#### Task 4: Correct global used-vessel generation and atomic RPC validation

**Files:**

- Modify: `src/lib/services/market/storageVessels/globalStorageVesselSupplierService.ts`
- Modify: `src/lib/database/market/storageVesselMarketListingsDB.ts`
- Modify: the relevant global-market migration/RPC definitions under `migrations/`
- Test: `tests/market/globalStorageVesselSupplierService.test.ts`
- Test: `tests/market/usedStorageVesselMarketService.test.ts`

- [ ] Change `NpcStorageVesselListingInput` to carry `catalogueId`; derive vessel type, material, and capacity from it server-side.
- [ ] Generate exactly one deterministic NPC listing for each material per season, selecting one of its legal catalogue entries with a stable material/date seed. Include `catalogueId` in `generationKey` so idempotency remains correct.
- [ ] Remove the SQL hardcoding that inserts every generated used asset as `vessel_type = 'cask'`.
- [ ] Make the NPC listing RPC reject missing, unknown, or mismatched catalogue identity before inserting either an asset or listing.
- [ ] Preserve the existing pure viewer-date condition projection and atomic used-purchase transfer. Material pricing must be derived authoritatively in the existing server-side used-value command as well as the TypeScript preview.

#### Task 5: Present formats and material pricing honestly

**Files:**

- Modify: `src/components/ui/market/StorageVesselMarketPanel.tsx`
- Modify: `src/components/pages/Equipment.tsx`
- Test: `tests/components/buyMarketPanels.test.ts`

- [ ] Replace cask-only wording in market columns, tooltips, price summaries, quantity labels, and Equipment with “vessel” or the catalogue display label.
- [ ] Show format plus material as one readable identity, for example `Oak cask`, `Stainless tank`, and `Ceramic amphora`; retain physical capacity as a separate column.
- [ ] Include the material construction multiplier in the existing price-breakdown tooltip and explain that it is an equipment-market factor. Do not claim a wine-quality or bottle-price benefit.
- [ ] Keep used listings faithful to the transferred asset’s catalogue identity, condition, age, fill count, and cleanliness.

#### Task 6: Verify the cutover and update the architecture record

**Files:**

- Modify: `CONTEXT.md`
- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `docs/WineSystem_VariableRelationshipMap.md`
- Modify: `docs/versionlog.md`

- [ ] Document that vessel type/material/capacity legality and market material value are active, while wine-contact effects remain deferred.
- [ ] Record that material choice currently changes the equipment asset, availability, and buy/sell market value only; it does not yet change anchors, taste, structure, score, work, condition, or cleanliness risk.
- [ ] Run focused checks:

  ```powershell
  npx vitest run tests/market/storageVesselMarketAdapter.test.ts tests/market/usedStorageVesselMarketService.test.ts tests/market/globalStorageVesselSupplierService.test.ts tests/components/buyMarketPanels.test.ts
  ```

- [ ] Run `npx tsc -p tsconfig.json --noEmit` only if the focused tests reveal a type/import concern; otherwise use the normal integration build gate later.
- [ ] Run `git diff --check` before handoff.

### Acceptance criteria

- Only the eighteen catalogue entries can be generated, purchased, or NPC-listed.
- Every vessel asset, supplier offer, and used listing carries a valid catalogue identity whose type/material/capacity snapshot matches the canonical entry.
- Local supplier stock includes all six material families through their assigned supplier; no code path silently produces an oak cask for every offer.
- NPC used generation preserves one material-specific listing per season and no longer serialises steel, concrete, ceramic, or plastic as a `cask`.
- The material multiplier is visible and affects both new and used market value, while existing supplier relationship, quality, age, condition, fill-history, and cleanliness terms continue to work.
- No wine batch score, price, taste, structure, anchor, work, cleanliness-risk, condition-wear, repair, or vessel-memory rule changes in this rollout.

---

## Proposed implementation plan: Rollout 2 — vessel-use ledger and fill-history integrity

**Status:** Implemented 2026-07-21; pending live Supabase migration/integration validation. This is deliberately the second rollout item only: record a batch’s first physical use of a vessel and make `fillHistory` trustworthy. It does **not** yet apply material effects to anchors, taste, structure, quality, price, work, condition, cleanliness risk, repair, or vessel memory.

**Implementation note:** The implementation adds a reset-only vessel-use ledger and routes first-use recording through harvest activation, appended harvest volume, and grape-market purchase allocation fills. Crushing and fermentation remain the existing batch mutation lifecycle. The migration has not been executed against a live database in this coding pass.

### Goal

Create an immutable, queryable vessel-use ledger whenever a storage allocation first receives a positive volume of a wine batch. Each vessel increments `fillHistory` exactly once for that use. The record must remain after partial emptying, full emptying, allocation release, resale, and later batch changes, so later mechanics can use real provenance rather than reconstructing it from mutable allocation rows.

`fillHistory` means **completed first-use events**, not litres transferred, weeks stored, or the number of UI actions. Filling the same allocation in several writes must create one event. Filling two different vessels for the same batch creates two events. A vessel used again for a later allocation creates another event.

This is an extension of the existing storage-allocation lifecycle, not a second fermentation or wine-batch lifecycle. Harvest storage currently fills a plan while the batch is in `grapes`; crushing and fermentation later mutate that same batch in place. Rollout 2 records the physical allocation event only. Future sensory mechanics must use the existing batch state and fermentation lifecycle, rather than starting a parallel vessel process.

### Domain decision

Add a `storage_vessel_use_ledger` relation with one row per first-positive-fill use. Its canonical identity is the allocation context: `storage_vessel_id` + `allocation_plan_id` (and a unique constraint on that pair). Store the linked `wine_batch_id`, the batch state at first fill, initial filled litres, and game date. Normal gameplay must write it atomically with the allocation fill.

The allocation remains the operational state: it can be released or have `filled_litres` reset to zero. The ledger is provenance: it is never deleted as part of emptying or releasing. `StorageVessel.fillHistory` is the fast, denormalized count; the ledger is the source of truth for normal gameplay. Because this is development-stage work, schema changes may reset the database; no legacy backfill or data-repair path is required.

### Non-goals and guardrails

- Do not create a wine feature, sensory-contact profile, anchor delta, score change, or bottle-price bonus in this rollout.
- Do not increment history merely because capacity is reserved, a plan is activated, or a vessel is marked dirty. Positive wine entry is the trigger.
- Do not derive a new `fillHistory` from current allocations in the UI. Existing allocations are mutable and lose history when emptied.
- Do not use wall-clock timestamps for gameplay meaning. Store current game year/season/week; a technical `created_at` may remain for audit only.
- Do not add a vessel activity, fermentation loop, or second batch state. The existing crushing and fermentation activities remain the only stage-transition mechanisms.
- Preserve the current allocation distribution rule: fill is assigned across the plan's allocations in order. The ledger observes that result; it does not change allocation selection.

### File-level execution plan

#### Task 1: Introduce the durable contact-ledger contract

**Files:**

- Modify: `src/lib/types/storageVessels.ts`
- Modify: `src/lib/database/winery/storageVesselsDB.ts`
- Create: one migration under `migrations/`
- Test: a focused storage-vessel database/service contract test

- [ ] Define `StorageVesselUseLedgerEntry` with ID, vessel ID, allocation plan ID, wine batch ID, batch state at first fill, initially filled litres, and game date fields.
- [ ] Add `storage_vessel_use_ledger` with foreign keys to `storage_vessels`, `storage_vessel_allocation_plans`, and `wine_batches`; use the project’s normal development reset policy rather than legacy-data accommodation.
- [ ] Add a unique constraint on `(vessel_id, allocation_plan_id)` and indexes for `vessel_id` and `wine_batch_id`.
- [ ] Add typed mapper/read helpers for ledger rows. Keep broad history queries out of the initial Equipment UI unless a small existing detail surface can show them without new UI scope.
- [ ] Seed no historic rows and implement no backfill/reconciliation command. Reset the development database when the migration is applied.

#### Task 2: Make every allocation volume-increase path record first use atomically

**Files:**

- Modify: `src/lib/database/winery/storageVesselsDB.ts`
- Modify: `src/lib/services/wine/winery/storageVesselAllocationService.ts`
- Modify: `src/lib/services/wine/winery/inventoryService.ts`
- Modify: `src/lib/database/activities/inventoryDB.ts`
- Modify: the storage allocation, harvest-append, and grape-market purchase RPC definitions under `migrations/`
- Test: `tests/wine/storageVesselAllocationService.test.ts` or the existing allocation test location

- [ ] Update all current allocation fill routes—not just `activateStoragePlanForBatch()`—to use the same first-use rule: new harvest activation, market-source batch creation, `append_storage_backed_harvest_batch`, and the atomic grape-market purchase command that creates and fills an active plan.
- [ ] In each atomic command, lock the plan, allocations, and vessels; distribute the requested volume; insert first-use ledger rows; increment affected vessels’ `fill_history`; and mark affected vessels dirty.
- [ ] Reject an already-active/mismatched plan where applicable, mismatched company or batch ownership, released allocations, non-positive volume, and over-capacity requests before any mutation.
- [ ] Insert each ledger row with `ON CONFLICT (vessel_id, allocation_plan_id) DO NOTHING`; increment `fill_history` only when that insert actually occurred. This makes retries safe.
- [ ] Record `initial_filled_litres` as the actual positive allocation volume, not the whole batch volume and not the vessel’s theoretical capacity.
- [ ] Record the batch state at first use. In the normal harvest path this is `grapes`; this is provenance only and must not itself apply a wine effect.
- [ ] Return the affected allocation/vessel IDs or a compact success result so the existing topic refresh remains accurate.
- [ ] Retire or narrow every generic allocation-fill helper so no caller can bypass ledger creation. If a helper remains for an internal use case, it must delegate to an atomic command and require batch/date context.

#### Task 3: Preserve provenance through emptying and partial emptying

**Files:**

- Modify: `src/lib/services/wine/winery/storageVesselMaintenanceService.ts` only if the RPC contract changes
- Modify: relevant emptying/release RPC definitions under `migrations/`
- Test: `tests/wine/storageVesselMaintenanceService.test.ts`

- [ ] Keep `completeEmptyStorageVessel()` responsible only for wine quantity, allocation release, and vessel availability/cleaning state; it must never delete, rewrite, or decrement contact-ledger rows or `fill_history`.
- [ ] Verify that emptying one allocation from a multi-vessel plan leaves the other allocations and their vessel-use provenance intact.
- [ ] Verify that partially emptying a vessel does not create a second history event when the plan continues, and that later completion does not create one either.
- [ ] Preserve the current resale behavior: a sold vessel retains its accumulated `fillHistory` and ledger provenance as part of its physical identity.

#### Task 4: Reset-only migration, fixtures, and architecture record

**Files:**

- Create: rollout migration under `migrations/`
- Modify: `src/lib/features/admin/services/testLab/testLabFixtureService.ts`
- Modify: relevant test fixtures
- Modify: `CONTEXT.md`, `docs/PROJECT_INFO.md`, `docs/WineSystem_VariableRelationshipMap.md`, `docs/versionlog.md`

- [ ] Treat this as a reset-only development migration: no historical ledger generation, aggregate history preservation, compatibility fallback, or reconciliation feature.
- [ ] Update Test Lab fixtures so any harvest-ready vessel path exercises the atomic first-use command rather than directly assigning history.
- [ ] Document that fill history and vessel-use provenance are active equipment data, while vessel sensory behaviour remains deferred to rollout 3 and will use the existing batch/fermentation state.

#### Task 5: Verify idempotency and lifecycle correctness

- [ ] Unit test: activating/filling one plan with one vessel creates one ledger row, records the batch’s current state, increments `fillHistory` from `n` to `n + 1`, and dirties that vessel.
- [ ] Unit test: a retry of the same atomic command neither creates a second row nor increments history again.
- [ ] Unit test: a plan split across multiple vessels creates one contact per positively filled vessel, excluding allocations with zero actual fill.
- [ ] Unit test: reserved but never filled capacity creates no contact and no history increment.
- [ ] Unit test: partial and full emptying retain ledger rows and history count.
- [ ] Unit test: a later plan using the same vessel creates a new ledger event and increments history once.
- [ ] Unit test: appending harvest volume to an already active batch preserves the existing first-use event and does not increment history again for allocations that were already positive.
- [ ] Unit test: every market-source/atomic purchase fill route creates the same ledger and history result as the harvest route.
- [ ] Run focused checks:

  ```powershell
  npx vitest run tests/wine/storageVesselAllocationService.test.ts tests/wine/storageVesselMaintenanceService.test.ts tests/market/usedStorageVesselMarketService.test.ts
  npx tsc --noEmit
  git diff --check
  ```

### Acceptance criteria

- A positive first fill creates exactly one durable vessel-use record for each affected vessel/allocation pair.
- `fillHistory` increments exactly once per durable first-use record and never on reserve, retry, empty, release, or sale.
- Vessel-use records carry the real batch, its state at first fill, plan, actual initial volume, and game date needed by later vessel-contact mechanics.
- Partial emptying and later lifecycle transitions cannot erase or duplicate provenance.
- All allocation-fill routes write first-use, history, and dirty state atomically; a client interruption cannot leave an allocation filled without its matching history event.
- No wine sensory, scoring, pricing, feature, work, condition, cleanliness-risk, repair, or vessel-memory mechanics change in rollout 2.

---

## Superseded draft: Rollout 3 — one vessel per wine batch, then bounded vessel effects

**Status:** Superseded 2026-07-22. The one-batch/one-vessel correction remains valid, but the proposed `woodContactState`, material target calculations, anchor effects, grape compatibility, feature, and price behaviour have been postponed for a later rollout. The current plan follows below.

### Non-negotiable batch topology

One non-bottled `WineBatch` occupies exactly one storage vessel at a time. The canonical path remains `WineBatch.storagePlanId` → one active allocation → one vessel; no second direct vessel ID is introduced.

A harvest may use several vessels over several game ticks, but each vessel starts or continues its own batch:

- Harvest into the same vessel again: use the existing batch for that vessel and merge compatible harvested volume through `combineWineBatches()`.
- Harvest into a different vessel: create a new batch with its own plan/allocation and batch number, for example `Barbera Helena 2026 #2` rather than adding a second allocation to `#1`.
- Once crushing, fermentation, or vessel effects mutate one batch, it naturally diverges from every other batch. Batches must never be re-merged after process mutation.

This correction means the multi-allocation portions of the rollout 2 plan and implementation are transitional only. Rollout 3 phase 1 removes that topology before any vessel effect is enabled.

### Scope and sequence

Rollout 3 is intentionally split into five independently shippable pieces. Pieces 1 and 2 are framework/schema work with no sensory, score, price, or feature behaviour. Pieces 3 through 5 introduce behaviour in controlled layers.

| Piece | Purpose | Game behaviour change? |
|---|---|---|
| 3.1 Core batch/vessel framework | Enforce one batch / one active vessel and expose pure contact context | Yes, only the required batch-splitting and allocation-topology correction; no wine-effect change |
| 3.2 Anchor model | Add the source-specific anchor and effect contracts | No; defaults are inert and no consumer reads them yet |
| 3.3 True material behaviour | Apply bounded material, condition, quality, cleanliness, fill-history, and size effects during fermentation | Yes; anchors/taste/structure can change indirectly as specified below |
| 3.4 Grape compatibility | Make grape traits alter risk and player guidance | Yes; risk changes, but no hard gate or direct style bonus |
| 3.5 Features and price | Turn severe risk into the existing oxidation feature and let existing score/price paths react | Yes, threshold risk and indirect price effects only |

## 3.1 Core — one batch / one vessel framework

### Goal

Make the storage plan a single-vessel ownership record for an active WineBatch, then provide a pure, read-only vessel-contact context. This phase deliberately creates no anchor deltas, characteristics changes, score changes, Wine Features, work changes, or price changes.

The topology correction cannot be completely behaviour-neutral: selecting a second vessel for a later harvest must create a second batch rather than silently mixing it into the first batch. That is the only intended gameplay change in this phase.

### Exact data and lifecycle changes

- `storage_vessel_allocation_plans` may have **one** allocation. Add a database uniqueness constraint on `plan_id` in `storage_vessel_allocations`, then retire APIs that add capacity/vessels to an existing plan.
- An active plan has exactly one `wine_batch_id`, one allocation, and one positive `filled_litres` value equal to the batch’s `volumeLitres`.
- `reserveStorageVesselPlan()` accepts exactly one vessel ID. `addStorageVesselCapacity()` is removed or made to reject all calls; it cannot create a second allocation.
- Harvest activity UI/workflow chooses one vessel/plan per activity. A later harvest tick can target the same planned batch only when its plan points to the same vessel and the batch is still `grapes`.
- `createWineBatchFromHarvest()` continues to call `combineWineBatches()` only for that same planned batch and same plan/vessel. A different selected vessel creates a fresh batch ID and batch number.
- Market grape purchase likewise creates one batch and one vessel plan; it cannot accept a vessel array.
- Emptying a vessel no longer redistributes a remaining batch across sibling allocations. A batch with one vessel is emptied/released as one unit. Future transfer/racking mechanics can create a new vessel-use event, but are explicitly out of scope here.
- `storage_vessel_use_ledger` records one first-use event per batch/plan/vessel. Its unique key may become `(wine_batch_id, vessel_id)` or retain the equivalent plan/vessel identity once the one-allocation invariant is database-enforced.

### Pure contact context

Add `storageVesselEffectService` with a pure `resolveStorageVesselContactContext(batch, plan, allocation, vessel)` function. It returns identity and raw inputs only:

```ts
{
  vesselId, catalogueId, vesselType, material, capacityLitres,
  qualityScore, condition, cleanliness, fillHistory,
  filledLitres, batchVolumeLitres,
  batchState, isActive,
}
```

There is no material weighting because a batch has one vessel. There is no mutation, anchor write, feature creation, market-price effect, or UI score prediction in 3.1.

### Files and verification

- Modify allocation schema/RPCs, `storageVesselAllocationService`, harvest and grape-market purchase paths, emptying flow, and vessel-selection UI.
- Add tests proving same-vessel harvest ticks merge, different-vessel ticks create distinct batches, and no plan can contain two allocations.
- Add regression tests proving crushing one batch does not mutate its sibling batch from the same harvest.

## 3.2 Anchor model — inert source-specific framework

### Answer: framework or game behaviour?

This is **framework only** if and only if the new anchor defaults to `0`, no process writes it, and taste/structure/price consumers do not read it until 3.3. Adding an anchor field by itself should not change a saved or newly created wine.

### Exact changes

Add `woodContactState: number` to `WineAnchorValues`, defaults, strict persistence/parser rules, preview-state builders, anchor snapshots, and anchor-effect typing.

`woodContactState` has one job: it represents bounded active wood contact from oak or chestnut vessels. It is not generic maturity, terroir, extraction, fermentation quality, body, or a direct price multiplier.

Do **not** add an anchor for concrete, ceramic, steel, or plastic in this piece. They have no positive sensory model yet. Continue using existing `oxidationPressure` only as the destination for future risk; do not write it in 3.2.

Add typed but inert contracts:

```ts
StorageVesselContactProfile
StorageVesselAnchorDelta { woodContactState: number; oxidationPressure: number }
StorageVesselRiskProfile
```

All 3.2 resolver outputs are zero. `wineTasteProfileService`, structure ranges, score, feature service, work calculations, and pricing remain unchanged.

### Verification

- A batch with the new default anchor serialises/deserialises correctly.
- Existing harvest/crush/ferment snapshots are unchanged with `woodContactState = 0`.
- Taste quality, structure, score, features, and estimated price are byte-for-byte unchanged by 3.2 fixtures.

## 3.3 True material behaviour — bounded fermentation effects

### Integration point

Run the pure resolver once per `must_fermenting` batch inside the existing `processWeeklyFermentation()` loop, after `applyWeeklyFermentationContactToWineAnchors()` and before the existing structure/taste recomputation. It writes only the existing batch’s anchors and breakdown. It does not create an activity, a second tick loop, or a ledger row.

The rollout 2 vessel-use ledger remains physical provenance only. Weekly contact is represented by the batch’s persisted anchors; it is not a growing event ledger.

### Shared calculations

All material profiles use these bounded inputs:

| Input | Calculation | Destination |
|---|---|---|
| `sizeContactFactor` | `clamp(sqrt(500 / capacityLitres), 0.55, 1.35)` | Multiplies wood-contact target only |
| `freshnessFactor` | Wood only: `1 / (1 + 0.25 * max(0, fillHistory - 1))` | Reduces oak/chestnut target; no effect on inert materials |
| `craftControl` | `0.65 + 0.35 * qualityScore` | Reduces unwanted risk; does not increase positive wood target |
| `integrity` | `clamp(condition, 0, 1)` | Reduces wood target below sound condition and raises risk below sound condition |
| `cleanlinessRisk` | `0` clean; `0.06` dirty | Adds to risk ceiling only |
| `woodContactState` update | Move toward material target by 12% of remaining distance per fermentation tick | Bounded at its material target; never an unlimited additive delta |
| `oxidationPressure` update | Raise only toward a vessel-risk ceiling by 8% of remaining distance | Never lowers existing oxidation pressure and never grows unbounded |

The contact resolver must use `max(0, fillHistory - 1)` so a new vessel’s first use has full fresh-material potential despite rollout 2 incrementing its history on first fill.

### Exact material outputs

| Material | `woodContactState` target | `oxidationPressure` risk ceiling | Other anchor/ledger/structure effects |
|---|---:|---:|---|
| Oak | `0.28 * sizeContactFactor * freshnessFactor * integrity` | `0.04 + 0.18 * (1 - integrity) + cleanlinessRisk` | No direct structure delta; no ledger write; taste mapping arrives below |
| Chestnut | `0.24 * sizeContactFactor * freshnessFactor * integrity` | `0.06 + 0.24 * (1 - integrity) + cleanlinessRisk` | No direct structure delta; higher risk sensitivity than oak |
| Stainless steel | `0` | `0.01 * (1 - integrity) + cleanlinessRisk` | Neutral baseline; no positive anchor delta |
| Concrete | `0` | `0.03 + 0.12 * (1 - integrity) + cleanlinessRisk` | Neutral in this rollout; do not modify `maturationState`, `terroirExpression`, `leesState`, or structure directly |
| Ceramic | `0` | `0.04 + 0.16 * (1 - integrity) + cleanlinessRisk` | Neutral in this rollout; do not modify `maturationState`, `terroirExpression`, `leesState`, or structure directly |
| Plastic | `0` | `0.08 + 0.20 * (1 - integrity) + cleanlinessRisk` | No positive anchor delta; budget capacity carries a controlled stability trade-off |

`craftControl` reduces only the risk portion above the material’s sound/clean baseline: `riskCeiling = baselineRisk + (rawRisk - baselineRisk) * (1 - 0.35 * qualityScore)`. It does not make a high-quality oak vessel taste more woody, nor does it make a low-quality steel tank create wood character.

### Taste and structure consequences

- Add `woodContactState * 0.28` to the existing oak/wood flavour family and `woodContactState * 0.10` to spice/toast descriptors in `wineTasteProfileService`.
- Do **not** add it to `maturationState`, `terroirExpression`, `extractionState`, `leesState`, or `processFootprint`.
- Do **not** directly write `structureIndex`; the existing structure calculation recomputes from its normal characteristics and anchor-adjusted ranges. Thus 3.3 may change taste quality through the wood family and may change score only through existing taste/structure calculation, never through a hidden vessel score bonus.
- Append one readable anchor-breakdown entry per tick, for example `Vessel contact (Oak cask): wood contact +0.014; oxidation risk +0.003`.

## 3.4 Grape compatibility — risk sensitivity and advice

There is no compatibility gate and no aggregate `calculateGrapeDifficulty()` input.

| Grape parameter | Exact change | Does not change |
|---|---|---|
| `proneToOxidation` | Multiplies only the vessel-derived risk above baseline by `1 + 0.75 * proneToOxidation` | Wood target, capacity, material legality, generic grape quality |
| `fragile` | Multiplies only dirty/poor-integrity risk by `1 + 0.25 * fragile` | Wood target, fermentation method, direct work cost in this rollout |
| Existing anchors | Read only for explanation: a high existing `oxidationPressure` raises the warning severity | No hidden compatibility score or forced vessel selection |

Add a preview explanation to vessel selection and the Wine modal, for example: `High oxidation sensitivity: this dirty, worn chestnut cask raises stability risk.` The preview reports the profile inputs and risk ceiling; it does not promise a score or price outcome.

## 3.5 Features and price — threshold consequences only

### Features

Normal oak/chestnut contact never creates an “oak vessel” Wine Feature. Concrete, ceramic, steel, and plastic likewise receive no positive feature.

After the 3.3/3.4 risk calculation, evaluate only the existing `oxidation` feature:

- Below `oxidationPressure = 0.72`: no feature creation; the anchor and its breakdown remain the player-facing risk signal.
- At or above `0.72`: send one explicit `storage_vessel_exposure` context through the existing feature/event service.
- The event may create or raise the existing `oxidation` feature, with initial severity `clamp((oxidationPressure - 0.72) / 0.28, 0, 0.45)`.
- Re-evaluate only when severity can increase materially; do not append duplicate feature instances every week.

This uses existing oxidation semantics. A later sanitation/contamination rollout may add a distinct feature only after its rules and player remedies exist.

### Price

There is no direct material, quality, condition, fill-history, capacity, wood-contact, or compatibility price multiplier.

Price changes only through existing consumers:

1. `woodContactState` changes the existing taste profile in 3.3.
2. `oxidationPressure`, and only at the threshold the existing `oxidation` feature, affect existing taste/score/lifecycle semantics.
3. Existing score and feature pricing logic recalculates estimated price/cellar value as it already does.

No vessel choice grants a hidden “barrel-aged premium.”

### Tests and documentation

- One-vessel topology: same-vessel harvest merge; different-vessel batch split; no multi-allocation plan; no sibling redistribution on emptying.
- Framework inertness: 3.2 produces no snapshot/taste/score/price change.
- Material tests: oak/chestnut saturate and fade by fill history; steel is neutral; concrete/ceramic do not alter wood, terroir, lees, or structure anchors; plastic has no benefit.
- Risk tests: condition, cleanliness, quality, `proneToOxidation`, and `fragile` change only the specified risk ceiling.
- Feature tests: oxidation appears once at threshold and uses existing feature semantics; no normal vessel feature appears.
- Price tests: no direct vessel multiplier exists; any observed price movement follows current score/feature paths.
- Update `CONTEXT.md`, `docs/PROJECT_INFO.md`, `docs/WineSystem_VariableRelationshipMap.md`, `docs/AIdocs/AIDescriptions_coregame.md`, and `docs/versionlog.md` after each shipped piece.

---

## Current implementation plan: Rollout 3 — minimum one-batch/one-vessel framework

**Status:** 3.1 implemented 2026-07-22; reset-only Supabase migration pending application. The remaining inert storage-context seam is deferred. This rollout corrects physical batch topology and establishes an inert, read-only storage context for future work. It deliberately makes no vessel integration into anchors, structure, taste, Wine Features, work, condition risk, or wine price.

### Goal

Make one active WineBatch occupy one and only one storage vessel. A later harvest into a different vessel becomes a different batch; a later harvest into the same eligible vessel continues the existing pre-process batch through the existing merge function.

The framework must expose the vessel currently holding a batch without deciding what that vessel means for the wine. Rollout #4 will decide and implement the first material/quality/condition/cleanliness effects after a separate design pass.

### Explicit non-goals

- Do not add `woodContactState`, another vessel anchor, material targets, or a shared material-effect formula.
- Do not change `WineAnchorValues`, anchor persistence, taste descriptors, characteristics, structure calculation, score, estimated price, cellar value, work, or Wine Features.
- Do not make `material`, `qualityScore`, `condition`, `cleanliness`, `fillHistory`, production year, or capacity change a wine batch in this rollout.
- Do not create a weekly vessel tick, a vessel activity, or any additional lifecycle alongside crushing and fermentation.
- Do not add a direct `vesselId` duplicate to WineBatch. Retain the canonical path: `WineBatch.storagePlanId` → one allocation → one vessel.

### Required batch topology

| Situation | Required outcome |
|---|---|
| First harvest tick into Vessel A | Create Batch #1, Plan A, Allocation A, Vessel A. |
| Later harvest tick into Vessel A while Batch #1 is still `grapes` | Merge compatible harvest data into Batch #1 through `combineWineBatches()`. |
| Harvest tick into Vessel B | Create Batch #2 with its own plan/allocation; never add Vessel B to Batch #1. |
| Batch #1 has started crushing or fermentation | It cannot receive more harvest volume or merge with another batch. |
| Emptying/releasing a batch’s vessel | Release that batch/plan as a unit. Do not redistribute the remaining batch into sibling allocations because sibling allocations cannot exist. |

This is the one intentional gameplay correction. A player who harvests into two vessels receives two batches that can later diverge through their chosen crushing and fermentation processes. No vessel-derived wine effect is applied yet.

### Task 1: Enforce one allocation per plan in the database

**Files:**

- Create: reset-only migration under `migrations/`
- Modify: relevant allocation, harvest-append, emptying, and grape-market purchase RPC definitions
- Modify: `src/lib/database/winery/storageVesselsDB.ts`

- [ ] Add a unique constraint on `storage_vessel_allocations.plan_id`; a plan therefore cannot contain a second vessel.
- [ ] Change reservation and purchase RPC input from a vessel array to exactly one vessel ID. Reject zero, multiple, released, unavailable, or over-capacity selections atomically.
- [ ] Retire `addStorageVesselCapacity()` and any RPC that can append an allocation to an existing plan.
- [ ] Simplify fill, append-harvest, empty, bottle, sale, and release commands to operate on the single allocation. Remove redistribution queries that assumed sibling allocations.
- [ ] Keep the reset-only development policy: reset database data rather than backfilling or preserving incompatible multi-allocation plans.

### Task 2: Split harvest batches by selected vessel

**Files:**

- Modify: `src/lib/services/wine/winery/inventoryService.ts`
- Modify: harvest activity creation/completion services and vessel-selection UI
- Modify: `src/lib/services/wine/winery/storageVesselAllocationService.ts`
- Test: winery lifecycle and harvest activity tests

- [ ] Make one harvest activity/plan select one vessel.
- [ ] Permit `plannedBatchId` only when it refers to a `grapes` batch whose active plan resolves to that same selected vessel.
- [ ] Keep `combineWineBatches()` only on that same-vessel/same-batch continuation path.
- [ ] For a different selected vessel, omit `plannedBatchId` and create a new batch number automatically.
- [ ] Block additional harvest volume once the selected batch has left `grapes`; do not attempt a post-crush merge.
- [ ] Ensure market grape purchases follow the same single-batch/single-vessel rule.

### Task 3: Provide an inert batch-storage context seam

**Files:**

- Create: `src/lib/services/wine/winery/storageVesselBatchContextService.ts` or the project’s equivalent owning module
- Modify: `src/lib/database/winery/storageVesselsDB.ts`
- Modify: `src/lib/types/storageVessels.ts`
- Test: focused batch-storage context tests

Define a read-only `StorageVesselBatchContext` containing only persisted facts:

```ts
{
  batchId, batchState, planId, allocationId,
  vesselId, catalogueId, vesselType, material, capacityLitres,
  qualityScore, condition, cleanliness, fillHistory,
  filledLitres, batchVolumeLitres,
}
```

- [ ] Add one resolver that validates the one-plan/one-allocation invariant and returns this context for a batch.
- [ ] Return `null` or a typed invariant error for bottled batches, missing plans, released allocations, or invalid topology; do not silently choose one vessel from multiple rows.
- [ ] Allow Equipment and Wine UI to show the linked vessel identity and factual state only if a suitable surface already exists. Do not show a quality forecast, compatibility label, or wine-effect explanation.
- [ ] Do not calculate a contact profile, deltas, targets, risk ceiling, or material modifier here. This is a stable data boundary for rollout #4, not a gameplay service.

### Task 4: Align the vessel-use ledger

**Files:**

- Modify: the rollout 2 ledger migration/RPCs as required before applying migrations to the reset database
- Modify: `src/lib/database/winery/storageVesselsDB.ts`
- Test: storage vessel allocation/ledger tests

- [ ] Keep one first-use ledger row per physical batch/vessel use and one `fillHistory` increment per row.
- [ ] Validate that the ledger’s batch, plan, allocation, and vessel all resolve to the one-vessel topology.
- [ ] Do not write weekly ledger events, effect progress, anchor data, risk, or sensory data to the ledger.
- [ ] Confirm that a new batch created for Vessel B receives its own first-use row while a same-vessel continuation of Batch #1 does not duplicate its row.

### Task 5: Verification and handoff to rollout #4

- [ ] Test same-vessel harvest continuation merges only the eligible `grapes` batch.
- [ ] Test different-vessel harvest creates a second batch with a distinct plan, allocation, vessel, and first-use ledger row.
- [ ] Test database/RPC rejection of a second allocation on a plan.
- [ ] Test crushing or fermenting one batch cannot mutate, merge, release, or reassign its sibling batch.
- [ ] Test all existing wine anchors, characteristics, structure, taste, score, features, and price remain unchanged for equivalent one-vessel fixtures.
- [ ] Run focused winery lifecycle, storage allocation, harvest activity, grape-market purchase, and maintenance tests; apply and verify the reset-only migration through Supabase before handoff.

### Acceptance criteria

- A non-bottled WineBatch has exactly one active storage allocation and therefore one vessel.
- Harvesting into another vessel creates a new wine batch; same-vessel pre-process harvest continues only its own batch.
- The vessel-use ledger and `fillHistory` remain correct under the one-vessel topology.
- `StorageVesselBatchContext` exposes facts but has no interpretation or wine-effect output.
- No material, quality, condition, cleanliness, fill-history, capacity, anchor, structure, taste, feature, work, score, or price mechanic changes.
- Rollout #4 can consume the context seam without revisiting batch identity or physical storage topology.
