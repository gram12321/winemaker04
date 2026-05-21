# Research Mechanic Design
**Date:** 2026-05-21  
**Status:** In Progress — immediate changes applied, further work planned

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

### 3.1 UnlockType — Collapsed to Active Systems

**Removed** unused unlock types that have no game enforcement path yet:
- `vineyard_size` — no max-hectares cap exists in any system
- `staff_limit` — no hire cap exists in any system
- `building_type` — buildings are not a game system yet

**Kept** unlock types that either work or have a clear near-term enforcement path:

| Type | Status |
|---|---|
| `grape` | ✅ Enforced in PlantingOptionsModal |
| `fermentation_technology` | Defined, maps to real fermentation methods — enforcement is next step |
| `wine_feature` | Defined, wine feature system exists — enforcement is next step |
| `contract_type` | Defined, sales system exists — enforcement is next step |

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

These should gate the existing fermentation options in `FermentationOptionsModal`. Currently all three methods are freely available — gating the advanced ones adds real progression.

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

### 4.4 Sales Channel Track (New Unlock Type: `sales_channel`)

| Project ID | Title | Effect (proposed) | Connects to |
|---|---|---|---|
| `sales_export_license` | Export License | Unlocks selling to countries beyond starting country | Sales + customer system |
| `sales_wine_club` | Wine Club Program | Unlocks direct-to-consumer subscription orders | Sales/order generation |
| `sales_fine_wine_cert` | Fine Wine Certification | Unlocks Private Collector premium contract tiers | Contract system |
| `sales_restaurant_program` | Restaurant Partnership | Better relationship growth rate with Restaurant customers | Customer system |

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

*Planned — not yet implemented.*

Each starting country should pre-unlock research appropriate to its wine tradition:

| Country | Pre-unlocked Research |
|---|---|
| France (Burgundy) | MLF research (standard for Pinot Noir/Chardonnay), Canopy Management |
| Italy (Tuscany) | Extended Maceration (essential for Sangiovese), Cover Cropping |
| Germany (Mosel) | Precision Viticulture (Riesling timing precision critical) |
| Spain (Ribera del Duero) | Oak Barrel Program (Tempranillo oak aging tradition) |
| USA (Napa) | Wine Club Program (direct-to-consumer strong in Napa), Temperature-Controlled Fermentation |

**Implementation path:** Add `startingResearch?: string[]` to `StartingCondition` interface. In `startingConditionsService.ts`, after `grantStartingGrapeUnlock`, iterate `startingResearch` and call `grantResearchUnlock` for each.

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
| `fermentation_technology` | `FermentationOptionsModal` — gray-out locked methods |
| `wine_feature` | Wine feature activation in winery — gate advanced features |
| `contract_type` / `sales_channel` | Contract generation — filter locked contract types |
| `equipment` | Activity creation for activities requiring specific equipment |
| `vineyard_technique` | Vineyard action modals — gate advanced options |

---

## 7. UI / UX Improvements

### 7.1 Completed State (Applied This Session)

- Completed cards: green background, "Completed ✓" button, non-clickable
- Locked cards: amber warning, specific lock reason (prestige or prerequisite)
- Prestige loaded async, displayed per card

### 7.2 Active Bonuses Panel (Planned)

A dedicated read-only panel or section showing all **active research effects** currently affecting the player's winery:  
> "Temperature-Controlled Fermentation unlocked — reduces oxidation pressure by 30%"  
> "Canopy Management unlocked — overgrowth accumulates 15% slower"

Without this, players complete research and feel nothing. The bonus panel makes the portfolio visible.

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
