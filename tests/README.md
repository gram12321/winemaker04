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
npm run test:full
npm run test:watch
npm run test:watch:full
```

`npm test` and `npm run test:full` run the deterministic automated suite. The
Admin Test Lab uses the complete suite through its development-only endpoint.

Targeted runs are useful while developing:

```bash
npm test -- tests/admin/testRunnerParser.test.ts
npm test -- tests/wine/tasteQualityIndexService.test.ts
```

The Admin UI exposes the complete automated suite through the development-only
`/api/test-run` endpoint using Vitest's JSON reporter. The CLI remains the source
of truth.

The full suite currently has no known failing expectations.

## Conventions

- Keep test files scenario-driven and name assertions after the rule being protected.
- Use project aliases such as `@/lib/...` for app imports.
- Keep pure unit tests deterministic.
- Database-backed workflow tests must create isolated data and clean up after themselves.
- Admin Test Lab fixture helpers run against the active company by design and must tag created fixture data with durable `testlab_...` run ids where records can be tagged.
- Do not write new tests that depend on React component state as the only cleanup record.

## Database Smoke Tests

Automated tests mock database seams. Live database smoke tests are intentionally
not part of the npm test suite because they require a dedicated, reachable
Supabase environment and cleanup-safe test data. If one is added in the future,
keep it in an explicitly named, opt-in command with isolated records and
dependency-ordered cleanup.

## Admin UI Test Systems

The Admin Dashboard surfaces two related but different systems:

- Automated Tests: shared with this folder, run through Vite middleware via `npm test -- --reporter=json`.
- Gameflow Lab: separate interactive tooling that can create or mutate active-company companies, vineyards, activities, wine batches, sales artifacts, finance state, research unlocks, and staff XP for manual inspection.
- Mutating scenarios must return a run id and cleanup report.
- Cleanup must work after a page reload by finding durable tags in persisted fixture records. Broad active-company admin shortcuts such as money, prestige, research, and staff XP are intentionally inspectable mutations, not fully reversible fixture records.
