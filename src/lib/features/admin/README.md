# Admin Feature

The Admin feature is a development-only slice intended for compatible Winemaker hosts. `AdminFeature` and `AdminPageProps` are type-only exports from `@/lib/features/admin`; the host passes an `AdminFeature | null` dependency into `App`.

`src/main.tsx` dynamically imports `feature.tsx` only in Vite development mode and passes its `adminFeature` value into `App`. Production passes `null`, so it does not include the active Admin module graph. There is no global registry or no-op adapter.

## Portability between Winemaker forks

The host type seam stays unchanged between forks. `createAdminFeature.ts` constructs the feature from internal dashboard adapters; `feature.tsx` is the canonical Winemaker adapter and the only place that assembles those collaborators. A fork can keep the Admin UI while replacing that adapter assembly for its own Winemaker module layout.

The default active adapter requires:

- React, the shared Winemaker UI barrel, and `useLoadingState()`.
- Winemaker game-state, activity, vineyard, staff, wine, sales, prestige, and research modules.
- Admin persistence under `src/lib/database/admin/`.
- `@/` resolving to the host's `src/` directory.
- A development-only automated-test adapter compatible with `POST /api/test-run`.

These are explicit compatibility requirements, not a generic administration-package contract. Forks should adapt `feature.tsx` rather than add host-specific operations to the host type seam.

Test Lab commands, fixture creation, cleanup, dynamic option loading, current-user lookup, and automated-test execution are internal collaborators. `createTestLabRunner()` receives them explicitly, keeping tests and the active adapter on the same seam.

The canonical Winemaker adapter calls the development-only `POST /api/test-run` endpoint supplied by `server/test-api.ts` through `vite.config.ts`. Both that endpoint and browser development surfaces require loopback access through the shared development-surface gate; this is a development safeguard, not a substitute for database authorization policies.
