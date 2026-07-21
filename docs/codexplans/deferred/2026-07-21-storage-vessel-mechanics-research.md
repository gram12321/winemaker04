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

**Status:** Planned, not executed. This is deliberately limited to the first rollout item from the research above. It establishes which vessel assets can exist and how their market value differs by material. It does **not** add vessel contact, wine-quality, work, cleanliness-risk, condition-wear, repair, or memory mechanics.

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
