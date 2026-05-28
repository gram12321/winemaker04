# Core Game Mechanics - Winery Management Game

Last code-verified: 2026-05-27

This document describes the current mainline Winemaker 0.4 implementation. It is an orientation file for agents and maintainers: use it to understand what exists now, where systems live, and which older design ideas are not active runtime behavior.

Design docs under `docs/superpowers/plans/` and `docs/superpowers/specs/` are useful history, but they are not authoritative unless this file, `CONTEXT.md`, `readme.md`, or the code confirms the feature is currently active.

## Current Architecture

- The app is a React, Vite, TypeScript, Tailwind, ShadCN UI, and Supabase single-player management game.
- The simulation advances manually by week through `processGameTick()` in `src/lib/services/core/gameTick.ts`.
- Gameplay rules live in `src/lib/services/`; Supabase access lives in `src/lib/database/`; React components should stay focused on display, UI state, and user interaction.
- Company-scoped play is the core persistence model. Database calls should follow the active-company/current-company flow rather than global state assumptions.
- Feature seams exist under `src/lib/features/`. `loanLender` and `researchUpgrade` are active seams; `boardShare` is currently a no-op shell preserving future share/board integration points.
- Shared gameplay language is current around `structureIndex`, `tasteQualityIndex`, `wineScore`, compact `WineAnchorValues`, company prestige, vineyard prestige, and research unlocks.

## Database And Persistence

Supabase is the persistent store. Database modules are CRUD/mapper layers and should not contain business rules.

Implemented database areas:

- `src/lib/database/core/`: companies, users, game state, staff, teams, transactions, notifications, achievements, highscores, user settings, wine log, research unlocks, loans/lenders, company metric history, board satisfaction history, and share scaffolding.
- `src/lib/database/activities/`: active activities, wine batch inventory, and vineyard persistence.
- `src/lib/database/customers/`: customers, sales orders, relationship boosts, and prestige event ledger rows.
- `src/lib/database/sales/`: contracts, forward contracts, grape buyer/supplier markets, buy-market offers, and buyer/supplier loyalty.
- `src/lib/database/dbMapperUtils.ts`: shared mapping helpers for database row conversions.
- `migrations/`: SQL history for database updates.

Important persistence notes:

- `prestige_events` is the source ledger for prestige; current prestige values should be derived from persisted events and decay logic, not invented locally.
- Wine batches use compact anchor values for hidden wine identity. Database parsing accepts the current compact anchor keys only; do not add legacy-shape fallbacks unless explicitly requested.
- Services that mutate persisted state should trigger global or topic-scoped UI refreshes through the existing update hooks.
- Some public-company/share tables and constants remain as scaffolding from prior work, but the active mainline runtime does not expose a full share market or board gameplay loop.

## Player Interface And UI

The primary router is `src/App.tsx`. It switches between pages and overlays after a company is selected.

Main UI surfaces:

- Layout: `Header`, `ActivityPanel`, `NotificationCenter`, `GlobalSearchResultsDisplay`, and app-level optional feature overlays.
- Pages: `Login`, `CompanyOverview`, `Vineyard`, `Winery`, `Sales`, `Finance`, `Research`, `Staff`, `WeatherCenter`, `WineLog`, `Winepedia`, `Achievements`, `Highscores`, `Profile`, `Settings`, and the dev-gated `AdminDashboard`.
- Sales UI: orders, contracts, and wine cellar tabs under `src/components/pages/sales/`, plus wine assignment and forward/pre-sale contract actions.
- Finance UI: finance statements, cash flow, income/balance views, staff wage summary, loan/lender surfaces, founder panel, and research panel.
- Winepedia UI: reference tabs for countries, regions, grape varieties, customers, customer types, economy, grape buyers, weather, research, winemaking, wine quality, mathematical models, yield projection, and scoring explanations.
- Activity modals: land search/results, planting, clearing, harvest, crushing, fermentation, staff search/results, hiring, staff assignment, sell grapes, and buy from market.
- Domain modals/components: wine, vineyard, staff, prestige, structure index, land value modifier, feature display, taste profile, taste wheel, taste quality breakdown, market offer tables, and constraint displays.

UI rule of thumb: pages and components can orchestrate user actions and presentation, but calculations, validation, persistence, and progression belong in services and database modules.

## Utility And Shared Infrastructure

Shared hooks:

- `useGameState()` and `useGameStateWithData()` provide reactive game-state and async data loading.
- `useGameUpdates()` exposes global and topic-scoped update subscriptions plus debounced refresh triggers.
- `useLoadingState()`, table sorting, customer data, wine price calculation, wine structure/combined score, wine feature details, prestige updates, and relationship updates are shared hook patterns.

Shared utilities:

- `src/lib/utils/calculator.ts`: common game formulas.
- `src/lib/utils/companyUtils.ts`: current-company helpers used by database/service flows.
- `src/lib/utils/colorMapping.ts`, `icons.tsx`, `toast.ts`, `modalState.ts`, and `consistencyUtils.ts`: UI and presentation support.
- `src/lib/constants/`: tunable gameplay definitions for time, grapes, vineyards, wine features, taste labels, contracts, economy, finance, loans, credit rating, shares, staff, research, achievements, and starting conditions.
- Barrel exports in `src/lib/services/index.ts`, `src/lib/constants/index.ts`, `src/lib/database/index.ts`, `src/lib/utils/index.ts`, `src/components/ui/index.ts`, and `src/hooks/index.ts` should be preferred where they match the local pattern.

Testing and dev support:

- Vitest suites under `tests/` cover user flows, wine, vineyard, sales, contracts, prestige, research, finance, staff, and admin/test-lab behavior.
- `/api/test-run` and `server/test-runner.ts` bridge the dev-only automated test runner.
- Admin Test Lab scenarios create inspectable active-company fixture states and clean them up through `testlab_...` run ids.

## Implemented Runtime Systems

### Time, Weather, And Economy

- Game time tracks week, season, and year.
- Weekly tick advances activities, orders, contracts, forward contracts, vines, prestige decay, economy/weather state, and seasonal/yearly finance hooks.
- Economy phases influence finance, contracts, and market behavior.
- Weather has current state, intensity, forecast pattern, forecast confidence, and next-week forecast fields.
- Weather affects grape market price/limit pressure and vineyard health/ripeness deviations.
- Weather Center summarizes current vineyard weather impact through `weatherCenterService.ts` and `WeatherCenter.tsx`.
- Winepedia includes weather reference material.

Deferred weather layers:

- Severe weather event chains, player response actions, weather research upgrades, and weather achievements are future work.

### Vineyard

- Land search, vineyard buying, planting, clearing, uprooting/replanting pressure, health, overgrowth, ripeness, vine age, and yield calculation are implemented.
- Vineyard suitability uses country/region, altitude, aspect, soil, grape metadata, density, health, and ripeness.
- Vineyard weather impact is deterministic and explainable through `weatherImpactService.ts` and `weatherCenterService.ts`.
- Research gates enforce vineyard size, total-hectare, and vineyard-count caps.
- Vineyard prestige contributes to land value modifier, vineyard pricing, achievements, and UI presentation.

### Wine Production, Structure, And Taste

- Wine batches progress through grapes, must, wine, and bottled states.
- Production includes crushing, fermentation method, fermentation temperature, fermentation progress, aging, and bottling flows.
- `WineAnchorValues` provide hidden wine identity; visible characteristics and scoring are derived from the current anchor model and process effects.
- Structure uses six channels: acidity, aroma, body, spice, sweetness, and tannins.
- `structureIndex` scores physical balance through dynamic ranges, penalties, and synergies.
- Taste uses 14 flavor families plus descriptor display values.
- `tasteQualityIndex` scores family-level taste balance; descriptors remain display-only.
- `wineScore` is currently `(tasteQualityIndex + structureIndex) / 2`.
- Wine features are config-driven and include positive features, faults, lifecycle effects, oxidation, terroir, stuck fermentation, bottle aging, late harvest, green flavor, grey rot, and noble rot.

Deferred wine layers:

- Storage vessels and detailed cellar/container logistics are not implemented.
- Descriptor-level scoring and customer taste preferences remain deferred until structure and taste can share a unified preference layer.

### Sales, Contracts, Grape Markets, And Forward Pre-sales

- Regional customer generation, customer traits, orders, relationship tracking, partial fulfillment, and rejection are implemented.
- Contract sales support taste, structure, site, grape, color, vintage, and characteristic requirements.
- Taste/site split is active: `tasteQuality` validates computed taste quality, while `landValue`, `country`, `region`, `altitude`, and `aspect` validate site/origin requirements.
- Sell-side grape market is implemented through `sellGrapesService.ts`, `grapeBuyerMarketService.ts`, and buyer loyalty.
- Buy-side grape market is implemented through `buyGrapeMarketService.ts`, supplier market services, buy-market offers, and supplier loyalty.
- Bulk fallback channels and seasonal buyers/suppliers exist.
- Grape market pricing and seasonal hard limits respond to season, economy phase, weather state/intensity, grape/state quality, relationships, and research unlocks.
- Bulk grape achievements and research gates are wired into achievement and research services.

Forward pre-sale contracts are implemented:

- They are generated by bulk/NPC buyers through `forwardContractService.ts`, not by converting customer orders.
- They can target bottled wine, grapes, `must_ready`, or `must_fermenting` inventory.
- Quantity and price scale with company value, prestige, buyer market profile, season/economy context, and relationship effects.
- Runtime supports generation, acceptance, rejection, delivery, expiration, and default handling.
- Finance uses forward-advance, final-settlement, and default-penalty transaction categories.
- Contracts tab displays the offers with unit labeling for kg or bottles.
- Admin/Test Lab scenarios can generate bottled pre-sale and grape forward contracts.

Remaining market work:

- Bottle-market saturation and broad dynamic consumer demand are not implemented.
- Forward/pre-sale contracts are active; remaining work here is balancing, UX refinement, and any deeper lifecycle rules, not basic implementation.

### Finance, Loans, Founder Economy, And Board/Share Status

- Transactions, income statements, balance sheets, cash flow, asset valuation, and finance UI are implemented.
- Loan/lender gameplay is active through the `loanLender` feature seam.
- Founder economy is implemented as a light ownership slice:
  - starting staff can be founders through `isFounder`;
  - founders have zero wages;
  - founders receive yearly Founder Return distributions when yearly net profit is positive;
  - founders can be bought out and converted to salaried staff;
  - `FounderPanel.tsx` shows active founders and buyout controls.
- Full public-company/share-market runtime is not active in mainline. The codebase currently keeps board/share database scaffolding, share constants, and a no-op `boardShare` feature shell.
- `docs/superpowers/plans/PublicCompanyPlan.md` and `docs/superpowers/plans/PublicCompanyImplementation.md` are preserved as historical implemented-feature and possible reintroduction references. They should not be read as active current runtime behavior.

### Staff And Activities

- Staff recruitment, team management, specializations, wage calculation, assignments, and staff search are implemented.
- Activity lifecycle and work calculators cover vineyard, winery, staff, finance, loan, and research flows.
- Research starts as activity work and uses the shared work/cost calculation pattern.
- Staff skills contribute to work completion through the established activity manager and work calculator flow.

### Research

- Research catalog, project categories, complexity, work profiles, prerequisites, prestige gates, company-value gates, buyer-loyalty gates, achievement gates, costs, and completion persistence are implemented.
- Research UI has Active Research Effects, Research Footprint, and Catalog tabs.
- Catalog supports in-progress, locked, available, completed, admin-bypass, and Hide completed states.
- Starting conditions can apply regional `startingResearch` pre-unlocks.
- Implemented unlock enforcement includes:
  - grape planting unlocks;
  - fermentation technology unlocks;
  - staff cap;
  - vineyard size, total hectare, and vineyard count caps;
  - contract channel access;
  - grape buyer market unlocks and scaling effects.
- Permanent research effects are aggregated through `researchPermanentEffectsService.ts`; the currently shipped gameplay effect is `vineyard_health_decay_multiplier`.

Research limitations:

- Equipment gameplay is not implemented.
- Dedicated vineyard-technique projects/hooks are still future work.
- `wine_feature` project typing exists, but there is no full project/enforcement track yet.
- Some `benefits` copy remains aspirational; use `unlocks` and `permanentEffects` as authoritative gameplay effects.
- `tests/user/researchPanelVisibility.test.ts` has known failing visibility expectations from the research UI backlog.

### Prestige, Achievements, And Highscores

- `prestige_events` is the source ledger for company and vineyard prestige.
- Permanent rows and decaying rows are both implemented.
- Weekly prestige decay is active.
- Company value, vineyard factors, cellar collection, sales, contracts, features, achievements, research, loans/bookkeeping, and admin tools can write prestige rows.
- Prestige balance has been tuned for achievement tiers, feature sale severity, vineyard sale caps, contract feature prestige, and loan penalties.
- Achievements include wine score, company progression, vineyard progression, and bulk grape market milestones.
- Highscores use persisted historical outputs rather than recalculating from mutable current state.

### Admin And Testing Tools

- Admin Dashboard is dev-only and loopback-gated.
- Admin Test Systems separate the shared automated Vitest suite from Gameflow Lab fixture/scenario tools.
- Gameflow Lab creates inspectable active-company fixture states and supports durable cleanup through `testlab_...` run ids.

## Current Not-Yet-Implemented Or Partial Areas

- Active full public-company/share-market runtime.
- Storage vessel/container management.
- Equipment gameplay and upgrades beyond placeholders/design.
- Dedicated advanced farming methods such as organic/biodynamic systems.
- Bottle-market saturation and broad consumer demand simulation.
- Customer taste preference matching.
- Severe weather events, mitigation actions, weather achievements, and weather research upgrades.
- Descriptor-level taste scoring.
- Full `wine_feature` research project/enforcement track.

## Main File Map

| Area | Main locations |
|---|---|
| App routing/layout | `src/App.tsx`, `src/components/layout/` |
| Shared hooks | `src/hooks/` |
| Shared utilities | `src/lib/utils/` |
| Game constants | `src/lib/constants/` |
| Database layer | `src/lib/database/` |
| Core state/tick | `src/lib/services/core/` |
| Activity lifecycle/work | `src/lib/services/activity/`, `src/components/ui/activities/` |
| Vineyard | `src/lib/services/vineyard/`, `src/components/pages/Vineyard.tsx`, vineyard modals |
| Weather | `src/lib/services/finance/weatherService.ts`, `src/lib/services/vineyard/weatherImpactService.ts`, `src/lib/services/vineyard/weatherCenterService.ts`, `src/components/pages/WeatherCenter.tsx` |
| Wine production | `src/lib/services/wine/`, `src/components/pages/Winery.tsx`, wine modals |
| Wine scoring/taste | `src/lib/wineStructure/`, `src/lib/services/wine/taste/`, `src/lib/services/wine/winescore/`, wine score UI components |
| Sales/orders/contracts | `src/lib/services/sales/`, `src/components/pages/Sales.tsx`, `src/components/pages/sales/` |
| Grape markets | `sellGrapesService.ts`, `buyGrapeMarketService.ts`, grape buyer/supplier market and loyalty services, market modals |
| Forward pre-sales | `src/lib/services/sales/forwardContractService.ts`, `src/lib/database/sales/forwardContractDB.ts`, `src/components/pages/sales/ContractsTab.tsx` |
| Finance/founder | `src/lib/services/finance/`, `src/components/finance/`, `src/lib/services/user/staffService.ts` |
| Loans/lenders | `src/lib/features/loanLender/` |
| Board/share seam | `src/lib/features/boardShare/`, share and board database scaffolding |
| Research | `src/lib/constants/researchConstants.ts`, `src/lib/services/research/`, `src/lib/features/researchUpgrade/`, `src/components/pages/Research.tsx` |
| Prestige | `src/lib/services/prestige/`, `src/lib/database/customers/prestigeEventsDB.ts` |
| Achievements/highscores | `src/lib/services/user/achievementService.ts`, `highscoreService.ts`, achievement/highscore DB modules and pages |
| Admin test lab | `src/components/pages/admin/TestLabPage.tsx`, `src/lib/services/admin/testLab/`, `server/test-runner.ts` |
| Tests | `tests/` |
