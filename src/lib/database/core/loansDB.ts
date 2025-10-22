import { supabase } from './supabase';
import { Loan } from '../../types/types';
import { getCurrentCompanyId, getCompanyQuery } from '../../utils/companyUtils';

export async function insertLoan(loan: Loan): Promise<void> {
  try {
    const loanForDB = {
      id: loan.id,
      company_id: getCurrentCompanyId(),
      lender_id: loan.lenderId,
      lender_name: loan.lenderName,
      lender_type: loan.lenderType,
      principal_amount: loan.principalAmount,
      base_interest_rate: loan.baseInterestRate,
      economy_phase_at_creation: loan.economyPhaseAtCreation,
      effective_interest_rate: loan.effectiveInterestRate,
      origination_fee: loan.originationFee,
      remaining_balance: loan.remainingBalance,
      seasonal_payment: loan.seasonalPayment,
      seasons_remaining: loan.seasonsRemaining,
      total_seasons: loan.totalSeasons,
      start_week: loan.startDate.week,
      start_season: loan.startDate.season,
      start_year: loan.startDate.year,
      next_payment_week: loan.nextPaymentDue.week,
      next_payment_season: loan.nextPaymentDue.season,
      next_payment_year: loan.nextPaymentDue.year,
      missed_payments: loan.missedPayments,
      status: loan.status
    };

    const { error } = await supabase
      .from('loans')
      .insert(loanForDB);

    if (error) {
      console.error('Error inserting loan:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to insert loan:', error);
    throw error;
  }
}

export async function loadLoans(): Promise<Loan[]> {
  try {
    const { data, error } = await getCompanyQuery('loans')
      .order('start_year', { ascending: false })
      .order('start_season', { ascending: false });

    if (error) {
      console.error('Error loading loans:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(row => ({
      id: row.id,
      lenderId: row.lender_id,
      lenderName: row.lender_name,
      lenderType: row.lender_type,
      principalAmount: row.principal_amount,
      baseInterestRate: row.base_interest_rate,
      economyPhaseAtCreation: row.economy_phase_at_creation,
      effectiveInterestRate: row.effective_interest_rate,
      originationFee: row.origination_fee,
      remainingBalance: row.remaining_balance,
      seasonalPayment: row.seasonal_payment,
      seasonsRemaining: row.seasons_remaining,
      totalSeasons: row.total_seasons,
      startDate: {
        week: row.start_week,
        season: row.start_season,
        year: row.start_year
      },
      nextPaymentDue: {
        week: row.next_payment_week,
        season: row.next_payment_season,
        year: row.next_payment_year
      },
      missedPayments: row.missed_payments,
      status: row.status
    }));
  } catch (error) {
    console.error('Failed to load loans:', error);
    return [];
  }
}

export async function updateLoan(loanId: string, updates: Partial<Loan>): Promise<void> {
  try {
    const updateData: any = {};
    
    if (updates.remainingBalance !== undefined) updateData.remaining_balance = updates.remainingBalance;
    if (updates.seasonsRemaining !== undefined) updateData.seasons_remaining = updates.seasonsRemaining;
    if (updates.missedPayments !== undefined) updateData.missed_payments = updates.missedPayments;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.nextPaymentDue) {
      updateData.next_payment_week = updates.nextPaymentDue.week;
      updateData.next_payment_season = updates.nextPaymentDue.season;
      updateData.next_payment_year = updates.nextPaymentDue.year;
    }

    const { error } = await supabase
      .from('loans')
      .update(updateData)
      .eq('id', loanId)
      .eq('company_id', getCurrentCompanyId());

    if (error) {
      console.error('Error updating loan:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to update loan:', error);
    throw error;
  }
}

export async function loadActiveLoans(): Promise<Loan[]> {
  try {
    const { data, error } = await getCompanyQuery('loans')
      .eq('status', 'active')
      .order('next_payment_year', { ascending: true })
      .order('next_payment_season', { ascending: true });

    if (error) {
      console.error('Error loading active loans:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(row => ({
      id: row.id,
      lenderId: row.lender_id,
      lenderName: row.lender_name,
      lenderType: row.lender_type,
      principalAmount: row.principal_amount,
      baseInterestRate: row.base_interest_rate,
      economyPhaseAtCreation: row.economy_phase_at_creation,
      effectiveInterestRate: row.effective_interest_rate,
      originationFee: row.origination_fee,
      remainingBalance: row.remaining_balance,
      seasonalPayment: row.seasonal_payment,
      seasonsRemaining: row.seasons_remaining,
      totalSeasons: row.total_seasons,
      startDate: {
        week: row.start_week,
        season: row.start_season,
        year: row.start_year
      },
      nextPaymentDue: {
        week: row.next_payment_week,
        season: row.next_payment_season,
        year: row.next_payment_year
      },
      missedPayments: row.missed_payments,
      status: row.status
    }));
  } catch (error) {
    console.error('Failed to load active loans:', error);
    return [];
  }
}
