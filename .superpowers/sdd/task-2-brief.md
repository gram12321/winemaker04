### Task 2: Move operation validation behind the weather boundary

**Files:**
- Modify: `src/lib/services/activity/activitymanagers/activityManager.ts`
- Modify: `src/components/pages/Vineyard.tsx`
- Modify: `src/components/ui/modals/activitymodals/PlantingOptionsModal.tsx`
- Modify: `src/components/ui/modals/activitymodals/HarvestOptionsModal.tsx`
- Test: `tests/activity/activityLifecycle.test.ts`
- Test: `tests/vineyard/vineyardLifecycle.test.ts`

- Add final service-side validation for planting/harvesting creation through the weather feature public contract.
- Replace local Winter-only UI logic with shared operation limitation.
- Surface concise weather reason in planting/harvest modal or action tooltip.
- Preserve non-weather validation and conflicts.
- Keep existing Winter transition cleanup in `vineyardManager.ts`; weather owns start-policy.
- Add regression tests for service-side Winter planting rejection and ordinary operations.
- Run the listed focused tests.
