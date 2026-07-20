# AI Prompt: Documentation Maintenance

Use this when updating project documentation after implementation work.

## Documentation Roles

| File | Role |
|---|---|
| `readme.md` | Short codebase introduction, setup commands, and doc map. |
| `CONTEXT.md` | Stable domain vocabulary, parameters, constants, and naming policy. |
| `docs/AIdocs/AIDescriptions_coregame.md` | Current implemented game systems and known not-yet-implemented systems. |
| `docs/PROJECT_INFO.md` | File structure, ownership map, and major module locations. |
| `docs/WineSystem_VariableRelationshipMap.md` | Variable relationships, diagrams, and game-flow dependencies. |
| `docs/superpowers/deferred/TasteSystem_WineFolly_Research.md` | Taste research, implemented taste model, and intentionally deferred taste-system ideas. |
| `docs/superpowers/completed/` | Completed or superseded implementation docs kept for traceability. |
| `docs/superpowers/deferred/` | Deferred designs and future work. |
| `docs/codexplans/completed/` | Completed Codex implementation records. |
| `docs/codexplans/deferred/` | Deferred Codex designs. |
| `docs/superpowers/deferred/PublicCompanyPlan.md`, `docs/superpowers/deferred/PublicCompanyImplementation.md` | Historical public-company/share docs kept as deferred reintroduction references; not current mainline runtime. |
| `docs/versionlog.md` | Version history. |
| `skills/winemaker-game/SKILL.md` | Repository routing, project guardrails, and required agent workflow. |
| `skills/superpowers/` | Reusable planning, worktree, subagent, parallel-dispatch, review, and verification skills. |

## Update Rules

- Keep README concise. Move system status, roadmap detail, and implementation history to dedicated docs.
- Update `CONTEXT.md` when terminology, constants, parameters, variables, or naming policy changes.
- Update `PROJECT_INFO.md` when files move, modules are renamed, or major ownership boundaries change.
- Update `AIDescriptions_coregame.md` when implementation status changes.
- Update `WineSystem_VariableRelationshipMap.md` when variable dependencies or game-flow relationships change.
- Update research docs without deleting useful future ideas; mark them as implemented, superseded, or deferred.
- Remove stale names instead of documenting compatibility branches that no longer exist.
- Keep workflow references aligned between `readme.md`, `docs/AIdocs/AIpromt_newpromt.md`, and `skills/winemaker-game/SKILL.md`.
- Keep `CONTEXT.md` focused on stable domain language; put agent workflow and documentation policy in the README or AI docs.

## Verification

Before finishing a documentation pass:

```bash
git diff --check
rg -n "oldName|legacyAlias|removedTerm" docs readme.md CONTEXT.md src tests
```

Use project-specific stale-name searches for the feature being changed.
