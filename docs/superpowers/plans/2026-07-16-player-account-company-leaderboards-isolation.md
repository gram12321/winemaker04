# User, Company, and Leaderboards Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate player identity/profile/preferences, company records, and global leaderboards behind small installed feature facades while preserving playable unowned companies.

**Architecture:** Split the current mixed `services/user/` area into three domains. `userFeature` owns optional player identity, profile, wallet, company-scoped UI preferences, and account-facing UI; `companyFeature` owns company records and explicit ownership association but not active-game state; `leaderboardsFeature` owns score recording, read models, and leaderboard UI. `App` and core game state remain the composition host and own the active-company lifecycle.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Supabase, existing installed-feature facade pattern.

## Phase 1 implementation decision

Phase 1 is implemented as `features/user`, not `features/playerAccount`. Its public surface is intentionally capability-based: `account`, `wallet`, `preferences`, and `ui`. Consumers import only `userFeature` from `@/lib/features/user`; they never import its services or database row types. Company creation accepts an explicit optional `userId` only—omitting it creates a fully supported anonymous company. The historical names in the task-by-task notes below describe the original proposal; this decision and the target structure above are authoritative.

---

## Scope and invariants

- A company may have an owner (`user_id`) or be unowned (`user_id = NULL`). Both are first-class, supported modes; no owner is fabricated for an unowned company.
- A player may own many companies. Selecting one company does not sign a player in or out.
- The active company is application/core session state, not player-account state. Feature APIs receive an explicit `playerId` or `companyId` for persisted operations.
- No compatibility barrels or old service-path re-exports remain after a caller has been migrated. Update every in-repository caller in the same task.
- `Header.tsx` remains the app shell. It navigates by page ID; `App.tsx` renders feature-owned pages through their public facade.
- Feature-internal UI may depend on its own facade/services. Consumers import only `@/lib/features/<feature>`.

## Target file structure

### Phase 1 — user (this execution)

| Path | Responsibility |
| --- | --- |
| `src/lib/features/playerAccount/index.ts` | Thin public barrel for one feature value and public types. |
| `src/lib/features/playerAccount/featureTypes.ts` | Player-account facade contract and UI input types. |
| `src/lib/features/playerAccount/feature.tsx` | Static composition; lazy account pages; no business rules. |
| `src/lib/features/playerAccount/services/playerIdentityService.ts` | Supabase-session and locally selected player identity; profile CRUD. |
| `src/lib/features/playerAccount/services/playerWalletService.ts` | Explicit-player wallet reads and mutations. |
| `src/lib/features/playerAccount/services/companyPreferencesService.ts` | Company-scoped toast preference with no player-owner requirement. |
| `src/lib/features/playerAccount/ui/ProfilePage.tsx` | Existing profile/portfolio UI moved behind the facade. |
| `src/lib/features/playerAccount/ui/SettingsPage.tsx` | Existing settings UI moved behind the facade and connected to company preferences. |
| `tests/features/playerAccount/playerIdentityService.test.ts` | Session/local-player selection and profile operation regressions. |
| `tests/features/playerAccount/companyPreferencesService.test.ts` | Company-scoped preferences and unowned-company behavior. |

### Phase 2 — company records and active-company lifecycle

| Path | Responsibility |
| --- | --- |
| `src/lib/features/company/index.ts`, `feature.ts`, `featureTypes.ts` | Public company-record facade. |
| `src/lib/features/company/services/companyService.ts` | Explicit-owner company CRUD and portfolio summaries. |
| `src/lib/features/company/ui/CompanyGateway.tsx` | Company/user selection and creation portions extracted from Login. |
| `src/lib/services/core/gameState.ts` | Active-company session only; calls company facade rather than a user service. |
| `src/lib/services/core/notificationService.ts` | Reset/reload company-bound caches on activation. |

### Phase 3 — leaderboards

| Path | Responsibility |
| --- | --- |
| `src/lib/features/leaderboards/index.ts`, `feature.tsx`, `featureTypes.ts` | Public leaderboard facade. |
| `src/lib/features/leaderboards/services/leaderboardService.ts` | Score recording, ranking rules, labels, and read models. |
| `src/lib/features/leaderboards/ui/LeaderboardsPage.tsx` | Moved Highscores page. |
| `src/lib/features/leaderboards/ui/LeaderboardSummary.tsx` | Reusable Login summary. |
| `src/lib/database/core/highscoresDB.ts` | Atomic, score-type-aware persistence queries. |
| `migrations/` (new timestamped highscore-invariants migration, if needed) | Current-shape aggregate uniqueness and ordering support, if database inspection confirms it is required. |

## Phase 1: Player account feature

### Task 1: Establish the public contract

**Files:**

- Create: `src/lib/features/playerAccount/featureTypes.ts`
- Create: `src/lib/features/playerAccount/index.ts`
- Test: `tests/features/playerAccount/playerAccountFacade.test.ts`

- [ ] **Step 1: Write the failing facade-shape test.**

  Assert that `playerAccountFeature` exposes exactly `identity`, `wallet`, `preferences`, and `ui`, and that no consumer must import a feature-internal service.

- [ ] **Step 2: Run the focused test.**

  Run: `npm test -- tests/features/playerAccount/playerAccountFacade.test.ts`

  Expected: FAIL because `@/lib/features/playerAccount` does not exist.

- [ ] **Step 3: Define the contract and barrel.**

  Use these stable signatures:

  ```ts
  export interface PlayerAccountFeature {
    identity: {
      getCurrentPlayer(): PlayerProfile | null;
      onPlayerChange(listener: (player: PlayerProfile | null) => void): () => void;
      getPlayer(playerId: string): Promise<PlayerProfile | null>;
      createLocalPlayer(name: string): Promise<OperationResult<PlayerProfile>>;
      selectLocalPlayer(player: PlayerProfile | null): void;
      updatePlayer(playerId: string, updates: PlayerProfileUpdate): Promise<OperationResult>;
      deletePlayer(playerId: string): Promise<OperationResult>;
      isAuthenticatedSession(): boolean;
      signOut(): Promise<OperationResult>;
    };
    wallet: {
      getBalance(playerId: string): Promise<number>;
      updateBalance(playerId: string, amount: number): Promise<WalletOperationResult>;
      setBalance(playerId: string, amount: number): Promise<WalletOperationResult>;
    };
    preferences: {
      getCompanyPreferences(companyId: string): CompanyPreferences;
      setToastNotifications(companyId: string, enabled: boolean): void;
    };
    ui: {
      renderProfilePage(input: PlayerProfilePageInput): ReactElement;
      renderSettingsPage(input: PlayerSettingsPageInput): ReactElement;
    };
  }
  ```

  `PlayerProfile` replaces the public `AuthUser` name. It represents a row in `users`; a Supabase session is optional transport/authentication state, not the player entity itself.

- [ ] **Step 4: Rerun the focused test.**

  Run: `npm test -- tests/features/playerAccount/playerAccountFacade.test.ts`

  Expected: PASS.

### Task 2: Move and normalize player identity

**Files:**

- Create: `src/lib/features/playerAccount/services/playerIdentityService.ts`
- Modify: `src/lib/database/core/usersDB.ts`
- Modify: `src/lib/features/playerAccount/feature.tsx`
- Modify: `src/components/pages/Login.tsx`
- Modify: `src/lib/services/user/companyService.ts` (temporary public-facade consumer until Phase 2 moves it)
- Modify: `src/lib/features/admin/feature.tsx`
- Test: `tests/features/playerAccount/playerIdentityService.test.ts`
- Delete: `src/lib/services/user/authService.ts`

- [ ] **Step 1: Write failing identity tests.**

  Cover: a newly created local player becomes the selected player and notifies listeners; selecting `null` supports unowned-company browsing; an authenticated Supabase session loads the matching player; profile update/delete take an explicit player ID.

- [ ] **Step 2: Run the focused test.**

  Run: `npm test -- tests/features/playerAccount/playerIdentityService.test.ts`

  Expected: FAIL because the implementation is absent.

- [ ] **Step 3: Implement identity without split local/session state.**

  Keep one `currentPlayer` and listener list. Supabase authentication events load and select their player; `createLocalPlayer()` and `selectLocalPlayer()` use the same state mechanism. Directly import `notificationService` from its module, not from the broad services barrel, to avoid module initialization cycles.

  `Login.tsx` must use `playerAccountFeature.identity` for subscriptions, profile lookup, local-player creation, and selecting a discovered company owner. Its unowned-company list remains visible when `getCurrentPlayer()` is `null`.

  `companyService.createCompany()` may temporarily obtain an omitted owner through `playerAccountFeature.identity.getCurrentPlayer()` only until Phase 2 removes implicit ownership; do not add a compatibility wrapper for `authService`.

- [ ] **Step 4: Replace public database naming where necessary.**

  Rename the exported user-row view from `AuthUser` to `PlayerProfile` and update every caller. Keep `usersDB.ts` strictly CRUD/mapping; session behavior lives only in the feature service.

- [ ] **Step 5: Run identity and existing company tests.**

  Run: `npm test -- tests/features/playerAccount/playerIdentityService.test.ts tests/user/companyService.test.ts`

  Expected: PASS after updating the company test to mock the public player-account facade rather than an internal identity service.

### Task 3: Move wallet operations behind the account facade

**Files:**

- Create: `src/lib/features/playerAccount/services/playerWalletService.ts`
- Modify: `src/lib/features/playerAccount/feature.tsx`
- Modify: `src/lib/services/core/startingConditionsService.ts`
- Modify: `src/components/ui/modals/UImodals/StartingConditionsModal.tsx`
- Modify: `src/lib/features/admin/services/adminService.ts`
- Test: `tests/features/playerAccount/playerWalletService.test.ts`
- Delete: `src/lib/services/user/userBalanceService.ts`

- [ ] **Step 1: Write failing wallet tests.**

  Verify explicit-player reads, rejected negative balances, and an unowned company path that does not call wallet methods.

- [ ] **Step 2: Implement `wallet.getBalance`, `updateBalance`, and `setBalance`.**

  Require `playerId` in every public method. Do not fall back to the current player. Preserve current error/result semantics while moving database access to the feature service.

- [ ] **Step 3: Update the starting-conditions and Admin consumers.**

  The starting-conditions workflow obtains `company.userId` explicitly. It skips wallet operations for an unowned company; it never asks the wallet service to infer an owner.

- [ ] **Step 4: Run focused tests.**

  Run: `npm test -- tests/features/playerAccount/playerWalletService.test.ts tests/admin/testLabBehavior.test.ts`

  Expected: PASS.

### Task 4: Consolidate active company preferences and move account UI

**Files:**

- Create: `src/lib/features/playerAccount/services/companyPreferencesService.ts`
- Create: `src/lib/features/playerAccount/ui/ProfilePage.tsx`
- Create: `src/lib/features/playerAccount/ui/SettingsPage.tsx`
- Modify: `src/lib/features/playerAccount/feature.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/services/core/notificationService.ts`
- Modify: `src/components/pages/Login.tsx`
- Delete: `src/components/pages/Profile.tsx`
- Delete: `src/components/pages/Settings.tsx`
- Delete: `src/lib/services/user/userSettingsService.ts`
- Delete: `src/lib/database/core/userSettingsDB.ts`
- Modify: `src/lib/database/index.ts`
- Modify: `src/lib/services/index.ts`
- Test: `tests/features/playerAccount/companyPreferencesService.test.ts`
- Test: `tests/features/playerAccount/playerAccountUiWiring.test.tsx`

- [ ] **Step 1: Write failing preference tests.**

  Assert that `companyId` is the only preference key, two companies have independent toast settings, and settings work when there is no selected player.

- [ ] **Step 2: Implement the current-shape preference store.**

  Use one local-storage key format, `player_account_preferences:<companyId>`, with `{ toastNotifications: boolean }`. Default to `true`. Do not read or translate the old `settings_*`, `company_settings_*`, or global `showNotifications` keys.

- [ ] **Step 3: Move pages without changing their visual behavior.**

  Move `Profile.tsx` and `Settings.tsx` into the feature UI folder. Replace direct calls to user services with the facade capabilities. `App.tsx` renders both routes through `playerAccountFeature.ui`; `Header.tsx` remains unchanged except for normal navigation IDs.

- [ ] **Step 4: Make toast display honor company preferences.**

  In `notificationService.addMessage`, resolve the active company ID once and query `companyPreferencesService`. Preserve notification persistence and filtering behavior. Do not use a global toast switch.

- [ ] **Step 5: Remove the unused persisted user-settings code.**

  Remove the dead service, CRUD adapter, and barrel exports only after repository-wide search confirms no imports remain. Do not add a database migration in Phase 1; table removal is a separate, explicitly authorized data-cleanup decision.

- [ ] **Step 6: Run focused UI and preference tests.**

  Run: `npm test -- tests/features/playerAccount/companyPreferencesService.test.ts tests/features/playerAccount/playerAccountUiWiring.test.tsx`

  Expected: PASS.

### Task 5: Phase 1 integration and hygiene

**Files:**

- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Test: `tests/admin/adminHostWiring.test.ts`
- Test: `tests/user/companyService.test.ts`

- [ ] **Step 1: Add integration tests.**

  Test an unowned company from Login through selection and Settings; test a local player with two companies and independent preferences; test that no production code imports the deleted `services/user/authService`, `userBalanceService`, or `userSettingsService` paths.

- [ ] **Step 2: Update architecture documentation.**

  Document that `playerAccountFeature` owns identity/profile/wallet/company-scoped preferences and feature-owned Profile/Settings pages, while company ownership remains optional.

- [ ] **Step 3: Run Phase 1 verification.**

  Run: `npm test -- tests/features/playerAccount tests/user/companyService.test.ts tests/admin/adminHostWiring.test.ts`

  Expected: PASS.

- [ ] **Step 4: Run repository verification for the completed phase.**

  Run: `npm test`

  Expected: PASS.

  Run: `npm run build`

  Expected: PASS with no new circular-chunk warning.

  Run: `git diff --check`

  Expected: no output.

## Phase 2: Company feature

**Implemented shape:** `companyFeature.records` is the only company-record API for callers. It accepts `ownerId?: string` explicitly, never reads player state, and has no lender dependency. App owns the cross-feature creation workflow (record creation, lender initialization, then activation); core game state owns only the active-company lifecycle and invokes public cache lifecycle hooks.

### Task 6: Isolate explicit company records

**Files:**

- Create: `src/lib/features/company/index.ts`
- Create: `src/lib/features/company/featureTypes.ts`
- Create: `src/lib/features/company/feature.ts`
- Create: `src/lib/features/company/services/companyRecordService.ts`
- Modify: `src/lib/services/core/gameState.ts`
- Modify: `src/lib/services/core/startingConditionsService.ts`
- Modify: `src/lib/services/sales/buyGrapeMarketService.ts`
- Modify: `src/components/ui/modals/activitymodals/SellGrapesModal.tsx`
- Modify: Admin/Test Lab company consumers
- Delete: `src/lib/services/user/companyService.ts`
- Test: `tests/features/company/companyRecordService.test.ts`

- [ ] **Step 1: Write tests for explicit ownership.**

  Include `create({ name, ownerId: undefined })`, `listForOwner(playerId)`, and no owner inference from identity state.

- [ ] **Step 2: Implement the company-record facade.**

  Keep `companiesDB.ts` as CRUD. `companyFeature.records.create()` accepts `ownerId?: string`; it must not create a player and must not initialize lenders.

- [ ] **Step 3: Move cross-feature setup to host composition.**

  After a successful company creation, the host workflow invokes `loanLenderFeature.setup.initializeLenders(company.id)` explicitly. This removes Company → Loan feature coupling.

- [ ] **Step 4: Migrate callers and delete the old service.**

  Replace every direct `companyService` import with `companyFeature` public calls. Preserve unowned-company flow in Login and starting conditions.

- [ ] **Step 5: Verify.**

  Run company-focused tests, then `npm test`, `npm run build`, and `git diff --check`.

### Task 7: Make company switching a lifecycle boundary

**Files:**

- Modify: `src/lib/services/core/gameState.ts`
- Modify: `src/lib/services/core/notificationService.ts`
- Modify: company-scoped caches identified by search (finance transactions at minimum)
- Test: `tests/core/companySwitchLifecycle.test.ts`

- [ ] **Step 1: Write a switch regression test.**

  Activate company A, load notification and finance-derived state, activate company B, and assert that B cannot see A’s cached values.

- [ ] **Step 2: Add an explicit reset/reload hook for each cache.**

  `setActiveCompany()` invokes only public cache-lifecycle hooks. It must not reach into feature internals.

- [ ] **Step 3: Verify.**

  Run the new lifecycle test and relevant notification/finance suites.

## Phase 3: Leaderboards feature

### Task 8: Isolate recording and presentation

**Files:**

- Create: `src/lib/features/leaderboards/index.ts`
- Create: `src/lib/features/leaderboards/featureTypes.ts`
- Create: `src/lib/features/leaderboards/feature.tsx`
- Create: `src/lib/features/leaderboards/services/leaderboardService.ts`
- Create: `src/lib/features/leaderboards/ui/LeaderboardsPage.tsx`
- Create: `src/lib/features/leaderboards/ui/LeaderboardSummary.tsx`
- Modify: `src/lib/services/core/gameTick.ts`
- Modify: `src/lib/services/user/wineLogService.ts` (or its future wine-log owner)
- Modify: `src/components/pages/CompanyOverview.tsx`
- Modify: `src/components/pages/Login.tsx`
- Delete: `src/lib/services/user/highscoreService.ts`
- Delete: `src/components/pages/Highscores.tsx`
- Test: `tests/features/leaderboards/leaderboardService.test.ts`

- [ ] **Step 1: Write ranking and recording tests.**

  Cover all score-type labels/units, lowest-price ascending rank, tie handling, company aggregate replacement, wine/vineyard entry insertion, and public facade shape.

- [ ] **Step 2: Move service and UI behind the facade.**

  `gameTick` and wine-log production record results through `leaderboardsFeature.record`; Company Overview and Login use `views` or feature UI, never a service implementation.

- [ ] **Step 3: Correct persistence semantics.**

  Make aggregate score persistence atomic and make ranking queries score-type-aware. Add only current-shape database constraints confirmed by the checked-in migration/schema tooling.

- [ ] **Step 4: Verify.**

  Run leaderboard, tick, wine-log, and UI tests, then the full verification commands.

## Phase 4: Completion and cleanup

### Task 9: Boundary audit, documentation, and handoff

**Files:**

- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `CONTEXT.md` only if player/company vocabulary changes

- [ ] **Step 1: Search for forbidden imports.**

  Run: `rg -n "services/user/(authService|companyService|highscoreService|userBalanceService|userSettingsService)" src tests`

  Expected: no production imports after all phases are complete.

- [ ] **Step 2: Perform the repository sanitation sweep.**

  Check for feature internals imported by consumers, persistence outside `src/lib/database`, business logic left in moved UI, duplicated preferences stores, and hardcoded game tuning.

- [ ] **Step 3: Run final verification.**

  Run: `npm test && npm run build && git diff --check`

  Expected: all commands succeed.

- [ ] **Step 4: Update project ownership docs.**

  Record all three installed feature facades, their host boundaries, and the supported unowned-company invariant.

## Plan self-review

- Coverage: Phase 1 covers player identity/profile/wallet/preferences and Profile/Settings UI; Phase 2 covers company records, ownership, and active-company caches; Phase 3 covers leaderboards; Phase 4 covers documentation and hygiene.
- Scope: The work is deliberately decomposed into independently releasable feature slices. Phase 1 does not prematurely move company CRUD or leaderboards.
- Consistency: `PlayerProfile`, `playerId`, `companyId`, `playerAccountFeature`, `companyFeature`, and `leaderboardsFeature` use the same names throughout. Unowned-company behavior is explicit in each affected phase.
