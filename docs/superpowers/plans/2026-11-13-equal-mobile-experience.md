# Equal Mobile Experience Implementation Plan

**Goal:** Make every active player feature and all decision-relevant information usable on phone-sized screens while retaining a tailored desktop experience and the existing game rules.

**Architecture:** Maintain one React application, feature facades, services, and persistence model. Share interaction primitives and game-derived data; adapt presentation by available space and input needs. Do not create separate mobile business logic. Deliver in independently reviewable phases, with a full parity audit before declaring the project complete.

**Tech stack:** React, TypeScript, Vite, Tailwind, Radix UI, existing Supabase integration and Vitest. Use browser/device testing alongside focused automated tests.

**Scope:** All active player-facing routes, nested tabs, overlays, and workflows, including optional player identity and company selection. Desktop remains fully supported. The development-only admin dashboard is inventoried separately and is not a mobile parity requirement unless explicitly added. No Expo, app store, offline gameplay, PWA installation, gameplay changes, database changes, or new compatibility layers are required by this plan.

**Execution:** Work sequentially through the phases. Each phase is a separate reviewable change, with a narrow implementation plan where the audit reveals specific targets. Human owns commits. Do not start the development server unless the user asks. Follow the validation policy in `readme.md`; do not repeatedly run full suites.

## Current execution status — 2026-11-13

Source changes now cover the shared shell/interactions and the player-facing routes in all five implementation phases. The route inventory and precise verification gaps are tracked in [the parity matrix](./2026-11-13-equal-mobile-experience-matrix.md). Rendered browser/device parity and project typecheck/build/tests remain outstanding; source-level review is not treated as proof of visual parity.

## Experience contract

- Every active player action, state, value, warning, explanation, selection, and result available on desktop remains discoverable and usable on mobile. Progressive disclosure is acceptable; silently hiding information is not.
- Design for portrait phones at 320, 375, and 390 CSS pixels wide, a short viewport such as 375 × 667, a larger phone, landscape, tablet, and desktop. These are test points, not device-detection rules. Check 200% zoom and text resizing. Account for safe areas, browser chrome, dynamic viewport height, and the on-screen keyboard.
- Page content must not require accidental horizontal scrolling. A deliberate scrollable comparison can be used when it preserves readable labels and is clearly indicated; cards or detail views are preferred when a wide table makes decisions difficult.
- Make primary actions and explanatory controls identifiable without hover or color alone. Use accessible names, visible labels where ambiguity matters, adequate contrast, and practical touch targets; target 44 × 44 CSS pixels where feasible and document unavoidable exceptions.
- Dialogs must fit the visible viewport, scroll their content, keep close and essential actions reachable, preserve input/scroll state where appropriate, support keyboard and screen-reader use, and return focus correctly. Nested overlays must not accidentally activate the underlying row or action.
- Support touch, mouse, keyboard, and hybrid devices. Choose layout using available width, not an assumption that width identifies input capability. Do not make critical information depend on hover, a long press, or drag alone.
- Desktop functionality and information remain intact. Any intentionally changed interaction must preserve its underlying action and outcome.

## Phase 0 — Inventory and baseline

**Starting points:** `src/App.tsx`, `src/components/layout/Header.tsx`, `src/components/pages/`, `src/components/ui/`, player-facing UI under `src/lib/features/`, and `tests/`.

- [ ] Create a parity matrix as a working artifact alongside this plan. Enumerate every active route in `src/App.tsx`, including Login/company gateway, Company, Vineyard, Winery, Equipment, Sales, Finance, Research, Staff, Weather, Profile, Settings, Achievements, Wine Log, Highscores, Winepedia and customer reference. Follow feature facades to include feature-owned surfaces and nested tabs.
- [ ] For each route enumerate dialogs, all actions, informative icons/tooltips, tables, charts, filters, empty/loading/error states, and touch-dependent controls. Record owner path, desktop baseline, mobile issue, proposed pattern, verification scenario, and status. Include global search, notifications, activity panel, turn advancement, and overlays.
- [ ] Inventory raw Radix tooltips and custom dialogs as well as `UnifiedTooltip`; do not assume a change to one shared component covers all consumers. Locate fixed widths/heights, clipped content, sticky/fixed controls and interaction handlers. Inventory both `DualSlider` implementations and their range semantics.
- [ ] Inspect representative screens at phone and desktop sizes when an authorized running environment is available; record screenshots or observations and distinguish actual failures from code-based risks. Capture representative populated, empty, loading, and error states where feasible. Identify test fixtures and safe, non-destructive data before interactive testing.
- [ ] Use the inventory to split phases 3–5 into scoped implementation batches with exact affected files and focused checks. Record dependencies and any product decisions, without blocking the audit on unresolved visual choices.

**Exit:** Every active route and overlay has an owner and verification scenario; prioritized issues and uncertain behavior are recorded. No feature is declared complete based only on a CSS search.

## Phase 1 — Shared mobile interaction foundations

**Starting files:** `src/components/ui/shadCN/tooltip.tsx`, `src/components/ui/shadCN/dialog.tsx`, `src/hooks/use-mobile.tsx`, `src/components/ui/shadCN/slider.tsx`, `src/lib/features/activities/ui/modals/LandSearchOptionsModal.tsx`, `src/lib/features/loanLender/ui/LenderSearchOptionsModal.tsx`, and relevant existing tests.

- [ ] Establish shared responsive dialog behavior for bounded viewport height, internal scrolling, reachable header/close/footer, keyboard and safe-area handling. Audit call-site overrides and custom dialogs, since changing the base component alone cannot guarantee fit. Verify existing desktop dimensions and focus behavior.
- [ ] Redesign information disclosure around explicit, focusable, named triggers. Preserve desktop hover and keyboard access; offer a discoverable tap/click path for touch and hybrid devices. Use visible labels or an information control when an icon or value is ambiguous. Promote information required for an immediate decision into the surrounding interface where opening multiple explanations would hinder the task.
- [ ] Refactor `UnifiedTooltip` and `MobileDialogWrapper` only after auditing consumers: current narrow-layout code uses a dialog and a `div` trigger with `tabIndex={-1}`, propagation suppression, and focus restoration. Ensure keyboard reachability and meaningful accessible names; avoid nested interactive elements, duplicate actions, accidental row activation, and inaccessible focus restoration. Preserve or intentionally migrate all existing consumers, including raw tooltip users. Long details must scroll and remain legible; verify nested-dialog behavior.
- [ ] Examine the two local `DualSlider` implementations. Define one reusable presentation control if their range/step semantics can be represented without changing behavior; migrate both consumers directly. Provide separately named minimum and maximum controls, readable values, non-overlapping touch targets, keyboard support, and a precise non-drag alternative. Preserve allowed bounds, step sizes, ordering rules, and existing reset/default behavior. Test boundaries, equal or nearby handles, and both calling workflows.
- [ ] Audit other shared controls, including select menus, tabs, charts, scroll areas and toast placement. Add reusable patterns only when multiple real consumers need them. Keep business calculations in services/features.
- [ ] Add focused behavior tests for disclosure, focus/activation and slider range semantics where existing test infrastructure permits. Check desktop, touch and keyboard in a rendered browser, including a tooltip inside an actionable card and inside a dialog.

**Exit:** Shared patterns work in representative real consumers without changing gameplay or regressing desktop. The parity matrix identifies any remaining one-off controls.

## Phase 2 — Shell and first complete journey

**Starting files:** `src/App.tsx`, `src/components/layout/Header.tsx`, `src/components/pages/Login.tsx`, `src/components/pages/CompanyOverview.tsx`, company and user feature UI, `src/lib/features/activities/ui/ActivityPanel.tsx`.

- [ ] Adapt navigation, status, notifications, global search and next-turn access for phone, tablet and desktop. Preserve access to all routes and account/company actions. Ensure menu scrolling, safe areas, focus management and visible current location.
- [ ] Adapt login/local-player and company selection/creation flows; retain the current identity and ownership rules. Make errors and recovery visible with the keyboard open.
- [ ] Adapt Company overview and activity list, including empty states, explanations and progress. Ensure reordering has a non-drag alternative and produces the same persisted order as the existing interaction.
- [ ] Verify a representative end-to-end journey from entry through company activation, activity interaction and advancing a week, then revisit on desktop. Check loading, failures and cancellation without causing unintended duplicate actions.

**Exit:** A player can enter a company, understand the overview and manage activities on a phone; desktop and phone produce the same underlying outcomes.

## Phase 3 — Vineyard and production

**Starting files:** `src/components/pages/Vineyard.tsx`, `src/components/pages/Winery.tsx`, `src/components/pages/Equipment.tsx`, `src/components/ui/modals/UImodals/vineyardModal.tsx`, `src/components/ui/modals/UImodals/wineModal.tsx`, and `src/lib/features/activities/ui/modals/`.

- [ ] Redesign vineyard lists and details, land search/results, clearing, planting, harvest, staff selection and related previews; retain every constraint, cost, warning and comparison.
- [ ] Adapt winery/inventory, crushing, fermentation, vessel allocation, aging, bottling, equipment and wine details. Ensure users can inspect the values needed before confirming an operation.
- [ ] Resolve lengthy or nested modals individually using the shared patterns; use full-height mobile surfaces or staged presentation when warranted while retaining selections and cancellation semantics.
- [ ] Verify a populated vineyard-to-wine production journey, including constrained and unavailable states, both slider workflows where applicable, cancellation, and desktop parity. Run focused tests for behavior changed in this phase.

**Exit:** All production-related matrix entries are complete and verified; no essential information is only available on hover.

## Phase 4 — Trade, finance and people

**Starting files:** `src/components/pages/Sales.tsx`, `src/components/pages/Finance.tsx`, `src/components/pages/sales/`, `src/components/ui/market/BuyMarketModal.tsx`, `src/components/ui/modals/activitymodals/SellGrapesModal.tsx`, `src/lib/features/staff/ui/`, and `src/lib/features/loanLender/ui/`.

- [ ] Adapt grape and vessel buying, grape sales, offers, contracts, customer information and wine assignment. Replace or restructure wide comparisons where needed; preserve sortable/filterable data, prices, eligibility, warnings and confirmation outcomes.
- [ ] Adapt finance, loans, lender searches and founder information, including both bounds and all costs or repayment terms. Verify precise entry and decision visibility at small widths.
- [ ] Adapt staff workspace, staff details, search, recruitment, teams and assignment. Ensure roster and competency information remains available, with practical selection and clear disabled reasons.
- [ ] Test complete buying/selling, finance and staff workflows with populated, empty and ineligible states; check that no hidden column changes the decision and verify desktop parity. Run focused tests for changed behavior.

**Exit:** Trade, financial and staff matrix entries are complete with all decision-critical details and actions reachable.

## Phase 5 — Remaining player surfaces and parity sweep

**Starting files:** `src/components/pages/Research.tsx`, `src/components/pages/WeatherCenter.tsx`, `src/components/pages/Winepedia.tsx`, `src/lib/features/achievements/`, `src/lib/features/wineLog/`, `src/lib/features/leaderboards/`, and `src/lib/features/user/`.

- [ ] Adapt research, weather, reference content, achievements, history, leaderboards, profile and settings, including charts, long reference text and filters. Inspect actual feature-owned UI files through public feature entry points before changes.
- [ ] Walk every parity-matrix row and nested state; document intentional interaction differences and resolve omissions. Check orientation changes, long content, text scaling, back/close behavior and desktop layouts.
- [ ] Check account switching and resuming the same company across devices using existing supported modes. Investigate concurrent sessions if encountered; do not promise safe concurrent editing or offline support without a separate design.

**Exit:** Every active player-facing route, action and detail has a recorded pass or a visible, explicitly accepted exception; no unreviewed matrix entries remain.

## Validation and integration gate

- For each batch, use focused tests only where behavior changes, plus targeted rendered checks of the changed flows on phone and desktop. Record exact commands, device/browser/viewport and outcomes. Do not claim device validation if it was only emulated.
- At integration, run `npm test`, `npm run build`, and `git diff --check` once on the consolidated candidate per `readme.md`. Rerun only after relevant fixes or changes.
- Perform end-to-end manual or automated browser journeys across the parity matrix, including keyboard-only operation and screen-reader spot checks for disclosure/dialog/range controls. Test real iPhone Safari and Android Chrome when devices are available; record missing coverage and blockers explicitly.
- Verify no accidental page-level horizontal overflow at target widths, usable text at zoom, keyboard visibility, safe areas, focus return, nested overlay behavior, error states, and desktop regressions. Treat deliberate local comparison scrolling as an audited exception.
- Review ownership boundaries: UI remains presentation/interaction; services/features own business rules; persistence stays in `src/lib/database/`; use current facades and shared types. Update current docs only if their documented responsibilities or behavior change; do not edit the human-owned version log during routine implementation.

## Planning decisions and risks

- The matrix and actual browser inspection determine the final per-screen design and effort; this roadmap is not an estimate that all changes are shared-component fixes.
- The current `useIsMobile` threshold is 768px and tooltip behavior is width-dependent. Audit tablets, desktop windows and touch-capable laptops before changing that policy. Layout and input capability are separate concerns.
- Avoid opening a modal for every small fact: choose inline text, an explicit detail view, or a disclosure appropriate to the workflow. Preserve existing content and verify it remains discoverable.
- The two local dual sliders may differ in defaults or constraints; prove equivalence before consolidating. Do not impose new domain rules from the UI.
- A web app can later gain installability through a separately scoped PWA; offline writes, conflict resolution, push notifications and store distribution are outside this plan.
