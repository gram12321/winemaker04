-- Empty Vessel is a Maintenance activity. Keep the database category guard
-- aligned with the WorkCategory enum so it can be persisted.
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_category_check;

ALTER TABLE activities ADD CONSTRAINT activities_category_check
  CHECK (category IN (
    'PLANTING',
    'HARVESTING',
    'CRUSHING',
    'FERMENTATION',
    'MAINTENANCE',
    'CLEARING',
    'BUILDING',
    'UPGRADING',
    'ADMINISTRATION_AND_RESEARCH',
    'STAFF_SEARCH',
    'STAFF_HIRING',
    'LAND_SEARCH',
    'LENDER_SEARCH',
    'TAKE_LOAN',
    'FINANCE_AND_STAFF'
  ));
