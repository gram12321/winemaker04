# Admin Test Lab Design

## Purpose

Winemaker04 needs a development-only Admin Test Lab that lets developers and AI agents test gameflow systems without manually clicking through weeks and seasons. The tool should make it possible to set up a targeted state, execute one or more game actions, inspect the resulting game state, and clean up the created data.

The feature is for local and development use only. Because the game is not live yet, the access gate is intentionally simple: expose the Admin Test Lab only when the app is running in development mode on localhost or a loopback host. No production authorization model is required for this design.

## Current State

The repository has two test surfaces:

- `tests/` is the executable Vitest suite. It is configured through `package.json` and `vite.config.ts`, and currently covers pure calculations, service-level behavior, and at least one database-backed workflow.
- `test-viewer/` is an Admin Dashboard viewer mounted through `src/components/pages/AdminDashboard.tsx`. It displays hard-coded scenario descriptions, can call `/api/test-run`, and can generate vineyard fixtures into the active company.

The current suite is useful, but the documentation and viewer are out of date:

- `tests/README.md` still describes 65 tests across 6 files, while the current run has 153 total tests across 16 files.
- `test-viewer/README.md` says the API endpoint is future work, but `/api/test-run` already exists.
- `test-viewer/viewer.js` only knows about 6 old test files.
- `test-viewer/TestViewer.tsx` duplicates test descriptions instead of reading a registry or manifest.
- `/api/test-run` parses human Vitest output and currently misreports skipped-test runs by counting test files as tests.
- test vineyard generation writes into the active company, and cleanup IDs live only in React state.

## Goals

The Admin Test Lab should support these workflows:

1. Run existing regression tests from the admin UI and show accurate structured results.
2. Create isolated test companies or test runs so fixture data never pollutes normal saves.
3. Seed game state directly for important milestones, such as harvest-ready vineyard, grapes in winery, must ready for fermentation, fermenting wine, bottled wine, active customer order, and active contract.
4. Execute gameflow steps without waiting for natural activity completion.
5. Allow parameters for each test setup, especially vineyard, grape, wine batch, quality, price, customer, date, staff, and activity values.
6. Show before and after state in the UI with links to the affected vineyard, wine batch, activity, order, or contract.
7. Clean up all data created by a test run using a durable run id.

## Non-Goals

This design does not introduce production admin roles, user permissions, or secure remote execution. It also does not replace Vitest unit and service tests. The Admin Test Lab complements `tests/` by exercising gameflow setup and state transitions through development-only tooling.

## Approach Considered

### Option 1: Fix the Existing Test Viewer Only

This would update `TestViewer.tsx`, fix `/api/test-run`, and refresh the docs. It is fast and low risk, but it does not solve the main need: parameterized gameflow testing without waiting for activities.

### Option 2: Add More Vitest Integration Tests

This keeps validation in the normal test suite and is good for CI. It is not enough for the desired interactive UI because developers still cannot create specific game states from the Admin Dashboard and visually inspect them in the app.

### Option 3: Build a Development-Only Admin Test Lab

This keeps Vitest for regression tests, replaces the hard-coded viewer with a scenario registry, adds admin fixture services, and exposes parameterized workflows in the Admin Dashboard. This is the recommended approach because it supports both automated checks and hands-on gameflow inspection.

## Recommended Architecture

Use four layers:

1. `tests/`
   - Remains the Vitest regression suite.
   - Contains pure formula tests, mocked service tests, and selected database tests.
   - Gets updated documentation and helper conventions.

2. `src/lib/services/admin/testLab/`
   - New development-only service boundary for creating fixtures and executing scenario actions.
   - Owns scenario input types, seeded object creation, fast-forward helpers, cleanup, and result summaries.
   - Uses existing domain services whenever possible instead of duplicating game rules.

3. `server/test-api.ts`
   - Keeps the dev-only Vite middleware pattern.
   - Replaces stdout parsing with structured Vitest JSON output.
   - Adds endpoints for scenario registry reads, scenario execution, and cleanup.
   - Rejects requests unless `import.meta.env.DEV` equivalent server state and localhost host checks pass.

4. `src/components/pages/AdminDashboard.tsx` and test-lab UI components
   - Shows Admin and Test Lab controls only on localhost/dev connections.
   - Provides parameter forms, scenario cards, run history, result summaries, and cleanup buttons.
   - Uses existing shadCN components and existing game modals for inspection where practical.

## Localhost/Dev Gate

The access rule should be explicit and shared:

- `isDevAdminSurfaceAvailable()` returns true when the app is running in dev mode and `window.location.hostname` is `localhost`, `127.0.0.1`, or `::1`.
- Header navigation should hide Admin Dashboard when the helper returns false.
- App route rendering should refuse the `admin` page when the helper returns false.
- Vite middleware should reject non-loopback hosts for `/api/test-run` and future `/api/test-lab/*` endpoints.

This is not a security boundary for a deployed app. It is a development guard that prevents accidental exposure when the project is later previewed or hosted.

## Scenario Registry

Create a typed scenario registry instead of hard-coding descriptions inside `TestViewer.tsx`.

Suggested module:

- `src/lib/services/admin/testLab/testLabScenarios.ts`

Core shape:

```ts
export interface TestLabScenarioDefinition<TParams, TResult> {
  id: string;
  title: string;
  group: TestLabScenarioGroup;
  description: string;
  defaultParams: TParams;
  run(params: TParams, context: TestLabRunContext): Promise<TestLabScenarioResult<TResult>>;
}
```

Scenario groups:

- Regression Tests
- Company Setup
- Vineyard Lifecycle
- Winery Flow
- Sales Flow
- Finance Flow
- Research and Staff
- Achievements and Wine Log

Each scenario result should include:

- `runId`
- created entity ids
- before and after snapshots
- pass/fail assertions
- warnings
- cleanup status

## Fixture Isolation

Every mutating scenario must create or reuse a test run id:

```ts
type TestLabRunId = `testlab_${string}`;
```

All created records should carry the run id in a durable field:

- Prefer a metadata field when the table has one.
- Otherwise use a predictable name prefix, such as `[TESTLAB:testlab_...]`.
- Keep a central run manifest in memory for the current session and persist enough tags on records that cleanup still works after page reload.

Cleanup must not depend only on React state. A cleanup operation should find all entities with the run id and delete them in dependency order:

1. orders and contracts
2. wine log entries and highscores created by scenario runs
3. wine batches
4. activities
5. vineyards
6. staff, teams, loans, research unlocks, transactions, notifications, prestige events
7. company and user, when the scenario created an isolated company

The safest default is to create a dedicated test company per run. Reusing the active company should be an explicit mode labeled as destructive or polluting.

## Core Test Lab Capabilities

### Regression Runner

The existing `Run All Tests` button should call a corrected dev endpoint that runs:

```bash
npm test -- --reporter=json
```

The endpoint should parse JSON instead of terminal glyphs. It should report:

- total test files
- passed, failed, skipped tests
- duration
- failed test names and messages
- per-file result summaries

Targeted runs should support a file path or scenario id. UI buttons labeled as per-suite actions must pass a target; otherwise they should be labeled as full-suite actions.

### Time and Activity Controls

Add helpers that avoid repeated manual ticks:

- set game date
- advance N weeks
- run one full `processGameTick`
- complete an activity immediately
- complete all activities matching category or target
- create activity with custom total/completed work

Immediate completion should use the same completion handlers as natural progress. If those handlers are private inside `activityManager.ts`, the implementation should extract a public `completeActivityNow(activityId)` service instead of duplicating completion logic.

### Vineyard Lifecycle Scenarios

Required scenario examples:

- create unplanted vineyard with parameters
- create planted vineyard with chosen grape, density, age, health, ripeness, region, soil, aspect, altitude
- create harvest-ready vineyard in Autumn without ticking from Spring
- run harvest and create a grape-stage wine batch
- test yield response to health, ripeness, density, and vine age

### Winery Flow Scenarios

Required scenario examples:

- create grape-stage wine batch from parameters
- create must-ready batch without running crushing activity
- run crushing with selected method and pressing intensity
- create fermenting batch with selected method and temperature
- apply N fermentation weeks immediately
- bottle wine and record wine log entry
- create bottled wine with specific estimated price, asking price, wine score, taste quality, structure index, features, and quantity

Wine batch creation should prefer existing services:

- `createWineBatchFromHarvest` for realistic harvest snapshots
- `completeCrushing` or extracted completion helpers for crushing transitions
- `completeFermentationSetup` plus `processWeeklyFermentation` for fermentation transitions
- `bottleWine` for bottling and wine log behavior

Direct database writes are allowed only when the scenario explicitly needs impossible or boundary state.

### Sales Flow Scenarios

Required scenario examples:

- create customer set for the test company
- create bottled wine that qualifies for order generation
- generate one order for a specific customer type
- generate one contract with selected customer type and requirements
- validate a selected wine against a contract
- fulfill an order or contract and assert inventory, transactions, prestige, and relationship changes

### Finance, Staff, and Research Scenarios

Required scenario examples:

- set money and player balance
- create staff with chosen skills and specializations
- create staff search result and hire without waiting
- start and immediately complete research
- set loans, trigger seasonal payment, and inspect transactions

## UI Design

The Admin Dashboard should keep the existing high-level tabs, but the Tests tab should become a focused Test Lab with these areas:

- status banner showing dev/local mode
- regression test runner summary
- scenario browser grouped by domain
- parameter panel for the selected scenario
- run button, dry-run button where useful, and cleanup button
- result panel with created entities, assertions, warnings, and links
- recent runs list

Use dense operational UI rather than a marketing layout. Prefer tabs, tables, cards for repeated scenario rows, selects, sliders, number inputs, switches, and badges. Existing shadCN primitives should be used from `src/components/ui/shadCN`.

The UI should not embed long duplicated explanations from test files. Descriptions should come from the scenario registry.

## Data Flow

1. User opens Admin Dashboard on localhost/dev.
2. UI loads scenario definitions from the local registry or `/api/test-lab/scenarios`.
3. User selects a scenario and adjusts parameters.
4. UI posts `{ scenarioId, params, mode }` to `/api/test-lab/run`.
5. Server or client service creates a `runId`, executes the scenario, and returns structured result data.
6. UI displays assertions and links to created objects.
7. Cleanup posts `{ runId }` to `/api/test-lab/cleanup`.
8. Cleanup deletes tagged records and returns a cleanup report.

For scenarios that can safely run in the browser using existing client services, client execution is acceptable. For scenarios that run Vitest or need filesystem access, use the Vite middleware.

## Error Handling

Every scenario should fail with a structured result rather than throwing raw errors into the UI:

```ts
interface TestLabScenarioResult<T> {
  status: 'passed' | 'failed' | 'blocked';
  summary: string;
  data?: T;
  assertions: Array<{ name: string; passed: boolean; details?: string }>;
  createdEntities: Array<{ type: string; id: string; label: string }>;
  warnings: string[];
  error?: { message: string; stack?: string };
}
```

Blocked means the preconditions were not met, such as no active company when a scenario is configured to reuse the active company.

## Testing Strategy

The implementation should update the automated test regime in parallel with the Admin Test Lab:

- Fix `/api/test-run` result parsing with a small test or script-level parser test.
- Add unit tests for scenario parameter validation.
- Add service tests for fixture tagging and cleanup order.
- Add scenario tests for one vertical slice: create test company, create harvest-ready vineyard, create wine batch, bottle wine, cleanup.
- Keep pure calculation tests fast and deterministic.
- Move real Supabase tests into a clearly named integration category or document that they require configured environment variables.

## Documentation Updates

The implementation should update:

- `tests/README.md` to reflect the current suite, categories, integration-test policy, and scenario-helper expectations.
- `test-viewer/README.md` to describe the new Admin Test Lab or mark old standalone files as legacy.
- `docs/versionlog.md` after the Test Lab exists.

## Migration Plan

Phase 1: Stabilize current test surfaces.

- Replace `/api/test-run` stdout parsing with JSON reporter parsing.
- Update stale READMEs.
- Remove or archive the legacy `test-viewer/viewer.js` and `test-viewer/index.html`, or clearly label them as legacy.
- Hide Admin Dashboard and test endpoints outside localhost/dev.

Phase 2: Add the scenario registry and UI shell.

- Create typed scenario definitions.
- Render scenario groups from registry data.
- Add parameter forms for a small first set of scenarios.
- Show structured results and recent run history.

Phase 3: Add fixture isolation and cleanup.

- Add run id creation and tagging.
- Add cleanup service for test-created entities.
- Make dedicated test company mode the default.

Phase 4: Add gameflow controls.

- Extract or expose immediate activity completion.
- Add date/time travel helpers.
- Add vineyard and winery lifecycle scenarios.

Phase 5: Expand coverage.

- Add sales, finance, staff, research, achievements, and wine log scenarios.
- Add targeted regression test buttons backed by the corrected runner.
- Add browser/UI smoke checks if Playwright is introduced later.

## Acceptance Criteria

- Admin Dashboard and test endpoints are available only in development on localhost or loopback hosts.
- The regression runner reports accurate test, skipped, failed, and file counts for the current Vitest suite.
- Scenario metadata is not duplicated inside the UI component.
- A developer can create a harvest-ready vineyard without advancing from Spring to Autumn.
- A developer can create or progress a wine batch to grapes, must-ready, fermenting, and bottled states through explicit scenario actions.
- A developer can set parameters for wine price and quality mechanisms and inspect the resulting wine batch.
- Every mutating scenario returns created entity ids and can clean up after page reload using durable tags.
- Existing `npm test` remains the source of truth for regression tests.

## Implementation Risks

- Direct DB fixture writes can bypass important domain logic. The design limits direct writes to explicit boundary-state scenarios and prefers existing services for normal transitions.
- Activity completion handlers are currently internal to `activityManager.ts`. Duplicating them would create drift, so implementation should extract a public completion helper.
- Supabase-backed tests and scenario runs can mutate shared development data. Dedicated test companies and durable run ids are required before broad scenario coverage.
- Admin Dashboard currently exists as a general app route. The localhost/dev gate must be applied both to navigation and route rendering.
