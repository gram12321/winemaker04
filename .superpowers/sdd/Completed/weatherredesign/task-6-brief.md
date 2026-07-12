### Task 6: Remove legacy seams, synchronize docs, and verify

**Files:**
- Delete: `src/lib/services/finance/weatherService.ts`
- Modify: `src/lib/services/index.ts`, `CONTEXT.md`, `docs/AIdocs/AIDescriptions_coregame.md`, `docs/PROJECT_INFO.md`, `docs/WineSystem_VariableRelationshipMap.md`, `readme.md`, `docs/superpowers/specs/2026-07-10-weather-module-redesign-design.md`

- [ ] Add/adjust regression tests so weather consumers import only `@/lib/features/weather` public exports.
- [ ] Remove all old service imports, raw weather table imports, and obsolete tests only after all consumers use the module facade.
- [ ] Update docs to describe five intensities, persisted weather facts, shared projection, Weather Center's operational role, and Winepedia's technical role.
- [ ] Run `npm test`, `npx tsc -p tsconfig.json --noEmit`, `git diff --check`, and stale-import search from the plan.
- [ ] Do not start dev server; if none already available, skip rendered smoke check.

Do not commit. Preserve historical docs but mark them historical if stale; no legacy service imports under src/tests.
