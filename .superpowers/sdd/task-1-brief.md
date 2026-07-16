### Task 1: Establish task-specialization constants and replace the shared contract

**Files:**

- Modify: `src/lib/types/types.ts:5-22, 915-939, 959-967`
- Modify: `src/lib/constants/activityConstants.ts:95-225`
- Modify: `src/lib/constants/staffConstants.ts:68-128`
- Modify: `src/lib/utils/icons.tsx:58-70`
- Test: `tests/activity/workCalculator.test.ts`

- [ ] Add a failing contract test showing that `PLANTING` is recognized as a task specialization and `field` is not recognized as one.
- [ ] Replace `Staff.specializations` with required `Staff.taskSpecializations: WorkCategory[]`; do not add a compatibility alias or optional fallback.
- [ ] Add `isStaffSpecializationCategory`, `getStaffSpecializationCategories`, and display helpers next to `WORK_CATEGORY_INFO`. Derive primary skills from the existing mapping rather than duplicating them in a new map.
- [ ] Replace `SPECIALIZED_ROLES` with task-category labels, descriptions, and icons derived from the existing activity metadata. Do not expose a Sales specialization while Sales lacks a `WorkCategory`.
- [ ] Add named tuning constants for matching-task bonus, maximum grape-mastery bonus, maximum combined specialization bonus, and distinct-primary-skill wage premium. Start with the current 20% task effect and a smaller grape effect; all final values remain centralized and tunable.
- [ ] Update the test helper staff fixtures to use task categories and run `npm test -- tests/activity/workCalculator.test.ts`.
