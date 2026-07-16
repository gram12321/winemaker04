# Task 1 report: task-specialization contract and constants

## Status

Completed within the assigned Task 1 scope. No commit was created.

## Changes made

- Replaced the required `Staff.specializations` field with `Staff.taskSpecializations: WorkCategory[]`.
- Renamed persisted pending-search contract data from `searchOptions.specializations` to `searchOptions.taskSpecializations` with the same `WorkCategory[]` type.
- Added shared task-specialization helpers beside `WORK_CATEGORY_INFO`:
  - `isStaffSpecializationCategory`
  - `getStaffSpecializationCategories`
  - display name, description, icon-asset, and primary-skill helpers
- Kept `WORK_CATEGORY_INFO` as the only category-to-primary-skill mapping. `TASK_SPECIALIZATION_INFO` is generated from those helpers, so no parallel skill map or Sales placeholder exists.
- Removed `SPECIALIZED_ROLES` and replaced it with `TASK_SPECIALIZATION_INFO`, keyed only by actual `WorkCategory` values.
- Centralized Task 2/4 tuning inputs in `staffConstants.ts`:
  - `MATCHING_TASK_SPECIALIZATION_BONUS = 0.2`
  - `MAX_GRAPE_MASTERY_BONUS = 0.1`
  - `MAX_COMBINED_SPECIALIZATION_BONUS = 0.3`
  - `DISTINCT_PRIMARY_SKILL_WAGE_PREMIUM = 0.3`
- Replaced broad-role emoji keys with an exhaustive `WorkCategory` icon map.
- Updated the work-calculator staff fixture to the new required contract and added the requested contract test: `PLANTING` is accepted; legacy `field` is rejected.

## Files changed

- `src/lib/types/types.ts`
- `src/lib/constants/activityConstants.ts`
- `src/lib/constants/staffConstants.ts`
- `src/lib/utils/icons.tsx`
- `tests/activity/workCalculator.test.ts`

## Verification

- `git diff --check`: passed.
- `npm test -- tests/activity/workCalculator.test.ts`: cannot run with the shell's normal environment because the test's transitive imports require Supabase variables.
- Rerun with non-secret local dummy Supabase values: the new task-specialization contract test passed. Three existing calculator tests failed because `workCalculator.ts` still reads the deliberately removed `staff.specializations` field. That rewrite is Task 2 and is outside this task's assigned scope.
- `npx tsc --noEmit`: expected cutover errors remain in downstream database, calculator, staff service, recruitment, starting-condition, and UI callers that still use `specializations`/`SPECIALIZED_ROLES`. Those are assigned to later plan tasks; no compatibility alias was added to mask them.

## Self-review

- There is no legacy `Staff.specializations` field, optional fallback, or broad-role metadata in the changed shared contract/constants.
- All selectable task specializations are existing `WorkCategory` enum values; Sales has no enum entry and therefore cannot be exposed as a specialization.
- The primary skill for task-specialization metadata is always derived from `WORK_CATEGORY_INFO`.
- The tuning values are named constants rather than calculator/UI magic numbers.

## Handoff concern

Task 2 must update `workCalculator.ts` to use `staff.taskSpecializations.includes(category)` and the new task bonus constant before the focused calculator suite can pass. Task 4 and Task 5 must complete the remaining compile-time contract callers. The shared contract change is intentionally breaking, in line with the approved clean schema cutover.

## Review follow-up

- Updated `isStaffSpecializationCategory` and `getStaffSpecializationCategories` to read only the own keys of `WORK_CATEGORY_INFO`, rather than enumerate `WorkCategory` directly. This makes `WORK_CATEGORY_INFO` the definitive eligibility source and continues to exclude any future enum member that lacks activity metadata, including the intentionally absent Sales task.
- Reran `npm test -- tests/activity/workCalculator.test.ts` with local dummy Supabase variables. The task-specialization contract test passed; the same three calculator failures remain because Task 2 has not yet replaced `staff.specializations` in `workCalculator.ts`.
