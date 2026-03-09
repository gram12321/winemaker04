# Automated Test Suites

This folder hosts all executable test suites for Winemaker04. Tests focus on validating simulation logic, game mechanics, and core calculations.

## Structure

- `activity/` – Work unit calculations, staffing, scheduling
- `vineyard/` – Yield calculations, health degradation, grape suitability
- `wine/` – Fermentation effects, characteristics calculations
- `finance/` – (Future) Pricing, economy formulas
- `helpers/` – (Future) Shared factories and fixtures

Add new domain folders as coverage grows.

## Running Tests

```bash
npm test          # Single run (CI-style)
npm run test:watch # Watch mode (auto-rerun on changes)
```

Vitest is configured in `vite.config.ts` and automatically discovers files matching `tests/**/*.test.ts`.

## Conventions

- **One `.test.ts` file per domain/module**
- **Use project aliases**: Import via `@/lib/...` to stay resilient to path changes
- **Scenario-driven tests**: Use `describe` blocks that explain *why* a rule exists
- **Deterministic tests**: Mock data locally, never call Supabase directly
- **Clear test names**: Future AI agents should understand the contract from test names

---

## Testing Strategy Roadmap

### ✅ Phase 0 – Foundations (COMPLETE)

- [x] Install Vitest and add `npm test` / `npm run test:watch`
- [x] Enable TypeScript support for `tests/` folder
- [x] Add initial test suite: `tests/activity/workCalculator.test.ts`
- [x] Document testing workflow

### 🔄 Phase 1 – Core Mechanics (IN PROGRESS)

Target modules:
- [x] `@/lib/services/activity/workcalculators/*` (work calculations) - ✅ 5 tests
- [x] `@/lib/services/vineyard/vineyardManager.ts` (yield calculations) - ✅ 11 tests
- [x] `@/lib/services/vineyard/vineyardValueCalc.ts` (grape suitability) - ✅ 12 tests
- [x] `@/lib/services/wine/characteristics/fermentationCharacteristics.ts` (fermentation effects) - ✅ 14 tests
- [x] `@/lib/services/finance/wageService.ts` (wage calculations) - ✅ 8 tests
- [x] `@/lib/services` loan exports (loan calculations) - ✅ 15 tests

**Total Phase 1 Progress: 65 tests across 6 test files**

**Approach for each module:**
1. Identify pure calculation helpers (no Supabase/database calls)
2. Write scenario-based tests (normal cases, edge cases, boundary conditions)
3. Capture intent in test names so future AI understands the contract

### 📋 Phase 2 – Integrated Flows (FUTURE)

Goal: Ensure multi-step processes stay stable when business rules change.

Candidate flows:
- Vineyard lifecycle → Harvest → Crushing → Fermentation
- Sales pipeline: `saveWineOrder` → `fulfillWineOrder` → prestige events
- Finance ledger balancing

**Approach:**
- Use mocked services or fixture builders to keep tests deterministic
- Prefer domain-specific helper factories in `tests/helpers/`

---

## Tooling Expectations

**For AI Agents:**
- Always run `npm test` before surfacing changes involving game rules
- Keep test files ASCII-only and import via `@/...` aliases
- Never call Supabase directly from tests; rely on service-level mocks/fakes
- Update this README when adding new test domains

**For Developers:**
- Write tests for gameplay-critical formulas to prevent regressions
- Use descriptive test names that explain the business rule being validated
- Mock external dependencies (database, API calls) at the service level

---

## Success Criteria

- ✅ Every gameplay-critical formula has at least one unit test guarding regressions
- ✅ A failing Vitest run immediately points to the domain that broke
- ✅ Test documentation remains synced with actual test suites

When a phase completes, update `docs/versionlog.md` to record the testing milestone.
