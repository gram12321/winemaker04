# Project Context

Date: 2026-07-20
This is the stable vocabulary and rules snapshot. Use `docs/PROJECT_INFO.md` for code ownership and `docs/AIdocs/AIDescriptions_coregame.md` for implementation status.

## Wine vocabulary

| Layer | Meaning | Representative data |
|---|---|---|
| Site | Vineyard and regional inputs | country, region, soil, altitude, aspect, land value, density, overgrowth, vine age, health, ripeness |
| Grape | Variety-inherent traits | color, yield, fragility, oxidation risk, base structure |
| Anchors | Persisted hidden wine identity | sugar, acid, phenolic, aromatic, body, terroir, and process states |
| Process | Player production choices | harvest timing, crush options, fermentation method/temperature |
| Quality | Physical and sensory results | six structure channels, structure index, 14 taste families, taste quality index |
| Lifecycle | Post-creation evolution | features, oxidation, bottle aging, prestige |
| Market | Supply, demand, and relationships | economy, weather, loyalty, buyers, suppliers, grape/batch state |
| Equipment | Individually owned storage assets | type, capacity, material, quality, condition, fills, cleanliness, ownership |

## Core wine rules

- Anchors are compact persisted values. Unknown database keys are ignored; missing anchors resolve to neutral values.
- Structure channels are `acidity`, `aroma`, `body`, `spice`, `sweetness`, and `tannins`. `structureIndex` uses ideal ranges, penalties, and synergies; base ranges are 0.40–0.60, 0.30–0.70, 0.40–0.80, 0.35–0.65, 0.40–0.60, and 0.35–0.65 respectively.
- `tasteQualityIndex` measures family-level balance and is distinct from land value. Descriptors are presentation only.
- `wineScore = (tasteQualityIndex + structureIndex) / 2`. Estimated price combines the score curve, land value, features, company prestige, and vineyard prestige; the base rate is 25 per bottle, with a 0.2–3.0 land-value multiplier and a 99,999,999.99 ceiling.
- Harvest and bottling snapshots are immutable historical inputs for Wine Log, leaderboards, and achievements; cellar values can continue to evolve.

## Production, equipment, and markets

- Production moves through grapes, must, wine, and bottled states. Fermentation methods are Basic, Temperature Controlled, and Extended Maceration; temperatures are Ambient, Cool, and Warm.
- Contracts distinguish taste quality, structure, land value, origin, grape, site, and characteristic thresholds. Forward contracts can target bottled wine, grapes, `must_ready`, or `must_fermenting`.
- Buy Market is separate from direct sell-side grape buyers. It combines registered domain panels through one normalized offer/source/counterparty contract. Local catalogues and global assets remain separate internally; adapters retain their own evolution, base pricing, and fulfilment rules while sharing seller presentation and relationship pricing. Global grape lots are NPC-custodied snapshots: the seller receives 70% immediately, while every viewer sees the same deterministic state, quality, and fermentation projection at a given game date.
- Wine contact marks a vessel dirty. Cleanliness is currently warning-only: dirty operational vessels remain allocatable. Empty Vessel is cancellable Maintenance that removes only the selected vessel's filled volume; Clean Vessel is a separate cancellable activity. Cancellation preserves already placed wine and its active plan.

## Weather, research, and ownership

- Weather stores company-scoped weekly state, intensity, seasonal pattern/confidence, and next-week forecast. It bounds vineyard progression and operation work and supplies market context; it does not directly change yield, harvest anchors, or wine score.
- Research uses work profiles plus prestige, prerequisite, company-value, buyer-loyalty, and achievement gates. Implemented unlocks cover grapes, fermentation, staff/vineyard caps, contracts, and grape-buyer progression; the active permanent effect is vineyard-health decay reduction.
- Founders have zero wages, receive 20% of positive yearly net profit per founder, and can be bought out for 15% of company asset value. Prestige is derived from permanent and decaying ledger events.
- `boardShare` remains an inactive seam; public-company/share gameplay is deferred.

## Staff competency

- Each activity category maps to one primary skill. `specializedRoles` is the six-role innate career layer; matching roles add 20% to that primary skill.
- `experience["task:<WorkCategory>"]` is learned exact-task mastery (up to 20%); `experience["grape:<GrapeVariety>"]` is bounded variety mastery (up to 10%) for planting, harvesting, crushing, and fermentation. Neither changes wages.
- Role, task, and grape bonuses are additive and capped at 50%. The shared work calculator applies skill, team, multitasking, weather, research, storage, and final-tick limits; XP is awarded only for persisted applied work.

## Naming rules

- Structure, Taste Quality, and land value are separate concepts.
- Weather and research modify explicit inputs or access rules, not hidden score side effects.
- Development-stage schema changes are clean cutovers: update consumers to renamed types/functions and do not add compatibility aliases, wrappers, backfills, or legacy-table support.
