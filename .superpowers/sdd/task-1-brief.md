### Task 1: Define the weather operation-limit contract

**Files:**
- Create: `src/lib/features/weather/weatherOperationService.ts`
- Modify: `src/lib/features/weather/weatherTypes.ts`
- Modify: `src/lib/features/weather/index.ts`
- Modify: `src/lib/constants/weatherConstants.ts`
- Test: `tests/weather/weatherOperationService.test.ts`

- Define a narrow operation type for `planting` and `harvesting` and a `WeatherOperationImpact` result containing `allowed`, `workMultiplier`, `paused`, `severity`, and a concise reason.
- Make the resolver pure and accept the current `WeatherWeekContext`, operation, season, and relevant vineyard state. Keep all weather/season thresholds and multipliers in weather constants.
- Encode the initial policy: Winter planting is disallowed; planting and harvesting remain allowed in ordinary conditions; severe weather slows outdoor work; extreme conditions may force a weekly pause, but soft harvest pressure remains the normal path; no clearing rule is included.
- Export the contract only through the weather feature barrel; consumers must not import weather constants directly.
- Add tests for Winter planting, normal conditions, weather-specific work slowdown, forced pause, and harvest remaining soft-limited.
- Run: `npx vitest run tests/weather/weatherOperationService.test.ts`
