# Activities Feature Isolation Design

**Date:** 2026-07-18  
**Status:** Completed. The approved facade and ownership boundary are implemented; see the corresponding completed implementation plan for the migration record.

## Goal

Move the activity system into `src/lib/features/activities/` and expose one small, stable `activitiesFeature` facade. Preserve current runtime behavior and UI while removing direct activity-service, activity-database, and activity-constant imports from the rest of the application.

This is development-stage work. Backward compatibility is explicitly out of scope: old barrels, old interfaces, old enum shapes, old database structures, and legacy data do not need to remain usable. Existing types and schemas may be replaced, and old tables may be dropped when the current implementation is migrated.

## Architecture

`activitiesFeature` owns the activity control plane:

- activity creation, lifecycle, persistence orchestration, and weekly progression;
- activity work allocation, previews, calculators, validation, and activity metadata;
- activity-specific managers such as land search, staff search, and bookkeeping;
- activity-specific UI including the activity panel, cards, assignment UI, generic options UI, and activity task modals.

The Supabase adapter remains under `src/lib/database/activities/`, following the repository rule that database adapters stay in `src/lib/database/`. It is an internal implementation detail of the feature and is not re-exported through general service barrels.

Shared domain types such as `Activity`, `ActivityProgress`, `ActivityCreationOptions`, `WorkCategory`, and staff types remain in `src/lib/types/` when they are genuinely shared by staff, core game state, and activities. Activity-only metadata and tunable constants move into the feature.

Domain features retain their domain rules. Loan and research completion logic remains owned by `loanLenderFeature` and `researchUpgradeFeature`; the activities feature invokes those public workflows at completion without importing their internal services. Late public-facade resolution may be used where necessary to remove the current module-cycle path. Staff remains an explicit dependency for assignment, team allocation, and XP awarding, but staff code does not depend on activity internals.

## Public facade

`src/lib/features/activities/index.ts` exports only `activitiesFeature` and public feature types. `feature.tsx` composes the implementation and lazy UI entry points. The facade is organized by responsibility:

```ts
interface ActivitiesFeature {
  lifecycle: {
    create(options: ActivityCreationOptions): Promise<string | null>;
    createWithResult(options: ActivityCreationOptions): Promise<ActivityCreationResult>;
    update(id: string, updates: Partial<Activity>): Promise<boolean>;
    pause(id: string): Promise<boolean>;
    resume(id: string): Promise<boolean>;
    activate(id: string, params: Record<string, unknown>): Promise<boolean>;
    completeNow(id: string): Promise<{ success: boolean; error?: string; activity?: Activity }>;
    cancel(id: string): Promise<boolean>;
  };
  reads: {
    getAll(): Promise<Activity[]>;
    getById(id: string): Promise<Activity | null>;
    getProgress(id: string): Promise<ActivityProgress | null>;
  };
  work: {
    getContext(...): Promise<ActivityStaffWorkContext>;
    getPreview(...): ActivityStaffWorkPreview;
  };
  ticks: {
    progress(): Promise<void>;
    checkAndTriggerBookkeeping(...): Promise<void>;
  };
  setup: { initialize(): Promise<void> };
  ui: {
    renderActivityPanel(): ReactNode;
    renderActivityModals(): ReactNode;
  };
}
```

The exact signatures will follow existing types and callers; the important constraint is ownership and the absence of implementation re-exports. Constants and calculation helpers are public only when a consumer needs them to construct or preview an activity, and then are exposed through typed feature namespaces rather than the general services barrel.

## Migration and removal

The implementation will:

1. Move the current activity implementation into feature-local `services/`, `work/`, `constants/`, and `ui/` folders.
2. Move activity-specific React components into the feature, retaining domain-owned components outside it when their primary responsibility is sales, vineyard, wine, loan, or research presentation rather than activity management.
3. Update core tick, startup, layout, staff UI/services, vineyard/wine/sales flows, loan/research features, admin fixtures, and tests to use `activitiesFeature`.
4. Replace the old `src/lib/services/activity/index.ts` surface and remove its `src/lib/services/index.ts` re-export.
5. Replace direct activity database imports with the feature’s internal adapter use; no external consumer may import `database/activities/activityDB.ts` directly.
6. Replace or remove obsolete interfaces, enum members, forwarding helpers, and constants instead of retaining aliases.
7. Update the activity SQL schema/migrations as needed for the current model. Because this is development-only, old activity tables or columns may be dropped and recreated; no legacy backfill or compatibility migration is required.

Storage-vessel allocation references to `activities.id` must remain valid. If the activity identifier or table is replaced, the related current schema and RPCs are updated together rather than preserving an obsolete compatibility layer.

## Data flow

```text
core tick / host UI / domain feature
              |
              v
       activitiesFeature
       |       |       |
   lifecycle  work    feature UI
       |       |
 activity DB  staff public services/types
       |
  current activity schema
```

Weekly progression captures the current company/game state once, calculates applied staff work, persists progress, awards staff XP, dispatches domain completion workflows, removes completed activities, and refreshes visible game state. The refactor must preserve ordering, partial planting/harvesting behavior, storage blocking, pause/resume semantics, notifications, and completion side effects.

## Testing and acceptance

- Existing activity lifecycle, work-calculation, staff-assignment, and completion tests pass after import migration.
- Add facade tests proving the public API can create/read/progress an activity without importing implementation files.
- Add an import-boundary test or repository scan showing no production consumer imports `src/lib/services/activity`, activity DB adapters, or activity-only constants directly.
- Verify core tick, staff, vineyard, wine, sales, loan, research, and admin consumers through their public seams.
- Run TypeScript checks, the full test suite, production build when the moved UI warrants it, and `git diff --check`.
- Run the Winemaker architecture sanitation sweep for UI business logic, persistence placement, hardcoded tunables, and barrel/import drift.
- Update `readme.md`, `docs/PROJECT_INFO.md`, `docs/AIdocs/AIDescriptions_coregame.md`, and `CONTEXT.md` where ownership or terminology changes.

## Non-goals

- No behavior redesign or balancing pass.
- No attempt to preserve old activity imports or old database rows.
- No isolation of the staff system in this task.
- No generic plugin/registration framework beyond the smallest completion boundary needed to avoid feature cycles.
- No unrelated cleanup of domain services.
