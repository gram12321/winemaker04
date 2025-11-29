# Guideline for versionlog update for AI-Agents

## 🎯 **Core Principles**
- **ALWAYS use MCP GitHub tools** (`mcp_github2_get_commit`, `mcp_github2_list_commits`) - NEVER use terminal git commands
- **ALWAYS retrieve actual commit data** - Don't guess or assume what changed
- **Verify existing entries** against actual commits before adding new ones

## 📋 **Entry Requirements**
1. **Use `mcp_github2_get_commit` with `include_diff: true`** to get exact file changes and stats
2. **Include specific details:**
   - Mark **NEW FILE:** with exact line counts (e.g., "NEW FILE: component.tsx (372 lines)")
   - Mark **REMOVED:** files that were deleted
   - Include file change stats (e.g., "42 additions, 15 deletions")
   - Note database schema changes explicitly
   
3. **Grouping commits:**
   - Related commits (same feature) can be grouped into one version entry
   - Each entry should cover 1-4 related commits if similiar
   - Large refactors or feature sets may need separate entries

## 📂 **Repository Info**
- **Owner:** gram12321
- **Repository:** winemaker04
- **Full URL:** https://github.com/gram12321/winemaker04.git

---
## Version 0.096 - Share System Architecture Refactor
**Date:** 2025-11-29 | **Commit:** d711f55 | **Stats:** 2,939 additions, 2,318 deletions

### 🏗️ **Major Service Architecture Refactor**
- **REMOVED:** `src/lib/services/finance/shareManagementService.ts` (1,018 lines) - Consolidated into new structure
- **REMOVED:** `src/lib/services/finance/sharePriceIncrementService.ts` (696 lines) - Replaced by modular services
- **REMOVED:** `src/lib/services/finance/shareValuationService.ts` (247 lines) - Replaced by modular services
- **REMOVED:** `src/lib/services/finance/growthTrendService.ts` (136 lines) - Moved to shares subdirectory

### 📦 **New Modular Share Services**
- **NEW FILE:** `src/lib/services/finance/shares/sharePriceService.ts` (657 lines) - Core share price calculation service
- **NEW FILE:** `src/lib/services/finance/shares/shareOperationsService.ts` (544 lines) - Share issuance, buyback, and ownership operations
- **NEW FILE:** `src/lib/services/finance/shares/shareMetricsService.ts` (446 lines) - Financial metrics calculation and tracking
- **NEW FILE:** `src/lib/services/finance/shares/growthTrendService.ts` (232 lines) - Growth trend analysis
- **NEW FILE:** `src/lib/services/finance/shares/sharePriceAdjustmentHelpers.ts` (127 lines) - Price adjustment utility functions
- **NEW FILE:** `src/lib/services/finance/shares/sharePriceBreakdownHelpers.ts` (149 lines) - Price breakdown calculation helpers
- **NEW FILE:** `src/lib/services/finance/shares/shareCalculations.ts` (124 lines) - Core share calculation utilities

### 🗄️ **Database Layer Improvements**
- **NEW FILE:** `src/lib/database/core/companySharesDB.ts` (208 lines) - Dedicated share ownership database operations
- `src/lib/database/core/companiesDB.ts` - Streamlined company database operations (14 additions, 87 deletions)
- `migrations/sync_vercel_schema.sql` - Database schema updates (67 additions)

### 🎨 **UI & Type System Updates**
- `src/components/finance/ShareManagementPanel.tsx` - Updated to use new service architecture (53 additions, 30 deletions)
- `src/lib/types/types.ts` - Enhanced type definitions for new share system (150 additions)
- `src/lib/types/index.ts` - Added type exports (9 additions)
- `src/lib/services/index.ts` - Updated service exports (52 additions, 2 deletions)
- `src/lib/services/user/companyService.ts` - Company service updates (68 additions, 80 deletions)
- `docs/share_price.md` - Documentation updates (12 additions, 9 deletions)

## Version 0.095-0.095c - Share Price Expectation System & Fixes (Combined)
**Date:** 2025-11-28 | **Commits:** 2351863 (0.095), 42aedfa (0.095a), fdd7cc7 (0.095b), 09e3789 (0.095c) | **Stats:** Combined 719 additions, 502 deletions

### 📊 **Share Price Expectation System**
- `src/lib/services/finance/sharePriceIncrementService.ts` - Enhanced expectation system based on past year performance and company size (54 additions, 20 deletions)
- `src/lib/constants/shareValuationConstants.ts` - Updated expectation constants (31 additions, 9 deletions)
- `src/components/finance/ShareManagementPanel.tsx` - Enhanced UI for expectation display (57 additions, 30 deletions)

### 🐛 **Bug Fixes & Improvements**
- `src/lib/services/finance/sharePriceIncrementService.ts` - Share price calculation fixes (52 additions, 47 deletions)
- `src/lib/services/finance/shareManagementService.ts` - Share management fixes (1 addition, 16 deletions)
- `docs/share_price.md` - Documentation corrections (4 additions, 1 deletion)
- `src/lib/services/finance/economyService.ts` - Build fix (1 deletion)

## Version 0.094 - Unified 48-Week Expectation System
**Date:** 2025-11-28 | **Commit:** 29d08ec | **Stats:** 742 additions, 323 deletions

### 📈 **48-Week Historical Tracking System**
- `src/lib/services/finance/sharePriceIncrementService.ts` - Unified 48-week expectation system implementation (230 additions, 160 deletions)
- `src/components/finance/ShareManagementPanel.tsx` - Enhanced UI for 48-week historical display (322 additions, 158 deletions)
- `src/lib/constants/shareValuationConstants.ts` - Added 48-week expectation constants (39 additions)
- `src/lib/services/finance/shareManagementService.ts` - Share management updates (73 additions, 3 deletions)
- `src/lib/services/prestige/prestigeService.ts` - Prestige service integration (65 additions, 1 deletion)
- `src/lib/database/core/companyMetricsHistoryDB.ts` - Database operations updates (13 additions, 1 deletion)

## Version 0.093a - Database Layer Improvements
**Date:** 2025-11-28 | **Commit:** a6b6525 | **Stats:** 161 additions, 139 deletions

### 🗄️ **Database Refactoring**
- **NEW FILE:** `src/lib/database/dbMapperUtils.ts` (50 lines) - Centralized database mapper utilities
- `src/lib/database/core/companiesDB.ts` - Improved company database operations (43 additions, 30 deletions)
- `src/lib/database/core/companyMetricsHistoryDB.ts` - Metrics history database improvements (13 additions, 25 deletions)
- `src/lib/database/core/loansDB.ts` - Loan database cleanup (7 additions, 30 deletions)
- Database operation improvements across: `achievementsDB.ts`, `inventoryDB.ts`, `researchUnlocksDB.ts`, `staffDB.ts`, `transactionsDB.ts`, `usersDB.ts`, `wineLogDB.ts`, `salesDB.ts`, `contractDB.ts`

## Version 0.093 - Share Price System & Metrics History
**Date:** 2025-11-28 | **Commit:** 0e51073 | **Stats:** 4,026 additions, 573 deletions

### 💹 **Share Price & Valuation System**
- **NEW FILE:** `src/lib/services/finance/sharePriceIncrementService.ts` (587 lines) - Incremental share price adjustment system
- **NEW FILE:** `src/lib/services/finance/shareValuationService.ts` (248 lines) - Share valuation calculations
- **NEW FILE:** `src/lib/services/finance/growthTrendService.ts` (136 lines) - Growth trend analysis service
- **NEW FILE:** `src/lib/constants/shareValuationConstants.ts` (62 lines) - Share valuation constants
- **REMOVED:** `src/lib/services/finance/shareValueService.ts` (189 lines) - Replaced by shareValuationService

### 📊 **Company Metrics History System**
- **NEW FILE:** `src/lib/database/core/companyMetricsHistoryDB.ts` (319 lines) - Weekly metrics snapshot database operations
- `src/lib/services/finance/financeService.ts` - Enhanced finance service with metrics tracking (262 additions, 1 deletion)
- `src/lib/services/core/gameTick.ts` - Weekly metrics snapshot integration (35 additions, 3 deletions)

### 🎨 **UI Components**
- `src/components/finance/ShareManagementPanel.tsx` - Major share management UI overhaul (722 additions, 270 deletions)
- **NEW FILE:** `src/components/pages/winepedia/ShareMarketTab.tsx` (215 lines) - Share market information tab
- `src/components/pages/Winepedia.tsx` - Added Share Market tab (3 additions, 2 deletions)
- `src/components/pages/AdminDashboard.tsx` - Admin tools updates (81 additions)

### 📚 **Documentation**
- **NEW FILE:** `docs/share_price.md` (298 lines) - Comprehensive share price system documentation
- **NEW FILE:** `docs/plan.plan.md` (279 lines) - Planning documentation
- `docs/PROJECT_INFO.md` - Project info updates (38 additions, 27 deletions)

### 🧪 **Testing**
- **NEW FILE:** `tests/finance/shareValuation.test.ts` (329 lines) - Share valuation test suite

### 🗄️ **Database Schema**
- `migrations/sync_vercel_schema.sql` - Database schema updates for metrics history (53 additions)
- `src/lib/database/core/companiesDB.ts` - Company database updates (37 additions, 1 deletion)

## Version 0.092a - Build Fix
**Date:** 2025-11-26 | **Commit:** efcb0f8 | **Stats:** 8 additions, 1 deletion

### 🔧 **Build Fixes**
- `src/components/finance/IncomeBalanceView.tsx` - Build error fixes (6 additions)
- `tests/activity/workCalculator.test.ts` - Test updates (2 additions, 1 deletion)

## Version 0.092 - Finance & Share Management Tuning
**Date:** 2025-11-26 | **Commit:** f8bda77 | **Stats:** 612 additions, 134 deletions

### 💹 Share & Treasury Updates
- `src/components/finance/ShareManagementPanel.tsx` — Added detailed shareholder breakdowns, IPO readiness cues, and board controls (258 additions, 65 deletions).
- `src/lib/services/finance/shareManagementService.ts` — Expanded equity math for dilution, investor classes, and dividend scheduling (201 additions, 1 deletion).
- `src/components/finance/CashFlowView.tsx` — Reworked inflow/outflow grouping plus rolling net balance graph (81 additions, 42 deletions).
- `src/lib/services/finance/financeService.ts` — Updated to expose new equity metrics to the UI (30 additions, 24 deletions).

### 🛠️ Supporting Fixes
- `src/lib/constants/financeConstants.ts` — Added share-category descriptors (36 additions).
- `src/lib/services/core/startingConditionsService.ts` / `user/companyService.ts` — Seed companies with the new share fields (6 additions, 2 deletions combined).

## Version 0.09-0.091B - Public Companies & Equity Framework (Combined)
**Date:** 2025-11-23 to 2025-11-25 | **Commits:** d108f94 (0.09), 10709b7 (0.091), e1435d4 (0.091a), ef4e4b8 (0.091B) | **Stats:** Combined 4,452 additions, 1,472 deletions

### 🏛️ Public Company Infrastructure
- **NEW FILE:** `src/components/finance/ShareManagementPanel.tsx` (445 lines) — Investor ledger with issuance controls and market cap summary.
- **NEW FILES:** `src/lib/services/finance/shareManagementService.ts` (514 lines) & `shareValueService.ts` (189 lines) — Core business logic for IPO states, share pricing, dilution, and dividend forecasting.
- `src/components/pages/AdminDashboard.tsx` / `Profile.tsx` / `Login.tsx` — Added IPO toggles, ownership visibility, and balance sheets (481 additions, 5 deletions across files).
- `src/lib/database/core/companiesDB.ts` & `usersDB.ts` — Persist float, listing status, and user cash balance (43 additions, 3 deletions).

### 👥 Staff & Activity Enhancements
- `src/components/pages/Staff.tsx`, `StaffModal.tsx`, `StaffWageSummary.tsx`, `StaffSkillBar.tsx`, and `activity/workCalculator.ts` — Introduced experience tracking, contribution scoring, and revised wage multipliers (409 additions, 113 deletions).
- `src/lib/services/activity/activitymanagers/activityManager.ts` & `workcalculators/workCalculator.ts` — Support staff-derived research/finance work (112 additions, 24 deletions).

### 🧮 Finance & Models
- `src/components/finance/IncomeBalanceView.tsx` / `economyConstants.ts` / `loanService.ts` — Connected dividends, credit rating, and lender behaviour to equity state (200+ additions).
- `src/components/pages/winepedia/MathematicalModelsTab.tsx` — Documented new share valuation and contribution curves (517 additions, 456 deletions).
- `src/lib/utils/calculator.ts` — Added helper functions for contribution caps and equity weighting (76 additions, 28 deletions).

### 🔧 IPO Phase Fixes
- **NEW FILE:** `src/lib/services/user/userBalanceService.ts` (123 lines) — Centralises user cash/dividend payouts.
- `src/lib/services/core/startingConditionsService.ts`, `StartingConditionsModal.tsx`, `AdminDashboard.tsx` — Ensure IPO-ready companies spawn with voters, treasury stock, and user cash balances (330+ additions, 59 deletions).

## Documentation Update - Versionlog Split
**Date:** 2025-11-23 | **Commit:** 1e5bfc4 | **Stats:** 1,197 additions, 1,195 deletions

### 📝 Docs
- **NEW FILE:** `docs/versionlog_legacy.md` (1,196 lines) — Archived historical entries (≤0.06).
- `docs/versionlog.md` — Trimmed to active releases while keeping contributor guidelines (1 deletion of legacy content, 1 addition referencing the archive).

## Version 0.082 - Research Grapes & Unlocks
**Date:** 2025-11-23 | **Commit:** e0c1b16 | **Stats:** 856 additions, 129 deletions

### 🔬 Research Unlock System
- **NEW FILE:** `src/lib/database/core/researchUnlocksDB.ts` (154 lines) and **NEW FILE:** `src/lib/utils/researchUtils.ts` (39 lines) — Track unlocked grape families and expose helper utilities.
- `src/lib/constants/researchConstants.ts` — Added grape-focused research tracks (150 additions, 18 deletions).
- `src/components/finance/ResearchPanel.tsx` — Display unlock progress and next-tier requirements (117 additions, 33 deletions).
- `src/lib/services/activity/activitymanagers/researchManager.ts` & `researchWorkCalculator.ts` — Reward unlocked varietals and adjust workload (131 additions, 17 deletions).

### 🍇 Gameplay Integration
- `src/components/pages/winepedia/GrapeVarietiesTab.tsx`, `PlantingOptionsModal.tsx`, and `StartingConditionsModal.tsx` — Gate planting lists and starting perks behind research progress (131 additions, 8 deletions).
- `src/lib/constants/startingConditions.ts` / `startingConditionsService.ts` — Seed research with founders’ expertise (71 additions, 16 deletions).
- `tests/user/startingConditions.test.ts` — Coverage for grape unlock flows (30 additions).

## Version 0.076b-0.076C - Test & Economy Fixes (Combined)
**Date:** 2025-11-23 | **Commits:** dd4b2f3 (0.076b), 2ada3b9 (0.76C bug), 545fea1 (0.076C) | **Stats:** Combined 1,289 additions, 1,193 deletions

### 🧪 Test Improvements
- `tests/user/hireStaffWorkflow.test.ts`, `researchWorkflow.test.ts` (NEW FILE, 213 lines), and `startingConditions.test.ts` — Expanded hiring, research, and founder scenario coverage (405 additions, 963 deletions net due to refactors).
- `server/test-api.ts` & `test-viewer/TestViewer.tsx` — Added mock endpoints plus viewer UX refinements for running targeted suites (113 additions, 24 deletions).

### ⚙️ Gameplay Fixes
- `src/lib/services/core/gameState.ts` — Patched economy-phase persistence regression (17 additions).
- `src/lib/services/finance/loanService.ts` — Addressed lender seizure math after IPO changes (144 additions, 23 deletions).
- `src/lib/services/activity/activitymanagers/researchManager.ts` and `researchConstants.ts` — Synced research targets with new data set (58 additions, 57 deletions).
- Renamed grape icon assets to snake_case for test harness consistency.

---
## Version 0.081 - Research System Enhancements
**Date:** 2025-11-21 | **Commit:** 567a7a8 | **Stats:** 1,639 additions, 1,048 deletions

### 🔬 **Research System Improvements**
- `src/lib/constants/researchConstants.ts` - Enhanced research constants (145 lines)
- `src/components/finance/ResearchPanel.tsx` - Major research panel enhancements (195 additions, 28 deletions)
- `src/lib/services/activity/activitymanagers/researchManager.ts` - Enhanced research manager (120 additions, 18 deletions)
- `src/lib/services/activity/workcalculators/researchWorkCalculator.ts` - Enhanced research work calculations (139 additions, 19 deletions)
- `src/lib/services/prestige/prestigeService.ts` - Research prestige integration (123 additions, 93 deletions)

### 🎨 **UI Updates**
- `src/components/ui/modals/UImodals/prestigeModal.tsx` - Prestige modal updates (473 additions, 481 deletions)
- `src/components/finance/LoansView.tsx` - Loan view improvements (85 additions, 87 deletions)

### 🛠️ **System Updates**
- `src/lib/services/user/teamService.ts` - Team service updates (55 additions, 55 deletions)
- `src/lib/services/vineyard/vineyardService.ts` - Vineyard service updates (32 additions, 32 deletions)
- `migrations/sync_vercel_schema.sql` - Database schema updates (43 additions, 1 deletion)

## Version 0.08 - Research System Implementation
**Date:** 2025-11-21 | **Commit:** d44000c | **Stats:** 2,051 additions, 363 deletions

### 🔬 **Research System Framework**
- **NEW FILE:** `src/lib/services/activity/activitymanagers/researchManager.ts` (26 lines) - Research activity manager
- **NEW FILE:** `src/lib/services/activity/workcalculators/researchWorkCalculator.ts` (32 lines) - Research work calculator
- **NEW FILE:** `src/components/finance/ResearchPanel.tsx` (42 lines) - Research panel component
- **REMOVED:** `src/components/finance/UpgradesPlaceholder.tsx` (27 lines) - Replaced by ResearchPanel
- `src/lib/constants/activityConstants.ts` - Added research activity constants (20 additions, 20 deletions)
- `src/lib/services/activity/activitymanagers/activityManager.ts` - Research activity integration (50 additions, 47 deletions)
- `src/lib/services/activity/workcalculators/workCalculator.ts` - Research work calculation support (26 additions, 26 deletions)

### 🧪 **Test System Integration**
- `test-viewer/TestViewer.tsx` - Enhanced test viewer (266 additions, 6 deletions)
- **NEW FILE:** `tests/user/companyCreation.test.ts` (395 lines) - Company creation tests
- **NEW FILE:** `tests/user/hireStaffWorkflow.test.ts` (674 lines) - Staff hiring workflow tests
- **NEW FILE:** `tests/user/startingConditions.test.ts` (293 lines) - Starting conditions tests

### 🛠️ **System Updates**
- `src/lib/types/types.ts` - Research type definitions (58 additions, 56 deletions)
- `src/lib/services/finance/wageService.ts` - Wage service updates (21 additions, 21 deletions)
- `src/lib/services/user/staffService.ts` - Staff service updates (13 additions, 13 deletions)
- `src/lib/utils/colorMapping.ts` - Color mapping updates (23 additions, 35 deletions)
- `src/lib/utils/icons.tsx` - Icon utility updates (18 additions, 18 deletions)

## Version 0.076a - Test Suite Enhancements
**Date:** 2025-11-21 | **Commit:** edc8b60 | **Stats:** 1,270 additions, 501 deletions

### 🧪 **Test System Improvements**
- `test-viewer/TestViewer.tsx` - Major test viewer enhancements (1,105 additions, 488 deletions)
- **NEW FILE:** `tests/vineyard/vineyardCreation.test.ts` (154 lines) - Vineyard creation tests
- `tests/vineyard/grapeSuitability.test.ts` - Grape suitability test updates (1 addition, 1 deletion)
- `tests/vineyard/yieldCalculator.test.ts` - Yield calculator test updates (9 additions, 11 deletions)

## Version 0.076 - Lender Creation Bug Fix
**Date:** 2025-11-21 | **Commit:** 99981d9 | **Stats:** 196 additions, 167 deletions

### 💰 **Loan System Fixes**
- `src/lib/services/finance/lenderService.ts` - Fixed lender creation to ensure 3 of each type (77 additions, 60 deletions)
- `src/lib/services/finance/loanService.ts` - Fixed vineyard value seizure to max 50% (119 additions, 107 deletions)

## Version 0.075 - Automated Testing Framework & pnpm Migration
**Date:** 2025-11-21 | **Commit:** c7d5c9a | **Stats:** 9,517 additions, 6,308 deletions

### 🧪 **Testing Framework Implementation**
- **NEW FILE:** `tests/README.md` (96 lines) - Test documentation
- **NEW FILE:** `tests/activity/workCalculator.test.ts` (166 lines) - Work calculator tests
- **NEW FILE:** `tests/finance/loanService.test.ts` (165 lines) - Loan service tests
- **NEW FILE:** `tests/finance/wageService.test.ts` (150 lines) - Wage service tests
- **NEW FILE:** `tests/vineyard/grapeSuitability.test.ts` (277 lines) - Grape suitability tests
- **NEW FILE:** `tests/vineyard/yieldCalculator.test.ts` (281 lines) - Yield calculator tests
- **NEW FILE:** `tests/wine/fermentationCharacteristics.test.ts` (214 lines) - Fermentation characteristics tests

### 🛠️ **Test Infrastructure**
- **NEW FILE:** `test-viewer/TestViewer.tsx` (822 lines) - Test viewer component
- **NEW FILE:** `test-viewer/TestViewerPage.tsx` (13 lines) - Test viewer page
- **NEW FILE:** `test-viewer/index.html` (432 lines) - Test viewer HTML
- **NEW FILE:** `test-viewer/viewer.js` (161 lines) - Test viewer JavaScript
- **NEW FILE:** `test-viewer/README.md` (56 lines) - Test viewer documentation
- **NEW FILE:** `server/test-api.ts` (132 lines) - Test API server
- **NEW FILE:** `docs/Agents_feedback/testscripts` (1,615 lines) - Test script documentation

### 📦 **Package Manager Migration**
- **REMOVED:** `package-lock.json` (6,302 lines) - Removed npm lock file
- **NEW FILE:** `pnpm-lock.yaml` (4,897 lines) - pnpm lock file
- **NEW FILE:** `pnpm-workspace.yaml` (2 lines) - pnpm workspace configuration
- `package.json` - Updated for pnpm and test dependencies (7 additions, 2 deletions)
- Added test scripts: `test` and `test:watch` using Vitest

### ⚙️ **Configuration Updates**
- `vite.config.ts` - Vitest configuration (8 additions, 1 deletion)
- `tsconfig.json` - TypeScript configuration for tests (3 additions, 2 deletions)
- `src/components/pages/AdminDashboard.tsx` - Admin dashboard updates (8 additions, 1 deletion)

## Version 0.074a - Supabase Fix & Vineyard Value Calculations
**Date:** 2025-11-21 | **Commit:** cbe577c | **Stats:** 70 additions, 54 deletions

### 🗄️ **Database & Service Updates**
- `migrations/sync_vercel_schema.sql` - Supabase schema fixes (44 additions, 44 deletions)
- `src/lib/services/core/startingConditionsService.ts` - Vineyard value calculations in starting conditions (14 additions, 3 deletions)
- `src/lib/services/vineyard/vineyardManager.ts` - Vineyard value calculation improvements (10 additions, 5 deletions)
- `src/lib/services/sales/salesService.ts` - Sales service updates (2 additions, 2 deletions)

## Version 0.074 - Database Schema Updates
**Date:** 2025-11-14 | **Commit:** b813805 | **Stats:** 74 additions, 10 deletions

### 🗄️ **Database Updates**
- `migrations/sync_vercel_schema.sql` - Database schema updates (71 additions, 8 deletions)
- `src/components/layout/ActivityPanel.tsx` - Activity panel updates (2 additions, 2 deletions)

## Version 0.073-0.073DB - Bug Fixes & System Improvements (Combined)
**Date:** 2025-11-13 to 2025-11-14 | **Commits:** d2067c8 (0.073), c0bb9b5 (0.073a), e0f4656 (0.073b), 9dca737 (0.073C), 7ddc08d (0.073D), 8a896e5 (0.073DA), c1ae140 (0.073DB) | **Stats:** Combined 1,801 additions, 654 deletions

### 🐛 **Bug Fixes & Improvements**
- `src/lib/services/prestige/prestigeService.ts` - Vineyard prestige bug fixes (17 additions, 4 deletions)
- `src/lib/services/user/achievementService.ts` - Achievement service improvements (54 additions, 27 deletions)
- `src/lib/services/finance/loanService.ts` - Loan service bug fixes (147 additions, 119 deletions across commits)
- `src/lib/services/sales/contractGenerationService.ts` - Contract generation improvements (337 additions, 161 deletions)
- `src/lib/services/sales/contractService.ts` - Contract service updates (134 additions, 28 deletions)
- **NEW FILE:** `src/lib/constants/contractConstants.ts` (209 lines) - Contract constants
- **NEW FILE:** `src/lib/services/sales/expirationService.ts` (104 lines) - Contract expiration service
- **NEW FILE:** `src/hooks/useWinePriceCalculator.ts` (63 lines) - Wine price calculator hook
- **REMOVED:** `src/hooks/useEstimatedPrice.ts` (46 lines) - Replaced by useWinePriceCalculator

### 🎨 **UI Component Updates**
- `src/components/pages/sales/ContractsTab.tsx` - Contract tab improvements (179 additions, 60 deletions)
- `src/components/pages/sales/AssignWineModal.tsx` - Wine assignment modal updates (50 additions, 7 deletions)
- `src/components/ui/components/grapeQualityBreakdown.tsx` - Quality breakdown updates (48 additions, 72 deletions)
- `src/components/finance/LoansView.tsx` - Loan view updates (28 additions, 9 deletions)

### 🗄️ **Database Updates**
- `migrations/sync_vercel_schema.sql` - Database schema updates (303 additions, 59 deletions)
- `src/lib/database/activities/inventoryDB.ts` - Inventory database updates (6 additions, 2 deletions)

## Version 0.072 - Bug Fixes: Features, Sales, Orders, Contracts & Loans
**Date:** 2025-11-13 | **Commit:** e46d1c6 | **Stats:** 688 additions, 153 deletions

### 🐛 **System Bug Fixes**
- `src/lib/services/wine/features/featureService.ts` - Feature service bug fixes (108 additions, 52 deletions)
- `src/lib/services/finance/loanService.ts` - Loan service bug fixes (106 additions, 8 deletions)
- `src/lib/services/sales/salesOrderService.ts` - Sales order service fixes (62 additions, 1 deletion)
- `src/lib/services/sales/generateOrder.ts` - Order generation fixes (25 additions, 5 deletions)
- **NEW FILE:** `src/lib/services/sales/expirationService.ts` (104 lines) - Contract expiration service
- `src/lib/services/vineyard/vineyardManager.ts` - Vineyard manager fixes (42 additions, 5 deletions)
- `src/lib/services/core/gameTick.ts` - Game tick fixes (15 additions, 2 deletions)

### 🎨 **UI Component Updates**
- `src/components/ui/modals/activitymodals/LenderSearchOptionsModal.tsx` - Lender search modal improvements (128 additions, 32 deletions)
- `src/components/pages/sales/OrdersTab.tsx` - Orders tab updates (26 additions, 4 deletions)

### 🗄️ **Database Updates**
- `migrations/sync_vercel_schema.sql` - Database schema updates (4 additions)
- `src/lib/database/core/supabase.ts` - Supabase client updates (12 additions, 1 deletion)
- `src/lib/database/customers/salesDB.ts` - Sales database updates (9 additions, 1 deletion)

---
## Version 0.071a - Build Fix
**Date:** 2025-11-13 | **Commit:** d8a0e97 | **Stats:** 10 additions

### 🔧 **Build Fixes**
- `src/lib/types/types.ts` - Type definition fixes (10 additions)

## Version 0.07 - Sales Contracts, Grey Rot/Noble Rot, Starting Conditions & Sangiovese
**Date:** 2025-11-13 | **Commit:** deaafe0 | **Stats:** 4,601 additions, 561 deletions

### 📋 **Sales Contracts System**
- **NEW FILE:** `src/components/pages/sales/ContractsTab.tsx` (441 lines) - Complete sales contracts management interface
- **NEW FILE:** `src/components/pages/sales/AssignWineModal.tsx` (284 lines) - Wine assignment modal for contracts
- `src/components/pages/Sales.tsx` - Added Contracts tab integration (30 additions, 2 deletions)
- `src/components/pages/sales/OrdersTab.tsx` - Enhanced order management with contract support (88 additions, 25 deletions)

### 🍷 **Wine Features: Grey Rot & Noble Rot**
- **NEW FILE:** `src/lib/constants/wineFeatures/greyRot.ts` (171 lines) - Grey rot feature configuration
- **NEW FILE:** `src/lib/constants/wineFeatures/nobleRot.ts` (254 lines) - Noble rot (Botrytis) feature configuration
- `src/lib/constants/wineFeatures/lateHarvest.ts` - Enhanced late harvest features (95 additions, 40 deletions)
- `src/lib/constants/wineFeatures/commonFeaturesUtil.ts` - Updated common feature utilities (16 additions, 6 deletions)
- `src/components/ui/components/FeatureDisplay.tsx` - Enhanced feature display for rot features (103 additions, 23 deletions)

### 🍇 **New Grape Variety: Sangiovese**
- `src/lib/constants/grapeConstants.ts` - Added Sangiovese grape variety (54 additions, 25 deletions)
- **NEW FILE:** `public/assets/icons/grape/icon_sangiovese.png` - Sangiovese grape icon

### 🎮 **Starting Conditions System**
- `src/lib/constants/startingConditions.ts` - Enhanced starting conditions configuration (105 additions, 26 deletions)
- `src/components/ui/modals/UImodals/StartingConditionsModal.tsx` - Renamed and enhanced starting conditions modal (43 additions, 5 deletions)
- `src/components/pages/Login.tsx` - Starting conditions integration (16 additions, 12 deletions)
- `src/components/pages/AdminDashboard.tsx` - Admin tools for starting conditions (21 additions, 3 deletions)
- `src/components/pages/Staff.tsx` - Staff starting conditions display (30 additions, 4 deletions)

### 🛠️ **System Updates**
- `src/hooks/useEstimatedPrice.ts` - Enhanced estimated price calculations (39 additions, 6 deletions)
- `src/lib/constants/loanConstants.ts` - Updated loan constants (6 additions, 4 deletions)
- `src/lib/constants/achievementConstants.ts` - Achievement system updates (15 additions, 2 deletions)
- `migrations/sync_vercel_schema.sql` - Database schema updates (3 additions, 1 deletion)

## Version 0.068 - Starting Conditions System Implementation
**Date:** 2025-11-11 | **Commit:** 65294cb | **Stats:** 1,977 additions, 179 deletions

### 🎮 **Starting Conditions Framework**
- **NEW FILE:** `src/lib/constants/startingConditions.ts` (225 lines) - Comprehensive starting conditions configuration
- **NEW FILE:** `src/lib/services/core/startingConditionsService.ts` (172 lines) - Starting conditions service
- **NEW FILE:** `src/components/ui/modals/StartingConditionsModal.tsx` (278 lines) - Starting conditions selection modal
- `src/components/pages/Login.tsx` - Starting conditions integration in login flow (51 additions, 6 deletions)
- `src/components/pages/AdminDashboard.tsx` - Admin tools for starting conditions (94 additions, 2 deletions)
- `src/components/pages/CompanyOverview.tsx` - Starting conditions display (69 additions, 2 deletions)

### 🖼️ **Story Images**
- Added 10 story character images: `bianca.webp`, `camille.webp`, `johann.webp`, `lukas.webp`, `pierre.webp`, `pierre_bg.webp`, `pierrecamille.webp`, `roberto.webp`, `robertobianca.webp`, `weissburg.webp`

### 💰 **Loan System Enhancements**
- `src/lib/services/finance/loanService.ts` - Major loan service enhancements (798 additions, 69 deletions)
- `src/components/finance/LoansView.tsx` - Enhanced loan management UI (42 additions, 15 deletions)
- `src/lib/database/core/loansDB.ts` - Database operations updates (12 additions, 3 deletions)
- `src/lib/constants/loanConstants.ts` - Loan constants updates (3 additions)

### 🛠️ **System Updates**
- `src/lib/services/admin/adminService.ts` - Admin service enhancements (30 additions, 1 deletion)
- `src/lib/services/core/gameTick.ts` - Game tick updates (8 additions, 3 deletions)
- `src/lib/services/user/staffService.ts` - Staff service cleanup (57 deletions)
- `migrations/sync_vercel_schema.sql` - Database schema updates (6 additions, 1 deletion)

## Version 0.067-0.067a - Icon System Updates (Combined)
**Date:** 2025-11-10 | **Commits:** 7658b7d (0.067), bded709 (0.067a) | **Stats:** Combined 571 additions, 142 deletions

### 🎨 **Icon System Improvements**
- **NEW FILES:** 6 characteristic icons: `icon_acidity.png`, `icon_aroma.png`, `icon_body.png`, `icon_spice.png`, `icon_sweetness.png`, `icon_tannins.png`
- **REMOVED:** Legacy characteristic icons (acidity.png, aroma.png, body.png, spice.png, sweetness.png, tannins.png)
- `src/lib/utils/icons.tsx` - Icon utility updates (4 additions, 4 deletions)
- `src/lib/constants/constants.ts` - Icon constant updates (61 additions, 27 deletions)

### 🎨 **UI Component Updates**
- `src/components/ui/modals/UImodals/StaffModal.tsx` - Enhanced staff modal with new icons (133 additions, 4 deletions)
- `src/components/pages/sales/OrdersTab.tsx` - Order display improvements (47 additions, 12 deletions)
- `src/components/pages/sales/WineCellarTab.tsx` - Wine cellar UI updates (26 additions, 5 deletions)
- `src/components/pages/Winery.tsx` - Winery page updates (10 additions, 8 deletions)

### 🛠️ **Service Updates**
- `src/lib/services/sales/generateOrder.ts` - Order generation improvements (79 additions, 11 deletions)
- `src/lib/database/activities/inventoryDB.ts` - Inventory database updates (59 additions, 1 deletion)
- `src/lib/database/customers/customerDB.ts` - Customer database improvements (34 additions, 25 deletions)
- `src/lib/services/wine/winery/inventoryService.ts` - Inventory service updates (21 additions, 2 deletions)
- `src/lib/types/types.ts` - Type system updates (17 additions)
- `src/lib/utils/utils.ts` - Utility function additions (27 additions)

## Version 0.066 - Loan Extension & Forced Loans System
**Date:** 2025-11-10 | **Commit:** b9073ef | **Stats:** 1,094 additions, 99 deletions

### 💰 **Loan Extension & Forced Loans**
- `src/lib/services/finance/loanService.ts` - Major loan service enhancements with extension and forced loan functionality (562 additions, 6 deletions)
- `src/lib/constants/loanConstants.ts` - Enhanced loan constants (36 additions)
- `src/components/finance/LoansView.tsx` - Enhanced loan management UI (58 additions, 12 deletions)
- `src/lib/database/core/loansDB.ts` - Database operations for loan extensions (9 additions, 3 deletions)

### 🍇 **Grape Icon Updates**
- Converted grape icons from .webp to .png format: Barbera, Chardonnay, Pinot Noir, Primitivo, Sauvignon Blanc
- **NEW FILE:** `icon_temperanillo.png` - Tempranillo grape icon

### 🎨 **UI Component Updates**
- `src/components/ui/modals/UImodals/winepediaGrapeInfoModal.tsx` - Enhanced grape info modal (103 additions, 18 deletions)
- `src/components/ui/components/grapeQualityBar.tsx` - Quality bar updates (9 additions, 2 deletions)
- `src/components/pages/winepedia/YieldProjectionTab.tsx` - Yield projection updates (4 additions, 2 deletions)

### 🛠️ **System Updates**
- `src/lib/services/vineyard/vineyardValueCalc.ts` - Vineyard value calculation improvements (120 additions, 15 deletions)
- `src/lib/services/core/gameTick.ts` - Game tick updates (10 additions, 6 deletions)
- `src/lib/services/prestige/prestigeService.ts` - Prestige service updates (3 additions, 2 deletions)
- `migrations/sync_vercel_schema.sql` - Database schema updates (1 addition)

## Version 0.065 - Grape Suitability UI Enhancement
**Date:** 2025-11-10 | **Commit:** e6a60e1 | **Stats:** 985 additions, 294 deletions

### 🍇 **Grape Suitability System**
- **NEW FILE:** `src/components/ui/modals/UImodals/winepediaGrapeInfoModal.tsx` (591 lines) - Comprehensive grape information modal
- **REMOVED:** `src/components/pages/winepedia/GrapeInfoView.tsx` (189 lines) - Replaced by modal
- `src/lib/services/wine/features/grapeDifficulty.ts` - Enhanced grape difficulty calculations (240 additions, 27 deletions)
- `src/lib/constants/grapeConstants.ts` - Enhanced grape constants (60 additions, 35 deletions)

### 🎨 **UI Component Updates**
- `src/components/pages/winepedia/GrapeVarietiesTab.tsx` - Enhanced grape varieties display (24 additions, 6 deletions)
- `src/lib/utils/utils.ts` - Added grape suitability utility functions (24 additions)

## Version 0.064 - Feature Accumulation & Economy Phase Display
**Date:** 2025-11-09 | **Commit:** 584ad8f | **Stats:** 132 additions, 37 deletions

### 🍷 **Wine Feature Accumulation**
- `src/lib/services/wine/features/featureService.ts` - Enhanced feature accumulation system (43 additions, 25 deletions)
- `src/components/ui/components/FeatureDisplay.tsx` - Improved feature display (2 additions, 2 deletions)

### 💰 **Economy Phase Impact Display**
- `src/components/pages/sales/OrdersTab.tsx` - Enhanced economy phase impact display (17 additions, 3 deletions)
- `src/components/pages/winepedia/EconomyTab.tsx` - Economy tab updates (4 additions)
- `src/components/ui/components/grapeQualityBar.tsx` - Quality bar enhancements (42 additions, 1 deletion)
- `src/lib/services/sales/generateCustomer.ts` - Customer generation updates (14 additions, 3 deletions)
- `src/lib/services/sales/generateOrder.ts` - Order generation updates (2 additions)
- `src/lib/services/sales/salesOrderService.ts` - Sales order service updates (3 additions, 1 deletion)

## Version 0.063-0.0632 - Grape Suitability System (Combined)
**Date:** 2025-11-08 to 2025-11-09 | **Commits:** 11bc48d (0.063), 89d9976 (0.0631), 5c4cd6b (0.0632) | **Stats:** Combined 829 additions, 135 deletions

### 🍇 **Grape Difficulty & Suitability Framework**
- **NEW FILE:** `src/lib/services/wine/features/grapeDifficulty.ts` (152 lines) - Grape difficulty calculation service
- `src/lib/constants/grapeConstants.ts` - Enhanced grape constants with difficulty and suitability data (172 additions across commits)
- `src/lib/constants/vineyardConstants.ts` - Vineyard constants updates (54 additions, 44 deletions)

### 🌞 **Sun & Altitude Suitability**
- `src/lib/services/vineyard/vineyardValueCalc.ts` - Enhanced vineyard value calculations with sun and altitude suitability (219 additions, 30 deletions)
- `src/components/ui/modals/UImodals/vineyardModal.tsx` - Enhanced vineyard modal with suitability display (71 additions, 11 deletions)
- `src/components/ui/modals/activitymodals/PlantingOptionsModal.tsx` - Planting options with suitability info (27 additions, 5 deletions)
- `src/components/pages/winepedia/YieldProjectionTab.tsx` - Yield projection with suitability (54 additions, 16 deletions)

### 🛠️ **System Updates**
- `src/lib/services/vineyard/vineyardManager.ts` - Vineyard management updates (8 additions, 2 deletions)
- `src/lib/services/vineyard/vineyardService.ts` - Vineyard service updates (16 additions, 3 deletions)
- `src/lib/services/wine/winescore/grapeQualityCalculation.ts` - Quality calculation updates (20 additions, 4 deletions)
- `src/lib/services/prestige/prestigeService.ts` - Prestige service updates (9 additions, 6 deletions)
- `migrations/sync_vercel_schema.sql` - Database schema updates (5 additions, 2 deletions)

## Version 0.062 - Finance Time Filters & Centralized Time Constants
**Date:** 2025-11-08 | **Commit:** 8842b24 | **Stats:** 343 additions, 96 deletions

### ⏰ **Time Constants System**
- **NEW FILE:** `src/lib/constants/timeConstants.ts` (14 lines) - Centralized time period constants
- `src/lib/constants/index.ts` - Added time constants export (1 addition)

### 💰 **Finance Time Filters**
- `src/components/finance/FinanceView.tsx` - Enhanced time filter system (209 additions, 6 deletions)
- `src/components/finance/IncomeBalanceView.tsx` - Improved income/balance time filtering (35 additions, 20 deletions)
- `src/lib/services/finance/financeService.ts` - Finance service time filter updates (26 additions, 17 deletions)

### 🛠️ **System Updates**
- `src/lib/services/finance/loanService.ts` - Loan service time filter updates (11 additions, 19 deletions)
- `src/lib/services/activity/workcalculators/bookkeepingWorkCalculator.ts` - Bookkeeping time calculations (9 additions, 7 deletions)
- `src/lib/services/core/gameTick.ts` - Game tick time updates (6 additions, 6 deletions)
- `src/lib/utils/utils.ts` - Time utility functions (17 additions, 10 deletions)
- `src/components/layout/NotificationCenter.tsx` - Notification center updates (5 additions, 6 deletions)

## Version 0.061 - Quick Loan System
**Date:** 2025-11-08 | **Commit:** 8a0b957 | **Stats:** 231 additions, 83 deletions

### 💰 **Quick Loan Feature**
- `src/lib/services/activity/activitymanagers/lenderSearchManager.ts` - Quick loan integration (17 additions, 16 deletions)
- `src/lib/services/activity/workcalculators/lenderSearchWorkCalculator.ts` - Quick loan work calculations (46 additions, 10 deletions)
- `src/lib/services/activity/workcalculators/takeLoanWorkCalculator.ts` - Take loan work calculator updates (18 additions, 3 deletions)
- `src/lib/constants/loanConstants.ts` - Quick loan constants (36 additions, 12 deletions)
- `src/components/finance/LoansView.tsx` - Quick loan UI (58 additions, 3 deletions)
- `src/components/ui/modals/activitymodals/LenderSearchOptionsModal.tsx` - Quick loan options (4 additions, 4 deletions)

### 🛠️ **System Updates**
- `src/lib/services/finance/lenderService.ts` - Lender service updates (14 additions, 6 deletions)
- `src/lib/services/finance/economyService.ts` - Economy service updates (4 additions, 4 deletions)
- `src/lib/constants/economyConstants.ts` - Economy constants updates (3 additions, 3 deletions)
- `src/lib/constants/namesConstants.ts` - Name constants updates (9 additions)
- `migrations/sync_vercel_schema.sql` - Database schema updates (1 addition, 1 deletion)

## Version 0.055 - Customer System Fixes
**Date:** 2025-11-08 | **Commit:** d1dc606 | **Stats:** 233 additions, 131 deletions

### 👥 **Customer Generation Improvements**
- `src/lib/services/sales/createCustomer.ts` - Enhanced customer generation logic (118 additions, 109 deletions)
- `src/hooks/useCustomerData.ts` - Improved customer data hook (13 additions, 3 deletions)
- `src/components/pages/winepedia/CustomersTab.tsx` - Customer display improvements (18 additions, 8 deletions)
- `src/lib/constants/constants.ts` - Customer constants updates (11 additions)

---
## Version 0.06 - Storyline Documentation & Sidebar Tweaks
**Date:** 2025-11-08 | **Commit:** 77eaf92f | **Stats:** 2,191 additions, 9 deletions

### 📚 Storyline Expansion
- **NEW FILE:** `docs/Story/STORY-BACKGROUND.md` (235 lines) — overarching narrative framework
- **NEW FILE:** `docs/Story/The_De_Luca_Family_Italy.md` (368 lines) — Italian family storyline
- **NEW FILE:** `docs/Story/The_Latosha_Family_France.md` (546 lines) — French family storyline
- **NEW FILE:** `docs/Story/The_Mondavi_Family_US.md` (289 lines) — U.S. family storyline
- **NEW FILE:** `docs/Story/The_Torres_Family_Spain.md` (293 lines) — Spanish family storyline
- **NEW FILE:** `docs/Story/The_Weissburg_Family_Germany.md` (426 lines) — German family storyline
- Added reference screenshots under `docs/screenshots/` (`Companyview.png`, `Loginpage.png`, `staff.png`, `vineyards.png`, `winebalance.png`)

### 🧭 UI Adjustment
- `src/components/ui/shadCN/sidebar.tsx` — Layout fix to support new documentation entries (33 additions, 8 deletions)
- `src/components/ui/shadCN/tooltip.tsx` — Follow-up tweak (1 addition, 1 deletion)

For older version see versionlog_lecacy.md
