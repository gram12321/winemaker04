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
  
  // Expense categories
  STAFF_WAGES: 'Staff Wages',
  STAFF_SEARCH: 'Staff Search',
  LAND_SEARCH: 'Land Search',
  VINEYARD_PURCHASE: 'Vineyard Purchase',
  EQUIPMENT_PURCHASE: 'Equipment Purchase',
  BUILDING_CONSTRUCTION: 'Building Construction',
  VINEYARD_PLANTING: 'Vineyard Planting',
  MAINTENANCE: 'Maintenance',
  SUPPLIES: 'Supplies',
  UTILITIES: 'Utilities',
  OTHER: 'Other'
} as const;

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
  grapesValue: 0
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
  }
} as const;
