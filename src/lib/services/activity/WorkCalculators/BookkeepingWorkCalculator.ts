import { Transaction, Season, WorkCategory } from '@/lib/types/types';
import { calculateTotalWork, WorkFactor } from '@/lib/services/activity/WorkCalculators/workCalculator';
import { TASK_RATES, INITIAL_WORK } from '@/lib/constants/activityConstants';
import { getGameState, getCurrentPrestige } from '@/lib/services/core/gameState';
import { getTransactions } from '@/lib/services/user/financeService';
import { loadActivitiesFromDb } from '@/lib/database/activity/activityService';
import { notificationService } from '@/components/layout/NotificationCenter';

/**
 * Bookkeeping Work Calculator
 * Calculates work required for bookkeeping based on transaction count from previous season
 */

// Helper function to get previous season and year
function getPreviousSeasonAndYear(currentSeason: Season, currentYear: number): { season: Season, year: number } {
  const seasons: Season[] = ['Winter', 'Spring', 'Summer', 'Fall'];
  const currentIndex = seasons.indexOf(currentSeason);
  const prevIndex = (currentIndex - 1 + 4) % 4;
  const prevSeason = seasons[prevIndex];
  
  // If going from Spring to Winter, we go back a year
  const prevYear = prevIndex === 3 ? currentYear - 1 : currentYear;
  
  return { season: prevSeason, year: prevYear };
}

// Helper function to filter transactions by season and year
async function getTransactionsFromSeason(season: Season, year: number): Promise<Transaction[]> {
  const transactions = await getTransactions();
  return transactions.filter((transaction: Transaction) => {
    const transactionDate = transaction.date;
    return transactionDate.season === season && transactionDate.year === year;
  });
}

/**
 * Calculate bookkeeping work based on transaction count from previous season
 */
export async function calculateBookkeepingWork(): Promise<{ 
  totalWork: number; 
  factors: WorkFactor[];
  prevSeason: Season;
  prevYear: number;
  transactionCount: number;
}> {
  const gameState = getGameState();
  const currentSeason = gameState.season!;
  const currentYear = gameState.currentYear!;
  
  // Get previous season and year
  const { season: prevSeason, year: prevYear } = getPreviousSeasonAndYear(currentSeason, currentYear);
  
  // Get transactions from previous season
  const prevSeasonTransactions = await getTransactionsFromSeason(prevSeason, prevYear);
  const transactionCount = prevSeasonTransactions.length;
  
  const category = WorkCategory.ADMINISTRATION;
  const rate = TASK_RATES[category];
  const initialWork = INITIAL_WORK[category];
  
  // Use generic calculator again
  const totalWork = calculateTotalWork(transactionCount, {
    rate,
    initialWork,
    workModifiers: []
  });
  
  const factors: WorkFactor[] = [
    { label: 'Previous Season', value: `${prevSeason} ${prevYear}`, isPrimary: true },
    { label: 'Transactions to Process', value: transactionCount, unit: 'transactions', isPrimary: true },
    { label: 'Processing Rate', value: rate, unit: 'tasks/week' },
    { label: 'Initial Setup Work', value: initialWork, unit: 'work units' }
  ];
  
  return { 
    totalWork, 
    factors, 
    prevSeason, 
    prevYear, 
    transactionCount 
  };
}

/**
 * Calculate spillover work and prestige penalties from incomplete bookkeeping tasks
 */
export async function calculateBookkeepingSpillover(): Promise<{
  spilloverWork: number;
  prestigePenalty: number;
  incompleteTaskCount: number;
  factors: WorkFactor[];
}> {
  // Load activities directly from database to avoid circular dependencies
  const activities = await loadActivitiesFromDb();
  const incompleteBookkeeping = activities.filter(activity => 
    activity.category === WorkCategory.ADMINISTRATION && 
    activity.title.includes('Bookkeeping') &&
    activity.status === 'active'
  );
  
  let spilloverWork = 0;
  let prestigePenalty = 0;
  const factors: WorkFactor[] = [];
  
  if (incompleteBookkeeping.length > 0) {
    // Calculate spillover work with 10% penalty
    spilloverWork = incompleteBookkeeping.reduce((total, task) => {
      const remainingWork = task.totalWork - task.completedWork;
      return total + (remainingWork * 1.1);
    }, 0);
    
    // Calculate prestige penalty (10% of current prestige per incomplete task)
    const currentPrestige = await getCurrentPrestige();
    prestigePenalty = currentPrestige * 0.1 * incompleteBookkeeping.length;
    
    factors.push(
      { label: 'Incomplete Tasks', value: incompleteBookkeeping.length, unit: 'tasks', isPrimary: true },
      { label: 'Spillover Work', value: spilloverWork, unit: 'work units', modifier: 0.1, modifierLabel: 'penalty for incomplete work' },
      { label: 'Prestige Penalty', value: prestigePenalty.toFixed(2), unit: 'prestige points' }
    );
  }
  
  return {
    spilloverWork,
    prestigePenalty,
    incompleteTaskCount: incompleteBookkeeping.length,
    factors
  };
}

/**
 * Calculate total bookkeeping work including spillover
 */
export async function calculateTotalBookkeepingWork(): Promise<{
  totalWork: number;
  factors: WorkFactor[];
  spilloverData: {
    spilloverWork: number;
    prestigePenalty: number;
    incompleteTaskCount: number;
  };
  seasonData: {
    prevSeason: Season;
    prevYear: number;
    transactionCount: number;
  };
}> {
  const [baseCalculation, spilloverCalculation] = await Promise.all([
    calculateBookkeepingWork(),
    calculateBookkeepingSpillover()
  ]);
  
  const totalWork = baseCalculation.totalWork + spilloverCalculation.spilloverWork;
  
  // Combine factors
  const factors: WorkFactor[] = [
    ...baseCalculation.factors,
    ...(spilloverCalculation.factors.length > 0 ? [
      { label: '--- Spillover Penalties ---', value: '', isPrimary: false },
      ...spilloverCalculation.factors
    ] : [])
  ];
  
  return {
    totalWork,
    factors,
    spilloverData: {
      spilloverWork: spilloverCalculation.spilloverWork,
      prestigePenalty: spilloverCalculation.prestigePenalty,
      incompleteTaskCount: spilloverCalculation.incompleteTaskCount
    },
    seasonData: {
      prevSeason: baseCalculation.prevSeason,
      prevYear: baseCalculation.prevYear,
      transactionCount: baseCalculation.transactionCount
    }
  };
}

/**
 * Handle bookkeeping completion
 */
export async function completeBookkeeping(activity: any): Promise<void> {
  const { prevSeason, prevYear, transactionCount } = activity.params;
  
  notificationService.success(
    `Bookkeeping for ${prevSeason} ${prevYear} completed successfully! ` +
    `Processed ${transactionCount} transactions.`
  );
}
