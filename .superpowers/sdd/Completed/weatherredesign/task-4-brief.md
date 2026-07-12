### Task 4: Market adapter

**Files:**
- Create: `src/lib/features/weather/weatherMarketService.ts`, `tests/weather/weatherMarketService.test.ts`
- Modify: `src/lib/features/weather/index.ts`, `src/lib/constants/grapeBuyerMarketConstants.ts`, `src/lib/services/sales/grapeBuyerMarketService.ts`, `src/lib/services/sales/buyGrapeMarketService.ts`, `src/lib/services/sales/sellGrapesService.ts`

- [ ] Write failing tests that every state/intensity yields bounded price/supply multipliers and a reason through `WeatherMarketContext`.
- [ ] Run `npm test -- tests/weather/weatherMarketService.test.ts` and confirm failure.
- [ ] Implement `getWeatherMarketContext(weather: WeatherWeekContext): WeatherMarketContext`; leave market-specific season, economy, buyer sensitivity, and sentiment logic in market services.
- [ ] Replace market-service imports of direct weather tables with the module API; preserve market offer fields and explanatory text.
- [ ] Run `npm test -- tests/weather/weatherMarketService.test.ts tests/sales` and confirm it passes.

Global constraints: five tiers intact; only state/intensity market tuning moves under the module; existing market season/economy/sentiment/buyer logic unchanged; no UI work; no commit.
