# Version Log Guide For AI Agents

This file tracks meaningful project changes for **winemaker04**.

## Goal
Write clear, factual release notes that explain what changed, where, and why it matters.

## Core Principles
- **ALWAYS use MCP GitHub tools** (`mcp_github_get_commit`, `mcp_github_list_commits`) - do not rely on terminal git commands for log evidence.
- **ALWAYS retrieve actual commit data** before writing.
- **Never infer mechanics from commit message text alone**.
- **Verify behavior claims against actual changed files**.

## Scope Rules
- Log meaningful changes only: features, balancing/mechanics changes, architecture changes, major bug fixes, test infrastructure changes, and substantial docs restructures.
- Skip trivial noise unless bundled inside a meaningful commit.
- Group related commits into one entry when they are one logical change set.

## Evidence Rules
- Use commit-level evidence with `mcp_github_get_commit` and `include_diff: true`.
- For grouped entries, review each commit included in the group.
- Do not claim player-visible impact unless it is visible in the reviewed diffs.
- Always list exact commit hash(es), date range, and stats for grouped entries.

## Entry Format (Required)
Use this structure for every new entry:

```md
## Version <tag> - <short title>
**Date:** YYYY-MM-DD or YYYY-MM-DD to YYYY-MM-DD | **Commit(s):** <hash or comma-separated hashes> | **Stats:** <summary>

### Summary
- 1-3 bullets describing intent and outcome.

### Changes
- `path/to/file.ts` (+A/-D) - what changed and why it matters.
- `path/to/file.tsx` (+A/-D) - mechanic or architecture impact.
- **NEW FILE:** `path/to/newFile.ts` (<line count> lines) - purpose.
- **REMOVED:** `path/to/oldFile.ts` - why removed/replaced.

### Notes
- Migration, compatibility impact, balancing notes, follow-up tasks, or known limitations.
```

## Writing Rules
- Keep entries concrete and technical.
- Prefer file paths over vague statements.
- Use `NEW FILE` and `REMOVED` markers exactly.
- Explain meaningful mechanic/behavior impact, not just file creation.
- Keep entry length proportional to change size.
- Practical heuristic: commits with <250 added lines usually need <10 versionlog lines unless behavior impact is broad.

## Ordering
- Newest entry goes at the top, below this guide.
- Keep entries in reverse chronological order.
- Versions through 0.062 are archived in `docs/versionlog_legacy.md`.

## Repository Info
- **Owner:** gram12321
- **Repository:** winemaker04
- **Full URL:** https://github.com/gram12321/winemaker04.git

---
## Version 0.338e-0.338i - Staff Feature Isolation and Cleanup
**Date:** 2026-07-20 | **Commit(s):** e80c1a4, fb564e3, 3430044, 0a818f6, 8aa52ac | **Stats:** 1,189 insertions(+), 1,669 deletions(-)

### Summary
- Moved staff records, recruitment, competency, teams, wages, founders, presentation, and Staff UI behind the `staffFeature` facade.
- Preserved staff specialization, task/grape mastery, wage, and team workflows while removing legacy ownership and duplicated Staff UI paths.
- Made denormalized staff/team membership writes company-scoped and atomic, with focused regression coverage.

### Changes
- **NEW FILE:** `src/lib/features/staff/feature.tsx` (70 lines), `featureTypes.ts` (54 lines), `services/staffFactory.ts` (84 lines), `services/wageCalculations.ts` (63 lines), and related feature services/UI - feature-owned staff contracts, lifecycle, presentation, and lazy workspace wiring.
- `src/lib/features/activities/services/activitymanagers/staffSearchManager.ts`, `src/App.tsx`, core tick/starting-condition code, finance/admin consumers, and staff tests - migrated callers to the staff and activity seams.
- **NEW FILE:** `migrations/20260720150000_make_staff_team_memberships_atomic.sql` (45 lines) and `src/lib/database/core/teamDB.ts` - lock both company-owned rows and update `staff.team_ids`/`teams.member_ids` together.
- `src/lib/features/staff/ui/StaffWorkspace.tsx`, `StaffModal.tsx`, `StaffSkillBar.tsx`, and presentation/team services - removed obsolete local search-result state, consolidated picker markup/contracts, and deleted narration-only cleanup noise.

### Notes
- The cleanup is intended to preserve the specialization and wage behavior introduced by the preceding staff release; it does not add a new staff mechanic.
- Merge commit `ba17d25` integrates the staff branch with the player-session branch; its merge diff is not counted a second time.

## Version 0.327-0.327e - Storage Vessel Maintenance and Used-Market Expansion
**Date:** 2026-07-17 to 2026-07-20 | **Commit(s):** b0bf6ec, 2430c05, 114c935, 292ce9c, d2d9183, 814912a | **Stats:** 2,918 insertions(+), 614 deletions(-)

### Summary
- Added clean/dirty vessel state and cancellable maintenance activities for cleaning empty vessels and emptying selected filled vessels.
- Expanded vessel value and Buy Market presentation with condition, cleanliness, age, capacity, and fill-history modifiers.
- Added a global used-vessel marketplace with named NPC and player sellers, projected condition, atomic purchase/sellback flows, and buyer-to-counterparty relationships.

### Changes
- **NEW FILE:** `migrations/20260718100000_add_storage_vessel_cleanliness.sql` (70 lines), `20260718120000_add_storage_vessel_condition_and_fill_history.sql` (26 lines), and `20260718140000_add_storage_vessel_names.sql` (3 lines) - persisted vessel state/history used by maintenance and valuation.
- `src/lib/services/wine/winery/storageVesselMaintenanceService.ts`, `src/lib/features/activities/services/workcalculators/storageVesselMaintenanceWorkCalculator.ts`, `storageVesselsDB.ts`, `Equipment.tsx`, and maintenance tests - validate empty/dirty vessels, run cancellable maintenance work, and persist cleaning or selected-vessel emptying without releasing unrelated allocations.
- `src/lib/services/market/storageVessels/storageVesselMarketAdapter.ts`, `storageVesselConstants.ts`, `StorageVesselMarketPanel.tsx`, admin test-lab services, and market tests - apply explicit capacity/quality/age/condition/cleanliness/fill-history price factors and expose their breakdown.
- **NEW FILE:** `migrations/20260719100000_global_used_storage_vessel_market.sql` (197 lines), `migrations/20260720110000_add_buy_market_counterparty_relationships.sql` (151 lines), `src/lib/database/market/storageVesselMarketListingsDB.ts` (104 lines), and used-market/counterparty services - persist global listings, NPC generation, player sellback, listing evolution, atomic ownership transfer, and relationship-based quotes.
- `src/components/ui/market/BuyMarketCounterpartyPanel.tsx` (49 lines), Buy Market panels/modal, `src/lib/types/storageVessels.ts`, and related adapters - identify sellers consistently and retain vessel identity, name, material, condition, cleanliness, age, and fill history across resale.

### Notes
- The storage-vessel migrations are development cutovers: older listing/purchase shapes are replaced rather than backfilled through compatibility paths.
- Merge commits `2a4fd35` and `ed98982` integrate the market branch; their merge diffs are not added to the grouped stats a second time.

## Version 0.338a-0.338d - Activities Feature Isolation and Boundary Cleanup
**Date:** 2026-07-19 | **Commit(s):** ae97a42, cb8c924, aaceebd, e5b73db, 24f135b | **Stats:** 1,178 insertions(+), 466 deletions(-)

### Summary
- Moved activity lifecycle, reads, work previews/calculators, weekly ticks, setup, persistence orchestration, and activity UI behind `activitiesFeature`.
- Removed the legacy activity service barrel and migrated vineyard, winery, loan, research, admin, and test consumers to the feature-owned seams.
- Replaced the activity table shape with company-scoped constraints/RLS and added facade/lifecycle regression coverage.

### Changes
- **NEW FILE:** `src/lib/features/activities/feature.tsx` (40 lines), `featureTypes.ts` (53 lines), `index.ts` (2 lines), and `tests/features/activities/activitiesFeature.test.ts` (15 lines) - public lifecycle/read/work/tick/setup/UI contracts and facade coverage.
- **NEW FILE:** `migrations/20260718120000_replace_activities_schema.sql` (41 lines) - development-only activity schema replacement with company ownership, status/work constraints, indexes, RLS, and storage-plan linkage.
- `src/lib/features/activities/services/`, `src/lib/features/activities/ui/`, `src/App.tsx`, core tick, host pages, vineyard/winery services, loan/research integrations, and tests - moved activity implementation and direct consumers behind the feature boundary.
- `src/lib/database/activities/activityDB.ts`, activity lifecycle tests, and `migrations/20260719100000_harden_activity_rls.sql` - retained database ownership inside the feature path and hardened company activity access.
- `src/lib/services/vineyard/overgrowthUtils.ts` and clearing/storage-vessel callers - relocated shared overgrowth rules while keeping vineyard behavior outside the activity facade.

### Notes
- This is an architecture and persistence cutover; the activity migration explicitly drops the old table shape and does not provide a compatibility view or backfill.
- The activity merge review also updates project guidance (`CONTEXT.md`, `docs/AIdocs/`, `docs/PROJECT_INFO.md`) to document the new ownership boundary.

## Version 0.338 - Player Session and Company Ownership Hardening
**Date:** 2026-07-19 | **Commit(s):** bbdaa7b, e46060b | **Stats:** 577 insertions(+), 93 deletions(-)

### Summary
- Made selected player identity authoritative for company activation, profile operations, login restoration, and session changes.
- Prevented stale asynchronous company/profile results from replacing the current player after logout or player switching.
- Added independent player listing and regression coverage for authentication/session races and company ownership checks.

### Changes
- `src/lib/features/user/services/authService.ts`, `src/lib/features/user/feature.tsx`, and `featureTypes.ts` - wait for initial auth restoration, invalidate stale profile loads with an identity revision, clear local selections on sign-out, and list players independently of company ownership.
- `src/components/pages/Login.tsx`, `src/App.tsx`, `src/lib/database/core/companiesDB.ts`, `usersDB.ts`, and company services - validate persisted company ownership, separate owned/orphan company selection, and reset active game state when identity changes.
- `tests/features/user/authService.test.ts`, `loginSession.test.ts`, `userFeatureFacade.test.ts`, and company tests - cover stale-session, logout, player-selection, and ownership invariants.

### Notes
- Merge commit `7e9cf5f` integrates the player-session branch into the activity line, and `ba17d25` carries it into the final staff/main integration; those merge diffs are not counted again.

## Version 0.336b-0.336h - User, Company, and Leaderboard Isolation
**Date:** 2026-07-17 | **Commit(s):** db7a376, 68b3661, 2911fda, 12aa093, b9b60e0, bd4821d, 00e01a1 | **Stats:** 2,567 insertions(+), 2,235 deletions(-)

### Summary
- Isolated player identity, session, wallet, preferences, profile/settings UI, and company records behind explicit feature facades.
- Added a company gateway and active-company lifecycle hooks so App composes cross-feature activation while company/user modules retain their own contracts.
- Moved leaderboard recording, ranking, presentation, and maintenance behind `leaderboardsFeature`, with atomic best-score persistence for company aggregate boards.

### Changes
- `src/lib/features/user/`, `src/lib/features/company/`, and `src/lib/features/leaderboards/` - new public feature contracts, services, UI ownership, and feature-native input/read-model types.
- `src/lib/services/core/companyLifecycle.ts`, `gameState.ts`, `notificationService.ts`, and `financeService.ts` - explicit active-company cache and notification lifecycle hooks.
- **NEW FILE:** `src/lib/features/company/ui/CompanyGateway.tsx` (159 lines) - company selection/creation gateway for owned and unowned companies.
- **NEW FILE:** `migrations/20260717190000_make_company_leaderboards_atomic.sql` (153 lines) - deduplicates aggregate scores and provides atomic best-score writes while preserving historical wine/vineyard entries.
- `src/lib/database/core/highscoresDB.ts`, leaderboard consumers, and `tests/database/highscoresDB.test.ts` - atomic aggregate persistence and regression coverage.
- `src/components/pages/Login.tsx`, `CompanyOverview.tsx`, profile/settings pages, and `src/App.tsx` - migrated host and UI wiring to the feature facades.

### Notes
- Merge commit `6d72928` integrates the `isolate-user-domain-research` branch; its merge diff is not added to the grouped stats a second time.
- `00e01a1` completes the review cleanup by removing redundant user/company access paths and making leaderboard definitions/data loading declarative.
- Merge commit `0a58fcd` is the final main-branch integration of the staff-task specialization branch; its already listed changes are not counted a second time.

## Version 0.337 - Loan-Lender Quote and Payment Cleanup
**Date:** 2026-07-17 | **Commit(s):** 0604846, a7d14c7, 937384c | **Stats:** 875 insertions(+), 689 deletions(-)

### Summary
- Centralized borrower quotes, adjusted loan applications, payment summaries, search economics, and loan constants behind focused services.
- Split repayment operations from loan lifecycle orchestration while preserving persistence-failure propagation and activity completion behavior.

### Changes
- **NEW FILE:** `src/lib/features/loanLender/services/finance/loanQuoteService.ts` (152 lines) - shared lender-search, loan-offer, application, and payment-summary calculations.
- **NEW FILE:** `src/lib/features/loanLender/services/finance/loanPaymentService.ts` (99 lines) - repayment operations and outstanding-balance reads.
- `src/lib/features/loanLender/services/finance/loanService.ts`, `loanViewService.ts`, `lenderService.ts`, and activity managers - reduced duplicated lifecycle logic and routed borrower/application data through the focused seams.
- `src/lib/constants/loanConstants.ts`, work calculators, and loan UI - centralized lender availability, search, liquidation, range, and complexity tuning used consistently by previews and execution.
- `tests/finance/loanCalculations.test.ts` and `loanQuoteService.test.ts` - regression coverage for quotes, adjusted applications, payment summaries, and loan calculations.

### Notes
- The cleanup retains `loanLenderFeature` as the public facade; UI modules no longer own duplicated loan economics.

## Version 0.337 - Achievement Feature Cleanup
**Date:** 2026-07-17 | **Commit(s):** 67c6d08, 580fc96 | **Stats:** 123 insertions(+), 366 deletions(-)

### Summary
- Simplified achievement definitions and evaluation by removing duplicated orchestration and keeping feature-owned behavior focused.
- Added regression coverage for bulk unlock snapshots and retry-safe existing rewards.

### Changes
- `src/lib/features/achievements/achievementDefinitions.ts` and `AchievementsPage.tsx` - consolidated tier definitions and category/filter presentation.
- `src/lib/features/achievements/achievementService.ts` and `src/lib/database/core/achievementsDB.ts` - reduced service duplication and retained database-backed unlock evaluation.
- `tests/features/achievements/achievementEvaluation.test.ts` - coverage for bulk unlock reads and reward retries.

### Notes
- This is a feature-boundary cleanup following the achievement isolation entry; no new achievement category is claimed.

## Version 0.336c-0.337 - Staff and Activity Cleanup
**Date:** 2026-07-16 | **Commit(s):** f15b07e, 049aad2 | **Stats:** 285 insertions(+), 1,123 deletions(-)

### Summary
- Consolidated staff-search, work-allocation, wage, and persistence paths after the specialization cutover.
- Centralized vineyard work modifiers and clearing rules, removing duplicate activity and clearing implementations.

### Changes
- `src/lib/services/activity/workcalculators/workCalculator.ts`, `activityWorkContext.ts`, staff search services, `staffDB.ts`, and `wageService.ts` - canonical staff allocation, effective-skill, persistence, and wage paths.
- `src/lib/services/activity/workcalculators/vineyardWorkModifiers.ts`, `src/lib/services/vineyard/clearingRules.ts`, and clearing/activity managers - shared vineyard modifiers and clearing-health calculation used by previews and completion.
- `src/components/ui/modals/UImodals/StaffModal.tsx`, `StaffSearchOptionsModal.tsx`, and activity UI - updated staff and work previews.
- `tests/activity/clearingRules.test.ts`, staff activity tests, and workflow tests - regression coverage for the consolidated behavior.

### Notes
- Cleanup removes obsolete agent handoff artifacts and pass-through wrappers; the runtime changes are intended to preserve the specialization behavior introduced in `691ed54`.

## Version 0.336 - Staff Task and Grape Specialization Restoration
**Date:** 2026-07-16 | **Commit(s):** 691ed54, 5cccd82 | **Stats:** 1,940 insertions(+), 1,023 deletions(-)

### Summary
- Restored persisted staff task specializations and added broad specialized roles as a separate model.
- Applied additive, bounded role/task/grape bonuses consistently to work allocation and wages.
- Updated recruitment, starting conditions, staff UI, schema, and regression coverage for the clean specialization cutover.

### Changes
- `src/lib/types/types.ts`, `src/lib/constants/staffConstants.ts`, and `src/lib/services/activity/workcalculators/workCalculator.ts` - specialization contracts, shared tuning, allocation, and bonus caps.
- `src/lib/services/user/staffService.ts`, `src/lib/services/finance/wageService.ts`, and activity services - role/task validation, XP-aware wages, and lifecycle updates.
- `src/lib/database/core/staffDB.ts` and `migrations/20260715100000_replace_staff_specializations.sql` - strict persisted role data and schema migration.
- `src/components/pages/Staff.tsx`, staff modals, starting conditions, and recruitment UI - separate role, task, and grape-mastery presentation.
- `tests/activity/*`, `tests/finance/*`, and staff/user tests - focused calculator, wage, recruitment, and lifecycle coverage.
- `CONTEXT.md`, `readme.md`, `docs/AIdocs/`, `docs/PROJECT_INFO.md`, and `docs/WineSystem_VariableRelationshipMap.md` - aligned project guidance with the specialization model and removed superseded planning detail.

### Notes
- This is a breaking persistence cutover: legacy `staff.specializations` data is not read through a compatibility path.

## Version 0.3253-0.326 - Atomic Market Purchases and Database Stabilization
**Date:** 2026-07-14 to 2026-07-15 | **Commit(s):** f37bf65, 097d022, 2f5000e, 5027e4a, 09f330b | **Stats:** 367 insertions(+), 184 deletions(-)

### Summary
- Reworked market purchase persistence and database paths after the market-modal branch integration.
- Removed the failing client-side RPC purchase path and aligned purchase, transaction, and inventory updates with the corrected schema.

### Changes
- `src/lib/database/market/buyMarketOffersDB.ts`, market services, and storage-vessel adapters - atomic purchase handling and availability/funds validation.
- `src/lib/services/finance/financeService.ts` and inventory persistence - synchronization of persisted transactions and purchased batches.
- Database fixes and targeted market tests - corrected RPC/schema assumptions and failure behavior.

### Notes
- Merge commits `5dc5702` and `67f6c25` document the marketmodal integration; their changes are represented in the grouped feature entries rather than counted twice.

## Version 0.3253-0.3253b - Buy-Market Agent and Test-System Cleanup
**Date:** 2026-07-14 | **Commit(s):** 2020869, b9de7c3, be2a8e3 | **Stats:** 1,337 insertions(+), 1,425 deletions(-)

### Summary
- Corrected genetic and non-genetic buy-market agent editing and selection behavior.
- Trimmed obsolete test-system material and aligned plans/specifications with the current market architecture.

### Changes
- Buy-market agent components, services, constants, and tests - corrected editing and genetic purchase flows.
- `tests/` and test configuration - removed obsolete coverage and simplified the active test surface.

### Notes
- Documentation-only planning commits are omitted from the commit list because they do not change runtime behavior.

## Version 0.3251 - Achievement Feature Isolation
**Date:** 2026-07-13 | **Commit(s):** 654e26f, c14d5ee, ce44194 | **Stats:** 1,834 insertions(+), 3,157 deletions(-)

### Summary
- Isolated achievement definitions and behavior behind a feature-owned module boundary.
- Removed duplicated or obsolete achievement paths and completed the associated review cleanup.

### Changes
- Achievement feature modules, services, constants, and UI consumers - centralized achievement ownership and integration.
- `tests/` and affected shared services - updated imports, fixtures, and regression expectations for the isolated boundary.

### Notes
- The large deletion count reflects removal of superseded architecture rather than loss of achievement behavior.

## Version 0.332-0.3354 - Storage Vessels and Buy-Market Integration
**Date:** 2026-07-13 to 2026-07-14 | **Commit(s):** 24e8fee, 25a2d9b, 38cc0a7, cb3a5b2, c2ecafc, 3cbba0e, f05a806, d34eed7 | **Stats:** 5,983 insertions(+), 3,167 deletions(-)

### Summary
- Added storage vessels as capacity-bearing inventory used by market purchases and wine batches.
- Added vessel offers, allocation/release behavior, maintenance, and review-driven fixes across persistence and UI.

### Changes
- Storage-vessel services, database modules, types, migrations, and tests - vessel ownership, capacity, offers, and lifecycle state.
- `src/lib/services/sales/buyGrapeMarketService.ts`, storage-vessel market adapters, and inventory services - vessel-aware purchase and allocation flow.
- Market, winery, cellar, and related modal components - vessel selection, capacity display, and purchase feedback.
- Maintenance and regression tests - corrected partial allocation, cleanup, and persistence edge cases.

### Notes
- The numbered review commits are grouped because they refine one storage-vessel feature train.

## Version 0.331-0.331a - Genetic Buy-Market Generalization
**Date:** 2026-07-12 to 2026-07-13 | **Commit(s):** 638a1e7, c6ae19b, a3bb379 | **Stats:** 1,360 insertions(+), 163 deletions(-)

### Summary
- Generalized buy-market handling to support geneticized grape inventory and the later storage-vessel flow.
- Added supporting UI corrections and shared purchase/inventory seams.

### Changes
- `src/lib/services/sales/buyGrapeMarketService.ts` and market persistence - generalized offer-to-inventory conversion and purchase flow.
- Inventory, storage allocation, and market UI modules - shared handling for genetic batches and vessel capacity.
- Market tests - regression coverage for generalized purchase behavior.

### Notes
- This is the foundation for the subsequent storage-vessel feature train.

## Version 0.3242-0.3247a - Feature and Admin Module Boundary Cleanup
**Date:** 2026-07-12 to 2026-07-13 | **Commit(s):** 68ebf9e, 1e2640a, 75f38ea, e0faac1, 20f12f5, 4c747d2 | **Stats:** 1,331 insertions(+), 1,214 deletions(-)

### Summary
- Continued admin isolation and unified feature-module boundaries across the application.
- Evaluated and isolated the board-share module, deactivating its integration while preserving surrounding feature seams.

### Changes
- Admin and feature modules, shared services, and imports - moved ownership toward explicit feature boundaries.
- Board-share module and consumers - isolated and deactivated the module from the active feature path.
- `docs/codexplans/` and project documentation - recorded boundary decisions and follow-up architecture work.

### Notes
- These commits are architectural cleanup; no new player-facing mechanic is claimed here.

---
## Version 0.324-0.3241 - Weather Module Redesign and Site-Aware Forecast Explanations
**Date:** 2026-07-12 | **Commit(s):** 580df2c, ce46fba | **Stats:** 2,608 insertions(+), 3,259 deletions(-)

### Summary
- Replaced the older weather service split with a feature-oriented weather module covering resolution, vineyard projection, market effects, and presentation.
- Added persisted weather context, shared constants/types, integrated weekly-tick behavior, and migrated Vineyard, Weather Center, Winepedia, and grape-market consumers.
- Made forecast explanations site-aware by showing aspect, elevation, soil, and weather-specific exposure reasons; removed incorrect Research Workspace auto-scroll behavior.

### Changes
- **NEW FILE:** `src/lib/features/weather/weatherConstants.ts`, `weatherResolver.ts`, `weatherMarketService.ts`, `weatherVineyardService.ts`, `weatherPresentationService.ts`, and `weatherTypes.ts` - central weather domain and presentation architecture.
- `src/lib/services/core/gameTick.ts`, `src/lib/services/core/gameState.ts`, `src/lib/services/vineyard/vineyardManager.ts`, and `src/lib/services/vineyard/vineyardProgressionService.ts` - migrated simulation and vineyard progression to the new weather flow.
- `src/components/pages/Vineyard.tsx`, `src/components/pages/WeatherCenter.tsx`, and `src/components/pages/winepedia/WeatherTab.tsx` - consolidated weather UI and explainable site projections.
- **NEW FILE:** `migrations/20260710100000_add_game_state_weather_context.sql` (7 lines) - persists weather context required by the redesigned state flow.
- `tests/weather/*` and `tests/vineyard/*` - regression coverage for resolver, market, tick integration, presentation, and site modifiers.

### Notes
- `ce46fba` is a follow-up on top of the redesign and includes the exact site-modifier explanation coverage.

---
## Version 0.323-0.323a - Bulk-Buy Lifecycle and Winepedia Improvements
**Date:** 2026-07-10 | **Commit(s):** 3af1323, 30baf1e | **Stats:** 720 insertions(+), 332 deletions(-)

### Summary
- Improved bulk grape buying across offer generation, decay, inventory handling, wine-feature lifecycle effects, and admin/test support.
- Added a Wine Quality Winepedia reference surface and simplified the buy-market modal for clearer user information.

### Changes
- `src/lib/services/sales/buyGrapeMarketService.ts`, `src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx`, and `src/lib/services/core/gameTick.ts` - bulk-buy behavior, offer lifecycle, and UI updates.
- `src/lib/services/wine/features/featureService.ts`, `src/lib/services/wine/winery/inventoryService.ts`, and `src/lib/services/wine/winescore/wineScoreCalculation.ts` - market-feature and inventory/scoring integration.
- **NEW FILE:** `tests/wine/marketFeatureLifecycle.test.ts` - regression coverage for feature effects across market inventory lifecycle.
- `src/components/pages/winepedia/WineQualityTab.tsx` (+97) and `src/components/pages/Winepedia.tsx` - new quality reference content and navigation alignment.

### Notes
- The two commits are one short bulk-buy/UI iteration and are grouped as a single release train.

---
## Version 0.321-0.322a - Research Workspace and Finance Refresh
**Date:** 2026-07-09 | **Commit(s):** 935b1bf, 2a79b51, 2bcc4a4 | **Stats:** 1,690 insertions(+), 814 deletions(-)

### Summary
- Fixed stale finance totals by correcting game-state refresh behavior and finance-service update handling.
- Reworked research work calculations, presentation shaping, project economics, and the Research Workspace UI.

### Changes
- `src/lib/services/finance/financeService.ts`, `src/hooks/useGameState.ts`, and `src/components/finance/IncomeBalanceView.tsx` - finance refresh correctness.
- `src/lib/constants/researchConstants.ts`, `src/lib/services/activity/workcalculators/researchWorkCalculator.ts`, and `src/lib/services/research/researchPresentationService.ts` - research cost/progression and presentation rules.
- `src/lib/features/researchUpgrade/components/ResearchWorkspace.tsx` and `src/components/ui/shadCN/tooltip.tsx` - expanded research workspace and interaction polish.
- `tests/research/grapeResearchEconomics.test.ts` and `researchPresentationService.test.ts` - regression coverage for the updated calculations and view model.

### Notes
- `package-lock.json` churn in `935b1bf` is dependency-lock maintenance bundled with the finance fix.

---
## Version 0.31-0.31a - Bulk-Buy Architecture and Service-Boundary Cleanup
**Date:** 2026-07-07 to 2026-07-09 | **Commit(s):** 8f00b01, 400e8eb, 2f839ac, ca876f0, d784ea0, 190ef80, 8267566, c5363d1, 0f85099, 282df34, 5a38eac, 4b575f1, c75017c, cae739c | **Stats:** 3,456 insertions(+), 1,551 deletions(-)

### Summary
- Expanded bulk-buy previews, inventory transitions, offer snapshots, and lifecycle tests.
- Narrowed service/database boundaries by removing dead compatibility APIs and moving shared constants/database seams to their intended layers.
- Cleaned and reorganized research, finance, sales, authentication, and project documentation while merging the service-cleanup and workdesktop branches.

### Changes
- `src/lib/services/sales/buyGrapeMarketService.ts`, `src/lib/services/wine/winery/inventoryService.ts`, and `src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx` - market batch preview and inventory lifecycle architecture.
- **NEW FILE:** `migrations/20260707194000_add_market_batch_preview_snapshots.sql` (7 lines) - persists market preview snapshots.
- `src/lib/services/sales/contractService.ts`, `salesService.ts`, and `src/lib/services/wine/winery/inventoryService.ts` - explicit inventory seams used by sales flows.
- `src/lib/services/finance/financeService.ts` and `src/lib/services/vineyard/vineyardService.ts` - removed dead compatibility APIs.
- `docs/PROJECT_INFO.md`, `docs/codexplans/`, and the affected constants/database modules - boundary and project-structure cleanup.

### Notes
- Duplicate branch-equivalent commits are represented once; merge commits `c75017c` and `cae739c` are retained because they document the branch integration.

---
## Version 0.3 - Research Workspace Migration
**Date:** 2026-07-07 | **Commit(s):** 28af11e | **Stats:** 1,088 insertions(+), 1,968 deletions(-)

### Summary
- Replaced the older ResearchPanel/Winepedia research surfaces with a feature-owned Research Workspace.
- Moved research orchestration toward the `researchUpgrade` feature seam while retaining eligibility, permanent effects, and activity integration.

### Changes
- **NEW FILE:** `src/lib/features/researchUpgrade/components/ResearchWorkspace.tsx` (884 lines) - primary research workspace UI.
- `src/components/finance/ResearchPanel.tsx` (-1,155) and `src/components/pages/winepedia/ResearchTab.tsx` (-505) - removed superseded research surfaces.
- `src/lib/features/researchUpgrade/`, `src/lib/services/research/`, and research activity services - feature-boundary and orchestration migration.
- `tests/research/*`, `tests/core/gameTick.test.ts`, and `tests/vineyard/vineyardLifecycle.test.ts` - updated integration expectations.

### Notes
- This is an architectural/UI migration rather than a new research mechanic.

---
## Version X.X - Wine Anchor Debugging, Weather UI, and Skills Reorganization
**Date:** 2026-05-30 | **Commit(s):** 5575302, e0bbce9, 9635728, 5e281c6, 00abd8f, 978e2aa | **Stats:** 1,854 insertions(+), 4,187 deletions(-)

### Summary
- Added wine-anchor impact debugging and improved prestige-decay visibility for development and testing.
- Reorganized the repository skill catalog, moving and consolidating skills into the current superpowers/toolsskills structure.

### Changes
- `src/lib/services/wine/debug/wineAnchorImpactDebugService.ts`, `wineAnchorEffectUtils.ts`, `wineModal.tsx`, and wine lifecycle services - anchor-effect inspection and display.
- `src/components/ui/modals/UImodals/prestigeModal.tsx` and `src/lib/services/prestige/prestigeService.ts` - prestige decay presentation and behavior support.
- `skills/`, `.github/skills/`, and `docs/versionlog.md` - skill catalog migration, cleanup, and supporting guidance.

### Notes
- The `X.X` commits are primarily repository tooling maintenance; they are grouped with the adjacent player-facing weather/debug stabilization because they form the same missing history window.

---
## Version 0.292-0.292a - Vineyard Simulation and Research Guard Fixes
**Date:** 2026-05-28 | **Commit(s):** a1aacef, 8077e7b | **Stats:** 1,181 insertions(+), 401 deletions(-)

### Summary
- Corrected vineyard progression precision, state refresh behavior, land-search guards, and research-dependent capacity handling.
- Expanded weather/vineyard service tests and aligned the core-game mechanics documentation with the implemented runtime.

### Changes
- `src/lib/services/vineyard/vineyardProgressionService.ts`, `vineyardManager.ts`, `src/lib/database/activities/vineyardDB.ts`, and `src/hooks/useGameState.ts` - simulation/state correctness.
- **NEW FILE:** `migrations/20260528090000_preserve_vineyard_simulation_precision.sql` (28 lines) - preserves required vineyard simulation precision.
- `src/lib/services/vineyard/landSearchService.ts`, `landSearchManager.ts`, and `landSearchWorkCalculator.ts` - research guards and land-search behavior.
- `tests/hooks/useGameStateWithData.test.ts`, `tests/vineyard/*`, and updated research tests - regression coverage for the fixes.

### Notes
- These are paired stabilization commits across the vineyard, weather, and research systems.

---
## Version 0.293 - Weather Impact, Bottle Aging, and Forecast UI
**Date:** 2026-05-29 to 2026-05-30 | **Commit(s):** a28b6cf, 848df75, 7448498 | **Stats:** 1,760 insertions(+), 181 deletions(-)

### Summary
- Applied weather impact as a multiplier and corrected bottle-aging progression behavior.
- Expanded forecast UI explanations, vineyard weather-center behavior, and weather reference presentation.

### Changes
- `src/lib/services/core/gameTick.ts`, `src/lib/services/vineyard/vineyardProgressionService.ts`, and weather services - tick/progression and multiplier corrections.
- `src/components/pages/WeatherCenter.tsx` and `src/components/pages/winepedia/WeatherTab.tsx` - richer forecast and weather-reference UI.
- `src/components/ui/modals/UImodals/prestigeModal.tsx` and wine debug modal/services - adjacent prestige and anchor inspection improvements.
- `tests/core/gameTick.test.ts`, `tests/vineyard/weatherCenter*.test.ts`, and `tests/prestige/prestigeService.test.ts` - regression coverage.

### Notes
- `0.293b` is the UI-focused follow-up and is included in this grouped weather stabilization entry.

---
## Version 0.281a - Documentation Sync For Research/Founder Updates
**Date:** 2026-05-25 | **Commit(s):** 4621f07 | **Stats:** 10 insertions(+), 6 deletions(-)

### Summary
- Synced top-level project docs after the research presentation and founder revenue changes landed.
- Kept terminology and status summaries aligned across the main onboarding docs.

### Changes
- `CONTEXT.md` (+2/-2) - small context/status alignment update.
- `docs/AIdocs/AIDescriptions_coregame.md` (+3/-1) - refreshed implemented-status wording.
- `docs/PROJECT_INFO.md` (+2/-2) - updated project info to match the current research/founder surfaces.
- `readme.md` (+3/-1) - aligned README summaries with the latest systems state.

### Notes
- Despite the label, `0.281a` is the newest commit in this sequence and comes after `0.29` in actual chronology.

---

## Version 0.28, 0.29, 0.281 - Research Presentation Completion and Founder Revenue Integration
**Date:** 2026-05-25 | **Commit(s):** 12647fd, 203306a, eb262df | **Stats:** 4,350 insertions(+), 2,559 deletions(-)

### Summary
- Reworked research presentation into a larger service-driven UI split with dedicated presentation constants, view shaping, and tab-level orchestration.
- Added founder revenue support through staff/state/migration changes plus a dedicated finance panel.
- Finished the research UI pass with a large cleanup/rewrite that reduced spec drift between design docs and shipped screen structure.

### Changes
- **NEW FILE:** `src/lib/services/research/researchPresentationService.ts` (514 lines, later expanded) - centralizes research panel/view presentation shaping instead of leaving display logic scattered across UI components.
- **NEW FILE:** `src/lib/constants/researchPresentationConstants.ts` (25 lines) - shared presentation labels/config for the new research UI layout.
- `src/components/finance/ResearchPanel.tsx` (+1628/-771 in `12647fd`, +353/-367 in `203306a`, +1087/-1421 in `eb262df`) - major UI refactor that reorganizes research display, then trims/finalizes the structure in the follow-up finish commit.
- `src/components/pages/Research.tsx` (+154/-1, then +110/-55) - page-level orchestration updates for the revised research UI flow and view separation.
- `src/lib/constants/researchConstants.ts` and `src/lib/services/activity/workcalculators/researchWorkCalculator.ts` - rebalance research definitions and calculation behavior around the new presentation and progression pass.
- **NEW FILE:** `src/components/finance/FounderPanel.tsx` (115 lines) and **NEW FILE:** `migrations/20260525000000_add_is_founder_to_staff.sql` (9 lines) - founder revenue surface and persistence support.
- `src/lib/services/finance/wageService.ts`, `src/lib/services/user/staffService.ts`, `src/lib/database/core/staffDB.ts`, `src/lib/constants/staffConstants.ts`, and `src/lib/constants/startingConditions.ts` - founder-related staffing and startup behavior updates.
- **NEW FILE:** `tests/research/researchPresentationService.test.ts` (70 lines, then expanded), **NEW FILE:** `tests/activity/staffResearchSpeed.test.ts` (56 lines), and updates to `tests/user/researchPanelVisibility.test.ts` / `tests/user/researchCalculations.test.ts` - regression coverage for the reworked research presentation and staffing interactions.
- **NEW FILE:** `docs/superpowers/specs/reserachui.md` (343 lines, later heavily revised) and updates to `docs/superpowers/specs/2026-05-21-research-mechanic-design.md` - design docs brought closer to the shipped research UI.

### Notes
- These commits are now pushed on `main` and were verified against GitHub commit diffs.
- The dominant change is UI/service restructuring around research presentation, with founder revenue added as a parallel finance/staff feature.
- Version tags are not strictly monotonic here: `0.29` is followed by `0.281` in commit chronology, so ordering in this log follows actual commit order rather than numeric sorting.

---

## Version 0.x-0.xa - Prestige Modal and Research Constants Hotfixes
**Date:** 2026-05-24 | **Commit(s):** f6a5613, a976939 | **Stats:** 43 insertions(+), 5 deletions(-)

### Summary
- Applied two narrow follow-up fixes after the larger prestige/test/docs train.
- Corrected prestige modal behavior in service logic and fixed a small research constants issue.

### Changes
- `src/lib/services/prestige/prestigeService.ts` (+25/-1) - targeted prestige modal/service hotfix.
- `tests/prestige/prestigeService.test.ts` (+15) - added regression coverage for the prestige fix.
- `src/lib/constants/researchConstants.ts` (+3/-4) - corrected a research constant definition mismatch.

### Notes
- This is a micro-fix pair and should be read as stabilization work on top of the 0.26-0.27 feature/test passes.

---

## Version 0.27-0.27a - Test Expansion, Audit Docs, and Skill Maintenance
**Date:** 2026-05-24 | **Commit(s):** 525ed1e, 6f2c682, 9c3ecaf | **Stats:** 1,774 insertions(+), 386 deletions(-)

### Summary
- Expanded automated coverage around buy-market decay, contract unlocks, grape buyer behavior, and weather systems.
- Added implementation-audit and test-expansion docs to support the newer founder economy and weather/market work.
- Performed a broad maintenance pass across agent skill files, including the repository-specific `winemaker-game` skill.

### Changes
- **NEW FILE:** `docs/AIdocs/2026-05-24-founder-economy-implementation-audit.md` (245 lines) and **NEW FILE:** `docs/AIdocs/2026-05-24-test-expansion-checklist.md` (29 lines) - audit/checklist docs for recent system growth.
- **NEW FILE:** `tests/sales/buyGrapeMarketDecay.test.ts` (115 lines), **NEW FILE:** `tests/sales/contractGenerationUnlocks.test.ts` (86 lines), **NEW FILE:** `tests/vineyard/weatherCenterPage.test.ts` (147 lines), **NEW FILE:** `tests/vineyard/weatherCenterService.test.ts` (177 lines), **NEW FILE:** `tests/vineyard/weatherImpactService.test.ts` (114 lines) - new regression coverage for recent market and weather mechanics.
- `tests/sales/buyGrapeMarketService.test.ts` (+210/-1) and `tests/sales/grapeBuyerMarket.test.ts` (+109) - deeper buy-market and buyer behavior verification.
- `skills/winemaker-game/SKILL.md` (+134/-5 in `6f2c682`, +27/-120 in `9c3ecaf`) - substantial update/rewrite of repo-specific workflow guidance.
- Broad skill maintenance across `skills/best-practices/js-ts-best-practices/SKILL.md`, `skills/game-studio/SKILL.md`, `skills/best-practices/supabase-best-practices/SKILL.md`, and many other `skills/*.md` files - refines agent routing and instruction quality.
- `src/components/pages/winepedia/WeatherTab.tsx` (+3/-2) and `docs/AIdocs/AIDescriptions_coregame.md` (+1/-1) - small alignment updates around shipped weather/test coverage.

### Notes
- This entry is mostly tooling, test, and documentation support work rather than a new gameplay feature launch.
- The skill-file churn is significant enough to log because it changes how future agent sessions are steered in this repository.

---

## Version 0.26-0.261 - Prestige System Expansion, Balance Pass, and Test Coverage
**Date:** 2026-05-24 | **Commit(s):** 3681418, 975b382, 35a7b54 | **Stats:** 2,252 insertions(+), 1,113 deletions(-)

### Summary
- Expanded prestige mechanics, documentation, and source inventory, then followed with a balance pass and targeted test coverage.
- Connected prestige changes into contracts, loans, and achievement-related reward flows.
- Added Admin Test Lab target plumbing so the growing automated suite can be selected and parsed more cleanly.

### Changes
- `src/lib/services/prestige/prestigeService.ts` (+31/-10 in `3681418`, +37/-19 in `975b382`) and `src/lib/services/prestige/prestigeCalculator.ts` (+31/-8) - broad prestige rule and balancing updates.
- **NEW FILE:** `tests/prestige/prestigeService.test.ts` (138 lines) plus substantial follow-up additions, **NEW FILE:** `tests/user/achievementPrestigeBalance.test.ts` (12 lines), and updates to `tests/prestige/prestigeCalculator.test.ts` - prestige verification baseline and balancing assertions.
- `docs/PrestigeEventSourceInventory.md` (+148/-53, then +46/-44) - documents prestige event sources and later tuning changes.
- **NEW FILE:** `docs/PrestigeBalanceRecommendations.md` (142 lines) - explicit balance follow-up for prestige mechanics.
- `src/lib/features/loanLender/services/finance/loanService.ts` (+87/-13), `src/lib/services/sales/contractService.ts` (+60/-1), and `src/lib/services/sales/salesService.ts` (+10/-2) - prestige/balance effects propagated into adjacent finance and contract logic.
- `src/components/pages/admin/TestLabPage.tsx` (+44/-6), `server/test-runner-parser.ts` (+22/-3), `server/test-runner.ts` (+4/-4), and **NEW FILE:** `src/lib/services/admin/testLab/automatedTestTargets.ts` (43 lines) - improved admin test targeting and parser behavior.
- `readme.md` (+17/-4), `docs/versionlog.md` (+1012/-923), and `docs/WineSystem_VariableRelationshipMap.md` (+5) - documentation sync for the prestige/release-note pass.

### Notes
- This is a combined prestige feature/balance/test sequence; the large documentation churn in `3681418` is mostly versionlog modernization plus prestige inventory updates.
- `0.261` is primarily QA/tooling hardening around the prestige work rather than a separate mechanic release.

---

## Version 0.251K - Bulk Market Finalization and Prestige Scenario Coverage
**Date:** 2026-05-24 | **Commit(s):** 3df43d6 | **Stats:** 619 insertions(+), 22 deletions(-)

### Summary
- Applied one final follow-up pass to the bulk buy/sell market work after 0.251J.
- Added a detailed symmetry-analysis doc and introduced prestige scenario archetype tests in parallel.
- Refined the repo skill guidance again while touching final buy/sell modal behavior.

### Changes
- **NEW FILE:** `docs/AIdocs/buy-sell-grape-symmetry-analysis.md` (229 lines) - documents behavioral asymmetries and intended parity between buy/sell flows.
- `src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx` (+39/-15) and `src/components/ui/modals/activitymodals/SellGrapesModal.tsx` (+5/-2) - final modal polish and consistency fixes.
- `src/lib/services/sales/buyGrapeMarketService.ts` (+29/-4), `src/lib/services/sales/grapeBuyerMarketService.ts` (+2), and `src/lib/services/sales/grapeSupplierMarketService.ts` (+2) - final service-side corrections supporting the UI pass.
- **NEW FILE:** `tests/prestige/prestigeEventScenarioArchetypes.test.ts` (243 lines) - adds scenario coverage for prestige event archetypes.
- `skills/winemaker-game/SKILL.md` (+36) and `skills/improve-codebase-architecture/SKILL.md` (+34/-1) - guidance updates bundled into the same commit.

### Notes
- This entry is a narrow postscript to the larger 0.25-0.251J market rollout rather than a new standalone feature train.

---

## Version 0.25-0.251J - Bulk Grape Buy/Sell and Weather Gameplay Expansion
**Date:** 2026-05-22 to 2026-05-24 | **Commit(s):** e7343ef, d2174dd, 7203dc4, 4d57ed2, 8b88525, fe4874f, 515c37a, 132d92f, 3a6c6fd, 120b6f3, 87bdafb | **Stats:** 8,524 insertions(+), 2,050 deletions(-)

### Summary
- Introduced a full bulk-buy market pipeline (offers, modal flow, supplier relationships, and persistence) to complement existing grape selling mechanics.
- Added weather gameplay/UI progression from alpha to integrated pages and finalized balancing passes through 0.251J.
- Expanded admin test tooling and data scaffolding in parallel to validate market behavior and edge cases.

### Changes
- **NEW FILE:** `src/lib/services/sales/buyGrapeMarketService.ts` (574 lines) - implements bulk grape buy flow, pricing, and market transaction orchestration.
- **NEW FILE:** `src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx` (668 lines) - primary UI for browsing and executing bulk market purchases; later refined heavily in `d2174dd`, `fe4874f`, and `515c37a`.
- **NEW FILE:** `src/lib/services/finance/weatherService.ts` (305 lines) - weather simulation/service layer that feeds forecast volatility features.
- **NEW FILE:** `src/components/pages/winepedia/WeatherTab.tsx` (128 lines) - weather-facing UI for player-visible forecast information.
- `src/components/ui/modals/activitymodals/SellGrapesModal.tsx` (+525/-434 across sampled commits) - harmonized sell-side UX and logic with new buy-side mechanics.
- `src/components/pages/Vineyard.tsx` (+216/-143 in `fe4874f`) - integrated weather and market-facing updates into vineyard-facing gameplay UI.
- **NEW FILE:** `src/lib/services/sales/grapeSupplierLoyaltyService.ts` (384 lines) - adds supplier relationship progression tied to market buying.
- **NEW FILE:** `src/lib/services/sales/grapeSupplierMarketService.ts` (371 lines) - supplier-side market listing and offer handling.
- **NEW FILE:** `src/lib/database/sales/grapeSupplierMarketDB.ts` (82 lines) and **NEW FILE:** `migrations/20260524120000_add_grape_market_suppliers.sql` (39 lines) - persistence and schema for supplier market data.
- **NEW FILE:** `migrations/20260523090000_add_grape_market_buy_offers.sql` (51 lines) and **NEW FILE:** `migrations/20260523160000_add_grape_supplier_loyalty.sql` (35 lines) - schema support for buy offers and loyalty tracking.
- **NEW FILE:** `docs/superpowers/plans/2026-05-23-bulk-grape-buy-market-execution.md` (350 lines), **NEW FILE:** `docs/superpowers/specs/2026-05-23-bulk-grape-buy-market-design.md` (310 lines), and **NEW FILE:** `docs/superpowers/specs/2026-05-23-weather-forecast-volatility-design.md` (114 lines) - implementation and design docs for rollout decisions.

### Notes
- This entry is a multi-commit feature train where mechanics were shipped iteratively; later commits mostly tune behavior and resolve UX/logic mismatches between buy and sell paths.
- Behavior spans economy, sales, vineyard, and admin test surfaces; regression checks should prioritize modal flows and market-state persistence.

---

## Version 0.24b-0.241e - Research/Migration Cleanup and Earlygamebalance Merge
**Date:** 2026-05-22 to 2026-05-23 | **Commit(s):** e736234, 38ba758, ab826a2, 4cde587, 21fc2e0, 29a7d9a, 9f99ec0, 07445a6, d4bfe01, 8d60235, 71014b5 | **Stats:** 3,975 insertions(+), 1,179 deletions(-)

### Summary
- Converted accumulated schema work into timestamped migration files and shipped a dedicated Research tab surface.
- Merged `earlygamebalance` into `main` and resolved gameplay/UI conflicts, especially around research constants and sell-grapes modal behavior.
- Followed with cleanup commits focused on modal consistency and post-merge stabilization.

### Changes
- **NEW FILE:** `src/components/pages/winepedia/ResearchTab.tsx` (489 lines) - adds a dedicated Winepedia research surface and removes pressure from overloaded pages.
- **NEW FILE:** `migrations/2026-05-20_taste_quality_index_supabase.sql` (339 lines) plus additional timestamped migrations (`20260328120000`, `20260328140000`, `20260520130000`, `20260521000000`, `20260521120000`, `20260521130000`, `20260521140000`, `20260521230000`, `20260522000000`, `20260522010000`, `20260522020000`, `20260522030000`, `20260522040000`) - formalizes schema history and replaces monolithic ad-hoc migration drift.
- `src/lib/constants/researchConstants.ts` (+469/-567 in merge commit) - major conflict-resolution and rebalance pass during `07445a6`.
- `src/components/finance/ResearchPanel.tsx` (+111/-1 in merge commit) - merged branch enhancements into mainline research UI.
- `src/components/ui/modals/activitymodals/SellGrapesModal.tsx` (+155/-37 in merge commit; +55/-57 in `d4bfe01`) - conflict resolution followed by targeted modal fixes.
- **NEW FILE:** `src/lib/services/vineyard/vineyardCapacityService.ts` (142 lines) - introduces research-dependent vineyard capacity behavior from branch merge.
- **NEW FILE:** `tests/user/researchPanelVisibility.test.ts` (64 lines), **NEW FILE:** `tests/user/vineyardCapacityResearchHint.test.ts` (34 lines), **NEW FILE:** `tests/vineyard/landSearchAsymmetry.test.ts` (74 lines) - regression tests for merged earlygamebalance mechanics.
- `src/components/ui/modals/activitymodals/LandSearchOptionsModal.tsx` (+148/-42) and `src/components/ui/modals/activitymodals/LandSearchResultsModal.tsx` (+75/-50) - merged and tuned land-search constraints and presentation.

### Notes
- Merge commit `07445a6` explicitly resolved conflicts in `ResearchPanel` and `SellGrapesModal`; later 0.241c/0.241d/0.241e commits should be treated as merge-hardening follow-ups.
- This series materially changes migration discipline by moving to timestamped SQL files.

---

## Version 0.23a-0.23d - Test Suite Scale-Up and Admin Test Hardening
**Date:** 2026-05-22 to 2026-05-23 | **Commit(s):** f27ef96, 9dd3149, 32030b6, a7abf74 | **Stats:** 2,998 insertions(+), 47 deletions(-)

### Summary
- Expanded automated coverage across core gameplay domains with a large, scenario-based test pass.
- Strengthened admin test-lab services and behavior assertions to support larger feature trains.
- Added documentation follow-up after test expansion.

### Changes
- **NEW FILE:** `tests/activity/activityLifecycle.test.ts` (239 lines) - validates activity lifecycle transitions and regression scenarios.
- **NEW FILE:** `tests/core/gameTick.test.ts` (231 lines) - broadens simulation tick coverage for core loop stability.
- **NEW FILE:** `tests/sales/contractLifecycle.test.ts` (224 lines) and **NEW FILE:** `tests/sales/salesOrderLifecycle.test.ts` (178 lines) - increases confidence in sales lifecycle behavior.
- **NEW FILE:** `tests/sales/grapeBuyerMarket.test.ts` (190 lines) - introduces direct coverage for grape buyer market logic.
- **NEW FILE:** `tests/vineyard/vineyardLifecycle.test.ts` (210 lines) - validates end-to-end vineyard state transitions.
- **NEW FILE:** `tests/wine/wineryLifecycle.test.ts` (266 lines) and **NEW FILE:** `tests/wine/agingAndPricing.test.ts` (117 lines) - strengthens wine pipeline and pricing lifecycle checks.
- `src/lib/services/admin/testLab/testLabRunner.ts` (+218) and `src/lib/services/admin/testLab/testLabScenarios.ts` (+110) in `32030b6` - expanded admin test execution and scenario depth.
- `tests/admin/testLabBehavior.test.ts` (+124/-1 in `32030b6`) - updated assertions for the expanded test-lab behavior model.

### Notes
- This series is primarily quality and safety work; gameplay-facing changes are minimal, but confidence and regression detection improved significantly.

---

## Version 0.24-0.24a - Research System Upgrade and Grape Buyer Foundations
**Date:** 2026-05-21 to 2026-05-22 | **Commit(s):** ca1d46b, 0d106ff, b9d2e27 | **Stats:** 4,351 insertions(+), 466 deletions(-)

### Summary
- Expanded research mechanics and surfaced them in both finance/admin UI and gameplay gating paths.
- Introduced first-class grape buyer data models and UI tabs to support later bulk market features.
- Updated docs/context to align implementation with research + market direction.

### Changes
- **NEW FILE:** `docs/superpowers/specs/2026-05-21-research-mechanic-design.md` (269 lines) - formal design basis for the research overhaul.
- `src/lib/constants/researchConstants.ts` (+931/-87 across commits) - substantial rebalance and expansion of research definitions and effects.
- `src/components/finance/ResearchPanel.tsx` (+126/-42 across commits) - upgraded research UX and status visibility.
- `src/lib/features/researchUpgrade/services/activity/activitymanagers/researchManager.ts` (+75/-40) - manager logic updated to follow new research rules.
- `src/lib/services/activity/workcalculators/researchWorkCalculator.ts` (+53/-46) - work pacing recalibration for research progression.
- **NEW FILE:** `src/components/pages/Research.tsx` (77 lines) - dedicated research page surface.
- **NEW FILE:** `src/components/pages/winepedia/GrapeBuyersTab.tsx` (173 lines) - buyer-facing Winepedia tab.
- **NEW FILE:** `src/lib/database/sales/grapeBuyerLoyaltyDB.ts` (48 lines) and **NEW FILE:** `src/lib/database/sales/grapeBuyerMarketDB.ts` (82 lines) - persistence for buyer loyalty and market listings.
- `src/components/ui/modals/activitymodals/SellGrapesModal.tsx` (+283/-60 in `0d106ff`) - expanded selling workflow ahead of bulk market phase.

### Notes
- This entry is foundational for the later 0.25-0.251J market feature train.
- Research constants and work calculators changed together; balance verification should treat them as one system.

---

## Version 0.23 - Admin Test Lab Framework Introduction
**Date:** 2026-05-21 | **Commit(s):** 9f2ad27 | **Stats:** 1,984 insertions(+), 264 deletions(-)

### Summary
- Introduced an Admin Test Lab page and service layer for repeatable scenario execution.
- Added server-side test runner/parser support and updated test API flow.
- Added baseline test coverage for runner parsing and run-id behavior.

### Changes
- **NEW FILE:** `src/components/pages/admin/TestLabPage.tsx` (443 lines) - admin-facing control plane for test-lab runs.
- **NEW FILE:** `src/lib/services/admin/testLab/testLabRunner.ts` (286 lines) - executes test-lab scenarios in app context.
- **NEW FILE:** `src/lib/services/admin/testLab/testLabFixtureService.ts` (245 lines) - manages fixture setup and reset.
- **NEW FILE:** `src/lib/services/admin/testLab/testLabScenarios.ts` (168 lines) and **NEW FILE:** `src/lib/services/admin/testLab/types.ts` (107 lines) - scenario catalog and contracts.
- **NEW FILE:** `src/lib/services/admin/testLab/testLabCleanupService.ts` (137 lines) - cleanup/reset path after scenario runs.
- **NEW FILE:** `server/test-runner-parser.ts` (212 lines), **NEW FILE:** `server/test-runner.ts` (51 lines), **NEW FILE:** `server/devAdminGate.ts` (30 lines) - server plumbing for controlled test execution and output parsing.
- `server/test-api.ts` (+42/-138) - refactored API surface to align with runner/parser architecture.
- **NEW FILE:** `tests/admin/testRunnerParser.test.ts` (82 lines) and **NEW FILE:** `tests/admin/testLabRunId.test.ts` (18 lines) - initial verification of parser and run id utilities.

### Notes
- This commit establishes infrastructure that later 0.23x and 0.25x commits build on for broader scenario coverage.

---

## Version 0.22-0.22d - Documentation Restructure and Winemaker Skill Packaging
**Date:** 2026-05-21 | **Commit(s):** 1f39710, b0d08c4, 6c9026f, b72e3e3, 31c91d6 | **Stats:** 1,558 insertions(+), 845 deletions(-)

### Summary
- Performed a broad documentation cleanup, then reorganized docs into more explicit AIdocs and superpowers plan locations.
- Added a dedicated winemaker skill package in both repository-local and GitHub skills locations.
- Included minor code/doc alignment fixes uncovered during doc refactor review.

### Changes
- `readme.md` (+84/-303 across 0.22 and 0.22a) - major simplification and restructuring of top-level project onboarding text.
- `docs/TasteSystem_WineFolly_Research.md` (+315/-254 across 0.22 and 0.22a) - cleaned and reframed taste system research narrative.
- **NEW FILE:** `docs/superpowers/plans/2026-05-21-admin-test-lab.md` (230 lines) - planning document for admin test lab work.
- **RENAMED:** `docs/AIDescriptions_coregame.md` → `docs/AIdocs/AIDescriptions_coregame.md` - moved AI guidance into consolidated docs namespace.
- **RENAMED:** `docs/AIpromt_codecleaning.md` → `docs/AIdocs/AIpromt_codecleaning.md` and **RENAMED:** `docs/AIpromt_docs.md` → `docs/AIdocs/AIpromt_docs.md` - centralizes agent prompt docs.
- **RENAMED:** `docs/AIpromt_newpromt.md` → `docs/AIdocs/AIpromt_newpromt.md` - keeps prompt instructions adjacent to related AI docs.
- **RENAMED:** `docs/PublicCompanyImplementation.md` → `docs/superpowers/plans/PublicCompanyImplementation.md` and **RENAMED:** `docs/PublicCompanyPlan.md` → `docs/superpowers/plans/PublicCompanyPlan.md` - moves planning content under superpowers plans.
- **NEW FILE:** `.github/skills/winemaker-game/SKILL.md` (146 lines) and **NEW FILE:** `skills/winemaker-game/SKILL.md` (146 lines) - adds explicit project skill package for agent workflows.
- **NEW FILE:** `docs/AIdocs/copilot-instructions.md` (165 lines), **NEW FILE:** `docs/AIdocs/WinemakerGameSkill_DRAFT.md` (146 lines), **NEW FILE:** `docs/AIdocs/airules.mdc` (61 lines) - initial instruction and draft skill materials.

### Notes
- 0.22c is primarily a file-organization commit (rename/move heavy), while 0.22/0.22a carry most content edits.
- This set improves discoverability for future agents by converging docs into structured locations.

---

## Version Main-Merge-2026-05-20 - Merge Taste Branch Into Mainline
**Date:** 2026-05-20 | **Commit(s):** d0e3a95 | **Stats:** 29,988 insertions(+), 2,485 deletions(-)

### Summary
- Merged the full taste branch into main, carrying over gameplay, docs, and agent-skill infrastructure in one integration point.
- Resolved conflicts in migration state and aligned documentation baselines during merge.
- Established the foundation for subsequent 0.22-0.25 iteration work directly on main.

### Changes
- **NEW FILE:** `CONTEXT.md` (159 lines) - introduced a repo context reference document.
- **NEW FILE:** `docs/WineSystem_VariableRelationshipMap.md` (263 lines at merge point) - captured system variable relationships for wine mechanics.
- **NEW FILE:** `docs/superpowers/specs/2026-05-20-admin-test-lab-design.md` (359 lines) - design spec for test lab direction.
- `migrations/sync_vercel_schema.sql` - removed during merge resolution (+0/-1320) in favor of newer migration strategy adopted later.
- `docs/superpowers/plans/2026-05-20-early-game-balance-founder-economy.md` and related plan/spec docs - integrated planning artifacts from taste branch.
- `skills/` tree import (multi-file) - brought in broad agent skill definitions and support assets from taste branch.

### Notes
- This is a high-volume merge entry; behavior details are distributed across imported commits and clarified in subsequent focused release entries.
- Merge conflict markers were resolved in follow-up commits; see 0.24b-0.241e for stabilization details.

---

## Version 0.21-0.211 - Early Economy Plan and Sell Grapes Gameplay Introduction
**Date:** 2026-05-20 | **Commit(s):** f2289b5, ce034d4 | **Stats:** 1,436 insertions(+), 1,359 deletions(-)

### Summary
- Added early-game economy/balance planning artifacts and introduced the first complete sell-grapes gameplay path.
- Implemented sell-grapes UI, service logic, and activity integration with cooperative market behavior.
- Removed legacy sync schema file in preparation for migration model cleanup.

### Changes
- **NEW FILE:** `docs/superpowers/plans/2026-05-20-early-game-balance-founder-economy.md` (227 lines) - design plan for founder economy pacing.
- **NEW FILE:** `src/components/ui/modals/activitymodals/SellGrapesModal.tsx` (268 lines) - initial sell-grapes interaction modal.
- **NEW FILE:** `src/lib/services/sales/cooperativeService.ts` (190 lines) - cooperative-side sale pricing and behavior logic.
- **NEW FILE:** `src/lib/services/sales/sellGrapesService.ts` (185 lines) - core sale execution and transaction logic.
- `src/lib/services/activity/activitymanagers/activityManager.ts` (+67/-11) - added sell-grapes workflow into activity orchestration.
- `src/components/layout/ActivityPanel.tsx` (+27/-1) and `src/components/ui/activities/ActivityCard.tsx` (+50/-3) - surfaced new activity in player-facing UI.
- **REMOVED:** `migrations/sync_vercel_schema.sql` - removed large legacy schema sync file (+0/-1327).

### Notes
- This entry is a precursor to later bulk buy/sell market mechanics; initial functionality focuses on sell-side flow and cooperative interactions.

---

## Version 0.X - Repository-Wide Agent Skills Import
**Date:** 2026-05-20 | **Commit(s):** f220568 | **Stats:** 23,620 insertions(+), 0 deletions(-)

### Summary
- Imported a large reusable skills library to standardize agent workflows across coding, planning, debugging, and frontend/game tasks.
- Added both skill markdown definitions and supporting scripts/templates for specialized flows.
- Established model/agent metadata files to route tasks through specific skill contexts.

### Changes
- **NEW FILE:** `skills/best-practices/react-best-practices/AGENTS.md` (3,373 lines) - extensive React/Next performance and architecture guidance corpus.
- **NEW FILE:** `skills/brainstorming/scripts/server.cjs` (354 lines) and **NEW FILE:** `skills/brainstorming/scripts/frame-template.html` (214 lines) - local brainstorming support runtime and templates.
- **NEW FILE:** `skills/frontend-app-builder/SKILL.md` (185 lines), **NEW FILE:** `skills/dispatching-parallel-agents/SKILL.md` (182 lines), **NEW FILE:** `skills/find-skills/SKILL.md` (142 lines), **NEW FILE:** `skills/best-practices/js-ts-best-practices/SKILL.md` (142 lines) - core workflow skills for implementation and orchestration.
- **NEW FILE:** `skills/game-ui-frontend/SKILL.md` (112 lines), **NEW FILE:** `skills/game-studio/SKILL.md` (94 lines), **NEW FILE:** `skills/game-playtest/SKILL.md` (76 lines) - game-specific design and playtest workflows.
- **NEW FILE:** multiple `skills/*/agents/openai.yaml` files - model-routing metadata for skill execution.

### Notes
- This commit is infrastructure/documentation heavy; runtime gameplay behavior is unchanged directly, but future agent output quality is affected by these skill definitions.

---

## Version 0.205-0.205b - Taste Quality Index Integration and Terminology Alignment
**Date:** 2026-05-20 | **Commit(s):** b7c0756, 4d6d0fc, 83302f7 | **Stats:** 2,818 insertions(+), 703 deletions(-)

### Summary
- Implemented taste quality score visibility in wine scoring and commercial-facing UI paths.
- Added tests around anchor and wine-log related behavior while iterating on score naming consistency.
- Performed broad terminology cleanup to align model and UI language.

### Changes
- **NEW FILE:** `src/components/ui/components/WineTasteQualityBreakdown.tsx` (160 lines) - dedicated UI breakdown component for taste quality score explanation.
- `src/components/pages/sales/ContractsTab.tsx` (+16/-12) and `src/lib/constants/contractConstants.ts` (+16/-5) - contract generation/display now incorporates taste quality constraints.
- `src/components/ui/modals/UImodals/wineModal.tsx` (changes across 0.205a and 0.205b) - presents updated score terminology and quality details in wine detail modal.
- `src/lib/database/activities/inventoryDB.ts` (+9/-9) - updated inventory mapping to persist and surface renamed score fields.
- **NEW FILE:** `tests/user/wineLogService.test.ts` (111 lines in 0.205a) and **NEW FILE:** `tests/wine/wineAnchorService.test.ts` (61 lines in 0.205a) - added targeted regression coverage around scoring-related services.
- `tests/user/achievementScoreUtils.test.ts` (+28) - expanded score utility validation during rename pass.
- `docs/WineSystem_VariableRelationshipMap.md` and related plan/spec docs - documented updated score model and naming conventions.

### Notes
- 0.205a and 0.205b are mostly refinement and naming hardening over the initial 0.205 implementation.
- Terminology changes are cross-cutting; downstream docs/tests were updated in parallel to reduce drift.

---

## Version 0.204-0.204a - Taste Profile UI Stack and Service Layer
**Date:** 2026-04-13 to 2026-05-20 | **Commit(s):** b5f99df, 42df385 | **Stats:** 2,197 insertions(+), 1,492 deletions(-)

### Summary
- Introduced a dedicated taste-profile visualization stack (panel + wheel + breakdown logic) for wine-level analysis.
- Added taste-domain services/constants to move flavor compatibility and normalization out of ad-hoc UI logic.
- Follow-up commit refined modal integration and reduced/removed interim UI pieces.

### Changes
- **NEW FILE:** `src/components/ui/components/WineTasteProfilePanel.tsx` (199 lines) - main taste profile presentation component.
- **NEW FILE:** `src/components/ui/components/WineTasteWheel.tsx` (111 lines) - radial flavor visualization.
- **NEW FILE:** `src/lib/services/wine/taste/wineTasteProfileService.ts` (273 lines) - computes profile outputs used by UI.
- **NEW FILE:** `src/lib/services/wine/taste/tasteCrossDomain.ts` (19 lines) and **NEW FILE:** `src/lib/services/wine/taste/tasteNormalization.ts` (15 lines) - cross-feature taste mapping and normalization helpers.
- **NEW FILE:** `src/lib/constants/taste/flavorFamilyLabels.ts` (78 lines) and **NEW FILE:** `src/lib/constants/taste/tasteCompatibilityMatrix.ts` (63 lines) - canonical labels/compatibility mapping.
- `src/components/ui/modals/UImodals/wineModal.tsx` (+86/-40 in 0.204; additional reduction in 0.204a) - integrated and then tightened taste-profile rendering.
- `src/components/ui/components/StructureIndexBreakdown.tsx` (+20/-10) and `src/hooks/useWineStructureIndex.ts` (+7/-1) - aligned structure-index display with new taste outputs.

### Notes
- This entry sets up taste profile primitives used by later score/market quality work.
- 0.204a is primarily refinement and cleanup over the initial 0.204 rollout.

---

## Version 0.203-0.203a - Wine Anchor System Phase 1
**Date:** 2026-03-28 to 2026-03-30 | **Commit(s):** 212fe16, 9c347f1 | **Stats:** 1,023 insertions(+), 142 deletions(-)

### Summary
- Implemented a first-pass anchor system to influence wine characteristics through processing stages.
- Added bridge logic from anchor outputs into crush/fermentation/harvest characteristic calculators.
- Expanded feature and inventory flows so anchor effects persist through production.

### Changes
- **NEW FILE:** `src/lib/services/wine/anchors/wineAnchorService.ts` (455 lines initially; expanded in 0.203a) - core anchor scoring and selection logic.
- **NEW FILE:** `src/lib/services/wine/anchors/wineAnchorProcess.ts` (156 lines) - processing pipeline for anchor application.
- **NEW FILE:** `src/lib/services/wine/anchors/wineAnchorCharacteristicBridge.ts` (87 lines initial, +141 in 0.203a) - translates anchors into characteristic adjustments.
- `src/lib/services/wine/characteristics/crushingCharacteristics.ts` (+11/-4), `src/lib/services/wine/characteristics/fermentationCharacteristics.ts` (+12/-5), `src/lib/services/wine/characteristics/harvestCharacteristics.ts` (+11/-4) - characteristic calculators now consume anchor effects.
- `src/lib/services/wine/features/featureService.ts` (+37/-17 across two commits) - integrated anchor outputs into broader feature scoring.
- `src/lib/services/wine/winery/fermentationManager.ts` and `src/lib/services/wine/winery/inventoryService.ts` - anchor flow persisted through winery lifecycle.
- `src/lib/types/types.ts` (+65) - added anchor-related type contracts.

### Notes
- This is explicitly phase 1; architecture leaves room for future tuning of bridge weights and anchor interactions.

---

## Version 0.201-0.202a - Structure Terminology Migration and Follow-up Fixes
**Date:** 2026-03-28 | **Commit(s):** 764fef9, 7d65b8f, d143cc7 | **Stats:** 501 insertions(+), 501 deletions(-)

### Summary
- Renamed wine “balance” terminology to “structure index” across UI, hooks, services, and data mappings.
- Fixed feature price-calculation and display regressions discovered during rename propagation.
- Updated icon handling and modal labels to keep naming/UI consistency.

### Changes
- **RENAMED:** `src/hooks/useWineBalance.ts` → `src/hooks/useWineStructureIndex.ts` (45 new / 53 removed) - hook API aligned with new domain language.
- **RENAMED:** `src/components/ui/components/StructureIndexBreakdown.tsx` and **RENAMED:** `src/components/ui/modals/UImodals/StructureIndexBreakdownModal.tsx` - UI nomenclature updated to structure index.
- `src/hooks/useWineFeatureDetails.ts` (+10/-6) - corrected wine feature price calculations after terminology update.
- `src/components/pages/sales/WineCellarTab.tsx` (+7/-5) - fixed cellar display fields tied to renamed metrics.
- `src/lib/utils/icons.tsx` (+30/-17) and related modal/icon callsites - icon path and mapping cleanup.

### Notes
- This entry is largely a semantic/domain migration; behavior changes are minor except for bug-fix corrections noted above.

---

## Version 0.2003-0.2003a - Grape Quality to Price Modifier Migration
**Date:** 2026-03-26 to 2026-03-28 | **Commit(s):** a046da4, 155e95d | **Stats:** 2,081 insertions(+), 1,694 deletions(-)

### Summary
- Migrated “grape quality” terminology to “price modifier” in score-related UI and model surfaces.
- Reworked wine-cellar and order/wine modal flows to present the new modifier language and calculations.
- Applied follow-up fixes for corrupted/misaligned constants and utility mappings.

### Changes
- `src/components/pages/sales/WineCellarTab.tsx` (+1157/-1098) - major table and detail rendering rewrite around price-modifier semantics.
- **RENAMED:** `src/components/ui/components/landValueModifierBar.tsx`, **RENAMED:** `src/components/ui/components/landValueModifierBreakdown.tsx`, **RENAMED:** `src/components/ui/modals/UImodals/landValueModifierBreakdownModal.tsx` - UI components renamed to reflect modifier domain language.
- `src/components/pages/sales/OrdersTab.tsx` (+57/-15) - orders now surface modifier-linked values.
- `src/components/ui/modals/UImodals/wineModal.tsx` (+127/-38) - wine detail modal updated with modifier-driven fields.
- `src/lib/constants/constants.ts` (+8/-12) and `src/lib/constants/achievementConstants.ts` (+8/-6) - constants aligned with renamed field semantics.
- `src/lib/utils/utils.ts` (+16/-16 in 0.2003a) - follow-up utility cleanup after rename fallout.

### Notes
- Mostly a terminology and presentation migration with broad file impact; business logic intent stays aligned but field naming changes are extensive.

---

## Version 0.2001-0.2001a1 - Feature Seam Architecture Refactor
**Date:** 2026-03-06 to 2026-03-09 | **Commit(s):** a0dc562, 3031a8f, ecfb3be, 4cce0f7 | **Stats:** 4,334 insertions(+), 3,961 deletions(-)

### Summary
- Introduced feature seams to isolate major gameplay domains behind active/noop adapters.
- Moved research/upgrade and loan/lender services into feature-scoped modules with explicit contracts.
- Removed legacy direct service paths and wired app bootstrap/activity flows through feature entry points.

### Changes
- `src/lib/features/boardShare/` - board/share modules routed behind seam contracts and noop adapters.
- **NEW FILE:** `src/lib/features/researchUpgrade/active.tsx` (241 lines), **NEW FILE:** `src/lib/features/researchUpgrade/featureTypes.ts` (71 lines), **NEW FILE:** `src/lib/features/researchUpgrade/index.ts` (12 lines), **NEW FILE:** `src/lib/features/researchUpgrade/noop.ts` (55 lines) - research feature encapsulation.
- **NEW FILE:** `src/lib/features/researchUpgrade/services/research/researchEnforcer.ts` (59 lines) and **REMOVED:** `src/lib/services/research/researchEnforcer.ts` - moved enforcer into feature boundary.
- **NEW FILE:** `src/lib/features/loanLender/active.tsx` (135 lines), **NEW FILE:** `src/lib/features/loanLender/featureTypes.ts` (55 lines), **NEW FILE:** `src/lib/features/loanLender/index.ts` (12 lines), **NEW FILE:** `src/lib/features/loanLender/noop.ts` (33 lines) - loan/lender feature encapsulation.
- **NEW FILE:** `src/lib/features/loanLender/services/finance/loanService.ts` (2,514 lines), **NEW FILE:** `.../creditRatingService.ts` (512 lines), **NEW FILE:** `.../lenderService.ts` (212 lines) - core finance services relocated under feature scope.
- **REMOVED:** legacy stubs in `src/lib/services/finance/creditRatingService.ts`, `src/lib/services/finance/lenderService.ts`, and `src/lib/services/finance/loanService.ts` after migration completion.
- `src/lib/services/activity/activitymanagers/activityManager.ts`, `src/lib/services/core/startingConditionsService.ts`, and `src/main.tsx` - integration points updated to consume feature seams.

### Notes
- This is an architecture-heavy refactor intended to enable selective feature activation and cleaner module boundaries.
- `4cce0f7` is a short cleanup/fix-up commit after major relocation.

---

## Version 0.2002-0.2002a - Targeted Stability Fixes
**Date:** 2026-03-24 | **Commit(s):** 23ab720, 62d9571 | **Stats:** 104 insertions(+), 15 deletions(-)

### Summary
- Fixed startup-season vineyard yield initialization and related lifecycle edge cases.
- Resolved a runtime error path in prestige modal rendering.
- Added/updated tests to lock in yield behavior.

### Changes
- `src/lib/services/vineyard/vineyardManager.ts` (+21) - corrected starting-condition vineyard yield calculations.
- `src/lib/services/core/startingConditionsService.ts` (+3/-1) - fixed initial vineyard state wiring.
- `tests/vineyard/yieldCalculator.test.ts` (+16/-1) - expanded regression coverage for corrected yield behavior.
- `src/components/ui/modals/UImodals/prestigeModal.tsx` (+26/-6) - fixed runtime error branch in prestige UI.
- `src/lib/services/activity/activitymanagers/activityManager.ts` (+25/-3) and `src/lib/features/researchUpgrade/services/activity/activitymanagers/researchManager.ts` (+12/-4) - stability follow-ups for activity/research manager flows.

### Notes
- This is a focused bugfix release with low architectural churn and high gameplay-stability impact.

---

## Version 0.115-0.115c - Board Grace Period and Vineyard/Timing Corrections
**Date:** 2025-12-07 to 2026-02-05 | **Commit(s):** 57c55ce, 1575a15, f751b20, cf4b378 | **Stats:** 301 insertions(+), 207 deletions(-)

### Summary
- Added board satisfaction grace-period behavior and corresponding boardroom UI feedback.
- Corrected board enforcement behavior so vineyard actions are constrained rather than hard-blocked.
- Fixed several timing and vineyard progression regressions that affected early-season balance.

### Changes
- `src/components/finance/BoardRoomPanel.tsx` (+138/-136) - board grace-period and enforcement-state UI updates.
- `src/lib/services/board/boardSatisfactionService.ts` (+46/-32) - grace-period logic and board state handling.
- `src/lib/services/board/boardEnforcer.ts` (+27/-9) - changed enforcement semantics from blocking to limiting in affected paths.
- `src/lib/services/core/startingConditionsService.ts` (+5/-2) and `src/lib/services/vineyard/vineyardService.ts` (+16/-5) - fixed first-season vineyard growth/start-state behavior.
- `src/lib/services/core/gameTick.ts` (+13/-11), `src/lib/services/wine/features/featureService.ts` (+15/-1), `src/lib/services/vineyard/vineyardManager.ts` (+5/-3) - corrected timing/degradation balance issues.
- `src/components/ui/modals/UImodals/wineModal.tsx` (+20/-3) - modal-level display alignment with corrected mechanics.

### Notes
- This sequence is mostly corrective; it stabilizes mechanics introduced during prior board/share expansions.

---

## Version 0.113-0.114a - Boardroom Integration and Constraint Enforcement Layer
**Date:** 2025-11-30 to 2025-12-07 | **Commit(s):** 21f630c, cb34848, 303f15e | **Stats:** 3,532 insertions(+), 915 deletions(-)

### Summary
- Integrated boardroom controls directly into finance/share workflows.
- Introduced a formal constraint system with explicit types, constants, and reusable UI display components.
- Expanded share operations and company-share persistence to support stronger public-company mechanics.

### Changes
- `src/components/finance/BoardRoomPanel.tsx` (+594/-325 across commits) - major boardroom UI and interaction integration.
- `src/components/finance/ShareManagementPanel.tsx` (+330/-166) - added investor/board-aware share management UX.
- `src/lib/services/finance/shares/shareOperationsService.ts` (+1290/-137) - expanded IPO/dilution/investor operation behavior.
- **NEW FILE:** `src/components/ui/constraints/ConstraintDisplay.tsx` (223 lines) - reusable constraints UI.
- **NEW FILE:** `src/lib/types/constraintTypes.ts` (64 lines) - typed contract for board constraints.
- `src/lib/services/board/boardEnforcer.ts` (+291/-43) and `src/lib/constants/boardConstants.ts` (+242/-6) - core rule engine and tuning constants.
- `src/components/ui/modals/activitymodals/LandSearchOptionsModal.tsx` (+96/-10) and `src/lib/services/vineyard/landSearchService.ts` (+15/-4) - integrated board constraints into land search flows.
- `src/lib/database/core/companySharesDB.ts` (+121/-1) and `migrations/sync_vercel_schema.sql` (+12) - share persistence/schema support.

### Notes
- This release established the main board constraint architecture that later commits refine rather than replace.

---
## Version 0.112a-0.112d - Boardroom Enhancements and Credit-Rating Rewrite
**Date:** 2025-11-30 | **Commit(s):** 6d14d87, e86f2f8, 60f2ac1, ffad57d, 23f3d7d | **Stats:** 2,062 insertions(+), 1,583 deletions(-)

### Summary
- Iterated rapidly on boardroom UX and integrated board/finance signals into broader gameplay loops.
- Rewrote the credit-rating subsystem with explicit constants and stronger metrics-history support.
- Performed service-layer cleanup in share price/operations modules after boardroom integration.

### Changes
- `src/components/finance/BoardRoomPanel.tsx` (+1113/-622 across commits) - major boardroom UX evolution.
- `src/components/finance/LoansView.tsx` (+26/-22) and `src/components/finance/ShareManagementPanel.tsx` (+18/-18) - finance surfaces aligned to boardroom updates.
- **NEW FILE:** `src/lib/constants/creditRatingConstants.ts` (60 lines) - centralized credit-rating tuning constants.
- `src/lib/services/finance/creditRatingService.ts` (+280/-160) - substantial rating logic rewrite.
- `src/lib/database/core/companyMetricsHistoryDB.ts` (+61/-4) - increased metric tracking support for rating/board calculations.
- `src/lib/database/core/boardSatisfactionHistoryDB.ts` (+61/-21), `src/lib/services/board/boardEnforcer.ts` (+36/-20), `src/lib/services/board/boardSatisfactionService.ts` (+67/-36), `src/lib/services/core/gameTick.ts` (+25/-9) - board history and runtime integration updates.
- `src/lib/services/finance/shares/sharePriceService.ts` (+34/-92), `shareOperationsService.ts` (+20/-65), `shareMetricsService.ts` (+12/-66), `growthTrendService.ts` (+4/-11) - post-integration cleanup/refactor.
- **REMOVED:** `docs/board-satisfaction-and-constraints-system.plan.md` (363 lines) - consolidated into updated implementation docs.

### Notes
- This release is transitional: large functional updates plus heavy cleanup immediately after integration.

## Version 0.111 - Boardroom System Alpha Foundation
**Date:** 2025-11-30 | **Commit(s):** be5baea | **Stats:** 2,004 insertions(+), 1,622 deletions(-)

### Summary
- Introduced the first complete boardroom subsystem with satisfaction tracking, enforcement, and history persistence.
- Integrated boardroom signals into finance, game tick, share operations, and vineyard/service flows.
- Added planning documentation for board satisfaction/constraint mechanics.

### Changes
- **NEW FILE:** `src/components/finance/BoardRoomPanel.tsx` (435 lines) - first full boardroom management UI.
- **NEW FILE:** `src/lib/services/board/boardSatisfactionService.ts` (392 lines) - board satisfaction computation/tracking service.
- **NEW FILE:** `src/lib/services/board/boardEnforcer.ts` (182 lines) - board rule enforcement engine.
- **NEW FILE:** `src/lib/constants/boardConstants.ts` (109 lines) and **NEW FILE:** `src/lib/database/core/boardSatisfactionHistoryDB.ts` (304 lines) - constants + historical persistence.
- **NEW FILE:** `src/lib/utils/consistencyUtils.ts` (75 lines) - shared consistency helpers introduced alongside boardroom rollout.
- `src/components/finance/FinanceView.tsx` (+10/-1), `src/lib/services/core/gameTick.ts` (+12), `src/lib/services/finance/creditRatingService.ts` (+19/-6), `src/lib/services/finance/shares/shareOperationsService.ts` (+19) - integration touchpoints for board state.
- `migrations/sync_vercel_schema.sql` (+27) - schema changes supporting boardroom alpha data model.

### Notes
- This alpha release establishes core boardroom architecture; following 0.112x/0.113+ entries iterate and harden this base.

## Version 0.101 - Research Enforcer Introduction
**Date:** 2025-11-29 | **Commit(s):** 1b5486b | **Stats:** 159 insertions(+), 59 deletions(-)

### Summary
- Added a dedicated research-enforcement service to centralize unlock gating logic.
- Wired research gating into grape variety and planting option UI paths.
- Removed legacy research utility helper in favor of service-based enforcement.

### Changes
- **NEW FILE:** `src/lib/services/research/researchEnforcer.ts` (133 lines) - canonical research unlock enforcement logic.
- `src/components/pages/winepedia/GrapeVarietiesTab.tsx` (+8/-7) - applies enforcement checks in grape listing UI.
- `src/components/ui/modals/activitymodals/PlantingOptionsModal.tsx` (+11/-6) - blocks/filters planting options based on unlock state.
- `src/lib/services/core/startingConditionsService.ts` (+4/-4) - aligns startup research state with new enforcer.
- **REMOVED:** `src/lib/utils/researchUtils.ts` (39 lines) - replaced by service-layer implementation.

### Notes
- This commit starts the transition from utility-function checks to service-layer enforcement for research eligibility.

## Version 0.096a-0.096b - Build/DB Patch and Documentation Sync
**Date:** 2025-11-29 | **Commit(s):** 33bd9d1, 431dd10 | **Stats:** 448 insertions(+), 53 deletions(-)

### Summary
- Delivered fast follow-up fixes after the 0.096 refactor to stabilize build and DB paths.
- Expanded valuation test coverage and aligned docs with the new share architecture.
- Patched share-related DB operation details and company-service integration points.

### Changes
- `tests/finance/shareValuation.test.ts` (+196/-2) - significantly increased coverage around valuation behavior.
- `src/lib/database/core/companySharesDB.ts` (+20/-7) - corrected share ownership DB operations.
- `src/lib/services/user/companyService.ts` (+3/-2) - aligned company-level flows to DB fixes.
- `docs/share_price.md` (+76/-23), `docs/versionlog.md` (+106), `docs/PROJECT_INFO.md` (+14/-6), `docs/plan.plan.md` (+33/-12) - documentation update set reflecting post-refactor state.

### Notes
- This is a stabilization/documentation pass that depends on architectural changes introduced in 0.096.

## Version 0.096 - Share System Modular Architecture Refactor
**Date:** 2025-11-29 | **Commit(s):** d711f55 | **Stats:** 2,939 insertions(+), 2,318 deletions(-)

### Summary
- Replaced monolithic share-management services with a modular `finance/shares` service architecture.
- Added dedicated share ownership DB operations and aligned UI/types/service exports with the new layout.
- Preserved functional coverage while splitting pricing, operations, metrics, and helper responsibilities.

### Changes
- **REMOVED:** `src/lib/services/finance/shareManagementService.ts` (1,018 lines), **REMOVED:** `sharePriceIncrementService.ts` (696 lines), **REMOVED:** `shareValuationService.ts` (247 lines), **REMOVED:** `growthTrendService.ts` (136 lines) - monolith decomposition.
- **NEW FILE:** `src/lib/services/finance/shares/sharePriceService.ts` (657 lines), **NEW FILE:** `shareOperationsService.ts` (544 lines), **NEW FILE:** `shareMetricsService.ts` (446 lines), **NEW FILE:** `growthTrendService.ts` (232 lines) - core modular services.
- **NEW FILE:** `sharePriceAdjustmentHelpers.ts` (127 lines), **NEW FILE:** `sharePriceBreakdownHelpers.ts` (149 lines), **NEW FILE:** `shareCalculations.ts` (124 lines) - extracted utility/helper logic.
- **NEW FILE:** `src/lib/database/core/companySharesDB.ts` (208 lines) - share ownership persistence layer.
- `src/components/finance/ShareManagementPanel.tsx` (+53/-30) - UI updated to consume modular service API.
- `src/lib/types/types.ts` (+150), `src/lib/types/index.ts` (+9), `src/lib/services/index.ts` (+52/-2), `src/lib/services/user/companyService.ts` (+68/-80) - type/export integration updates.

### Notes
- 0.096a/0.096b immediately follow this with bugfixes and test/doc hardening.

## Version 0.095-0.095c - Share Price Expectation Model and Fix Iterations
**Date:** 2025-11-28 | **Commit(s):** 2351863, 42aedfa, fdd7cc7, 09e3789 | **Stats:** 719 insertions(+), 502 deletions(-)

### Summary
- Added expectation-based share pricing inputs tied to historical performance and company size.
- Updated panel/UI and constants to expose the expectation model to players.
- Applied rapid fix iterations for calculation, management-flow, and build correctness.

### Changes
- `src/lib/services/finance/sharePriceIncrementService.ts` (+54/-20, then +52/-47) - introduced and then corrected expectation-driven increment logic.
- `src/lib/constants/shareValuationConstants.ts` (+31/-9) - expanded tuning constants for expectation behavior.
- `src/components/finance/ShareManagementPanel.tsx` (+57/-30) - added expectation-focused display updates.
- `src/lib/services/finance/shareManagementService.ts` (+1/-16) - follow-up fixes in share management path.
- `docs/share_price.md` (+4/-1) - corrected documentation after implementation changes.
- `src/lib/services/finance/economyService.ts` (-1) - build-oriented cleanup fix.

### Notes
- This is a fast iteration sequence where 0.095a/b/c mostly harden the initial 0.095 release.

## Version 0.094 - Unified 48-Week Expectation Baseline
**Date:** 2025-11-28 | **Commit(s):** 29d08ec | **Stats:** 742 insertions(+), 323 deletions(-)

### Summary
- Introduced a unified 48-week expectation baseline for share-price behavior.
- Added UI and constants support to visualize and tune long-horizon expectation signals.
- Connected prestige and metrics-history systems to expectation-driven finance updates.

### Changes
- `src/lib/services/finance/sharePriceIncrementService.ts` (+230/-160) - implemented 48-week expectation model.
- `src/components/finance/ShareManagementPanel.tsx` (+322/-158) - added historical expectation display and supporting UI states.
- `src/lib/constants/shareValuationConstants.ts` (+39) - constants for 48-week expectation tuning.
- `src/lib/services/finance/shareManagementService.ts` (+73/-3) - integration updates for expectation-aware operations.
- `src/lib/services/prestige/prestigeService.ts` (+65/-1) - prestige hooks aligned with expanded valuation signals.
- `src/lib/database/core/companyMetricsHistoryDB.ts` (+13/-1) - metrics storage support for historical expectation calculations.

### Notes
- 0.094 is foundational for 0.095-0.095c expectation refinements.

## Version 0.093a - Database Mapper Consolidation
**Date:** 2025-11-28 | **Commit(s):** a6b6525 | **Stats:** 161 insertions(+), 139 deletions(-)

### Summary
- Centralized DB mapping utilities to reduce duplicate mapper logic across core tables.
- Refined company, metrics-history, and loan DB modules around the new mapper pattern.
- Applied mapper cleanup broadly across activity/core/customer DB files.

### Changes
- **NEW FILE:** `src/lib/database/dbMapperUtils.ts` (50 lines) - shared mapper/helper utilities for DB layer.
- `src/lib/database/core/companiesDB.ts` (+43/-30), `companyMetricsHistoryDB.ts` (+13/-25), `loansDB.ts` (+7/-30) - migrated toward shared mapper patterns.
- Additional mapper cleanup across `achievementsDB.ts`, `inventoryDB.ts`, `researchUnlocksDB.ts`, `staffDB.ts`, `transactionsDB.ts`, `usersDB.ts`, `wineLogDB.ts`, `salesDB.ts`, and `contractDB.ts`.

### Notes
- This commit is technical-debt reduction in the DB layer and sets up cleaner follow-up finance/share work.

## Version 0.093 - Share Price/Valuation System and Metrics History Foundation
**Date:** 2025-11-28 | **Commit(s):** 0e51073 | **Stats:** 4,026 insertions(+), 573 deletions(-)

### Summary
- Introduced the first full share valuation stack with incremental pricing, valuation, and growth-trend services.
- Added weekly company metrics history persistence and connected it to finance/tick loops.
- Delivered major ShareManagement UI and Winepedia surfaces for market transparency.

### Changes
- **NEW FILE:** `src/lib/services/finance/sharePriceIncrementService.ts` (587 lines), **NEW FILE:** `shareValuationService.ts` (248 lines), **NEW FILE:** `growthTrendService.ts` (136 lines), **NEW FILE:** `src/lib/constants/shareValuationConstants.ts` (62 lines) - core valuation subsystem.
- **REMOVED:** `src/lib/services/finance/shareValueService.ts` (189 lines) - replaced by modular valuation service.
- **NEW FILE:** `src/lib/database/core/companyMetricsHistoryDB.ts` (319 lines) - weekly snapshot storage for key financial metrics.
- `src/lib/services/finance/financeService.ts` (+262/-1) and `src/lib/services/core/gameTick.ts` (+35/-3) - integrated metrics snapshot updates into runtime loop.
- `src/components/finance/ShareManagementPanel.tsx` (+722/-270) - major UI overhaul for share data visibility and controls.
- **NEW FILE:** `src/components/pages/winepedia/ShareMarketTab.tsx` (215 lines) and `src/components/pages/Winepedia.tsx` (+3/-2) - added market information surface.
- **NEW FILE:** `tests/finance/shareValuation.test.ts` (329 lines) - baseline valuation test suite.
- **NEW FILE:** `docs/share_price.md` (298 lines), **NEW FILE:** `docs/plan.plan.md` (279 lines) - implementation and planning docs.

### Notes
- This commit is a foundational finance milestone; subsequent 0.094-0.096 entries iterate on this architecture.

## Version 0.092a - Build Fix Follow-up
**Date:** 2025-11-26 | **Commit(s):** efcb0f8 | **Stats:** 8 insertions(+), 1 deletion(-)

### Summary
- Applied a narrow build fix immediately after 0.092.

### Changes
- `src/components/finance/IncomeBalanceView.tsx` (+6) - corrected build-breaking finance view issue.
- `tests/activity/workCalculator.test.ts` (+2/-1) - adjusted test expectation/usage to match the fix.

### Notes
- Micro-fix commit with no major mechanic changes.

## Version 0.092 - Finance and Share Management Tuning Pass
**Date:** 2025-11-26 | **Commit(s):** f8bda77 | **Stats:** 612 insertions(+), 134 deletions(-)

### Summary
- Expanded share-management presentation and equity math to support richer IPO/public-company behavior.
- Reworked cashflow visualization and exposed new equity metrics from finance services.
- Added supporting constants/start-state fields needed by updated share model.

### Changes
- `src/components/finance/ShareManagementPanel.tsx` (+258/-65) - enhanced shareholder breakdowns, IPO readiness, and board control indicators.
- `src/lib/services/finance/shareManagementService.ts` (+201/-1) - extended dilution/investor/dividend calculations.
- `src/components/finance/CashFlowView.tsx` (+81/-42) - improved grouping and rolling net balance view.
- `src/lib/services/finance/financeService.ts` (+30/-24) - exposes additional equity metrics to UI.
- `src/lib/constants/financeConstants.ts` (+36) - added category descriptors/constants used by share UI and services.
- `src/lib/services/core/startingConditionsService.ts` and `src/lib/services/user/companyService.ts` (+6/-2 combined) - seed initialization for new share fields.

### Notes
- This is a tuning and UX-depth release, not a full architecture rewrite.

## Version 0.09-0.091B - Public Company and Equity Framework Rollout
**Date:** 2025-11-23 to 2025-11-25 | **Commit(s):** d108f94, 10709b7, e1435d4, ef4e4b8 | **Stats:** 4,452 insertions(+), 1,472 deletions(-)

### Summary
- Introduced public-company mechanics with issuance, ownership, valuation, and dividend scaffolding.
- Connected IPO/equity state to finance screens, login/profile/admin views, and core company persistence.
- Added staff contribution and wage-model updates to support expanded economy and valuation loops.

### Changes
- **NEW FILE:** `src/components/finance/ShareManagementPanel.tsx` (445 lines) - investor ledger and share control UI.
- **NEW FILE:** `src/lib/services/finance/shareManagementService.ts` (514 lines) and **NEW FILE:** `src/lib/services/finance/shareValueService.ts` (189 lines) - IPO/share pricing/dividend core logic.
- `src/components/pages/AdminDashboard.tsx`, `src/components/pages/Profile.tsx`, `src/components/pages/Login.tsx` (+481/-5 combined) - IPO toggles, ownership views, and balance surfaces.
- `src/lib/database/core/companiesDB.ts` and `src/lib/database/core/usersDB.ts` (+43/-3 combined) - persisted listing/float and user cash balance fields.
- Staff pipeline updates across `src/components/pages/Staff.tsx`, `StaffModal.tsx`, `StaffWageSummary.tsx`, `StaffSkillBar.tsx`, and activity work calculators - experience/contribution-driven compensation behavior.
- `src/components/pages/winepedia/MathematicalModelsTab.tsx` (+517/-456) and `src/lib/utils/calculator.ts` (+76/-28) - valuation/contribution model documentation and helper math.
- **NEW FILE:** `src/lib/services/user/userBalanceService.ts` (123 lines) - centralized cash/dividend payout handling.

### Notes
- This is the initial large-scale equity/public-company release; later 0.092+ entries tune and stabilize these mechanics.

## Version Docs-2025-11-23 - Versionlog Split and Archival
**Date:** 2025-11-23 | **Commit(s):** 1e5bfc4 | **Stats:** 1,197 insertions(+), 1,195 deletions(-)

### Summary
- Split version log history into active vs legacy documents to improve maintainability.
- Kept current log focused on recent releases while preserving full historical data.

### Changes
- **NEW FILE:** `docs/versionlog_legacy.md` (1,196 lines) - archived older entries (<=0.06).
- `docs/versionlog.md` - reduced active log footprint and added reference to the archive file.

### Notes
- Structural documentation change only; no gameplay or runtime code impact.

## Version 0.082 - Grape Research Unlock Framework
**Date:** 2025-11-23 | **Commit(s):** e0c1b16 | **Stats:** 856 insertions(+), 129 deletions(-)

### Summary
- Added persistent research unlock tracking for grape families.
- Integrated unlock gating into planting, grape encyclopedia, and starting-condition flows.
- Updated research work/reward loops and UI to surface unlock progression.

### Changes
- **NEW FILE:** `src/lib/database/core/researchUnlocksDB.ts` (154 lines) - persistence layer for unlocked grape tracks.
- **NEW FILE:** `src/lib/utils/researchUtils.ts` (39 lines) - helper utilities for unlock checks.
- `src/lib/constants/researchConstants.ts` (+150/-18) - expanded grape-focused research track definitions.
- `src/components/finance/ResearchPanel.tsx` (+117/-33) - unlock progression display and requirement feedback.
- `src/lib/services/activity/activitymanagers/researchManager.ts` and `src/lib/services/activity/workcalculators/researchWorkCalculator.ts` (+131/-17 combined) - reward/workload updates tied to unlock states.
- `src/components/pages/winepedia/GrapeVarietiesTab.tsx`, `src/components/ui/modals/activitymodals/PlantingOptionsModal.tsx`, `src/components/ui/modals/UImodals/StartingConditionsModal.tsx` (+131/-8 combined) - gameplay gating by research progress.

### Notes
- This establishes core unlock mechanics later refined by research enforcer and subsequent research updates.

## Version 0.076b-0.076C - Test Coverage Expansion and Economy Regression Fixes
**Date:** 2025-11-23 | **Commit(s):** dd4b2f3, 2ada3b9, 545fea1 | **Stats:** 1,289 insertions(+), 1,193 deletions(-)

### Summary
- Expanded user workflow test coverage for hiring, research, and starting/founder scenarios.
- Fixed economy-phase persistence and lender seizure behavior regressions.
- Improved test tooling (viewer/API) and normalized asset naming for harness consistency.

### Changes
- **NEW FILE:** `tests/user/researchWorkflow.test.ts` (213 lines) and major updates to `tests/user/hireStaffWorkflow.test.ts` / `tests/user/startingConditions.test.ts` - broader end-to-end user workflow coverage.
- `server/test-api.ts` and `test-viewer/TestViewer.tsx` (+113/-24 combined) - improved test runner UX and mock endpoint support.
- `src/lib/services/core/gameState.ts` (+17) - fixed economy-phase persistence issue.
- `src/lib/services/finance/loanService.ts` (+144/-23) - corrected lender seizure calculation behavior.
- `src/lib/services/activity/activitymanagers/researchManager.ts` and `src/lib/constants/researchConstants.ts` (+58/-57 combined) - synced research targets and behavior.
- Grape icon assets renamed to snake_case for stable test references.

### Notes
- Heavy deletions are primarily test refactors/rewrites rather than feature removals.

---
## Version 0.081 - Research System Expansion Pass
**Date:** 2025-11-21 | **Commit(s):** 567a7a8 | **Stats:** 1,639 insertions(+), 1,048 deletions(-)

### Summary
- Expanded research constants, manager logic, and work calculations for deeper progression behavior.
- Linked research outcomes into prestige calculations and related UI.
- Performed broad UI/service cleanup while introducing new research-facing behaviors.

### Changes
- `src/lib/constants/researchConstants.ts` (large update) - expanded research track parameters and progression rules.
- `src/components/finance/ResearchPanel.tsx` (+195/-28) - improved panel UX and progression visibility.
- `src/lib/services/activity/activitymanagers/researchManager.ts` (+120/-18) and `src/lib/services/activity/workcalculators/researchWorkCalculator.ts` (+139/-19) - expanded research runtime logic.
- `src/lib/services/prestige/prestigeService.ts` (+123/-93) - integrated research effects into prestige computation.
- `src/components/ui/modals/UImodals/prestigeModal.tsx` (+473/-481) - major modal rewrite aligned with updated prestige/research outputs.
- `migrations/sync_vercel_schema.sql` (+43/-1) - schema support changes for related system updates.

### Notes
- High churn reflects coordinated logic+UI refactor, not isolated bugfixing.

## Version 0.08 - Initial Research System Rollout
**Date:** 2025-11-21 | **Commit(s):** d44000c | **Stats:** 2,051 insertions(+), 363 deletions(-)

### Summary
- Introduced the first research activity framework (manager, work calculator, and finance panel).
- Integrated research into activity/work pipelines and replaced the old upgrades placeholder path.
- Added significant user-flow test scaffolding around company creation, hiring, and starting conditions.

### Changes
- **NEW FILE:** `src/lib/services/activity/activitymanagers/researchManager.ts` (26 lines), **NEW FILE:** `src/lib/services/activity/workcalculators/researchWorkCalculator.ts` (32 lines), **NEW FILE:** `src/components/finance/ResearchPanel.tsx` (42 lines) - first research feature skeleton.
- **REMOVED:** `src/components/finance/UpgradesPlaceholder.tsx` (27 lines) - replaced by active research UI.
- `src/lib/constants/activityConstants.ts` (+20/-20), `src/lib/services/activity/activitymanagers/activityManager.ts` (+50/-47), `src/lib/services/activity/workcalculators/workCalculator.ts` (+26/-26) - integrated research activity/work into core loops.
- **NEW FILE:** `tests/user/companyCreation.test.ts` (395 lines), **NEW FILE:** `tests/user/hireStaffWorkflow.test.ts` (674 lines), **NEW FILE:** `tests/user/startingConditions.test.ts` (293 lines) - baseline integration coverage.
- `test-viewer/TestViewer.tsx` (+266/-6) - improved test viewer support for new test suite growth.

### Notes
- This is the initial research launch; later commits (0.081, 0.082, 0.101) progressively deepen and enforce it.

## Version 0.076a - Test Suite and Viewer Enhancements
**Date:** 2025-11-21 | **Commit(s):** edc8b60 | **Stats:** 1,270 insertions(+), 501 deletions(-)

### Summary
- Expanded vineyard test coverage and significantly upgraded the test viewer UX.
- Added dedicated vineyard-creation tests and refreshed suitability/yield assertions.

### Changes
- `test-viewer/TestViewer.tsx` (+1105/-488) - major test viewer enhancement pass.
- **NEW FILE:** `tests/vineyard/vineyardCreation.test.ts` (154 lines) - baseline vineyard creation coverage.
- `tests/vineyard/grapeSuitability.test.ts` (+1/-1) and `tests/vineyard/yieldCalculator.test.ts` (+9/-11) - updated expectation cases.

### Notes
- This commit focuses on QA tooling and vineyard test confidence.

## Version 0.076 - Loan/Lender Correctness Fixes
**Date:** 2025-11-21 | **Commit(s):** 99981d9 | **Stats:** 196 insertions(+), 167 deletions(-)

### Summary
- Fixed lender generation balancing and corrected seizure limits in loan enforcement logic.

### Changes
- `src/lib/services/finance/lenderService.ts` (+77/-60) - ensures lender creation yields required type counts.
- `src/lib/services/finance/loanService.ts` (+119/-107) - caps vineyard-value seizure behavior at intended max thresholds.

### Notes
- Targeted mechanics fix release with limited surface area.

## Version 0.075 - Automated Testing Framework and pnpm Migration
**Date:** 2025-11-21 | **Commit(s):** c7d5c9a | **Stats:** 9,517 insertions(+), 6,308 deletions(-)

### Summary
- Introduced a broad automated test baseline across activity, finance, vineyard, and wine domains.
- Added a dedicated in-repo test viewer and API bridge for running/inspecting tests.
- Migrated package management from npm lockfile to pnpm workspace tooling.

### Changes
- **NEW FILE:** `tests/activity/workCalculator.test.ts` (166 lines), **NEW FILE:** `tests/finance/loanService.test.ts` (165 lines), **NEW FILE:** `tests/finance/wageService.test.ts` (150 lines), **NEW FILE:** `tests/vineyard/grapeSuitability.test.ts` (277 lines), **NEW FILE:** `tests/vineyard/yieldCalculator.test.ts` (281 lines), **NEW FILE:** `tests/wine/fermentationCharacteristics.test.ts` (214 lines) - first broad automated test set.
- **NEW FILE:** `test-viewer/TestViewer.tsx` (822 lines), **NEW FILE:** `test-viewer/TestViewerPage.tsx` (13 lines), **NEW FILE:** `test-viewer/index.html` (432 lines), **NEW FILE:** `test-viewer/viewer.js` (161 lines), **NEW FILE:** `server/test-api.ts` (132 lines) - test execution and visualization infrastructure.
- **REMOVED:** `package-lock.json` (6,302 lines), **NEW FILE:** `pnpm-lock.yaml` (4,897 lines), **NEW FILE:** `pnpm-workspace.yaml` (2 lines) - package manager migration to pnpm.
- `package.json`, `vite.config.ts`, `tsconfig.json` - configured vitest scripts and TypeScript/test integration.

### Notes
- This is a foundational tooling release; later entries build on this testing baseline and infrastructure.

## Version 0.074a - Supabase Schema and Vineyard Value Fixes
**Date:** 2025-11-21 | **Commit(s):** cbe577c | **Stats:** 70 insertions(+), 54 deletions(-)

### Summary
- Fixed schema/state mismatches in Supabase sync SQL.
- Corrected vineyard-value calculations in startup and manager paths.

### Changes
- `migrations/sync_vercel_schema.sql` (+44/-44) - schema fix pass.
- `src/lib/services/core/startingConditionsService.ts` (+14/-3) - corrected startup vineyard value calculations.
- `src/lib/services/vineyard/vineyardManager.ts` (+10/-5) - aligned vineyard manager value logic.
- `src/lib/services/sales/salesService.ts` (+2/-2) - minor consistency update.

### Notes
- Narrow correctness patch ahead of larger testing/research work.

## Version 0.074 - Schema Update Baseline
**Date:** 2025-11-14 | **Commit(s):** b813805 | **Stats:** 74 insertions(+), 10 deletions(-)

### Summary
- Applied a schema update baseline and minor activity panel alignment.

### Changes
- `migrations/sync_vercel_schema.sql` (+71/-8) - core schema update set.
- `src/components/layout/ActivityPanel.tsx` (+2/-2) - small UI alignment with schema/data changes.

### Notes
- Mostly schema-centric commit with minimal UI impact.

## Version 0.073-0.073DB - Multi-Commit Bugfix and Contract System Hardening
**Date:** 2025-11-13 to 2025-11-14 | **Commit(s):** d2067c8, c0bb9b5, e0f4656, 9dca737, 7ddc08d, 8a896e5, c1ae140 | **Stats:** 1,801 insertions(+), 654 deletions(-)

### Summary
- Stabilized prestige, achievements, loans, and sales contracts through a fast bugfix sequence.
- Introduced dedicated contract constants/expiration handling and replaced the estimated-price hook path.
- Updated sales/loan UI and schema to support revised contract and pricing behavior.

### Changes
- `src/lib/services/prestige/prestigeService.ts` (+17/-4), `src/lib/services/user/achievementService.ts` (+54/-27), `src/lib/services/finance/loanService.ts` (+147/-119) - targeted correctness fixes.
- `src/lib/services/sales/contractGenerationService.ts` (+337/-161) and `src/lib/services/sales/contractService.ts` (+134/-28) - major contract behavior improvements.
- **NEW FILE:** `src/lib/constants/contractConstants.ts` (209 lines) - centralized contract configuration.
- **NEW FILE:** `src/lib/services/sales/expirationService.ts` (104 lines) - contract expiration logic.
- **NEW FILE:** `src/hooks/useWinePriceCalculator.ts` (63 lines) and **REMOVED:** `src/hooks/useEstimatedPrice.ts` (46 lines) - migrated to updated pricing hook.
- UI updates: `src/components/pages/sales/ContractsTab.tsx` (+179/-60), `AssignWineModal.tsx` (+50/-7), `src/components/ui/components/grapeQualityBreakdown.tsx` (+48/-72), `src/components/finance/LoansView.tsx` (+28/-9).
- `migrations/sync_vercel_schema.sql` (+303/-59) - schema support for updated contracts/pricing flow.

### Notes
- Represents multiple quick iterations grouped into one stabilization window.

## Version 0.072 - Cross-System Bugfix Pass (Features/Sales/Loans)
**Date:** 2025-11-13 | **Commit(s):** e46d1c6 | **Stats:** 688 insertions(+), 153 deletions(-)

### Summary
- Fixed feature, sales-order, contract-expiration, and loan behavior in one cross-domain patch.
- Updated lender-search and orders UI to reflect corrected backend logic.
- Applied small schema/client/database updates to align persistence paths.

### Changes
- `src/lib/services/wine/features/featureService.ts` (+108/-52), `src/lib/services/finance/loanService.ts` (+106/-8), `src/lib/services/sales/salesOrderService.ts` (+62/-1), `src/lib/services/sales/generateOrder.ts` (+25/-5), `src/lib/services/vineyard/vineyardManager.ts` (+42/-5), `src/lib/services/core/gameTick.ts` (+15/-2) - coordinated system bugfix set.
- **NEW FILE:** `src/lib/services/sales/expirationService.ts` (104 lines) - expiration handling integrated into sales flow.
- `src/components/ui/modals/activitymodals/LenderSearchOptionsModal.tsx` (+128/-32) and `src/components/pages/sales/OrdersTab.tsx` (+26/-4) - UI support for corrected logic.
- `migrations/sync_vercel_schema.sql` (+4), `src/lib/database/core/supabase.ts` (+12/-1), `src/lib/database/customers/salesDB.ts` (+9/-1) - persistence-layer adjustments.

### Notes
- Primarily a correctness release focused on systemic bug reduction.

---
## Version 0.071a - Type Build Fix
**Date:** 2025-11-13 | **Commit(s):** d8a0e97 | **Stats:** 10 insertions(+), 0 deletions(-)

### Summary
- Fixed a compile/build issue through targeted type adjustments.

### Changes
- `src/lib/types/types.ts` (+10) - type definition fixes to restore build stability.

### Notes
- Micro-fix commit with no feature-level changes.

## Version 0.07 - Contracts Launch, Rot Features, Starting Conditions Expansion
**Date:** 2025-11-13 | **Commit(s):** deaafe0 | **Stats:** 4,601 insertions(+), 561 deletions(-)

### Summary
- Launched initial contracts UX and supporting sales workflows.
- Added grey-rot and noble-rot wine feature definitions plus display support.
- Expanded starting-conditions flow and introduced Sangiovese content.

### Changes
- **NEW FILE:** `src/components/pages/sales/ContractsTab.tsx` (441 lines) and **NEW FILE:** `src/components/pages/sales/AssignWineModal.tsx` (284 lines) - contracts management UI.
- `src/components/pages/Sales.tsx` (+30/-2) and `src/components/pages/sales/OrdersTab.tsx` (+88/-25) - contracts integrated into sales pipeline.
- **NEW FILE:** `src/lib/constants/wineFeatures/greyRot.ts` (171 lines), **NEW FILE:** `src/lib/constants/wineFeatures/nobleRot.ts` (254 lines), `lateHarvest.ts` (+95/-40), `commonFeaturesUtil.ts` (+16/-6), and `src/components/ui/components/FeatureDisplay.tsx` (+103/-23) - rot-feature framework.
- `src/lib/constants/grapeConstants.ts` (+54/-25) and **NEW FILE:** `public/assets/icons/grape/icon_sangiovese.png` - Sangiovese grape integration.
- `src/lib/constants/startingConditions.ts` (+105/-26), `src/components/ui/modals/UImodals/StartingConditionsModal.tsx` (+43/-5), `src/components/pages/Login.tsx` (+16/-12), `src/components/pages/AdminDashboard.tsx` (+21/-3), `src/components/pages/Staff.tsx` (+30/-4) - expanded starting-condition surfaces.
- `src/hooks/useEstimatedPrice.ts` (+39/-6), `src/lib/constants/loanConstants.ts` (+6/-4), `src/lib/constants/achievementConstants.ts` (+15/-2), and `migrations/sync_vercel_schema.sql` (+3/-1) - supporting systems updates.

### Notes
- Major feature release with broad content and system surface area.

## Version 0.068 - Starting Conditions System Implementation
**Date:** 2025-11-11 | **Commit(s):** 65294cb | **Stats:** 1,977 insertions(+), 179 deletions(-)

### Summary
- Introduced the first full starting-conditions framework with config, service, and modal UI.
- Expanded loan-service behavior and UI/state support while adding story media assets.
- Updated admin/login/company-overview flows to surface starting-condition selection and effects.

### Changes
- **NEW FILE:** `src/lib/constants/startingConditions.ts` (225 lines), **NEW FILE:** `src/lib/services/core/startingConditionsService.ts` (172 lines), **NEW FILE:** `src/components/ui/modals/StartingConditionsModal.tsx` (278 lines) - core starting-condition architecture.
- `src/components/pages/Login.tsx` (+51/-6), `src/components/pages/AdminDashboard.tsx` (+94/-2), `src/components/pages/CompanyOverview.tsx` (+69/-2) - integrated starting-condition flow into key pages.
- Added story character images: `bianca.webp`, `camille.webp`, `johann.webp`, `lukas.webp`, `pierre.webp`, `pierre_bg.webp`, `pierrecamille.webp`, `roberto.webp`, `robertobianca.webp`, `weissburg.webp`.
- `src/lib/services/finance/loanService.ts` (+798/-69), `src/components/finance/LoansView.tsx` (+42/-15), `src/lib/database/core/loansDB.ts` (+12/-3), `src/lib/constants/loanConstants.ts` (+3) - loan system expansion.
- `src/lib/services/admin/adminService.ts` (+30/-1), `src/lib/services/core/gameTick.ts` (+8/-3), `src/lib/services/user/staffService.ts` (-57), `migrations/sync_vercel_schema.sql` (+6/-1) - supporting system updates.

### Notes
- Foundational systems release that later versions (0.07+) expand with additional starting-condition content.

## Version 0.067-0.067a - Icon System Standardization and UI Alignment
**Date:** 2025-11-10 | **Commit(s):** 7658b7d, bded709 | **Stats:** 571 insertions(+), 142 deletions(-)

### Summary
- Standardized characteristic icon assets and replaced legacy naming conventions.
- Updated multiple UI surfaces to consume the new icon set.
- Performed supporting inventory/customer/order service and type utility updates.

### Changes
- **NEW FILES:** characteristic icons `icon_acidity.png`, `icon_aroma.png`, `icon_body.png`, `icon_spice.png`, `icon_sweetness.png`, `icon_tannins.png`; removed legacy non-prefixed equivalents.
- `src/lib/utils/icons.tsx` (+4/-4) and `src/lib/constants/constants.ts` (+61/-27) - icon reference and constants updates.
- UI updates: `src/components/ui/modals/UImodals/StaffModal.tsx` (+133/-4), `src/components/pages/sales/OrdersTab.tsx` (+47/-12), `src/components/pages/sales/WineCellarTab.tsx` (+26/-5), `src/components/pages/Winery.tsx` (+10/-8).
- Service/data updates: `src/lib/services/sales/generateOrder.ts` (+79/-11), `src/lib/database/activities/inventoryDB.ts` (+59/-1), `src/lib/database/customers/customerDB.ts` (+34/-25), `src/lib/services/wine/winery/inventoryService.ts` (+21/-2), `src/lib/types/types.ts` (+17), `src/lib/utils/utils.ts` (+27).

### Notes
- Primarily a consistency and presentation pass with modest service-side support changes.

## Version 0.066 - Loan Extension and Forced-Loan Mechanics
**Date:** 2025-11-10 | **Commit(s):** b9073ef | **Stats:** 1,094 insertions(+), 99 deletions(-)

### Summary
- Added loan-extension and forced-loan behavior to finance mechanics.
- Updated loan UI/DB/constants to support expanded lender interactions.
- Refreshed grape assets and related winepedia/suitability surfaces.

### Changes
- `src/lib/services/finance/loanService.ts` (+562/-6), `src/lib/constants/loanConstants.ts` (+36), `src/components/finance/LoansView.tsx` (+58/-12), `src/lib/database/core/loansDB.ts` (+9/-3) - extension/forced-loan architecture and UI support.
- Grape icon asset updates converted several varieties from `.webp` to `.png`; **NEW FILE:** `icon_temperanillo.png` added.
- `src/components/ui/modals/UImodals/winepediaGrapeInfoModal.tsx` (+103/-18), `src/components/ui/components/grapeQualityBar.tsx` (+9/-2), `src/components/pages/winepedia/YieldProjectionTab.tsx` (+4/-2) - UI alignment for updated grape/loan context.
- `src/lib/services/vineyard/vineyardValueCalc.ts` (+120/-15), `src/lib/services/core/gameTick.ts` (+10/-6), `src/lib/services/prestige/prestigeService.ts` (+3/-2), `migrations/sync_vercel_schema.sql` (+1) - supporting calculations/schema updates.

### Notes
- This release deepens debt mechanics and ties them more directly to game pressure and progression.

## Version 0.065 - Grape Suitability UX Overhaul
**Date:** 2025-11-10 | **Commit(s):** e6a60e1 | **Stats:** 985 insertions(+), 294 deletions(-)

### Summary
- Replaced legacy grape info view with a comprehensive modal-based suitability experience.
- Expanded difficulty/suitability calculation logic and grape constants.
- Updated grape varieties UI and utility helpers for new presentation model.

### Changes
- **NEW FILE:** `src/components/ui/modals/UImodals/winepediaGrapeInfoModal.tsx` (591 lines) - detailed grape info/suitability modal.
- **REMOVED:** `src/components/pages/winepedia/GrapeInfoView.tsx` (189 lines) - legacy page replaced by modal flow.
- `src/lib/services/wine/features/grapeDifficulty.ts` (+240/-27) and `src/lib/constants/grapeConstants.ts` (+60/-35) - enhanced suitability data and logic.
- `src/components/pages/winepedia/GrapeVarietiesTab.tsx` (+24/-6) and `src/lib/utils/utils.ts` (+24) - UI/helper support.

### Notes
- This change shifts grape detail UX toward context modal interactions rather than full-page panels.

## Version 0.064 - Feature Accumulation and Economy Impact Visibility
**Date:** 2025-11-09 | **Commit(s):** 584ad8f | **Stats:** 132 insertions(+), 37 deletions(-)

### Summary
- Improved wine-feature accumulation behavior and display consistency.
- Surfaced economy-phase impact more clearly in sales and winepedia UI.
- Applied small customer/order-generation adjustments supporting updated displays.

### Changes
- `src/lib/services/wine/features/featureService.ts` (+43/-25) and `src/components/ui/components/FeatureDisplay.tsx` (+2/-2) - feature accumulation/display updates.
- `src/components/pages/sales/OrdersTab.tsx` (+17/-3), `src/components/pages/winepedia/EconomyTab.tsx` (+4), `src/components/ui/components/grapeQualityBar.tsx` (+42/-1) - improved economy impact visibility.
- `src/lib/services/sales/generateCustomer.ts` (+14/-3), `src/lib/services/sales/generateOrder.ts` (+2), `src/lib/services/sales/salesOrderService.ts` (+3/-1) - supporting generation/service updates.

### Notes
- Focused UI-readability release with lightweight service-side changes.

## Version 0.063-0.0632 - Grape Suitability Framework Introduction
**Date:** 2025-11-08 to 2025-11-09 | **Commit(s):** 11bc48d, 89d9976, 5c4cd6b | **Stats:** 829 insertions(+), 135 deletions(-)

### Summary
- Introduced the first grape-difficulty/suitability framework across constants and services.
- Added sun/altitude suitability effects into vineyard value and planting workflows.
- Updated vineyard, quality, prestige, and schema layers to support new suitability model.

### Changes
- **NEW FILE:** `src/lib/services/wine/features/grapeDifficulty.ts` (152 lines) - core difficulty/suitability calculation service.
- `src/lib/constants/grapeConstants.ts` (+172 across commits) and `src/lib/constants/vineyardConstants.ts` (+54/-44) - suitability-related configuration updates.
- `src/lib/services/vineyard/vineyardValueCalc.ts` (+219/-30) - integrated sun/altitude suitability into value calculations.
- UI support: `src/components/ui/modals/UImodals/vineyardModal.tsx` (+71/-11), `src/components/ui/modals/activitymodals/PlantingOptionsModal.tsx` (+27/-5), `src/components/pages/winepedia/YieldProjectionTab.tsx` (+54/-16).
- Supporting updates: `src/lib/services/vineyard/vineyardManager.ts` (+8/-2), `src/lib/services/vineyard/vineyardService.ts` (+16/-3), `src/lib/services/wine/winescore/grapeQualityCalculation.ts` (+20/-4), `src/lib/services/prestige/prestigeService.ts` (+9/-6), `migrations/sync_vercel_schema.sql` (+5/-2).

### Notes
- Foundational grape suitability release; 0.064-0.066 continue UI/logic maturation on top of this base.

For older versions see `docs/versionlog_legacy.md`.
