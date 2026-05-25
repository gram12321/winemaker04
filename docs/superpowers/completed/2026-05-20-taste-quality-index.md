# Taste Quality Index Implementation Plan

Status: Complete. Rechecked against implementation on 2026-05-21.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a computed 14-family `tasteQualityIndex` that replaces the fixed taste-quality placeholder in WineScore.

**Architecture:** Add a pure taste-quality scoring service under `src/lib/services/wine/taste/`, then have wine score calculation consume it through `getTasteQualityIndex`. Persist database fields with `taste_quality_index` naming.

**Tech Stack:** TypeScript, Vitest, existing wine taste profile service, existing WineScore service.

---

## File Structure

- Create: `src/lib/services/wine/taste/tasteQualityIndexService.ts`
  - Owns target ranges, dependency rules, family scoring, and batch wrapper.
- Create: `tests/wine/tasteQualityIndexService.test.ts`
  - Covers moving-target behavior and WineScore integration expectations.
- Modify: `src/lib/services/wine/winescore/wineScoreCalculation.ts`
  - Exports `getTasteQualityIndex`.
  - Uses computed taste quality for WineScore and price breakdown.
- Modify: `src/lib/database/activities/inventoryDB.ts`
  - Maps model fields to `taste_quality_index*` database columns.
- Modify: `src/lib/database/core/wineLogDB.ts` and `src/lib/services/user/wineLogService.ts`
  - Writes and reads `wine_log.taste_quality_index`.
- Modify: `migrations/sync_vercel_schema.sql` and `migrations/vercel_migration_preserve_data_delta.sql`
  - Rename database columns to taste-quality naming.
- Modify UI/docs references touched by the score path.
  - Prefer user-facing label `Taste Quality`.

## Tasks

### Task 1: Red Test For Taste Quality Scoring

- [x] Add `tests/wine/tasteQualityIndexService.test.ts`.
- [x] Assert a coherent red-fruit profile scores higher than a red wine with high tropical/fault pressure.
- [x] Assert no descriptor values are required for scoring.
- [x] Run `npm test -- tests/wine/tasteQualityIndexService.test.ts`.
- [x] Expected: fail because `tasteQualityIndexService` does not exist.

### Task 2: Implement Pure Taste Quality Service

- [x] Create `tasteQualityIndexService.ts`.
- [x] Define `TasteQualityContext`, `TasteFamilyTarget`, `TasteQualityFamilyBreakdown`, and `TasteQualityIndexResult`.
- [x] Implement base targets for red and white wines.
- [x] Implement grape target nudges for the current grape list.
- [x] Implement dependency rules over the 14 family values.
- [x] Implement range-distance scoring and weighted aggregation.
- [x] Run the targeted test.

### Task 3: Wire WineScore To Taste Quality

- [x] Update `wineScoreCalculation.ts`.
- [x] Add `getTasteQualityIndex(batch)`.
- [x] Change price breakdown to expose `tasteQualityIndex`.
- [x] Add/extend tests to prove WineScore changes when taste profile changes.

### Task 4: Rename User-Facing Labels

- [x] Replace touched labels from "Quality Index" to "Taste Quality".
- [x] Update design docs where they describe the current score path.

### Task 4a: Rename Database Columns

- [x] Rename `wine_batches.quality_index` to `wine_batches.taste_quality_index`.
- [x] Rename `wine_batches.quality_index_harvest_snapshot` to `wine_batches.taste_quality_index_harvest_snapshot`.
- [x] Rename `wine_batches.quality_index_bottling_snapshot` to `wine_batches.taste_quality_index_bottling_snapshot`.
- [x] Rename `wine_log.quality_index` to `wine_log.taste_quality_index`.
- [x] Update persistence mappers to use the new column names.

### Task 5: Verification

- [x] Run `npm test -- tests/wine/tasteQualityIndexService.test.ts`.
- [x] Run `npm run build`.
- [x] Check `git diff --stat` and summarize changed files.

## Current Acceptance

The current implementation is accepted for now:

- `tasteQualityIndex` is the canonical runtime and TypeScript name.
- No runtime `qualityIndex`/`getQualityIndex` compatibility alias remains.
- The score is family-level only; descriptors remain display-only.
- WineScore, estimated price, contracts, highscores, achievements, and wine log snapshots all use the explicit taste-quality naming path.

Future work should tune family targets/weights from playtesting before adding descriptor-level scoring.
