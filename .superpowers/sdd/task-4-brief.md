### Task 4: Replace recruitment, wages, starting staff, and persisted schema

- Create an SQL migration which drops `staff.specializations` and adds `staff.task_specializations jsonb NOT NULL DEFAULT '[]'::jsonb` with array-shape check; no mapping/backfill.
- Make staffDB read/write only task_specializations, fail fast if absent; no legacy loader.
- Rename StaffSearchOptions.specializations to taskSpecializations and validate with shared helper.
- Generate skills / wages / search/hiring by distinct primary skill groups represented by task categories.
- Replace starter broad roles with real activity categories; Sales gets none but retains primary skill.
- Candidate messages use display names.
- Update associated tests and focused test suites.
