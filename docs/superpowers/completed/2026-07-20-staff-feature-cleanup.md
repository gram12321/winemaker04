# Staff Feature Cleanup Implementation Plan

Status: Completed. Staff production code is below the stated baseline, obsolete local search-result state is gone, presentation contracts are consolidated, and the full suite/build pass.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Staff production code and incidental complexity without changing gameplay, persistence, or the installed feature boundary.

**Architecture:** This is a deletion-first pass. Keep `staffFeature`, feature-owned records, the existing company-scoped membership RPCs, and current Activity host injection. Delete dead local UI state, duplicate presentation types, repeated picker markup, and narration comments. A local Activity-port rewrite or new controller/hook is excluded unless the implementation removes more production code than it adds.

**Tech Stack:** TypeScript, React, Vite, Vitest, Supabase-backed database adapters.

---

## Non-negotiable rules

- Preserve all Staff workflows, wage/XP formulas, record shapes, company scope, and atomic membership behavior.
- Prefer in-place deletion. Do not add wrappers, compatibility paths, caches, generic abstractions, migrations, hooks, or components unless the final production-code delta is negative and control flow is simpler.
- Retain `staffModels.ts` as the one mapping seam to global runtime models.
- Do not split `StaffWorkspace.tsx` merely because it is large. Only share the duplicated icon/task picker markup if that reduces the final line count.
- Do not redesign `StaffActivityAdapter` in this pass. Replacing its one-line `Pick<ActivitiesFeature, ...>` with a copied local contract would add code without reducing runtime complexity.

## Baseline and acceptance criteria

Baseline: 2,139 production lines under `src/lib/features/staff/`; the focused Staff suite has 25 passing tests; `npm run build` passes with unrelated Vite chunking warnings.

The work is complete only when Staff production code is below 2,139 lines, every retained refactor is net-negative, focused and full tests/build pass, and no Staff local search-results state remains.

### Task 1: Record the deletion budget and current owner

**Files:**
- Inspect: `src/lib/features/staff/**`
- Inspect: `src/components/layout/GlobalSearchResultsDisplay.tsx`
- Test: `tests/user/staffFeatureFacade.test.ts`, `tests/user/staffTeamWorkflow.test.ts`, `tests/user/staffPresentationService.test.ts`, `tests/user/staffSearchCalculations.test.ts`, `tests/finance/wageService.test.ts`

- [ ] Run `git status --short`, count Staff production lines, and run the focused suite. Expected: no unrelated changes, 2,139 lines, and 25 passing tests.
- [ ] Confirm `GlobalSearchResultsDisplay` is the sole owner of `pendingStaffCandidates` and renders `renderStaffSearchResults`.
- [ ] Confirm `StaffWorkspace` never sets `showResultsModal` true or populates `searchCandidates`. This code is unreachable; no replacement test is needed unless its removal changes an observable workflow.

### Task 2: Delete obsolete local Staff-search-results code

**Files:**
- Modify: `src/lib/features/staff/ui/StaffWorkspace.tsx`
- Verify: `src/components/layout/GlobalSearchResultsDisplay.tsx`

- [ ] Delete `showResultsModal`, `searchCandidates`, `setSearchCandidates`, and the now-unused `Staff` import.
- [ ] Delete the complete local `activity.ui.renderStaffSearchResults` block. Retain `renderStaffSearchOptions`, because it starts the real workflow; remove its empty `onSearchStarted` callback if that prop is optional.
- [ ] Run `rg -n "showResultsModal|searchCandidates|setSearchCandidates|renderStaffSearchResults" src/lib/features/staff/ui/StaffWorkspace.tsx src/components/layout/GlobalSearchResultsDisplay.tsx`. Expected: no Workspace match and the global display remains the sole renderer.

### Task 3: Consolidate presentation contracts

**Files:**
- Modify: `src/lib/features/staff/featureTypes.ts`
- Modify: `src/lib/features/staff/services/staffPresentationService.ts`
- Modify: `src/lib/features/staff/index.ts` only if an external public type needs exporting
- Test: `tests/user/staffPresentationService.test.ts`, `tests/user/staffFeatureFacade.test.ts`

- [ ] Define the single public `StaffExperiencePresentation` next to `StaffExperienceDisplayItem` in `featureTypes.ts`.
- [ ] Change `StaffFeature.presentation.getExperience` to return that named type instead of repeating its object shape inline.
- [ ] Import the two types from `featureTypes.ts` in `staffPresentationService.ts`, then delete its duplicate interface declarations. Do not change XP grouping, labels, or normalization.
- [ ] Run the two focused tests and `rg -n "export interface StaffExperience(DisplayItem|Presentation)" src/lib/features/staff`. Expected: tests pass and each public presentation interface has one declaration.

### Task 4: Collapse only measured picker duplication

**Files:**
- Modify: `src/lib/features/staff/ui/StaffWorkspace.tsx`
- Create only if net-negative: `src/lib/features/staff/ui/TeamPickerDialogs.tsx`

- [ ] Compare the two icon-picker dialogs and two task-type-picker dialogs in the workspace. They currently repeat the Dialog shell, title, option mapping, selected state, and callbacks.
- [ ] Extract only the shared picker presentation. Keep existing state, create/edit behavior, and callbacks. Begin with local helpers; add `TeamPickerDialogs.tsx` only if it further reduces the final line count.
- [ ] Introduce one typed empty team draft used by create, cancel, and save resets. Replace `handleNewTeamDataUpdate(..., value: any)` with the existing draft-field union.
- [ ] Count production lines after the change. If the picker extraction is not net-negative, revert it and retain only independent deletions.

### Task 5: Delete narration and import clutter

**Files:**
- Modify: `src/lib/features/staff/ui/StaffWorkspace.tsx`
- Modify: `src/lib/features/staff/ui/StaffModal.tsx`
- Modify: `src/lib/features/staff/ui/StaffSkillBar.tsx`
- Modify: `src/lib/features/staff/services/teamService.ts`

- [ ] Remove comments that simply announce adjacent JSX or code: Header, Content, Skills, Footer, and service-section banners.
- [ ] Retain comments explaining the two-sided company-scoped membership invariant, the Maintenance-team migration rule, and the distinct XP bonus rendering.
- [ ] Remove only imports made unused by deletion. Do not perform unrelated import ordering or barrel-export churn.

### Task 6: Verify the cleanup and decide documentation

**Files:**
- Modify only if the final public seam changed: `docs/PROJECT_INFO.md`, `docs/AIdocs/AIDescriptions_coregame.md`, `readme.md`

- [ ] Run the focused Staff suite, then `npm test`, `npm run build`, and `git diff --check`.
- [ ] Run:
  ```powershell
  rg -n "showResultsModal|searchCandidates|setSearchCandidates|renderStaffSearchResults" src/lib/features/staff
  rg -n "export interface StaffExperience(DisplayItem|Presentation)" src/lib/features/staff
  (Get-ChildItem src/lib/features/staff -Recurse -File | Get-Content | Measure-Object -Line).Lines
  git diff --stat
  ```
  Expected: no obsolete local result symbols, one declaration per presentation interface, and fewer than 2,139 Staff production lines.
- [ ] Do not update documentation for comment/local-markup deletion alone. Do not edit `docs/versionlog.md`; it requires a human-created commit and its dedicated workflow.
