# Admin Feature

The Admin feature is a development-only slice intended for compatible Winemaker hosts. Its public seam is `@/lib/features/admin`:

- `configureAdminFeature(feature)` installs a host implementation.
- `getAdminFeature()` provides `isAvailable()` and `renderPage(...)` to the host UI.

The default adapter is unavailable. A host must call `configureAdminFeature()` before its first React render; the module registry is intentionally not reactive. `src/main.tsx` satisfies that ordering requirement by dynamically importing `active.ts` only in Vite development mode. Production therefore remains on the no-op adapter and does not include the active Admin module graph.

## Portability between Winemaker forks

The public seam stays unchanged between forks. `createAdminFeature.ts` constructs the feature from internal dashboard adapters; `active.ts` is the canonical Winemaker adapter and the only place that assembles those collaborators. A fork can keep the facade and Admin UI while replacing the adapter assembly for its own Winemaker module layout.

The default active adapter requires:

- React, the shared Winemaker UI barrel, and `useLoadingState()`.
- Winemaker game-state, activity, vineyard, staff, wine, sales, prestige, and research modules.
- Admin persistence under `src/lib/database/admin/`.
- `@/` resolving to the host's `src/` directory.
- A development-only automated-test adapter compatible with `POST /api/test-run`.

These are explicit compatibility requirements, not a generic administration-package contract. Forks should adapt `active.ts` rather than add host-specific operations to the public facade.

Test Lab commands, fixture creation, cleanup, dynamic option loading, current-user lookup, and automated-test execution are internal collaborators. `createTestLabRunner()` receives them explicitly, keeping tests and the active adapter on the same seam.

The canonical Winemaker adapter calls the development-only `POST /api/test-run` endpoint supplied by `server/test-api.ts` through `vite.config.ts`. Both that endpoint and browser development surfaces require loopback access through the shared development-surface gate; this is a development safeguard, not a substitute for database authorization policies.
