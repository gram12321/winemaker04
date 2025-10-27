import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Separator } from '@/components/ui';
import { Loan } from '@/lib/types/types';
import { loadActiveLoans } from '@/lib/database/core/loansDB';
import { getGameState, getAvailableLenders, calculateLenderAvailability } from '@/lib/services';
import { loadLenders } from '@/lib/database/core/lendersDB';
import { formatCurrency, formatPercent, formatNumber, getCreditRatingCategory, getCreditRatingDescription, getBadgeColorClasses, getLenderTypeColorClass, getEconomyPhaseColorClass } from '@/lib/utils';
import { calculateTotalInterest, calculateTotalExpenses, calculateRemainingInterest, repayLoanInFull } from '@/lib/services/finance/loanService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui';
import { LenderSearchOptionsModal } from '@/components/ui';
// LenderSearchResultsModal is now handled globally by GlobalSearchResultsDisplay
import { calculateCreditRating } from '@/lib/services';
import { useGameStateWithData } from '@/hooks';

// Helper type for combined loans data
type LoansData = {
  loans: Loan[];
  creditRatingBreakdown: any;
  comprehensiveCreditRating: number;
  availableLenders: any[];
  lenderAvailabilityBreakdown: any;
};

const defaultLoansData: LoansData = {
  loans: [],
  creditRatingBreakdown: null,
  comprehensiveCreditRating: 0.5,
  availableLenders: [],
  lenderAvailabilityBreakdown: null
};

export default function LoansView() {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isLenderAvailabilityExpanded, setIsLenderAvailabilityExpanded] = useState(false);
  const [isCreditRatingExpanded, setIsCreditRatingExpanded] = useState(false);

  const gameState = getGameState();

  // Use the global cache hook for all loan-related data
  const loansData = useGameStateWithData<LoansData>(async () => {
    try {
      // Calculate comprehensive credit rating
      const creditBreakdown = await calculateCreditRating();
      
      const loans = await loadActiveLoans();
      
      // Calculate lender availability breakdown
      const currentCreditRating = creditBreakdown.finalRating;
      const companyPrestige = gameState.prestige || 0;
      
      // Get all lenders (not just available ones) for the breakdown
      const allLenders = await loadLenders();
      const availableLenders = await getAvailableLenders(currentCreditRating * 100, companyPrestige);
      
      const lenderAvailabilityBreakdown = allLenders.map(lender => {
        const availability = calculateLenderAvailability(lender, currentCreditRating * 100, companyPrestige);
        return {
          ...lender,
          availability
        };
      });
      
      return {
        loans,
        creditRatingBreakdown: creditBreakdown,
        comprehensiveCreditRating: creditBreakdown.finalRating,
        availableLenders,
        lenderAvailabilityBreakdown
      };
    } catch (error) {
      console.error('Error loading loans data:', error);
      // Fallback to game state credit rating
      const loans = await loadActiveLoans();
      const currentCreditRating = gameState.creditRating || 0.5;
      const companyPrestige = gameState.prestige || 0;
      
      const allLenders = await loadLenders();
      const availableLenders = await getAvailableLenders(currentCreditRating * 100, companyPrestige);
      
      const lenderAvailabilityBreakdown = allLenders.map(lender => {
        const availability = calculateLenderAvailability(lender, currentCreditRating * 100, companyPrestige);
        return {
          ...lender,
          availability
        };
      });
      
      return {
        loans,
        creditRatingBreakdown: null,
        comprehensiveCreditRating: currentCreditRating,
        availableLenders,
        lenderAvailabilityBreakdown
      };
    }
  }, defaultLoansData);

  const { loans: activeLoans, creditRatingBreakdown, comprehensiveCreditRating, lenderAvailabilityBreakdown } = loansData;

  // Note: Lender search results are now handled globally by GlobalSearchResultsDisplay

  const handleSearchModalOpen = () => {
    setIsSearchModalOpen(true);
  };

  const handleSearchComplete = () => {
    setIsSearchModalOpen(false);
    // Results modal will open automatically via global system
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

      {/* Search for Loan Offers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            Search for Loan Offers
            <Badge variant="outline" className={`ml-2 ${getBadgeColorClasses(comprehensiveCreditRating).bg} ${getBadgeColorClasses(comprehensiveCreditRating).text}`}>
              Credit Rating: {getCreditRatingCategory(comprehensiveCreditRating)} ({formatNumber(comprehensiveCreditRating * 100, { decimals: 0 })}%)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                To apply for a loan, start a lender search activity. This will generate multiple loan offers from available lenders based on your credit rating and company prestige.
              </p>
              <Button
                onClick={handleSearchModalOpen}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
              >
                🔍 Search for Loan Offers
              </Button>
              <p className="text-sm text-gray-500 mt-4">
                Search cost and time vary based on the number of offers and lender type constraints.
              </p>
            </div>

            {/* Lender Availability Information */}
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg">
                <button
                  onClick={() => setIsLenderAvailabilityExpanded(!isLenderAvailabilityExpanded)}
                  className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">Lender Availability Information</h4>
                    <p className="text-sm text-gray-600">View available lenders and their requirements</p>
                  </div>
                  <span className="text-gray-500">
                    {isLenderAvailabilityExpanded ? '▼' : '▶'}
                  </span>
                </button>
                
                {isLenderAvailabilityExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-200">
                    <div className="pt-4 space-y-4">
                      {lenderAvailabilityBreakdown && lenderAvailabilityBreakdown.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {lenderAvailabilityBreakdown.map((lender: any, index: number) => (
                            <div key={lender.id || index} className={`p-4 rounded-lg border-2 ${
                              lender.availability.isAvailable 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-red-50 border-red-200'
                            }`}>
                              <div className="space-y-3">
                                {/* Lender Name and Type */}
                    <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-semibold text-lg">{lender.name}</div>
                                    <div className="text-sm text-gray-600">{lender.type}</div>
                                  </div>
                      <Badge className={getLenderTypeColorClass(lender.type)}>
                        {lender.type}
                      </Badge>
                    </div>

                                {/* Credit Requirements */}
                    <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Base Required:</span>
                                    <span className="font-medium">≥{formatPercent(lender.availability.baseRequirement / 100)}</span>
                                  </div>
                                  
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Prestige Bonus:</span>
                                    <span className="font-medium text-green-600">
                                      +{formatPercent(lender.availability.prestigeBonus / 100)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Adjusted Required:</span>
                                    <span className="font-medium">
                                      ≥{formatPercent(lender.availability.adjustedRequirement / 100)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Your Credit:</span>
                                    <span className="font-medium text-blue-600">
                                      {formatPercent(comprehensiveCreditRating)}
                                    </span>
                                  </div>
                    </div>
                    
                                {/* Status */}
                                <div className="pt-2 border-t border-gray-200">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-600">Status:</span>
                                    <div className={`text-sm font-semibold ${
                                      lender.availability.isAvailable ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {lender.availability.isAvailable ? 'Available' : 'Not Available'}
                                    </div>
                                  </div>
                                  {!lender.availability.isAvailable && (
                                    <div className="text-xs text-red-500 mt-1">
                                      {lender.availability.reason}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          No lender availability data available
                        </div>
                      )}
                    </div>
            </div>
          )}
              </div>

              {/* Credit Rating Breakdown */}
              {creditRatingBreakdown && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg">
                  <button
                    onClick={() => setIsCreditRatingExpanded(!isCreditRatingExpanded)}
                    className="w-full p-4 text-left flex items-center justify-between hover:bg-blue-100 transition-colors"
                  >
                    <div>
                      <h4 className="font-medium text-blue-900">Credit Rating Breakdown</h4>
                      <p className="text-sm text-blue-700">Detailed analysis of your credit rating</p>
                    </div>
                    <span className="text-blue-500">
                      {isCreditRatingExpanded ? '▼' : '▶'}
                    </span>
                  </button>
                  
                  {isCreditRatingExpanded && (
                    <div className="px-4 pb-4 border-t border-blue-200">
                      <div className="pt-4">
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
            </div>
                  )}
            </div>
              )}
            </div>

            {/* Credit Rating Breakdown (Collapsed) */}
            {creditRatingBreakdown && false && (
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
          </div>
        </CardContent>
      </Card>


      {/* Lender Search Options Modal */}
      <LenderSearchOptionsModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSearchStarted={handleSearchComplete}
      />

      {/* Lender Search Results Modal is now handled globally by GlobalSearchResultsDisplay */}
    </div>
  );
}
