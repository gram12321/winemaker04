ALTER TABLE storage_vessels ADD COLUMN production_year INTEGER;
UPDATE storage_vessels SET production_year = purchased_year WHERE production_year IS NULL;
ALTER TABLE storage_vessels ALTER COLUMN production_year SET NOT NULL;
