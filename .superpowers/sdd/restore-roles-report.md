# Broad specialized-role restoration report

## Delivered

- Restored the six original `SPECIALIZED_ROLES` with their original titles,
  descriptions, `skillBonus`, and `bonusAmount` values.
- Added `SpecializedRole` and a required, separately persisted
  `Staff.specializedRoles` field. It is not an alias for `taskSpecializations`.
- Added strict role validation in the staff database mapper and a clean schema
  migration adding `staff.specialized_roles jsonb NOT NULL DEFAULT '[]'` with
  JSON-array and allowed-value checks. There is no legacy read path.
- Updated starter staff to carry meaningful broad roles and made the starting
  conditions modal show each role title and description, separately from its
  exact tasks.
- Updated activity work calculation so a broad role applies to every category
  using its matching primary skill. Role, task, and grape bonuses are additive
  and bounded by `MAX_COMBINED_SPECIALIZATION_BONUS` (now 0.5), allowing every
  layer to contribute.
- Updated wage calculation to count the union of role and task primary-skill
  groups; a role and task in the same group receive one premium, while distinct
  groups each contribute. Primary skill levels continue to determine the base
  wage and primary-skill XP continues to improve activity work rather than wage.
- Updated `Staff.tsx` and `StaffModal.tsx` to show broad roles independently
  of task specializations and grape mastery. React only renders presentation
  data and constants; work formulas remain in services.

## Focused verification

- `npm test -- tests/activity/workCalculator.test.ts tests/finance/wageService.test.ts`
  passed: 2 files, 27 tests.
- `npx tsc --noEmit` passed.
- `npm test` passed: 76 files, 417 tests. Expected negative-path tests still
  emit their usual diagnostic stderr.
- `git diff --check` passed.

## Files changed for this restoration

- `src/lib/types/types.ts`
- `src/lib/constants/staffConstants.ts`
- `src/lib/services/activity/workcalculators/workCalculator.ts`
- `src/lib/services/finance/wageService.ts`
- `src/lib/services/user/staffService.ts`
- `src/lib/database/core/staffDB.ts`
- `src/lib/constants/startingConditions.ts`
- `src/lib/services/core/startingConditionsService.ts`
- `src/components/pages/Staff.tsx`
- `src/components/ui/modals/UImodals/StaffModal.tsx`
- `src/components/ui/modals/UImodals/StartingConditionsModal.tsx`
- `migrations/20260715100000_replace_staff_specializations.sql`
- `migrations/fixtures/20260715100000_replace_staff_specializations_fixture.sql`
- focused tests and staff architecture documentation.

## Follow-up review fixes

- Normal recruitment now accepts `specializedRoles` in `StaffSearchOptions`.
  The search modal and the manual hire modal both offer the six shared role
  definitions with titles and descriptions. Search validation, generated
  candidates, results, hiring notification, search cost/work, hiring work, and
  previews all carry the selected roles. Role and task groups are still
  deduplicated for their modeled specialization costs.
- `calculateWage` now accepts staff experience and averages XP-adjusted primary
  skills using the shared `calculateEffectiveSkill` helper. Creation begins at
  empty experience, founders remain at zero wage, and founder buyout
  recalculation uses the employee's persisted experience. UI wage copy now
  describes XP-adjusted primary skills.
- Added focused coverage for role-selected candidate generation and XP-driven
  wages.

## Wage lifecycle follow-up

- `awardExperience` now recalculates a salaried employee's wage from skills,
  task specializations, broad roles, and the newly awarded experience before
  updating state and persistence. Founder wages remain zero.
- Regression coverage verifies that primary-skill XP raises wage while grape
  mastery XP leaves it unchanged.

## Sanitation follow-up

- Role work bonus now reads the exact matched `SPECIALIZED_ROLES` entry rather
  than assuming the primary-skill key can index it.
- Maximum wage normalization now derives represented skill groups directly from
  `SPECIALIZED_ROLES`; no duplicate hard-coded role-key list remains.
- Updated the staff-search tuning comment and consolidated Staff-page constant
  imports.
