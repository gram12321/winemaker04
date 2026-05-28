-- Preserve sub-percent vineyard simulation values.
-- Ripeness and vineyard health are stored on a 0-1 scale.
-- They need more than two decimal places because weekly tick deltas are often below one percentage point.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vineyards'
      and column_name = 'ripeness'
  ) then
    alter table public.vineyards
      alter column ripeness type double precision using ripeness::double precision;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vineyards'
      and column_name = 'vineyard_health'
  ) then
    alter table public.vineyards
      alter column vineyard_health type double precision using vineyard_health::double precision;
  end if;
end $$;
