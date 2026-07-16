### Task 2: Rewrite the existing work calculator around one allocation result

**Files:**

- Modify: `src/lib/services/activity/workcalculators/workCalculator.ts:63-245`
- Modify: `src/lib/services/activity/index.ts` if its barrel needs the new calculator exports
- Test: `tests/activity/workCalculator.test.ts`

- [ ] Add failing tests for: a Planting specialist helping planting but not harvesting; a Pinot Noir expert helping Pinot planting, harvest, crushing, and fermentation but not Barbera; and a combined task-plus-grape bonus never exceeding the named cap.
- [ ] Rewrite `calculateIndividualStaffContribution` so it derives the primary skill from `WORK_CATEGORY_INFO`, applies a task match only when `staff.taskSpecializations.includes(category)`, and reads grape mastery only from a validated grape-aware activity context.
- [ ] Replace the current multiplicative `1x-2x` grape-XP multiplier with the bounded additive bonus. Retain `calculateEffectiveSkill` for broad-skill XP and leave all non-specialization research modifiers intact.
- [ ] Add a calculator helper that returns the total weekly work plus each employee's scaled share, then update all callers to use that result so there is one formula and no parallel compatibility path.
- [ ] Add an applied-allocation helper that reduces the scaled per-person shares to an exact requested progress delta. It must preserve relative shares, sum exactly to the stored delta, and handle zero work and final-tick clamping.
- [ ] Remove the duplicated hand-calculation in `StaffModal.tsx` after its caller can use the calculator's per-person result; this also removes the existing malformed `skill:<key> ` lookup.
- [ ] Run `npm test -- tests/activity/workCalculator.test.ts` and confirm all existing team-diminishing-return and maintenance cases still pass.
