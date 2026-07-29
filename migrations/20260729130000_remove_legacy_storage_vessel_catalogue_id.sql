-- The current vessel model identifies its purchase source with source_offer_id.
-- catalogue_id is an obsolete required field that no client or server path
-- writes, so it prevents every new vessel from being persisted.
ALTER TABLE public.storage_vessels
  DROP COLUMN IF EXISTS catalogue_id;
