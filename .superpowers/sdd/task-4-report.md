# Task 4 report

## Completed

- Added the breaking `staff` schema migration: drop `specializations`, add required `task_specializations` JSONB, and enforce its array shape.
- Replaced staff database persistence and mapping with `task_specializations` / `taskSpecializations`; missing or invalid new-column data throws instead of being silently normalized.
- Reworked staff creation, skill generation, wages, staff search calculations, hiring calculations, and previews to use exact `WorkCategory` task specializations and their distinct primary-skill groups.
- Validated staff-search categories before an activity is created and used task display names in hiring messages.
- Converted all starter staff to real task categories; Sales founders intentionally have none.
- Updated focused tests plus two shared staff fixtures that construct `Staff` directly.

## Verification

With dummy Supabase environment values:

```text
npm test -- tests/user/staffSearchCalculations.test.ts tests/finance/wageService.test.ts tests/user/startingConditions.test.ts tests/activity/staffResearchSpeed.test.ts tests/user/staffTeamWorkflow.test.ts
```

Result: 5 files passed, 38 tests passed.

`git diff --check` was rerun after fixing the only whitespace finding.
