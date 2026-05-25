# Automated Test Coverage Audit

Date: 2026-05-22

Status: Superseded historical audit. Rechecked on 2026-05-25; the suite has grown substantially since this audit, several listed gaps now have coverage, and the current full suite is not green because `tests/user/researchPanelVisibility.test.ts` has two failing visibility expectations. Keep this document as a completed audit record, not as the current coverage source of truth.

## Purpose

Evaluate whether the current automated Vitest suite still makes sense, whether any tests are obsolete, and which implemented game mechanics need better automated coverage.

## Conclusion

The automated test system is still relevant and should stay as the source-of-truth regression suite. The current tests are mostly valid, but they are not yet a complete game-wide test regime.

The suite currently protects many calculation-heavy rules and a few persistence/workflow boundaries. It does not yet protect several high-risk gameplay flows: weekly game tick orchestration, vineyard lifecycle activities, winery lifecycle transitions, sales/order fulfillment, prestige, grape buyer systems, share mechanics, and the deeper loan lifecycle.

## Current Automated Suite

| Folder | Current coverage | Assessment |
|---|---|---|
| `tests/activity/` | Shared work calculation, staff contribution, estimated weeks. | Relevant. Too narrow for the full activity lifecycle. |
| `tests/admin/` | Test Lab run ids and Vitest JSON parser. | Relevant. Does not cover scenario registry, fixture cleanup, or scenario execution. |
| `tests/finance/` | Wage formula and basic loan formula helpers. | Relevant. Missing transaction, company value, economy, loan lifecycle, and seasonal processing. |
| `tests/sales/` | Contract requirement validation for taste/site split. | Relevant but very narrow. Most sales mechanics are uncovered. |
| `tests/user/` | Company creation persistence, starting condition pure helpers, research calculator/config, staff search calculators, wine log snapshots, achievement score resolution. | Relevant. Some files are named like workflows but mainly test calculators/config. |
| `tests/vineyard/` | Yield formula, vineyard size generation, grape suitability. | Relevant. Missing planting, harvesting, ripeness progression, health degradation, clearing, purchase/sale flows. |
| `tests/wine/` | Fermentation characteristic effects, compact anchor parsing, taste quality/wine score integration. | Relevant. Missing full production lifecycle, feature risk, price breakdown, aging, bottling snapshots. |
| `tests/utils/` | Currency formatting. | Relevant. Small but useful. |

## Relevance Review

No current test file looks clearly obsolete. The weakest issue is naming accuracy:

- `tests/user/researchWorkflow.test.ts` tests research calculations and config validity, not the full research workflow.
- `tests/user/hireStaffWorkflow.test.ts` tests staff search and hiring work calculators, not the full search/hire activity workflow.
- `tests/finance/loanService.test.ts` covers formula helpers only, while the loan service now contains a much larger lifecycle.

These files should either be renamed later or expanded so the names match their actual coverage. Keeping them is still better than removing them.

## Coverage Matrix

| Game system | Current automated status | Gaps to close |
|---|---|---|
| Time progression / game tick | Missing | `processGameTick()` weekly orchestration, season/year transitions, side effects order, skip/notification behavior. |
| Activity lifecycle | Partial | Create, pause, resume, cancel, progress, `completeActivityNow()`, and completion handlers for major categories. |
| Vineyard lifecycle | Partial | Land search, purchase, plant, partial planting, ripeness update, harvest, partial harvesting, clearing, health degradation, value recalculation. |
| Winery lifecycle | Partial | Create batch from harvest, crushing activity, fermentation activity, weekly fermentation, bottling, wine log insertion, inventory updates. |
| Wine scoring and pricing | Partial | Land value modifier, price breakdown, feature price multiplier, anchor-to-structure range bridge, post-bottling evolution. |
| Wine features and aging | Missing | Feature initialization, risk preview, weekly risk processing, event triggers, aging status, feature display severity. |
| Sales orders | Missing | Customer generation, order generation, rejection probability, order expiration, fulfill/reject order side effects, relationship boost creation. |
| Contracts | Partial | Generation chance, requirement difficulty, generated contract shape, fulfillment side effects, rejection, expiration, multi-year terms. |
| Grape buyer market | Missing | Seasonal buyers, bulk buyer, grape sale pricing, sale limits, buyer loyalty, yearly caps, relationship price multipliers. |
| Finance and economy | Partial | Transactions, company value, balance/cashflow aggregation, economy phase transition, wage payment processing. |
| Loans and lenders | Partial | Lender generation/availability, loan application, take-loan activity completion, forced loans, restructure, seasonal payments, repayment. |
| Prestige | Missing | Vineyard factor prestige, sale prestige, feature prestige, research prestige, decay, consolidation/display logic. |
| Research | Partial | Eligibility service, completion manager, unlock persistence, permanent effect aggregation, enforcement in planting/fermentation/contracts. |
| Staff and teams | Partial | Staff generation, XP/effective skill, add/remove staff, team assignment/removal/defaults, hiring activity completion. |
| Company/auth/profile | Partial | Company creation is covered; auth, active company switching, settings, and player balance are mostly uncovered. |
| Achievements/highscores | Partial | Achievement tier config and unlock checks, highscore submission/clearing paths, company value rankings. |
| Admin Test Systems | Partial | Scenario param normalization, dry run behavior, scenario registry invariants, fixture cleanup by run id, loopback gate. |
| UI components | Mostly missing by design | Add only targeted UI tests where service tests cannot protect behavior; use Admin Gameflow Lab for manual state inspection. |

## Priority Recommendations

1. Add automated coverage for `processGameTick()`.
   This is the highest-leverage test because it connects activities, vineyard progression, economy, sales, prestige, loans, features, and notifications.

2. Add a harvest-to-bottle service workflow test.
   Cover create batch from harvest, crush, ferment, weekly fermentation, bottle, and wine log snapshot behavior. This protects the main production loop.

3. Add sales order and contract side-effect tests.
   Cover generated order shape, fulfill/reject order effects, relationship boosts, contract fulfillment, contract rejection, and expiration.

4. Add grape buyer market tests.
   The active file `src/lib/services/sales/grapeBuyerMarketService.ts` now carries meaningful market logic and currently has no automated coverage.

5. Expand research tests beyond calculators.
   Cover eligibility gates, unlock persistence, permanent effects, and enforcement hooks.

6. Expand finance/loan tests beyond formulas.
   Cover seasonal payments, forced emergency loans, restructure decisions, repayment, company value, and economy transitions.

7. Add Admin Test Lab behavior tests.
   Cover scenario registry invariants, param normalization, cleanup behavior, and dev/loopback gates.

## Suggested Test Naming Cleanup

Do not delete the existing tests. Rename or expand over time:

| Current file | Better name if not expanded |
|---|---|
| `tests/user/researchWorkflow.test.ts` | `tests/user/researchCalculations.test.ts` |
| `tests/user/hireStaffWorkflow.test.ts` | `tests/user/staffSearchCalculations.test.ts` |
| `tests/finance/loanService.test.ts` | `tests/finance/loanCalculations.test.ts` |

If the files are expanded to include real workflow behavior, the current names can stay.

## Proposed Test Regime

Keep three layers:

1. Pure unit tests
   Fast deterministic tests for formulas, validators, constants, and mappers.

2. Service workflow tests
   Mock or isolate database boundaries where practical. Test activity completion, game tick orchestration, sales fulfillment, production lifecycle, research completion, and loan progression.

3. Database integration tests
   Use sparingly for company-scoped persistence contracts and cleanup-sensitive flows. `tests/user/companyCreation.test.ts` is the current example.

The Admin UI should remain a runner and Gameflow Lab, not the source of assertions. Assertions belong in `tests/`; parameterized manual exploration belongs in the Gameflow Lab.

## Immediate Next Work

Recommended next implementation slice:

1. Create `tests/core/gameTick.test.ts` with mocked service boundaries and explicit side-effect order.
2. Create `tests/wine/wineryLifecycle.test.ts` around the harvest-to-bottle service path.
3. Create `tests/sales/grapeBuyerMarket.test.ts` for seasonal buyer generation, bulk buyer limits, and sale recording.
4. Rename or expand the calculator-only files so naming matches coverage.

This would move the suite from calculation coverage toward actual whole-game regression coverage without needing browser automation.
