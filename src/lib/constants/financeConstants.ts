/**
 * Finance UI Constants
 * Consolidates styling constants and default data used across finance components
 */

// Tab styling constants for finance components
export const FINANCE_TAB_STYLES = {
  trigger: "px-4 py-2 rounded-md border border-gray-400 text-sm font-medium",
  active: "bg-blue-600 text-white border-blue-600",
  inactive: "bg-blue-50 text-blue-600 hover:bg-blue-100"
} as const;

// Button styling constants for finance components
export const FINANCE_BUTTON_STYLES = {
  period: "px-4 py-1 rounded-md border border-gray-400 text-sm font-medium",
  periodActive: "bg-blue-600 text-white border-blue-600",
  periodInactive: "bg-blue-50 text-blue-600 hover:bg-blue-100"
} as const;

// Transaction categories
export const TRANSACTION_CATEGORIES = {
  // Income categories
  WINE_SALES: 'Wine Sales',
  GRAPE_SALES: 'Grape Sales',
  INITIAL_INVESTMENT: 'Initial Investment',
  DIVIDEND_PAYMENT: 'Dividend Payment',
  DIVIDEND_RECEIVED: 'Dividend Received',
  VINEYARD_SALE: 'Vineyard Sale', // Forced vineyard seizure/sale

  // Expense categories
  STAFF_WAGES: 'Staff Wages',
  STAFF_SEARCH: 'Staff Search',
  LAND_SEARCH: 'Land Search',
  LENDER_SEARCH: 'Lender Search',
  VINEYARD_PURCHASE: 'Vineyard Purchase',
  EQUIPMENT_PURCHASE: 'Equipment Purchase',
  BUILDING_CONSTRUCTION: 'Building Construction',
  VINEYARD_PLANTING: 'Vineyard Planting',
  MAINTENANCE: 'Maintenance',
  SUPPLIES: 'Supplies',
  UTILITIES: 'Utilities',
  RESEARCH: 'Research',
  OTHER: 'Other',

  // Loan categories
  LOAN_RECEIVED: 'Loan Received',
  LOAN_PAYMENT: 'Loan Payment',
  LOAN_ORIGINATION_FEE: 'Loan Origination Fee',
  LOAN_EXTRA_PAYMENT_FEE: 'Loan Extra Payment Fee',
  LOAN_PREPAYMENT_FEE: 'Loan Prepayment Fee'
} as const;

// Categories that should be capitalized (affect assets/cash but not P&L)
export const CAPITALIZED_TRANSACTION_CATEGORIES = new Set<string>([
  TRANSACTION_CATEGORIES.VINEYARD_PURCHASE,
  TRANSACTION_CATEGORIES.EQUIPMENT_PURCHASE,
  TRANSACTION_CATEGORIES.BUILDING_CONSTRUCTION,
  TRANSACTION_CATEGORIES.VINEYARD_PLANTING
]);

// Transaction categories that should appear as capital/financing flows in cash flow statements
export const CAPITAL_FLOW_TRANSACTION_CATEGORIES = new Set<string>([
  TRANSACTION_CATEGORIES.INITIAL_INVESTMENT,
  TRANSACTION_CATEGORIES.LOAN_RECEIVED,
  TRANSACTION_CATEGORIES.LOAN_PAYMENT,
  TRANSACTION_CATEGORIES.LOAN_ORIGINATION_FEE,
  TRANSACTION_CATEGORIES.DIVIDEND_PAYMENT,
  ...CAPITALIZED_TRANSACTION_CATEGORIES
]);

// Default financial data structure for components
export const DEFAULT_FINANCIAL_DATA = {
  income: 0,
  expenses: 0,
  netIncome: 0,
  incomeDetails: [] as { description: string; amount: number }[],
  expenseDetails: [] as { description: string; amount: number }[],
  cashMoney: 0,
  totalAssets: 0,
  fixedAssets: 0,
  currentAssets: 0,
  buildingsValue: 0,
  allVineyardsValue: 0,
  wineValue: 0,
  grapesValue: 0,
  playerContribution: 0,
  familyContribution: 0,
  outsideInvestment: 0,
  retainedEarnings: 0,
  totalEquity: 0
} as const;

// Financial section titles by period
export const FINANCE_PERIOD_LABELS = {
  weekly: {
    income: 'WEEKLY INCOME',
    expenses: 'WEEKLY EXPENSES'
  },
  season: {
    income: 'SEASON INCOME',
    expenses: 'SEASON EXPENSES'
  },
  year: {
    income: 'YEARLY INCOME',
    expenses: 'YEARLY EXPENSES'
  },
  all: {
    income: 'ALL-TIME INCOME',
    expenses: 'ALL-TIME EXPENSES'
  }
} as const;

// Share calculation constants
export const SHARE_CALCULATION = {
  TARGET_SHARE_PRICE: 50, // Target share price in euros (€50)
  MIN_SHARES: 10000, // Minimum shares for liquidity
} as const;

/**
 * Calculate initial share count based on total company capital
 * Uses target share price of €50 to determine appropriate share count
 * 
 * @param totalCapital Total company capital (player + family + outside investment)
 * @returns Calculated share count (minimum 10,000 for liquidity)
 */
export function calculateInitialShareCount(totalCapital: number): number {
  const calculatedShares = Math.round(totalCapital / SHARE_CALCULATION.TARGET_SHARE_PRICE);
  return Math.max(calculatedShares, SHARE_CALCULATION.MIN_SHARES);
}
