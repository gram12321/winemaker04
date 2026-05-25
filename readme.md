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
| Automated Tests | `tests/` | Vitest coverage for services and gameplay calculations. |
| Admin Test Systems | `src/components/pages/AdminDashboard.tsx`, `src/components/pages/admin/TestLabPage.tsx`, `src/lib/services/admin/testLab/`, `server/` | Dev-only UI that separates the shared automated suite from the separate interactive Gameflow Lab. |
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
| Prestige event creators and decay behavior | `docs/PrestigeEventSourceInventory.md` |
| Taste research and future ideas | `docs/TasteSystem_WineFolly_Research.md` |
| Taste Quality design spec | `docs/superpowers/specs/2026-05-20-taste-quality-index-design.md` |
| Taste Quality implementation plan | `docs/superpowers/plans/2026-05-20-taste-quality-index.md` |
| Contract taste/site UI plan | `docs/superpowers/plans/2026-05-20-contract-taste-site-ui.md` |
| Research unified design, rollout status, and handoff pipeline | `docs/superpowers/specs/2026-05-21-research-mechanic-design.md` |
| Admin Test Lab design | `docs/superpowers/specs/2026-05-20-admin-test-lab-design.md` |
| Admin Test Lab implementation plan | `docs/superpowers/plans/2026-05-21-admin-test-lab.md` |
| Development prompt guidance | `docs/AIdocs/AIpromt_newpromt.md` |
| Documentation maintenance guidance | `docs/AIdocs/AIpromt_docs.md` |
| Cleanup/refactor guidance | `docs/AIdocs/AIpromt_codecleaning.md` |
| Version history | `docs/versionlog.md` |

## Version Log Workflow

Use `docs/versionlog.md` as the canonical running change history for meaningful releases and merged feature trains.

- Keep entries in reverse chronological order (newest first).
- Every entry should use the same structure:
	- Header with `Version`, `Date`, `Commit(s)`, and `Stats`
	- `Summary` (intent and outcome)
	- `Changes` (file-level impact with `NEW FILE`/`REMOVED` markers when relevant)
	- `Notes` (migration, balancing, compatibility, or follow-up context)
- Group related commits into one entry when they represent one logical release slice.
- Archive older entries in `docs/versionlog_legacy.md` when `docs/versionlog.md` becomes too large.

## Research Status Snapshot

- Core gates are implemented: completed-state tracking, prestige/prerequisite eligibility, and service-side validation.
- Unlock enforcement is active for grapes, fermentation methods, staff cap, vineyard size cap, and contract sales channels.
- Vineyard capacity enforcement includes vineyard size, total hectares, and vineyard-count ladders.
- Starting conditions now include regional `startingResearch` pre-unlocks applied during setup.
- Permanent effects are active via runtime aggregation (current shipped slice: vineyard health decay multiplier).
- Research UI is split into Active Research Effects, Research Footprint, and Catalog tabs; catalog includes `Hide completed` and no longer embeds the footprint card.
- Some project benefit text is still aspirational and does not yet map to a dedicated gameplay mechanic.

## Database Notes

The app uses Supabase. Local environment variables live in `.env.local`, which is gitignored.

Apply database changes to the development database first, then update the appropriate SQL file under `migrations/` for staging or deployment workflows.

## Admin Test Systems

The active test UI now lives in the Admin Dashboard `Test Systems` tab and is development-only.

- The Admin Dashboard menu entry is shown only on `localhost`, `127.0.0.1`, or `::1` while running in Vite development mode.
- Automated Tests run the same Vitest suite as the `tests/` folder through `/api/test-run`.
- Gameflow Lab runs against the active company by design, creating tagged gameflow fixtures where possible and exposing active-company admin shortcuts for manual inspection.
- Fixture cleanup is based on durable `testlab_...` run ids so cleanup still works after reloads.
- `test-viewer/` is legacy reference material, not the primary testing surface.

## Current System Status

This README is intentionally a short entry point. Detailed implementation status belongs in:

- `docs/AIdocs/AIDescriptions_coregame.md`
- `docs/PROJECT_INFO.md`
- `CONTEXT.md`
- `docs/WineSystem_VariableRelationshipMap.md`
