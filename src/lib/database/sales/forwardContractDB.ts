import { supabase } from '../core/supabase';
import { GrapeForwardContract } from '../../types/types';
import { getCompanyQuery, getCurrentCompanyId } from '../../utils/companyUtils';
import { toOptionalDate } from '../dbMapperUtils';

function mapRowToForwardContract(row: any): GrapeForwardContract {
  return {
    id: row.id,
    companyId: row.company_id,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    targetState: row.target_state,
    targetGrape: row.target_grape || undefined,
    quantityKg: row.quantity_kg,
    deliveredKg: row.delivered_kg,
    unitPricePerKg: row.unit_price_per_kg,
    totalValue: row.total_value,
    upfrontPercent: row.upfront_percent,
    upfrontPaidAmount: row.upfront_paid_amount,
    finalPaymentAmount: row.final_payment_amount,
    defaultPenaltyAmount: row.default_penalty_amount,
    status: row.status,
    createdWeek: row.created_week,
    createdSeason: row.created_season,
    createdYear: row.created_year,
    dueWeek: row.due_week,
    dueSeason: row.due_season,
    dueYear: row.due_year,
    acceptedWeek: row.accepted_week || undefined,
    acceptedSeason: row.accepted_season || undefined,
    acceptedYear: row.accepted_year || undefined,
    settledWeek: row.settled_week || undefined,
    settledSeason: row.settled_season || undefined,
    settledYear: row.settled_year || undefined,
    createdAt: toOptionalDate(row.created_at),
    updatedAt: toOptionalDate(row.updated_at),
  };
}

export async function saveForwardContract(contract: GrapeForwardContract): Promise<void> {
  const { error } = await supabase
    .from('grape_forward_contracts')
    .insert({
      id: contract.id,
      company_id: getCurrentCompanyId(),
      buyer_id: contract.buyerId,
      buyer_name: contract.buyerName,
      target_state: contract.targetState,
      target_grape: contract.targetGrape ?? null,
      quantity_kg: contract.quantityKg,
      delivered_kg: contract.deliveredKg,
      unit_price_per_kg: contract.unitPricePerKg,
      total_value: contract.totalValue,
      upfront_percent: contract.upfrontPercent,
      upfront_paid_amount: contract.upfrontPaidAmount,
      final_payment_amount: contract.finalPaymentAmount,
      default_penalty_amount: contract.defaultPenaltyAmount,
      status: contract.status,
      created_week: contract.createdWeek,
      created_season: contract.createdSeason,
      created_year: contract.createdYear,
      due_week: contract.dueWeek,
      due_season: contract.dueSeason,
      due_year: contract.dueYear,
      accepted_week: contract.acceptedWeek ?? null,
      accepted_season: contract.acceptedSeason ?? null,
      accepted_year: contract.acceptedYear ?? null,
      settled_week: contract.settledWeek ?? null,
      settled_season: contract.settledSeason ?? null,
      settled_year: contract.settledYear ?? null,
    });

  if (error) {
    console.error('Error saving forward contract:', error);
    throw error;
  }
}

export async function loadForwardContracts(): Promise<GrapeForwardContract[]> {
  const { data, error } = await getCompanyQuery('grape_forward_contracts')
    .order('created_year', { ascending: false })
    .order('created_season', { ascending: false })
    .order('created_week', { ascending: false });

  if (error) {
    console.error('Error loading forward contracts:', error);
    throw error;
  }

  return (data || []).map(mapRowToForwardContract);
}

export async function getForwardContractById(contractId: string): Promise<GrapeForwardContract | null> {
  const { data, error } = await getCompanyQuery('grape_forward_contracts').eq('id', contractId).maybeSingle();

  if (error) {
    console.error('Error loading forward contract:', error);
    return null;
  }

  return data ? mapRowToForwardContract(data) : null;
}

export async function getOpenForwardContracts(): Promise<GrapeForwardContract[]> {
  const { data, error } = await getCompanyQuery('grape_forward_contracts')
    .in('status', ['offered', 'accepted'])
    .order('created_year', { ascending: false })
    .order('created_season', { ascending: false })
    .order('created_week', { ascending: false });

  if (error) {
    console.error('Error loading open forward contracts:', error);
    throw error;
  }

  return (data || []).map(mapRowToForwardContract);
}

export async function updateForwardContract(contractId: string, patch: Record<string, any>): Promise<void> {
  const { error } = await supabase
    .from('grape_forward_contracts')
    .update(patch)
    .eq('id', contractId)
    .eq('company_id', getCurrentCompanyId());

  if (error) {
    console.error('Error updating forward contract:', error);
    throw error;
  }
}
