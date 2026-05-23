# Admin Test Lab Implementation Plan

Status: Partially implemented. Created 2026-05-21 from `docs/superpowers/specs/2026-05-20-admin-test-lab-design.md`; updated 2026-05-22 to use active-company scenarios as the default Test Lab model.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a development-only Admin Test Lab that accurately runs the current regression suite, lets developers create targeted gameflow states against the active company without waiting for natural ticks, and cleans up tagged generated fixture data.

**Architecture:** Keep Vitest as the regression source of truth, replace hard-coded viewer data with a typed scenario registry, add browser-side admin test-lab services for active-company gameflow fixture creation, and keep Vite middleware only for filesystem/test-runner endpoints. Gate the UI and middleware to dev localhost/loopback only.

**Tech Stack:** TypeScript, React, Vite middleware, Vitest, Supabase client services, existing shadCN UI primitives.

---

## File Structure

- Create `src/lib/services/admin/testLab/devAdminGate.ts`
  - Shared browser helper for deciding whether Admin Dashboard/Test Lab should render.
- Create `server/devAdminGate.ts`
  - Server-side loopback host check for Vite middleware endpoints.
- Create `server/test-runner.ts`
  - Runs Vitest with JSON reporter and parses structured results.
- Modify `server/test-api.ts`
  - Use the structured runner and loopback gate for `/api/test-run`.
- Create `tests/admin/testRunnerParser.test.ts`
  - Covers Vitest JSON parsing, skipped tests, failed tests, and malformed output.
- Modify `src/App.tsx`
  - Refuse the `admin` route when the dev admin surface is unavailable.
- Modify `src/components/layout/Header.tsx`
  - Hide Admin Dashboard entries outside dev localhost.
- Create `src/lib/services/admin/testLab/types.ts`
  - Owns scenario, run, result, assertion, entity, and parameter field types.
- Create `src/lib/services/admin/testLab/testLabScenarios.ts`
  - Registry metadata for regression, vineyard, winery, sales, finance, staff, research, achievement, and wine-log groups.
- Create `src/lib/services/admin/testLab/runId.ts`
  - Creates and parses durable `testlab_...` run ids and `[TESTLAB:...]` name prefixes.
- Create `src/lib/services/admin/testLab/testLabFixtureService.ts`
  - Creates tagged companies, vineyards, activities, and wine batches for scenarios.
- Create `src/lib/services/admin/testLab/testLabCleanupService.ts`
  - Deletes tagged records by run id in dependency order.
- Create `src/lib/services/admin/testLab/testLabRunner.ts`
  - Dispatches scenario ids to scenario implementations and returns structured results.
- Modify `src/lib/services/activity/activitymanagers/activityManager.ts`
  - Export `completeActivityNow(activityId)` that uses the same completion handlers as normal weekly progress.
- Create `src/components/pages/admin/TestLabPage.tsx`
  - Main operational UI for regression results, scenario browser, parameters, run output, and cleanup.
- Modify `src/components/pages/AdminDashboard.tsx`
  - Replace the old Tests tab body with `TestLabPage`.
- Modify or retire `test-viewer/TestViewer.tsx`
  - Keep it as a compatibility wrapper only if needed; no duplicated scenario descriptions remain there.
- Modify `test-viewer/README.md`
  - Mark legacy standalone files clearly and document the new Admin Test Lab path.
- Modify `tests/README.md`
  - Sync actual suite categories and document admin scenario-fixture conventions.
- Modify `docs/versionlog.md`
  - Add the Admin Test Lab implementation milestone after the feature exists.

## Current Constraints

- The repo is currently on branch `main`, and this is not an isolated git worktree.
- The existing worktree already has unrelated modified docs. Do not revert them.
- Admin authorization is intentionally out of scope. The only gate is dev mode plus localhost/loopback.
- Fixture cleanup cannot depend only on React state. Every mutating fixture scenario must persist a durable run tag in names, params, or company-scoped records where the created record can be tagged.
- Active-company execution is intentional. Dedicated test companies remain an explicit scenario, but vineyard, winery, sales, finance, research, and staff Test Lab flows should operate on the company the admin user is currently inspecting.

## Tasks

### Task 1: Structured Regression Runner

- [ ] Create `server/test-runner.ts`.
- [ ] Define `VitestRunSummary`, `VitestFileSummary`, and `VitestTestCaseSummary`.
- [ ] Run Vitest with `npm test -- --reporter=json`.
- [ ] Parse JSON reporter output instead of terminal glyphs.
- [ ] Include `passed`, `failed`, `skipped`, `total`, `testFiles`, `durationMs`, failed test names, and failure messages.
- [ ] Preserve a truncated raw output field for debugging.
- [ ] Keep the parser as a pure exported function so it can be tested without spawning a process.
- [ ] Add `tests/admin/testRunnerParser.test.ts`.
- [ ] Assert skipped tests are counted as skipped, not passed or failed.
- [ ] Assert file counts are separate from test counts.
- [ ] Assert malformed output returns a failed structured result with the raw output.
- [ ] Run `npm test -- tests/admin/testRunnerParser.test.ts`.

### Task 2: Dev Localhost Gate

- [ ] Create `src/lib/services/admin/testLab/devAdminGate.ts`.
- [ ] Implement `isLoopbackHostname(hostname)` for `localhost`, `127.0.0.1`, and `::1`.
- [ ] Implement `isDevAdminSurfaceAvailable(location = window.location, isDev = import.meta.env.DEV)`.
- [ ] Create `server/devAdminGate.ts` with `isLoopbackRequest(req)`.
- [ ] Modify `server/test-api.ts` to return `403` for non-loopback hosts before spawning tests.
- [ ] Modify `Header.tsx` so desktop and mobile Admin Dashboard menu items render only when the helper returns true.
- [ ] Modify `App.tsx` so `case 'admin'` renders the dashboard only when the helper returns true; otherwise it returns Company Overview or Login.
- [ ] Run `npm run build`.

### Task 3: Wire `/api/test-run` To The Structured Runner

- [ ] Replace the stdout regex parser in `server/test-api.ts` with `runVitestSuite()` from `server/test-runner.ts`.
- [ ] Keep the current `POST /api/test-run` response shape compatible enough for existing UI fields.
- [ ] Add new fields for skipped tests, duration, per-file status, and failed test details.
- [ ] Support an optional request body `{ "target": "tests/path/file.test.ts" }`.
- [ ] Reject target paths that do not start with `tests/` or do not end with `.test.ts`.
- [ ] Run the Vite dev server and call `/api/test-run` once.
- [ ] Verify the reported test totals match the CLI `npm test` summary.

### Task 4: Scenario Registry Types And Metadata

- [ ] Create `src/lib/services/admin/testLab/types.ts`.
- [ ] Define `TestLabScenarioGroup`, `TestLabScenarioDefinition`, `TestLabParamField`, `TestLabRunMode`, `TestLabScenarioResult`, `TestLabAssertion`, `TestLabCreatedEntity`, and `TestLabRunContext`.
- [ ] Create `src/lib/services/admin/testLab/testLabScenarios.ts`.
- [ ] Register scenario groups:
  - Regression Tests
  - Company Setup
  - Vineyard Lifecycle
  - Winery Flow
  - Sales Flow
  - Finance Flow
  - Research and Staff
  - Achievements and Wine Log
- [ ] Add initial scenario metadata for:
  - full regression suite
  - create isolated test company
  - create harvest-ready vineyard
  - create grapes-stage wine batch
  - create must-ready wine batch
  - create fermenting wine batch
  - create bottled wine
  - cleanup by run id
  - generate test orders
  - generate test contract
  - set company money
  - set player balance
  - add prestige
  - set game date
  - grant/remove all research
  - set staff XP
- [ ] Export `getTestLabScenarios()` and `getTestLabScenario(id)`.
- [ ] Do not duplicate this metadata in React components.

### Task 5: Fixture Run Ids And Cleanup Tags

- [ ] Create `src/lib/services/admin/testLab/runId.ts`.
- [ ] Implement `createTestLabRunId()` returning `testlab_<timestamp>_<shortRandom>`.
- [ ] Implement `formatTestLabPrefix(runId)` returning `[TESTLAB:<runId>]`.
- [ ] Implement `extractTestLabRunId(value)` for names/titles/descriptions.
- [ ] Create `src/lib/services/admin/testLab/testLabCleanupService.ts`.
- [ ] Implement cleanup by run id using Supabase direct deletes in dependency order:
  - wine orders and contracts
  - wine log entries
  - wine batches
  - activities
  - vineyards
  - staff, teams, loans, research unlocks, transactions, notifications, prestige events
  - company and user, when created by the run
- [ ] Use name/title prefixes and JSON params where no dedicated metadata column exists.
- [ ] Return a cleanup report with attempted and deleted counts by entity type.
- [ ] Add focused tests for run id parsing and cleanup planning where pure helpers exist.

### Task 6: Activity Fast-Forward Helper

- [ ] Modify `src/lib/services/activity/activitymanagers/activityManager.ts`.
- [ ] Export `completeActivityNow(activityId: string): Promise<{ success: boolean; error?: string; activity?: Activity }>`
- [ ] Reuse the existing private `completionHandlers` map.
- [ ] Set `completedWork` to `totalWork`, run the same completion handler as `progressActivities`, remove the completed activity, update game state, and trigger immediate UI updates.
- [ ] Return `blocked`-style errors when the activity does not exist or is already cancelled.
- [ ] Add or update tests for a pure helper if handler extraction creates one; otherwise verify through existing workflow tests.

### Task 7: Fixture Service Vertical Slice

- [ ] Create `src/lib/services/admin/testLab/testLabFixtureService.ts`.
- [ ] Implement `createTestLabCompany(params)` using `companyService.createCompany`.
- [ ] Keep active-company mode as the default for gameflow scenarios.
- [ ] Set the active company when a dedicated test company is explicitly created so existing company-scoped services work.
- [ ] Implement `createHarvestReadyVineyard(params)` by saving a tagged vineyard with selected country, region, grape, hectares, density, health, ripeness, vine age, soil, aspect, altitude, and Autumn date.
- [ ] Implement `createGrapeBatch(params)` using `createWineBatchFromHarvest`.
- [ ] Implement `createMustReadyBatch(params)` by creating grapes, starting crushing through `startCrushingActivity`, then completing it with `completeActivityNow`.
- [ ] Implement `createFermentingBatch(params)` by creating must, starting fermentation through `startFermentationActivity`, then completing it with `completeActivityNow`.
- [ ] Implement `createBottledWine(params)` by creating fermenting wine, applying `processWeeklyFermentation` the requested number of weeks, calling `bottleWine`, and optionally setting `askingPrice`.
- [ ] Every created company, vineyard, activity, batch, and wine log path must carry the run prefix directly or through a traceable parent entity.
- [ ] Return before/after snapshots, created entity ids, assertions, warnings, and cleanup id.

### Task 8: Scenario Runner

- [ ] Create `src/lib/services/admin/testLab/testLabRunner.ts`.
- [ ] Implement `runTestLabScenario({ scenarioId, params, mode })`.
- [ ] Dispatch registry ids to fixture service functions.
- [ ] Support `mode: 'dryRun'` for parameter validation and precondition checks without writes.
- [ ] Normalize thrown errors into `status: 'failed'` results with message and stack.
- [ ] Use `status: 'blocked'` when preconditions are missing, such as no active company in active-company mode.
- [ ] Add validation for numeric ranges and enum values from the scenario parameter metadata.

### Task 9: Test Lab UI

- [ ] Create `src/components/pages/admin/TestLabPage.tsx`.
- [ ] Load scenario definitions from `getTestLabScenarios()`.
- [ ] Render grouped scenario navigation with dense cards or a table.
- [ ] Render parameter controls from registry metadata using existing shadCN `Input`, `Select`, `Slider`, `Switch`, `Tabs`, `Badge`, `Table`, and `Card` components.
- [ ] Add Run, Dry Run, Cleanup Run, and Run Regression Suite buttons.
- [ ] Show result status, assertions, warnings, created entities, before/after snapshots, and raw regression output.
- [ ] Store recent runs in component state and `localStorage` so cleanup can still be triggered after navigation.
- [ ] Modify `AdminDashboard.tsx` to render `TestLabPage` in the Tests tab.
- [ ] Remove duplicated test-suite descriptions from the active UI path.
- [ ] Keep the UI operational and compact; do not add marketing or explanatory hero sections.

### Task 10: Legacy Viewer And Documentation

- [ ] Decide whether `test-viewer/TestViewer.tsx` remains as a wrapper around `TestLabPage` or is removed from the active route.
- [ ] Mark `test-viewer/index.html` and `test-viewer/viewer.js` as legacy reference files, or remove them if nothing imports them.
- [ ] Update `test-viewer/README.md` so it no longer claims `/api/test-run` is future work.
- [ ] Update `tests/README.md` with the current domain folders, integration-test expectations, and fixture conventions.
- [ ] Update `docs/versionlog.md` after implementation and verification.

### Task 11: Verification

- [ ] Run `npm test -- tests/admin/testRunnerParser.test.ts`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start the Vite dev server.
- [ ] Verify Admin Dashboard appears on `localhost` and is hidden/rejected outside the loopback helper conditions where practical.
- [ ] Run the regression suite from the Admin Test Lab UI and compare totals to CLI output.
- [ ] Run the harvest-ready vineyard scenario and confirm the vineyard appears with the requested parameters.
- [ ] Run the bottled-wine scenario and confirm a bottled batch and wine-log entry are created.
- [ ] Run cleanup for the run id, reload the page, and confirm tagged entities are gone.
- [ ] Capture any residual Supabase cleanup limitations in the final summary.

## Target Acceptance

- Admin Dashboard and test endpoints are exposed only in development on localhost or loopback hosts.
- `/api/test-run` reports accurate passed, failed, skipped, total, and file counts for the current Vitest suite.
- Scenario metadata lives in one typed registry instead of inside UI components.
- A developer can create a harvest-ready vineyard without ticking from Spring to Fall.
- A developer can create grapes, must-ready, fermenting, and bottled wine batches through explicit scenario actions.
- Wine price and quality parameters can be set for a bottled-wine scenario and inspected in the result panel.
- Every mutating scenario returns a durable run id, created entity ids, assertions, warnings, and cleanup status.
- Cleanup works after page reload by using durable run tags, not only React state.
- Existing `npm test` remains the regression source of truth.

## Deferred Scope

- Remote production authorization and production admin roles remain out of scope.
- Browser-level Playwright smoke tests can be added after the Test Lab UI exists.
- Deeper fulfillment/expiration scenarios for sales, finance, research, staff, achievement, and wine-log systems should follow the current active-company shortcut coverage.
