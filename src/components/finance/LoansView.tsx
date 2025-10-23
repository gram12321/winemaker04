import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Separator } from '@/components/ui';
import { Loan, Lender } from '@/lib/types/types';
import { loadActiveLoans } from '@/lib/database/core/loansDB';
import { getAvailableLenders, getGameState, calculateLenderAvailability } from '@/lib/services';
import { formatCurrency, formatPercent, formatNumber, getCreditRatingCategory, getCreditRatingDescription, getBadgeColorClasses, getLenderTypeColorClass, getEconomyPhaseColorClass } from '@/lib/utils';
import { calculateTotalInterest, calculateTotalExpenses, calculateRemainingInterest, repayLoanInFull } from '@/lib/services/finance/loanService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui';
import { loadLenders } from '@/lib/database/core/lendersDB';
import { LoanApplicationModal } from '@/components/ui/modals/LoanApplicationModal';
import { calculateCreditRating } from '@/lib/services';
import { useGameStateWithData } from '@/hooks';

// Helper type for combined loans data
type LoansData = {
  loans: Loan[];
  lenders: Lender[];
  allLenders: Lender[];
  creditRatingBreakdown: any;
  comprehensiveCreditRating: number;
};

const defaultLoansData: LoansData = {
  loans: [],
  lenders: [],
  allLenders: [],
  creditRatingBreakdown: null,
  comprehensiveCreditRating: 0.5
};

export default function LoansView() {
  const [selectedLender, setSelectedLender] = useState<Lender | null>(null);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);

  const gameState = getGameState();

  // Use the global cache hook for all loan-related data
  const loansData = useGameStateWithData<LoansData>(async () => {
    try {
      // Calculate comprehensive credit rating
      const creditBreakdown = await calculateCreditRating();
      
      const [loans, lenders, allLendersData] = await Promise.all([
        loadActiveLoans(),
        getAvailableLenders(creditBreakdown.finalRating * 100, gameState.prestige),
        loadLenders()
      ]);
      
      return {
        loans,
        lenders,
        allLenders: allLendersData,
        creditRatingBreakdown: creditBreakdown,
        comprehensiveCreditRating: creditBreakdown.finalRating
      };
    } catch (error) {
      console.error('Error loading loans data:', error);
      // Fallback to game state credit rating
      const [loans, lenders, allLendersData] = await Promise.all([
        loadActiveLoans(),
        getAvailableLenders(gameState.creditRating || 50, gameState.prestige),
        loadLenders()
      ]);
      
      return {
        loans,
        lenders,
        allLenders: allLendersData,
        creditRatingBreakdown: null,
        comprehensiveCreditRating: gameState.creditRating || 0.5
      };
    }
  }, defaultLoansData);

  const { loans: activeLoans, lenders: availableLenders, allLenders, creditRatingBreakdown, comprehensiveCreditRating } = loansData;

  const handleApplyForLoan = (lender: Lender) => {
    setSelectedLender(lender);
    setIsApplicationModalOpen(true);
  };

  const handleLoanApplicationComplete = () => {
    setIsApplicationModalOpen(false);
    setSelectedLender(null);
    // Data will auto-refresh via useGameStateWithData when triggerGameUpdate() is called from loanService
  };

  const handleRepayLoan = async (loanId: string) => {
    try {
      await repayLoanInFull(loanId);
      // Data will auto-refresh via useGameStateWithData when triggerGameUpdate() is called from repayLoanInFull
    } catch (error) {
      console.error('Error repaying loan:', error);
      // You could add a toast notification here for user feedback
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Loans Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            Active Loans
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeLoans.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No active loans</p>
              <p className="text-sm">Apply for a loan from available lenders below</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lender</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Origination Fee</TableHead>
                  <TableHead>Interest Rate</TableHead>
                  <TableHead>Seasonal Payment</TableHead>
                  <TableHead>Total Interest</TableHead>
                  <TableHead>Total Expenses</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Next Payment</TableHead>
                  <TableHead>Warnings</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeLoans.map((loan) => {
                  const totalInterest = calculateTotalInterest(loan);
                  const totalExpenses = calculateTotalExpenses(loan);
                  const remainingInterest = calculateRemainingInterest(loan);
                  const missedPayments = loan.missedPayments || 0;
                  const hasWarnings = missedPayments > 0;
                  
                  return (
                    <TableRow 
                      key={loan.id} 
                      className={hasWarnings ? 'bg-red-50 border-l-4 border-l-red-400' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{loan.lenderName}</span>
                          <Badge className={getLenderTypeColorClass(loan.lenderType)}>
                            {loan.lenderType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(loan.principalAmount)}</TableCell>
                      <TableCell>
                        <div className="text-orange-600 font-medium">
                          {formatCurrency(loan.originationFee)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{formatPercent(loan.effectiveInterestRate)}</span>
                          <Badge className={getEconomyPhaseColorClass(loan.economyPhaseAtCreation)}>
                            {loan.economyPhaseAtCreation}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(loan.seasonalPayment)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{formatCurrency(totalInterest)}</div>
                          <div className="text-gray-500">
                            {formatCurrency(remainingInterest)} remaining
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium text-red-600">{formatCurrency(totalExpenses)}</div>
                          <div className="text-gray-500">
                            Fee + Interest
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatCurrency(loan.remainingBalance)}</div>
                          <div className="text-gray-500">
                            {Math.round(loan.seasonsRemaining / 4 * 10) / 10} of {Math.round(loan.totalSeasons / 4 * 10) / 10} years
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>Week {loan.nextPaymentDue.week}</div>
                          <div className="text-gray-500">
                            {loan.nextPaymentDue.season} {loan.nextPaymentDue.year}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasWarnings ? (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              {missedPayments}
                            </Badge>
                            <span className="text-sm text-red-600 font-medium">
                              {missedPayments === 1 ? 'Warning #1' : 
                               missedPayments === 2 ? 'Warning #2' : 
                               missedPayments === 3 ? 'Warning #3' : 
                               'Critical'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-green-600 text-sm font-medium">✓ Good Standing</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => handleRepayLoan(loan.id)}
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          Repay in Full
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Available Lenders Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-lg">🏦</span>
            Available Lenders
            <Badge variant="outline" className={`ml-2 ${getBadgeColorClasses(comprehensiveCreditRating).bg} ${getBadgeColorClasses(comprehensiveCreditRating).text}`}>
              Credit Rating: {getCreditRatingCategory(comprehensiveCreditRating)} ({formatNumber(comprehensiveCreditRating * 100, { decimals: 0 })}%)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {availableLenders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No lenders available</p>
              <p className="text-sm">Improve your credit rating to access more lenders</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableLenders.map((lender) => (
                <Card key={lender.id} className="border border-gray-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{lender.name}</CardTitle>
                      <Badge className={getLenderTypeColorClass(lender.type)}>
                        {lender.type}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Interest Rate:</span>
                        <span className="font-medium">
                          {formatPercent(lender.baseInterestRate)} - {formatPercent(lender.baseInterestRate * 1.5)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Loan Amount:</span>
                        <span className="font-medium">
                          {formatCurrency(lender.minLoanAmount)} - {formatCurrency(lender.maxLoanAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">
                          {Math.round(lender.minDurationSeasons / 4 * 10) / 10} - {Math.round(lender.maxDurationSeasons / 4 * 10) / 10} years
                        </span>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={() => handleApplyForLoan(lender)}
                      className="w-full"
                      disabled={lender.blacklisted}
                    >
                      {lender.blacklisted ? 'Blacklisted' : 'Apply for Loan'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Lender Availability Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-lg">ℹ️</span>
            Lender Availability Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Credit Rating Requirements</h4>
              <p className="text-gray-600">
                Lenders only offer loans to companies with credit ratings that meet their risk tolerance. 
                Your current credit rating of <span className="font-medium">{formatNumber((gameState.creditRating || 0.5) * 100, { decimals: 0 })}%</span> determines which lenders are available.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Interest Rate Factors</h4>
              <p className="text-gray-600">
                Interest rates are calculated using: base rate × economy phase × lender type × credit rating × duration. 
                Longer-term loans (10+ years) receive up to 15% discount on interest rates.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Economy Phase Impact</h4>
              <p className="text-gray-600">
                Current economy phase <span className="font-medium">{gameState.economyPhase || 'Recovery'}</span> affects all loan interest rates. 
                Better economy phases (Boom, Expansion) offer lower rates, while difficult phases (Crash, Recession) increase rates.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Lender Types</h4>
              <p className="text-gray-600">
                Banks offer conservative rates, Investment Funds provide mid-range terms, and Private Lenders offer flexible but higher rates. 
                Each type has different risk tolerance and loan amount ranges.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Lender Availability Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            Lender Availability Breakdown
            <Badge variant="outline" className="ml-2">
              {availableLenders.length} of {allLenders.length} lenders available
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Comprehensive Credit Rating Breakdown */}
            {creditRatingBreakdown && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-blue-900 mb-3">Comprehensive Credit Rating Breakdown</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="font-medium text-blue-800 mb-2 cursor-help">
                            Asset Health ({formatNumber(creditRatingBreakdown.assetHealth.score * 100, { decimals: 1 })}%)
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-xs">
                            <div className="font-medium mb-2">Asset Health Formula:</div>
                            <div className="text-xs space-y-1">
                              <div>• Debt-to-Asset Ratio = Outstanding Loans ÷ Total Assets</div>
                              <div>• Asset Coverage = Total Assets ÷ Outstanding Loans</div>
                              <div>• Liquidity Ratio = (Cash + Liquid Assets) ÷ Outstanding Loans</div>
                              <div className="mt-2 font-medium">Scoring:</div>
                              <div>• Debt-to-Asset ≤10%: +8% | ≤30%: +6% | ≤50%: +4% | ≤70%: +2%</div>
                              <div>• Asset Coverage ≥5x: +6% | ≥3x: +4% | ≥2x: +2%</div>
                              <div>• Liquidity ≥2x: +6% | ≥1x: +4% | ≥0.5x: +2%</div>
                              <div className="mt-2 font-medium">Max Score: 20% of total credit rating</div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="space-y-1 text-blue-700">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">Debt-to-Asset: {formatNumber(creditRatingBreakdown.assetHealth.debtToAssetRatio * 100, { decimals: 1 })}%</div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">Debt-to-Asset Ratio = Outstanding Loans ÷ Total Company Assets</div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">Asset Coverage: {formatNumber(creditRatingBreakdown.assetHealth.assetCoverage, { decimals: 1 })}x</div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">Asset Coverage = Total Assets ÷ Outstanding Loans</div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">Liquidity Ratio: {formatNumber(creditRatingBreakdown.assetHealth.liquidityRatio, { decimals: 1 })}x</div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">Liquidity Ratio = (Cash + Liquid Assets) ÷ Outstanding Loans</div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="font-medium text-blue-800 mb-2 cursor-help">
                            Company Stability ({formatNumber(creditRatingBreakdown.companyStability.score * 100, { decimals: 1 })}%)
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-xs">
                            <div className="font-medium mb-2">Company Stability Formula:</div>
                            <div className="text-xs space-y-1">
                              <div>• Age Score = min(Company Age × 0.5%, 5%) [max 5% at 10+ years]</div>
                              <div>• Profit Consistency = 3% - (Standard Deviation ÷ |Mean|) × 3%</div>
                              <div>• Expense Efficiency = (1 - Expense Ratio) × 2%</div>
                              <div className="mt-2 font-medium">Scoring:</div>
                              <div>• Company Age: 0.5% per year, max 5% at 10+ years</div>
                              <div>• Profit Consistency: Based on variance in last 4 seasons</div>
                              <div>• Expense Efficiency: Lower expense ratio = higher score</div>
                              <div className="mt-2 font-medium">Max Score: 10% of total credit rating</div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="space-y-1 text-blue-700">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">Company Age: {formatNumber(creditRatingBreakdown.companyStability.companyAge, { decimals: 1 })} years</div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">Age Score = min(Company Age × 0.5%, 5%) - Max 5% at 10+ years</div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">Profit Consistency: {formatNumber(creditRatingBreakdown.companyStability.profitConsistency * 100, { decimals: 1 })}%</div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">Profit Consistency = 3% - (Standard Deviation ÷ |Mean|) × 3% - Based on variance in last 4 seasons</div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">Expense Efficiency: {formatNumber(creditRatingBreakdown.companyStability.expenseEfficiency * 100, { decimals: 1 })}%</div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">Expense Efficiency = (1 - Expense Ratio) × 2% - Lower expense ratio = higher score</div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="font-medium text-blue-800 mb-2 cursor-help">
                            Negative Balance ({formatNumber(creditRatingBreakdown.negativeBalance.score * 100, { decimals: 1 })}%)
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-xs">
                            <div className="font-medium mb-2">Negative Balance Penalty:</div>
                            <div className="text-xs space-y-1">
                              <div>• Penalty: -2% per week with negative balance</div>
                              <div>• Max Penalty: -30% (after 15 weeks)</div>
                              <div>• Consecutive Weeks: {creditRatingBreakdown.negativeBalance.consecutiveWeeksNegative} weeks</div>
                              <div className="mt-2 font-medium">Formula:</div>
                              <div>Penalty = min(Weeks Negative × -2%, -30%)</div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="space-y-1 text-blue-700">
                      <div>Consecutive Weeks: {creditRatingBreakdown.negativeBalance.consecutiveWeeksNegative} weeks</div>
                      <div>Penalty per Week: {formatNumber(creditRatingBreakdown.negativeBalance.penaltyPerWeek * 100, { decimals: 1 })}%</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-blue-600">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          {getCreditRatingDescription(creditRatingBreakdown.finalRating)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <div className="font-medium mb-2">Final Credit Rating Formula:</div>
                          <div className="text-xs space-y-1">
                            <div>Final Rating = Base Rating (50%) + Asset Health + Payment History + Company Stability + Negative Balance Penalty</div>
                            <div className="mt-2 font-medium">Components:</div>
                            <div>• Base Rating: 50% (BBB- equivalent)</div>
                            <div>• Asset Health: 0-20% (debt ratios, coverage, liquidity)</div>
                            <div>• Payment History: 0-15% (on-time payments, defaults, payoffs)</div>
                            <div>• Company Stability: 0-10% (age, profit consistency, efficiency)</div>
                            <div>• Negative Balance: 0 to -30% (penalty for negative balance over time)</div>
                            <div className="mt-2 font-medium">Total Range: 0-100% (0% = C rating, 100% = AAA rating)</div>
                            <div className="mt-2 font-medium">Current Breakdown:</div>
                            <div>• Base: 50%</div>
                            <div>• Asset Health: {formatNumber(creditRatingBreakdown.assetHealth.score * 100, { decimals: 1 })}%</div>
                            <div>• Payment History: {formatNumber(creditRatingBreakdown.paymentHistory.score * 100, { decimals: 1 })}%</div>
                            <div>• Company Stability: {formatNumber(creditRatingBreakdown.companyStability.score * 100, { decimals: 1 })}%</div>
                            <div>• Negative Balance: {formatNumber(creditRatingBreakdown.negativeBalance.score * 100, { decimals: 1 })}%</div>
                            <div>• Final: {formatNumber(creditRatingBreakdown.finalRating * 100, { decimals: 1 })}%</div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            )}
            
             {/* Calculate prestige bonus once for display */}
             {(() => {
               const creditRating = comprehensiveCreditRating * 100;
               const currentPrestigeBonus = allLenders.length > 0 
                 ? calculateLenderAvailability(allLenders[0], creditRating, gameState.prestige).prestigeBonus 
                 : 0;
               
               return (
                 <>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {allLenders.map((lender) => {
                 // Use business logic to calculate availability
                 const availability = calculateLenderAvailability(lender, creditRating, gameState.prestige);
                
                return (
                  <div key={lender.id} className={`border rounded-lg p-3 ${availability.isAvailable ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{lender.name}</h4>
                      <Badge className={getLenderTypeColorClass(lender.type)}>
                        {lender.type}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Base Required:</span>
                        <span className="text-gray-700">≥{Math.round(availability.baseRequirement)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Prestige Bonus:</span>
                        <span className="text-blue-700">+{Math.round(availability.prestigeBonus)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Adjusted Required:</span>
                        <span className={`font-medium ${availability.adjustedRequirement <= creditRating ? 'text-green-700' : 'text-red-700'}`}>
                          ≥{Math.round(availability.adjustedRequirement)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Your Credit:</span>
                        <span className={`font-medium ${creditRating >= availability.adjustedRequirement ? 'text-green-700' : 'text-red-700'}`}>
                          {Math.round(creditRating)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className={`font-medium ${availability.isAvailable ? 'text-green-700' : 'text-red-700'}`}>
                          {availability.isAvailable ? 'Available' : 'Not Available'}
                        </span>
                      </div>
                      {lender.blacklisted && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Blacklisted:</span>
                          <span className="font-medium text-red-700">Yes</span>
                        </div>
                      )}
                    </div>
                    
                    {!availability.isAvailable && (
                      <div className="mt-2 text-xs text-gray-500">
                        {lender.blacklisted 
                          ? 'Blacklisted due to previous default'
                          : `Credit rating too low (need ${Math.round(availability.adjustedRequirement)}%, have ${Math.round(creditRating)}%)`
                        }
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
             <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
               <div className="text-sm">
                 <h4 className="font-medium text-blue-900 mb-1">Calculation Logic:</h4>
                 <p className="text-blue-800">
                   A lender is available if: <span className="font-medium">Your Credit Rating ≥ (Lender's Risk Tolerance - Prestige Bonus)</span> 
                   and the lender is not blacklisted. Your comprehensive credit rating of <span className="font-medium">{Math.round(comprehensiveCreditRating * 100)}%</span> 
                   is the primary factor, while your prestige of <span className="font-medium">{Math.round(gameState.prestige || 0)}</span> provides a 
                   <span className="font-medium"> {Math.round(currentPrestigeBonus)}% reduction</span> in the required credit rating.
                 </p>
               </div>
               </div>
                 </>
               );
             })()}
          </div>
        </CardContent>
      </Card>


      {/* Loan Application Modal */}
      {selectedLender && (
        <LoanApplicationModal
          lender={selectedLender}
          isOpen={isApplicationModalOpen}
          onClose={() => setIsApplicationModalOpen(false)}
          onComplete={handleLoanApplicationComplete}
        />
      )}
    </div>
  );
}
