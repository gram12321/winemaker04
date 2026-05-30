---
name: js-ts-best-practices
description: Use for day-to-day JavaScript and TypeScript implementation in winemaker04, including React component code, service logic, shared typing, module organization, and safe refactors aligned to repo conventions.
source: wshobson/agents
license: MIT
---

# JS and TS Best Practices

## Purpose

Apply practical TypeScript, React, and module-organization guidance for the Winemaker codebase. Use `../winemaker-game/SKILL.md` as the default repo router; this skill owns language and implementation details after the repo boundaries are clear.

## Use When

- Writing or refactoring TypeScript in `src/`, `server/`, or `tests/`.
- Updating React component logic, hooks, props, or UI state.
- Moving logic between components, services, database modules, utilities, constants, or types.
- Tightening types, removing `any`, or stabilizing module boundaries.
- Reviewing implementation quality before completion.

## Repo Fit

Current stack: React 19, TypeScript 5, Vite 7, Tailwind 3, ShadCN/Radix UI, Supabase JS 2, and Vitest.

- Keep business logic in `src/lib/services/`.
- Keep database reads and writes in `src/lib/database/`.
- Keep pages/components presentation-focused.
- Prefer existing barrel imports from `@/components/ui`, `@/hooks`, `@/lib/services`, `@/lib/utils`, and `@/lib/constants`.
- Use shared types from `src/lib/types/` and `src/components/UItypes.ts`.
- Use domain language from `CONTEXT.md`: `structureIndex`, `tasteQualityIndex`, `wineScore`, and compact `WineAnchorValues`.
- Preserve company-scoped persistence and the existing global/topic update flow.
- Do not add legacy data-shape compatibility unless the user explicitly asks.

## Workflow

1. Classify the change by ownership: UI, hook, service, database, constants, types, tests, or docs.
2. Read the smallest relevant local files before editing.
3. Update shared types first when the domain shape changes.
4. Put tunable gameplay numbers in named constants before using them in services or UI.
5. Keep imports named and at the top of the module.
6. Add or update targeted tests when behavior changes.

## Core Rules

### Types

1. Prefer explicit domain types over ad hoc inline object types.
2. Extend existing shared interfaces before creating parallel shapes.
3. Use narrow union types for domain states.
4. Avoid `any`; use type guards and helper functions instead.
5. Keep function signatures stable at module boundaries.

### React

1. Keep page components orchestration-only.
2. Move calculations and business rules to service functions.
3. Reuse existing hooks when possible (`useLoadingState()`, `useGameStateWithData()`, `useGameState()`).
4. Avoid direct Supabase calls in components.
5. Keep state updates aligned with existing reactive/global update flows.

### Services And Utilities

1. Add constants for tunable values before adding new magic numbers.
2. Keep multi-step calculations in focused service modules.
3. Use domain naming from `CONTEXT.md`.
4. Preserve company-scoped behavior for persisted state.
5. Keep utility helpers small and shared only when there is real reuse.

## Reference Map

| Need | Start here |
|---|---|
| Repo routing and architecture boundaries | `../winemaker-game/SKILL.md` |
| React performance and render behavior | `../react-best-practices/SKILL.md` |
| ShadCN component composition | `../shadcn-best-practices/SKILL.md` |
| Supabase/Postgres work | `../supabase-best-practices/SKILL.md` |
| Stable domain terms | `../../CONTEXT.md` |
| Current implementation status | `../../docs/AIdocs/AIDescriptions_coregame.md` |

## Verification

Use the smallest useful checks for the change. For finished code work, default to:

```bash
npm test
git diff --check
```

For large-risk refactors, expand verification based on the impacted domain.
