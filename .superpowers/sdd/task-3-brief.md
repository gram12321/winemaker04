### Task 3: Apply actual work and XP consistently in the activity tick

**Files:** `activityManager.ts`, `vineyardManager.ts`, `clearingManager.ts`, lifecycle tests.

- [ ] Prove total awarded XP equals actual persisted progress after team scaling, weather, and final-tick clamping.
- [ ] Add one `getActivityGrapeContext` policy for only Planting, Harvesting, Crushing, Fermentation and validated snapshotted grapes; clearing/maintenance/admin get no grape XP.
- [ ] Refactor `progressActivities()` to calculate preliminary shares, resolve persistable work, allocate exact amount, then award broad-skill/grape XP from applied shares; never task XP.
- [ ] Storage-limited harvesting must return actual permitted work plus merged params; blocked remainder earns no work/XP.
- [ ] Persist completedWork and merged harvest params once; do not let partial harvesting persist stale params.
- [ ] Tick, progress preview, and assignment preview use same calculator/context resolver; completeActivityNow awards no synthetic XP.
- [ ] Run activity lifecycle and calculator focused suites.
