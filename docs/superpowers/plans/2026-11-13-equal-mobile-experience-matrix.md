# Equal Mobile Experience Parity Matrix

Working coverage record for [the implementation plan](./2026-11-13-equal-mobile-experience.md). This matrix records source changes and known interaction surfaces; it does not certify rendered or real-device parity.

## Static baseline and shared behavior

| Surface | Current behavior / risk observed in source | Mobile implementation | Status |
|---|---|---|---|
| App typography and viewport | Root type scale was 9–12px, including on narrow screens; shell used `100vh` behavior. | Phone base is 16px; application roots and Login use dynamic viewport height. | Source updated; layout impact needs rendered review. |
| Header and navigation | Mobile menu was a custom backdrop with no focus trap; tablet range 768–1279 had neither desktop navigation nor the `lg:hidden` menu trigger. | Dialog navigation remains available through 1023px; desktop navigation starts at `lg`; current route, game status, week action, notifications and account destinations have labels. | Source updated; route and focus journeys need browser review. |
| Activity access / order | Mobile activity overlay was custom; activity reordering was drag-only in desktop panel and absent in mobile panel. | Dialog drawer, labeled access button, explicit earlier/later controls in both lists, and live order announcement. | Source updated; order behavior and overlay interactions need browser review. |
| Dialog foundation | Base dialog could exceed short viewports and had no safe-area-aware bounds or generic scrolling. Some screens had oversized contents; production activity overlays were custom. | Shared DialogContent has viewport bounds, internal scroll, safe-area padding; owned dialogs now use Radix shells with reachable body/actions. | Source updated; nested, short-height, keyboard-open cases need browser review. |
| Tooltip and detail disclosure | UnifiedTooltip chose hover vs dialog only by width; mobile wrapper used a non-focusable div and suppressed events on child interactions. | Touch-capability detection plus a named, visible Info button; long content scrolls; existing trigger actions are kept separate. | Source updated; representative nested/control triggers and focus restoration need browser review. |
| Range controls | Land and lender search had independent two-thumb sliders with small thumbs and no precise non-drag input. | Both preserve their own bounds and scales while providing named thumbs and exact min/max entry; land retains its logarithmic hectare mapping; lender duration entry is in years. | Source updated; range-boundary journeys need browser review. |
| Global search / notifications / loan warnings | Header/global overlays and injected loan overlays may cover active content. | Existing contents remain mounted; shared dialog bounds apply where Radix Dialog is used. | Included in route inventory; rendered layering and small-screen reachability need browser review. |

## Route coverage

| Route / workflow | Main owner(s) | Mobile changes in this pass | Status |
|---|---|---|---|
| Login, player selection, company gateway and company creation | `src/components/pages/Login.tsx`, `src/lib/features/company/ui/CompanyGateway.tsx`, user/company features | Dynamic-height, scroll-friendly Login; wrapping links; named company deletion; touch-sized selection and create actions. | Source updated; keyboard-on-screen and create/select flows need browser review. |
| Company overview (`company-overview`, `dashboard`) | `src/components/pages/CompanyOverview.tsx` | Flexible company banner/actions and existing mobile card/stat layouts retained. | Source updated; summary and ranking details need browser review. |
| Vineyard, land search, planting, clearing, harvest and staff assignment | `src/components/pages/Vineyard.tsx`, `src/components/ui/modals/UImodals/vineyardModal.tsx`, `src/lib/features/activities/ui/modals/*` | Phone cards/actions, named details, result eligibility, wrapped options, mobile Dialog shells and precise land ranges. | Source updated; complete vineyard-to-harvest journey needs browser review. |
| Winery, wine production, vessel assignment and wine detail | `src/components/pages/Winery.tsx`, `src/components/ui/modals/UImodals/wineModal.tsx`, activity dialogs | Responsive production sections/tabs; bounded detail dialog; retained comparison detail in deliberate horizontal scroll; activity option body/actions stay reachable. | Source updated; production and vessel journeys need browser review. |
| Equipment and vessel management | `src/components/pages/Equipment.tsx`, `src/components/ui/market/StorageVesselMarketPanel.tsx` | Wide vessel comparison becomes labeled cards; offer comparison retains sortable/selectable values. | Source updated; full equipment decision journey needs browser review. |
| Sales, grape market, contracts, orders and wine cellar | `src/components/pages/Sales.tsx`, `src/components/pages/sales/*`, `src/components/ui/market/*`, `src/components/ui/modals/activitymodals/SellGrapesModal.tsx` | Phone offer/contract/order cards, accessible sorting, precise market quantities/pricing, expiry and terms; full order comparison retained as explicit local scrolling. | Source updated; buy/sell and contract journeys need browser review. |
| Finance, cash flow, founders, wages, loans and lenders | `src/components/finance/*`, `src/lib/features/loanLender/ui/*` | Wrapping tabs/summaries, labeled records, responsive lender modal and named/precise amount and duration ranges. | Source updated; finance and loan decision journeys need browser review. |
| Staff and activity team assignment | `src/lib/features/staff/ui/*`, activity assignment dialogs | Accessible team/skill/details interactions, responsive controls, bounded search/assignment dialogs. | Source updated; recruitment, assignment and competency journeys need browser review. |
| Research | `src/lib/features/researchUpgrade/components/ResearchWorkspace.tsx` | Phone research chains stack; project brief and filters remain discoverable. | Source updated; unlock/prerequisite workflow needs browser review. |
| Weather Center | `src/components/pages/WeatherCenter.tsx` | Phone forecast cards preserve the desktop table's forecast values and explanations. | Source updated; forecast selection and scrolling need browser review. |
| Winepedia and customer reference | `src/components/pages/Winepedia.tsx`, `src/components/pages/winepedia/*`, `src/components/ui/modals/UImodals/winepediaGrapeInfoModal.tsx` | Wrapped tabs, labeled customer rows, explicit scrollable comparisons and bounded grape-details dialog. | Source updated; all reference sections and information triggers need browser review. |
| Achievements | `src/lib/features/achievements/ui/AchievementsPage.tsx` | Responsive cards and accessible actions/details. | Source updated; locked/unlocked states need browser review. |
| Wine Log and history | `src/lib/features/wineLog/ui/*` | Responsive history/statistics and visible year/score detail alongside the chart. | Source updated; filters, record details and empty state need browser review. |
| Highscores and company ranking summaries | `src/lib/features/leaderboards/ui/*` | Wrapping rows and summaries; route remains reachable from company and navigation. | Source updated; filters and ranking contexts need browser review. |
| Profile and Settings | `src/lib/features/user/ui/*` | Responsive wrapping controls, named selection/detail actions and bounded dialogs. | Source updated; save/error/account-switch workflows need browser review. |
| Development Admin | `src/lib/features/admin/` | Not included in mobile parity scope; dev-only and separately inventoried. | Excluded by plan scope. |

## Known limits and validation still required

- No app/browser was launched, in accordance with the repository instruction not to start `npm run dev` without an explicit request. Consequently no rendered phone, tablet, desktop, landscape, short-height, keyboard, zoom, screen-reader, Safari or Chrome validation is claimed.
- Source-level checks performed by the feature workers were TypeScript syntax parsing and scoped whitespace checks; these are not typecheck, build, tests or UI validation. Root integration changes still need project-level typecheck/build before release.
- The mobile root font change scales all rem-based dimensions as well as text. Browser review must inspect dense pages for spacing and scroll regressions.
- The two dual-slider controls remain local to their workflows because one maps logarithmic hectares and the other currency/seasons. Their common accessible behavior is parallel; their domain scales remain separate.
- The Orders comparison intentionally uses a clearly labeled local horizontal scroll in addition to phone cards so detailed customer, relationship and price explanations stay accessible.
- The heatmap's 20px cells remain an overview selection exception; full-size coordinate selectors provide precise touch input.
- Existing Winepedia placeholder sections remain placeholders. No gameplay rule, persistence behavior, company data or offline support was changed.
