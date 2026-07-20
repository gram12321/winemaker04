-- Dirty vessels are currently a warning state, not an allocation blocker.
-- Future condition/cleanliness mechanics may add penalties without preventing use.

DROP TRIGGER IF EXISTS storage_vessel_allocation_requires_clean_vessel ON storage_vessel_allocations;
DROP FUNCTION IF EXISTS enforce_clean_storage_vessel_allocation();
