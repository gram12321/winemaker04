# Early-Game Balance: Founder Economy & Starting Conditions
**Created:** 2026-05-20  
**Status:** Partially implemented. Code-verified on 2026-05-25: founder wage replacement, yearly profit-share distributions, founder buyout, staff `isFounder` persistence, and Founder Panel UI are now shipped; story-triggered staff reveals, startup advisor, separate founder-equity table, and broader country archetypes remain open.
**Branch context:** taste  

---

## 1. Problem Statement

The user flagged that starting staff wages create severe early-game balance problems. The first 1–2 years of play produce almost no income (grapes are growing, wine is fermenting), yet wages are charged every season (every 12 game weeks). The result is that several countries go bankrupt before making a single sale.

> *"The starting staff wages causes us some balance issues. Basically the first few years is going to bring in very little income, so it doesn't really work that wages for the starting crew is so high."*

---

## 2. Technical Background

### Wage Formula
```
wage/week = (BASE_WEEKLY_WAGE[500] + avgSkillLevel × SKILL_WAGE_MULTIPLIER[1000]) × 1.3^numSpecializations
```
Wages are paid **seasonally** (lump sum at Week 1 of each season = every 12 weeks).

A competent (0.5 skill) worker with 1 specialization costs approximately **€1,300–1,400/week → €15,600–16,800/season**.

### Timeline to First Income
- Spring Y1: Start. Tend vineyard.
- Fall Y1: Harvest (Season 3).
- Winter Y1: Crushing + fermentation (Season 4).
- Spring Y2: Bottling + first possible sales (Season 5).
- **= 5 seasonal wage payments before any revenue.**

### Starting Conditions Per Country (First Company — player always contributes €100,000)

| Country | Staff | Total Liquid | Seasonal Wages | Seasons to Bankruptcy | Est. First Harvest | Est. Y2 Revenue |
|---------|-------|-------------|----------------|----------------------|--------------------|-----------------|
| France  | 2     | €180k (+ €80k loan) | ~€31,200 | ~5–6 | ~75 bottles | €900–1,500 |
| Italy   | 2     | €148k (+ €48k loan) | ~€31,200 | ~4–5 | ~294 bottles | €4,000–5,000 |
| Germany | 4     | €100k (NO loan)     | **~€63,000–69,000** | **~1–2** | ~357 bottles | €4,000–5,000 |
| Spain   | 1     | €105k (+ €5k loan)  | ~€15,600 | ~6+ | ~429 bottles | €6,000–8,000 |
| US      | 2     | €100k (NO loan)     | ~€31,200 | ~3   | ~79 bottles | €1,200–2,000 |

**Key findings:**
- **Germany (🔴 CRITICAL):** 4 staff + no loan = bankrupt before Season 3. Unsustainable by a factor of ~3×.
- **United States (🔴 CRITICAL):** No loan buffer, tiny young vineyard (3-year-old vines, 0.055 ha). Bankrupt by end of Year 1.
- **France (🟡 DIFFICULT):** Loan provides buffer but vineyard is tiny (~75 bottles first harvest). Extremely tight by Year 2.
- **Italy (🟡 MANAGEABLE):** Decent vineyard size saves it. Survivable with care.
- **Spain (🟢 REFERENCE):** Well-balanced. One staff, mature vines, large cash buffer. This is the target feel.

### Root Causes
1. `BASE_WEEKLY_WAGE = 500` is too high as a baseline floor.
2. Germany's 4-staff configuration has no financial counterbalance.
3. The timeline mismatch is structural — 5 wage cycles before first income.
4. Starting vineyard health is only 0.6, reducing first harvest by ~40% vs healthy vines.

---

## 3. Conventional Fixes (First Pass)

These are numerically sound but not highly creative:

| Fix | Change | Impact |
|-----|--------|--------|
| Lower BASE_WEEKLY_WAGE | 500 → 250 | ~19% cost reduction across all staff |
| Germany: cut to 2 staff | 4 → 2 founders, lock Lukas+Klara behind milestones | Removes critical bankruptcy risk |
| Add US starting loan | ~€60k bank loan, 32 seasons, 2% | Extends US runway by 2 seasons |
| Improve vineyard health | 0.6 → 0.80 | +33% first harvest |
| France min vineyard size | 0.04 ha → 0.08–0.10 ha | Doubles first harvest |
| First-season wage holiday | No wages Season 1 | Universal breathing room |

---

## 3.1 Implementation Sync (2026-05-25)

Shipped since this design was first written:

- Starting staff can be founders through `isFounder`.
- Founders are created with zero weekly wage and receive yearly Founder Return distributions from net profit.
- Founder buyout converts a founder to a salaried employee.
- The Finance view includes a Founding Partners panel.
- The staff table has an `is_founder` migration-backed persistence field.

Still open:

- automatic founder conversion milestones,
- separate `founder_equity` table,
- story-triggered family/staff reveal flow,
- startup bankruptcy advisor,
- broader country-archetype systems beyond current founder and grape-market mechanics,
- explicit founder-economy test coverage.

---

## 4. Out-of-the-Box Ideas (Second Pass)

### 4.1 Founder Profit-Share Model (Player's Idea — Expanded)
Starting staff are **founders, not employees.** They take:
- **Zero wages** in the early game
- A **profit share** (e.g. 15–25% of gross wine sales split among founders)
- In lean years (no sales): **zero cost to the company**
- In good years: they earn proportionally — fair and thematic

**Transition triggers** (when founders convert to salaried employees):
- First season with income > threshold (e.g. €10,000)
- A story event fires: *"Pierre has been carrying the business for two years. He's ready for a real salary."*
- Player explicitly promotes them via an HR action in the Staff management screen

This aligns with how real family wineries actually work in the first few years.

**Current implementation note (2026-05-25):** The shipped slice stores `staff.isFounder` directly on staff and persists it as `staff.is_founder`. Founders have zero weekly wage, receive yearly Founder Return distributions from positive yearly net profit, and can be manually bought out into salaried staff. A separate `foundingSharePercent` field and automatic conversion trigger are not implemented.

---

### 4.2 Country Economic Archetypes
Rather than patching each country numerically, give each country a **structurally different economic model** for the early game. This creates genuine variety in how each country *plays*, not just different numbers.

| Country | Archetype | Early-Game Mechanic | Tension |
|---------|-----------|---------------------|---------|
| **France** | *Family Labor* | Founders work for free on profit share. Tiny vineyard — live/die on quality. | Quality or bankruptcy |
| **Italy** | *Artisan Grant* | Italian wine board gives a 2-year non-repayable subsidy. Must meet DOC quality standard by Year 3. | Government support vs quality pressure |
| **Germany** | *Cooperative Member* | Local Winzergenossenschaft buys raw grapes every Fall at low fixed price. **Instant Year 1 income, no bottling required.** | Sell bulk now vs bottle for prestige later |
| **Spain** | *Family Legacy* | Large cash buffer but a yearly "family obligation" payment to a patriarch. Ends when prestige crosses a threshold. | Freedom vs obligation |
| **United States** | *Angel Investor* | Silent investor provides operating capital tied to milestones (first wine, first A-grade, etc.). Repay in equity/prestige, not cash. | Growth pressure vs creative freedom |

Each creates a mechanically distinct early game without every country just getting a loan.

---

### 4.3 Story-Driven Family Member Reveals
**Principle:** Each country starts with fewer staff than the "full" family complement. Additional members arrive via story beats — time, achievements, or narrative events. This:
- Keeps early costs minimal
- Makes staff growth feel earned and emotionally meaningful
- Creates replay value ("when does Lukas show up this run?")

**Germany (Weissburg) example:**
| Trigger | Event |
|---------|-------|
| Start | Johann alone (founder profit-share) |
| After Fall Y1 harvest | *"Your cousin Lukas heard you finally started the winery. He wants in."* — joins as profit-share worker |
| First wine sale | Elsa returns from business school to manage sales — joins as wage employee |
| Year 3 OR Prestige > 10 | Klara joins as researcher/admin |

**France, Italy, US, Spain** all follow the same pattern with country-appropriate narrative flavor.

---

### 4.4 Player Control Over Starting Conditions + Bankruptcy Advisor
During company creation, add a **"Starting Setup" configuration step**:

**What the player controls:**
- Vineyard size (slider within country-allowed range: e.g. France 0.04–0.15 ha)
- Starting loan amount (optional, country-specific max)
- Staff composition (which founders join from Day 1 vs arrive later)

**Advisor panel (live feedback as player adjusts sliders):**
```
┌─────────────────────────────────────────────────┐
│ Financial Forecast                              │
│ Monthly expenses:     €10,400                  │
│ Est. first income:    Spring Year 2            │
│ Runway at start:      14 months               │
│                                                 │
│ ⚠️  Warning: Estimated cash runs out before    │
│    first harvest. Consider a starting loan     │
│    or reducing starting staff.                 │
└─────────────────────────────────────────────────┘
```

Players who choose a hard setup do so with **full information** — no surprise bankruptcies. The advisor uses the same yield/wage math the game already has.

**UI design note:** Show three difficulty tiers with recommended presets:
- *"The Family Way"* (low risk): profit-share founders, modest loan, small vineyard
- *"Standard Start"* (medium): current default + advisor warnings fixed
- *"The Gamble"* (high risk): aggressive setup the player knows might fail

---

### 4.5 Cooperative / Bulk Sales Bridge Income
Allow players to sell **raw grapes or bulk (unbottled) wine** to a cooperative:
- Price: ~€0.50–1.50/kg (no quality multiplier, no prestige gain)
- **Available immediately after harvest** — no bottling delay
- Creates genuine Y1 income even without wine production
- Core tension: *sell grapes now (survive) or bottle them (build brand but risk cash)*

Germany gets this thematically (Winzergenossenschaft cooperative). France gets a négociant buyer. Italy can sell sfuso (bulk wine). US/Spain don't have this option by default — their archetypes push different tradeoffs.

---

### 4.6 Harvest Forward / Pre-Sale Contracts
An optional **pre-sale contract** at company creation or early game:
- A local restaurant pays **€2,000–6,000 upfront** for a guaranteed delivery of X bottles next year
- Minimum quality threshold (score > 0.4) or it's a breach event
- Provides critical cash injection **in Month 1** before any harvest
- Introduces the contract/delivery mechanic early as a soft tutorial

This is thematically real: en primeur (wine futures) is a foundational part of Bordeaux's economy.

Detailed split-design for this section (Wine Pre-Sale Contracts + Harvest Forward Contracts):
`docs/superpowers/specs/2026-05-25-harvest-forward-presale-contracts-design.md`

---

### 4.7 Seasonal vs. Permanent Staff Model
Some starting staff are **seasonal contract workers**, not full-time employees:
- They only bill during Fall (harvest) and Winter (crushing/fermentation)
- Spring/Summer: zero cost
- Historically accurate for vineyard labor
- Creates a **full-time vs seasonal** hiring decision layer

Germany could start with Johann as permanent + 2 seasonal harvest workers. This massively reduces the off-season wage bill while preserving the large-winery flavor.

---

## 5. Architecture Decisions (Pre-Implementation Feedback)

### The Existing Feature Pattern
The `loanLender` feature establishes the injection model. Each optional/overlay feature follows:
```
src/lib/features/<featureName>/
  featureTypes.ts   ← interface hooks
  noop.ts           ← stub (feature disabled)
  active.tsx        ← live implementation + UI wiring
  index.ts          ← registry: configure*Feature() + get*Feature()
```
Historical architecture option: the base service could call `getFounderEconomyFeature().ticks.processFounderDistributions(companyId)`. Current implementation did not create a `founderEconomy` feature seam; founder logic lives in `src/lib/services/finance/wageService.ts`, `src/lib/services/user/staffService.ts`, `src/components/finance/FounderPanel.tsx`, `src/lib/constants/staffConstants.ts`, and `src/lib/constants/startingConditions.ts`.

### Feature Bucketing
| Feature | Where it lives | Pattern |
|---------|---------------|---------|
| **Sell Grapes** | `src/lib/features/sellGrapes/` OR `src/lib/services/sales/sellGrapesService.ts` | Full standalone feature — no StarterCondition prefix |
| **Founder Profit-Share** | Current: finance/staff services + `FounderPanel`; historical option: `src/lib/features/founderEconomy/` | Shipped without feature seam; optional future seam only if ownership grows |
| **Country Archetypes** | `src/lib/features/countryArchetype/` | StarterConditionXFeature — per-country modifier registry |
| **Story Staff Reveals** | `src/lib/features/storyEvents/` | Event service; hooks into achievement/season-advance |
| **Starting Advisor** | Extend company creation component | Use existing `WarningModal` (severity: 'warning', custom actions) |

### Story Events Architecture
- Winemaker04 has NO existing tutorial system (only `notificationService` + `WarningModal`)
- Build a lean `storyEventService` with `StoryEvent { id, trigger, character, text, choices? }`
- Triggers map to existing hooks: first_harvest → `harvestWorkCalculator`, year advance → season tick, achievement → `achievementService.unlockAchievement`
- `StoryEventDialog.tsx` = enriched `WarningModal` with character name/portrait slot
- Keep events isolated — Simulus01's chained tutorial limitation is a known hazard

### What NOT to Do
- Don't give all countries a loan — kills variety
- Don't lower `BASE_WEEKLY_WAGE` globally without understanding late-game impact
- Don't port full Simulus01 tutorial system — overkill; build lean event service

### DB: Founder Equity
Current shipped implementation uses `staff.is_founder` only. A separate `founder_equity` table `(staff_id, company_id, share_percent, converted_at)` remains an open future option if founder ownership becomes more detailed than the current equal-per-founder return model.

---

## 6. Design Synthesis: Recommended Direction

**Core principle:** Make each country's early economic model feel *thematically different*, not just numerically patched.

### Recommended minimal implementation:
1. **Founder profit-share flag** on starting staff — zero wages until first meaningful income milestone. This alone solves the bankruptcy problem for all countries without touching numbers.
2. **Story-triggered staff reveals** for Germany and US — start with 1–2 fewer staff, unlock others via achievements or time.
3. **Bulk/cooperative sales** as a Year 1 income bridge (Germany, France, Italy).
4. **Bankruptcy advisor** in the starting conditions UI — live financial forecast, three preset difficulty tiers.
5. **Country archetypes** (Italy grant, Germany cooperative, US investor) as medium-term feature, designed as standalone narrative systems.

### What NOT to do:
- Don't give all countries a loan — kills variety and narrative texture.
- Don't just lower BASE_WEEKLY_WAGE globally — it affects mid/late game balance too.
- Don't add more loans without also adding the mechanical reason why each country *would* have a loan.

---

## 6. Open Questions

- [x] Should profit-share founders be visible in the staff wage line of the finance screen, or shown as a separate "founder distributions" line? Shipped as a separate Finance `FounderPanel` with `Founder Return` capital-flow transactions.
- [x] What % profit share feels balanced? Current shipped constant is 20% of yearly net profit per active founder.
- [ ] Does the story-trigger system need its own event/notification architecture, or can it hook into the existing `notificationService`?
- [ ] Should the advisor be a blocking warning ("You must confirm this risky setup") or advisory-only?
- [x] Should cooperative/bulk sales have their own UI in the Winery/Sales screen? Sell-side grape buyer market is active from the Winery sell-grapes flow; buy-side market uses the buy-from-market modal.

---

## 7. Files Relevant to Implementation

| File | Relevance |
|------|-----------|
| `src/lib/constants/startingConditions.ts` | Starting staff, loans, vineyard config per country |
| `src/lib/services/finance/wageService.ts` | `processSeasonalWages()`, `processYearlyFounderDistributions()` |
| `src/lib/services/user/staffService.ts` | `createStaff()`, `generateRandomSkills()`, `buyoutFounder()` |
| `src/components/finance/FounderPanel.tsx` | Active founder display and buyout action |
| `src/lib/constants/staffConstants.ts` | `BASE_WEEKLY_WAGE`, `SKILL_WAGE_MULTIPLIER`, founder return and buyout constants |
| `src/lib/services/core/startingConditionsService.ts` | Company creation flow — advisor UI data comes from here |
| `src/lib/services/vineyard/vineyardManager.ts` | Yield formula — used by advisor forecast |

---

## 8. Buy Grapes from Market (Future Feature)

**Concept:** Allow players to purchase grapes from the open market to supplement their own harvest — particularly useful in early game when their own vines aren't productive yet, or after a bad season.

### Core Design

- **Where:** New tab or section in the Sales page (or a dedicated Market page eventually)
- **Mechanic:** A seasonal "market offer" appears each harvest season. Quantity and quality are randomized but scaled by company reputation/prestige
- **Pricing:** Inverse of sell pricing — market asks a premium over raw grape value. Higher reputation = access to better quality (sellers want to work with respected producers)

### Offer Structure

Each offer has:
- **Grape variety** (matching region/country preferences — you can't easily buy Riesling in Spain)
- **Quantity** (kg) — scales with prestige: low prestige = small lots only (e.g. 50–300 kg); high prestige = up to full harvest volumes
- **Quality** (wineScore) — scales with prestige: base offers are commodity quality; reputation unlocks access to premium lots
- **Price per kg** — market rate (typically 20–50% above sell price for same quality)
- **Offer expiry** — offers expire at season end (no stockpiling market offers)

### Prestige Scaling

| Prestige Level | Max Lot Size | Max Quality | Market Access |
|---------------|-------------|-------------|---------------|
| 0–100 (new)  | 100 kg | 30% | Commodity only |
| 100–300 | 500 kg | 55% | Standard lots |
| 300–600 | 2,000 kg | 75% | Premium lots |
| 600+ | 5,000 kg | 90% | Grand cru lots (rare) |

### Contract Commitments

Advanced option: **"Forward Contract"** — commit to buying grapes at an agreed price for a future season.

- Lock in price and variety *now*, grapes delivered at next harvest
- Risk: you're obligated even if your cash situation changes
- Reward: typically 10–20% cheaper than spot market, and *guaranteed quality tier*
- Forward contracts persist in the DB as a new `grape_contracts` table with `committed_at`, `delivery_year`, `price_per_kg`, `quantity`, `variety`, `status: pending|delivered|defaulted`
- Defaulting (no money to pay) = prestige hit + potential relationship damage with that supplier

### Reputation Building with Suppliers

Buying consistently from the same supplier builds a relationship (similar to cooperative membership):
- Regular buyer discount: 5–15% off spot price after 3+ seasons
- Priority access: locked-in quality tier (they reserve their best lots for you)
- Potential: supplier offers you exclusive varieties not on the open market

### Key Design Questions (to resolve before implementation)

1. **Where does the market live in the UI?** Sales page (new "Grape Market" tab) vs dedicated Market page?
2. **How often do offers refresh?** Every season? Every year? On player request?
3. **Country restrictions?** Should you only be able to buy grapes from your own region, or import from others at a premium?
4. **Integration with Sell Grapes?** Arbitrage should not be trivially easy — buying and immediately re-selling should not be profitable
5. **Poor wine selling cheaper than good grapes:** This is intentional and good design — raw quality grapes can outvalue a poorly made wine. No need to "fix" this.

### Suggested Implementation Path

1. `src/lib/services/sales/grapeMarketService.ts` — offer generation + purchase logic
2. `src/lib/database/sales/grapeMarketDB.ts` — market offers + forward contracts tables
3. `src/components/pages/sales/GrapeMarketTab.tsx` — UI tab in Sales page
4. Migration: `grape_market_offers`, `grape_forward_contracts` tables



## 9. Bulk Grape Sales Status (Updated 2026-05-22)

### Implemented now (verified in code)

- Sell-grapes flow is active with partial sale support, inventory split/removal, finance transaction logging, and notifications.
- Dynamic buyer market is active:
  - Persistent company-scoped bulk buyer (`bulk_buyer`)
  - Seasonal rotating buyers by country
  - Germany cooperative buyer (`winzergenossenschaft`)
- Seasonal hard-cap enforcement is active per buyer (`effectiveSeasonLimitKg`, `remainingSeasonLimitKg`, and sell-time guardrails).
- Buyer relationship/loyalty system is active:
  - Persistent loyalty score and levels (0-10)
  - Relationship price multiplier and seasonal limit bonus
  - Yearly loyalty growth cap and relationship decay model
- Cooperative membership progression is active with floor-price protection and streak-based levels.
- Sell Grapes modal now includes:
  - Buyer list with multipliers, limits, favorite grapes, and relationship cues
  - Sale quantity slider constrained by buyer seasonal capacity
  - Detailed pricing breakdown with relationship and favorite-grape effects
  - Loyalty info panel and yearly-cap warning
- Research integration is active for grape buyers:
  - Additional seasonal buyer slots
  - Seasonal hard-limit multiplier boosts
  - Buyer multiplier bonus boosts
  - Cross-country buyer pool unlocks via research (`grape_buyer_country_access`)
- Database layer and migrations are in place for:
  - `grape_market_buyers`
  - `grape_buyer_loyalty`
  - Seasonal limits and favorite grapes columns

### What is left for later implementation (keep)

- Forward contracts / future delivery commitments (high-priority future)
  - Commit this-year terms for next harvest delivery.
  - Include penalties/default handling and relationship impact.
- Seasonal demand model
  - Status: implemented through season + year + economy scaling in buyer price and seasonal limits.
  - Volatility model: implemented as deterministic per-buyer seasonal/year demand noise (stable inside a season, refreshed across seasons/years, stronger swing during crash/boom phases).
  - Remaining optional layer (not required): handcrafted global event shocks (for example explicit drought/logistics event cards shown to player).
- AI/UX enhancements in modal
  - Show why a buyer is in this season (relationship carry-over vs newly generated).
  - Show projected loyalty gain for current sale before confirming.
- Country-access UX surfacing (locked/available market-country sections in UI).

### Design ideas for next implementation slice

#### Multi-buyer strategic choices

- Keep all active buyers available each season; differentiate them by profile instead of competing reservation mechanics.
- Add buyer archetypes with clear trade-offs:
  - High-volume / low-multiplier buyer (stable cashflow)
  - Premium / low-cap buyer (best margins)
  - Favorite-grape specialist (big bonus for 1-2 grapes)
  - Relationship-growth buyer (lower immediate payout, higher loyalty gain)
- Add one explicit "deal style" field per buyer row:
  - `spot` (normal current behavior)
  - `quality_bonus` (extra multiplier above quality threshold)
  - `volume_bonus` (extra multiplier above kg threshold)
  - `relationship_bonus` (extra loyalty points)
- Present projected outcomes before confirming sale:
  - Revenue now
  - Loyalty gain now
  - Remaining buyer seasonal capacity
  - Whether sale triggers bonus threshold for that buyer
- Keep formulas simple for first pass:
  - `quality_bonus`: +0.05 multiplier when wineScore >= threshold
  - `volume_bonus`: +0.03 multiplier when sold kg >= threshold
  - `relationship_bonus`: +20% applied loyalty points (still capped by yearly cap)

#### AI/UX enhancements in modal (straightforward)

- Add buyer origin tags: `Relationship carry-over`, `Seasonal rotation`, `Country special`.
- Add a "sale preview" line next to confirm button:
  - `+X loyalty points` (after cap)
  - `Y / Z seasonal kg remaining after sale`
- Add compact reason tooltip per buyer card:
  - Why this multiplier is current value (season/economy/research/relationship breakdown).
- Add optional quick-sort toggles:
  - Best price now
  - Best loyalty growth
  - Highest remaining capacity

#### Country-access progression UX and balancing (follow-up)

- Keep current research unlock type `grape_buyer_country_access` and expose clearer progression in UI copy.
- Expand progression tuning for country pools behind research tiers:
  - Stage 1: neighboring-country buyers (already supported through unlock payloads)
  - Stage 2: regional export buyers (balancing + pool curation)
  - Stage 3: global premium buyers (balancing + pool curation)
- Use light balancing constraints to avoid early exploitation:
  - Import friction multiplier (slight price penalty) until higher-tier research
  - Higher loyalty requirement for cross-country premium buyers
- UI behavior:
  - Show locked country sections with research requirement text
  - On unlock, show one-time notification and highlight newly available buyers

### Still open from founder-economy plan

- Automatic founder conversion milestones beyond manual buyout
- Separate founder-equity table
- Story-triggered family/staff reveal flow
- Starting setup bankruptcy advisor
- Country archetype-specific founder economy systems beyond current grape-buyer market
