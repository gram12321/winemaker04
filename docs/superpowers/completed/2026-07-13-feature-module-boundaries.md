# Feature Module Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the installed features (`loanLender`, `researchUpgrade`, `boardShare`, and development-only `admin`) use deliberate, non-pluggable public facades, while documenting Weather as the separate always-on functional-module pattern.

**Architecture:** Installed features expose one statically assembled feature value and their public types from `src/lib/features/<feature>/index.ts`; callers must not configure, replace, or deep-import an implementation. `boardShare` remains a baseline implementation while its public-company runtime is deferred. Admin is the sole loading exception: `main.tsx` dynamically imports it only for Vite development and passes its feature value into `App`, rather than installing a global no-op adapter. Weather stays an always-on domain module that exports cohesive capabilities from its barrel.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Supabase.

**Out of scope:** Activating public-company/share gameplay; redesigning loan, research, weather, or Admin gameplay; making features independently installable npm packages; changing database schema.

---

## Target public patterns

### Installed feature facade

Use this pattern for `loanLender`, `researchUpgrade`, and `boardShare`:

```ts
// src/lib/features/<feature>/index.ts
export { <feature>Feature } from './feature';
export type { <Feature>Feature /* caller-facing types */ } from './featureTypes';
```

- There is no `configure…Feature()`, `get…Feature()`, `active.tsx`, or `noop.ts`.
- `feature.tsx` is the composition module that assembles the implementation.
- Callers import only `<feature>Feature` from `@/lib/features/<feature>`.
- `boardShare`'s current money and ownership rules are baseline behavior, not a no-op plugin substitute.

### Development-only Admin loading seam

```ts
const adminFeature = import.meta.env.DEV
  ? (await import('@/lib/features/admin/feature')).adminFeature
  : null;

function Root({ adminFeature }: { adminFeature: AdminFeature | null }) {
  return import.meta.env.PROD
    ? <React.StrictMode><App adminFeature={adminFeature} /></React.StrictMode>
    : <App adminFeature={adminFeature} />;
}

ReactDOM.createRoot(root).render(<Root adminFeature={adminFeature} />);
```

- `AdminFeature` and `AdminPageProps` remain type-only exports from `@/lib/features/admin`.
- `App` owns the nullable route dependency and passes a boolean to `Header`; neither component reads a registry or fallback adapter.
- Wine-anchor diagnostics use their own shared development-surface gate, not Admin availability.

### Always-on functional module

`weather` continues to export stable resolver, operation, market, vineyard, and presentation functions/types from `@/lib/features/weather`. It has no feature object, configuration, adapter, or fallback because it is a required domain capability rather than a replaceable runtime.

---

## File structure

| Path | Responsibility after this work |
|---|---|
| `src/lib/features/{loanLender,researchUpgrade}/feature.tsx`, `boardShare/feature.ts` | Concrete composition module for an installed feature. |
| `src/lib/features/{loanLender,researchUpgrade,boardShare}/index.ts` | Only public feature value and caller-facing types. |
| `src/lib/features/admin/feature.tsx` | Dev-only Admin composition, dynamically imported only by bootstrap. |
| `src/App.tsx` and `src/components/layout/Header.tsx` | Host-only Admin route/navigation wiring through explicit props. |
| `src/lib/utils/devSurfaceGate.ts` | Shared loopback-development policy for development-only UI surfaces. |
| `src/lib/features/weather/index.ts` | Always-on Weather capability barrel; no migration to a feature object. |
| `tests/features/featurePublicApi.test.ts` | Public-export and installed-feature contract tests. |
| `tests/admin/adminFeatureFacade.test.ts` | Admin host-prop and dev-loading contract tests; no registry tests. |
| `readme.md`, `docs/PROJECT_INFO.md`, `docs/AIdocs/AIDescriptions_coregame.md`, `src/lib/features/admin/README.md` | Concise repository-level pattern and feature-specific host documentation. |

### Task 1: Establish public-contract tests before the migration

**Files:**

- Create: `tests/features/featurePublicApi.test.ts`
- Modify: `tests/admin/adminFeatureFacade.test.ts`
- Modify: `tests/core/gameTick.test.ts`
- Modify: `tests/activity/activityLifecycle.test.ts`

- [ ] **Step 1: Write facade-export tests for the three installed features.**

```ts
import * as loanLender from '@/lib/features/loanLender';

expect(Object.keys(loanLender).sort()).toEqual(['loanLenderFeature']);
expect(loanLender.loanLenderFeature.ticks.processSeasonalLoanPayments)
  .toEqual(expect.any(Function));
```

Mirror this for `researchUpgradeFeature` and `boardShareFeature`. Verify that the public entry points export the feature value at runtime and retain the declared caller-facing types at compile time. Do not import `feature.tsx`, `services/`, `ui/`, or former no-op modules in this test.

- [ ] **Step 2: Replace registry mocks with static-facade mocks in existing callers.**

```ts
vi.mock('@/lib/features/loanLender', () => ({
  loanLenderFeature: { /* hooks */ }
}));
```

Preserve every behavior currently asserted by the lifecycle and tick tests.

- [ ] **Step 3: Run the focused tests and confirm the pre-migration failure.**

Run: `npx vitest run tests/features/featurePublicApi.test.ts tests/admin/adminFeatureFacade.test.ts tests/core/gameTick.test.ts tests/activity/activityLifecycle.test.ts`

Expected: the new export tests fail because the current public API exposes getters/configurers; existing behavior tests remain green before their mock update is committed with the implementation.

### Task 2: Replace Loan Lender’s registry/no-op pair with a static feature facade

**Files:**

- Rename: `src/lib/features/loanLender/active.tsx` to `src/lib/features/loanLender/feature.tsx`
- Modify: `src/lib/features/loanLender/featureTypes.ts`
- Modify: `src/lib/features/loanLender/index.ts`
- Delete: `src/lib/features/loanLender/noop.ts`
- Modify: `src/main.tsx`, `src/App.tsx`, `src/components/finance/FinanceView.tsx`, `src/components/pages/Winepedia.tsx`
- Modify: `src/lib/services/activity/activitymanagers/activityManager.ts`, `src/lib/services/core/gameTick.ts`, `src/lib/services/core/startingConditionsService.ts`, `src/lib/services/finance/financeService.ts`, `src/lib/services/user/companyService.ts`
- Test: `tests/features/featurePublicApi.test.ts`, `tests/finance/loanLifecycle.test.ts`, `tests/core/gameTick.test.ts`, `tests/activity/activityLifecycle.test.ts`

- [ ] **Step 1: Write the failing Loan Lender public-value test.**

Assert that `loanLenderFeature` exposes the existing `ui`, `workflow`, `setup`, `metrics`, and `ticks` groups and that neither `getLoanLenderFeature` nor `configureLoanLenderFeature` is a runtime export.

- [ ] **Step 2: Convert the composition module and barrel.**

Rename `activeLoanLenderFeature` to `loanLenderFeature` in `feature.tsx`; retain its behavior. Make `index.ts` export only that value plus public types:

```ts
export { loanLenderFeature } from './feature';
export type {
  LoanLenderFeature,
  LoanLenderFinanceTabRegistration,
  LoanLenderWinepediaTabRegistration,
  LoanLenderOverlayRegistration
} from './featureTypes';
```

Delete `noop.ts`, remove Loan Lender configuration from `main.tsx`, and update every host caller from `getLoanLenderFeature()` to `loanLenderFeature`.

- [ ] **Step 3: Run focused Loan Lender checks.**

Run: `npx vitest run tests/features/featurePublicApi.test.ts tests/finance/loanLifecycle.test.ts tests/core/gameTick.test.ts tests/activity/activityLifecycle.test.ts`

Expected: PASS. A Loan Lender caller now has one import path and no runtime configuration ordering requirement.

### Task 3: Convert Research Upgrade and Board Share to static feature facades

**Files:**

- Rename: `src/lib/features/researchUpgrade/active.tsx` to `src/lib/features/researchUpgrade/feature.tsx`
- Modify: `src/lib/features/researchUpgrade/featureTypes.ts`, `src/lib/features/researchUpgrade/index.ts`
- Delete: `src/lib/features/researchUpgrade/noop.ts`
- Rename: `src/lib/features/boardShare/noop.ts` to `src/lib/features/boardShare/feature.ts`
- Modify: `src/lib/features/boardShare/featureTypes.ts`, `src/lib/features/boardShare/index.ts`
- Modify: `src/main.tsx`, `src/App.tsx`, `src/components/finance/FinanceView.tsx`, `src/components/pages/Winepedia.tsx`
- Modify: `src/components/pages/sales/ContractsTab.tsx`, `src/components/pages/winepedia/GrapeVarietiesTab.tsx`
- Modify: `src/components/ui/modals/activitymodals/FermentationOptionsModal.tsx`, `HireStaffModal.tsx`, `LandSearchOptionsModal.tsx`, `LandSearchResultsModal.tsx`, `PlantingOptionsModal.tsx`
- Modify: `src/lib/services/activity/activitymanagers/activityManager.ts`, `landSearchManager.ts`, `staffSearchManager.ts`
- Modify: `src/lib/services/core/gameTick.ts`, `startingConditionsService.ts`, `src/lib/services/vineyard/vineyardService.ts`
- Modify: `src/lib/features/researchUpgrade/services/activity/activitymanagers/researchManager.ts`, `services/research/researchEnforcer.ts`
- Test: `tests/features/featurePublicApi.test.ts`, `tests/research/`, `tests/core/gameTick.test.ts`, `tests/activity/activityLifecycle.test.ts`, `tests/finance/loanLifecycle.test.ts`

- [ ] **Step 1: Add failing public-value tests.**

Assert `researchUpgradeFeature` exposes `workflow`, `unlocks`, `setup`, and `admin`; assert `boardShareFeature` exposes `ticks`, `constraints`, `starting`, and `ui`. The Board Share test must demonstrate that baseline ownership and constraint behavior remains available without an activation step.

- [ ] **Step 2: Apply the static facade conversion.**

Rename each concrete value to its stable public name and export it from the feature barrel. Replace all `getResearchUpgradeFeature()` and `getBoardShareFeature()` calls with direct static-feature imports. Remove their configuration from bootstrap.

```ts
// Before
await getResearchUpgradeFeature().workflow.completeResearch(activity);

// After
await researchUpgradeFeature.workflow.completeResearch(activity);
```

For Board Share, name the former no-op value `boardShareFeature` and update comments to describe it as the current baseline implementation. Do not claim that the share-market runtime is active.

- [ ] **Step 3: Preserve type contracts deliberately.**

Export all types application callers need from each feature’s `index.ts`; do not require a consumer to import `featureTypes.ts`. Keep internal adapter/service types unexported. Avoid widening the public interface merely to expose implementation helpers.

- [ ] **Step 4: Run focused Research and Board Share checks.**

Run: `npx vitest run tests/features/featurePublicApi.test.ts tests/research tests/core/gameTick.test.ts tests/activity/activityLifecycle.test.ts tests/finance/loanLifecycle.test.ts`

Expected: PASS. All static facade call sites use only the feature barrel.

### Task 4: Remove the Admin registry/no-op adapter while preserving dev-only code splitting

**Files:**

- Rename: `src/lib/features/admin/active.ts` to `src/lib/features/admin/feature.tsx`
- Modify: `src/lib/features/admin/featureTypes.ts`, `src/lib/features/admin/index.ts`
- Delete: `src/lib/features/admin/noop.ts`
- Modify: `src/main.tsx`, `src/App.tsx`, `src/components/layout/Header.tsx`, `src/components/ui/modals/UImodals/wineModal.tsx`
- Create: `src/lib/utils/devSurfaceGate.ts`
- Modify: `src/lib/utils/index.ts`, `src/lib/services/wine/debug/wineAnchorImpactDebugService.ts`
- Modify: `tests/admin/adminFeatureFacade.test.ts`, `tests/admin/testLabBehavior.test.ts`
- Test: `tests/admin/*.test.ts`

- [ ] **Step 1: Write failing Admin host-dependency tests.**

Test Admin route behavior through an explicit `AdminFeature | null` input: a supplied feature renders its page and makes Admin navigation available; `null` hides navigation and redirects the route to the ordinary fallback. Do not test module mutation or `vi.resetModules()` registry state.

- [ ] **Step 2: Make Admin a bootstrap dependency rather than a global registry.**

Keep `AdminFeature` and `AdminPageProps` as public type exports. Export `adminFeature` from the dev-only `feature.tsx` composition module. In `main.tsx`, dynamically import that module only under `import.meta.env.DEV`, then render:

```tsx
const adminFeature = import.meta.env.DEV
  ? (await import('@/lib/features/admin/feature')).adminFeature
  : null;

function Root({ adminFeature }: { adminFeature: AdminFeature | null }) {
  return import.meta.env.PROD
    ? <React.StrictMode><App adminFeature={adminFeature} /></React.StrictMode>
    : <App adminFeature={adminFeature} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Root adminFeature={adminFeature} />
);
```

Add `adminFeature: AdminFeature | null` to `App` props. Use it only for the Admin route and pass `Boolean(adminFeature?.isAvailable())` to `Header`. Remove `getAdminFeature`, `configureAdminFeature`, and `noop.ts`.

- [ ] **Step 3: Decouple wine diagnostics from Admin.**

Move the loopback/Vite-development predicate to `src/lib/utils/devSurfaceGate.ts`, export it from the utils barrel, and expose `isWineAnchorImpactDebugAvailable()` from the wine debug module. Replace the wine modal’s Admin import with that diagnostic-specific predicate.

- [ ] **Step 4: Run Admin and production-boundary checks.**

Run: `npx vitest run tests/admin`

Run: `npm run build`

Expected: Admin tests pass; build passes; inspecting `dist/` shows no active Admin implementation in the production asset graph. Record the actual chunk/file evidence in the implementation handoff.

### Task 5: Close remaining implementation leaks from host layers

**Files:**

- Modify: `src/components/pages/Research.tsx`
- Modify: `src/lib/features/researchUpgrade/featureTypes.ts`, `src/lib/features/researchUpgrade/feature.tsx`
- Modify: `src/lib/features/admin/feature.tsx`
- Modify: `src/components/finance/IncomeBalanceView.tsx`
- Modify: `src/lib/features/loanLender/featureTypes.ts`, `src/lib/features/loanLender/feature.tsx`
- Modify: `src/lib/services/index.ts`, `src/lib/services/activity/index.ts`
- Modify: `src/lib/services/activity/workcalculators/bookkeepingWorkCalculator.ts`, `src/lib/services/activity/activitymanagers/activityManager.ts`, `src/lib/services/vineyard/vineyardManager.ts`
- Test: `tests/features/featurePublicApi.test.ts`, `tests/research/researchPresentationService.test.ts`, `tests/finance/loanLifecycle.test.ts`, relevant core/activity tests

- [ ] **Step 1: Write failing tests for the two host-facing presentation capabilities.**

Add tests that Research provides its page and Admin-inspector rendering capabilities through the public facade and that Loan Lender provides the active-loan portfolio read model needed by `IncomeBalanceView`. The tests must consume only feature-barrel exports.

- [ ] **Step 2: Move host access to public feature capabilities.**

Add narrow Research UI capabilities that render the existing `ResearchWorkspace` and `ResearchAdminInspector`; make `ResearchPage` and the Admin feature consume those capabilities rather than importing Research components directly. Add a Research effects capability for the permanent-effects read model used by core/vineyard activity code. Add a narrow Loan Lender portfolio-read capability that delegates to the existing `loanViewService`; make `IncomeBalanceView` use it instead of importing `loanViewService` directly.

```ts
const loanPortfolio = useGameStateWithData(
  loanLenderFeature.metrics.loadActivePortfolio,
  DEFAULT_ACTIVE_LOAN_PORTFOLIO
);
```

- [ ] **Step 3: Remove feature implementation re-exports from general service barrels.**

Delete Loan Lender and Research Upgrade implementation re-exports from `src/lib/services/index.ts` and `src/lib/services/activity/index.ts`. Replace the permanent-effects imports in `bookkeepingWorkCalculator.ts`, `activityManager.ts`, and `vineyardManager.ts` with the Research effects capability. Replace each other host-layer deep import with an appropriate facade capability. Keep intra-feature imports feature-local; feature-specific tests may import internals when testing implementation units directly.

- [ ] **Step 4: Verify no production caller crosses an implementation seam.**

Run:

```powershell
rg -n '@/lib/features/(admin|loanLender|researchUpgrade|boardShare)/(feature|services|ui|components)|get(Admin|LoanLender|ResearchUpgrade|BoardShare)Feature|configure(Admin|LoanLender|ResearchUpgrade|BoardShare)Feature' src --glob '!src/lib/features/**'
```

Expected: no matches outside the permitted Admin bootstrap import. Resolve every remaining production-source match before proceeding.

### Task 6: Document the two patterns and update ownership records

**Files:**

- Modify: `readme.md`
- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `src/lib/features/admin/README.md`

- [ ] **Step 1: Update the root README with the two-pattern policy.**

Replace the current short “feature seams” note with this concise policy:

| Pattern | Features | Public interface | Lifecycle |
|---|---|---|---|
| Installed feature facade | `loanLender`, `researchUpgrade`, `boardShare` | one static feature value plus public types | assembled once; no opt-out or configuration |
| Development-only feature | `admin` | host type passed to `App` | dynamically loaded in Vite development only |
| Always-on functional module | `weather` | stable function/type barrel | required application capability |

State that callers import feature barrels, not feature internals or general-service re-exports.

- [ ] **Step 2: Align ownership and Admin host documentation.**

Update `PROJECT_INFO.md` and `AIDescriptions_coregame.md` to remove “active seam/no-op shell” terminology where it no longer applies. Update the Admin README to explain that compatible hosts supply the feature to their app bootstrap, that no global registry exists, and that the active graph stays development-only.

- [ ] **Step 3: Search for stale terminology and paths.**

Run:

```powershell
rg -n 'configure(?:Admin|LoanLender|ResearchUpgrade|BoardShare)Feature|get(?:Admin|LoanLender|ResearchUpgrade|BoardShare)Feature|no(?:Admin|LoanLender|ResearchUpgrade|BoardShare)Feature|active(?:Admin|LoanLender|ResearchUpgrade)Feature' readme.md CONTEXT.md docs src tests
```

Expected: no code or documentation references remain, except historical completed-plan records that are explicitly left unchanged.

### Task 7: Full verification and architecture sanitation

**Files:** all changed files

- [ ] **Step 1: Run targeted suites after all migrations.**

Run: `npx vitest run tests/features tests/admin tests/research tests/weather tests/finance/loanLifecycle.test.ts tests/core/gameTick.test.ts tests/activity/activityLifecycle.test.ts`

Expected: PASS.

- [ ] **Step 2: Run complete verification.**

Run:

```powershell
npm test
npm run build
git diff --check
```

Expected: all tests and build pass; diff check has no whitespace errors.

- [ ] **Step 3: Perform the repository architecture sanitation sweep.**

Inspect changed code for UI-owned business logic, CRUD outside `src/lib/database/`, hardcoded gameplay values, and new barrel/deep-import violations. Apply only fixes caused by this migration; record deliberate exceptions such as Admin’s development-only dynamic import.

- [ ] **Step 4: Hand off without committing.**

Summarize changed public interfaces, removed registry/no-op files, focused and full verification results, and any intentionally retained deep implementation imports in tests. Do not create a git commit; commits remain human-owned unless explicitly requested.

## Coverage check

- Removal of optional plugin/no-op semantics: Tasks 2–4.
- Consistent installed-feature facade pattern: Tasks 1–3.
- Weather retained and documented as its own pattern: Task 6.
- Admin’s required production exclusion preserved: Task 4.
- Host callers no longer depend on feature internals: Task 5.
- Public documentation and validation: Tasks 6–7.

## Plan self-review

- **Scope:** The feature migrations share one interface policy and must land together to eliminate conflicting caller patterns; Weather is documented but not structurally migrated.
- **No placeholders:** Every migration target, test target, and verification command is named. The implementation must inspect exact local signatures before adding the two narrow presentation/read capabilities in Task 5.
- **Consistency:** Installed facades use `<feature>Feature`; Admin uses `adminFeature` only as an explicit bootstrap-to-App dependency; Weather remains a barrel of functional capabilities.
