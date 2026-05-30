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

Route directly to a specialist skill when the task is already clear. Use the `superpowers` umbrella only when you want the broader governance layer first, or when the task needs explicit skill-selection discipline before picking the subskill.

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
| User asks for ideation, option analysis, or design-first discussion | `../superpowers/brainstorming/SKILL.md` | `../superpowers/writing-plans/SKILL.md` |
| Feature design, option exploration, unclear requirements | `../superpowers/brainstorming/SKILL.md` | `../superpowers/writing-plans/SKILL.md` |
| Multi-step implementation from an approved plan | `../superpowers/executing-plans/SKILL.md` | `../superpowers/dispatching-parallel-agents/SKILL.md` |
| React or TypeScript implementation details | `../javascript-typescript/SKILL.md` | `../react-best-practices/SKILL.md` |
| ShadCN component composition and UI consistency | `../shadcn-best-practices/SKILL.md` | `../react-best-practices/SKILL.md` |
| Rendered frontend QA, UI regression reproduction, interaction checks | `../superpowers/systematic-debugging/SKILL.md` | none |
| Bug reports, regressions, failing tests, unexpected behavior | `../superpowers/systematic-debugging/SKILL.md` | `../superpowers/diagnose/SKILL.md` |
| Database query, schema, index, or RLS performance concerns | `../supabase-best-practices/SKILL.md` | repo migration/database tooling guidance |
| About to claim completion or fixed status | `../superpowers/verification-before-completion/SKILL.md` | `../superpowers/requesting-code-review/SKILL.md` |
| Writing or fixing skills | `../writeskills-gram/SKILL.md` | none |
| Architecture-level refactor opportunities | `../superpowers/improve-codebase-architecture/SKILL.md` | none |
| User explicitly asks for a grill/interview challenge | `../grill-me/SKILL.md` | none |
| User explicitly asks for compressed/terse style | `../caveman/SKILL.md` | none |
| User explicitly asks to wrap up merge or PR branch flow | `../superpowers/finishing-a-development-branch/SKILL.md` | `../superpowers/requesting-code-review/SKILL.md` |
| Agent is about to claim task completion | `../superpowers/improve-codebase-architecture/SKILL.md` (sanitary sweep mode) | `../superpowers/verification-before-completion/SKILL.md` |

## Non-Default Skills In This Repo

The following are non-default here and should only be used when explicitly requested by the user or clearly required by task context:

- `../superpowers/brainstorming/SKILL.md`
- `../superpowers/dispatching-parallel-agents/SKILL.md`
- `../superpowers/diagnose/SKILL.md`
- `../superpowers/executing-plans/SKILL.md`
- `../superpowers/finishing-a-development-branch/SKILL.md`
- `../superpowers/improve-codebase-architecture/SKILL.md`
- `../superpowers/receiving-code-review/SKILL.md`
- `../superpowers/requesting-code-review/SKILL.md`
- `../superpowers/systematic-debugging/SKILL.md`
- `../superpowers/tdd-gram/SKILL.md`
- `../superpowers/using-superpowers/SKILL.md`
- `../superpowers/verification-before-completion/SKILL.md`
- `../superpowers/writing-plans/SKILL.md`
- `../grill-me/SKILL.md`
- `../javascript-typescript/SKILL.md`
- `../react-best-practices/SKILL.md`
- `../shadcn-best-practices/SKILL.md`
- `../supabase-best-practices/SKILL.md`
- `../caveman/SKILL.md`
- `../handoff/SKILL.md`
- `../writeskills-gram/SKILL.md`

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
- Human owns git commits by default.
- No AI git commit unless the user explicitly requests it.
- Do not start `npm run dev` unless explicitly asked.
- Do not run `npm run build` by default; use only when asked or when change risk justifies it.
- After major updates, ask whether `readme.md` should be updated.
- Do not run test, `ESLint`, or `typecheck` or  `npm test` and `git diff --check` after every change. Only use when delivering a finished feature. Use only for complex chanes or when user explicitly requests it.
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

Versionlog ownership rules:

1. `docs/versionlog.md` is updated by a dedicated versionlog subagent only.
2. Do not let implementation agents write or append versionlog entries as part of routine feature completion.
3. Versionlog updates happen only after commit(s) exist.
4. Commits are created by the human by default; AI must not commit unless explicitly requested.

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
