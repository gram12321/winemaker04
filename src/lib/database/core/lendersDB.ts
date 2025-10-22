import { supabase } from './supabase';
import { Lender } from '../../types/types';
import { getCurrentCompanyId, getCompanyQuery } from '../../utils/companyUtils';

export async function saveLenders(lenders: Lender[], companyId?: string): Promise<void> {
  try {
    const currentCompanyId = companyId || getCurrentCompanyId();
    
    // Clear existing lenders for this company
    const { error: deleteError } = await supabase
      .from('lenders')
      .delete()
      .eq('company_id', currentCompanyId);

    if (deleteError) {
      console.error('Error clearing existing lenders:', deleteError);
      throw deleteError;
    }

    // Insert new lenders
    const lendersForDB = lenders.map(lender => ({
      id: lender.id,
      company_id: currentCompanyId,
      name: lender.name,
      type: lender.type,
      risk_tolerance: lender.riskTolerance,
      flexibility: lender.flexibility,
      market_presence: lender.marketPresence,
      base_interest_rate: lender.baseInterestRate,
      min_loan_amount: lender.minLoanAmount,
      max_loan_amount: lender.maxLoanAmount,
      min_duration_seasons: lender.minDurationSeasons,
      max_duration_seasons: lender.maxDurationSeasons,
      origination_fee: lender.originationFee,
      blacklisted: lender.blacklisted || false
    }));

    const { error: insertError } = await supabase
      .from('lenders')
      .insert(lendersForDB);

    if (insertError) {
      console.error('Error saving lenders:', insertError);
      throw insertError;
    }
  } catch (error) {
    console.error('Failed to save lenders:', error);
    throw error;
  }
}

export async function loadLenders(companyId?: string): Promise<Lender[]> {
  try {
    const query = companyId 
      ? supabase.from('lenders').select('*').eq('company_id', companyId)
      : getCompanyQuery('lenders');
    
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('Error loading lenders:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      riskTolerance: row.risk_tolerance,
      flexibility: row.flexibility,
      marketPresence: row.market_presence,
      baseInterestRate: row.base_interest_rate,
      minLoanAmount: row.min_loan_amount,
      maxLoanAmount: row.max_loan_amount,
      minDurationSeasons: row.min_duration_seasons,
      maxDurationSeasons: row.max_duration_seasons,
      originationFee: row.origination_fee,
      blacklisted: row.blacklisted
    }));
  } catch (error) {
    console.error('Failed to load lenders:', error);
    return [];
  }
}

export async function updateLenderBlacklist(lenderId: string, blacklisted: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('lenders')
      .update({ blacklisted })
      .eq('id', lenderId)
      .eq('company_id', getCurrentCompanyId());

    if (error) {
      console.error('Error updating lender blacklist:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to update lender blacklist:', error);
    throw error;
  }
}

export async function checkLendersExist(companyId?: string): Promise<boolean> {
  try {
    const query = companyId 
      ? supabase.from('lenders').select('id').eq('company_id', companyId).limit(1)
      : getCompanyQuery('lenders').select('id').limit(1);
    
    const { data, error } = await query;

    if (error) {
      console.error('Error checking lenders existence:', error);
      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch (error) {
    console.error('Failed to check lenders existence:', error);
    return false;
  }
}
