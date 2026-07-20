-- Breaking staff specialization cutover: task mastery lives only in experience JSON.
ALTER TABLE staff
  DROP CONSTRAINT IF EXISTS staff_task_specializations_is_array,
  DROP CONSTRAINT IF EXISTS staff_task_specializations_are_valid;

DROP FUNCTION IF EXISTS public.staff_task_specializations_are_valid(jsonb);

ALTER TABLE staff
  DROP COLUMN IF EXISTS specializations,
  DROP COLUMN IF EXISTS task_specializations,
  ADD COLUMN IF NOT EXISTS specialized_roles jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE staff
SET specialized_roles = '[]'::jsonb
WHERE specialized_roles IS NULL;

ALTER TABLE staff
  ALTER COLUMN specialized_roles SET DEFAULT '[]'::jsonb,
  ALTER COLUMN specialized_roles SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_specialized_roles_is_array') THEN
    ALTER TABLE staff ADD CONSTRAINT staff_specialized_roles_is_array
      CHECK (jsonb_typeof(specialized_roles) = 'array');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.staff_specialized_roles_are_valid(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(value) = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(value) AS role(value)
      WHERE role.value NOT IN (
        'field', 'winery', 'maintenance', 'administrationAndResearch', 'sales', 'financeAndStaff'
      )
    );
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_specialized_roles_are_valid') THEN
    ALTER TABLE staff ADD CONSTRAINT staff_specialized_roles_are_valid
      CHECK (public.staff_specialized_roles_are_valid(specialized_roles));
  END IF;
END $$;
