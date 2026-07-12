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

- Surface normal/slowed/paused with concise reason and operational consequence.
- Keep formulas/thresholds in Winepedia.
- State estimates may change with weather.
- Do not add direct yield/wine-score/quality changes.
- Add relevant UI regression assertions.
