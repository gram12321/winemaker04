---
name: javascript-typescript
description: Use for day-to-day TypeScript and React implementation work in winemaker04, including component code, service logic, typing, and safe refactors aligned to repo conventions.
source: wshobson/agents
license: MIT
---

# JavaScript and TypeScript for Winemaker

## Scope

Use this skill for practical implementation details in winemaker04:

- TypeScript typing and refactors
- React component logic and hooks usage
- Service-layer code changes
- Utility and module organization

Default repo router: `../winemaker-game/SKILL.md`

## Winemaker Rules

- Keep business logic in `src/lib/services/`.
- Keep database reads and writes in `src/lib/database/`.
- Keep pages/components presentation-focused.
- Prefer existing barrel imports from `@/components/ui`, `@/hooks`, `@/lib/services`, `@/lib/utils`, and `@/lib/constants`.
- Use shared types from `src/lib/types/` and `src/components/UItypes.ts`.
- Use named imports and top-of-file imports.

## TypeScript Practices

1. Prefer explicit domain types over ad hoc inline object types.
2. Extend existing shared interfaces before creating parallel shapes.
3. Use narrow union types for domain states.
4. Avoid `any`; use type guards and helper functions instead.
5. Keep function signatures stable at module boundaries.

## React and App Patterns

1. Keep page components orchestration-only.
2. Move calculations and business rules to service functions.
3. Reuse existing hooks when possible (`useLoadingState()`, `useGameStateWithData()`, `useGameState()`).
4. Avoid direct Supabase calls in components.
5. Keep state updates aligned with existing reactive/global update flows.

## Service-Layer Patterns

1. Add constants for tunable values before adding new magic numbers.
2. Keep multi-step calculations in focused service modules.
3. Use domain naming from `CONTEXT.md`.
4. Preserve company-scoped behavior for persisted state.

## Verification

Run the smallest useful checks for changed code:

```bash
npm test
git diff --check
```

For large-risk refactors, expand verification based on impacted areas.
