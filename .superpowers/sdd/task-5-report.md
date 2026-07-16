## Task 5 report

Implemented the staff UI cutover to `taskSpecializations`.

- Staff search presents real activity categories, grouped by their existing primary skill. Sales has no task-specialization option.
- Search results, Staff page, Staff modal, assignment modal, starting-condition preview, and FounderPanel now render task specializations through shared activity display helpers.
- Staff page and Staff modal expose learned Grape Mastery from `grape:` experience entries without exposing storage keys or task XP.
- Assignment previews use `getActivityStaffWorkContext`, `calculateStaffWorkAllocation`, and the calculator-owned `getStaffContributionBreakdown` helper for expected work and matching task/grape bonuses. React does not recreate the bonus formula.
- Skill bars no longer imply that a task specialization boosts an entire primary skill.

Verification:

- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- `npm test -- --run tests/activity/workCalculator.test.ts tests/user/staffSearchCalculations.test.ts` could not collect tests because this isolated worktree has no Supabase environment variables. Vitest stops at `src/lib/database/core/supabase.ts` with `Missing Supabase environment variables`; no test assertion executed.

Review follow-up:

- Moved weather-adjusted weekly work, remaining work, and ETA into `calculateActivityStaffWorkPreview` in the activity manager. The weekly tick, activity-progress service, and assignment modal now consume the same result.
- Added explicit neutral `No task specialization` and no-specialist-wage-premium messaging in StaffModal.
- Re-ran `npx tsc --noEmit` and `git diff --check`: both passed.
- Re-ran the focused Vitest command. It remains blocked before test collection by the same missing Supabase environment variables.
