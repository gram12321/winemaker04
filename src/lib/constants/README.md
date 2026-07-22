# Constant ownership

This directory contains only configuration shared across multiple domains. Feature-private configuration lives beside the owning feature and should be imported from that feature path directly.

| Area | Owner / import location | Notes |
|---|---|---|
| Core game, time, grapes, vineyard, economy, finance, storage, weather, and shared markets | `src/lib/constants/` | Shared inputs used by more than one domain. Prefer the leaf module over the root barrel when a leaf path is available. |
| Research catalogue and presentation groups | `src/lib/features/researchUpgrade/constants/` | `researchCatalog.ts` owns the project catalogue and its typed research vocabulary. |
| Loans and lender tuning | `src/lib/features/loanLender/constants/` | Loan callers should not depend on the shared constants barrel. |
| Achievement timing | `src/lib/features/achievements/constants/` | Achievement-only cadence and deadline values. |
| Board/share valuation | `src/lib/features/boardShare/constants/` | Dormant by design; retained with the isolated board/share feature. |
| Wine feature definitions and registry | `src/lib/services/wine/features/constants/` | Includes active feature configs plus the dormant `lateHarvest` configuration. |

## Import rule

Use an explicit owner path such as `@/lib/features/researchUpgrade/constants/researchCatalog` or `@/lib/services/wine/features/constants/commonFeaturesUtil`. Use `@/lib/constants` only for genuinely shared values, and do not re-export feature-private configuration through service or general constants barrels.
