# Skiresort Tycoon - AI Agent Instructions

This is a ski resort tycoon simulation game built with React, TypeScript, Vite, and Zustand.
Three-layer architecture: **Engine** (`src/engine/`) → **State** (`src/stores/`) → **UI** (`src/ui/`).

For full system design, domain model, and implementation status see [DESIGN.md](../DESIGN.md).

## AI Context

Always read README.md. Read DESIGN.md for full system details.

## AI check message
Start all responses with the following message:

[AI Agent Instructions] - Have read the copilot-instructions.md.

---

## Fixed Timestep Game Loop

- 1 game day = ~2 seconds real time (`tickRate: 1000ms`, fixed speed — not user-adjustable).
- Fixed timestep accumulator pattern prevents time-dependent drift.
- `GameEngine.tick()` order — **critical when adding new systems**:
  1. Advance time (date/season)
  2. Prestige decay
  3. Achievement check (every 7 days)
  4. Advance weather / snow condition
  5. Degrade facilities
  6. Recalculate ratings
  7. Recalculate demand
  8. Apply network flow
  9. Process daily expenses
  10. Process income
  11. Process loans / refresh credit rating (`LoanCreditSystem`)
  12. Increment game tick counter

---

## Type System Conventions

- Canonical import surface: `src/types/index.ts`. Always import from `../types`, not individual type files.
- `domain.ts` — entities/unions/constants; `sim.ts` — simulation contracts; `state.ts` — store state; `prestige.ts` — prestige event types.

**Discriminated unions for facilities:**
```typescript
type Facility = SlopeFacility | LiftFacility | AccommodationFacility | ...
// Pattern match on facility.type for type-safe access
```

**Customer segments** (literal type, not enum): `'families' | 'young_people' | 'enthusiasts' | 'seniors'`

**Seasons**: `'winter' | 'spring' | 'summer' | 'fall'` — 90-day cycles.

---

## State Management Patterns

- Multiple focused stores, not one monolithic store.
- Systems call stores directly: `useResortStore.getState()`
- Components subscribe via hooks: `useResortStore(state => state.resort)`
- Store actions return void; systems handle complex logic.
- Never store derived values — calculate on-the-fly or in systems.
- Never store functions in Zustand (serialization issues).

**All stores use `persist` middleware** — localStorage keys are `skiclicker-{storename}`.

**Store quick-reference:**

| Store | Persists | Notable exclusions |
|---|---|---|
| `gameStore` | pass prices | `isRunning` (always false on load), `currentTick` |
| `timeStore` | everything | `currentDate` revived from ISO string → `Date` |
| `financeStore` | balance, transactions (last 500), loans, credit | `dailyIncome`, `dailyExpenses`, `loanOffers` |
| `demandStore` | stocks, reputation, modifier, pass split | `currentVisitors`, `demandBySegment` |
| `resortStore` | full resort entity | — |
| `weekPassStore` | `activeWeekPassHolders` array | — |
| `seasonPassStore` | holder count, season start day | — |
| `serviceStore` | services, activeServices | — |
| `weatherStore` | weather, snow condition | — |
| `prestigeStore` | all prestige events | — |

---

## Game Balance Constants

All tunable parameters live in `src/constants/gameConstants.ts` and `src/engine/services/constants/index.ts`.
Key sets: `CUSTOMER_CONSTANTS`, `WORKER_CONSTANTS`, `UTILITY_CONSTANTS`, `DEGRADATION_CONSTANTS`, `MAINTENANCE_CONSTANTS`.
**Always extract magic numbers to named constants with a comment on design intent.**

---

## Critical System Hooks

**`DemandSystem.calculateDemand()`** — reads ratings, prices, season, service multipliers → writes `demandStore`.

**`FinanceSystem` daily cycle:**
1. `processDailyExpenses()` — maintenance, wages, services, utilities
2. `processIncome()` — new pass sales, accommodation, restaurants, rentals
3. `degradeFacilities()` — time/usage-based condition decay

**`LoanCreditSystem.processDaily()`** — loan payments, defaults, credit rating refresh.

**`RatingSystem.calculateRatings()`** — sub-ratings (slopes, lifts, facilities, safety, kids, snowparks, off-piste), segment-specific weights, service multipliers applied.

---

## Developer Workflows

**Adding a new facility type:**
1. Add discriminated union variant to `src/types/domain.ts`
2. Add factory method in `src/engine/facilities/FacilityFactory.ts`
3. Handle in `DemandSystem`, `RatingSystem`, `FinanceSystem`
4. Update `src/ui/pages/BuildPage.tsx` and `src/ui/pages/FacilityPage.tsx`
5. Add constants in `gameConstants.ts`

**Adding a new system:**
- Static class in the relevant `engine/` folder
- Access stores via `getState()`
- Register call in `GameEngine.tick()` in the correct position
- Systems are stateless — all state lives in Zustand stores

**Finance/Loans UI:** Keep `FinancePage` orchestration-only; push complex logic into `src/ui/hooks/`.

**Barrel imports — always prefer when available:**
- `src/types`, `src/ui/pages`, `src/ui/components`, `src/ui/hooks`, `src/ui/shared`
- `src/engine/network`, `src/engine/terrain`, `src/engine/facilities/constants`, `src/engine/services/constants`

---

## localStorage — Fresh-Game Detection

`App.tsx` checks `resort.terrainAreas.length === 0` on mount:
- Empty → fresh game: call `initialize()`, `initializeTerrain()`, `WeatherSystem.initialize()`.
- Populated → restored: skip initialization entirely.
- `AdminPage` "Reset Game" clears all 10 `skiclicker-*` keys and reloads.

---

## Common Pitfalls

- **Don't call systems from components.** `GameEngine` orchestrates; components only read state and dispatch store actions.
- **Don't mutate facilities directly.** Use store actions that produce new arrays/objects (Zustand requires immutability).
- **Don't store functions in Zustand.** Causes serialization and re-render issues.
- **Week pass holders** use `weekPassStore.activeWeekPassHolders` array (individual arrival/departure days), not a plain count.
- **Facility node links** — keep `startNodeId/endNodeId/baseNodeId/peakNodeId` coherent or network flow/routing breaks.
- **Date revival** — `timeStore.currentDate` and `financeStore.transactions[].timestamp` are stored as ISO strings and revived to `Date` in `onRehydrateStorage`.

---

## Key Files

| File | Purpose |
|---|---|
| `src/engine/core/GameEngine.ts` | Game loop and tick orchestration |
| `src/engine/economy/DemandSystem.ts` | Customer attraction and pass purchase logic |
| `src/engine/economy/FinanceSystem.ts` | Transaction ledger, income/expenses |
| `src/engine/economy/LoanCreditSystem.ts` | Loan payments and credit rating |
| `src/engine/prestige/prestigeService.ts` | Prestige event creation |
| `src/engine/prestige/achievementService.ts` | Achievement detection and awards |
| `src/stores/resortStore.ts` | Resort entity and facility management |
| `src/types/domain.ts` | Core domain/facility types |
| `src/types/prestige.ts` | Prestige event types |
| `src/types/index.ts` | Canonical type export surface |
| `src/constants/gameConstants.ts` | Balance tuning |
| `DESIGN.md` | Full design, systems, and implementation reference |
