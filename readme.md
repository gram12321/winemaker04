# Winery Management Game

Turn-based single-player winery simulation built with React, TypeScript, Vite, Tailwind, ShadCN UI, and Supabase.

The game models vineyard ownership, grape growing, winemaking, contracts, customer sales, finance, prestige, achievements, and company progression. Core simulation logic lives in services; React components should stay focused on presentation and interaction.

## Quick Start

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm test
npm run build
```

## Codebase Map

| Area | Path | Notes |
|---|---|---|
| App shell and routing | `src/App.tsx`, `src/main.tsx` | React entry point and page selection. |
| Pages | `src/components/pages/` | Company overview, vineyard, winery, sales, finance, research, staff, Winepedia, highscores. |
| Shared UI | `src/components/ui/` | ShadCN wrappers, modals, reusable game UI. |
| Hooks | `src/hooks/` | Game state, loading, sorting, mobile detection, reactive updates. |
| Services | `src/lib/services/` | Domain logic for core game, vineyard, wine, sales, finance, activities, prestige. |
| Database | `src/lib/database/` | Supabase access grouped by domain. |
| Types | `src/lib/types/` | Shared TypeScript domain and UI interfaces. |
| Constants | `src/lib/constants/` | Grapes, vineyards, economy, staff, wine features, taste labels. |
| Wine structure | `src/lib/wineStructure/` | Structure index calculations, ranges, rules, and types. |
| Tests | `tests/` | Vitest coverage for services and gameplay calculations. |
| Migrations | `migrations/` | SQL used for database updates. |

## Architecture Rules

- Put business logic in `src/lib/services/`, not React components.
- Prefer existing barrel exports from `@/components/ui`, `@/hooks`, `@/lib/services`, `@/lib/utils`, and `@/lib/constants`.
- Use shared types from `src/lib/types/` and `src/components/UItypes.ts`.
- Keep wine terminology aligned with `CONTEXT.md`: Structure, Taste Quality, WineScore, and compact wine anchors.
- The project is in active development. Do not add backwards-compatibility branches or data migrations unless explicitly requested.

## Documentation Entry Points

| Need | Start here |
|---|---|
| Stable domain vocabulary | `CONTEXT.md` |
| Current implemented game systems | `docs/AIdocs/AIDescriptions_coregame.md` |
| File structure and ownership map | `docs/PROJECT_INFO.md` |
| Wine variable flow and diagrams | `docs/WineSystem_VariableRelationshipMap.md` |
| Taste research and future ideas | `docs/TasteSystem_WineFolly_Research.md` |
| Taste Quality design spec | `docs/superpowers/specs/2026-05-20-taste-quality-index-design.md` |
| Taste Quality implementation plan | `docs/superpowers/plans/2026-05-20-taste-quality-index.md` |
| Contract taste/site UI plan | `docs/superpowers/plans/2026-05-20-contract-taste-site-ui.md` |
| Research mechanic design and rollout status | `docs/superpowers/specs/2026-05-21-research-mechanic-design.md` |
| Development prompt guidance | `docs/AIpromt_newpromt.md` |
| Documentation maintenance guidance | `docs/AIpromt_docs.md` |
| Cleanup/refactor guidance | `docs/AIpromt_codecleaning.md` |
| Version history | `docs/versionlog.md` |

## Research Status Snapshot

- Core gates are implemented: completed-state tracking, prestige/prerequisite eligibility, and service-side validation.
- Unlock enforcement is active for grapes, fermentation methods, staff cap, vineyard size cap, and contract sales channels.
- Starting conditions now include regional `startingResearch` pre-unlocks applied during setup.
- Permanent effects are active via runtime aggregation (current shipped slice: vineyard health decay multiplier).
- Some project benefit text is still aspirational and does not yet map to a dedicated gameplay mechanic.

## Database Notes

The app uses Supabase. Local environment variables live in `.env.local`, which is gitignored.

Apply database changes to the development database first, then update the appropriate SQL file under `migrations/` for staging or deployment workflows.

## Current System Status

This README is intentionally a short entry point. Detailed implementation status belongs in:

- `docs/AIDescriptions_coregame.md`
- `docs/PROJECT_INFO.md`
- `CONTEXT.md`
- `docs/WineSystem_VariableRelationshipMap.md`
