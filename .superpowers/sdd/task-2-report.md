# Task 2 report: staff work allocation calculator

## Completed

- Replaced broad primary-skill specialization matching with exact `Staff.taskSpecializations` activity-category matching.
- Kept broad skill XP through `calculateEffectiveSkill` and changed grape mastery from a multiplicative 1x–2x factor to the named bounded additive bonus constants.
- Validated grape mastery context inside the calculator: only known grape varieties on Planting, Harvesting, Crushing, or Fermentation can receive a grape-mastery bonus.
- Added `calculateStaffWorkAllocation()`, which returns both total weekly work and the team-scaled per-staff contribution map from a single calculation.
- Added `calculateAppliedStaffWorkAllocation()`, which clamps allocation to actual work applied and calculates the final entry as the remainder so shares sum exactly to the stored delta.
- Made the existing total-work and ETA functions delegate to the allocation calculation.
- Removed StaffModal’s duplicate contribution arithmetic and malformed `skill:<key> ` XP lookup; it now displays the calculator’s allocation result.
- Added focused tests for category-only specializations, Pinot Noir mastery across all four grape-aware activities, nonmatching grape and non-grape contexts, bonus cap, and exact applied allocation.

## Verification

Passed with dummy Supabase configuration:

```powershell
$env:VITE_SUPABASE_URL='http://localhost:54321'
$env:VITE_SUPABASE_ANON_KEY='test-anon-key'
npm test -- tests/activity/workCalculator.test.ts
```

Result: 15 tests passed.

`git diff --check` passed.

`npx tsc --noEmit` was also run. It currently fails only in the remaining clean-cutover migration call sites outside Task 2 (Task 4/UI work still references removed `Staff.specializations` or `SPECIALIZED_ROLES`), including staff DB, search, Staff page/components, and older test fixtures. No Task 2 file appeared in the TypeScript error output.
