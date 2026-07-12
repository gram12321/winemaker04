# Admin Feature

The Admin feature is a development-only slice intended for compatible Winemaker hosts. Its public seam is `@/lib/features/admin`:

- `configureAdminFeature(feature)` installs a host implementation.
- `getAdminFeature()` provides `isAvailable()` and `renderPage(...)` to the host UI.

The default adapter is unavailable. `src/main.tsx` dynamically imports `active.ts` only in Vite development mode, so production remains on the no-op adapter and does not include the active Admin module graph.

## Compatible host requirements

The active adapter assumes Winemaker domain modules for game state, activities, vineyards, staff, wine fixtures, the canonical `researchUpgrade/components/ResearchAdminInspector` module, and admin persistence. It is portable between hosts that provide those modules and path aliases; it is not a generic administration package.

Test Lab commands, fixture creation, cleanup, and dynamic option loading are internal collaborators. `createTestLabRunner()` receives them explicitly, keeping tests and the active adapter on the same seam.

The automated-suite scenario calls the development-only `POST /api/test-run` endpoint supplied by `server/test-api.ts` through `vite.config.ts`. Both that endpoint and the browser surface require loopback access; this is a development safeguard, not a substitute for database authorization policies.
