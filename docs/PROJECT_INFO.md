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

| Domain | Logic/features | UI | Persistence/configuration |
|---|---|---|---|
| Core state/tick | `src/lib/services/core/` | `src/App.tsx`, layout | `database/core/gamestateDB.ts`, time constants |
| Activities | `src/lib/features/activities/` | activity panel, host pages, core tick | `database/activities/activityDB.ts`, activity constants |
| Vineyard | `src/lib/services/vineyard/` | `Vineyard.tsx`, vineyard modals | `database/activities/vineyardDB.ts`, vineyard/grape constants |
| Weather | `src/lib/features/weather/`, `constants/weatherConstants.ts` | `WeatherCenter.tsx`, Vineyard tooltips, Winepedia Weather | company-scoped weather fields in `GameState`/`gamestateDB.ts` |
| Winery/inventory | `src/lib/services/wine/winery/`, `anchors/`, `features/` | `Winery.tsx`, Equipment, wine modals | `database/activities/inventoryDB.ts`, `database/winery/`, wine-feature constants |
| Structure/taste/score | `src/lib/wineStructure/`, `services/wine/taste/`, `winescore/` | wine modal tabs and breakdowns | taste and wine-feature constants |
| Wine Log | `src/lib/features/wineLog/` | Wine Log page, production history, vineyard analytics | `database/core/wineLogDB.ts` |
| Orders/contracts | `services/sales/` | Sales page, order/contract tabs, assignment modal | customer/sales databases, contract constants |
| Buy Market and grape trading | Buy Market, Grape Procurement, buyer/supplier, loyalty, sell, cooperative modules | Buy Market, sell, and Storage Vessel surfaces | `database/market/`, `database/winery/`, `database/sales/`, market/cooperative constants |
| Forward pre-sales | `services/sales/forwardContractService.ts` | `ContractsTab.tsx` | `database/sales/contractDB.ts` |
| Finance/founders | `services/finance/`, `features/staff/` | finance views, `FounderPanel.tsx` | transactions, staff founder field, finance/staff constants |
| Staff | `features/staff/` | feature-owned Staff workspace; Activity staff surfaces consume the Staff UI seam | `database/core/staffDB.ts`, `database/core/teamDB.ts`, `staff.specialized_roles`, `staff.experience`, staff constants |
| Loans | `features/loanLender/` | feature-injected finance UI | loan/lender databases, `loanCalculations.ts`, and loan constants |
| Research | `features/researchUpgrade/`, research constants | `Research.tsx`, admin inspector | research unlock database and view services |
| Prestige | `services/prestige/` | prestige UI | prestige-event database |
| Achievements | `features/achievements/` | feature-owned achievement workspace | achievement database adapter |

## Feature Seams

| Feature | State |
|---|---|
| `activities` | Installed feature facade; `activitiesFeature` owns lifecycle, reads, work previews/calculators, ticks, setup, and activity UI. Activity-record persistence remains private to its database adapter. |
| `loanLender` | Installed feature facade; `loanLenderFeature` owns loan/lender services, UI, activities, and public read/workflow hooks. Pure term/fee calculations live in `services/finance/loanCalculations.ts`; borrower quotes and payment summaries live in `services/finance/loanQuoteService.ts`, while repayment operations are isolated in `loanPaymentService.ts`. Lifecycle services propagate persistence failures rather than substituting stale credit, loan, or lender data. Direct service-to-database orchestration remains an intentional narrow-scope exception in the loan feature; UI does not import database adapters. |
| `achievements` | Installed feature facade; `achievementsFeature` owns game-specific definitions, company-snapshot evaluation, company-keyed cadence, read models, and the achievement workspace. Core ticks, Research gates, and App routing use its public interface; database adapters and migrations enforce one current-shape unlock/reward per achievement scope so retries and overlapping checks are safe. Vineyard grape-tenure achievements are deferred pending persisted change history. |
| `researchUpgrade` | Installed feature facade; `researchUpgradeFeature` owns gameplay research integration, selectors/view models, effects, and player UI rendering. Its named `adminIntegration` entry point owns the Admin-only inspector and commands. |
| `admin` | Development-only compatible-Winemaker slice; `main.tsx` dynamically loads `adminFeature` and passes it explicitly into `App`. |
| `boardShare` | Installed but intentionally inactive facade; `boardShareFeature` retains the isolated contract while public-company/share gameplay is deferred and is not wired into host behavior. |
| `weather` | Always-on functional module; its barrel exports weather resolution, operation, market, vineyard, and presentation capabilities. |
| `staff` | Installed feature facade; `staffFeature` owns feature-native staff/team records, recruitment/factory logic, teams, competency, wages/founders, presentation, and Staff UI. Persistence maps global state internally; every staff/team membership mutation uses a company-scoped atomic database operation to keep both membership representations consistent. Activities consume Staff through this one-way seam. |
| `user` | Installed feature facade; `userFeature` owns optional player identity/session, profile, wallet, company-scoped preferences, and the Profile/Settings surfaces. Its explicit session-ending operation clears both authenticated and local-player selection. Companies may remain unowned and playable. |
| `company` | Installed feature facade; `companyFeature.records` owns explicit company CRUD, feature-owned company records, portfolio read models, and owner-scoped aggregate statistics. `companyFeature.setup` owns starting-condition preview/application, and `companyFeature.lifecycle` exposes the activation hook seam; core game state remains the host for active-company session orchestration. `companyFeature.ui` owns the company gateway; App composes lender setup and activation. Creation accepts an optional owner ID only. |
| `wineLog` | Installed feature facade; `wineLogFeature` owns immutable bottling-history records, vineyard history/analytics, Wine Log presentation, and the bottling-to-leaderboard integration. Wine production invokes its record seam; player identity remains owned by `userFeature`. |
| `leaderboards` | Installed feature facade; `leaderboardsFeature` owns feature-native record inputs/types, rankings/read models, maintenance actions, the leaderboard page, and Login’s leaderboard summary. Aggregate company scores are atomically constrained to one best value per company/type; historical wine and vineyard entries remain append-only, with `lowest_price` ordered ascending. |

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
