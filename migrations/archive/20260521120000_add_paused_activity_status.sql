-- Allow 'paused' as a valid activity status value.
-- Activities with status='paused' are visible in the UI but their assigned
-- staff do not contribute work to them until the activity is resumed.

DO $$
BEGIN
  -- Drop and recreate the CHECK constraint if it exists, adding 'paused'
  BEGIN
    ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE activities ADD CONSTRAINT activities_status_check
      CHECK (status IN ('active', 'paused', 'cancelled'));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END
$$;
