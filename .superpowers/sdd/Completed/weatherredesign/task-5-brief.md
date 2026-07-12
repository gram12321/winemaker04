### Task 5: Presentation models, compact UI, and Winepedia reference

**Files:**
- Create: `src/lib/features/weather/weatherPresentationService.ts`, `tests/weather/weatherPresentationService.test.ts`
- Modify: `src/lib/features/weather/index.ts`, `src/components/pages/WeatherCenter.tsx`, `src/components/pages/Vineyard.tsx`, `src/components/layout/Header.tsx`, `src/components/pages/winepedia/WeatherTab.tsx`, `src/components/ui/modals/activitymodals/SellGrapesModal.tsx`, `src/components/ui/modals/activitymodals/BuyFromMarketModal.tsx`
- Replace: `tests/vineyard/weatherCenterPage.test.ts`
- Delete: `src/lib/services/vineyard/weatherCenterService.ts`, `tests/vineyard/weatherCenterService.test.ts`

- [ ] Write failing tests for a Center model with current weather, forecast, confidence, seasonal outlook, three global outlooks, and concise vineyard rows; a Vineyard tooltip model with normal change, weather contribution, projection, site note; and a Winepedia reference model with technical matrices.
- [ ] Run `npm test -- tests/weather/weatherPresentationService.test.ts tests/vineyard/weatherCenterPage.test.ts` and confirm failure.
- [ ] Rebuild Weather Center with only approved decision surfaces. Retain the Vineyard Weather Impact Preview; delete legend, trigger matrix, site cards/meters, formulas, comparison/debug panels, and planned alerts.
- [ ] Remove coefficient/formula rendering from Vineyard. Keep Header compact. Make buy/sell modals use module-provided weather labels/icons.
- [ ] Build Winepedia Weather as the technical reference, following `WineQualityTab.tsx`: formula, all state × intensity matrices, site rules/bounds, forecast behavior, market derivation, and scope.
- [ ] Run `npm test -- tests/weather/weatherPresentationService.test.ts tests/vineyard/weatherCenterPage.test.ts` and confirm it passes.

Global constraints: operational pages show outcome information only; Winepedia receives all technical mechanics; retain all five intensity tiers; actual/forecast copy must be correctly named; no events/actions/research; use module facade only; no commit.
