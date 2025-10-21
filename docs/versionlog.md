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

## Version 0.0351 - Service Reorganization & Optimization
**Date:** 2025-10-21 | **Commit:** bbffb2c | **Stats:** 524 additions, 541 deletions
- **NEW FILE:** `src/lib/services/activity/activitymanagers/staffSearchManager.ts` (267 lines) - Moved from user services
- **NEW FILE:** `src/lib/services/activity/workcalculators/staffSearchWorkCalculator.ts` (208 lines) - Staff search work calculations
- **REMOVED:** `src/lib/services/user/staffSearchService.ts` (450 lines) - Moved to activity services
- `src/lib/constants/index.ts` - Enhanced barrel exports (12 additions, 1 deletion)
- `src/lib/services/activity/activitymanagers/activityManager.ts` - Streamlined activity management (4 additions, 16 deletions)
- `src/lib/services/activity/index.ts` - Updated service exports (14 additions, 30 deletions)
- Wine feature constants cleanup across 5 files (removed 3 lines each)
- Service layer reorganization for better separation of concerns

---

## Version 0.035/0.035a - GameTick Optimization, Late Harvest Feature & Code Cleanup
**Date:** 2025-10-21 | **Commits:** 495c6a8 (0.035), 652dd92 (0.035a) | **Stats:** 322 additions, 25 deletions
- **NEW FILE:** `src/lib/constants/wineFeatures/lateHarvest.ts` (132 lines) - Late harvest wine feature configuration
- `src/lib/database/activities/vineyardDB.ts` - Database enhancements (47 additions)
- `src/lib/database/core/wineLogDB.ts` - Wine log database improvements (27 additions)
- `src/lib/database/customers/salesDB.ts` - Sales database query and update improvements (33 additions, 3 deletions)
- `src/lib/services/user/achievementService.ts` - Achievement service optimization and cleanup (25 additions, 19 deletions)
- `src/lib/services/vineyard/vineyardManager.ts` - Vineyard management improvements (55 additions, 3 deletions)
- `src/lib/constants/wineFeatures/index.ts` - Wine features export updates (3 additions)
- Minor linter fixes and code cleanup across multiple files
- Improved code quality, consistency, and performance
- GameTick performance optimization and late harvest feature integration

---

## Version 0.0342-0.034H - Mobile/UI Fixes & Improvements (Combined)
**Date:** 2025-10-20 | **Commits:** 94a2ab5 (0.0342), 3e09fb7 (0.0341a), 2930ae7 (0.0341), be39605 (0.034H), 8a2db6c (0.034g), 3843134 (0.034f) | **Stats:** Combined 184 additions, 52 deletions
**Scope:** Mobile UI fixes, tooltip improvements, responsive design enhancements
- `src/components/ui/shadCN/tooltip.tsx` - Major tooltip improvements (84 additions, 1 deletion)
- `src/components/pages/Vineyard.tsx` - Mobile vineyard fixes (33 additions, 11 deletions)
- `src/components/ui/modals/activitymodals/StaffAssignmentModal.tsx` - Mobile staff assignment fixes (14 additions)
- `migrations/sync_vercel_schema.sql` - Database schema updates (15 additions, 8 deletions)
- `src/lib/constants/activityConstants.ts` - Activity constants updates (9 additions, 1 deletion)
- Multiple rounds of mobile UI fixes and improvements
- Enhanced mobile user experience and navigation
- Better responsive design across components

---

## Version 0.034e-0.034a - Bug Fixes & Code Quality (Combined)
**Date:** 2025-10-20 | **Commits:** 311947a (0.034e), f61a731 (0.034c), 95da751 (0.034b), bf43343 (0.034a) | **Stats:** Combined 423 additions, 316 deletions
**Scope:** Linter fixes, circular dependency fixes, bug fixes, deployment issues
- **NEW FILE:** `src/lib/services/core/notificationService.ts` (242 lines) - Centralized notification service
- `src/components/layout/NotificationCenter.tsx` - Major notification center refactor (17 additions, 265 deletions)
- `src/components/ui/modals/UImodals/wineModal.tsx` - Wine modal improvements (62 additions, 1 deletion)
- `src/lib/services/wine/characteristics/harvestCharacteristics.ts` - Harvest characteristics enhancements (44 additions, 2 deletions)
- `src/lib/services/vineyard/clearingManager.ts` - Clearing manager improvements (6 additions, 3 deletions)
- `src/lib/services/vineyard/vineyardService.ts` - Vineyard service updates (12 additions, 4 deletions)
- `src/lib/services/landSearchService.ts` - Land search service fixes (3 additions, 7 deletions)
- Linter fixes across 8 service files (8 additions, 8 deletions)
- Fixed potential circular dependency issues in service layer architecture
- Bug fixes for identified issues and improved system stability

---

## Version 0.034 - Harvest Enhancement & Overgrowth System
**Date:** 2025-10-20 | **Commit:** 9bfe66e | **Stats:** 398 additions, 154 deletions
- **NEW FILE:** `src/lib/services/activity/workcalculators/overgrowthUtils.ts` (44 lines) - Overgrowth utility functions
- `src/lib/services/activity/workcalculators/vineyardWorkCalculator.ts` - Enhanced with overgrowth influences (49 additions, 5 deletions)
- `src/lib/services/activity/workcalculators/clearingWorkCalculator.ts` - Streamlined clearing calculations (12 additions, 25 deletions)
- `src/components/ui/modals/UImodals/vineyardModal.tsx` - Enhanced vineyard modal with overgrowth display (38 additions, 84 deletions)
- `src/components/ui/modals/UImodals/prestigeModal.tsx` - Achievement UI fixes (47 additions, 1 deletion)
- `src/lib/constants/achievementConstants.ts` - Achievement system improvements (69 additions, 1 deletion)
- `src/lib/services/wine/winescore/wineQualityCalculationService.ts` - Quality calculation enhancements (48 additions, 3 deletions)
- `src/lib/services/vineyard/clearingService.ts` - Clearing service improvements (11 additions, 6 deletions)
- `src/lib/services/vineyard/vineyardManager.ts` - Vineyard management updates (20 additions, 3 deletions)
- `src/lib/types/types.ts` - Type system updates (6 additions, 4 deletions)
- `migrations/sync_vercel_schema.sql` - Database schema updates (2 additions, 8 deletions)
- **Key Feature:** Overgrowth system integration with harvest and clearing activities
- **Achievement UI Fix:** Improved achievement display and prestige modal integration

---

## Version 0.0331 - Mobile Staff Assignment Fix
**Date:** 2025-10-20 | **Commits:** f5abbfc + cd31f1a | **Stats:** Combined 170 additions, 79 deletions
- `src/components/ui/modals/activitymodals/StaffAssignmentModal.tsx` - Major mobile staff assignment improvements (137 additions, 79 deletions)
- `docs/versionlog.md` - Documentation updates (33 additions)
- Fixed mobile staff assignment functionality across multiple commits
- Improved mobile staff management interface
- Enhanced mobile user experience for staff operations

---

## Version 0.032 - Planting Enhancements & Bug Fixes
**Date:** 2025-10-20 | **Commit:** d90b1cd | **Stats:** 1079 additions, 550 deletions
- **NEW FILE:** `src/lib/services/activity/workcalculators/clearingWorkCalculator.ts` (288 lines) - Dedicated clearing work calculator
- `src/components/pages/Vineyard.tsx` - Enhanced vineyard management with planting improvements (162 additions, 100 deletions)
- `src/components/ui/modals/UImodals/vineyardModal.tsx` - Major vineyard modal enhancements (202 additions, 68 deletions)
- `src/components/ui/modals/activitymodals/ClearingOptionsModal.tsx` - Streamlined clearing options (119 additions, 188 deletions)
- `src/lib/services/activity/activitymanagers/activityManager.ts` - Enhanced activity management with partial event penalties (65 additions, 4 deletions)
- `src/lib/services/vineyard/clearingManager.ts` - Simplified clearing management (35 additions, 117 deletions)
- `src/lib/services/vineyard/vineyardManager.ts` - Enhanced vineyard operations (78 additions, 27 deletions)
- `src/lib/services/vineyard/vineyardService.ts` - Improved vineyard service logic (44 additions, 15 deletions)
- `src/lib/services/activity/workcalculators/vineyardWorkCalculator.ts` - Enhanced vineyard work calculations (37 additions, 2 deletions)
- `migrations/sync_vercel_schema.sql` - Database schema updates for planting enhancements (7 additions, 1 deletion)
- **Key Feature:** Transition to partial event system for planting activities with penalties for incomplete tasks

---

## Version 0.0312b - Probability Fix
**Date:** 2025-10-17 | **Commit:** b09052a | **Stats:** 124 additions, 155 deletions
- `src/lib/services/vineyard/landSearchService.ts` - Fixed probability calculations and refined land generation logic (98 additions, 123 deletions)
- `src/components/ui/modals/activitymodals/LandSearchOptionsModal.tsx` - UI improvements for probability display (26 additions, 28 deletions)
- `src/lib/services/index.ts` - Service export cleanup (4 deletions)

---

## Version 0.0312a - Probability Bug Fix
**Date:** 2025-10-17 | **Commit:** 18100c4 | **Stats:** 96 additions, 44 deletions
- `src/lib/services/vineyard/landSearchService.ts` - Fixed probability calculation bug in land search (95 additions, 43 deletions)
- `src/components/ui/modals/activitymodals/LandSearchOptionsModal.tsx` - Minor UI adjustment (1 addition, 1 deletion)

---

## Version 0.0312 - Vineyard Schema Fix
**Date:** 2025-01-27 | **Commit:** Schema Fix | **Stats:** Database schema synchronization
- Fixed vineyard creation runtime error by adding missing fields to dev database
- Added `planting_health_bonus` (numeric, default 0) - Gradual health improvement from planting/replanting
- Added `health_trend` (jsonb) - Health trend tracking for seasonal decay and improvements
- Dev database now matches Vercel schema exactly
- Both databases synchronized for vineyard health system functionality

---

## Version 0.0311 - Buyland Fixes & 1000→0-1 Scale Function
**Date:** 2025-10-17 | **Commit:** daf1ea72 | **Stats:** 794 additions, 310 deletions
- `src/lib/services/vineyard/landSearchService.ts` - Refined generation logic, affordability checks, and filtering (298 additions, 135 deletions)
- `src/components/ui/modals/activitymodals/LandSearchOptionsModal.tsx` - UI/UX fixes, range handling, validation (190 additions, 82 deletions)
- `src/lib/utils/calculator.ts` - Introduced 1000→0-1 scaling function with asymmetric curve options (84 additions, 48 deletions)
- `src/lib/services/wine/winescore/wineScoreCalculation.ts` - Score normalization updates (29 additions, 5 deletions)
- `src/components/pages/winepedia/MathematicalModelsTab.tsx` - Added docs and examples for new scaling (111 additions)
- Misc: prestige calculator, customer generation, inventory service small fixes

---

## Version 0.031 - Buyland System
**Date:** 2025-10-16 | **Commit:** d1c66d59 | **Stats:** 2037 additions, 48 deletions
- **NEW FILE:** `src/lib/services/vineyard/landSearchService.ts` (556 lines) - Land generation, scoring, pricing, filters
- **NEW FILE:** `src/components/ui/modals/activitymodals/LandSearchOptionsModal.tsx` (592 lines) - Configurable search with live previews
- **NEW FILE:** `src/components/ui/modals/activitymodals/LandSearchResultsModal.tsx` (330 lines) - Results list, details, purchase flow
- `src/components/pages/Vineyard.tsx` - Integrated Buyland entrypoint and state (26 additions, 22 deletions)
- `src/lib/constants/vineyardConstants.ts` - Added market and terrain params for search (8 additions, 7 deletions)
- `src/lib/constants/financeConstants.ts` - Finance hooks for land affordability (2 additions)
- `src/lib/constants/activityConstants.ts` - Land search activity constants (8 additions)
- `src/lib/services/activity/activitymanagers/activityManager.ts` - Activity integration (5 additions)
- `src/lib/utils/utils.ts` - Utility helpers for land search presentation (20 additions, 3 deletions)
- `src/lib/types/types.ts` - Types for land parcels and search criteria (23 additions)
- `src/components/pages/AdminDashboard.tsx` - Admin tools for land system (45 additions)
- Docs: `docs/PROJECT_INFO.md` added (360 lines), `readme.md` updates (22 additions)

---

## Version 0.03a - Docs Cleanup & Service Reorg
**Date:** 2025-10-15 | **Commit:** 00647a18 | **Stats:** 88 additions, 625 deletions
- Removed outdated wine feature docs (design/implementation summaries) and oxidation analysis
- Renamed/cleaned wine services (agingService, inventoryService), feature badge path
- Minor tweaks across services and UI barrel exports
- Updated versionlog with prior entries

---
## Version 0.03 - Vineyard Health System & Clearing/Uprooting
**Date:** 2025-10-15 | **Commit:** a2dca8df | **Stats:** 1714 additions, 117 deletions

### 🌿 Major Feature: Comprehensive Vineyard Health System
- **NEW FILE:** `src/components/ui/vineyard/HealthTooltip.tsx` (71 lines) - Interactive health display tooltip
- **NEW FILE:** `src/components/ui/modals/activitymodals/ClearingOptionsModal.tsx` (575 lines) - Comprehensive clearing/uprooting activity modal
- **NEW FILE:** `src/lib/services/vineyard/clearingManager.ts` (232 lines) - Clearing activity management with health impact
- **NEW FILE:** `src/lib/services/vineyard/clearingService.ts` (179 lines) - Health-aware clearing business logic

### Vineyard Management Overhaul
- `src/components/pages/Vineyard.tsx` - Major UI overhaul with health system integration (227 additions, 88 deletions)
- `src/components/ui/modals/UImodals/vineyardModal.tsx` - Enhanced vineyard modal with health display (68 additions)
- `src/lib/services/vineyard/vineyardManager.ts` - Major vineyard management updates with health tracking (135 additions, 1 deletion)
- `src/lib/constants/vineyardConstants.ts` - Enhanced vineyard constants with health parameters (47 additions, 1 deletion)

### Activity & Work System Integration
- `src/lib/constants/activityConstants.ts` - Added clearing activity constants (34 additions)
- `src/lib/services/activity/workcalculators/vineyardWorkCalculator.ts` - Health-aware work calculations (27 additions, 2 deletions)
- `src/lib/services/core/gameTick.ts` - Weekly health progression and clearing updates (4 additions, 1 deletion)
- `src/lib/services/activity/activitymanagers/activityManager.ts` - Activity management updates (3 additions, 2 deletions)

### Database & Infrastructure
- `src/lib/database/activities/vineyardDB.ts` - Database support for health and clearing operations (8 additions, 2 deletions)
- `src/lib/types/types.ts` - Added health and clearing-related types (7 additions, 2 deletions)
- `migrations/sync_vercel_schema.sql` - Database schema updates for vineyard health tracking (9 additions, 2 deletions)
- `docs/oxidation_and_health_analysis.md` - Updated documentation with health system analysis (29 additions, 7 deletions)

### System Features
- Vineyard health tracking and display system
- Interactive health tooltips with detailed information
- Clearing/uprooting activities that impact vineyard health
- Health-aware work calculations and activity management
- Database integration for persistent health state

## Version 0.023a - Mobile/UI Improvements (Combined 0.02 → 0.023a)
**Date:** 2025-10-14 to 2025-10-15 | **Commits:** f7a1d3d9 (0.02), abe8a197 (0.0211), 13ca0208 (0.0211a), 2105e7ca (0.023), 3f37b8b8 (0.023a), 7449f88e (0.023a header)
**Scope:** Mobile layout polish, responsive fixes, dependency updates, minor DB/achievement fixes
- `src/components/layout/Header.tsx` - Multiple rounds of mobile spacing, button styles, and layout fixes
- `src/components/pages/Vineyard.tsx` / `src/components/pages/Sales.tsx` - Breakpoint tweaks and responsive UI improvements
- `src/components/ui/modals/...` - Land buying and planting modals: mobile-friendly controls and spacing
- `src/components/pages/Login.tsx` - Minor mobile polish; `vite.config.ts` adjusted for mobile builds
- `src/lib/services/user/achievementService.ts` - Minor DB-related fix (with 0.0211/0.0211a)
- `package.json` / lockfile - Dependency updates supporting mobile build stability
- `src/vite-env.d.ts` - Updated Vite env typings

---

## Version 0.0221 - Customer Recreation Fix
**Date:** 2025-10-15 | **Commit:** b804db47 | **Stats:** 525 additions, 78 deletions (includes docs churn from prior reset)
- `src/components/pages/CompanyOverview.tsx` - UI adjustments related to prestige/customer state (84 additions, 4 deletions)
- `src/lib/services/prestige/prestigeService.ts` - Minor updates (15 changes)
- Ensures customers are not recreated on relogin/refresh; relationship persistence stabilized
---

## Version 0.022a - Enhanced Tier-Based Achievement System
**Date:** 2025-10-15 | **Commit:** 09e7e844 | **Stats:** 1251 additions, 694 deletions
- `src/lib/constants/achievementConstants.ts` - Major refactor to tier-based system (533 additions, 557 deletions)
- `src/lib/services/user/achievementService.ts` - Enhanced evaluation logic with tiers (414 additions, 33 deletions)
- `src/components/pages/Achievements.tsx` - Updated UI for tier-based display (84 additions, 19 deletions)
- `src/components/ui/modals/UImodals/prestigeModal.tsx` - Enhanced prestige modal integration (189 additions, 75 deletions)
- `src/lib/types/types.ts` - Added tier-based achievement types (29 additions, 5 deletions)
- `src/lib/services/prestige/prestigeService.ts` - Minor integration updates (2 additions, 2 deletions)
- `src/components/ui/modals/activitymodals/ClearingOptionsModal.tsx` - Minor cleanup (2 deletions)
- `src/lib/services/user/staffService.ts` - Minor cleanup (1 deletion)
- Achievement system now supports progressive tiers with enhanced evaluation logic
- Prestige modal integration for achievement-related prestige events

---
## Version 0.022 - Achievement System Fix
**Date:** 2025-10-15 | **Commit:** 0a361368 | **Stats:** 51 additions, 15 deletions
- `src/lib/services/core/gameTick.ts` - Achievement evaluation integration in game tick (27 additions, 12 deletions)
- `src/lib/services/prestige/prestigeService.ts` - Achievement-related prestige updates (10 additions)
- `src/lib/services/user/achievementService.ts` - Achievement logic fixes and improvements (9 additions, 1 deletion)
- `src/components/ui/modals/UImodals/prestigeModal.tsx` - Minor achievement display fix (2 additions, 1 deletion)
- `src/lib/types/types.ts` - Achievement type refinement (1 addition)
- `readme.md` - Documentation update (2 additions, 1 deletion)
- Fixes achievement evaluation timing and prestige integration issues from 0.019


## Version 0.019 - Dynamic Achievements
**Date:** 2025-10-14 | **Commit:** aef79714 | **Stats:** 1529 additions, 222 deletions
- **NEW FILE:** `src/lib/constants/achievementConstants.ts` (622 lines) - Config-driven achievements
- **NEW FILE:** `src/lib/database/core/achievementsDB.ts` (246 lines) - Achievements CRUD
- **NEW FILE:** `src/lib/services/user/achievementService.ts` (395 lines) - Evaluation & unlock logic
- `src/components/pages/Achievements.tsx` - Dynamic UI with categories and progress (150 additions, 220 deletions)
- `src/lib/types/types.ts` - Added achievement types (94 additions)
- Game tick integration for incremental progress (13 additions)

---

## Version 0.0182 - Vercel Dual Database & Migrations (Combined 0.018 → 0.0182)
**Date:** 2025-10-14 | **Commits:** 59b05c09 (setup docs), 4b53b2d3 (analytics), 20bdef86 (dev overrule), 8af8f226 (schema sync), aeb3c47a (constraints & RLS), c134b69f (migration header), 81615c7d (cleanup), a0b871ad (minor import fix)
**Status:** Dual DB setup is active (local `.env.local` for dev; Vercel env for test). Example/docs files were removed from git.
- **NEW (later removed):** `migrations/vercel_initial_setup.sql` (429 lines), `docs/vercel_setup_guide.md` (115), `VERCEL_SETUP.md` (38), `docs/env.example` (27), `env.example` (9)
- `migrations/sync_vercel_schema.sql` / `schema_snapshot.sql` / `README.md` - Schema snapshot + sync migration; later consolidated and cleaned
- `migrations/fix_vercel_issues.sql` - Highscores unique constraint; disabled staff RLS for Vercel test
- `.gitignore` - Ensured local overrides are ignored
- `vite.config.ts` - Dev overrule logic to keep local dev DB separate from Vercel test
- `src/App.tsx` - Vercel analytics wiring
- Note: Git repo reflects the Vercel test environment; local development uses `.env.local` (gitignored)

--

---

## Version 0.018 - Vercel Dual Database Setup (commit named 0.0018 - typo)
**Date:** 2025-10-14 | **Commits:** 59b05c09 + 88ee6c43 + bba60b47 + a0b871ad + 81615c7d | **Stats:** 610 additions, 620 deletions
- **✅ Active dual database setup:** Local dev database (via `.env.local`) + Vercel test database (via Vercel env vars)
- **REMOVED:** Example/documentation files only (VERCEL_SETUP.md, docs/vercel_setup_guide.md, docs/env.example, env.example, migrations/vercel_initial_setup.sql)
- Fixed case-sensitivity issues for Vercel build: Renamed WorkCalculators → workcalculators directory
- Renamed 5 work calculator files to lowercase (bookkeepingWorkCalculator, crushingWorkCalculator, fermentationWorkCalculator, vineyardWorkCalculator, workCalculator)
- Fixed TypeScript errors and unused imports for successful Vercel deployment
- **Note:** Dual setup IS running - git repo represents Vercel test environment, `.env.local` (gitignored) provides local dev database separation

---

## Version 0.0177 - Wine Log Feature Enhancement
**Date:** 2025-10-14 | **Commits:** cd22aed0 (0.0177) + a329f645 (0.0177a) | **Stats:** 1184 additions, 513 deletions
- **NEW FILE:** `src/components/pages/winelog/ProductionHistoryTab.tsx` (321 lines) - Production history with filtering
- **NEW FILE:** `src/components/pages/winelog/VineyardStatisticsTab.tsx` (362 lines) - Vineyard analytics and statistics
- `src/components/pages/WineLog.tsx` - Complete restructure into tabbed interface (230 additions, 458 deletions total)
- `src/lib/services/user/wineLogService.ts` - Enhanced service with statistics calculations (204 changes)
- Split WineLog page into Production History and Vineyard Statistics tabs
- Added comprehensive filtering, sorting, and analytics to wine log
- Enhanced characteristic display in wine modal and various UI components
- App routing optimization (removed unused imports)

---

## Version 0.0176 - Cellar Collection Prestige System
**Date:** 2025-10-14 | **Commit:** 97bda27a | **Stats:** 525 additions, 78 deletions
- `src/components/pages/CompanyOverview.tsx` - Added cellar collection prestige display (84 additions, 4 deletions)
- `src/lib/services/prestige/prestigeService.ts` - Implemented cellar collection prestige calculations (15 changes)
- New prestige source: Quality and diversity of wine cellar collection
- Prestige awarded for maintaining high-quality, diverse wine portfolio
- Company overview now displays cellar collection as prestige factor
- Enhanced prestige modal integration for collection tracking

---

## Version 0.0175 - Wine Features Zeta & Architecture Refactoring
**Date:** 2025-10-13 | **Commit:** a9a4fcda | **Stats:** 2590 additions, 2592 deletions
- **NEW FILE:** `docs/Designdoc_dynamic_achiement.md` (37 lines) - Dynamic achievement design doc
- **NEW FILES:** 6 database CRUD layer files (~832 lines) - highscoresDB, companiesDB, usersDB, transactionsDB, wineLogDB, userSettingsDB
- `src/components/pages/sales/WineCellarTab.tsx` - Major UI overhaul with detailed wine modal integration (462 additions, 214 deletions)
- `src/components/ui/modals/UImodals/wineModal.tsx` - Enhanced wine detail modal (71 additions, 31 deletions)
- `src/components/ui/modals/UImodals/prestigeModal.tsx` - Prestige modal improvements (184 additions, 32 deletions)
- `src/lib/services/core/gameTick.ts` - Performance optimization with parallel execution (83 additions, 59 deletions)
- `src/lib/database/activities/inventoryDB.ts` - Added bulk update operations (77 changes)
- Architecture cleanup: Isolated all CRUD operations to database layer, services now business logic only
- Component imports updated to use database layer for types (Profile, Highscores, Login, WineLog)
- Zero direct Supabase imports in services (except auth SDK), enforcing clean separation of concerns

---

## Version 0.0174 - Wine Features: New Sales Display & Vine Age Alpha
**Date:** 2025-10-13 | **Commits:** 88afe4fc (0.0174) + f2eb95ce (0.0174a) | **Stats:** 946 additions, 284 deletions
- **NEW FILE:** `src/components/ui/modals/UImodals/wineModal.tsx` (438 lines) - Comprehensive wine detail modal
- **NEW FILE:** `src/lib/constants/wineFeatures/bottleAging.ts` (141 lines) - Bottle aging feature configuration
- `src/components/pages/sales/WineCellarTab.tsx` - Complete sales UI redesign (153 additions, 199 deletions total across both commits)
- `src/lib/services/core/gameTick.ts` - Added weekly aging progression for bottled wines (36 additions, 3 deletions)
- `src/lib/services/prestige/prestigeService.ts` - Enhanced prestige calculations with aging factors (89 additions, 1 deletion)
- `src/lib/constants/grapeConstants.ts` - Added aging potential and optimal aging range to grape varieties (35 additions, 5 deletions)
- Wine cellar now displays detailed wine information with modal popups
- Aging system tracks bottle age with quality evolution over time
- Feature risk service updated to handle aging-related features

---

## Version 0.0173 - Wine Features: Service Reorganization & Stuck Fermentation
**Date:** 2025-10-13 | **Commit:** b5dd699b | **Stats:** 515 additions, 154 deletions
- **NEW FILE:** `src/lib/constants/wineFeatures/stuckFermentation.ts` (172 lines) - Stuck fermentation feature config
- Service layer reorganization: Moved feature services to `wine/features/` subdirectory
- Service layer reorganization: Moved wine score services to `wine/winescore/` subdirectory
- `src/components/ui/modals/activitymodals/FermentationOptionsModal.tsx` - Added stuck fermentation risk preview (100 additions, 9 deletions)
- `src/components/ui/modals/activitymodals/HarvestOptionsModal.tsx` - Enhanced harvest risk display (34 additions, 16 deletions)
- `src/components/ui/modals/activitymodals/CrushingOptionsModal.tsx` - Feature risk integration (44 changes)
- Enhanced feature configs for oxidation and greenFlavor with better risk calculations
- Updated 15+ files to use new service paths after reorganization

---

## Version 0.0172 - Wine Features Beta: Terroir & Evolving Features
**Date:** 2025-10-12 | **Commit:** 9d91c6a4 | **Stats:** 1609 additions, 250 deletions
- **NEW FILE:** `src/lib/constants/wineFeatures/terroir.ts` (119 lines) - Terroir feature configuration
- **NEW FILE:** `src/components/ui/wine/WineryEvolvingFeaturesDisplay.tsx` (310 lines) - Display for graduated/evolving features
- `src/components/ui/wine/WineryFeatureStatusGrid.tsx` - Major enhancement with feature type support (303 additions, 115 deletions)
- `src/components/ui/modals/activitymodals/CrushingOptionsModal.tsx` - Added feature risk preview (217 additions, 17 deletions)
- `src/components/ui/vineyard/HarvestFeatureRisksDisplay.tsx` - Enhanced risk visualization (82 additions, 39 deletions)
- `src/lib/services/wine/characteristics/crushingCharacteristics.ts` - Feature integration (116 additions, 5 deletions)
- Enhanced feature types with graduated manifestation support (terroir evolves over time)
- Feature effects service now calculates quality and price impacts
- Expanded oxidation and greenFlavor configurations with more sophisticated risk models

---

## Version 0.0171 - Wine Features Framework (commit named 0.00171 - typo)
**Date:** 2025-10-12 | **Commits:** cfc96c2b + 13ef9379 + 5025c746 + 9ae6f5ae | **Stats:** Combined ~6600 additions, ~4300 deletions

### 🎉 Major Feature: Generic Wine Features Framework
Complete refactoring from standalone oxidation to extensible config-driven feature system.

**0.00171 - Features Alpha (cfc96c2b) - 5923 additions, 2070 deletions:**
- **NEW FILE:** `docs/wine_features_framework_design.md` (745 lines) - Complete framework design
- **NEW FILE:** `docs/wine_features_implementation_summary.md` (367 lines) - Implementation guide
- **NEW FILE:** `src/components/ui/vineyard/HarvestRisksDisplay.tsx` (207 lines) - Risk display for harvest
- 30 files updated for framework integration, major UI refactoring across Winery, WineCellar, OrdersTab

**0.0171a - Cleanup (13ef9379) - 286 additions, 549 deletions:**
- Code cleanup across 8 files: Winery, QualityFactorsBreakdown, HarvestRisksDisplay, FeatureStatusGrid
- Streamlined feature services: featureRiskService, featureRiskHelper, featureEffectsService
- Simplified prestige calculations (81 additions, 143 deletions)

**0.0171b - Docs (5025c746) - 339 additions, 1494 deletions:**
- **REMOVED:** 2 documentation files (448 lines) - consolidation_opportunities, prestige_consolidation_summary
- Documentation cleanup: Reduced framework design from 745→187 lines, implementation from 367→81 lines
- Condensed oxidation_and_health_analysis (71 additions, 100 deletions)

**0.0171c - Docs and Reorg (9ae6f5ae) - 59 additions, 213 deletions:**
- Component reorganization: Renamed FeatureRiskDisplay → HarvestFeatureRisksDisplay
- Renamed FeatureStatusGrid → WineryFeatureStatusGrid, FeatureRiskDisplay → WineryFeatureRiskDisplay
- Versionlog update (53 additions, 207 deletions)

**Framework Features:**
- Config-driven: Add features with config only, no code changes
- Binary (oxidation) and graduated (terroir) manifestation types
- Time-based and event-triggered risk accumulation
- Quality/price effects with power functions
- Customer sensitivity: Collectors 60%, Wine Shops 80%, Restaurants 85%, Chain Stores 90%
- Prestige penalties on fault sales: Company -0.5 (20yr decay), Vineyard -2.0 (3yr decay)

---

## Version 0.017 - Oxidation System Alpha
**Date:** 2025-10-10 | **Commit:** 30a7f512 | **Stats:** 595 additions, 4 deletions
- **NEW FILE:** `src/lib/services/wine/oxidationService.ts` (188 lines) - Oxidation risk accumulation and effects
- **NEW FILE:** `src/lib/constants/oxidationConstants.ts` (66 lines) - Oxidation thresholds, rates, and customer sensitivity
- **NEW FILE:** `docs/oxidation_implementation_summary.md` (227 lines) - Complete oxidation system documentation
- `src/components/pages/Winery.tsx` - Added oxidation status display and tooltips (59 additions)
- `src/components/pages/sales/WineCellarTab.tsx` - Oxidation badges in wine cellar (26 additions, 1 deletion)
- `src/lib/services/core/gameTick.ts` - Weekly oxidation risk accumulation (9 additions, 1 deletion)
- `src/lib/database/activities/inventoryDB.ts` - Added oxidation fields to wine_batches (4 changes)
- `src/lib/types/types.ts` - Added oxidationRisk, oxidationLevel to WineBatch (5 changes)
- Initial implementation: Weekly accumulation, customer sensitivity, visual feedback in UI

---

## Version 0.0162 - Notification Settings & Preferences
**Date:** 2025-10-10 | **Commits:** eb979826 (0.0162) + 7a49ee34 (0.0161a docs) | **Stats:** 247 additions, 14 deletions
- `src/components/pages/Settings.tsx` - Added comprehensive notification preferences UI (195 additions, 2 deletions)
- `src/components/layout/NotificationCenter.tsx` - Integrated settings and filtering (48 additions, 12 deletions)
- `src/lib/database/core/notificationsDB.ts` - Database support for notification preferences (4 changes)
- Users can now customize which notification categories they want to see
- Settings page expanded with notification management section
- NotificationCenter respects user preferences for display filtering

---

## Version 0.0161 - Notification System Polish & Service Cleanup
**Date:** 2025-10-09 | **Commit:** b1a9501a | **Stats:** 158 additions, 157 deletions
- `src/lib/services/activity/activitymanagers/staffSearchManager.ts` - Major refactor and cleanup (31 additions, 17 deletions)
- `src/lib/services/user/teamService.ts` - Code consistency improvements (22 additions, 22 deletions)
- `src/components/pages/AdminDashboard.tsx` - Simplified admin tools (21 additions, 37 deletions)
- Notification consistency updates across 24 files (services, modals, managers)
- Minor refinements to activity managers, work calculators, and database operations
- Toast system integration improvements across UI components

---

## Version 0.016 - Notification System Overhaul (commit named 0.0016)
**Date:** 2025-10-09 | **Commit:** b6563b1b | **Stats:** 1253 additions, 1645 deletions
- **NEW FILE:** `docs/oxidation_and_health_analysis.md` (342 lines) - Oxidation system analysis
- **NEW FILE:** `docs/oxidation_system_detailed_summary.md` (452 lines) - Detailed oxidation mechanics
- **REMOVED:** 5 documentation files (1514 lines) - staff_search_*, wage_system_integration.md
- `src/components/layout/NotificationCenter.tsx` - Complete redesign (247 additions, 71 deletions)
- `src/lib/database/core/notificationsDB.ts` - Major database operations overhaul (111 additions, 9 deletions)
- `src/components/ui/shadCN/toaster.tsx` - Enhanced toast notifications (56 additions, 4 deletions)
- `src/lib/utils/toast.ts` - Improved notification utilities (14 additions, 3 deletions)
- Minor database query optimizations across activityDB, vineyardDB, staffDB, teamDB, customerDB, salesDB
- Service layer notification integration updates (activityManager, gameTick, staffService, teamService)

---

## Version 0.0153 - Staff System UI Fixes & Team Service Refinements
**Date:** 2025-10-09 | **Commit:** 1003d00f | **Stats:** 176 additions, 64 deletions
- `src/components/pages/Staff.tsx` - Fixed duplicate team creation section, improved emoji picker (81 additions, 34 deletions)
- `src/lib/services/user/teamService.ts` - Fixed UUID generation for default teams, changed hardcoded IDs to `uuidv4()` (67 additions, 20 deletions)
- Fixed game initialization error: "invalid input syntax for type uuid: 'winery-team'"
- Enhanced staff modal and assignment modal UI (19 changes across modals)
- Minor database and service cleanup across staffDB, staffService, and service exports

---

## Version 0.0152 - Team Management Integration & Wage System
**Date:** 2025-10-09 | **Commit:** 0eb3f62a | **Stats:** 1229 additions, 859 deletions
- **NEW FILE:** `src/lib/database/core/teamDB.ts` (183 lines) - Complete team CRUD operations
- **NEW FILE:** `src/lib/services/user/wageService.ts` (242 lines) - Comprehensive wage calculation system
- **REMOVED:** `src/components/ui/components/TeamManagement.tsx` (598 lines) - Integrated into Staff page
- `src/components/pages/Staff.tsx` - Complete team management UI integration (614 additions, 66 deletions)
- Team creation, editing, deletion, member assignment, default task types, emoji picker
- `src/lib/services/user/staffService.ts` - Major refactor removing business logic to wageService/teamService (37 additions, 102 deletions)
- `src/lib/services/core/gameTick.ts` - Weekly wage deductions (4 additions, 2 deletions)
- Finance integration with team-based wage breakdowns in StaffWageSummary

---

## Version 0.0151 - Staff Search System & Teams Alpha
**Date:** 2025-10-09 | **Commit:** 096ccaf6 | **Stats:** 3916 additions, 135 deletions
- **NEW FILE:** `src/lib/services/activity/activitymanagers/staffSearchManager.ts` (441 lines) - Activity-based staff search with skill targeting, specializations, cost calculation
- **NEW FILE:** `src/components/ui/modals/activitymodals/StaffSearchOptionsModal.tsx` (294 lines) - Interactive search with live preview
- **NEW FILE:** `src/components/ui/modals/activitymodals/StaffSearchResultsModal.tsx` (281 lines) - Candidate display and hiring
- **NEW FILE:** `src/lib/services/user/teamService.ts` (267 lines) - Team CRUD, default teams (Admin, Maintenance, Vineyard, Winery, Sales)
- **NEW FILE:** `src/components/ui/components/TeamManagement.tsx` (598 lines) - Team management UI
- **NEW FILE:** `src/components/ui/modals/UImodals/StaffModal.tsx` (182 lines) - Detailed staff info display
- **NEW FILES:** 4 comprehensive documentation files (1339 lines total)
- `src/lib/constants/activityConstants.ts` - Unified `WORK_CATEGORY_INFO` structure (55 additions, 43 deletions)
- `src/hooks/useGameState.ts` - Reduced cache to 100ms for better UI responsiveness

---

## Version 0.015 - Staff System Foundation & Wage Integration
**Date:** 2025-10-09 | **Commit:** 137b0397 | **Stats:** 2155 additions, 26 deletions
- **NEW FILE:** `src/lib/database/core/staffDB.ts` (184 lines) - Complete staff CRUD operations with Supabase
- **NEW FILE:** `src/components/pages/Staff.tsx` (195 lines) - Main staff management interface
- **NEW FILE:** `src/components/ui/modals/UImodals/HireStaffModal.tsx` (265 lines) - Interactive hiring with skill slider
- **NEW FILE:** `src/components/ui/modals/activitymodals/StaffAssignmentModal.tsx` (234 lines) - Assign staff to activities with work preview
- **NEW FILE:** `src/components/ui/components/StaffSkillBar.tsx` (99 lines) - Visual skill bars with color-coding
- **NEW FILE:** `src/components/finance/StaffWageSummary.tsx` (89 lines) - Wage breakdown display
- **NEW FILE:** `src/lib/constants/staffConstants.ts` (99 lines) - Nationalities, skill levels, specializations, wages
- **NEW FILE:** `src/components/ui/shadCN/slider.tsx` (26 lines) - ShadCN slider component, added `@radix-ui/react-slider`
- **NEW FILE:** `docs/wage_system_integration.md` (175 lines) - Wage system documentation
- `src/lib/services/activity/WorkCalculators/workCalculator.ts` - Staff-based work calculation with multi-tasking penalty, specialization bonus (94 additions, 1 deletion)
- Replaced hardcoded 50 work/tick with dynamic staff contribution based on assigned staff skills
- Added Staff navigation (👥 icon) to header, integrated into app routing

---

## Version 0.0145-0.0146 - Vineyard Modal & Prestige Scaling Improvements
**Date:** 2025-10-07 to 2025-10-09
**Commits:** d7f9153 (0.0145) → 16461f9 (0.0146) - 2 commits

### Major New Features
- **Vineyard Information Modal:**
  - **NEW FILE:** `src/components/ui/modals/UImodals/vineyardModal.tsx` (372 lines) - Comprehensive vineyard details modal with quality factors, prestige breakdown, and vineyard characteristics
  - Integrated into Vineyard page for detailed vineyard information display
  - Shows land value, vineyard prestige, quality factors, and harvest information

### Component Refactoring
- **Quality Display Components:**
  - `src/components/ui/components/QualityFactorsBreakdown.tsx` - Major refactor (78 additions, 203 deletions) - simplified and improved quality factor display
  - `src/components/ui/components/qualityFactorBar.tsx` - Enhanced with better visualization (174 additions, 85 deletions)
  
### Prestige System Enhancements
- **Better Scaling Algorithms (0.0146):**
  - `src/lib/services/prestige/prestigeService.ts` - Improved land value and vine age prestige scaling (69 additions, 3 deletions)
  - `src/lib/utils/calculator.ts` - Enhanced scaling functions for vineyard prestige (27 changes)
  - `src/lib/utils/utils.ts` - Additional utility functions for prestige calculations (14 additions, 4 deletions)
  - `src/lib/services/wine/wineQualityCalculationService.ts` - Updated quality index calculations (9 additions, 5 deletions)

## Version 0.0143-0.0144 - Prestige Events System & Data Model Improvements  
**Date:** 2025-10-05 to 2025-10-06
**Commits:** 8683d35 (0.0143) → e482f97 (0.0144) - 2 commits

### Prestige Events Backend Overhaul (0.0143)
- **Type System Refactor:**
  - `src/lib/types/types.ts` - Major type definitions update (73 additions, 46 deletions)
  - Enhanced prestige event types with better structure and validation
  
- **Prestige Service Simplification:**
  - `src/lib/services/prestige/prestigeService.ts` - Streamlined backend logic (42 additions, 100 deletions)
  - `src/lib/database/customers/prestigeEventsDB.ts` - Improved database operations (11 additions, 17 deletions)
  - `src/hooks/usePrestigeUpdates.ts` - Better prestige update handling (7 additions, 2 deletions)
  
- **UI Simplification:**
  - `src/components/ui/components/QualityFactorsBreakdown.tsx` - Cleaned up prestige display (26 additions, 68 deletions)
  - `src/components/ui/modals/UImodals/prestigeModal.tsx` - Simplified modal structure (6 additions, 20 deletions)

### Vineyard Prestige Integration (0.0144)
- **Vineyard-Specific Prestige:**
  - `src/lib/services/prestige/prestigeService.ts` - Added vineyard prestige calculations (81 additions, 26 deletions)
  - Integrated vineyard quality factors into prestige events
  - Enhanced prestige modal with vineyard-specific information display

### Data Model Change (0.0142)
- **Harvest Period System:**
  - Changed from `harvest_date` (specific date) to `harvest_period` (period identifier) across the application
  - `src/lib/database/activities/inventoryDB.ts` - Updated database schema (27 additions, 25 deletions)
  - `src/lib/services/wine/inventoryService.ts` - Updated inventory tracking (19 additions, 4 deletions)
  - `src/lib/services/user/wineLogService.ts` - Updated wine log service (13 additions, 15 deletions)
  - More flexible harvest tracking and better data consistency

## Version 0.014 - Sales UI Restructure & Combined Wine Score System
**Date:** 2025-10-05
**Commits:** f4e9610 (0.014) → 6950c16 (0.0141a) - 4 commits
**Stats:** Massive restructure - 3185 total changes in initial commit

### Major Code Reorganization
- **Sales Page Split:**
  - `src/components/pages/Sales.tsx` - Reduced from 1407 lines to 67 lines (major simplification)
  - **NEW FILE:** `src/components/pages/sales/OrdersTab.tsx` (955 lines) - Dedicated orders management interface
  - **NEW FILE:** `src/components/pages/sales/WineCellarTab.tsx` (564 lines) - Wine cellar inventory and management
  - Moved finished wine display from Winery page to Sales page for better workflow

- **Directory Reorganization:**
  - Moved `components/winepedia/*` → `components/pages/winepedia/` (13 components)
  - Reorganized modals into subdirectories: `UImodals/`, `activitymodals/`, `winebreakdownmodals/`
  - Updated all import paths across the application

### Combined Wine Score System
- **New Scoring Hook (0.014):**
  - **NEW FILE:** `src/hooks/useWineCombinedScore.ts` (68 lines) - Unified hook for combined wine quality and balance scoring
  - Integrated into WineCellarTab for comprehensive wine evaluation display

- **Service Consolidation (0.0141a):**
  - **NEW FILE:** `src/lib/services/wine/wineScoreCalculation.ts` (27 lines) - Unified wine score calculation service
  - **REMOVED:** `src/lib/services/sales/pricingService.ts` (15 lines) - Merged into wine score service
  - **REMOVED:** `src/lib/services/wine/wineCombinedScoreCalculationService.ts` (23 lines) - Replaced by new service
  - Simplified pricing calculations to use combined scores directly

### Pricing Integration (0.0141)
- **Combined Score Pricing:**
  - `src/lib/services/sales/pricingService.ts` - Updated to use combined wine scores (7 additions, 23 deletions)
  - `src/components/pages/sales/WineCellarTab.tsx` - Enhanced wine display with combined scores (75 additions, 23 deletions)
  - More accurate wine pricing based on both quality and balance

### UI Enhancements
- **Wine Cellar Display:**
  - Comprehensive wine information with quality, balance, and combined scores
  - Better wine inventory management interface
  - Integrated wine characteristics visualization
  
- **Component Cleanup (0.0141a):**
  - `src/components/pages/sales/WineCellarTab.tsx` - Simplified hooks usage (79 additions, 122 deletions)
  - Better performance with optimized data fetching

## Version 0.013 - Quality Breakdown System & Prestige Interface Enhancements
**Date:** 2025-10-02 to 2025-10-05
**Commits:** 0221931 (0.013) → bcbef37 (0.0133a) - 8 commits total

### Major New Features
- **Quality Breakdown Modal System:**
  - `src/components/ui/components/QualityFactorsBreakdown.tsx` - New 420-line component with detailed factor analysis and asymmetric function displays
  - `src/components/ui/components/qualityFactorBar.tsx` - New 243-line visual bar component for quality factors
  - `src/components/ui/modals/QualityBreakdownModal.tsx` - New modal wrapper for quality breakdown display
  - Integrated into Winery page and Winepedia Mathematical Models tab with interactive quality factor visualization

- **Prestige System Overhaul:**
  - `src/lib/services/prestige/prestigeService.ts` - Complete refactor with new structured prestige factor interfaces
  - `src/components/ui/modals/prestigeModal.tsx` - Enhanced with event description parsing and improved factor display
  - `src/lib/database/customers/prestigeEventsDB.ts` - Updated with better event formatting and retrieval
  - Added detailed prestige factor breakdown UI with category grouping and formatted descriptions

- **Wine Quality Service Consolidation:**
  - Removed `src/lib/services/sales/wineQualityIndexCalculationService.ts` (64 lines deleted)
  - Created `src/lib/services/wine/wineCombinedScoreCalculationService.ts` - New unified scoring service (24 lines)
  - Renamed/refactored `wineQualityCalculationService.ts` with simplified quality calculation logic
  - Updated all services (sales, vineyard, wine) to use consolidated quality system

### Technical Improvements
- **Asymmetric Mathematical Functions:**
  - `src/lib/utils/calculator.ts` - Enhanced with sophisticated asymmetric scaling functions (88 additions, 45 deletions)
  - `src/lib/services/sales/wineValueIndexCalculationService.ts` - Updated to use new asymmetric quality multipliers
  - `src/lib/services/vineyard/vineyardValueCalc.ts` - Integrated asymmetric functions for realistic value calculations

- **UI Enhancements & Bug Fixes:**
  - Fixed Activity Panel bug (commit 0.013a: 172 additions, 195 deletions in ActivityPanel.tsx)
  - `src/lib/utils/icons.tsx` - New 54-line icon utility for centralized icon management
  - `src/components/ui/shadCN/card.tsx` - Enhanced with 30 new lines for better card layouts
  - Improved Balance and Quality breakdown component responsiveness

- **Type System & Architecture:**
  - `src/lib/types/types.ts` - Added prestige factor interfaces and event description types
  - Updated service barrel exports for new quality calculation services
  - Removed redundant quality constants from `constants.ts` (22 deletions)

### Database & Service Integration
- Enhanced prestige events database operations with structured factor retrieval
- Updated pricing service to use combined wine score calculations
- Integrated quality breakdowns into order generation and sales service
- Added vineyard value calculations with new quality factor integration

## Version 0.012 - Mobile UI Implementation & Dual UI System
**Date:** 2025-09-30 to 2025-10-02
**Commits:** b10c52b (0.012 vercel) → d4781b7 (0.012 AF Docs) - 12 commits total

### Major Mobile UI Overhaul
- **Responsive Header Redesign (commit 11fc58a6):**
  - `src/components/layout/Header.tsx` - Complete mobile redesign (291 additions, 122 deletions)
  - Responsive button sizing and layout (commit 0d1211c1: 24 additions, 6 deletions)
  - Money badge made clickable for Finance navigation (commit b8f68c04: 6 additions)
  - Mobile-optimized navigation menu with proper touch targets

- **Table to Card Conversions:**
  - `src/components/pages/Sales.tsx` - Mobile card layout for orders and wine cellar (323 additions, commit 07f9002a)
  - `src/components/pages/Highscores.tsx` - Responsive card-based leaderboard (126 additions, 56 deletions)
  - `src/components/pages/WineLog.tsx` - Card layout for wine history (110 additions)
  - `src/components/pages/Vineyard.tsx` - Vineyard card display (181 additions, commit 55083360)
  - `src/components/finance/CashFlowView.tsx` - Mobile-friendly transaction cards (38 additions)

- **Activity Panel Mobile Optimization:**
  - `src/components/layout/ActivityPanel.tsx` - Mobile-friendly sliding panel (commit 45cdd446: 97 additions, 19 deletions)
  - Floating button trigger for mobile
  - Desktop maintains fixed sidebar layout

- **Notification Center Redesign:**
  - `src/components/layout/NotificationCenter.tsx` - Mobile notification UI (commit 582e9bc5: 163 additions, 27 deletions)
  - Further enhancements (commit a4fedca4: 239 additions, 107 deletions)
  - Touch-friendly notification interactions

### Responsive Design System
- **CSS Infrastructure:**
  - `src/index.css` - Enhanced responsive utilities (57 additions, 36 deletions, commit 11fc58a6)
  - Added mobile breakpoint definitions and responsive variables
  - Improved Tailwind responsive class support

- **Component-Wide Mobile Support:**
  - Updated 12 pages/components with mobile responsiveness (commit 11fc58a6)
  - Enhanced modal responsiveness across app (commits 07f9002a)
  - Consistent mobile-first approach with Tailwind breakpoints

### Infrastructure & Documentation
- **Vercel Deployment:**
  - `vercel.json` - New deployment configuration (7 lines, commit b10c52b5)
  - Production build optimizations

- **Documentation Updates (commit d4781b73):**
  - `readme.md` - Added mobile UI documentation (39 additions)
  - `docs/versionlog.md` - Updated version history (13 additions)

### Technical Architecture
- **Dual UI System Pattern:** Components conditionally render mobile vs desktop layouts using Tailwind responsive classes
- **Mobile-First Design:** 768px breakpoint for mobile/desktop switching
- **Touch Optimization:** Larger touch targets, improved gesture support
- **Performance:** Optimized rendering for mobile devices with conditional component loading

---

## 🎯 **Overgrowth System Refactor** (Latest)
- **New Structure**: Replaced separate year tracking fields with nested `overgrowth` object
- **Task-Specific Tracking**: Each clearing task type (vegetation, debris, uproot, replant) tracked separately
- **Flexible Usage**: Work calculators can use specific overgrowth types as needed
- **Database Migration**: Updated dev database and sync schema for new structure
- **UI Updates**: Vineyard modal now displays detailed overgrowth status per task type
- **Work Calculator Integration**: 
  - **Planting**: Uses vegetation + debris overgrowth for penalties
  - **Clearing**: Uses maximum overgrowth from all task types
  - **Harvesting**: No overgrowth effects (as requested)

---

*For versions 0.011 and earlier, see git commit history or archived documentation*
