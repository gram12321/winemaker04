# Automated Test Suites

This folder hosts the executable Vitest suites for Winemaker04. Tests validate simulation logic, service contracts, game mechanics, and selected development tooling.

## Structure

- `activity/` - Work unit calculations, staffing, scheduling, and activity helpers.
- `admin/` - Admin Test Lab parser/run-id helpers and development tooling regressions.
- `finance/` - Wage, loan, and finance formula tests.
- `sales/` - Contract and customer/order rule tests.
- `user/` - Company creation, starting conditions, staff/research workflows, wine log, achievements.
- `vineyard/` - Yield calculations, vineyard creation, grape suitability.
- `wine/` - Fermentation, anchors, taste quality, and wine characteristic tests.

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

The Admin Test Lab runs the same suite through the development-only `/api/test-run` endpoint using Vitest's JSON reporter. The CLI remains the source of truth.

## Conventions

- Keep test files scenario-driven and name assertions after the rule being protected.
- Use project aliases such as `@/lib/...` for app imports.
- Keep pure unit tests deterministic.
- Database-backed workflow tests must create isolated data and clean up after themselves.
- Admin Test Lab fixture helpers must tag created data with durable `testlab_...` run ids.
- Do not write new tests that depend on React component state as the only cleanup record.

## Integration Tests

Some `tests/user/` workflows exercise Supabase-backed services. They require the normal local Supabase environment variables and should be treated as integration tests even though they run under the same Vitest command.

When adding a new mutating integration test:

- create unique names or ids;
- clean up records in dependency order;
- avoid sharing state with a developer's active company;
- document any required environment variables in the test file.

## Admin Test Lab Expectations

The Admin Test Lab complements this folder; it does not replace it.

- Regression scenarios call `npm test -- --reporter=json` through Vite middleware.
- Gameflow scenarios can create companies, vineyards, activities, and wine batches for manual inspection.
- Mutating scenarios must return a run id and cleanup report.
- Cleanup must work after a page reload by finding durable tags in persisted records.
