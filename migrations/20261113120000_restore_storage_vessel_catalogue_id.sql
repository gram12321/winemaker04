-- Restore the canonical vessel catalogue column expected by the app and NPC
-- used-vessel listing RPC. Existing rows are assigned their closest catalogue
-- entry from their persisted material and capacity.
BEGIN;

ALTER TABLE public.storage_vessels
  ADD COLUMN IF NOT EXISTS catalogue_id text;

UPDATE public.storage_vessels
SET catalogue_id = CASE
  WHEN material = 'oak' THEN CASE WHEN capacity_litres >= 750 THEN 'oak_cask_1000' WHEN capacity_litres >= 400 THEN 'oak_cask_500' ELSE 'oak_cask_250' END
  WHEN material = 'chestnut' THEN CASE WHEN capacity_litres >= 1500 THEN 'chestnut_cask_2000' WHEN capacity_litres >= 750 THEN 'chestnut_cask_1000' ELSE 'chestnut_cask_500' END
  WHEN material = 'stainless_steel' THEN CASE WHEN capacity_litres >= 1800 THEN 'stainless_steel_tank_2500' WHEN capacity_litres >= 750 THEN 'stainless_steel_tank_1000' ELSE 'stainless_steel_tank_500' END
  WHEN material = 'concrete' THEN CASE WHEN capacity_litres >= 2200 THEN 'concrete_tank_3000' WHEN capacity_litres >= 1100 THEN 'concrete_tank_1500' ELSE 'concrete_tank_750' END
  WHEN material = 'ceramic' THEN CASE WHEN capacity_litres >= 750 THEN 'ceramic_container_1000' WHEN capacity_litres >= 400 THEN 'ceramic_container_500' ELSE 'ceramic_container_250' END
  WHEN material = 'plastic' THEN CASE WHEN capacity_litres >= 3500 THEN 'plastic_container_5000' WHEN capacity_litres >= 1800 THEN 'plastic_container_2500' ELSE 'plastic_container_1000' END
  ELSE NULL
END
WHERE catalogue_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.storage_vessels WHERE catalogue_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot infer catalogue_id for one or more storage vessels; review their material and capacity before retrying.';
  END IF;
END;
$$;

ALTER TABLE public.storage_vessels
  ALTER COLUMN catalogue_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storage_vessels_catalogue_id_check'
      AND conrelid = 'public.storage_vessels'::regclass
  ) THEN
    ALTER TABLE public.storage_vessels
      ADD CONSTRAINT storage_vessels_catalogue_id_check CHECK (catalogue_id IN (
        'oak_cask_250','oak_cask_500','oak_cask_1000',
        'chestnut_cask_500','chestnut_cask_1000','chestnut_cask_2000',
        'stainless_steel_tank_500','stainless_steel_tank_1000','stainless_steel_tank_2500',
        'concrete_tank_750','concrete_tank_1500','concrete_tank_3000',
        'ceramic_container_250','ceramic_container_500','ceramic_container_1000',
        'plastic_container_1000','plastic_container_2500','plastic_container_5000'
      ));
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
