---
name: winemaker-game
description: Use as the default router and repo skill for work in winemaker04, including feature work, bug fixes, refactors, docs updates, and verification. Route to local specialist skills by task type instead of generic game-engine flows.
---

# Winemaker Game

## Purpose

This is the default repo skill for Winemaker. It is both:

1. The project-convention guardrail skill.
2. The router skill that selects other local skills based on the task.

Do not use generic 2D or 3D game-stack routing as a default in this repo.

## Session Start

Start user-facing work with a short AI check message:

```text
AI check: <1-5> - <brief reason>
```

Use `1` for a clear, low-risk request and `5` for ambiguous or broad work.

Before changing code, read the smallest relevant set of docs:

1. `readme.md`
2. `CONTEXT.md`
3. `docs/AIdocs/AIDescriptions_coregame.md`
4. `docs/PROJECT_INFO.md`
5. `docs/WineSystem_VariableRelationshipMap.md`

## Routing Matrix

After classifying the user request, route to the matching specialist skills.

| Task type | Primary skill(s) | Secondary skill(s) |
|---|---|---|
| Feature design, option exploration, unclear requirements | `../brainstorming/SKILL.md` | `../writing-plans/SKILL.md` |
| Multi-step implementation from an approved plan | `../executing-plans/SKILL.md` | `../subagent-driven-development/SKILL.md` |
| React or TypeScript implementation details | `../javascript-typescript/SKILL.md` | `../react-best-practices/SKILL.md` |
| ShadCN component composition and UI consistency | `../shadcn-best-practices/SKILL.md` | `../react-best-practices/SKILL.md` |
| Bug reports, regressions, failing tests, unexpected behavior | `../systematic-debugging/SKILL.md` | `../diagnose/SKILL.md` |
| Database query, schema, index, or RLS performance concerns | `../supabase-best-practices/SKILL.md` | repo migration/database tooling guidance |
| About to claim completion or fixed status | `../verification-before-completion/SKILL.md` | `../requesting-code-review/SKILL.md` |
| Writing or fixing skills | `../writing-skills/SKILL.md` | `../write-a-skill/SKILL.md` |
| Architecture-level refactor opportunities | `../improve-codebase-architecture/SKILL.md` | `../zoom-out/SKILL.md` |

## Non-Default Skills In This Repo

The following are non-default here and should only be used when explicitly requested by the user or clearly required by task context:

- `../game-studio/SKILL.md`
- `../phaser-2d-game/SKILL.md`
- `../three-webgl-game/SKILL.md`
- `../react-three-fiber-game/SKILL.md`
- `../sprite-pipeline/SKILL.md`
- `../web-3d-asset-pipeline/SKILL.md`
- `../web-game-foundations/SKILL.md`
- `../game-ui-frontend/SKILL.md`
- `../game-playtest/SKILL.md`

## Core Winemaker Rules

- Keep business logic in `src/lib/services/`.
- Keep Supabase reads and writes in `src/lib/database/`.
- Keep pages and UI components focused on presentation and interaction.
- Prefer barrel imports from `@/components/ui`, `@/hooks`, `@/lib/services`, `@/lib/utils`, and `@/lib/constants`.
- Use shared types from `src/lib/types/` and `src/components/UItypes.ts`.
- Follow current wine terminology: `structureIndex`, `tasteQualityIndex`, `wineScore`, compact `WineAnchorValues`.
- Do not add legacy data-shape support unless explicitly requested.
- Keep persisted gameplay data company-scoped via current company flow.
- Services should trigger global updates for state changes.
- Use `calculateTotalWork()` and established activity work calculators for activity work.
- Use named ES module imports and keep imports at top of file.
- Use `useLoadingState()`, `useGameStateWithData()`, and `useGameState()` where they match local patterns.
- Extract tunable gameplay numbers into named constants.

## Project Preferences

- Do not commit changes unless explicitly asked.
- Do not start `npm run dev` unless explicitly asked.
- Do not run `npm run build` by default; use only when asked or when change risk justifies it.
- After major updates, ask whether `readme.md` and `docs/versionlog.md` should be updated.
- For schema changes, update SQL under `migrations/` after validating intended DB changes.

## Key Locations

| Area | Path |
|---|---|
| Core types | `src/lib/types/types.ts` |
| UI types | `src/components/UItypes.ts` |
| Core services | `src/lib/services/core/` |
| Vineyard services | `src/lib/services/vineyard/` |
| Wine services | `src/lib/services/wine/` |
| Structure index | `src/lib/wineStructure/` |
| Sales services | `src/lib/services/sales/` |
| Finance services | `src/lib/services/finance/`, `src/lib/services/user/` |
| Activity services | `src/lib/services/activity/` |
| Database layer | `src/lib/database/` |
| Game constants | `src/lib/constants/` |
| Wine feature constants | `src/lib/constants/wineFeatures/` |
| Taste constants | `src/lib/constants/taste/` |

## Domain Workflows

### Weekly Tick Changes

1. Inspect `src/lib/services/core/gameTick.ts`.
2. Keep calculations in domain services, not `gameTick.ts`.
3. Preserve company-scoped behavior and global update flow.

### Gameplay System Changes

1. Update shared types first when domain shape changes.
2. Add constants before wiring numbers in services.
3. Keep DB access in `src/lib/database/` only.
4. Keep page components orchestration-focused.

### Wine Feature Changes

1. Add feature constants under `src/lib/constants/wineFeatures/`.
2. Update behavior under `src/lib/services/wine/features/`.
3. Update wine batch types only when persisted shape changes.
4. Update wine UI components under `src/components/ui/wine/` as needed.

### Contract Requirement Changes

1. Update `ContractRequirement` typing and requirement constants.
2. Implement validation in sales/contracts services.
3. Keep taste, structure, and site requirements separate unless explicitly redesigning.
4. Update relevant docs when variable relationships change.

## Documentation Maintenance

After implementation:

- Update `CONTEXT.md` when terminology/variables/constants change.
- Update `docs/PROJECT_INFO.md` when files/modules move or ownership changes.
- Update `docs/AIdocs/AIDescriptions_coregame.md` when implementation status changes.
- Update `docs/WineSystem_VariableRelationshipMap.md` when variable relationships change.
- Keep `readme.md` concise.

## Verification Minimum

Use the smallest useful set for the change:

```bash
npm test
git diff --check
```

For docs passes, also search for stale names across `docs`, `readme.md`, `CONTEXT.md`, `src`, and `tests`.

## Core Rules

- Keep business logic in `src/lib/services/`.
- Keep Supabase reads and writes in `src/lib/database/`.
- Keep React components focused on UI state, display, and user interaction.
- Prefer existing barrel exports from `@/components/ui`, `@/hooks`, `@/lib/services`, `@/lib/utils`, and `@/lib/constants`.
- Use shared types from `src/lib/types/` and `src/components/UItypes.ts`.
- Follow current wine terminology: `structureIndex`, `tasteQualityIndex`, `wineScore`, and compact `WineAnchorValues`.
- Database parsing only accepts current compact wine anchor keys. Do not add legacy data-shape support unless explicitly requested.
- Scope persisted gameplay data by company and follow the current `getCurrentCompanyId()` database flow.
- Services should trigger global updates when state changes; components should refresh through existing reactive hooks.
- Use `calculateTotalWork()` and established activity managers/work calculators for activity work.
- Use ES module imports, named imports where practical, and imports at the top of files.
- Use shared hooks such as `useLoadingState()`, `useGameStateWithData()`, and `useGameState()` where they fit the local pattern.
- Use shared interfaces such as `PageProps`, `NavigationProps`, and `CompanyProps` where applicable.
- Extract meaningful tunable gameplay numbers into named constants with design intent.

## Project Preferences

- Do not commit changes unless the user explicitly asks.
- Do not start `npm run dev` unless the user asks.
- Do not run `npm run build` by default; use it when asked or when build-risk justifies it.
- After major updates, ask whether `readme.md` and `docs/versionlog.md` should be updated.
- For schema changes, update the relevant SQL under `migrations/` after validating the intended database change.

## Key Locations

| Area | Path |
|---|---|
| Core types | `src/lib/types/types.ts` |
| UI types | `src/components/UItypes.ts` |
| Core services | `src/lib/services/core/` |
| Vineyard services | `src/lib/services/vineyard/` |
| Wine services | `src/lib/services/wine/` |
| Structure index | `src/lib/wineStructure/` |
| Sales services | `src/lib/services/sales/` |
| Finance services | `src/lib/services/finance/`, `src/lib/services/user/` |
| Activity services | `src/lib/services/activity/` |
| Database layer | `src/lib/database/` |
| Game constants | `src/lib/constants/` |
| Wine feature constants | `src/lib/constants/wineFeatures/` |
| Taste constants | `src/lib/constants/taste/` |

## Workflows

### New Development Session

1. Read `readme.md`, `CONTEXT.md`, `docs/AIdocs/AIDescriptions_coregame.md`, `docs/PROJECT_INFO.md`, and the relevant domain docs.
2. Inspect current code before making assumptions from docs.
3. Keep new logic aligned with existing services, constants, types, and barrel exports.
4. Run focused tests for the changed area, then broader checks when risk justifies it.

### Weekly Game Tick Changes

Winemaker uses manual week advancement. When adding systems that progress over time:

1. Inspect `src/lib/services/core/gameTick.ts`.
2. Place new work where its dependencies are already available.
3. Keep substantial calculations in domain services, not in `gameTick.ts`.
4. Preserve company-scoped state and global update behavior.

### Gameplay System Changes

- Add or update shared types first when the domain shape changes.
- Add constants before wiring magic numbers into services.
- Implement calculations in the relevant service domain.
- Add database access only through `src/lib/database/`.
- Keep page components orchestration-focused and push complex UI logic into hooks or focused components.
- Update docs when terminology, variable relationships, or implementation status changes.

### Wine Feature Changes

1. Add feature constants/config under `src/lib/constants/wineFeatures/`.
2. Update behavior under `src/lib/services/wine/features/`.
3. Update wine batch types if new persisted state is needed.
4. Update display components under `src/components/ui/wine/` or shared wine UI components.
5. Add focused tests for feature risk, lifecycle, scoring, or display behavior.

### Contract Requirement Changes

1. Update `ContractRequirement` typing and requirement constants.
2. Implement validation in the sales/contracts service layer.
3. Keep taste, structure, and site requirements separate unless a design explicitly combines them.
4. Update UI labels, filters, and breakdowns.
5. Update `CONTEXT.md` and `docs/WineSystem_VariableRelationshipMap.md` if the requirement introduces a new variable relationship.

### Documentation Maintenance

After implementation work:

- Update `CONTEXT.md` when terminology, constants, parameters, variables, or naming policy changes.
- Update `docs/PROJECT_INFO.md` when files move, modules are renamed, or ownership boundaries change.
- Update `docs/AIdocs/AIDescriptions_coregame.md` when implementation status changes.
- Update `docs/WineSystem_VariableRelationshipMap.md` when variable dependencies or game-flow relationships change.
- Keep `readme.md` concise. Do not turn it into a second system-status document.
- Remove stale names instead of documenting compatibility branches that no longer exist.

### Cleanup And Refactoring

Look for:

- Business logic in the wrong layer.
- Duplicate services, helpers, hooks, types, constants, or UI patterns.
- Dead code, unused imports, placeholder functions, and redundant implementations.
- Obvious comments that restate code behavior.
- Inefficient loops, unnecessary database calls, or poor algorithms.

Keep cleanup behavior-preserving unless the user explicitly asks for behavior changes.

## Verification

Use the smallest useful verification set for the change:

```bash
npm test
git diff --check
```

For documentation passes, also search for stale feature-specific names across `docs`, `readme.md`, `CONTEXT.md`, `src`, and `tests`.
