import { formatCurrency, getColorClass } from '@/lib/utils';
import { calculateFinancialData, calculateNetWorth } from '@/lib/services';
import { SimpleCard } from '../ui';
import { useGameStateWithData } from '@/hooks';
import { DEFAULT_FINANCIAL_DATA, FINANCE_PERIOD_LABELS } from '@/lib/constants';
import { loadActiveLoans } from '@/lib/database/core/loansDB';
import { useState, useEffect } from 'react';
import { Loan } from '@/lib/types/types';

interface IncomeBalanceViewProps {
  period: 'weekly' | 'season' | 'year';
}

const FinancialSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border border-gray-300 rounded-md p-4 mb-4">
    <h3 className="font-semibold text-gray-800 mb-2 uppercase text-sm tracking-wider">{title}</h3>
    <div className="space-y-1">
      {children}
    </div>
  </div>
);

const DataRow: React.FC<{ label: string; value: string | number; valueClass?: string }> = ({ label, value, valueClass = '' }) => (
  <div className="flex justify-between text-sm">
    <span>{label}</span>
    <span className={`font-medium ${valueClass}`}>{typeof value === 'number' ? formatCurrency(value) : value}</span>
  </div>
);


export function IncomeBalanceView({ period }: IncomeBalanceViewProps) {
  const financialData = useGameStateWithData(
    () => calculateFinancialData(period),
    DEFAULT_FINANCIAL_DATA
  );
  
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);

  // Calculate net worth using centralized function
  const netWorth = useGameStateWithData(
    () => calculateNetWorth(),
    0
  );

  useEffect(() => {
    const loadLoans = async () => {
      try {
        setLoadingLoans(true);
        const loans = await loadActiveLoans();
        setActiveLoans(loans);
      } catch (error) {
        console.error('Error loading loans:', error);
        setActiveLoans([]);
      } finally {
        setLoadingLoans(false);
      }
    };

    loadLoans();
  }, []);

  // Calculate loan totals
  const totalOutstandingLoans = activeLoans.reduce((sum, loan) => sum + loan.remainingBalance, 0);
  
  // Calculate period-appropriate payment amounts
  const getPeriodPaymentAmount = (seasonalPayment: number) => {
    switch (period) {
      case 'weekly':
        return seasonalPayment / 13; // 13 weeks per season
      case 'season':
        return seasonalPayment;
      case 'year':
        return seasonalPayment * 4; // 4 seasons per year
      default:
        return seasonalPayment;
    }
  };
  
  const totalPeriodPayments = activeLoans.reduce((sum, loan) => sum + getPeriodPaymentAmount(loan.seasonalPayment), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SimpleCard
        title="Income Statement"
        description="Your revenue and expense breakdown"
      >
          <FinancialSection title={FINANCE_PERIOD_LABELS[period].income}>
            {financialData.incomeDetails.length > 0 ? (
              financialData.incomeDetails.map((item, index) => (
                <DataRow key={index} label={item.description} value={item.amount} valueClass="text-emerald-600" />
              ))
            ) : (
              <DataRow label={`Total ${period} Income`} value={financialData.income} valueClass="text-emerald-600" />
            )}
          </FinancialSection>

          <FinancialSection title={FINANCE_PERIOD_LABELS[period].expenses}>
            {financialData.expenseDetails.length > 0 ? (
              financialData.expenseDetails.map((item, index) => (
                <DataRow key={index} label={item.description} value={item.amount} valueClass={getColorClass(0.2)} />
              ))
            ) : (
                <DataRow label={`Total ${period} Expenses`} value={financialData.expenses} valueClass={getColorClass(0.2)} />
            )}
            
            {/* Add loan payments if they exist */}
            {activeLoans.length > 0 && (
              <>
                {activeLoans.map((loan) => (
                  <DataRow 
                    key={`loan-payment-${loan.id}`} 
                    label={`Loan Payment: ${loan.lenderName}`} 
                    value={getPeriodPaymentAmount(loan.seasonalPayment)} 
                    valueClass="text-red-600" 
                  />
                ))}
                <DataRow 
                  label={`Total ${period.charAt(0).toUpperCase() + period.slice(1)} Loan Payments`} 
                  value={totalPeriodPayments} 
                  valueClass="text-red-600" 
                />
              </>
            )}
          </FinancialSection>

          <FinancialSection title="NET INCOME">
            <DataRow label={`${period.charAt(0).toUpperCase() + period.slice(1)} Income`} value={financialData.income} valueClass={getColorClass(0.8)} />
            <DataRow label={`${period.charAt(0).toUpperCase() + period.slice(1)} Expenses`} value={financialData.expenses} valueClass={getColorClass(0.2)} />
             <hr className="my-1 border-gray-300" />
             <DataRow label="Net Income" value={financialData.netIncome} valueClass={getColorClass(financialData.netIncome >= 0 ? 0.8 : 0.2)} />
          </FinancialSection>
      </SimpleCard>

      <SimpleCard
        title="Balance Sheet"
        description="Your assets and financial position"
      >
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
            <DataRow label="Vineyards" value={financialData.allVineyardsValue} />
             <hr className="my-1 border-gray-300" />
             <DataRow label="Total Fixed Assets" value={financialData.fixedAssets} />
          </FinancialSection>

          <FinancialSection title="CURRENT ASSETS (WINE)">
            <DataRow label="Wine Inventory" value={financialData.wineValue} />
            <DataRow label="Grape Inventory" value={financialData.grapesValue} />
             <hr className="my-1 border-gray-300" />
             <DataRow label="Total Current Assets" value={financialData.currentAssets} />
          </FinancialSection>

          <FinancialSection title="LIABILITIES (LOANS)">
            {loadingLoans ? (
              <div className="text-sm text-gray-500">Loading loan data...</div>
            ) : activeLoans.length > 0 ? (
              <>
                {activeLoans.map((loan) => (
                  <div key={loan.id} className="space-y-1 mb-2">
                    <DataRow 
                      label={`${loan.lenderName} (${loan.lenderType})`} 
                      value={loan.remainingBalance} 
                      valueClass="text-red-600" 
                    />
                    <div className="text-xs text-gray-500 ml-2">
                      Payment: {formatCurrency(getPeriodPaymentAmount(loan.seasonalPayment))}/{period}
                    </div>
                  </div>
                ))}
                <hr className="my-2 border-gray-300" />
                <DataRow label="Total Outstanding Loans" value={totalOutstandingLoans} valueClass="text-red-600" />
                <DataRow 
                  label={`Total ${period.charAt(0).toUpperCase() + period.slice(1)} Payments`} 
                  value={totalPeriodPayments} 
                  valueClass="text-orange-600" 
                />
              </>
            ) : (
              <DataRow label="No Active Loans" value="€0" valueClass="text-gray-500" />
            )}
          </FinancialSection>

          <FinancialSection title="NET WORTH">
            <DataRow label="Total Assets" value={financialData.totalAssets} />
            <DataRow label="Total Liabilities" value={totalOutstandingLoans} valueClass="text-red-600" />
            <hr className="my-1 border-gray-300" />
            <DataRow
              label="Net Worth"
              value={netWorth}
              valueClass={getColorClass(netWorth >= 0 ? 0.8 : 0.2)}
            />
          </FinancialSection>
      </SimpleCard>
    </div>
  );
}
