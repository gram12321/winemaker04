# Weather Operation Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weather-owned planting and harvesting operation limits while preserving the isolated weather module and reusing the existing activity work/progress system.

**Architecture:** Add a public operation-impact contract under `src/lib/features/weather/`. It will own weather and seasonal availability, work-speed modifiers, forced pauses, and player-facing reasons for planting and harvesting. Vineyard and activity services consume that contract; clearing’s once-per-year rule remains a vineyard-maintenance rule. Weather remains indirect: it changes operation access and work timing, not direct yield or wine quality.

**Tech Stack:** TypeScript, React, Vitest, existing activity/work calculators, persisted `WeatherWeekContext`.

---

### Task 1: Define the weather operation-limit contract

**Files:**
- Create: `src/lib/features/weather/weatherOperationService.ts`
- Modify: `src/lib/features/weather/weatherTypes.ts`
- Modify: `src/lib/features/weather/index.ts`
- Modify: `src/lib/constants/weatherConstants.ts`
- Test: `tests/weather/weatherOperationService.test.ts`

- [ ] Define a narrow operation type for `planting` and `harvesting` and an `WeatherOperationImpact` result containing `allowed`, `workMultiplier`, `paused`, `severity`, and a concise reason.
- [ ] Make the resolver pure and accept the current `WeatherWeekContext`, operation, season, and relevant vineyard state. Keep all weather/season thresholds and multipliers in weather constants.
- [ ] Encode the initial policy:
  - Winter planting is disallowed.
  - Planting and harvesting remain allowed in ordinary conditions.
  - Severe weather slows outdoor work.
  - Extreme conditions may force a weekly pause, but soft harvest pressure remains the normal path.
  - No clearing rule is included.
- [ ] Export the contract only through the weather feature barrel; consumers must not import weather constants directly.
- [ ] Add tests for Winter planting, normal conditions, weather-specific work slowdown, forced pause, and harvest remaining soft-limited.
- [ ] Run: `npx vitest run tests/weather/weatherOperationService.test.ts`

### Task 2: Move operation validation behind the weather boundary

**Files:**
- Modify: `src/lib/services/activity/activitymanagers/activityManager.ts`
- Modify: `src/components/pages/Vineyard.tsx`
- Modify: `src/components/ui/modals/activitymodals/PlantingOptionsModal.tsx`
- Modify: `src/components/ui/modals/activitymodals/HarvestOptionsModal.tsx`
- Test: `tests/activity/activityLifecycle.test.ts`
- Test: `tests/vineyard/vineyardLifecycle.test.ts`

- [ ] Add a final service-side validation path when a planting or harvesting activity is created, using the weather feature’s public operation contract. This must protect callers that bypass the page UI.
- [ ] Replace Vineyard’s local Winter-only button logic with the returned operation limitation so the UI and service share one rule.
- [ ] Show the weather reason in the relevant planting/harvesting modal or action tooltip without exposing raw coefficients.
- [ ] Preserve existing non-weather validation and activity conflict behavior.
- [ ] Keep winter transition cleanup in `vineyardManager.ts`; it remains responsible for cancelling/finalizing an already-running planting activity, while the weather module owns the “not allowed to start” policy.
- [ ] Add regression tests proving Winter planting cannot start through the service path and that ordinary planting/harvesting still can.
- [ ] Run: `npx vitest run tests/activity/activityLifecycle.test.ts tests/vineyard/vineyardLifecycle.test.ts`

### Task 3: Apply soft limits through activity work progression

**Files:**
- Modify: `src/lib/services/activity/activitymanagers/activityManager.ts`
- Modify: `src/lib/services/activity/workcalculators/workCalculator.ts`
- Modify: `src/lib/services/activity/workcalculators/plantingWorkCalculator.ts`
- Modify: `src/lib/services/activity/workcalculators/harvestingWorkCalculator.ts`
- Test: `tests/activity/activityLifecycle.test.ts`
- Test: `tests/weather/weatherTickIntegration.test.ts`

- [ ] Keep activity `totalWork` based on physical vineyard/grape factors rather than baking a one-time weather value into the activity.
- [ ] Extend the existing staff-work contribution options with a weather work multiplier, or an equivalent activity-level modifier, so changing weather affects work already in progress.
- [ ] During weekly progression, resolve the current weather operation impact for each targeted planting/harvesting activity. Set that activity’s work contribution to zero when the impact requires a forced pause; otherwise apply the multiplier to the existing work contribution.
- [ ] Ensure clearing and all non-vineyard activities retain their current behavior.
- [ ] Keep the existing tick order: weather resolves, vineyard state updates, then activities progress.
- [ ] Add tests for slower work, forced pause, weather changing during an activity, and eventual harvest termination through the existing season/ripeness lifecycle.
- [ ] Run: `npx vitest run tests/activity/activityLifecycle.test.ts tests/weather/weatherTickIntegration.test.ts`

### Task 4: Align estimates and player-facing explanation

**Files:**
- Modify: `src/lib/services/activity/workcalculators/plantingWorkCalculator.ts`
- Modify: `src/lib/services/activity/workcalculators/harvestingWorkCalculator.ts`
- Modify: `src/components/ui/modals/activitymodals/PlantingOptionsModal.tsx`
- Modify: `src/components/ui/modals/activitymodals/HarvestOptionsModal.tsx`
- Modify: `src/components/pages/Vineyard.tsx`
- Modify: `src/components/pages/Winepedia.tsx` or the existing weather reference tab
- Test: `tests/vineyard/vineyardLifecycle.test.ts`
- Test: `tests/weather/weatherPresentationService.test.ts`

- [ ] Present the current weather operation condition as a short decision aid: normal, slowed, or paused, with the reason and expected operational consequence.
- [ ] Keep technical weather equations and thresholds in Winepedia, consistent with the existing weather-module design.
- [ ] Make estimates explicit about their scope: current conditions can change before completion, so the activity may take longer than the initial estimate.
- [ ] Do not add direct weather yield, wine-score, or harvest-quality calculations; those remain governed by the existing vineyard projection and harvest pipeline.
- [ ] Add UI regression assertions for winter planting messaging and weather-based operation messaging.
- [ ] Run: `npx vitest run tests/vineyard/vineyardLifecycle.test.ts tests/weather/weatherPresentationService.test.ts`

### Task 5: Documentation and final verification

**Files:**
- Modify: `docs/superpowers/completed/2026-07-10-weather-module-redesign-design.md`
- Modify: `docs/WineSystem_VariableRelationshipMap.md`
- Modify: `CONTEXT.md` only if terminology or active scope changes
- Test: all relevant weather, vineyard, activity, and tick tests

- [ ] Document operation limits as an intentional weather-module consumer and explicitly record that clearing’s annual availability remains outside weather.
- [ ] Update the weather scope statement, since activity work penalties are no longer excluded.
- [ ] Search for duplicated Winter planting/weather operation rules across `src` and remove stale UI-only copies.
- [ ] Run: `npm test`
- [ ] Run: `git diff --check`
- [ ] Confirm no weather constants or limitation formulas are imported by UI components or generic services outside the public weather barrel.

## Deliberate non-goals

- No weather-based annual clearing limit.
- No direct weather-to-yield or weather-to-wine-score multiplier.
- No new harvest hard cutoff beyond the existing season/ripeness/dormancy lifecycle.
- No new weather persistence fields.
- No changes to the five intensity tiers.
