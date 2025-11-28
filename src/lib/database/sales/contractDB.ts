// Database operations for wine contracts
import { supabase } from '../core/supabase';
import { WineContract } from '../../types/types';
import { getCompanyQuery, getCurrentCompanyId } from '../../utils/companyUtils';
import { toOptionalDate } from '../dbMapperUtils';

// Helper function to map database row to WineContract
function mapRowToContract(row: any): WineContract {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerCountry: row.customer_country,
    customerType: row.customer_type,
    requirements: row.requirements,
    requestedQuantity: row.requested_quantity,
    offeredPrice: row.offered_price,
    totalValue: row.total_value,
    status: row.status,
    createdWeek: row.created_week,
    createdSeason: row.created_season,
    createdYear: row.created_year,
    expiresWeek: row.expires_week,
    expiresSeason: row.expires_season,
    expiresYear: row.expires_year,
    terms: row.terms,
    fulfilledWeek: row.fulfilled_week || undefined,
    fulfilledSeason: row.fulfilled_season || undefined,
    fulfilledYear: row.fulfilled_year || undefined,
    rejectedWeek: row.rejected_week || undefined,
    rejectedSeason: row.rejected_season || undefined,
    rejectedYear: row.rejected_year || undefined,
    fulfilledWineBatchIds: row.fulfilled_wine_batch_ids || undefined,
    relationshipAtCreation: row.relationship_at_creation,
    createdAt: toOptionalDate(row.created_at),
    updatedAt: toOptionalDate(row.updated_at)
  };
}

// ===== CONTRACT CRUD OPERATIONS =====

/**
 * Save a new wine contract to the database
 */
export async function saveWineContract(contract: WineContract): Promise<void> {
  const { error } = await supabase
    .from('wine_contracts')
    .insert({
      id: contract.id,
      company_id: getCurrentCompanyId(),
      customer_id: contract.customerId,
      customer_name: contract.customerName,
      customer_country: contract.customerCountry,
      customer_type: contract.customerType,
      requirements: contract.requirements,
      requested_quantity: contract.requestedQuantity,
      offered_price: contract.offeredPrice,
      total_value: contract.totalValue,
      status: contract.status,
      created_week: contract.createdWeek,
      created_season: contract.createdSeason,
      created_year: contract.createdYear,
      expires_week: contract.expiresWeek,
      expires_season: contract.expiresSeason,
      expires_year: contract.expiresYear,
      terms: contract.terms,
      fulfilled_week: contract.fulfilledWeek || null,
      fulfilled_season: contract.fulfilledSeason || null,
      fulfilled_year: contract.fulfilledYear || null,
      rejected_week: contract.rejectedWeek || null,
      rejected_season: contract.rejectedSeason || null,
      rejected_year: contract.rejectedYear || null,
      fulfilled_wine_batch_ids: contract.fulfilledWineBatchIds || null,
      relationship_at_creation: contract.relationshipAtCreation
    });

  if (error) {
    console.error('Error saving wine contract:', error);
    throw error;
  }
}

/**
 * Load all wine contracts from the database
 */
export async function loadWineContracts(): Promise<WineContract[]> {
  const { data, error } = await getCompanyQuery('wine_contracts')
    .order('created_year', { ascending: false })
    .order('created_season', { ascending: false })
    .order('created_week', { ascending: false });

  if (error) {
    console.error('Error loading wine contracts:', error);
    throw error;
  }

  if (!data) return [];

  return data.map(mapRowToContract);
}

/**
 * Get pending wine contracts (not yet fulfilled, rejected, or expired)
 */
export async function getPendingContracts(): Promise<WineContract[]> {
  const { data, error} = await getCompanyQuery('wine_contracts')
    .eq('status', 'pending')
    .order('created_year', { ascending: false })
    .order('created_season', { ascending: false })
    .order('created_week', { ascending: false });

  if (error) {
    console.error('Error loading pending contracts:', error);
    throw error;
  }

  if (!data) return [];

  return data.map(mapRowToContract);
}

/**
 * Get a single contract by ID
 */
export async function getContractById(contractId: string): Promise<WineContract | null> {
  const { data, error } = await getCompanyQuery('wine_contracts')
    .eq('id', contractId)
    .single();

  if (error) {
    console.error('Error loading contract:', error);
    return null;
  }

  if (!data) return null;

  return mapRowToContract(data);
}

/**
 * Update contract status
 */
export async function updateContractStatus(
  contractId: string,
  status: 'fulfilled' | 'rejected' | 'expired',
  additionalData?: {
    fulfilledWeek?: number;
    fulfilledSeason?: 'Spring' | 'Summer' | 'Fall' | 'Winter';
    fulfilledYear?: number;
    rejectedWeek?: number;
    rejectedSeason?: 'Spring' | 'Summer' | 'Fall' | 'Winter';
    rejectedYear?: number;
    fulfilledWineBatchIds?: string[];
  }
): Promise<void> {
  const updateData: any = { status };

  if (additionalData?.fulfilledWeek !== undefined) {
    updateData.fulfilled_week = additionalData.fulfilledWeek;
    updateData.fulfilled_season = additionalData.fulfilledSeason;
    updateData.fulfilled_year = additionalData.fulfilledYear;
  }
  if (additionalData?.rejectedWeek !== undefined) {
    updateData.rejected_week = additionalData.rejectedWeek;
    updateData.rejected_season = additionalData.rejectedSeason;
    updateData.rejected_year = additionalData.rejectedYear;
  }
  if (additionalData?.fulfilledWineBatchIds) {
    updateData.fulfilled_wine_batch_ids = additionalData.fulfilledWineBatchIds;
  }

  const { error } = await supabase
    .from('wine_contracts')
    .update(updateData)
    .eq('id', contractId)
    .eq('company_id', getCurrentCompanyId());

  if (error) {
    console.error('Error updating contract status:', error);
    throw error;
  }
}

/**
 * Update multi-year contract progress
 */
export async function updateContractProgress(contractId: string, terms: any): Promise<void> {
  const { error } = await supabase
    .from('wine_contracts')
    .update({ terms })
    .eq('id', contractId)
    .eq('company_id', getCurrentCompanyId());

  if (error) {
    console.error('Error updating contract progress:', error);
    throw error;
  }
}

/**
 * Get completed contracts (fulfilled or rejected)
 */
export async function getCompletedContracts(): Promise<WineContract[]> {
  const { data, error } = await getCompanyQuery('wine_contracts')
    .in('status', ['fulfilled', 'rejected', 'expired'])
    .order('created_year', { ascending: false })
    .order('created_season', { ascending: false })
    .order('created_week', { ascending: false });

  if (error) {
    console.error('Error loading completed contracts:', error);
    throw error;
  }

  if (!data) return [];

  return data.map(mapRowToContract);
}

/**
 * Get contracts for a specific customer
 */
export async function getContractsByCustomerId(customerId: string): Promise<WineContract[]> {
  const { data, error } = await getCompanyQuery('wine_contracts')
    .eq('customer_id', customerId)
    .order('created_year', { ascending: false })
    .order('created_season', { ascending: false })
    .order('created_week', { ascending: false });

  if (error) {
    console.error('Error loading customer contracts:', error);
    throw error;
  }

  if (!data) return [];

  return data.map(mapRowToContract);
}
