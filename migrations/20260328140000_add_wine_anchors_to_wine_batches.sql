-- Backend-only JSON for harvest/chemical anchors (taste system foundation).
ALTER TABLE public.wine_batches
ADD COLUMN IF NOT EXISTS wine_anchors jsonb;

COMMENT ON COLUMN public.wine_batches.wine_anchors IS 'Hidden wine anchor values + status (see WineAnchorSet in app); not user-facing.';
