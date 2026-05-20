# Early-Game Balance: Founder Economy & Starting Conditions
**Created:** 2026-05-20  
**Status:** Design / Open for implementation  
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

**Implementation note:** Profit share could be stored as a `foundingSharePercent` field on the Staff model, active only while `staff.isFounder === true`. When the company meets the transition condition, `isFounder` flips to `false` and normal wage calculation begins.

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

---

### 4.7 Seasonal vs. Permanent Staff Model
Some starting staff are **seasonal contract workers**, not full-time employees:
- They only bill during Fall (harvest) and Winter (crushing/fermentation)
- Spring/Summer: zero cost
- Historically accurate for vineyard labor
- Creates a **full-time vs seasonal** hiring decision layer

Germany could start with Johann as permanent + 2 seasonal harvest workers. This massively reduces the off-season wage bill while preserving the large-winery flavor.

---

## 5. Design Synthesis: Recommended Direction

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

- [ ] Should profit-share founders be visible in the staff wage line of the finance screen, or shown as a separate "founder distributions" line?
- [ ] What % profit share feels balanced? (Suggestion: 5–10% per founder of gross wine revenue)
- [ ] Does the story-trigger system need its own event/notification architecture, or can it hook into the existing `notificationService`?
- [ ] Should the advisor be a blocking warning ("You must confirm this risky setup") or advisory-only?
- [ ] Should cooperative/bulk sales have their own UI in the Winery/Sales screen?

---

## 7. Files Relevant to Implementation

| File | Relevance |
|------|-----------|
| `src/lib/constants/startingConditions.ts` | Starting staff, loans, vineyard config per country |
| `src/lib/services/finance/wageService.ts` | `processSeasonalWages()` — where founder logic hooks in |
| `src/lib/services/user/staffService.ts` | `createStaff()`, `generateRandomSkills()` — add `isFounder` flag |
| `src/lib/constants/staffConstants.ts` | `BASE_WEEKLY_WAGE`, `SKILL_WAGE_MULTIPLIER` |
| `src/lib/services/core/startingConditionsService.ts` | Company creation flow — advisor UI data comes from here |
| `src/lib/services/vineyard/vineyardManager.ts` | Yield formula — used by advisor forecast |
