-- Preserve existing administration/research values before assigning the
-- long-standing skill_maintenance column to the new Maintenance staff skill.
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS skill_administration_and_research NUMERIC NOT NULL DEFAULT 0.3;

UPDATE staff
SET skill_administration_and_research = skill_maintenance
WHERE skill_administration_and_research = 0.3;
