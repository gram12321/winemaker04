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

- Keep business logic, validation, calculations, and persistence orchestration out of React components.
- `*DB.ts` files own Supabase CRUD and row mapping; services own domain rules.
- Prefer existing barrel exports and shared types. Do not add compatibility branches or migrations unless requested.
- Feature modules use two patterns: installed feature facades (`loanLender`, `researchUpgrade`, `boardShare`) expose one static feature value from their barrel; the development-only `admin` feature is dynamically loaded into `App`. `weather` is an always-on functional barrel. `boardShare` is deliberately inactive and has no host wiring while public-company/share gameplay is deferred. Callers do not configure features or import their internals.

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
| Public-company reintroduction references | `docs/superpowers/plans/PublicCompanyPlan.md`, `PublicCompanyImplementation.md` |

## Current Systems

- Research gates cover grapes, fermentation, staff/vineyard caps, contracts, and grape-buyer progression; permanent effects currently include vineyard health-decay reduction.
- Weather is persisted weekly state/forecast, a bounded site-aware vineyard projection, and grape-market context. Weather Center is operational; Winepedia is the technical reference.
- Sell and buy grape markets include bulk fallback, seasonal rows, loyalty, economy/weather pressure, and research scaling.
- Founder economy is active as a light ownership layer: zero founder wages, profitable-year returns, and buyout into salaried staff.
- Full public-company/share-market runtime is not active.

## Admin Test Systems

The dev-only Admin Dashboard exposes automated Vitest runs and Gameflow Lab fixtures. It is loopback-gated, dynamically loaded only in Vite development builds, and fixture cleanup uses durable `testlab_...` run IDs. Its explicit host dependency and Winemaker-fork adapter requirements live in `src/lib/features/admin/README.md`; `test-viewer/` is legacy reference material.

## Agent Workflow

Use `skills/winemaker-game/SKILL.md` as the repository router. For substantial work, read the entry docs above, use the relevant planning/worktree/subagent skills, and verify before claiming completion. Keep `docs/versionlog.md` in reverse chronological order using its required entry format.
