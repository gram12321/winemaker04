-- The idempotent purchase ledger is intentionally inaccessible to client roles.
-- Keep its write behind the atomic purchase RPC using the migration owner's privileges.
BEGIN;

ALTER FUNCTION public.purchase_grape_market_offer(
  UUID,
  UUID,
  TEXT,
  NUMERIC,
  UUID[],
  NUMERIC,
  JSONB,
  INTEGER,
  TEXT,
  INTEGER,
  TEXT,
  TEXT
) SECURITY DEFINER;

ALTER FUNCTION public.purchase_grape_market_offer(
  UUID,
  UUID,
  TEXT,
  NUMERIC,
  UUID[],
  NUMERIC,
  JSONB,
  INTEGER,
  TEXT,
  INTEGER,
  TEXT,
  TEXT
) SET search_path = public, pg_temp;

COMMIT;
