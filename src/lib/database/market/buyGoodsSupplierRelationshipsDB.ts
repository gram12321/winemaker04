import { supabase } from '../core/supabase';
import type { BuyMarketWareGroup } from '@/lib/types/market';
const TABLE = 'buy_goods_supplier_relationships';
export const getBuyGoodsSupplierRelationshipRow = (companyId: string, goodsDomain: BuyMarketWareGroup, supplierId: string) => supabase.from(TABLE).select('*').eq('company_id', companyId).eq('goods_domain', goodsDomain).eq('supplier_id', supplierId).maybeSingle();
export const getBuyGoodsSupplierRelationshipRows = (companyId: string, goodsDomain: BuyMarketWareGroup, supplierIds: string[]) => supabase.from(TABLE).select('*').eq('company_id', companyId).eq('goods_domain', goodsDomain).in('supplier_id', supplierIds);
export const getBuyGoodsSupplierPriorityRows = (companyId: string, goodsDomain: BuyMarketWareGroup, limit: number) => supabase.from(TABLE).select('supplier_id, supplier_name, loyalty_score').eq('company_id', companyId).eq('goods_domain', goodsDomain).gt('loyalty_score', 0).order('loyalty_score', { ascending: false }).limit(limit);
export const upsertBuyGoodsSupplierRelationshipRow = (row: Record<string, unknown>) => supabase.from(TABLE).upsert(row, { onConflict: 'company_id,goods_domain,supplier_id' }).select().single();
