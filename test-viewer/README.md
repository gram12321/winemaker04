# Legacy Test Viewer

`test-viewer/` contains the old Admin Dashboard test viewer and standalone HTML viewer files. The active implementation is now the Admin Test Lab mounted in:

- `src/lib/features/admin/components/TestLabPage.tsx`
- `src/lib/features/admin/services/testLab/`
- `server/test-api.ts`

## Current Admin Test Lab Path

1. Run the app in development on `localhost` or another loopback host.
2. Select a company.
3. Open the user menu.
4. Choose `Admin Dashboard`.
5. Open the `Tests` tab.

The Admin Dashboard link and `/api/test-run` endpoint are hidden or rejected outside development loopback hosts.

## What Replaced The Old Viewer

- The old hard-coded scenario descriptions are replaced by `testLabScenarios.ts`.
- The old terminal-output parser is replaced by a Vitest JSON reporter parser.
- Test vineyard generation is replaced by tagged scenario runs with durable `testlab_...` ids.
- Cleanup is handled by run id instead of React-only state.

## Legacy Files

- `TestViewer.tsx` and `TestViewerPage.tsx` are retained for reference during migration.
- `index.html` and `viewer.js` are standalone legacy files and are not the active Admin Dashboard path.

Do not add new scenario metadata to this folder. Add new Test Lab scenarios under `src/lib/features/admin/services/testLab/`.
