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
| `docs/superpowers/plans/TasteSystem_WineFolly_Research.md` | Taste research, implemented taste model, and future taste-system ideas. |
| `docs/superpowers/specs/` | Design specs and decisions for larger work. |
| `docs/superpowers/plans/` | Implementation plans and acceptance notes. |
| `docs/superpowers/completed/` | Completed or superseded implementation docs kept for traceability. |
| `docs/superpowers/plans/PublicCompanyPlan.md`, `docs/superpowers/plans/PublicCompanyImplementation.md` | Historical implemented public-company/share docs kept as reintroduction references; not current mainline runtime. |
| `docs/versionlog.md` | Version history. |

## Update Rules

- Keep README concise. Move system status, roadmap detail, and implementation history to dedicated docs.
- Update `CONTEXT.md` when terminology, constants, parameters, variables, or naming policy changes.
- Update `PROJECT_INFO.md` when files move, modules are renamed, or major ownership boundaries change.
- Update `AIDescriptions_coregame.md` when implementation status changes.
- Update `WineSystem_VariableRelationshipMap.md` when variable dependencies or game-flow relationships change.
- Update research docs without deleting useful future ideas; mark them as implemented, superseded, or deferred.
- Remove stale names instead of documenting compatibility branches that no longer exist.

## Verification

Before finishing a documentation pass:

```bash
git diff --check
rg -n "oldName|legacyAlias|removedTerm" docs readme.md CONTEXT.md src tests
```

Use project-specific stale-name searches for the feature being changed.
