# Winery Management Game

Turn-based single-player winery simulation built with React, TypeScript, Vite, Tailwind, ShadCN UI, and Supabase. Core rules live in services/features; React components handle presentation and interaction.

## Quick Start

```bash
npm install
npm run dev
npm test
npm run build
```

## Codebase Map

| Area | Location |
|---|---|
| App/routing/pages | `src/App.tsx`, `src/main.tsx`, `src/components/pages/` |
| UI/hooks | `src/components/ui/`, `src/hooks/` |
| Domain logic | `src/lib/services/`, `src/lib/features/` |
| Persistence | `src/lib/database/`, `migrations/` |
| Types/constants | `src/lib/types/`, `src/lib/constants/` |
| Wine structure | `src/lib/wineStructure/` |
| Tests/admin tools | `tests/`, `src/lib/features/admin/`, `server/` |

## Architecture Rules

| Pattern | Features | Public interface | Lifecycle |
|---|---|---|---|
| Installed feature facade | `achievements`, `loanLender`, `researchUpgrade`, `boardShare` | one static feature value plus public types | assembled once; no opt-out or configuration |
| Development-only feature | `admin` | host type passed to `App` | dynamically loaded in Vite development only |
| Always-on functional module | `weather` | stable function/type barrel | required application capability |

- Keep business logic, validation, calculations, and persistence orchestration out of React components.
- `*DB.ts` files own Supabase CRUD and row mapping; services own domain rules.
- Prefer existing barrel exports and shared types. Do not add compatibility branches or migrations unless requested.
- Callers import feature barrels, not feature internals or general-service re-exports.
- `boardShare` is deliberately inactive and has no host wiring while public-company/share gameplay is deferred.
 - we are in dev phase, and need no backward compability, no need to keep old database tables or backfill database. We will rather edit excisting types/interfaces/enums ect, than extend them. We have no need to keep excisting database structure, its fine to create new scheme and delete old ones. When we change functions/constant or other imports, we should not create reexports or wrappers, instead correct consumers to use the new names.

## Documentation Entry Points

| Need | Document |
|---|---|
| Stable vocabulary and formulas | `CONTEXT.md` |
| Implemented systems | `docs/AIdocs/AIDescriptions_coregame.md` |
| Ownership/module map | `docs/PROJECT_INFO.md` |
| Variable dependencies | `docs/WineSystem_VariableRelationshipMap.md` |
| Change history | `docs/versionlog.md` |
| Research design/status | `docs/superpowers/specs/2026-05-21-research-mechanic-design.md` |
| Weather implementation record | `docs/superpowers/completed/2026-07-10-weather-module-redesign-design.md`, `2026-07-10-weather-module-redesign.md` |
| Bulk grape market rollout | `docs/superpowers/completed/2026-05-23-bulk-grape-buy-market-design.md`, `2026-05-23-bulk-grape-buy-market-execution.md` |
| Public-company reintroduction references | `docs/superpowers/deferred/PublicCompanyPlan.md`, `PublicCompanyImplementation.md` |

## Current Systems

- Activities are owned by the installed `activitiesFeature` at `src/lib/features/activities/`. Host code uses its lifecycle, reads, work-preview, tick, setup, and UI namespaces; activity persistence remains an internal adapter under `database/activities/`.
- Staff competency has three complementary layers: primary skills are the category-derived baseline; persisted broad career roles apply across their matching primary skill; and applied activity work earns exact task mastery. Grape-aware work also earns grape mastery for its variety. The shared work calculator applies the bounded bonuses and is the source for previews and weekly activity progress.
- Research gates cover grapes, fermentation, staff/vineyard caps, contracts, and grape-buyer progression; permanent effects currently include vineyard health-decay reduction.
- Weather is persisted weekly state/forecast, a bounded site-aware vineyard projection, and grape-market context. Weather Center is operational; Winepedia is the technical reference.
- Sell-side grape trading remains separate from Buy Market. Buy Market supports Grape Procurement plus individually owned fixed-capacity casks; a selected occupied cask can be emptied through a cancellable Empty Vessel maintenance activity without discarding the batch volume held by other casks. Cancelling production preserves any wine already placed in an active vessel plan; only unused reservations are released.
- Founder economy is active as a light ownership layer: zero founder wages, profitable-year returns, and buyout into salaried staff.
- Full public-company/share-market runtime is intentionally inactive, and `boardShare` remains isolated from host wiring.

## Admin Test Systems

The dev-only Admin Dashboard exposes automated Vitest runs and Gameflow Lab fixtures. It is loopback-gated, dynamically loaded only in Vite development builds, and fixture cleanup uses durable `testlab_...` run IDs. Its explicit host dependency and Winemaker-fork adapter requirements live in `src/lib/features/admin/README.md`.

## Agent Workflow

Use `skills/winemaker-game/SKILL.md` as the repository router. For substantial work, read the entry docs above, use the relevant planning/worktree/subagent skills, and verify before claiming completion. Keep `docs/versionlog.md` in reverse chronological order using its required entry format.
