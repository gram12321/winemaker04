-- Storage-vessel purchases use the application's standard offer-claim,
-- transaction, and vessel-insert flow. The cask-specific all-in-one RPC is
-- retired; record_company_transaction remains the shared transaction command.
DROP FUNCTION IF EXISTS purchase_storage_vessel_offer(UUID, UUID, TEXT, INTEGER, INTEGER, TEXT, INTEGER, TEXT, TEXT);
