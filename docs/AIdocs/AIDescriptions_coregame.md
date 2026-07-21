# Core Game Mechanics

Last code-verified: 2026-07-20
This is the concise behavior/status guide. Use `CONTEXT.md` for rules and vocabulary, and `docs/PROJECT_INFO.md` for ownership and boundaries.

## Runtime and player surfaces

- `processGameTick()` advances activities, orders/contracts, forward contracts, vines, prestige, economy/weather, and seasonal finance hooks. Supabase stores company-scoped game state and domain records.
- Main surfaces are Login, Company Overview, Vineyard, Winery, Equipment, Sales, Finance, Research, Staff, Weather Center, Wine Log, Winepedia, Achievements, Leaderboards, Profile, Settings, and the development-only Admin Dashboard.
- Winepedia is the technical reference. Admin Test Systems runs the shared Vitest suite and Gameflow Lab fixtures; the Admin feature is loopback-gated and loaded only in Vite development.

## Implemented behavior

### Vineyard, weather, and production

- Weather persists weekly state/intensity, seasonal pattern/confidence, and next-week forecast. It supplies bounded vineyard progression, operation impacts, and market context; severe events, mitigation, weather research, and weather achievements are deferred.
- Wine progresses through grapes, must, wine, and bottled states via crushing, fermentation, aging, features, oxidation, and bottle lifecycle effects. Bottling creates immutable historical snapshots while cellar values can evolve.
- Contracts validate taste/structure/site/origin/grape requirements. Forward contracts cover bottled wine, grapes, `must_ready`, and `must_fermenting`.

### Markets and storage

- Sell-side grape buyers remain independent from the generic Buy Market. Buy Market combines Grape Procurement with new quantity-based and globally listed used Storage Vessel sources; offers have displayed sellers and buyer-to-seller relationship pricing.
- Used vessels preserve asset identity, ownership history, material, age, condition, fills, and cleanliness. Condition/value are projected for the viewer's game date and purchase/sell-back use atomic listing commands.
- Wine contact marks vessels dirty, but cleanliness is warning-only and dirty operational vessels remain allocatable. Empty Vessel and Clean Vessel are cancellable Maintenance activities; emptying changes only the selected vessel's volume and releases only that vessel.

### Finance and progression

- Finance statements, cash flow, loans/lenders, staff/team work, founders, prestige, achievements, and leaderboards are active. Founder returns, buyout, loan payments, warnings, restructuring, and defaults are persisted workflows.
- Staff use category-derived primary skills, six innate broad roles, exact task mastery, and bounded grape mastery. Work previews and ticks share one calculator; XP is awarded only from persisted applied work.
- `companyFeature.records` owns explicit company records and owner-scoped portfolio statistics; `companyFeature.setup` owns starting-condition preview/application; `companyFeature.lifecycle` exposes the company-activation hook seam; and `companyFeature.ui` owns the company gateway. Core game state remains the host for active-company session orchestration.
- Research activity and unlock gates are active for grapes, fermentation, staff/vineyard caps, contracts, and grape-buyer progression. The current permanent effect reduces vineyard-health decay. Companies may be owned or unowned and remain playable.

## Deferred or partial

- Public-company/share gameplay and the `boardShare` host integration.
- Vessel-memory gameplay and generic player-to-player asset listings.
- Equipment and vineyard-technique research tracks, dedicated weather research/achievements, severe-weather actions, broad bottle-market demand simulation, customer taste matching, descriptor-level scoring, and persisted grape-change history for grape-tenure achievements.
- Research `benefits` copy may be aspirational; `unlocks` and `permanentEffects` define runtime behavior.

## File map

- Customer generation, orders, relationships, partial fulfillment, contracts, expiration, and rejection are implemented.
- Contract checks distinguish taste quality, structure, site/origin, grape identity, and characteristic requirements.
- Sell-side grape buyers remain independent. The Buy Market owns generic persisted offers and a registered-domain dispatcher for lifecycle and purchase coordination; one modal shell hosts the Grape Procurement and Storage Vessels panels. Every Buy Market offer has a displayed seller and a buyer-to-seller market relationship, while each adapter retains its own base pricing and lifecycle rules. Storage Vessels combines company-scoped quantity supplier stock with canonical global used-vessel listings. Used listings retain the underlying asset's identity, material, age, condition, fills, and cleanliness; their condition and base value are deterministically projected for the viewer's game date before the buyer’s relationship multiplier is applied. Storage-vessel effects on produced wine remain deferred.
- Forward pre-sale contracts are generated by bulk/NPC buyers for bottled wine, grapes, `must_ready`, or `must_fermenting`; quantity and price scale with company value, prestige, market context, and loyalty.

### Finance, Staff, and Progression

- Finance statements, cash flow, asset value, loans/lenders, staff/team work, activities, founder economy, prestige, achievements, and highscores are active.
- `loanLenderFeature` exposes a shared borrower quote seam and keeps repayment operations separate from payment/default/restructure lifecycle orchestration.
- `achievementsFeature` owns the game-specific catalog, evaluation, company-keyed tick cadence, read models, and player page; its database adapter remains under `database/core/`. Each evaluation captures one company and game-state snapshot, and unlock plus company/vineyard prestige uniqueness is enforced in persistence so overlapping checks are retry-safe; malformed retired achievement rows are discarded rather than translated. Vineyard grape-tenure achievements remain deferred until grape-change history is persisted.
- `userFeature` owns optional player identity/session/profile, player wallet, company-scoped preferences, and the Profile/Settings UI. Its session operation clears both authenticated and local-player selection.
- `companyFeature.records` owns explicit company records, feature-owned read models, and owner-scoped portfolio statistics; `companyFeature.setup` owns starting-condition preview/application; `companyFeature.lifecycle` exposes the company-activation hook seam; and `companyFeature.ui` owns the company gateway. Core game state remains the host for active-company session orchestration.
- `leaderboardsFeature` owns feature-native score recording inputs, rankings, and leaderboard presentation. A migration and database RPC atomically retain each company's best aggregate value/per-week score; wine/vineyard records remain historical entries and `lowest_price` ranks ascending.
- `wineLogFeature` owns immutable bottling-history records, vineyard history/analytics, Wine Log presentation, and the bottling-to-leaderboard integration. The winery lifecycle calls its public record seam; player identity and session behavior remain owned by `userFeature`.
- App composes lender initialization and active-company activation. Unowned companies remain a supported active-company mode.
- Maintenance is a distinct persisted staff skill and task class; the default Maintenance Team handles it separately from Winery's crushing and fermentation work. Staff can hold broad `specializedRoles` and learned task/grape mastery; role, task, and grape bonuses are additive and capped, while wages count broad-role primary-skill groups once.
- Staff use one primary skill per activity category. `specializedRoles` is an innate persisted career-role array with six title-bearing roles; a matching role adds its 20% bonus to every activity using that primary skill. Learned `task:<WorkCategory>` experience only improves its exact implemented task, while learned `grape:<variety>` is a separate bounded bonus for grape-aware planting, harvesting, crushing, and fermentation. Sales remains a primary skill without task mastery until a Sales activity exists.
- `workCalculator.ts` supplies the one staff-work allocation used by previews and ticks. The tick awards broad-skill, task, and eligible grape XP only from persisted applied work, so final-tick, weather, storage, and assignment changes cannot over-credit staff. The old `specializations` and interim `task_specializations` columns have been removed; only `specialized_roles` and the existing experience map persist this model.
- `staffFeature` at `src/lib/features/staff/` owns feature-native staff/team records, competency, recruitment, wages/founders, presentation, and the Staff workspace. Its eager facade is pure; core, Finance, and Activities invoke runtime workflows through it. Staff/team membership assignment, removal, and deletion each use a company-scoped atomic database operation so both denormalized membership lists remain consistent. Activities consume Staff’s team-selection, candidate creation, and competency operations without a reverse Staff → Activities import.
- Founders have zero wages, receive yearly positive-profit returns, and can be bought out into salaried staff.
- Prestige is derived from the `prestige_events` ledger with permanent and decaying sources; it feeds pricing, land value, gates, achievements, and UI.
- Research projects use work profiles and prestige/prerequisite/company-value/buyer-loyalty/achievement gates. Active unlocks cover grapes, fermentation, staff/vineyard caps, contracts, and grape-buyer progression. Current permanent effect: vineyard health-decay multiplier.

## Deferred or Partial Areas

- Full public-company/share-market runtime.
- Equipment gameplay beyond Storage Vessels, advanced farming methods, broad bottle-market demand simulation, customer taste matching, descriptor-level scoring, severe weather events/actions, and dedicated weather research/achievements. Storage Vessels now track cleanliness: wine contact makes them dirty, releasing wine leaves them dirty, and a cancellable Clean Vessel Maintenance activity is required before reuse. Empty Vessel remains a cancellable Maintenance activity that removes the selected vessel's filled volume, reduces the batch, and releases only that vessel (deleting the batch only when no volume remains). Cancelling another production activity preserves its active vessel plan and partially produced wine; only a never-activated reservation is released.
- Research `benefits` copy may be aspirational; `unlocks` and `permanentEffects` define actual behavior.

## Main File Map

| Area | Primary locations |
|---|---|
| Core/tick | `src/lib/services/core/` |
| Activities | `src/lib/features/activities/`, `src/lib/database/activities/activityDB.ts` |
| Company setup/lifecycle | `src/lib/features/company/`, `src/lib/services/core/gameState.ts` |
| Wine Log | `src/lib/features/wineLog/`, `src/lib/database/core/wineLogDB.ts` |
| Vineyard/weather | `src/lib/services/vineyard/`, `src/lib/features/weather/`, `src/components/pages/Vineyard.tsx`, `WeatherCenter.tsx` |
| Wine/scoring | `src/lib/services/wine/`, `src/lib/wineStructure/`, wine modal components |
| Sales/markets | `src/lib/services/sales/`, sales pages/modals, `src/lib/database/sales/` |
| Finance/loans/founders | `src/lib/services/finance/`, `src/lib/features/loanLender/`, `src/components/finance/` |
| Research | `src/lib/features/researchUpgrade/`, `src/lib/constants/researchConstants.ts`, `src/components/pages/Research.tsx` |
| Prestige/progression | `src/lib/services/prestige/`, `src/lib/features/achievements/`, highscore services/databases |
| Tests | `tests/` |
