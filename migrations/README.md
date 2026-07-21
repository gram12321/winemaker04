# Database migration policy

The live Supabase project predates the migration files currently retained in
this repository. Its authoritative remote ledger contains additional historical
migrations that are not available locally.

The files in `archive/` are retained for historical reference only and should
not be replayed as a fresh bootstrap. The active migration directory starts at
the current live-schema cleanup boundary. New database changes should be added
as new migrations here and applied to the existing development project.

If a fresh database is ever required, rebuild it from the live Supabase schema
or a future deliberately maintained baseline before applying active migrations.
