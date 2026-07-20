# Staff Task and Grape Mastery — Historical Design Record

Status: superseded and implemented differently on 2026-07-16. This file is retained as design history, not an executable plan. The current contract is in `CONTEXT.md`; implementation ownership is in `docs/PROJECT_INFO.md`.

## Outcome

The project kept the desired hierarchy but simplified it to fit the existing staff/activity architecture:

1. A `WorkCategory` selects exactly one broad primary skill.
2. `Staff.specializedRoles` is a persisted, innate broad career-role layer.
3. `Staff.experience["task:<WorkCategory>"]` is learned exact-task mastery.
4. `Staff.experience["grape:<GrapeVariety>"]` is learned grape mastery for validated grape-aware work.

Task mastery is not an innate, recruitable property. It is earned from work actually applied to the activity. Grape mastery is likewise learned and replaces the previous grape-XP speed path; it is not an additional legacy multiplier.

## Implemented competency policy

| Layer | Persistence and acquisition | Scope | Work effect | Wage effect |
|---|---|---|---|---|
| Primary skill | `Staff.skills` plus `skill:<primarySkill>` XP | One skill derived from the activity category | Base work, including effective-skill XP | XP-adjusted skills contribute to wage |
| Broad career role | `Staff.specializedRoles`; selected in starting conditions/recruitment | Every activity using its matching primary skill | +20% | One premium per represented role skill group |
| Task mastery | `experience["task:<WorkCategory>"]`; earned from applied work | One exact implemented activity category | Up to +20% | None |
| Grape mastery | `experience["grape:<GrapeVariety>"]`; earned from applied grape-aware work | Matching variety during planting, harvesting, crushing, and fermentation | Up to +10% | None |

Role, task, and grape effects are additive and capped at +50%. Task tracks exist for every currently implemented `WorkCategory`, including clearing, maintenance, search, finance, and administration activities. Sales has no task track or placeholder until a Sales work category is introduced.

## Applied-work rule

`workCalculator.ts` is the one source of individual contributions and the team allocation. The activity tick awards broad-skill XP, exact task XP, and eligible grape XP only from the portion of work that is persisted after multitasking, team diminishing returns, weather, storage capacity, and final-completion limits. Assignments therefore affect only future work.

## Deliberately not implemented

This historical proposal also considered production-contribution ledgers, provenance snapshots, transactional activity receipts, and quality effects. They are not part of the completed staff competency refactor and must not be inferred from the current staff system. Any future production-attribution feature needs a separately approved design.
