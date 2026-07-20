-- Remove schema that is no longer exercised by the current game runtime.
--
-- Intentionally no CASCADE: an unexpected dependency must block this migration
-- so it can be reviewed, rather than being removed implicitly.
--
-- Public-company/share gameplay remains deferred. Its inactive facade contains
-- no database calls, so these tables and their dead adapters are removed until
-- that feature is deliberately reintroduced with a new schema.

DROP TABLE IF EXISTS public.company_metrics_history;
DROP TABLE IF EXISTS public.board_satisfaction_history;
DROP TABLE IF EXISTS public.company_shares;

-- These tables have no runtime callers. The vessel-purchase RPC that formerly
-- used market_purchase_operations was removed in 20260715140000.
DROP TABLE IF EXISTS public.market_purchase_operations;
DROP TABLE IF EXISTS public.loan_warnings;
DROP TABLE IF EXISTS public.user_settings;

-- Keep the admin reset command valid after user_settings is removed.
CREATE OR REPLACE FUNCTION public.admin_clear_all_tables()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    table_name text;
    result text := '';
BEGIN
    FOR table_name IN
        SELECT unnest(ARRAY[
            'relationship_boosts',
            'wine_orders',
            'wine_batches',
            'vineyards',
            'achievements',
            'highscores',
            'prestige_events',
            'transactions',
            'companies',
            'users',
            'customers',
            'game_state'
        ])
    LOOP
        BEGIN
            EXECUTE format('DELETE FROM %I', table_name);
            result := result || table_name || ': cleared; ';
        EXCEPTION WHEN OTHERS THEN
            result := result || table_name || ': error - ' || SQLERRM || '; ';
        END;
    END LOOP;

    RETURN result;
END;
$function$;
