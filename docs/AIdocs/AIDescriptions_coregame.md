# Core Game Mechanics - Winery Management Game

Last code-verified: 2026-05-25

This document describes the mechanics that are currently implemented in the mainline Winemaker 0.4 codebase. Historical or archived feature designs are called out separately when they are useful reintroduction references but not active runtime behavior.

## Core Architecture

- React, Vite, TypeScript, Tailwind, ShadCN UI, and Supabase.
- Manual week-based progression through `processGameTick()` in `src/lib/services/core/gameTick.ts`.
- Company-scoped persistence through `src/lib/database/` and current-company flows.
- Business logic lives under `src/lib/services/`; React pages/components orchestrate UI state and interaction.
- Feature seams exist under `src/lib/features/` for systems that can be active or no-op, notably `loanLender`, `researchUpgrade`, and `boardShare`.

## Implemented Gameplay Systems

### Time, Weather, And Economy

- Game time tracks week, season, and year.
- Weekly tick advances activities, orders, vines, prestige decay, economy/weather state, and yearly/seasonal finance hooks.
- Economy phases are modeled and influence finance/market behavior.
- Weather has current state, intensity, forecast pattern, forecast confidence, and next-week forecast fields.
- Weather affects grape market price/limit pressure and vineyard health/ripeness deviations.
- Weather Center UI (`src/components/pages/WeatherCenter.tsx`) summarizes current vineyard weather impact.
- Weather reference UI exists in Winepedia.

Deferred weather work:

- Severe weather event chains, player response actions, research/weather upgrades, and weather achievements are still future layers.

### Vineyard

- Land search, vineyard buying, planting, clearing, uprooting/replanting pressure, health, overgrowth, ripeness, vine age, and yield calculation are implemented.
- Vineyard suitability uses country/region, altitude, aspect, soil, grape metadata, health, density, and ripeness.
- Vineyard weather impact is deterministic and explainable through `src/lib/services/vineyard/weatherImpactService.ts` and `weatherCenterService.ts`.
- Research gates enforce vineyard size, total-hectare, and vineyard-count caps.
- Vineyard prestige contributes to land value modifier, pricing, achievements, and UI.

### Wine Production

- Wine batches progress through grapes, must, wine, and bottled states.
- Processing uses crushing, fermentation method, fermentation temperature, progress, aging, and bottling flows.
- Compact `WineAnchorValues` represent hidden wine identity; database parsing accepts only the current compact anchor keys.
- Structure uses six channels: acidity, aroma, body, spice, sweetness, and tannins.
- `structureIndex` scores physical balance through dynamic ranges, penalties, and synergies.
- Taste uses 14 flavor families plus descriptor display values.
- `tasteQualityIndex` scores family-level taste balance; descriptors remain display-only.
- `wineScore` is currently `(tasteQualityIndex + structureIndex) / 2`.
- Wine features are config-driven and include positive features, faults, lifecycle effects, oxidation, terroir, stuck fermentation, bottle aging, late harvest, green flavor, grey rot, and noble rot.

Deferred wine work:

- Storage vessels and detailed cellar/container logistics are not implemented.
- Descriptor-level scoring and customer taste preferences remain deferred until structure and taste can share a unified preference layer.

### Sales, Contracts, And Grape Markets

- Customer generation, regional customer traits, orders, relationship tracking, partial fulfillment, and rejection are implemented.
- Contract sales support taste, structure, site, grape, color, vintage, and characteristic requirements.
- Taste/site split is active: `tasteQuality` validates computed taste quality, while `landValue`, `country`, `region`, `altitude`, and `aspect` validate site/origin requirements.
- Sell-side grape market is implemented through `sellGrapesService.ts`, `grapeBuyerMarketService.ts`, and buyer loyalty.
- Buy-side grape market is implemented through `buyGrapeMarketService.ts`, supplier market services, and supplier loyalty.
- Bulk fallback channels and seasonal buyers/suppliers exist.
- Grape market pricing and seasonal hard limits respond to season, economy phase, weather state/intensity, grape/state quality, relationships, and research unlocks.
- Bulk grape achievements and research gates are wired into achievement and research services.

Deferred market work:

- Bottle-market saturation and broader dynamic consumer demand over time are not implemented.
- Harvest-forward and pre-sale contract mechanics are design-stage only.

### Finance, Loans, Founder Economy, And Board/Share Status

- Transactions, income statements, balance sheets, cash flow, asset valuation, and finance UI are implemented.
- Loan/lender gameplay is active through the `loanLender` feature seam.
- Founder economy is implemented as a light ownership slice:
  - starting staff can be founders via `isFounder`;
  - founders have zero wages;
  - founders receive yearly Founder Return distributions when yearly net profit is positive;
  - founders can be bought out and converted to salaried staff;
  - `FounderPanel.tsx` shows active founders and buyout controls.
- Public-company/share-market runtime is not active in mainline. The repo currently has board/share data scaffolding, share constants, and a no-op `boardShare` feature shell.
- `docs/superpowers/plans/PublicCompanyPlan.md` and `docs/superpowers/plans/PublicCompanyImplementation.md` are preserved as historical implemented-feature and reintroduction references.

### Staff And Activities

- Staff recruitment, teams, specializations, wage calculation, assignments, and staff search are implemented.
- Activity lifecycle and work calculators cover vineyard, winery, staff, finance, loan, and research flows.
- Research starts as activity work and uses the shared work/cost calculation pattern.

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
- Permanent research effects are aggregated through `researchPermanentEffectsService.ts`; the current shipped gameplay effect is `vineyard_health_decay_multiplier`.

Research limitations:

- Equipment gameplay is not implemented.
- Dedicated vineyard-technique projects/hooks are still future work.
- `wine_feature` project typing exists, but there is no full project/enforcement track yet.
- Some `benefits` copy remains aspirational; use `unlocks` and `permanentEffects` as authoritative gameplay effects.
- `tests/user/researchPanelVisibility.test.ts` currently has known failing visibility expectations from the research UI backlog.

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
- `/api/test-run` provides the server-side automated test runner bridge.
- Gameflow Lab creates inspectable active-company fixture states and supports durable cleanup through `testlab_...` run ids.

## Current Not-Yet-Implemented Or Deferred Areas

- Active full public-company/share-market runtime.
- Storage vessel/container management.
- Equipment gameplay and upgrades beyond placeholders/design.
- Dedicated advanced farming methods such as organic/biodynamic systems.
- Bottle-market saturation and broad consumer demand simulation.
- Customer taste preferences.
- Severe weather events, mitigation actions, weather achievements, and weather research upgrades.
- Harvest-forward and wine pre-sale contracts.
- Descriptor-level taste scoring.

## Architecture Map

| Area | Main locations |
|---|---|
| Core state/tick | `src/lib/services/core/` |
| Vineyard | `src/lib/services/vineyard/`, `src/components/pages/Vineyard.tsx` |
| Weather | `src/lib/services/finance/weatherService.ts`, `src/lib/services/vineyard/weatherImpactService.ts`, `src/components/pages/WeatherCenter.tsx` |
| Wine production | `src/lib/services/wine/`, `src/components/pages/Winery.tsx` |
| Wine scoring/taste | `src/lib/wineStructure/`, `src/lib/services/wine/taste/`, `src/lib/services/wine/winescore/` |
| Sales/contracts/grape market | `src/lib/services/sales/`, `src/components/pages/sales/`, `src/components/ui/modals/activitymodals/SellGrapesModal.tsx`, `BuyFromMarketModal.tsx` |
| Finance/founder | `src/lib/services/finance/`, `src/components/finance/`, `src/lib/services/user/staffService.ts` |
| Loans | `src/lib/features/loanLender/` |
| Research | `src/lib/constants/researchConstants.ts`, `src/lib/services/research/`, `src/lib/features/researchUpgrade/`, `src/components/pages/Research.tsx` |
| Prestige | `src/lib/services/prestige/`, `src/lib/database/customers/prestigeEventsDB.ts` |
| Admin test lab | `src/components/pages/admin/TestLabPage.tsx`, `src/lib/services/admin/testLab/`, `server/test-runner.ts` |
| Tests | `tests/` |
