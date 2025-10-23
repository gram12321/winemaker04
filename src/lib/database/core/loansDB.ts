import { supabase } from './supabase';
import { Loan, PendingLoanWarning } from '../../types/types';
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
    if (updates.effectiveInterestRate !== undefined) updateData.effective_interest_rate = updates.effectiveInterestRate;
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

/**
 * Set a loan warning for a specific loan
 */
export async function setLoanWarning(loanId: string, warning: PendingLoanWarning): Promise<void> {
  try {
    const { error } = await supabase
      .from('loans')
      .update({
        pending_warning_id: loanId, // Use loan ID as warning ID for simplicity
        warning_severity: warning.severity,
        warning_title: warning.title,
        warning_message: warning.message,
        warning_details: warning.details,
        warning_penalties: warning.penalties,
        warning_acknowledged: false,
        warning_created_at: new Date().toISOString()
      })
      .eq('id', loanId)
      .eq('company_id', getCurrentCompanyId());

    if (error) {
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Load all loans with unacknowledged warnings
 */
export async function loadLoansWithUnacknowledgedWarnings(): Promise<Loan[]> {
  try {
    // Get all active loans and filter in JavaScript to avoid complex Supabase queries
    const { data, error } = await getCompanyQuery('loans')
      .eq('status', 'active')
      .select('*');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter for loans with unacknowledged warnings
    const loansWithWarnings = data.filter(loan => 
      loan.warning_title && 
      !loan.warning_acknowledged
    );

    // Sort by warning_created_at
    const sortedLoans = loansWithWarnings.sort((a, b) => {
      const dateA = new Date(a.warning_created_at || 0);
      const dateB = new Date(b.warning_created_at || 0);
      return dateA.getTime() - dateB.getTime();
    });

    return sortedLoans.map(row => ({
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
    return [];
  }
}

/**
 * Get the first unacknowledged loan warning
 */
export async function getFirstUnacknowledgedLoanWarning(): Promise<PendingLoanWarning | null> {
  try {
    // Get all active loans and filter in JavaScript to avoid complex Supabase queries
    const { data, error } = await getCompanyQuery('loans')
      .eq('status', 'active')
      .select('*');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Filter for loans with unacknowledged warnings
    const loansWithWarnings = data.filter(loan => 
      loan.warning_title && 
      !loan.warning_acknowledged
    );

    if (loansWithWarnings.length === 0) {
      return null;
    }

    // Sort by warning_created_at and get the first one
    const sortedLoans = loansWithWarnings.sort((a, b) => {
      const dateA = new Date(a.warning_created_at || 0);
      const dateB = new Date(b.warning_created_at || 0);
      return dateA.getTime() - dateB.getTime();
    });

    const loan = sortedLoans[0];
    return {
      loanId: loan.id,
      lenderName: loan.lender_name,
      missedPayments: loan.missed_payments,
      severity: loan.warning_severity,
      title: loan.warning_title,
      message: loan.warning_message,
      details: loan.warning_details || '',
      penalties: loan.warning_penalties || {}
    };
  } catch (error) {
    return null;
  }
}

/**
 * Acknowledge a loan warning
 */
export async function acknowledgeLoanWarning(loanId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('loans')
      .update({
        warning_acknowledged: true,
        warning_acknowledged_at: new Date().toISOString()
      })
      .eq('id', loanId)
      .eq('company_id', getCurrentCompanyId());

    if (error) {
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Clear all loan warnings for a specific loan
 */
export async function clearLoanWarning(loanId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('loans')
      .update({
        pending_warning_id: null,
        warning_severity: null,
        warning_title: null,
        warning_message: null,
        warning_details: null,
        warning_penalties: null,
        warning_acknowledged: false,
        warning_created_at: null,
        warning_acknowledged_at: null
      })
      .eq('id', loanId)
      .eq('company_id', getCurrentCompanyId());

    if (error) {
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Get loan warning statistics for the current company
 */
export async function getLoanWarningStats(): Promise<{
  total: number;
  unacknowledged: number;
  bySeverity: Record<string, number>;
}> {
  try {
    const { data, error } = await getCompanyQuery('loans')
      .select('warning_severity, warning_acknowledged');

    if (error) {
      throw error;
    }

    // Filter out loans without warnings
    const loansWithWarnings = data.filter((l: any) => l.warning_severity);

    const stats = {
      total: loansWithWarnings.length,
      unacknowledged: loansWithWarnings.filter((l: any) => !l.warning_acknowledged).length,
      bySeverity: loansWithWarnings.reduce((acc: Record<string, number>, l: any) => {
        if (l.warning_severity) {
          acc[l.warning_severity] = (acc[l.warning_severity] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    };

    return stats;
  } catch (error) {
    return { total: 0, unacknowledged: 0, bySeverity: {} };
  }
}
