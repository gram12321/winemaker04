# Winemaker 0.4 - Project Information

Last code-verified: 2026-05-25

This file is the ownership and module map for the current mainline codebase. Behavior summaries belong in `docs/AIdocs/AIDescriptions_coregame.md`; stable terminology belongs in `CONTEXT.md`; variable relationships belong in `docs/WineSystem_VariableRelationshipMap.md`.

## Stack

- React, Vite, TypeScript, Tailwind, ShadCN UI.
- Supabase persistence with company-scoped data.
- Vitest test suite under `tests/`.
- Dev-only server helpers under `server/`.

## Top-Level Entrypoints

| Area | Path | Notes |
|---|---|---|
| React entry | `src/main.tsx`, `src/App.tsx` | App bootstrapping, page routing, feature tab injection. |
| Global styles | `src/index.css` | Tailwind and global app styling. |
| Core types | `src/lib/types/types.ts` | Main domain types, weather types, staff founder flag, research and market fields. |
| UI types | `src/components/UItypes.ts` | Shared component/page props. |
| Barrel exports | `src/lib/services/index.ts`, `src/lib/constants/index.ts`, `src/lib/database/index.ts` | Prefer existing exports where practical. |

## Current Domain Ownership Map

| Domain | Primary services | Primary UI | Persistence/constants |
|---|---|---|---|
| Core game state and tick | `src/lib/services/core/` | `src/components/layout/Header.tsx`, page routing in `src/App.tsx` | `src/lib/database/core/gamestateDB.ts`, `src/lib/constants/timeConstants.ts` |
| Starting conditions | `src/lib/services/core/startingConditionsService.ts` | Login/company creation flow | `src/lib/constants/startingConditions.ts` |
| Vineyard | `src/lib/services/vineyard/` | `src/components/pages/Vineyard.tsx`, vineyard modals | `src/lib/database/activities/vineyardDB.ts`, `src/lib/constants/vineyardConstants.ts`, grape constants |
| Weather | `src/lib/services/finance/weatherService.ts`, `src/lib/services/vineyard/weatherImpactService.ts`, `src/lib/services/vineyard/weatherCenterService.ts` | `src/components/pages/WeatherCenter.tsx`, `src/components/pages/winepedia/WeatherTab.tsx` | weather fields on `GameState` in `src/lib/types/types.ts` |
| Winery and inventory | `src/lib/services/wine/winery/`, `src/lib/services/wine/anchors/`, `src/lib/services/wine/features/` | `src/components/pages/Winery.tsx`, wine modals | `src/lib/database/activities/inventoryDB.ts`, wine feature constants |
| Structure, taste, and score | `src/lib/wineStructure/`, `src/lib/services/wine/taste/`, `src/lib/services/wine/winescore/` | wine modal tabs, taste/structure breakdown components | `src/lib/constants/taste/`, `src/lib/constants/wineFeatures/` |
| Sales orders | `src/lib/services/sales/generateOrder.ts`, `salesOrderService.ts`, `salesService.ts`, `relationshipService.ts` | `src/components/pages/Sales.tsx`, `src/components/pages/sales/OrdersTab.tsx` | `src/lib/database/customers/salesDB.ts`, customer DB |
| Contracts | `src/lib/services/sales/contractGenerationService.ts`, `contractService.ts`, `expirationService.ts` | `src/components/pages/sales/ContractsTab.tsx`, `AssignWineModal.tsx` | `src/lib/database/sales/contractDB.ts`, `src/lib/constants/contractConstants.ts` |
| Grape buy/sell market | `sellGrapesService.ts`, `grapeBuyerMarketService.ts`, `grapeBuyerLoyaltyService.ts`, `buyGrapeMarketService.ts`, `grapeSupplierMarketService.ts`, `grapeSupplierLoyaltyService.ts`, `cooperativeService.ts` | `SellGrapesModal.tsx`, `BuyFromMarketModal.tsx`, `GrapeBuyersTab.tsx`, Winepedia economy/market tabs | `src/lib/database/sales/*grape*DB.ts`, achievement/research constants |
| Forward pre-sale contracts | `src/lib/services/sales/forwardContractService.ts` | `src/components/pages/sales/ContractsTab.tsx` | `src/lib/database/sales/contractDB.ts` |
| Finance and accounting | `src/lib/services/finance/financeService.ts`, `economyService.ts`, `wageService.ts` | `src/components/finance/FinanceView.tsx`, `IncomeBalanceView.tsx`, `CashFlowView.tsx`, `StaffWageSummary.tsx` | `src/lib/database/core/transactionsDB.ts`, finance/economy/staff constants |
| Founder economy | `src/lib/services/finance/wageService.ts`, `src/lib/services/user/staffService.ts` | `src/components/finance/FounderPanel.tsx` | `staff.is_founder`, `src/lib/constants/staffConstants.ts` |
| Loans/lenders | `src/lib/features/loanLender/` | loan/lender UI from the feature module injected into Finance | `lendersDB.ts`, `loansDB.ts`, loan constants |
| Board/share seam | `src/lib/features/boardShare/` | no active mainline tabs by default | `companySharesDB.ts`, `companyMetricsHistoryDB.ts`, `shareValuationConstants.ts`, board constants |
| Staff and teams | `src/lib/services/user/staffService.ts`, `teamService.ts`, `src/lib/features/staff/` | `src/components/pages/Staff.tsx`, staff modals | `staffDB.ts`, `teamDB.ts`, staff constants |
| Activities and work | `src/lib/services/activity/`, feature-specific activity managers | `ActivityPanel.tsx`, activity cards/modals | `activityDB.ts`, `activityConstants.ts` |
| Research | `src/lib/constants/researchConstants.ts`, `src/lib/services/research/`, `src/lib/features/researchUpgrade/` | `src/components/pages/Research.tsx`, `src/components/finance/ResearchPanel.tsx`, Winepedia Research tab | `researchUnlocksDB.ts`, research presentation constants |
| Prestige | `src/lib/services/prestige/` | prestige modal, header, finance/sales feedback | `src/lib/database/customers/prestigeEventsDB.ts`, prestige docs under completed |
| Achievements and highscores | `src/lib/services/user/achievementService.ts`, `highscoreService.ts` | `Achievements.tsx`, `Highscores.tsx` | `achievementsDB.ts`, `highscoresDB.ts`, `achievementConstants.ts` |
| Admin tools and test lab | `src/lib/services/admin/`, `src/lib/services/admin/testLab/`, `server/test-runner*.ts` | `AdminDashboard.tsx`, `admin/TestLabPage.tsx` | dev-only loopback gates and tagged fixture cleanup |

## Feature Seams

| Feature | Current mainline state | Notes |
|---|---|---|
| `loanLender` | Active | Owns loan/lender services, UI, and activity managers. |
| `researchUpgrade` | Active | Owns research manager/enforcer integration. |
| `boardShare` | No-op by default | Active public-company/share runtime is not wired in mainline. Keep `PublicCompanyPlan.md` and `PublicCompanyImplementation.md` as historical implementation/reintroduction references. |
| `staff` | Partial feature folder | Staff domain is still mostly served through user services and page UI. |

## Key UI Surfaces

| Surface | Path | Notes |
|---|---|---|
| App shell | `src/components/layout/` | Header, activity panel, notification center. |
| Main pages | `src/components/pages/` | Company overview, vineyard, winery, sales, finance, research, staff, weather, Winepedia, profile, settings, achievements, highscores, admin. |
| Sales page tabs | `src/components/pages/sales/` | Orders, contracts, wine cellar, wine assignment modal. |
| Finance components | `src/components/finance/` | Reports, research panel, founder panel, staff wage summary; feature tabs inject loans and any future board/share UI. |
| Winepedia tabs | `src/components/pages/winepedia/` | Countries, grapes, customers, economy, weather, grape buyers, research, structure/taste math, quality/yield references. |
| Reusable game UI | `src/components/ui/` | Modals, activity UI, wine breakdowns, shadCN wrappers. |

## Database Areas

| Area | Path | Notes |
|---|---|---|
| Core | `src/lib/database/core/` | Company, game state, staff, teams, activities, achievements, highscores, notifications, loans/lenders, share scaffolding, research unlocks. |
| Activities/inventory | `src/lib/database/activities/` | Activities, wine batches, vineyard persistence helpers. |
| Customers/prestige/sales | `src/lib/database/customers/` | Customer records, sales orders, prestige events, relationship boosts. |
| Sales markets/contracts | `src/lib/database/sales/` | Contracts, grape buyer/supplier market rows, loyalty, buy offers. |
| Forward pre-sale contracts | `src/lib/services/sales/forwardContractService.ts` | Market-driven, company/prestige-scaled contracts for bottled wine and grape/must, generated by bulk buyers. See [AIDescriptions_coregame.md](AIDescriptions_coregame.md#forward-pre-sale-contracts-implemented). |
| Migrations | `migrations/` | SQL for current schema changes; update when schema changes are made. |

## Important Current Status Notes

- Current public-company/share-market runtime is not active in mainline. Existing share/board database and constants are scaffolding plus a no-op feature seam.
- Founder economy is active and intentionally smaller than the public-company/share system.
- Weather is active for forecast state, grape market volatility, and vineyard health/ripeness impact.
- Research gates are active for grapes, fermentation, staff/vineyard caps, contracts, and grape buyer progression; equipment and vineyard-technique tracks remain future work.
- Completed or superseded implementation docs live under `docs/superpowers/completed/`.
- Active design/planning docs remain under `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Test Layout

| Test area | Path |
|---|---|
| Activity and work | `tests/activity/` |
| Admin/test lab | `tests/admin/` |
| Core tick | `tests/core/` |
| Finance and loans | `tests/finance/` |
| Prestige | `tests/prestige/` |
| Research | `tests/research/`, `tests/user/research*.test.ts` |
| Sales/contracts/grape markets | `tests/sales/` |
| User/company/staff/achievements | `tests/user/` |
| Vineyard/weather | `tests/vineyard/` |
| Wine/taste/aging/winery | `tests/wine/` |

Known current suite caveat from the documentation audit: `tests/user/researchPanelVisibility.test.ts` has two active failing visibility expectations.

## Documentation Map

| Need | Start here |
|---|---|
| Short project entry point | `readme.md` |
| Stable domain vocabulary | `CONTEXT.md` |
| Current implemented systems | `docs/AIdocs/AIDescriptions_coregame.md` |
| Wine variable flow | `docs/WineSystem_VariableRelationshipMap.md` |
| Research status/design | `docs/superpowers/specs/2026-05-21-research-mechanic-design.md` |
| Founder economy | `docs/superpowers/plans/2026-05-20-early-game-balance-founder-economy.md` |
| Weather phase 2 | `docs/superpowers/specs/2026-05-23-weather-phase-2-readiness-design.md` |
| Public-company/share reintroduction references | `docs/superpowers/plans/PublicCompanyPlan.md`, `docs/superpowers/plans/PublicCompanyImplementation.md` |
| Completed implementation records | `docs/superpowers/completed/` |

