# AI Prompt: Starting A New Development Session

We have a comprehensive winery management game built with React/Vite/TypeScript + ShadCN, connected to Supabase. Use this as the short context handoff when opening a new AI coding session for this repo.

## Project Summary

This is a single-player, turn-based winery management game. The player manages vineyards, harvests grapes, produces wine, sells bottles and contracts, manages staff and finance, builds prestige, and competes through achievements/highscores.

Core simulation logic should live in services; React components should stay focused on presentation and interaction.

## First Files To Read

1. `readme.md` - codebase entry point and documentation map.
2. `CONTEXT.md` - stable domain language, variables, constants, and naming policy.
3. `docs/AIdocs/AIDescriptions_coregame.md` - current implemented systems.
4. `docs/PROJECT_INFO.md` - file structure and major module locations.
5. `docs/WineSystem_VariableRelationshipMap.md` - wine variable relationships and game-flow diagrams.

For implementation workflow, also use:

- `skills/winemaker-game/SKILL.md` - repository routing and project guardrails.
- `skills/superpowers/using-git-worktrees/SKILL.md` - isolated workspace setup.
- `skills/superpowers/subagent-driven-development/SKILL.md` - one reviewed subagent per plan task.
- `skills/superpowers/dispatching-parallel-agents/SKILL.md` - genuinely independent concurrent tasks.
- `skills/superpowers/verification-before-completion/SKILL.md` - evidence required before completion claims.

For taste, structure, or contracts work, also read:

- `docs/superpowers/deferred/TasteSystem_WineFolly_Research.md`
- `docs/superpowers/completed/2026-05-20-taste-quality-index-design.md`
- `docs/superpowers/completed/2026-05-20-taste-quality-index.md`
- `docs/superpowers/completed/2026-05-20-contract-taste-site-ui.md`

## Current System Snapshot

- **Core architecture:** React/Vite/TypeScript frontend, Supabase persistence, company-scoped data, week-based game tick, global update hooks.
- **Vineyard:** land buying, planting, clearing/health, overgrowth, ripeness, vine yield, harvest creation.
- **Wine production:** grapes -> must -> wine -> bottled pipeline, compact wine anchors, six structure channels, `structureIndex`, 14-family taste profile, `tasteQualityIndex`, and combined `wineScore`.
- **Sales:** regional customers, order generation, multi-factor pricing, contracts with taste/structure/site/grape/vintage/characteristic requirements, sell-side grape buyers, buy-side grape suppliers, loyalty, and economy/weather market pressure.
- **Weather:** current weather, forecast pattern/confidence, Weather Center, vineyard health/ripeness impact, and grape-market volatility.
- **Finance:** transactions, financial reports, loans through the `loanLender` feature seam, founder profit-share/buyout UI, and asset valuation.
- **Board/share status:** public-company/share-market docs are historical implementation and reintroduction references; current mainline retains deferred board/share scaffolding and an intentionally inactive `boardShare` feature facade.
- **Staff/activity:** staff management, founders, teams, recruitment, wages, assignment, work calculators, activity progression.
- **Research:** active research page with effects/footprint/catalog tabs, enforced gates, starting research, grape/fermentation/staff/vineyard/contract/grape-buyer unlocks, and permanent vineyard-health effect aggregation.
- **Player interface:** company switching, profile, Winepedia, achievements, highscores, settings, notifications, admin tools.
- **Prestige:** company and vineyard prestige events, decay, customer relationship effects.

The automated suite currently has no known failing expectations. Live database smoke tests are opt-in and require a reachable, isolated Supabase environment; the default Vitest run uses database seams mocked at the unit boundary.

Keep detailed status updates in `docs/AIdocs/AIDescriptions_coregame.md` and file/module updates in `docs/PROJECT_INFO.md`; do not expand this prompt into a second README.

## Key File Locations

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
| Activities feature | `src/lib/features/activities/` |
| Database layer | `src/lib/database/` |
| Game constants | `src/lib/constants/` |
| Wine feature constants | `src/lib/constants/wineFeatures/` |
| Taste constants | `src/lib/constants/taste/` |

## Development Rules

For substantial work, use the workflow above in order: clarify and plan first, create or verify isolation, dispatch focused implementation/review tasks, then verify. Give each subagent exact scope, context, allowed files, and checks to run.

- Keep business logic in `src/lib/services/`.
- Keep Supabase reads/writes in `src/lib/database/`.
- Keep React components focused on UI state, display, and user interaction.
- Prefer existing barrel exports from `@/components/ui`, `@/hooks`, `@/lib/services`, `@/lib/utils`, and `@/lib/constants`.
- Use shared types from `src/lib/types/` and `src/components/UItypes.ts`.
- Follow current terminology: `structureIndex`, `tasteQualityIndex`, `wineScore`, compact `WineAnchorValues`.
- Database parsing only accepts current compact wine anchor keys; do not add old data-shape support unless explicitly requested.

## Useful Commands

```bash
npm test
npm run build
git diff --check
```
