-- Remove routines superseded by direct admin adapters or newer RPC signatures.
-- No CASCADE: an unexpected database dependency must block the cleanup.

DROP FUNCTION IF EXISTS public.clear_table(text);
DROP FUNCTION IF EXISTS public.admin_clear_all_tables();
DROP FUNCTION IF EXISTS public.sell_storage_vessel_to_market(uuid, uuid, numeric, integer, text, integer);
