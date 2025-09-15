import { formatCurrency, getColorClass } from '@/lib/utils/utils';
import { calculateFinancialData } from '@/lib/services/user/financeService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';
import { useGameStateWithData } from '@/hooks';

interface IncomeBalanceViewProps {
  period: 'weekly' | 'season' | 'year';
}

// Helper component for a single financial section
const FinancialSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border border-gray-300 rounded-md p-4 mb-4">
    <h3 className="font-semibold text-gray-800 mb-2 uppercase text-sm tracking-wider">{title}</h3>
    <div className="space-y-1">
      {children}
    </div>
  </div>
);

// Helper component for a key-value pair
const DataRow: React.FC<{ label: string; value: string | number; valueClass?: string }> = ({ label, value, valueClass = '' }) => (
  <div className="flex justify-between text-sm">
    <span>{label}</span>
    <span className={`font-medium ${valueClass}`}>{typeof value === 'number' ? formatCurrency(value) : value}</span>
  </div>
);

const defaultFinancialData = {
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
  farmlandValue: 0,
  wineValue: 0,
  grapesValue: 0
};

export function IncomeBalanceView({ period }: IncomeBalanceViewProps) {
  // Use consolidated hook for reactive financial data loading
  const financialData = useGameStateWithData(
    () => calculateFinancialData(period),
    defaultFinancialData
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Column 1: Income Statement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-800 text-center">Income Statement</CardTitle>
          <CardDescription className="text-center">Your revenue and expense breakdown</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FinancialSection title={`${period.toUpperCase()} INCOME`}>
            {financialData.incomeDetails.length > 0 ? (
              financialData.incomeDetails.map((item, index) => (
                <DataRow key={index} label={item.description} value={item.amount} valueClass="text-emerald-600" />
              ))
            ) : (
              <DataRow label={`Total ${period} Income`} value={financialData.income} valueClass="text-emerald-600" />
            )}
          </FinancialSection>

          <FinancialSection title={`${period.toUpperCase()} EXPENSES`}>
            {financialData.expenseDetails.length > 0 ? (
              financialData.expenseDetails.map((item, index) => (
                <DataRow key={index} label={item.description} value={item.amount} valueClass={getColorClass(0.2)} />
              ))
            ) : (
                <DataRow label={`Total ${period} Expenses`} value={financialData.expenses} valueClass={getColorClass(0.2)} />
            )}
          </FinancialSection>

          <FinancialSection title="NET INCOME">
            <DataRow label={`${period.charAt(0).toUpperCase() + period.slice(1)} Income`} value={financialData.income} valueClass={getColorClass(0.8)} />
            <DataRow label={`${period.charAt(0).toUpperCase() + period.slice(1)} Expenses`} value={financialData.expenses} valueClass={getColorClass(0.2)} />
             <hr className="my-1 border-gray-300" />
             <DataRow label="Net Income" value={financialData.netIncome} valueClass={getColorClass(financialData.netIncome >= 0 ? 0.8 : 0.2)} />
          </FinancialSection>
        </CardContent>
      </Card>

      {/* Column 2: Balance Sheet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-800 text-center">Balance Sheet</CardTitle>
          <CardDescription className="text-center">Your assets and financial position</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FinancialSection title="TOTAL ASSETS">
            <DataRow label="Cash" value={financialData.cashMoney} />
            <DataRow label="Fixed Assets" value={financialData.fixedAssets} />
            <DataRow label="Current Assets" value={financialData.currentAssets} />
            <hr className="my-1 border-gray-300" />
            <DataRow label="Total Assets" value={financialData.totalAssets} />
          </FinancialSection>

          <FinancialSection title="CASH">
            <DataRow label="Available Cash" value={financialData.cashMoney} />
          </FinancialSection>
          
          <FinancialSection title="FIXED ASSETS">
            <DataRow label="Buildings" value={financialData.buildingsValue} />
            <DataRow label="Farmland" value={financialData.farmlandValue} />
             <hr className="my-1 border-gray-300" />
             <DataRow label="Total Fixed Assets" value={financialData.fixedAssets} />
          </FinancialSection>

          <FinancialSection title="CURRENT ASSETS (WINE)">
            <DataRow label="Wine Inventory" value={financialData.wineValue} />
            <DataRow label="Grape Inventory" value={financialData.grapesValue} />
             <hr className="my-1 border-gray-300" />
             <DataRow label="Total Current Assets" value={financialData.currentAssets} />
          </FinancialSection>
        </CardContent>
      </Card>
    </div>
  );
}
