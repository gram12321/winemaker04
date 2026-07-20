# Core Game Mechanics

Last code-verified: 2026-07-20
This is the concise behavior/status guide. Use `CONTEXT.md` for rules and vocabulary, and `docs/PROJECT_INFO.md` for ownership and boundaries.

## Runtime and player surfaces

- `processGameTick()` advances activities, orders/contracts, forward contracts, vines, prestige, economy/weather, and seasonal finance hooks. Supabase stores company-scoped game state and domain records.
- Main surfaces are Login, Company Overview, Vineyard, Winery, Equipment, Sales, Finance, Research, Staff, Weather Center, Wine Log, Winepedia, Achievements, Leaderboards, Profile, Settings, and the development-only Admin Dashboard.
- Winepedia is the technical reference. Admin Test Systems runs the shared Vitest suite and Gameflow Lab fixtures; the Admin feature is loopback-gated and loaded only in Vite development.

## Implemented behavior

### Vineyard, weather, and production

- Weather persists weekly state/intensity, seasonal pattern/confidence, and next-week forecast. It supplies bounded vineyard progression, operation impacts, and market context; severe events, mitigation, weather research, and weather achievements are deferred.
- Wine progresses through grapes, must, wine, and bottled states via crushing, fermentation, aging, features, oxidation, and bottle lifecycle effects. Bottling creates immutable historical snapshots while cellar values can evolve.
- Contracts validate taste/structure/site/origin/grape requirements. Forward contracts cover bottled wine, grapes, `must_ready`, and `must_fermenting`.

### Markets and storage

- Sell-side grape buyers remain independent from the generic Buy Market. Buy Market combines Grape Procurement with new quantity-based and globally listed used Storage Vessel sources; offers have displayed sellers and buyer-to-seller relationship pricing.
- Used vessels preserve asset identity, ownership history, material, age, condition, fills, and cleanliness. Condition/value are projected for the viewer's game date and purchase/sell-back use atomic listing commands.
- Wine contact marks vessels dirty, but cleanliness is warning-only and dirty operational vessels remain allocatable. Empty Vessel and Clean Vessel are cancellable Maintenance activities; emptying changes only the selected vessel's volume and releases only that vessel.

### Finance and progression

- Finance statements, cash flow, loans/lenders, staff/team work, founders, prestige, achievements, and leaderboards are active. Founder returns, buyout, loan payments, warnings, restructuring, and defaults are persisted workflows.
- Staff use category-derived primary skills, six innate broad roles, exact task mastery, and bounded grape mastery. Work previews and ticks share one calculator; XP is awarded only from persisted applied work.
- Research activity and unlock gates are active for grapes, fermentation, staff/vineyard caps, contracts, and grape-buyer progression. The current permanent effect reduces vineyard-health decay. Companies may be owned or unowned and remain playable.

## Deferred or partial

- Public-company/share gameplay and the `boardShare` host integration.
- Vessel-memory gameplay and generic player-to-player asset listings.
- Equipment and vineyard-technique research tracks, dedicated weather research/achievements, severe-weather actions, broad bottle-market demand simulation, customer taste matching, descriptor-level scoring, and persisted grape-change history for grape-tenure achievements.
- Research `benefits` copy may be aspirational; `unlocks` and `permanentEffects` define runtime behavior.

## File map

| Area | Primary locations |
|---|---|
| Core/tick | `src/lib/services/core/` |
| Activities | `src/lib/features/activities/`, `src/lib/database/activities/activityDB.ts` |
| Vineyard/weather | `src/lib/services/vineyard/`, `src/lib/features/weather/` |
| Wine/scoring | `src/lib/services/wine/`, `src/lib/wineStructure/` |
| Sales/markets | `src/lib/services/sales/`, `src/lib/database/market/` |
| Finance/loans/founders | `src/lib/services/finance/`, `src/lib/features/loanLender/` |
| Staff/research/progression | `src/lib/features/staff/`, `researchUpgrade/`, `achievements/` |
| Tests | `tests/` |
