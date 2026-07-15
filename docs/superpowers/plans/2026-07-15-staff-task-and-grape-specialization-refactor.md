# Staff Task and Grape Specialization Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Winemaker's broad-role staff specializations with specializations for its real activity categories, and make existing grape XP a bounded cross-cutting grape-mastery bonus for every grape-aware activity.

**Architecture:** Keep the existing `Staff.skills` primary-skill model and `WorkCategory` enum, but make a clean schema cutover: remove the broad-role `specializations` column and replace it with `taskSpecializations: WorkCategory[]`. Reuse `Staff.experience` for broad-skill XP plus `grape:<GrapeVariety>` mastery. Rewrite `workCalculator.ts` as the single staff-work engine; `activityManager.ts` consumes its per-person allocation so progress and XP use the same actually applied work.

**Tech Stack:** React, TypeScript, Supabase/Postgres migrations, Vitest.

---

## Confirmed scope and decisions

- A primary skill remains the current `WORK_CATEGORY_INFO[category].skill`: `field`, `winery`, `maintenance`, `financeAndStaff`, `administrationAndResearch`, or `sales`.
- A task specialization is the exact existing `WorkCategory` that the employee is unusually good at. Examples: `PLANTING`, `HARVESTING`, `CLEARING`, `CRUSHING`, and `FERMENTATION`.
- Do not add `TaskSpecializationId`, task XP keys, Office Tycoon-style work profiles, or mixed skill weights. `Staff.taskSpecializations` is the sole innate/recruited task-specialization field.
- Grape mastery remains learned experience under `experience["grape:<variety>"]`. It applies to every explicitly grape-aware current activity: planting, harvesting, crushing, and fermentation setup. It does not apply merely because an arbitrary activity parameter happens to be named `grape`.
- Sales has no current `WorkCategory`; do not invent a `sales` placeholder specialization. It remains a primary skill with no subskill until a real sales activity exists. The same rule applies to future primary skills without a concrete activity.
- This is a breaking release for persisted staff specialization data. Older save files and schemas are not supported; deploy the schema change together with the matching application version.
- Every current non-sales `WorkCategory` is eligible as a specialization, including maintenance, finance/staff, and administration/research. If a broad category is later split into narrower activities, add the new category then; do not pre-create speculative subskills now.
- A matching task specialization provides a named, bounded work bonus. Grape mastery provides a separate bounded bonus from normalized grape XP. Combine the two bonuses additively and cap the total specialization bonus; never multiply an old 20% task bonus by a 1-2x grape multiplier.
- Preserve the existing broad-skill effective-XP formula, multitasking penalty, team diminishing returns, weather, and research modifiers. Correct the current mismatch where individual XP can exceed the activity's scaled or final-clamped work.
- This plan deliberately does not add production-provenance JSONB, an activity-tick RPC, or permanent wine-quality effects. Those are a second, dependent plan after this refactor establishes correct per-worker applied-work allocations. See the explicit follow-on boundary below.

## Clean schema cutover

There is no backward-compatible read path and no value conversion. The database migration drops `staff.specializations` and creates `staff.task_specializations` as a required JSON array. Existing staff rows keep their other data, but start with an empty task-specialization array; old broad-role specialization values are intentionally discarded. The application must never read, write, or normalize the removed column.

Persisted wages do not change during the cutover. For newly created staff, calculate the specialization wage premium by the number of distinct primary-skill groups represented by their task specializations, not by raw task count.

## File structure

| Path | Responsibility after this work |
|---|---|
| `src/lib/types/types.ts` | Replace `Staff.specializations` with required `taskSpecializations: WorkCategory[]`. |
| `src/lib/constants/activityConstants.ts` | Remains the canonical category-to-primary-skill mapping and gains task-specialization eligibility/display helpers. |
| `src/lib/constants/staffConstants.ts` | Holds named task/grape bonus and wage-tuning constants; replaces broad-role display metadata. |
| `src/lib/services/activity/workcalculators/workCalculator.ts` | Single source for individual work details, team scaling, applied-work allocation, and task/grape bonus calculation. |
| `src/lib/services/activity/activitymanagers/activityManager.ts` | Resolves grape-aware activity context, applies allocation after all limits, and awards the exact matching XP. |
| `src/lib/services/user/staffService.ts` | Generates task-specialist candidates and preserves only the shared `experience` map. |
| `src/lib/services/finance/wageService.ts` | Prices specializations by distinct primary-skill groups. |
| `src/lib/services/activity/workcalculators/staffSearchWorkCalculator.ts` and `activitymanagers/staffSearchManager.ts` | Search, candidate, wage, and hiring calculations using activity specializations. |
| `src/lib/services/core/startingConditionsService.ts` and `src/lib/constants/startingConditions.ts` | Seed only real activity specializations and assign founders to matching teams. |
| `src/lib/services/vineyard/clearingManager.ts` | Does not create grape mastery accidentally; clearing remains task-only in this release. |
| `src/components/ui/modals/activitymodals/StaffAssignmentModal.tsx`, `src/components/ui/modals/UImodals/StaffModal.tsx`, `src/components/ui/components/StaffSkillBar.tsx`, staff-search modals, and `src/components/pages/Staff.tsx` | Present task specialization and grape mastery using calculator results, without duplicating formulas. |
| `migrations/<timestamp>_replace_staff_specializations.sql` | Drops the old column and creates the clean task-specialization column with empty defaults. |
| `tests/activity/`, `tests/user/`, `tests/finance/` | Cover formula, actual-work conservation, clean schema cutover, recruitment, and UI/service behavior. |

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

### Task 3: Apply actual work and XP consistently in the activity tick

**Files:**

- Modify: `src/lib/services/activity/activitymanagers/activityManager.ts:499-714`
- Modify: `src/lib/services/vineyard/vineyardManager.ts:796-907`
- Modify: `src/lib/services/vineyard/clearingManager.ts:60-84`
- Test: `tests/activity/activityLifecycle.test.ts`

- [ ] Add failing lifecycle tests proving that the sum of awarded per-staff XP equals the activity's actual progress delta after team scaling, weather, and final-tick clamping.
- [ ] Add a single `getActivityGrapeContext` policy in the activity/work-calculator path. It returns a `GrapeVariety` only for planting, harvesting, crushing, and fermentation, after validating the activity's snapshotted parameter. Clearing, maintenance, and administrative work receive no grape XP in this release.
- [ ] Refactor `progressActivities()` to calculate preliminary staff shares, resolve the work that can actually be persisted, allocate that exact amount across staff, then award broad-skill XP and grape XP from those applied shares. Award no task XP.
- [ ] Refactor the storage-limited harvest hand-off so it reports the actual permitted work/progress as well as its merged params. Award XP only for the portion that produced the stored harvest; a capacity-blocked remainder earns no work or XP until resumed.
- [ ] Persist `completedWork` and the final merged harvest params in one `updateActivityInDb` call. Do not let `handlePartialHarvesting()` write a stale params object before `activityManager.ts` writes progress.
- [ ] Make `getActivityProgress()` and the assignment preview call the same calculator/context resolver as the tick, including grape mastery and relevant research modifiers where applicable.
- [ ] Keep `completeActivityNow()` explicitly development-only for this phase and document/test that it does not award synthetic XP. Do not invent fake contributor history.
- [ ] Run `npm test -- tests/activity/activityLifecycle.test.ts tests/activity/workCalculator.test.ts`.

### Task 4: Replace recruitment, wages, starting staff, and the persisted schema

**Files:**

- Create: `migrations/<timestamp>_replace_staff_specializations.sql`
- Modify: `src/lib/database/core/staffDB.ts:12-182`
- Modify: `src/lib/services/user/staffService.ts:40-137, 242-296`
- Modify: `src/lib/services/finance/wageService.ts:15-55`
- Modify: `src/lib/services/activity/workcalculators/staffSearchWorkCalculator.ts:9-197`
- Modify: `src/lib/services/activity/activitymanagers/staffSearchManager.ts:21-43, 102-220`
- Modify: `src/lib/constants/startingConditions.ts`
- Modify: `src/lib/services/core/startingConditionsService.ts:44-50, 251-290`
- Test: `tests/user/staffSearchCalculations.test.ts`
- Test: `tests/finance/wageService.test.ts`
- Test: `tests/user/startingConditions.test.ts`

- [ ] Drop the `staff.specializations` column and add `staff.task_specializations jsonb NOT NULL DEFAULT '[]'::jsonb` with an array-shape check. Do not backfill or map old values.
- [ ] Make `staffDB.ts` read and write only `task_specializations`; fail fast if the new column is absent. No runtime legacy normalizer, alias, or old-save loader is permitted.
- [ ] Rename `StaffSearchOptions.specializations` to `taskSpecializations: WorkCategory[]` and validate choices against the shared eligibility helper before a search activity is created.
- [ ] Rewrite `generateRandomSkills` to convert selected task categories into their distinct primary skills before applying its existing specialized-skill bump. A candidate with Planting and Harvesting is still one Field-oriented worker for base-skill generation.
- [ ] Rewrite `calculateWage`, max-wage normalization, staff-search cost/work, hiring work, and previews to use the number of distinct primary-skill groups rather than raw task count. Keep all numeric premiums in `staffConstants.ts`.
- [ ] Replace starting-condition broad roles with the real task categories they should cover. Give starter Sales staff no task specialization until a sales activity exists; retain their primary `sales` skill.
- [ ] Update staff-search candidate messages to use task display names rather than raw enum values.
- [ ] Run `npm test -- tests/user/staffSearchCalculations.test.ts tests/finance/wageService.test.ts tests/user/startingConditions.test.ts`.

### Task 5: Update the staff and assignment UI without business logic in React

**Files:**

- Modify: `src/components/ui/modals/activitymodals/StaffSearchOptionsModal.tsx`
- Modify: `src/components/ui/modals/activitymodals/StaffSearchResultsModal.tsx`
- Modify: `src/components/ui/modals/activitymodals/StaffAssignmentModal.tsx`
- Modify: `src/components/ui/modals/UImodals/StaffModal.tsx`
- Modify: `src/components/ui/components/StaffSkillBar.tsx`
- Modify: `src/components/pages/Staff.tsx`
- Modify: `src/components/ui/modals/UImodals/StartingConditionsModal.tsx`
- Test: focused staff UI tests near existing activity/user suites, or service-backed component tests where the project already uses them

- [ ] Replace broad-role checkboxes with task categories grouped under their existing primary skill. Show no Sales subskill section until a sales activity is implemented.
- [ ] Replace every `SPECIALIZED_ROLES[spec]` and broad-role icon lookup with the shared task-category display helper. Audit Staff page, Staff modal, assignment modal, search results, starting-condition preview, and founder summary.
- [ ] In the Staff view, show a separate learned Grape Mastery section by filtering `experience` keys with the `grape:` prefix. Do not expose raw keys or show a task-XP section that does not exist.
- [ ] In the assignment modal, show the selected activity's matching task bonus, grape mastery bonus when relevant, and total expected work. Obtain all numbers from the rewritten calculator; React only renders the result.
- [ ] Remove the old claim that specializations broadly boost a primary skill, update wage copy to describe task-specialist compensation, and retain neutral displays for staff with no task specializations.
- [ ] Verify a new Sales task specialist cannot be created through the old UI path, while a high-Sales employee still displays and retains their primary skill.

### Task 6: Finish the migration safely and document the system

**Files:**

- Modify: `CONTEXT.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md`
- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/WineSystem_VariableRelationshipMap.md`
- Modify: `docs/superpowers/plans/2026-07-14-staff-task-grape-mastery.md`

- [ ] Add a migration test or reproducible SQL fixture proving the old column is absent, the new column is present, and existing rows receive `[]`; no old specialization value may remain in the database.
- [ ] Add regression tests for mid-activity assignment changes: past applied XP stays earned, newly assigned staff only earn future applied work, and a removed worker earns nothing after removal.
- [ ] Search `src` and `tests` for `specializations`, `SPECIALIZED_ROLES`, `getSpecializationIcon`, `experience[`, and direct staff-work arithmetic. Route all remaining task/grape calculations through the rewritten work calculator and remove obsolete broad-role references.
- [ ] Update the four living documentation files with the primary-skill/task-specialization/grape-mastery relationship, the grape-aware categories, and the explicit absence of Sales subskills.
- [ ] Run the focused staff, activity, finance, and starting-condition suites; then run `npm test`, `npm run build`, and `git diff --check`. Do not commit unless the human owner explicitly asks.

## Explicit follow-on: production-quality attribution

The earlier plan combined this refactor with a full activity ledger, vineyard/batch provenance columns, RPC receipts, and quality effects. That is intentionally not part of this implementation: it would add a parallel production architecture before the staff formula and migrated data are stable.

The next plan should build directly on Task 3's exact applied-work allocation. It should accumulate only the applied contribution and grape-mastery snapshot while a production activity runs, then bake a contribution-weighted stage result into existing vineyard or batch outcome paths at planting, harvest, crushing, and fermentation setup. It must handle partial harvest portions before batch merge, use existing wine `breakdown`/anchor history where possible, and never recalculate historic wine quality from today's team membership. Sales should affect commercial outcomes only once a real Sales activity exists; it must never change an already bottled wine.

## Acceptance criteria

- New staff specializations are existing activity categories, not broad role strings or placeholder Sales subskills.
- Each activity continues to use exactly one existing primary skill; no mixed skill profiles are introduced.
- A task specialist helps only their matching activity category, while grape mastery helps only the matching grape across planting, harvesting, crushing, and fermentation setup.
- Task and grape bonuses are bounded, centrally tuned, and cannot recreate the prior 2x grape-XP multiplier or stack without limit.
- The total XP credited for an activity is allocated from the work actually applied after team, weather, storage, and final-tick limits.
- The database contains no `specializations` column or broad-role values; existing rows use the new `task_specializations` column (empty unless explicitly assigned after the cutover), and runtime code has no backward-compatibility path.
- Existing primary Sales skill remains valid, but has no task specialization until a Sales activity is implemented.
- Components display calculator results and shared labels; no component implements a second staff-work formula.
