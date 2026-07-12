### Task 3: Apply soft limits through activity work progression

**Files:**
- Modify: `src/lib/services/activity/activitymanagers/activityManager.ts`
- Modify: `src/lib/services/activity/workcalculators/workCalculator.ts`
- Modify: `src/lib/services/activity/workcalculators/plantingWorkCalculator.ts`
- Modify: `src/lib/services/activity/workcalculators/harvestingWorkCalculator.ts`
- Test: `tests/activity/activityLifecycle.test.ts`
- Test: `tests/weather/weatherTickIntegration.test.ts`

- Keep `totalWork` weather-neutral.
- Apply current weather multipliers and forced pauses to weekly work contribution for planting/harvesting only.
- Preserve all other activity behavior, including clearing.
- Keep tick order unchanged.
- Test slowdown, pause, changing weather, and existing lifecycle termination.
