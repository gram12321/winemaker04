# Research Page Consolidation And ResearchPanel Removal

Status: Completed. The standalone research page, module-owned admin inspector, and removal of the legacy ResearchPanel/Winepedia research tab are implemented.

## Summary
Make the standalone research page the only player-facing research surface, delete `ResearchPanel.tsx`, and move the remaining useful research UI/state assembly into the `researchUpgrade` module. In the same pass, remove the outdated Winepedia research tab, keep a dedicated read-only admin research inspector, and remove the obsolete finance-tab UI contract from `researchUpgrade`.

## Implementation Changes
- Rebuild [Research.tsx](/abs/path/C:/GitHub/winemaker04/src/components/pages/Research.tsx) as the canonical research experience.
  - one continuous progression-first page
  - top summary, active effects, chain/progression overview, and catalog in one flow
  - no dependency on `ResearchPanel`
- Extract still-valid behavior from [ResearchPanel.tsx](/abs/path/C:/GitHub/winemaker04/src/components/finance/ResearchPanel.tsx) into focused research-module pieces under `src/lib/features/researchUpgrade/`.
  - split summary/selectors, catalog view-model assembly, progression summaries, and project detail formatting into feature-owned modules
  - preserve `bypassGates` behavior only through the admin debug surface
  - delete `ResearchPanel.tsx` after all current callers are migrated
- Replace the admin research usage with a dedicated module-owned debug inspector.
  - keep it read-only
  - keep the current “show all / bypass gates” inspection capability
  - render it from `AdminDashboard` under a research-specific debug component owned by `researchUpgrade`, not via finance components
- Remove the Winepedia research tab entirely.
  - remove the tab registration from `Winepedia`
  - delete `ResearchTab.tsx` and its barrel export if nothing else uses it
- Remove research from finance ownership.
  - remove the `ResearchPanel` export from the finance barrel
  - remove any research references from finance-oriented component naming and imports

## Module And Interface Changes
- Move research-specific presentation and selector logic out of `src/lib/services/research/` into `src/lib/features/researchUpgrade/`.
  - eligibility context loading and readable requirement formatting
  - permanent effects aggregation
  - progression/footprint/chain summaries
  - research catalog row/view-model assembly
  - research page and admin-debug selectors
- Keep shared primitives where they already belong.
  - raw catalog definitions in `researchConstants`
  - DB unlock primitives
  - generic activity/domain services that are not research-owned
- Remove the finance-tab UI contract from `researchUpgrade`.
  - delete `ResearchUpgradeFinanceTabRegistration`
  - delete `ResearchUpgradeUiHooks.getFinanceTabs()`
  - remove the `ui` finance-tab implementation from `active.tsx` and `noop.ts`
  - replace it only with direct page/debug component usage or feature-owned selectors, not another registration layer
- Migrate current consumers deliberately.
  - `ResearchPage` should use feature-owned selectors/components directly
  - `researchManager` and other non-UI consumers should import research-owned helpers from `researchUpgrade` rather than the old `services/research` path
  - temporary compatibility re-exports from `src/lib/services/index.ts` are allowed only during the refactor and should be removed by the end of the pass if all call sites are migrated

## Test Plan
- Verify the standalone research page still supports:
  - summary metrics and active effects
  - chain/progression overview
  - catalog browsing, filtering, project expansion, and start-research actions
  - live refresh via `useGameUpdates()`
- Verify `AdminDashboard` still exposes a read-only research inspector with gate bypass, and that it no longer depends on `ResearchPanel`.
- Verify Winepedia no longer contains a research tab.
- Verify compile-time cleanup after deletion:
  - no remaining imports/usages of `ResearchPanel`
  - no remaining imports/usages of `ResearchTab`
  - no remaining `getFinanceTabs()` usage in `researchUpgrade`
- Run `npm run build`, `npm test`, `git diff --check`, and targeted `rg` checks for `ResearchPanel`, `ResearchTab`, and `getFinanceTabs`.
- Smoke test research-dependent systems that rely on unlock state:
  - grapes
  - fermentation technology
  - vineyard capacity
  - contract and buyer unlock flows

## Assumptions
- Research should no longer be presented as part of the finance module.
- Winepedia should not keep a parallel player-facing research surface in this pass.
- The admin research inspector remains useful, but only as a module-owned debug view.
- This pass targets a feature-owned research module boundary, not a rewrite of research constants, DB schema, or gameplay rules.
