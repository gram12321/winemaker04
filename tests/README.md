# Automated Test Suites

This folder hosts the executable automated Vitest suites for Winemaker04. Tests validate simulation logic, service contracts, game mechanics, and selected development tooling.

## Structure

- `activity/` - Work unit calculations, staffing, scheduling, and activity helpers.
- `admin/` - Admin Test Lab parser/run-id helpers and development tooling regressions.
- `finance/` - Economy, wage, loan formula, and loan lifecycle tests.
- `prestige/` - Shared prestige scaling and cap tests.
- `research/` - Research eligibility and permanent-effect tests.
- `sales/` - Contract, customer/order, and grape buyer market tests.
- `user/` - Company creation, starting conditions, staff/team, wine log, achievements.
- `vineyard/` - Yield calculations, lifecycle progression, vineyard creation, grape suitability, weather impact, and Weather Center behavior.
- `wine/` - Fermentation, anchors, aging, pricing, taste quality, and wine characteristic tests.

Vitest discovers files matching `tests/**/*.test.ts`. Prefer the live CLI summary over hand-maintained test counts in this README.

## Running Tests

```bash
npm test
npm run test:watch
```

Targeted runs are useful while developing:

```bash
npm test -- tests/admin/testRunnerParser.test.ts
npm test -- tests/wine/tasteQualityIndexService.test.ts
```

The Admin UI also exposes these same automated tests through the development-only `/api/test-run` endpoint using Vitest's JSON reporter. The CLI remains the source of truth.

Current known caveat from the 2026-05-25 documentation audit: the full suite has two active failing expectations in `tests/user/researchPanelVisibility.test.ts`, both tied to the research UI visibility backlog.

## Conventions

- Keep test files scenario-driven and name assertions after the rule being protected.
- Use project aliases such as `@/lib/...` for app imports.
- Keep pure unit tests deterministic.
- Database-backed workflow tests must create isolated data and clean up after themselves.
- Admin Test Lab fixture helpers run against the active company by design and must tag created fixture data with durable `testlab_...` run ids where records can be tagged.
- Do not write new tests that depend on React component state as the only cleanup record.

## Integration Tests

Some `tests/user/` workflows exercise Supabase-backed services. They require the normal local Supabase environment variables and should be treated as integration tests even though they run under the same Vitest command.

When adding a new mutating integration test:

- create unique names or ids;
- clean up records in dependency order;
- avoid sharing state with a developer's active company;
- document any required environment variables in the test file.

## Admin UI Test Systems

The Admin Dashboard surfaces two related but different systems:

- Automated Tests: shared with this folder, run through Vite middleware via `npm test -- --reporter=json`.
- Gameflow Lab: separate interactive tooling that can create or mutate active-company companies, vineyards, activities, wine batches, sales artifacts, finance state, research unlocks, and staff XP for manual inspection.
- Mutating scenarios must return a run id and cleanup report.
- Cleanup must work after a page reload by finding durable tags in persisted fixture records. Broad active-company admin shortcuts such as money, prestige, research, and staff XP are intentionally inspectable mutations, not fully reversible fixture records.
