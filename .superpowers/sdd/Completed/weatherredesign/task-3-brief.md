### Task 3: Tick contract and shared yield calculation

**Files:**
- Modify: `src/lib/services/core/gameState.ts`, `src/lib/services/core/gameTick.ts`, `src/lib/services/vineyard/vineyardManager.ts`, `src/lib/services/vineyard/vineyardService.ts`, `src/lib/services/index.ts`
- Create: `tests/weather/weatherTickIntegration.test.ts`
- Modify: `tests/core/gameTick.test.ts`, `tests/vineyard/yieldCalculator.test.ts`

- [ ] Write failing integration tests proving weather is initialized only when absent, persisted every tick, applied before `progressActivities`, and passed with planting/research modifiers to the shared projection.
- [ ] Write yield parity assertions: expected yield and actual harvest yield derive from one `calculateVineyardYieldBreakdown(vineyard)` source.
- [ ] Run `npm test -- tests/weather/weatherTickIntegration.test.ts tests/core/gameTick.test.ts tests/vineyard/yieldCalculator.test.ts` and confirm failure.
- [ ] Integrate resolver and projection. Tick order is: advance calendar, resolve/persist weather, apply vineyard progression, then progress activities.
- [ ] Run the same command and confirm it passes.

Use `@/lib/features/weather` new APIs. Task 2 retained a deprecated compatibility seam only for remaining UI consumers; do not delete it yet. Preserve all five tiers. Do not commit.
