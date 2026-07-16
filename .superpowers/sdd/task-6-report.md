# Task 6 report: migration safety, regression coverage, and documentation

## Delivered

- Added `migrations/fixtures/20260715100000_replace_staff_specializations_fixture.sql`, a self-contained transactional PostgreSQL fixture. It starts with legacy broad-role data, performs the same destructive replacement, asserts the old column is absent, asserts `task_specializations` is present, and asserts every original row has `[]`; it rolls back afterward.
- Added the activity-lifecycle regression that progresses one worker, adds a second worker, then removes the first. It asserts that the first worker retains only past/future assigned-tick XP, the new worker earns only after joining, and the removed worker receives no later XP.
- Audited `src` and `tests` for legacy broad-role identifiers, role icon metadata, raw experience access, and duplicate staff-work arithmetic. No runtime `SPECIALIZED_ROLES`, `getSpecializationIcon`, or `Staff.specializations` references remain. The only direct skill/experience work accesses are the shared work calculator, XP service, and skill-display component; activity previews/ticks route through the shared allocation calculator.
- Updated `CONTEXT.md`, `docs/AIdocs/AIDescriptions_coregame.md`, `docs/PROJECT_INFO.md`, `docs/WineSystem_VariableRelationshipMap.md`, and the superseded 2026-07-14 plan with the primary-skill / exact-task-specialization / grape-mastery model and no-Sales-subskill rule.

## Verification

All test commands used temporary local values for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; the Vitest module graph requires those variables even when database calls are mocked.

| Command | Result |
|---|---|
| `npm test -- tests/activity/activityLifecycle.test.ts` | Passed: 17/17. The first no-env attempt failed before tests due to the required Supabase variables; the rerun with temporary values passed. |
| Focused staff/activity/finance/starting-condition suites | Passed: `activityLifecycle`, `workCalculator`, `staffResearchSpeed`, `wageService`, `staffSearchCalculations`, and `startingConditions`. |
| `npm test` | Initially 412/413 passed because `tests/vineyard/vineyardLifecycle.test.ts` expected the old direct `handlePartialHarvesting()` database write. The assertion was corrected to require merged returned params and no direct persistence; the focused lifecycle suite then passed. |
| `npm test -- tests/vineyard/vineyardLifecycle.test.ts` | Passed after the assertion correction. |
| `npm run build` | Passed (TypeScript checks and Vite production build). Existing Vite dynamic-import/chunk-size warnings remain. |
| `git diff --check` | Passed. |

## Final React import and build verification

- Confirmed `StaffModal.tsx` imports `useEffect` and `useState` alongside `useMemo`, matching its preview state/effect usage.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | Passed. |
| `npm run build` | Passed. Vite completed with existing dynamic-import/chunk-size and stale Browserslist-data warnings. |
| `git diff --check` | Passed. |

## Final harvest and staff-modal review fixes

- `handlePartialHarvesting()` now pauses at the prior completed work when a storage plan is absent or the available portion is below the 0.1 kg persisted-batch minimum. It therefore returns only actual permitted work for the activity tick to allocate as XP.
- Added lifecycle coverage for missing storage, sub-0.1 kg increments, and partial capacity clamping.
- Staff Modal now resolves every active-assignment contribution through `activityWorkPreviewService`, including the shared weather, research, and validated grape context. It no longer calculates work from raw activity params in React.

| Command | Result |
|---|---|
| `npm test -- tests/vineyard/vineyardLifecycle.test.ts` | Passed: 11/11. |
| `npx tsc -p tsconfig.json --noEmit` | Passed. |
| `git diff --check` | Passed. |

## Final preview API cleanup

- Removed the stale pre-resolved research-effects argument from `activityManager` and from the preview-service API. The preview service now owns resolution of its required research effects for all callers.

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | Passed. |
| `git diff --check` | Passed. |

## Preview-policy consolidation

- Removed the duplicate work-context, weather-impact, and preview-allocation implementations from `activityManager.ts`.
- `activityWorkPreviewService` is now the sole shared policy source. The manager uses it during ticks (passing the already-resolved research effects), and the activity barrel exposes it for `StaffAssignmentModal` import hygiene.
- Updated the lifecycle test to import preview policy from its owning service and to partially mock the calculator dependency used by the isolated preview service.

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | Passed. |
| `npm test -- tests/activity/activityLifecycle.test.ts tests/activity/workCalculator.test.ts` | Passed: 32/32. |
| `git diff --check` | Passed. |

## Environment limit

`psql` is not installed in this workspace, and no local PostgreSQL/Supabase database is available. The SQL fixture therefore could not be executed here; it is designed to be run with `psql -f migrations/fixtures/20260715100000_replace_staff_specializations_fixture.sql` against PostgreSQL and rolls back its temporary proof transaction.

## Follow-up sanitation pass

- Hardened the migration with an immutable PostgreSQL validation function and constraint so `task_specializations` must be an array containing only current `WorkCategory` values. `saveStaffToDb()` now performs the equivalent application-side validation before issuing an upsert.
- Replaced staff-search/hiring specialization scaling literals with named `staffConstants` tuning values and removed unused duplicate task-specialization metadata.
- Added `staffPresentationService` to parse and normalize namespaced skill/grape XP into display models. Staff page and Staff modal now render those models rather than parsing or normalizing persisted experience directly.
- Added `activityWorkPreviewService` as the UI-facing activity preview context/calculation service. `StaffAssignmentModal` no longer imports the activity manager for preview logic.

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | Passed. |
| `npm test -- tests/activity/workCalculator.test.ts tests/activity/activityLifecycle.test.ts tests/user/staffSearchCalculations.test.ts tests/finance/wageService.test.ts` | Passed: 45/45. |
| `git diff --check` | Passed. |
