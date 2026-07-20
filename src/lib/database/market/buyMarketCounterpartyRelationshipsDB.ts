import { supabase } from '../core/supabase';
import type { BuyMarketSellerKind } from '@/lib/types/market';

const TABLE = 'buy_market_counterparty_relationships';

export const getBuyMarketCounterpartyRelationshipRows = (buyerCompanyId: string, counterparties: Array<{ kind: BuyMarketSellerKind; id: string }>) =>
  supabase.from(TABLE).select('*').eq('buyer_company_id', buyerCompanyId).in('counterparty_key', counterparties.map(({ kind, id }) => `${kind}:${id}`));

export const getBuyMarketCounterpartyPriorityRows = (buyerCompanyId: string, counterpartyKind: BuyMarketSellerKind, limit: number) =>
  supabase.from(TABLE).select('counterparty_id, counterparty_name, loyalty_score').eq('buyer_company_id', buyerCompanyId).eq('counterparty_kind', counterpartyKind).gt('loyalty_score', 0).order('loyalty_score', { ascending: false }).limit(limit);

export async function recordBuyMarketCounterpartyPurchase(input: { buyerCompanyId: string; counterpartyKind: BuyMarketSellerKind; counterpartyId: string; counterpartyName: string; unitsPurchased: number; points: number; currentYear: number; yearlyCap: number; }) {
  const { data, error } = await supabase.rpc('record_buy_market_counterparty_purchase', {
    p_buyer_company_id: input.buyerCompanyId, p_counterparty_kind: input.counterpartyKind, p_counterparty_id: input.counterpartyId, p_counterparty_name: input.counterpartyName,
    p_units_purchased: input.unitsPurchased, p_points: input.points, p_current_year: input.currentYear, p_yearly_cap: input.yearlyCap,
  });
  return { data, error };
}
