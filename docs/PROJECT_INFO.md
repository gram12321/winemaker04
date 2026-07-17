# Winemaker 0.4 - Project Information

Last code-verified: 2026-07-13

Ownership and module map for the mainline codebase. Behavior details belong in `docs/AIdocs/AIDescriptions_coregame.md`; vocabulary belongs in `CONTEXT.md`.

Agent workflow and routing are defined in `skills/winemaker-game/SKILL.md`. Read the repository entry docs before implementation, use the worktree/subagent skills for substantial planned work, and verify before claiming completion.

## Stack and Entrypoints

- React, Vite, TypeScript, Tailwind, ShadCN UI, Supabase, Vitest.
- App boot/routing: `src/main.tsx`, `src/App.tsx`.
- Shared types/constants: `src/lib/types/`, `src/lib/constants/`.
- Domain logic: `src/lib/services/`, `src/lib/features/`.
- Persistence/migrations: `src/lib/database/`, `migrations/`.
- Tests/admin: `tests/`, `src/lib/features/admin/`, `server/`.

## Domain Ownership

| Domain | Logic/features | UI | Persistence/configuration |
|---|---|---|---|
| Core state/tick | `src/lib/services/core/` | `src/App.tsx`, layout | `database/core/gamestateDB.ts`, time constants |
| Vineyard | `src/lib/services/vineyard/` | `Vineyard.tsx`, vineyard modals | `database/activities/vineyardDB.ts`, vineyard/grape constants |
| Weather | `src/lib/features/weather/`, `constants/weatherConstants.ts` | `WeatherCenter.tsx`, Vineyard tooltips, Winepedia Weather | company-scoped weather fields in `GameState`/`gamestateDB.ts` |
| Winery/inventory | `src/lib/services/wine/winery/`, `anchors/`, `features/` | `Winery.tsx`, Equipment, wine modals | `database/activities/inventoryDB.ts`, `database/winery/`, wine-feature constants |
| Structure/taste/score | `src/lib/wineStructure/`, `services/wine/taste/`, `winescore/` | wine modal tabs and breakdowns | taste and wine-feature constants |
| Orders/contracts | `services/sales/` | Sales page, order/contract tabs, assignment modal | customer/sales databases, contract constants |
| Buy Market and grape trading | Buy Market, Grape Procurement, buyer/supplier, loyalty, sell, cooperative modules | Buy Market, sell, and Storage Vessel surfaces | `database/market/`, `database/winery/`, `database/sales/`, market/cooperative constants |
| Forward pre-sales | `services/sales/forwardContractService.ts` | `ContractsTab.tsx` | `database/sales/contractDB.ts` |
| Finance/founders | `services/finance/`, `services/user/staffService.ts` | finance views, `FounderPanel.tsx` | transactions, staff founder field, finance/staff constants |
| Staff competency/work | `services/activity/workcalculators/workCalculator.ts`, `services/activity/activityWorkContext.ts`, `services/user/staffService.ts`, `services/finance/wageService.ts` | Staff page and staff/activity modals | `database/core/staffDB.ts`, `staff.specialized_roles`, staff/activity constants |
| Loans | `features/loanLender/` | feature-injected finance UI | loan/lender databases and constants |
| Research | `features/researchUpgrade/`, research constants | `Research.tsx`, admin inspector | research unlock database and view services |
| Prestige | `services/prestige/` | prestige UI | prestige-event database |
| Achievements | `features/achievements/` | feature-owned achievement workspace | achievement database adapter |

## Feature Seams

| Feature | State |
|---|---|
| `loanLender` | Installed feature facade; `loanLenderFeature` owns loan/lender services, UI, activities, and public read/workflow hooks. |
| `achievements` | Installed feature facade; `achievementsFeature` owns game-specific definitions, company-snapshot evaluation, company-keyed cadence, read models, and the achievement workspace. Core ticks, Research gates, and App routing use its public interface; database adapters and migrations enforce one current-shape unlock/reward per achievement scope so retries and overlapping checks are safe. Vineyard grape-tenure achievements are deferred pending persisted change history. |
| `researchUpgrade` | Installed feature facade; `researchUpgradeFeature` owns gameplay research integration, selectors/view models, effects, and player UI rendering. Its named `adminIntegration` entry point owns the Admin-only inspector and commands. |
| `admin` | Development-only compatible-Winemaker slice; `main.tsx` dynamically loads `adminFeature` and passes it explicitly into `App`. |
| `boardShare` | Installed but intentionally inactive facade; `boardShareFeature` retains the isolated contract while public-company/share gameplay is deferred and is not wired into host behavior. |
| `weather` | Always-on functional module; its barrel exports weather resolution, operation, market, vineyard, and presentation capabilities. |
| `staff` | Partial feature folder; most staff logic remains in user services/UI. |
| `user` | Installed feature facade; `userFeature` owns optional player identity/session, profile, wallet, company-scoped preferences, and the Profile/Settings surfaces. Its explicit session-ending operation clears both authenticated and local-player selection. Companies may remain unowned and playable. |
| `company` | Installed feature facade; `companyFeature.records` owns explicit company CRUD, feature-owned company records, portfolio read models, and owner-scoped aggregate statistics. `companyFeature.ui` owns the company gateway; App composes lender setup and active-company activation. Creation accepts an optional owner ID only. |
| `leaderboards` | Installed feature facade; `leaderboardsFeature` owns feature-native record inputs/types, rankings/read models, maintenance actions, the leaderboard page, and Login’s leaderboard summary. Aggregate company scores are atomically constrained to one best value per company/type; historical wine and vineyard entries remain append-only, with `lowest_price` ordered ascending. |

## Boundary Rules

- `*DB.ts` owns CRUD and row mapping; services own rules and orchestration.
- UI/hooks do not import database modules directly; use service seams and shared hooks.
- Admin-only destructive database adapters stay under `database/admin/` and are not re-exported from the general database barrel.
- Prefer barrels such as `@/lib/constants`, `@/lib/services`, and `@/lib/database`.
- Reusable market tuning belongs in `src/lib/constants/`; service-local constants and compatibility re-exports are not canonical.
- Inventory persistence for market purchases, order fulfillment, and contract fulfillment routes through `inventoryService`.
- Do not retain dead compatibility exports or add fallback aliases for renamed fields.
- Staff primary skills remain category-derived. `specializedRoles` persists broad career roles; exact `task:<WorkCategory>` and `grape:<variety>` mastery are learned namespaced staff experience resolved by the activity work calculator. Sales gains task mastery only when a Sales work category exists.

## Current Status

- Weather is persisted weekly state/forecast plus shared bounded vineyard projection and grape-market context; the feature facade also supplies presentation models.
- Buy Market persists generic offers and registers Grape Procurement and Storage Vessels adapters for purchase and lifecycle dispatch. One modal shell hosts their domain panels; both use domain-scoped suppliers, relationships, and shared price/scaling mechanics. Cask suppliers rotate 250 L, 500 L, and 1,000 L offers with normalized quality. Empty Vessel is a cancellable winery Maintenance activity that removes the selected vessel's filled volume, reduces the linked batch, and releases only that vessel on completion. Vessel quality effects remain intentionally deferred.
- Research gates cover grapes, fermentation, staff/vineyard caps, contracts, and grape-buyer progression. Equipment and vineyard-technique tracks remain future work.
- Founder economy is active and intentionally smaller than the archived public-company/share design; the isolated Board Share facade remains intentionally inactive and does not participate in host wiring.
- Completed implementation records live under `docs/superpowers/completed/`; active planning documents remain under `specs/` and `plans/`.

## Test and Documentation Map

| Area | Tests/docs |
|---|---|
| Core/activity/finance | `tests/core/`, `tests/activity/`, `tests/finance/` |
| Vineyard/weather | `tests/vineyard/`, `tests/weather/` |
| Sales/contracts/markets | `tests/sales/` |
| Wine/taste/aging | `tests/wine/` |
| Research/prestige | `tests/research/`, `tests/prestige/`, `tests/user/` |
| Current systems | `docs/AIdocs/AIDescriptions_coregame.md` |
| Vocabulary/relationships | `CONTEXT.md`, `docs/WineSystem_VariableRelationshipMap.md` |
| Weather implementation | `docs/superpowers/completed/2026-07-10-weather-module-redesign-design.md`, `2026-07-10-weather-module-redesign.md` |
| Version history | `docs/versionlog.md` |
