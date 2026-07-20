CREATE OR REPLACE FUNCTION admin_clear_global_market(p_ware_group text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_ware_group IS NULL OR p_ware_group IN ('grapes', 'storage_vessels') THEN
    DELETE FROM market_buy_offers
    WHERE p_ware_group IS NULL OR ware_group = p_ware_group;
  ELSE
    RAISE EXCEPTION 'Unsupported market goods group: %', p_ware_group;
  END IF;

  IF p_ware_group IS NULL OR p_ware_group = 'storage_vessels' THEN
    DELETE FROM storage_vessel_market_listings WHERE true;
    DELETE FROM storage_vessels WHERE owner_kind = 'npc_market';
  END IF;
END;
$$;
