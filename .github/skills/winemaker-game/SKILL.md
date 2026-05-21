---
name: winemaker-game
description: Guides development, documentation, and refactoring work for the Winemaker winery management game. Use when working in the winemaker04 repo, changing winery gameplay systems, updating project docs, starting a new coding session, or cleaning/refactoring game code.
---

# Winemaker Game

## Quick Start

This is a single-player, turn-based winery management game built with React, TypeScript, Vite, Tailwind, ShadCN UI, and Supabase.

Start user-facing work with a short AI check message:

```text
AI check: <1-5> - <brief reason>
```

Use `1` for a clear, low-risk request and `5` for ambiguous or large work. Keep it to one sentence.

Before changing code, read the smallest relevant set of project docs:

1. `readme.md`
2. `CONTEXT.md`
3. `docs/AIdocs/AIDescriptions_coregame.md`
4. `docs/PROJECT_INFO.md`
5. `docs/WineSystem_VariableRelationshipMap.md`

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
