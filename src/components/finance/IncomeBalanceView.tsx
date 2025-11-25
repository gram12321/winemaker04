import { formatNumber, getColorClass } from '@/lib/utils';
import { calculateFinancialData, calculateNetWorth } from '@/lib/services';
import { SimpleCard } from '../ui';
import { useGameStateWithData } from '@/hooks';
import { DEFAULT_FINANCIAL_DATA, FINANCE_PERIOD_LABELS, WEEKS_PER_SEASON } from '@/lib/constants';
import { loadActiveLoans } from '@/lib/database/core/loansDB';
import { useState, useEffect } from 'react';
import { Loan } from '@/lib/types/types';

interface IncomeBalanceViewProps {
  period: 'weekly' | 'season' | 'year' | 'all';
  filters: {
    week?: number;
    season?: string;
    year?: number;
  };
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
    <span className={`font-medium ${valueClass}`}>{typeof value === 'number' ? formatNumber(value, { currency: true }) : value}</span>
  </div>
);


export function IncomeBalanceView({ period, filters }: IncomeBalanceViewProps) {
  const financialData = useGameStateWithData(
    () => calculateFinancialData(period, filters),
    DEFAULT_FINANCIAL_DATA
  );
  
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);

  const periodLabels = FINANCE_PERIOD_LABELS[period] ?? FINANCE_PERIOD_LABELS.weekly;
  const periodLabel = period === 'all' ? 'All Time' : `${period.charAt(0).toUpperCase() + period.slice(1)}`;
  const showLoanPaymentBreakdown = period !== 'all';

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
        return seasonalPayment / WEEKS_PER_SEASON;
      case 'season':
        return seasonalPayment;
      case 'year':
        return seasonalPayment * 4; // 4 seasons per year
      case 'all':
        return seasonalPayment * 4;
      default:
        return seasonalPayment;
    }
  };
  
  const totalPeriodPayments = showLoanPaymentBreakdown
    ? activeLoans.reduce((sum, loan) => sum + getPeriodPaymentAmount(loan.seasonalPayment), 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Row: Income Statement and Balance Sheet Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SimpleCard
          title="Income Statement"
          description="Your revenue and expense breakdown"
        >
          <FinancialSection title={periodLabels.income}>
            {financialData.incomeDetails.length > 0 ? (
              financialData.incomeDetails.map((item, index) => (
                <DataRow key={index} label={item.description} value={item.amount} valueClass="text-emerald-600" />
              ))
            ) : (
              <DataRow label={`Total ${periodLabel} Income`} value={financialData.income} valueClass="text-emerald-600" />
            )}
          </FinancialSection>

          <FinancialSection title={periodLabels.expenses}>
            {financialData.expenseDetails.length > 0 ? (
              financialData.expenseDetails.map((item, index) => (
                <DataRow key={index} label={item.description} value={item.amount} valueClass={getColorClass(0.2)} />
              ))
            ) : (
              <DataRow label={`Total ${periodLabel} Expenses`} value={financialData.expenses} valueClass={getColorClass(0.2)} />
            )}
            
            {/* Add loan payments if they exist */}
            {showLoanPaymentBreakdown && activeLoans.length > 0 && (
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
                  label={`Total ${periodLabel} Loan Payments`} 
                  value={totalPeriodPayments} 
                  valueClass="text-red-600" 
                />
              </>
            )}
          </FinancialSection>

          <FinancialSection title="NET INCOME">
            <DataRow label={`${periodLabel} Income`} value={financialData.income} valueClass={getColorClass(0.8)} />
            <DataRow label={`${periodLabel} Expenses`} value={financialData.expenses} valueClass={getColorClass(0.2)} />
            <hr className="my-1 border-gray-300" />
            <DataRow label="Net Income" value={financialData.netIncome} valueClass={getColorClass(financialData.netIncome >= 0 ? 0.8 : 0.2)} />
          </FinancialSection>
        </SimpleCard>

        <SimpleCard
          title="Balance Sheet Summary"
          description="Assets, liabilities, and equity overview"
        >
          <FinancialSection title="BALANCE SHEET SUMMARY">
            <div className="space-y-3">
              {/* Assets Section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-base">Total Assets</span>
                  <span className="font-bold text-lg">{formatNumber(financialData.totalAssets, { currency: true })}</span>
                </div>
              </div>
              
              <hr className="my-2 border-gray-400" />
              
              {/* Liabilities Section */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Liabilities</span>
                  <span className={`text-sm font-semibold ${totalOutstandingLoans > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {formatNumber(totalOutstandingLoans, { currency: true })}
                  </span>
                </div>
              </div>
              
              {/* Equity Section */}
              <div>
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Equity</span>
                  </div>
                  <div className="ml-4 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Contributed Capital</span>
                      <span className="text-blue-600 font-medium">
                        {formatNumber(financialData.playerContribution + financialData.familyContribution + financialData.outsideInvestment, { currency: true })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Retained Earnings</span>
                      <span className={getColorClass(financialData.retainedEarnings >= 0 ? 0.8 : 0.2)}>
                        {formatNumber(financialData.retainedEarnings, { currency: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-gray-300 pt-1 mt-1">
                  <span className="text-sm font-medium">Total Equity</span>
                  <span className="text-sm font-semibold text-blue-600">
                    {formatNumber(financialData.totalEquity, { currency: true })}
                  </span>
                </div>
              </div>
              
              <hr className="my-2 border-gray-400" />
              
              {/* Total Debt and Equity */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-base">Total Debt and Equity</span>
                  <span className={`font-bold text-lg ${getColorClass(Math.abs((totalOutstandingLoans + financialData.totalEquity) - financialData.totalAssets) < 0.01 ? 0.8 : 0.2)}`}>
                    {formatNumber(totalOutstandingLoans + financialData.totalEquity, { currency: true })}
                  </span>
                </div>
              </div>
              
              <hr className="my-2 border-gray-400" />
              
              {/* Company Value */}
              <div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-base">Company Value</span>
                  <span className="font-bold text-lg">{formatNumber(financialData.totalAssets, { currency: true })}</span>
                </div>
              </div>
            </div>
          </FinancialSection>
        </SimpleCard>
      </div>

      {/* Bottom Row: Assets and Liabilities/Equity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SimpleCard
          title="Assets"
          description="What your company owns"
        >
          <FinancialSection title="TOTAL ASSETS">
            <DataRow label="Cash" value={financialData.cashMoney} />
            <DataRow label="Fixed Assets" value={financialData.fixedAssets} />
            <DataRow label="Current Assets" value={financialData.currentAssets} />
            <hr className="my-1 border-gray-300" />
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Assets</span>
              <span className="font-bold text-base">{formatNumber(financialData.totalAssets, { currency: true })}</span>
            </div>
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
        </SimpleCard>

        <SimpleCard
          title="Liabilities & Equity"
          description="What your company owes and owns"
        >
          <FinancialSection title="LIABILITIES">
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
                      Payment: {formatNumber(getPeriodPaymentAmount(loan.seasonalPayment), { currency: true })}/{periodLabel}
                    </div>
                  </div>
                ))}
                <hr className="my-2 border-gray-300" />
                <DataRow label="Total Liabilities" value={totalOutstandingLoans} valueClass="text-red-600 font-semibold" />
                {showLoanPaymentBreakdown && (
                  <DataRow 
                    label={`Total ${periodLabel} Payments`} 
                    value={totalPeriodPayments} 
                    valueClass="text-orange-600" 
                  />
                )}
              </>
            ) : (
              <DataRow label="No Active Loans" value="€0" valueClass="text-gray-500" />
            )}
          </FinancialSection>

          <FinancialSection title="EQUITY">
            <div className="mb-2">
              <div className="text-xs font-medium text-gray-600 mb-1">Contributed Capital</div>
              <div className="ml-2 space-y-1">
                <DataRow label="Player Contribution (Cash)" value={financialData.playerContribution} valueClass="text-blue-600" />
                <DataRow label="Family Contribution (Vineyards)" value={financialData.familyContribution} valueClass="text-blue-600" />
                <DataRow label="Outside Investment (Cash)" value={financialData.outsideInvestment} valueClass="text-blue-600" />
              </div>
              <div className="ml-2 mt-1 pt-1 border-t border-gray-200">
                <DataRow 
                  label="Total Contributed Capital" 
                  value={financialData.playerContribution + financialData.familyContribution + financialData.outsideInvestment} 
                  valueClass="text-blue-600 font-semibold" 
                />
              </div>
            </div>
            <DataRow label="Retained Earnings" value={financialData.retainedEarnings} valueClass={getColorClass(financialData.retainedEarnings >= 0 ? 0.8 : 0.2)} />
            <hr className="my-1 border-gray-300" />
            <DataRow label="Total Equity" value={financialData.totalEquity} valueClass="text-blue-600 font-semibold" />
          </FinancialSection>
        </SimpleCard>
      </div>
    </div>
  );
}
