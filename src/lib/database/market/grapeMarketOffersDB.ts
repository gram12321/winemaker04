import { supabase } from '../core/supabase';
import type { Season } from '@/lib/types/types';

export interface PurchaseGrapeMarketOfferInput {
  companyId: string;
  purchaseId: string;
  offerId: string;
  quantity: number;
  vesselIds: string[];
  requiredLitres: number;
  batch: Record<string, unknown>;
  week: number;
  season: Season;
  year: number;
  description: string;
  category: string;
}

export async function purchaseGrapeMarketOfferAtomically(input: PurchaseGrapeMarketOfferInput) {
  const { data, error } = await supabase.rpc('purchase_grape_market_offer', {
    p_company_id: input.companyId,
    p_purchase_id: input.purchaseId,
    p_offer_id: input.offerId,
    p_quantity: input.quantity,
    p_vessel_ids: input.vesselIds,
    p_required_litres: input.requiredLitres,
    p_batch: input.batch,
    p_week: input.week,
    p_season: input.season,
    p_year: input.year,
    p_description: input.description,
    p_category: input.category,
  });
  return { data, error };
}
