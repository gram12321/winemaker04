# Research Mechanic Design
**Date:** 2026-05-21  
**Status:** Living spec with implementation status through 2026-05-22

---

## 1. Problem Statement

The research system had a well-built infrastructure skeleton (DB persistence, feature module, activity system, work calculator) but the actual design was never done. Only grape variety unlocks were wired end-to-end. All other unlock types were defined speculatively but never enforced anywhere in the game. The UI did not show completed research. Grant projects had negative ROI. There was no gating beyond money.

---

## 2. What Was Already Working (Before This Session)

- `grape` unlock type: enforced in `PlantingOptionsModal` and shown in `GrapeVarietiesTab`
- Starting conditions grant the regional starting grape via `grantStartingGrapeUnlock`
- Activity system: research creates activities, deducts cost, grants prestige and money rewards on completion
- Database persistence: `research_unlocks` table, full CRUD layer in `researchUnlocksDB.ts`
- Feature module pattern: `active.tsx` / `noop.ts` clean seam, fully typed

---

## 3. Changes Applied This Session (Already Implemented)

### 3.1 UnlockType — Current Runtime State

Unlock types with active runtime meaning now include:

| Type | Current state |
|---|---|
| `grape` | ✅ Enforced in planting and displayed in Winepedia locks. |
| `fermentation_technology` | ✅ Enforced in fermentation method selection (advanced methods locked until unlocked). |
| `vineyard_size` | ✅ Enforced in land-search / vineyard expansion cap flow. |
| `staff_limit` | ✅ Enforced in staff hiring cap flow. |
| `contract_type` | ✅ Enforced in contract generation eligibility. |
| `wine_feature` | Defined but still mostly future-facing for direct gameplay gating. |
| `grape_buyer_slots` | ✅ Enforced in grape buyer market generation capacity. |
| `grape_buyer_limit_multiplier` | ✅ Enforced in seasonal grape buyer hard-limit scaling. |
| `grape_buyer_multiplier_bonus` | ✅ Enforced in grape buyer multiplier bonus pipeline. |

### 3.2 ResearchProject Interface — New Fields

Added to `ResearchProject`:
```typescript
requiredPrestige?: number;   // Minimum prestige to start this research
prerequisites?: string[];    // Project IDs that must be completed first
```

### 3.3 Grant Economics — Fixed

**Before:** Grant projects cost more than they reward (negative ROI, no reason to do them).  
**After:** Grants give meaningful positive returns, useful for early-game cash injection.

| Project | Before (reward) | After (reward) | Cost (approx) | Net |
|---|---|---|---|---|
| Basic Research Grant | €1,000 | €15,000 | ~€7,000 | +€8,000 |
| Advanced Research Grant | €5,000 | €40,000 | ~€11,000 | +€29,000 |

Advanced grant now also requires `project_grant_basic` as prerequisite and prestige 10 (track record before larger funding).

### 3.4 Prestige Thresholds + Prerequisites — Applied to Projects

Tiers:
- **Tier 0** (always available): Administration, basic grants, marketing research, staff training, simple grape research
- **Tier 1** (prestige 10): Advanced grants, marketing research, basic tech
- **Tier 2** (prestige 15): Technology research (soil, fermentation)
- **Tier 3** (prestige 20–25): Efficiency research, complex grape varieties (complexity 7+)
- **Tier 4** (prestige 30+): Very rare grapes (complexity 9–10)

Prerequisite chains applied:
- `project_grant_advanced` requires `project_grant_basic`
- `tech_fermentation` requires `admin_basic`
- `eff_operational` requires `admin_basic`

### 3.5 Completed Research UI — Fixed

**Before:** ResearchPanel never loaded completed research from the database. Cards always showed "Start Research" even for completed projects. Had a `// TODO` comment.

**After:**
- Completed research is loaded from `researchUnlocksDB` on mount and on game updates
- Completed cards show green background, checkmark, disabled button
- Locked cards (prestige or prerequisite) show amber warning with specific reason
- Prestige is loaded via `getCurrentPrestige()` and used to evaluate lock state

---

## 4. Research Project Catalog — Redesign (Planned)

The current non-grape projects are generic business-school text with no connection to game systems. This section defines what the projects should actually be.

### 4.1 Fermentation Methods Track

The baseline implementation now gates advanced options in `FermentationOptionsModal`.

- Basic remains always available.
- Temperature Controlled and Extended Maceration are now unlock-gated.
- Additional methods listed below remain design targets and are not implemented yet.

| Project ID | Title | Effect | Prestige Req | Prerequisite |
|---|---|---|---|---|
| *(rename)* `tech_fermentation_temp` | Temperature-Controlled Fermentation | Unlocks Temperature Controlled method; reduces oxidation pressure | 10 | — |
| *(rename)* `tech_fermentation_ext` | Extended Maceration | Unlocks Extended Maceration method; higher phenolic/tannin, higher stuck-fermentation risk | 15 | `tech_fermentation_temp` |
| `tech_fermentation_mlf` | Malolactic Fermentation | New option: converts sharp malic acid to soft lactic acid; reduces acidity, increases body | 20 | `tech_fermentation_temp` |
| `tech_fermentation_natural` | Wild/Natural Fermentation | New option: no commercial yeast; higher complexity potential, higher fault risk | 30 | `tech_fermentation_mlf` |
| `tech_fermentation_carbonic` | Carbonic Maceration | New option: whole-cluster intracellular fermentation; fruity/low-tannin profile | 25 | — |

**Note:** Enforcement requires updating `FermentationOptionsModal` to check `isUnlocked('fermentation_technology', method)`.

### 4.2 Vineyard Techniques Track

| Project ID | Title | Effect (proposed) | Connects to |
|---|---|---|---|
| `agri_green_harvest` | Green Harvesting | -20% yield, +quality on remaining grapes (affects `aromaticPotential`, `phenolicPotential`) | Harvest calculation |
| `agri_canopy_management` | Canopy Management | Reduces overgrowth pressure rate; improves `vineyardHealth` regen | Vineyard health system |
| `agri_precision_viticulture` | Precision Viticulture | Reveals hidden site metrics; +`terroirExpression` | Terroir system |
| `agri_cover_cropping` | Cover Cropping | Slower health recovery but higher `terroirExpression` ceiling | Terroir + health |
| `agri_biodynamic` | Biodynamic Certification | Unlocks biodynamic contract types; `terroirExpression` multiplier | Contract system, terroir |

### 4.3 Equipment Track (New Unlock Type: `equipment`)

Physical tools that create visible work-speed or quality multipliers.

| Project ID | Title | Effect (proposed) | Connects to |
|---|---|---|---|
| `equip_optical_sorter` | Optical Sorter | Reduces fault risk on fragile/prone-to-oxidation grapes before crush | Wine feature risk |
| `equip_pneumatic_press` | Pneumatic Press | Improves white wine structure and taste quality (gentler pressing) | Structure channels |
| `equip_harvest_machine` | Harvest Machine | Faster harvest work rate; slight fragility penalty | Work calculator |
| `equip_wine_lab` | Wine Analysis Lab | Reveals exact `structureIndex` and `tasteQualityIndex` before bottling | UI/information |
| `equip_oak_barrels` | Oak Barrel Program | Unlocks barrel aging option; adds `maturationState` modifier | Aging system |

### 4.4 Sales Channel Track (Implemented)

| Project ID | Title | Effect (proposed) | Connects to |
|---|---|---|---|
| `sales_export_license` | Export License | Unlocks selling to countries beyond starting country | Sales + customer system |
| `sales_wine_club` | Wine Club Program | Unlocks direct-to-consumer subscription orders | Sales/order generation |
| `sales_fine_wine_cert` | Fine Wine Certification | Unlocks Private Collector premium contract tiers | Contract system |
| `sales_restaurant_program` | Restaurant Partnership | Better relationship growth rate with Restaurant customers | Customer system |

**Status:** Implemented through `contract_type` unlocks and contract generation filtering.

---

## 5. Gating System Design

### 5.1 Three-Layer Gate Model

**Layer 1 — Time + Money only (always accessible):**
- Basic admin, basic grant, simple grape research, marketing research, staff training
- Goal: something useful to do from week 1

**Layer 2 — Prestige-gated (proven track record):**
- Advanced grants, technology research, complex grapes
- Logic: "You need reputation before world-class experts take your calls"
- Thresholds: 10 (basic track record), 25 (known winery), 50 (premium/world-class)

**Layer 3 — Prerequisite-chained (tech tree):**
- Advanced fermentation requires basic fermentation
- Natural fermentation requires temperature-controlled fermentation first (understand control before abandoning it)
- Biodynamic certification requires cover cropping or precision viticulture
- Creates shallow but meaningful tech tree

### 5.2 Starting Conditions as Regional Head-Starts

Implemented.

Each starting country now pre-unlocks research through `startingResearch` in `StartingCondition`, applied in `applyStartingConditions` after starting grape unlock:

| Country | Pre-unlocked Research |
|---|---|
| France | `admin_basic`, `tech_fermentation` |
| Italy | `admin_basic`, `mkt_research` |
| Germany | `admin_basic`, `tech_soil_analysis` |
| Spain | `admin_basic`, `mkt_research` |
| United States | `admin_basic`, `project_grant_basic` |

This intentionally bypasses normal prestige/prerequisite progression for the regional head-start slice.

### 5.3 Achievement-Triggered Research Visibility

*Planned — not yet implemented.*

Instead of gating on prestige alone, some research should only *appear* in the UI after achieving a milestone. Reduces early overwhelm.

| Trigger | Research revealed |
|---|---|
| First gold wine score (≥0.80 wineScore) | Fine Wine Certification |
| 10 completed harvests | Precision Viticulture |
| Sold to 3 different countries | Export expansion track |
| First completed bottling run | Oak Barrel Program |
| First completed contract | Restaurant Partnership Program |

### 5.4 Site-Conditional Research

*Planned — advanced, implement after core gating is stable.*

Some research only appears if you own a suitable site:
- Drip Irrigation → requires a hot/dry climate vineyard
- Frost Protection → requires a cold-climate vineyard
- Altitude Viticulture → requires a high-altitude plot

---

## 6. Unlock Enforcement Points

For each unlock type, where the game must check `isUnlocked()`:

| Type | Enforcement location |
|---|---|
| `grape` | `PlantingOptionsModal` ✅ done |
| `fermentation_technology` | `FermentationOptionsModal` ✅ locked methods and research hints |
| `staff_limit` | `HireStaffModal` ✅ headcount cap from unlocked staff-limit values |
| `vineyard_size` | `LandSearchOptionsModal` and `LandSearchResultsModal` ✅ max-hectare cap from unlocked values |
| `contract_type` | `contractGenerationService` ✅ eligible customer type filtering |
| `grape_buyer_slots` | Grape buyer generation pipeline ✅ seasonal option-count increases |
| `grape_buyer_limit_multiplier` | Grape buyer generation pipeline ✅ seasonal hard-limit multiplier |
| `grape_buyer_multiplier_bonus` | Grape buyer generation pipeline ✅ final multiplier bonus |
| `wine_feature` | Planned for deeper feature-activation gating |
| `equipment` | Planned (system not yet implemented) |
| `vineyard_technique` | Planned (dedicated track not yet implemented) |

---

## 7. UI / UX Improvements

### 7.1 Completed State (Applied This Session)

- Completed cards: green background, "Completed ✓" button, non-clickable
- Locked cards: amber warning, specific lock reason (prestige or prerequisite)
- Prestige loaded async, displayed per card

### 7.2 Active Bonuses Panel (Implemented)

A dedicated read-only panel or section showing all **active research effects** currently affecting the player's winery:  
> "Temperature-Controlled Fermentation unlocked — reduces oxidation pressure by 30%"  
> "Canopy Management unlocked — overgrowth accumulates 15% slower"

This panel now exists on the Research page and shows permanent bonuses derived from completed research.

### 7.3 Research Tree Visualization (Future)

Simple visual prerequisite chain — shows which projects unlock others. Helps players plan rather than just browse a flat list.

---

## 8. Balance Guidelines

### 8.1 Cost Model Issues

The current cost formula: `baseCost × (1 + (complexity - 1) × 0.20)` hasn't been calibrated against wine revenue curves.

Rough targets:
- Early-game research (complexity 2–3): affordable after 5–10 successful bottle sales (~€5k–€10k range)
- Mid-game research (complexity 5–6): requires a good season (~€15k–€25k range)
- Late-game research (complexity 8–10): requires sustained profitable operations (~€40k–€80k range)

### 8.2 Work Duration Issues

Complexity-10 grape research = 500 work units. With 1 staff member at 25 work/week → 20 weeks (~5 months). That's long for unlocking a grape variety. Consider:
- Low complexity grapes (2–3): 4–6 weeks
- Mid complexity grapes (4–6): 8–12 weeks  
- High complexity grapes (8–10): 15–20 weeks (intentionally slow, rare grapes)

### 8.3 Prestige Reward Scale

Current rewards (2–15 prestige) need calibration against the prestige economy. If prestige gates are at 10/25/50, then rewards need to contribute meaningfully to reaching those thresholds.

---

## 9. Open Questions / Future Decisions

1. **Should fermentation methods stay as a single unlock type or become method-level unlocks?** The current `fermentation_technology` type unlocks a named technology — but should `Temperature Controlled` specifically be the value? Or should it be a general tech level?

2. **Should basic fermentation (the current default) ever be locked?** No — at least one method must always be free. Only the advanced methods should be gated.

3. **Should research be repeatable?** Currently: no (once completed, it's done). Some grants could logically be re-applied every N years. Worth considering for grant projects specifically.

4. **Multi-vineyard research:** When a player has multiple sites in different countries, do country-specific research unlocks apply globally or per-site?

5. **Staff skill requirements:** Should some research require a staff member with a minimum skill level? This would connect the research and staff systems more tightly.

---

## 10. Status Update (2026-05-22)

### 10.1 Implemented Since This Spec

- Research complexity is now consistently generic across categories for work, cost, and prestige.
- Non-grape categories now use explicit `workProfile` pacing controls.
- Staff and vineyard progression ladders were expanded and enforced:
	- Staff cap ladder now extends into late game (through 100).
	- Vineyard cap ladder now extends into late game (through 2000).
- Fermentation technology gating is enforced in fermentation option selection.
- Sales channel gating is enforced in contract generation eligibility.
- Starting-condition regional research head-starts are implemented via `startingResearch`.
- Permanent non-unlock technology effects are now implemented via runtime aggregation of completed research unlocks.
	- First minimum slice: vineyard health decay reduction through a typed permanent effect.

### 10.2 Historical Notes Corrected

- The old "permanent non-unlock technology effects" TODO is no longer accurate.
	- Permanent effects are now applied at runtime by domain services.

## 11. Not Implemented Yet (Kept Intentionally)

The items below are intentionally kept visible for future work and should not be treated as removed. Implemented rows are retained here as status markers so the original design conversation stays auditable.

| Item | Current State | Recommendation |
|---|---|---|
| Vineyard techniques track (`agri_canopy_management`, etc.) | Not implemented as dedicated projects | Ready for implementation using the new `permanentEffects` + explicit service hook pattern. |
| Equipment track (`equipment` unlock type) | Not implemented | Keep for later; only implement once equipment exists as a real gameplay system. |
| Contract type track (`contract_type` unlock type) | Implemented | Uses contract-type unlocks directly in contract generation. |
| Starting-condition research head-starts | Implemented | Continue balancing country presets after playtest telemetry. |
| Achievement-triggered research visibility | Not implemented | Good later slice after baseline research discoverability UX is validated. |
| Site-conditional research visibility | Not implemented | Defer until core gating and balance stabilize across more playthroughs. |
| Active bonuses panel | Implemented | Now visible on the Research page as a runtime permanent-bonuses summary. |

## 12. Known Documentation/Design Debt

- A subset of project `benefits` strings still describe intended outcomes without a direct mechanical implementation.
- Until those mechanics are wired, treat unlock payloads and permanent effects as the authoritative gameplay-impact source.
- Future pass should align each benefit line to one of: implemented unlock, implemented permanent effect, or clearly tagged future design intent.

## 13. Suggested Next Slices

1. Add broader permanent-effect categories beyond vineyard health decay.
2. Implement one vineyard-technique project from section 4.2 via the permanent-effects framework.
3. Rebalance prestige thresholds and costs after telemetry/playtest feedback from the new ladders and gates.
