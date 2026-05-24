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
| User asks for ideation, option analysis, or design-first discussion | `../brainstorming/SKILL.md` | `../writing-plans/SKILL.md` |
| Feature design, option exploration, unclear requirements | `../brainstorming/SKILL.md` | `../writing-plans/SKILL.md` |
| Multi-step implementation from an approved plan | `../executing-plans/SKILL.md` | `../subagent-driven-development/SKILL.md` |
| React or TypeScript implementation details | `../javascript-typescript/SKILL.md` | `../react-best-practices/SKILL.md` |
| ShadCN component composition and UI consistency | `../shadcn-best-practices/SKILL.md` | `../react-best-practices/SKILL.md` |
| Rendered frontend QA, UI regression reproduction, interaction checks | `../frontend-testing-debugging/SKILL.md` | `../systematic-debugging/SKILL.md` |
| Bug reports, regressions, failing tests, unexpected behavior | `../systematic-debugging/SKILL.md` | `../diagnose/SKILL.md` |
| Database query, schema, index, or RLS performance concerns | `../supabase-best-practices/SKILL.md` | repo migration/database tooling guidance |
| About to claim completion or fixed status | `../verification-before-completion/SKILL.md` | `../requesting-code-review/SKILL.md` |
| Writing or fixing skills | `../writing-skills/SKILL.md` | `../write-a-skill/SKILL.md` |
| Architecture-level refactor opportunities | `../improve-codebase-architecture/SKILL.md` | `../zoom-out/SKILL.md` |
| User explicitly asks for a grill/interview challenge | `../grill-me/SKILL.md` | `../grill-with-docs/SKILL.md` |
| User explicitly asks for compressed/terse style | `../caveman/SKILL.md` | none |
| User explicitly asks to discover/install external skills | `../find-skills/SKILL.md` | `../write-a-skill/SKILL.md` |
| User explicitly asks for full frontend redesign/new UI from scratch | `../frontend-app-builder/SKILL.md` | `../frontend-testing-debugging/SKILL.md` |
| User explicitly asks to break spec into issue tickets | `../to-issues/SKILL.md` | `../triage/SKILL.md` |
| User explicitly asks for PRD publication to tracker | `../to-prd/SKILL.md` | `../to-issues/SKILL.md` |
| User explicitly asks for issue triage/state management | `../triage/SKILL.md` | `../grill-with-docs/SKILL.md` |
| User explicitly asks for isolated worktree setup | `../using-git-worktrees/SKILL.md` | none |
| User explicitly asks to wrap up merge or PR branch flow | `../finishing-a-development-branch/SKILL.md` | `../requesting-code-review/SKILL.md` |
| User explicitly asks for agent-skill tracker bootstrap | `../setup-matt-pocock-skills/SKILL.md` | none |
| Agent is about to claim task completion | `../improve-codebase-architecture/SKILL.md` (sanitary sweep mode) | `../verification-before-completion/SKILL.md` |

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
- `../frontend-app-builder/SKILL.md`
- `../find-skills/SKILL.md`
- `../grill-me/SKILL.md`
- `../grill-with-docs/SKILL.md`
- `../to-issues/SKILL.md`
- `../to-prd/SKILL.md`
- `../triage/SKILL.md`
- `../using-superpowers/SKILL.md`
- `../using-git-worktrees/SKILL.md`
- `../finishing-a-development-branch/SKILL.md`
- `../setup-matt-pocock-skills/SKILL.md`

The following are optional mode skills (never mandatory by default):

- `../caveman/SKILL.md` (only when the user requests terse mode)

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
- Keep `docs/AIdocs/AIpromt_codecleaning.md` as the detailed cleanup playbook. The completion sanitary gate below runs in parallel and does not supersede it.

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

## Completion Sanitary Gate (Required)

Before claiming a task is done, run a sanitation sweep through a subagent.

Default sweep path:

1. Spawn an `Explore` subagent for a repo scan.
2. Check and report these violations:
	- Service or business functions inside UI files (not allowed): `src/components/`, `src/components/pages/`, and UI-only modules.
	- CRUD or direct data persistence logic outside `src/lib/database/` (not allowed).
	- Tunable gameplay numbers hardcoded in services or UI when they should live in `src/lib/constants/`.
	- Import/export hygiene drift:
	  - Imports should use project barrel paths where available.
	  - Exports should use `index.ts` barrel exports.
	  - Prefer wildcard barrel exports when safe and appropriate for the module.
3. Apply fixes immediately or document explicit exceptions.
4. Run verification checks before completion claims.

This gate is mandatory for meaningful code changes.

## Version Log Sync Gate (Frequent)

Frequently check whether new commits are missing entries in `docs/versionlog.md`, and always check before release-style completion claims.

Default versionlog path:

1. Spawn an `Explore` subagent to compare recent commits with current `docs/versionlog.md` coverage.
2. If missing entries exist, update `docs/versionlog.md`.
3. Follow the rules at the top of `docs/versionlog.md` strictly:
	- Use MCP GitHub evidence tools (`mcp_github_list_commits`, `mcp_github_get_commit` with diffs).
	- Group related commits into one logical version entry when appropriate.
	- Keep claims tied to verified diffs.
4. If no meaningful unlogged commits exist, state that explicitly.

## Verification Minimum

Use the smallest useful set for the change:

```bash
npm test
git diff --check
```

For docs passes, also search for stale names across `docs`, `readme.md`, `CONTEXT.md`, `src`, and `tests`.
