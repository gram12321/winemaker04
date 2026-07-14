import { supabase } from '../core/supabase';
import type { Season } from '@/lib/types/types';

export interface PurchaseStorageVesselOfferInput {
  companyId: string;
  purchaseId: string;
  offerId: string;
  quantity: number;
  week: number;
  season: Season;
  year: number;
  description: string;
  category: string;
}

export async function purchaseStorageVesselOfferAtomically(input: PurchaseStorageVesselOfferInput) {
  const { data, error } = await supabase.rpc('purchase_storage_vessel_offer', {
    p_company_id: input.companyId,
    p_purchase_id: input.purchaseId,
    p_offer_id: input.offerId,
    p_quantity: input.quantity,
    p_week: input.week,
    p_season: input.season,
    p_year: input.year,
    p_description: input.description,
    p_category: input.category,
  });
  return { data, error };
}
