# Winemaker 0.4 — Project Information

Last code-verified: 2026-07-20
This document is the ownership and boundary map. Stable game rules live in `CONTEXT.md`; current behavior and deferred scope live in `docs/AIdocs/AIDescriptions_coregame.md`.

## Stack and entrypoints

- React, Vite, TypeScript, Tailwind, ShadCN UI, Supabase, and Vitest.
- Bootstrap/routing: `src/main.tsx`, `src/App.tsx`.
- Domain code: `src/lib/services/`, `src/lib/features/`; persistence: `src/lib/database/`, `migrations/`.
- Shared types/constants: `src/lib/types/`, `src/lib/constants/`; tests/admin tools: `tests/`, `src/lib/features/admin/`, `server/`.

## Domain ownership

| Domain | Rules and UI | Persistence/configuration |
|---|---|---|
| Core state/tick | `services/core/`, `App.tsx`, layout | `database/core/`, time constants |
| Activities | `features/activities/` and host activity surfaces | `database/activities/activityDB.ts`, feature constants |
| Vineyard | `services/vineyard/`, Vineyard UI | vineyard/grape databases and constants |
| Weather | `features/weather/`, Weather Center/Vineyard projections | company-scoped GameState fields |
| Winery/inventory | `services/wine/`, Winery and Equipment | `database/activities/inventoryDB.ts`, `database/winery/` |
| Structure/taste/score | `wineStructure/`, wine taste/score services | wine/taste constants |
| Sales/contracts | `services/sales/`, Sales UI | sales/customer/contract databases |
| Buy Market | market adapters, Buy Market UI, grape trading | `database/market/` (including global grape/vessel listings), `database/winery/`, `database/sales/` |
| Finance/founders | finance services, Finance UI, Founder Panel | transactions, founder field, finance constants |
| Staff | `features/staff/`, Staff UI and activity staff seam | staff/team databases and staff constants |
| Loans | `features/loanLender/`, finance UI injections | loan/lender databases and loan constants |
| Research | `features/researchUpgrade/`, Research page/admin inspector | research unlock database/constants |
| Prestige/achievements | prestige services; `features/achievements/` UI | prestige and achievement databases |
| Player/company | `features/user/`, `features/company/`, Login/gateway/Profile/Settings | player, company, and preference databases |
| Leaderboards | `features/leaderboards/`, leaderboard page/summaries | highscores database and atomic ranking migration |

## Installed feature seams

| Feature | Public responsibility |
|---|---|
| `activitiesFeature` | Lifecycle, reads, work previews/calculators, ticks, setup, and activity UI. Activity-record persistence stays private to its database adapter. |
| `staffFeature` | Staff/team records, recruitment, competency, wages/founders, presentation, and Staff UI. Activities consume its one-way public seam. |
| `loanLenderFeature` | Lender setup, quote/workflow hooks, loan metrics/ticks, repayment, and finance overlays/tabs. |
| `researchUpgradeFeature` | Research workflow, unlock checks, starting unlocks, permanent effects, Research page, and Admin inspector integration. |
| `achievementsFeature` | Catalog, company-snapshot evaluation, cadence, read models, and achievement UI. |
| `userFeature` | Optional player identity/session, profile, wallet, company-scoped preferences, and Profile/Settings UI. |
| `companyFeature` | Company CRUD, owner-scoped portfolio/read models, starting-condition preview/application, company-activation lifecycle hooks, and company gateway UI. Unowned companies remain valid. |
| `leaderboardsFeature` | Score recording, rankings/read models, maintenance, and leaderboard UI. |
| `weather` | Always-on weather resolution, vineyard/market/operation projections, and presentation models. |
| `admin` | Development-only host seam, dynamically loaded in Vite development. |
| `boardShare` | Intentionally inactive contract; not wired into host behavior. |

## Boundary rules

- `*DB.ts` owns Supabase CRUD and row mapping; services/features own rules and orchestration; React owns presentation and interaction.
- Callers use feature/service barrels and public seams, not feature internals or direct database imports. UI/hooks do not import database modules.
- Admin destructive adapters stay under `database/admin/` and are not exported through the general database barrel.
- Shared market tuning belongs in `src/lib/constants/`; compatibility re-exports, wrappers, fallback aliases, and legacy schema support are not canonical.
- Development-stage schema changes are clean cutovers: replace obsolete fields/tables and migrate all consumers together without backfills.

## Deferred scope

Public-company/share gameplay, vessel-memory gameplay, generic player-to-player asset listings, advanced equipment/vineyard techniques, severe-weather actions, dedicated weather research/achievements, and persisted grape-change history for grape-tenure achievements are not active runtime features.

## Documentation map

| Need | Document |
|---|---|
| Vocabulary and formulas | `CONTEXT.md` |
| Current behavior and deferred scope | `docs/AIdocs/AIDescriptions_coregame.md` |
| Variable dependencies | `docs/WineSystem_VariableRelationshipMap.md` |
| Historical plans | `docs/superpowers/completed/`, `docs/codexplans/completed/` |
| Deferred designs | `docs/superpowers/deferred/`, `docs/codexplans/deferred/` |
| Change history | `docs/versionlog.md` |
