# Contract Taste/Site Requirements And Taste UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace contract `quality` requirements with explicit `tasteQuality`, keep site/land parameters separate, and add a structure-like Taste Quality breakdown to the wine Taste tab.

**Architecture:** Contract requirements remain stored as JSON, so no table schema change is needed. The type union, generation rules, validation, and display labels move from legacy `quality` to `tasteQuality`; site requirements remain separate as land value, altitude, aspect, region, and country. The Taste tab gets a new read-only breakdown component fed by `calculateTasteQualityIndex(batch)`.

**Tech Stack:** TypeScript, React, Vitest, existing sales contract services, existing taste quality service, shadCN cards/progress styling.

---

## File Structure

- Modify `src/lib/types/types.ts`
  - Replace contract requirement type `quality` with `tasteQuality`.
  - Add `country` and `region` requirement types.
  - Add requirement params for `targetCountry` and `targetRegion`.
- Modify `src/lib/constants/contractConstants.ts`
  - Generate `tasteQuality` requirements instead of `quality`.
  - Keep land/site requirement preferences separate from taste quality.
  - Add available site countries/regions for contract generation.
- Modify `src/lib/services/sales/contractGenerationService.ts`
  - Rename quality difficulty generation to taste-quality generation.
  - Generate country/region site requirements.
  - Include new site requirements in difficulty and pricing calculations.
- Modify `src/lib/services/sales/contractService.ts`
  - Validate `tasteQuality` via `getTasteQualityIndex(wine)`.
  - Validate `country`/`region` against source vineyard.
  - Remove legacy `quality` handling.
- Modify `src/components/pages/sales/ContractsTab.tsx` and `src/components/pages/sales/AssignWineModal.tsx`
  - Display `Taste Quality` and site parameters clearly.
- Create `src/components/ui/components/WineTasteQualityBreakdown.tsx`
  - Shows current taste quality, 14 family rows, ideal markers, accepted ranges, and family scores.
- Modify `src/components/ui/components/WineTasteProfilePanel.tsx`
  - Add the new breakdown without replacing the current taste radar wheel.
- Modify `docs/superpowers/specs/2026-05-20-taste-quality-index-design.md`
  - Record future TODOs for descriptor scoring and unified customer preferences.
- Modify `src/lib/services/wine/taste/tasteQualityIndexService.ts`
  - Add a short TODO explaining descriptor scoring is intentionally not part of the current score.
- Modify `src/lib/types/types.ts`
  - Add a short TODO explaining future customer taste preferences should be unified across structure and taste.
- Test `tests/sales/contractRequirements.test.ts`
  - Verifies `tasteQuality` validates against computed taste quality.
  - Verifies `landValue` no longer stands in for taste quality.
  - Verifies region/country site requirements validate against vineyard metadata.
- Test `tests/wine/tasteQualityIndexService.test.ts`
  - Existing coverage remains the primary service regression test.

## Tasks

### Task 1: Red Tests For Contract Semantics

- [x] Add `tests/sales/contractRequirements.test.ts`.
- [x] Assert `tasteQuality` accepts a bottled wine whose computed taste quality exceeds the threshold.
- [x] Assert `tasteQuality` rejects a wine even when `landValueModifier` is high if computed taste quality is too low.
- [x] Assert `country` and `region` requirements validate against source vineyard metadata.
- [x] Run `npm test -- tests/sales/contractRequirements.test.ts`.
- [x] Expected: fail because `tasteQuality`, `country`, and `region` contract requirement handling is missing.

### Task 2: Implement Contract Requirement Redesign

- [x] Update contract requirement types and params.
- [x] Update requirement preference constants from `quality` to `tasteQuality`.
- [x] Add country/region site requirement generation.
- [x] Update contract difficulty/pricing logic.
- [x] Update contract validation to use `getTasteQualityIndex`.
- [x] Update contract requirement display labels.
- [x] Run `npm test -- tests/sales/contractRequirements.test.ts`.

### Task 3: Add Taste Quality Breakdown UI

- [x] Create `WineTasteQualityBreakdown.tsx`.
- [x] Render score, family rows, current marker, ideal marker, accepted range, and family score.
- [x] Add breakdown to `WineTasteProfilePanel.tsx` above the family/descriptor lists and below the radar wheel.
- [x] Keep the current radar taste diagram unchanged.
- [x] Run `npm run build`.

### Task 4: Future TODO Documentation

- [x] Add design-doc TODO for descriptor scoring.
- [x] Add design-doc TODO for unified customer preferences across structure and taste.
- [x] Add code comments in the taste quality service and customer type area.
- [x] Keep comments short and attached to relevant boundaries.

### Task 5: Verification

- [x] Run `npm test -- tests/sales/contractRequirements.test.ts`.
- [x] Run `npm test -- tests/wine/tasteQualityIndexService.test.ts`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Check `git diff --stat`.
