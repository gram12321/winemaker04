# Staff Specialization Refactor — Completed Implementation Record

Status: completed with follow-up design corrections on 2026-07-16. This file records the completed breaking refactor; it is not an active implementation plan. See `CONTEXT.md` for the authoritative current model.

## Final design

The initial cutover proposal replaced broad roles with recruited task specializations. That was corrected during implementation: Winemaker keeps broad roles and makes task specialization learned mastery.

| Layer | Final representation | Meaning |
|---|---|---|
| Broad primary skill | `Staff.skills` and `WORK_CATEGORY_INFO[category].skill` | The baseline skill family for an activity. |
| Broad career role | `Staff.specializedRoles` | An innate, persisted role with title/description, a matching-primary-skill bonus, and a wage premium. |
| Task mastery | `Staff.experience["task:<WorkCategory>"]` | Learned exact-task progression, awarded from applied work. |
| Grape mastery | `Staff.experience["grape:<GrapeVariety>"]` | Learned variety-specific progression for grape-aware activities. |

The six persisted roles are Vineyard Manager, Master Winemaker, Maintenance Technician, Administration & Research Manager, Sales Director, and Finance Director. Their matching role bonus is 20%. They remain available in recruitment and starting conditions, and their title/description are player-visible.

Every implemented activity category has a learned task track. For example, Field includes planting, harvesting, and clearing; Winery includes crushing and fermentation. Task mastery is never selected during recruitment or starting conditions. Sales remains a broad skill with no task track until a Sales activity exists.

Grape mastery is limited to planting, harvesting, crushing, and fermentation, with a valid snapshotted variety. It replaces the older grape-XP speed calculation. It does not apply to clearing or other non-grape activities.

## Work and compensation rules

- The work calculator derives the primary skill from `WORK_CATEGORY_INFO`, applies effective broad-skill XP, then applies matching role, task, and grape bonuses.
- Task mastery can add up to 20%; grape mastery can add up to 10%; role/task/grape bonuses are additive and capped at 50%.
- Existing multitasking, team diminishing-return, weather, research, storage, and final-tick logic remains part of the work allocation.
- Broad-skill, task, and eligible grape XP are credited only from work actually persisted after those limits.
- Weekly wage uses XP-adjusted broad primary skills plus a premium for the distinct broad-role skill groups. Task and grape mastery do not change wage.

## Persisted schema cutover

`migrations/20260715100000_replace_staff_specializations.sql` performs the breaking transition:

- removes legacy `staff.specializations`;
- removes the interim `staff.task_specializations` column;
- adds required, validated `staff.specialized_roles` JSONB with an empty-array default; and
- leaves the existing `experience` JSONB map in place for broad-skill, task, and grape XP.

There is no runtime compatibility path for the removed columns. The migration must be deployed with the application version that reads and writes `specialized_roles`.

## Player-facing surfaces and ownership

- `src/lib/constants/staffConstants.ts` owns role metadata and staff tuning.
- `src/lib/constants/activityConstants.ts` owns category-to-primary-skill mapping and task display helpers.
- `src/lib/services/activity/workcalculators/workCalculator.ts` owns bonus and applied-allocation calculations.
- `src/lib/services/user/staffPresentationService.ts` turns namespaced XP into display-ready broad-skill, Task Mastery, and Grape Mastery sections.
- `src/components/pages/Staff.tsx` and `src/components/ui/modals/UImodals/StaffModal.tsx` display roles, task mastery, and grape mastery separately.
- `src/lib/database/core/staffDB.ts` validates and persists `specialized_roles` and the experience map.
