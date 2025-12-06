import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/shadCN/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { formatNumber, getRangeColor } from '@/lib/utils';
import { useGameState } from '@/hooks';
import { getBoardSatisfactionBreakdown, boardEnforcer, getShareholderBreakdown, calculateFinancialData, calculateCreditRating, getDividendRateLimits, getMarketValue, updateMarketValue, calculateTotalOutstandingLoans, getShareMetrics, type BoardSatisfactionBreakdown, type CreditRatingBreakdown } from '@/lib/services';
import { getCompanyShares, getYearlyShareOperations } from '@/lib/database';
import { getCurrentCompanyId } from '@/lib/utils';
import { BOARD_CONSTRAINTS, BOARD_SATISFACTION_WEIGHTS, CREDIT_RATING_WEIGHTS, type BoardConstraintType } from '@/lib/constants';
import { SimpleCard } from '@/components/ui';
import { getBoardSatisfactionHistory } from '@/lib/database';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { UnifiedTooltip } from '@/components/ui/shadCN/tooltip';

// Helper function to render detailed stability score calculation tooltip
function renderStabilityScoreTooltip(
  creditRatingBreakdown: {
    assetHealth: CreditRatingBreakdown['assetHealth'];
    companyStability: CreditRatingBreakdown['companyStability'];
  },
  finalStabilityScore: number
) {
  return (
    <div className="max-w-lg space-y-3 text-xs">
      <div className="font-semibold mb-2">Stability Score Calculation</div>
      
      {/* Asset Health Component */}
      <div className="border-t border-gray-600 pt-2">
        <div className="font-medium mb-1">Asset Health (60% weight):</div>
        <div className="text-gray-400 mb-1 italic">Formula: Weighted average of normalized components (0-1 each)</div>
        
        <div className="space-y-1.5 pl-2 text-gray-300">
          {/* Debt-to-Asset Ratio */}
          <div>
            <div className="font-medium">Debt-to-Asset Ratio:</div>
            <div>
              Value: {formatNumber(creditRatingBreakdown.assetHealth.debtToAssetRatio, { decimals: 4, forceDecimals: true, percent: true, percentIsDecimal: true })}
              {' → Normalized: '}
              {formatNumber(creditRatingBreakdown.assetHealth.normalizedDebtToAsset, { decimals: 3, forceDecimals: true })}
              {' ('}
              {formatNumber(creditRatingBreakdown.assetHealth.normalizedDebtToAsset * 100, { decimals: 1, forceDecimals: true })}%
              {') × '}
              {formatNumber(CREDIT_RATING_WEIGHTS.assetHealth_debtToAsset * 100, { decimals: 0 })}% weight
            </div>
            <div className="text-xs text-gray-400 italic">Formula: 1 - (ratio^1.5) - smooth continuous curve (0% = 1.0, 100% = 0.0)</div>
          </div>
          
          {/* Asset Coverage */}
          <div>
            <div className="font-medium">Asset Coverage:</div>
            <div>
              Value: {creditRatingBreakdown.assetHealth.assetCoverage >= 999 ? 'N/A (No debt)' : formatNumber(creditRatingBreakdown.assetHealth.assetCoverage, { decimals: 2, forceDecimals: true }) + 'x'}
              {' → Normalized: '}
              {formatNumber(creditRatingBreakdown.assetHealth.normalizedAssetCoverage, { decimals: 3, forceDecimals: true })}
              {' ('}
              {formatNumber(creditRatingBreakdown.assetHealth.normalizedAssetCoverage * 100, { decimals: 1, forceDecimals: true })}%
              {') × '}
              {formatNumber(CREDIT_RATING_WEIGHTS.assetHealth_assetCoverage * 100, { decimals: 0 })}% weight
            </div>
          </div>
          
          {/* Liquidity Ratio */}
          <div>
            <div className="font-medium">Liquidity Ratio:</div>
            <div>
              Value: {creditRatingBreakdown.assetHealth.liquidityRatio >= 999 ? 'N/A (No debt)' : formatNumber(creditRatingBreakdown.assetHealth.liquidityRatio, { decimals: 2, forceDecimals: true }) + 'x'}
              {' → Normalized: '}
              {formatNumber(creditRatingBreakdown.assetHealth.normalizedLiquidity, { decimals: 3, forceDecimals: true })}
              {' ('}
              {formatNumber(creditRatingBreakdown.assetHealth.normalizedLiquidity * 100, { decimals: 1, forceDecimals: true })}%
              {') × '}
              {formatNumber(CREDIT_RATING_WEIGHTS.assetHealth_liquidity * 100, { decimals: 0 })}% weight
            </div>
          </div>
          
          {/* Fixed Asset Ratio */}
          <div>
            <div className="font-medium">Fixed Asset Ratio:</div>
            <div>
              Value: {formatNumber(creditRatingBreakdown.assetHealth.fixedAssetRatio, { decimals: 4, forceDecimals: true, percent: true, percentIsDecimal: true })}
              {' → Normalized: '}
              {formatNumber(creditRatingBreakdown.assetHealth.normalizedFixedAssets, { decimals: 3, forceDecimals: true })}
              {' ('}
              {formatNumber(creditRatingBreakdown.assetHealth.normalizedFixedAssets * 100, { decimals: 1, forceDecimals: true })}%
              {') × '}
              {formatNumber(CREDIT_RATING_WEIGHTS.assetHealth_fixedAssets * 100, { decimals: 0 })}% weight
            </div>
          </div>
          
          <div className="pt-1 border-t border-gray-600 mt-1 font-semibold">
            Asset Health Score: {' '}
            ({formatNumber(creditRatingBreakdown.assetHealth.normalizedDebtToAsset * 100, { decimals: 1 })}% × {formatNumber(CREDIT_RATING_WEIGHTS.assetHealth_debtToAsset * 100, { decimals: 0 })}%) + {' '}
            ({formatNumber(creditRatingBreakdown.assetHealth.normalizedAssetCoverage * 100, { decimals: 1 })}% × {formatNumber(CREDIT_RATING_WEIGHTS.assetHealth_assetCoverage * 100, { decimals: 0 })}%) + {' '}
            ({formatNumber(creditRatingBreakdown.assetHealth.normalizedLiquidity * 100, { decimals: 1 })}% × {formatNumber(CREDIT_RATING_WEIGHTS.assetHealth_liquidity * 100, { decimals: 0 })}%) + {' '}
            ({formatNumber(creditRatingBreakdown.assetHealth.normalizedFixedAssets * 100, { decimals: 1 })}% × {formatNumber(CREDIT_RATING_WEIGHTS.assetHealth_fixedAssets * 100, { decimals: 0 })}%) = {' '}
            {formatNumber(creditRatingBreakdown.assetHealth.score * 100, { decimals: 1, forceDecimals: true })}%
          </div>
        </div>
      </div>
      
      {/* Company Stability Component */}
      <div className="border-t border-gray-600 pt-2">
        <div className="font-medium mb-1">Company Stability (40% weight):</div>
        <div className="text-gray-400 mb-1 italic">Formula: Weighted average of normalized components (0-1 each)</div>
        
        <div className="space-y-1.5 pl-2 text-gray-300">
          {/* Company Age */}
          <div>
            <div className="font-medium">Company Age:</div>
            <div>
              Value: {formatNumber(creditRatingBreakdown.companyStability.companyAge, { decimals: 1, forceDecimals: true })} years
              {' → Normalized: '}
              {formatNumber(creditRatingBreakdown.companyStability.normalizedAge, { decimals: 3, forceDecimals: true })}
              {' ('}
              {formatNumber(creditRatingBreakdown.companyStability.normalizedAge * 100, { decimals: 1, forceDecimals: true })}%
              {') × '}
              {formatNumber(CREDIT_RATING_WEIGHTS.stability_age * 100, { decimals: 0 })}% weight
            </div>
            <div className="text-xs text-gray-400 italic">Formula: Uses vineyard age prestige modifier pattern (0 years = 0.0, heavily weighted toward &lt;40 and &lt;60 years, 200+ years = 1.0)</div>
          </div>
          
          {/* Profit Consistency */}
          <div>
            <div className="font-medium">Profit Consistency:</div>
            <div>
              Raw Score: {formatNumber(creditRatingBreakdown.companyStability.profitConsistency, { decimals: 4, forceDecimals: true })} / 0.03 max
              {' → Normalized: '}
              {formatNumber(creditRatingBreakdown.companyStability.normalizedProfitConsistency, { decimals: 3, forceDecimals: true })}
              {' ('}
              {formatNumber(creditRatingBreakdown.companyStability.normalizedProfitConsistency * 100, { decimals: 1, forceDecimals: true })}%
              {') × '}
              {formatNumber(CREDIT_RATING_WEIGHTS.stability_profitConsistency * 100, { decimals: 0 })}% weight
            </div>
            <div className="text-xs text-gray-400 italic">Based on profit variance over last 4 seasons (lower variance = higher score)</div>
          </div>
          
          {/* Expense Efficiency */}
          <div>
            <div className="font-medium">Expense Efficiency:</div>
            <div>
              Raw Score: {formatNumber(creditRatingBreakdown.companyStability.expenseEfficiency, { decimals: 4, forceDecimals: true })} / 0.02 max
              {' → Normalized: '}
              {formatNumber(creditRatingBreakdown.companyStability.normalizedExpenseEfficiency, { decimals: 3, forceDecimals: true })}
              {' ('}
              {formatNumber(creditRatingBreakdown.companyStability.normalizedExpenseEfficiency * 100, { decimals: 1, forceDecimals: true })}%
              {') × '}
              {formatNumber(CREDIT_RATING_WEIGHTS.stability_expenseEfficiency * 100, { decimals: 0 })}% weight
            </div>
            <div className="text-xs text-gray-400 italic">Based on expense ratio (lower expenses relative to revenue = higher score)</div>
          </div>
          
          <div className="pt-1 border-t border-gray-600 mt-1 font-semibold">
            Company Stability Score: {' '}
            ({formatNumber(creditRatingBreakdown.companyStability.normalizedAge * 100, { decimals: 1 })}% × {formatNumber(CREDIT_RATING_WEIGHTS.stability_age * 100, { decimals: 0 })}%) + {' '}
            ({formatNumber(creditRatingBreakdown.companyStability.normalizedProfitConsistency * 100, { decimals: 1 })}% × {formatNumber(CREDIT_RATING_WEIGHTS.stability_profitConsistency * 100, { decimals: 0 })}%) + {' '}
            ({formatNumber(creditRatingBreakdown.companyStability.normalizedExpenseEfficiency * 100, { decimals: 1 })}% × {formatNumber(CREDIT_RATING_WEIGHTS.stability_expenseEfficiency * 100, { decimals: 0 })}%) = {' '}
            {formatNumber(creditRatingBreakdown.companyStability.score * 100, { decimals: 1, forceDecimals: true })}%
          </div>
        </div>
      </div>
      
      {/* Final Calculation */}
      <div className="border-t border-gray-600 pt-2 bg-gray-800 rounded p-2">
        <div className="font-semibold mb-1">Final Stability Score:</div>
        <div>
          ({formatNumber((creditRatingBreakdown.assetHealth.score / 0.20) * 100, { decimals: 1 })}% × 60%) + {' '}
          ({formatNumber((creditRatingBreakdown.companyStability.score / 0.10) * 100, { decimals: 1 })}% × 40%) = {' '}
          <span className="font-bold">
            {formatNumber(finalStabilityScore * 100, { decimals: 1, forceDecimals: true })}%
          </span>
        </div>
        <div className="text-xs text-gray-400 italic mt-1">Note: Asset Health and Company Stability scores are already normalized to 0-1 for final calculation</div>
      </div>
    </div>
  );
}

export function BoardRoomPanel() {
  const gameState = useGameState();
  const [breakdown, setBreakdown] = useState<BoardSatisfactionBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [satisfactionHistory, setSatisfactionHistory] = useState<Array<{
    period: string;
    satisfaction: number;
    performance: number;
    stability: number;
    consistency: number;
    ownership: number;
  }>>([]);
  const [consistencyHistory, setConsistencyHistory] = useState<Array<{
    period: string;
    satisfaction: number;
  }>>([]);
  const [activeConstraints, setActiveConstraints] = useState<Array<{
    type: BoardConstraintType;
    constraint: typeof BOARD_CONSTRAINTS[BoardConstraintType];
    status: 'none' | 'warning' | 'blocked';
    limit?: number;
  }>>([]);
  const [shareholderBreakdown, setShareholderBreakdown] = useState<{
    playerShares: number;
    familyShares: number;
    outsideShares: number;
    playerPct: number;
    familyPct: number;
    outsidePct: number;
    nonPlayerOwnershipPct: number;
  } | null>(null);
  const [creditRatingBreakdown, setCreditRatingBreakdown] = useState<{
    assetHealth: CreditRatingBreakdown['assetHealth'];
    companyStability: CreditRatingBreakdown['companyStability'];
  } | null>(null);
  const [effectiveSatisfaction, setEffectiveSatisfaction] = useState<number | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [shareData, setShareData] = useState<{
    totalShares: number;
    outstandingShares: number;
    sharePrice: number;
    dividendRate: number;
  } | null>(null);
  const [dividendLimits, setDividendLimits] = useState<{ min: number; max: number } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const perfStart = performance.now();
      console.log('[BoardRoomPanel] Starting data load...');
      
      try {
        setLoading(true);
        const companyId = getCurrentCompanyId();
        if (!companyId) {
          setLoading(false);
          return;
        }

        // OPTIMIZATION: Load independent data in parallel (Phase 1)
        console.time('[BoardRoomPanel] Phase 1 - Parallel data load');
        const [
          satisfactionBreakdown,
          shareholderData,
          history48Weeks,
          history12Weeks,
          financialData,
          sharesData,
          creditRating,
          yearlyOps
        ] = await Promise.all([
          getBoardSatisfactionBreakdown().then(r => { console.timeLog('[BoardRoomPanel] Phase 1 - Parallel data load', 'getBoardSatisfactionBreakdown'); return r; }),
          getShareholderBreakdown().then(r => { console.timeLog('[BoardRoomPanel] Phase 1 - Parallel data load', 'getShareholderBreakdown'); return r; }),
          getBoardSatisfactionHistory(companyId, 48).then(r => { console.timeLog('[BoardRoomPanel] Phase 1 - Parallel data load', 'getBoardSatisfactionHistory(48)'); return r; }),
          getBoardSatisfactionHistory(companyId, 12).then(r => { console.timeLog('[BoardRoomPanel] Phase 1 - Parallel data load', 'getBoardSatisfactionHistory(12)'); return r; }),
          calculateFinancialData('year').then(r => { console.timeLog('[BoardRoomPanel] Phase 1 - Parallel data load', 'calculateFinancialData'); return r; }),
          getCompanyShares(companyId).then(r => { console.timeLog('[BoardRoomPanel] Phase 1 - Parallel data load', 'getCompanyShares'); return r; }),
          calculateCreditRating().then(r => { console.timeLog('[BoardRoomPanel] Phase 1 - Parallel data load', 'calculateCreditRating'); return r; }),
          getYearlyShareOperations(companyId).then(r => { console.timeLog('[BoardRoomPanel] Phase 1 - Parallel data load', 'getYearlyShareOperations'); return r; })
        ]);
        console.timeEnd('[BoardRoomPanel] Phase 1 - Parallel data load');

        // Set early state updates for UI responsiveness
        setBreakdown(satisfactionBreakdown);
        setShareholderBreakdown(shareholderData);
        setCreditRatingBreakdown({
          assetHealth: creditRating.assetHealth,
          companyStability: creditRating.companyStability
        });

        // Process historical data
        const historyData = history48Weeks.map(snapshot => ({
          period: `W${snapshot.week} ${snapshot.season.substring(0, 3)} ${snapshot.year}`,
          satisfaction: snapshot.satisfactionScore,
          performance: snapshot.performanceScore,
          stability: snapshot.stabilityScore,
          consistency: snapshot.consistencyScore,
          ownership: 1 - snapshot.ownershipPressure
        }));
        setSatisfactionHistory(historyData);

        const consistencyHistoryData = history12Weeks.map(s => ({
          period: `W${s.week} ${s.season.substring(0, 3)} ${s.year}`,
          satisfaction: s.satisfactionScore
        }));
        setConsistencyHistory(consistencyHistoryData);

        // Calculate effective satisfaction
        const rawSatisfaction = satisfactionBreakdown.satisfaction;
        const nonPlayerOwnershipPct = shareholderData.nonPlayerOwnershipPct / 100;
        const effectiveSatisfactionValue = rawSatisfaction * (1 - nonPlayerOwnershipPct);
        setEffectiveSatisfaction(effectiveSatisfactionValue);

        const balance = financialData.cashMoney;
        setCurrentBalance(balance);

        // OPTIMIZATION: Load dependent data in parallel (Phase 2)
        // Market value update and share metrics can be parallel
        console.time('[BoardRoomPanel] Phase 2 - Dependent data');
        const [marketValueUpdate, shareMetrics, totalDebt] = await Promise.all([
          updateMarketValue().then(() => { console.timeLog('[BoardRoomPanel] Phase 2 - Dependent data', 'updateMarketValue'); return getMarketValue(); }),
          getShareMetrics().then(r => { console.timeLog('[BoardRoomPanel] Phase 2 - Dependent data', 'getShareMetrics'); return r; }),
          calculateTotalOutstandingLoans().then(r => { console.timeLog('[BoardRoomPanel] Phase 2 - Dependent data', 'calculateTotalOutstandingLoans'); return r; })
        ]);
        console.timeEnd('[BoardRoomPanel] Phase 2 - Dependent data');

        // Set share data
        if (sharesData) {
          setShareData({
            totalShares: sharesData.totalShares,
            outstandingShares: sharesData.outstandingShares,
            sharePrice: marketValueUpdate.sharePrice,
            dividendRate: sharesData.dividendRate
          });
        }

        // Calculate debt ratio
        const debtRatio = financialData.totalAssets > 0 
          ? totalDebt / financialData.totalAssets 
          : 0;

        // OPTIMIZATION: Load dividend limits in parallel with constraint preparation
        console.time('[BoardRoomPanel] getDividendRateLimits');
        const divLimitsPromise = getDividendRateLimits();
        console.timeEnd('[BoardRoomPanel] getDividendRateLimits');

        // Prepare financial context for constraints (reuse already loaded data)
        const sharesForContext = sharesData;
        const marketDataForContext = marketValueUpdate;
        const financialDataForContext = financialData;
        const shareMetricsForContext = shareMetrics;
        const sharesIssuedThisYear = yearlyOps.sharesIssuedThisYear;
        const sharesBoughtBackThisYear = yearlyOps.sharesBoughtBackThisYear;

        // Set dividend limits
        const divLimits = await divLimitsPromise;
        setDividendLimits(divLimits);

        // OPTIMIZATION: Batch constraint limit checks in parallel
        console.time('[BoardRoomPanel] Phase 3 - Constraint limit checks');
        const constraints: typeof activeConstraints = [];
        const constraintLimitPromises: Promise<{ type: BoardConstraintType; limit: number | null }>[] = [];

        for (const [type, constraint] of Object.entries(BOARD_CONSTRAINTS)) {
          const constraintType = type as BoardConstraintType;
          let status: 'none' | 'warning' | 'blocked' = 'none';

          // Use effective satisfaction for constraint checks
          if (effectiveSatisfactionValue <= constraint.maxThreshold) {
            status = 'blocked';
          } else if (effectiveSatisfactionValue <= constraint.startThreshold) {
            status = 'warning';
          }

          // For scaling constraints, prepare context and batch limit checks
          if (constraint.scalingFormula) {
            let contextValue: any = balance;
            let financialContext: any = undefined;
            
            if (type === 'share_issuance') {
              contextValue = sharesForContext?.totalShares || 0;
              financialContext = {
                outstandingShares: sharesForContext?.outstandingShares || 0,
                totalShares: sharesForContext?.totalShares || 0,
                sharePrice: marketDataForContext.sharePrice,
                cashMoney: balance,
                totalAssets: financialDataForContext.totalAssets,
                debtRatio: debtRatio,
                sharesIssuedThisYear: sharesIssuedThisYear
              };
            } else if (type === 'share_buyback') {
              contextValue = sharesForContext?.outstandingShares || 0;
              financialContext = {
                outstandingShares: sharesForContext?.outstandingShares || 0,
                totalShares: sharesForContext?.totalShares || 0,
                sharePrice: marketDataForContext.sharePrice,
                cashMoney: balance,
                totalAssets: financialDataForContext.totalAssets,
                debtRatio: debtRatio,
                sharesBoughtBackThisYear: sharesBoughtBackThisYear
              };
            } else if (type === 'dividend_change') {
              contextValue = sharesForContext?.dividendRate || 0;
              financialContext = {
                cashMoney: balance,
                totalShares: sharesForContext?.totalShares || 0,
                oldRate: sharesForContext?.dividendRate || 0,
                profitMargin: shareMetricsForContext.profitMargin || 0
              };
            } else if (type === 'vineyard_purchase') {
              contextValue = balance;
              financialContext = {
                cashMoney: balance,
                totalAssets: financialDataForContext.totalAssets,
                fixedAssets: financialDataForContext.fixedAssets,
                currentAssets: financialDataForContext.currentAssets,
                expensesPerSeason: financialDataForContext.expenses,
                profitMargin: shareMetricsForContext.profitMargin || 0
              };
            }

            // Batch limit checks
            constraintLimitPromises.push(
              boardEnforcer.getActionLimit(constraintType, contextValue, financialContext)
                .then(result => {
                  console.timeLog('[BoardRoomPanel] Phase 3 - Constraint limit checks', `getActionLimit(${constraintType})`);
                  return {
                    type: constraintType,
                    limit: result?.limit ?? null
                  };
                })
            );
          }

          constraints.push({
            type: constraintType,
            constraint,
            status,
            limit: undefined // Will be set after parallel checks complete
          });
        }

        // Wait for all constraint limit checks to complete
        const limitResults = await Promise.all(constraintLimitPromises);
        console.timeEnd('[BoardRoomPanel] Phase 3 - Constraint limit checks');
        const limitMap = new Map(limitResults.map(r => [r.type, r.limit]));

        // Update constraints with limits
        const constraintsWithLimits = constraints.map(c => ({
          ...c,
          limit: limitMap.get(c.type) ?? c.limit
        }));

        setActiveConstraints(constraintsWithLimits);
        
        const perfEnd = performance.now();
        console.log(`[BoardRoomPanel] Total load time: ${(perfEnd - perfStart).toFixed(2)}ms`);
      } catch (error) {
        console.error('Error loading board room data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [gameState.week, gameState.season, gameState.money, gameState.prestige]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading board data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!breakdown) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">No board data available</div>
        </CardContent>
      </Card>
    );
  }

  // If 100% player owned, show message
  if (breakdown.playerOwnershipPct >= 100) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Board Room</CardTitle>
          <CardDescription>Company governance and board oversight</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center">
            <div className="text-green-800 font-semibold mb-2">✓ Full Company Control</div>
            <div className="text-green-700 text-sm">
              Your company is 100% player-owned. Board constraints do not apply.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get satisfaction color and label using global utilities
  const satisfactionColorInfo = getRangeColor(breakdown.satisfaction, 0, 1, 'higher_better');
  
  // Get satisfaction label based on score
  const getSatisfactionLabel = (score: number): string => {
    if (score >= 0.7) return 'Satisfied';
    if (score >= 0.5) return 'Moderate';
    if (score >= 0.3) return 'Concerned';
    return 'Dissatisfied';
  };

  const satisfactionColor = satisfactionColorInfo.text;
  const satisfactionLabel = getSatisfactionLabel(breakdown.satisfaction);

  // Prepare pie chart data for ownership breakdown
  const pieChartData = shareholderBreakdown ? [
    { name: 'Player', value: shareholderBreakdown.playerShares, pct: shareholderBreakdown.playerPct, color: '#3b82f6' },
    { name: 'Family', value: shareholderBreakdown.familyShares, pct: shareholderBreakdown.familyPct, color: '#10b981' },
    { name: 'Public Investors', value: shareholderBreakdown.outsideShares, pct: shareholderBreakdown.outsidePct, color: '#f97316' }
  ].filter(item => item.value > 0) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Board Room</CardTitle>
        <CardDescription>
          Board of Directors oversight and constraints for public companies
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="overview">Board Overview</TabsTrigger>
            <TabsTrigger value="constraints">Active Constraints</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* Board Satisfaction Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SimpleCard title="Board Satisfaction">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">Overall Satisfaction</div>
                    <div className={`font-bold text-2xl ${satisfactionColor}`}>
                      {formatNumber(breakdown.satisfaction * 100, { decimals: 1, forceDecimals: true })}%
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    Status: <span className={`font-semibold ${satisfactionColor}`}>{satisfactionLabel}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div 
                      className={`h-4 rounded-full transition-all ${
                        breakdown.satisfaction >= 0.7 ? 'bg-green-500' :
                        breakdown.satisfaction >= 0.5 ? 'bg-yellow-500' :
                        breakdown.satisfaction >= 0.3 ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${breakdown.satisfaction * 100}%` }}
                    ></div>
                  </div>
                  {/* Calculation breakdown */}
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <div className="text-xs text-gray-600 mb-1 font-semibold">Satisfaction Calculation (Weighted Average):</div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <div>Performance ({formatNumber(BOARD_SATISFACTION_WEIGHTS.performanceScore * 100, { decimals: 0 })}%): {formatNumber(breakdown.performanceScore * 100, { decimals: 1 })}%</div>
                      <div>Stability ({formatNumber(BOARD_SATISFACTION_WEIGHTS.stabilityScore * 100, { decimals: 0 })}%): {formatNumber(breakdown.stabilityScore * 100, { decimals: 1 })}%</div>
                      <div>Consistency ({formatNumber(BOARD_SATISFACTION_WEIGHTS.consistencyScore * 100, { decimals: 0 })}%): {formatNumber(breakdown.consistencyScore * 100, { decimals: 1 })}%</div>
                    </div>
                  </div>
                </div>
              </SimpleCard>

              <SimpleCard title="Ownership Breakdown">
                {shareholderBreakdown && pieChartData.length > 0 ? (
                  <div className="space-y-3">
                    <div className="h-40 w-full" style={{ minHeight: '160px' }}>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry: any) => `${entry.name}: ${formatNumber(entry.pct, { decimals: 1 })}%`}
                            outerRadius={60}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value: number, _name: string, props: any) => [
                              `${formatNumber(value, { decimals: 0 })} shares (${formatNumber(props.payload.pct, { decimals: 1 })}%)`,
                              props.payload.name
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2 text-xs">
                      {pieChartData.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }}></div>
                          <div className="flex-1">
                            <div className="font-semibold text-xs">{item.name}</div>
                            <div className="text-gray-600">
                              {formatNumber(item.value, { decimals: 0 })} shares ({formatNumber(item.pct, { decimals: 1 })}%)
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Higher non-player ownership (family + public investors) increases board influence and constraints
                    </div>
                  </div>
                ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Player Ownership:</span>
                    <span className="font-semibold text-blue-600">
                      {formatNumber(breakdown.playerOwnershipPct, { decimals: 2, forceDecimals: true })}%
                    </span>
                  </div>
                    {shareholderBreakdown ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Family Ownership:</span>
                          <span className="font-semibold text-green-600">
                            {formatNumber(shareholderBreakdown.familyPct, { decimals: 2, forceDecimals: true })}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Public Investors:</span>
                          <span className="font-semibold text-orange-600">
                            {formatNumber(shareholderBreakdown.outsidePct, { decimals: 2, forceDecimals: true })}%
                          </span>
                        </div>
                      </>
                    ) : (
                  <div className="flex justify-between">
                        <span className="text-gray-600">Non-Player Ownership:</span>
                    <span className="font-semibold text-orange-600">
                      {formatNumber(100 - breakdown.playerOwnershipPct, { decimals: 2, forceDecimals: true })}%
                    </span>
                  </div>
                    )}
                  <div className="text-xs text-gray-500 mt-2">
                      Higher non-player ownership (family + public investors) increases board influence and constraints
                  </div>
                </div>
                )}
              </SimpleCard>
            </div>

            {/* Satisfaction Components */}
            <SimpleCard title="Satisfaction Components">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Performance Score</div>
                  <div className={`font-semibold text-lg ${getRangeColor(breakdown.performanceScore, 0, 1, 'higher_better').text}`}>
                    {formatNumber(breakdown.performanceScore * 100, { decimals: 1, forceDecimals: true })}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Weight: {formatNumber(BOARD_SATISFACTION_WEIGHTS.performanceScore * 100, { decimals: 0 })}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Based on metric performance vs. expectations
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Stability Score</div>
                  <div className={`font-semibold text-lg ${getRangeColor(breakdown.stabilityScore, 0, 1, 'higher_better').text}`}>
                    {formatNumber(breakdown.stabilityScore * 100, { decimals: 1, forceDecimals: true })}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Weight: {formatNumber(BOARD_SATISFACTION_WEIGHTS.stabilityScore * 100, { decimals: 0 })}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Cash ratio, debt ratio, asset health
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Consistency Score</div>
                  <div className={`font-semibold text-lg ${getRangeColor(breakdown.consistencyScore, 0, 1, 'higher_better').text}`}>
                    {formatNumber(breakdown.consistencyScore * 100, { decimals: 1, forceDecimals: true })}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Weight: {formatNumber(BOARD_SATISFACTION_WEIGHTS.consistencyScore * 100, { decimals: 0 })}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Historical performance volatility
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Ownership Impact</div>
                  {shareholderBreakdown && shareholderBreakdown.nonPlayerOwnershipPct > 0 ? (
                    <>
                      <div className="font-semibold text-lg text-gray-900">
                        {formatNumber(shareholderBreakdown.nonPlayerOwnershipPct, { decimals: 1, forceDecimals: true })}% Non-Player
                      </div>
                      <div className="text-xs text-gray-500">
                        Family: {formatNumber(shareholderBreakdown.familyPct, { decimals: 1 })}% • Public: {formatNumber(shareholderBreakdown.outsidePct, { decimals: 1 })}%
                      </div>
                      <div className="text-xs text-gray-500">
                        Effective Satisfaction: {formatNumber(breakdown.satisfaction * (1 - shareholderBreakdown.nonPlayerOwnershipPct / 100) * 100, { decimals: 1 })}%
                      </div>
                      <div className="text-xs text-gray-500">
                        Constraints use: Satisfaction × (1 - Non-Player Ownership %)
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold text-lg text-green-600">100% Player Owned</div>
                      <div className="text-xs text-gray-500">
                        No board constraints apply
                      </div>
                    </>
                  )}
                </div>
              </div>
            </SimpleCard>

            {/* Historical Trend */}
            {satisfactionHistory.length > 0 && (
              <SimpleCard title="Satisfaction Trend (Last 48 Weeks)">
                <div className="text-xs text-gray-500 mb-2">
                  Note: Historical data shows raw satisfaction scores. Constraints use effective satisfaction (satisfaction × non-player ownership %).
                </div>
                <div className="w-full" style={{ height: '256px' }}>
                  <ResponsiveContainer width="100%" height={256}>
                    <LineChart data={satisfactionHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => formatNumber(value * 100, { decimals: 0 })} 
                        domain={[0, 1]}
                      />
                      <RechartsTooltip
                        formatter={(value: number) => [
                          formatNumber(value * 100, { decimals: 1, forceDecimals: true }) + '%',
                          ''
                        ]}
                        labelFormatter={(label) => `Period: ${label}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="satisfaction" 
                        stroke="#3b82f6" 
                        strokeWidth={3} 
                        strokeDasharray="5 5"
                        dot={false}
                        name="Satisfaction (Raw - Independent of Ownership)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="performance" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        dot={false}
                        name="Performance"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="stability" 
                        stroke="#f59e0b" 
                        strokeWidth={2} 
                        dot={false}
                        name="Stability"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="consistency" 
                        stroke="#8b5cf6" 
                        strokeWidth={2} 
                        dot={false}
                        name="Consistency"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="ownership" 
                        stroke="#ec4899" 
                        strokeWidth={2} 
                        dot={false}
                        name="Ownership Factor"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SimpleCard>
            )}

            {/* Detailed Metrics - Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SimpleCard title="Performance Metrics Details">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-gray-600 mb-1">Earnings/Share Delta</div>
                  <div className={`font-semibold ${(breakdown.details.performanceMetrics.earningsPerShare || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(breakdown.details.performanceMetrics.earningsPerShare || 0, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: false })}
                  </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Actual vs. expected improvement
                    </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Revenue/Share Delta</div>
                  <div className={`font-semibold ${(breakdown.details.performanceMetrics.revenuePerShare || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(breakdown.details.performanceMetrics.revenuePerShare || 0, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: false })}
                  </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Actual vs. expected improvement
                    </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Profit Margin Delta</div>
                  <div className={`font-semibold ${(breakdown.details.performanceMetrics.profitMargin || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(breakdown.details.performanceMetrics.profitMargin || 0, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: false })}
                  </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Actual vs. expected improvement
                    </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Revenue Growth Delta</div>
                  <div className={`font-semibold ${(breakdown.details.performanceMetrics.revenueGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(breakdown.details.performanceMetrics.revenueGrowth || 0, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: false })}
                  </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Actual vs. expected improvement
                    </div>
                </div>
              </div>
            </SimpleCard>

            <SimpleCard title="Stability Metrics Details">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-gray-600 mb-1">Cash Ratio</div>
                  <div className="font-semibold text-gray-900">
                        {formatNumber(breakdown.details.stabilityMetrics.cashRatio, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: true })}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Cash / Total Assets
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        Target: 10-30% (higher is better)
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Debt Ratio</div>
                  <div className="font-semibold text-gray-900">
                        {formatNumber(breakdown.details.stabilityMetrics.debtRatio, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: true })}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Total Debt / Total Assets
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        Target: &lt;30% (lower is better)
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Fixed Asset Ratio</div>
                  <div className="font-semibold text-gray-900">
                        {formatNumber(breakdown.details.stabilityMetrics.fixedAssetRatio, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: true })}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Fixed Assets / Total Assets
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        Target: 40-70% (balanced)
                  </div>
                </div>
                  </div>
                  <div className="border-t border-gray-200 pt-3 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-600 font-semibold">Stability Score Calculation:</div>
                      {creditRatingBreakdown && (
                        <UnifiedTooltip
                          content={renderStabilityScoreTooltip(creditRatingBreakdown, breakdown.stabilityScore)}
                          title="Detailed Stability Score Breakdown"
                          variant="panel"
                          density="compact"
                          maxHeight="max-h-96"
                          scrollable
                        >
                          <button className="text-xs text-blue-600 hover:text-blue-800 underline">
                            View Detailed Calculation
                          </button>
                        </UnifiedTooltip>
                      )}
                    </div>
                    {creditRatingBreakdown ? (
                      <div className="text-xs space-y-2">
                        <div className="text-gray-500">
                          Asset Health: {formatNumber(creditRatingBreakdown.assetHealth.score * 100, { decimals: 1, forceDecimals: true })}% (60% weight) • 
                          Company Stability: {formatNumber(creditRatingBreakdown.companyStability.score * 100, { decimals: 1, forceDecimals: true })}% (40% weight)
                        </div>
                        <div className="font-semibold text-gray-700">
                          Final Stability Score: {formatNumber(breakdown.stabilityScore * 100, { decimals: 1, forceDecimals: true })}%
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        Loading calculation details...
                      </div>
                    )}
                  </div>
                </div>
              </SimpleCard>
            </div>

            <SimpleCard title="Consistency Score Details">
              <div className="space-y-3">
                <div className="text-xs">
                  <div className="text-gray-600 mb-2 font-semibold">Consistency Score: {formatNumber(breakdown.consistencyScore * 100, { decimals: 1, forceDecimals: true })}%</div>
                  <div className="text-gray-500 mb-3">
                    Based on historical satisfaction score volatility over the last 12 weeks. 
                    Lower volatility indicates more consistent performance, which increases board confidence.
                  </div>
                </div>
                {consistencyHistory.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-600 font-semibold mb-2">Historical Satisfaction Scores (Last 12 Weeks):</div>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                      {consistencyHistory.slice().reverse().map((entry, idx) => (
                        <div key={idx} className="border border-gray-200 rounded p-1.5 bg-gray-50">
                          <div className="text-gray-500 text-xs mb-0.5">{entry.period}</div>
                          <div className={`font-semibold ${getRangeColor(entry.satisfaction, 0, 1, 'higher_better').text}`}>
                            {formatNumber(entry.satisfaction * 100, { decimals: 1, forceDecimals: true })}%
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Consistency measures how stable these satisfaction scores are over time. 
                      Large swings reduce consistency, steady performance increases it.
                    </div>
                  </div>
                )}
                {consistencyHistory.length === 0 && (
                  <div className="text-xs text-gray-500 italic">
                    Not enough historical data yet. Consistency score will be calculated once 4+ weeks of data are available.
                  </div>
                )}
              </div>
            </SimpleCard>
          </TabsContent>

          <TabsContent value="constraints" className="space-y-6 mt-0">
            {/* Effective Satisfaction Scale - Visual Reference */}
            {effectiveSatisfaction !== null && breakdown && shareholderBreakdown && shareholderBreakdown.nonPlayerOwnershipPct > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-blue-900 mb-1">
                      Effective Satisfaction (Used for All Constraints)
                    </div>
                    <div className="text-xs text-blue-700">
                      {formatNumber(breakdown.satisfaction * 100, { decimals: 1 })}% Satisfaction × (1 - {formatNumber(shareholderBreakdown.nonPlayerOwnershipPct, { decimals: 1 })}% Non-Player) ={' '}
                      <span className="font-bold text-blue-900">
                        {formatNumber(effectiveSatisfaction * 100, { decimals: 1, forceDecimals: true })}%
                      </span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-blue-700">
                    {formatNumber(effectiveSatisfaction * 100, { decimals: 1, forceDecimals: true })}%
                  </div>
                </div>
                
                {/* Visual Scale with Threshold Markers */}
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-4 relative overflow-visible">
                    {/* Satisfaction fill */}
                    <div
                      className={`h-4 rounded-full transition-all ${
                        effectiveSatisfaction <= 0.2
                          ? 'bg-red-500'
                          : effectiveSatisfaction <= 0.5
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min(effectiveSatisfaction * 100, 100)}%`,
                      }}
                    />
                    
                    {/* Threshold markers for all constraints */}
                    {activeConstraints.map(({ constraint }) => {
                      const startPos = constraint.startThreshold * 100;
                      const blockPos = constraint.maxThreshold * 100;
                      return (
                        <div key={constraint.type} className="contents">
                          <div
                            className="absolute top-0 w-0.5 h-4 bg-yellow-600 opacity-60"
                            style={{ left: `${startPos}%` }}
                            title={`${constraint.type.replace(/_/g, ' ')} starts limiting at ${formatNumber(startPos, { decimals: 0 })}%`}
                          />
                          <div
                            className="absolute top-0 w-0.5 h-4 bg-red-600 opacity-60"
                            style={{ left: `${blockPos}%` }}
                            title={`${constraint.type.replace(/_/g, ' ')} blocks at ${formatNumber(blockPos, { decimals: 0 })}%`}
                          />
                        </div>
                      );
                    })}
                    
                    {/* Current position indicator */}
                    <div
                      className="absolute top-0 w-1 h-4 bg-blue-900 border border-white rounded-full z-10"
                      style={{ left: `${Math.min(effectiveSatisfaction * 100, 100)}%`, marginLeft: '-2px' }}
                    />
                  </div>
                  
                  {/* Scale labels */}
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Constraints Grid - Scalable Layout */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Active Constraints ({activeConstraints.length})
                </h3>
                <div className="text-xs text-gray-500">
                  Constraints scale based on effective satisfaction and financial health
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeConstraints.map(({ type, constraint, status, limit }) => {
                  const isBlocked = status === 'blocked';
                  const isLimited = status === 'warning';
                  const constraintName = constraint.type
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (l) => l.toUpperCase());

                  // Calculate position on satisfaction scale
                  const satisfactionPos = effectiveSatisfaction !== null ? effectiveSatisfaction * 100 : 0;
                  const startPos = constraint.startThreshold * 100;
                  const blockPos = constraint.maxThreshold * 100;

                  return (
                    <div
                      key={type}
                      className={`border-2 rounded-lg p-4 transition-all ${
                        isBlocked
                          ? 'border-red-400 bg-red-50'
                          : isLimited
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-green-300 bg-green-50'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-gray-900 mb-1">
                            {constraintName}
                          </h4>
                          <div
                            className={`text-xs font-bold px-2 py-1 rounded inline-block ${
                              isBlocked
                                ? 'bg-red-600 text-white'
                                : isLimited
                                ? 'bg-yellow-600 text-white'
                                : 'bg-green-600 text-white'
                            }`}
                          >
                            {isBlocked ? 'BLOCKED' : isLimited ? 'LIMITED' : 'ALLOWED'}
                          </div>
                        </div>
                      </div>

                      {/* Visual Satisfaction Scale for This Constraint */}
                      <div className="mb-4">
                        <div className="text-xs text-gray-600 mb-1.5">
                          Constraint Thresholds
                        </div>
                        <div className="relative w-full bg-gray-200 rounded-full h-3">
                          {/* Zones */}
                          <div
                            className="absolute left-0 h-3 bg-red-200 rounded-l-full"
                            style={{ width: `${blockPos}%` }}
                          />
                          <div
                            className="absolute h-3 bg-yellow-200"
                            style={{ left: `${blockPos}%`, width: `${startPos - blockPos}%` }}
                          />
                          <div
                            className="absolute right-0 h-3 bg-green-200 rounded-r-full"
                            style={{ width: `${100 - startPos}%` }}
                          />
                          
                          {/* Threshold markers */}
                          <div
                            className="absolute top-0 w-0.5 h-3 bg-yellow-700"
                            style={{ left: `${startPos}%` }}
                            title={`Limits start at ${formatNumber(startPos, { decimals: 0 })}%`}
                          />
                          <div
                            className="absolute top-0 w-0.5 h-3 bg-red-700"
                            style={{ left: `${blockPos}%` }}
                            title={`Blocks at ${formatNumber(blockPos, { decimals: 0 })}%`}
                          />
                          
                          {/* Current position */}
                          {effectiveSatisfaction !== null && (
                            <div
                              className={`absolute top-0 w-1 h-3 border border-white rounded-full z-10 ${
                                satisfactionPos <= blockPos
                                  ? 'bg-red-600'
                                  : satisfactionPos <= startPos
                                  ? 'bg-yellow-600'
                                  : 'bg-green-600'
                              }`}
                              style={{ left: `${Math.min(satisfactionPos, 100)}%`, marginLeft: '-2px' }}
                            />
                          )}
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Block: {formatNumber(blockPos, { decimals: 0 })}%</span>
                          <span>Limit: {formatNumber(startPos, { decimals: 0 })}%</span>
                        </div>
                      </div>

                      {/* Current Limit (if scaling constraint) */}
                      {constraint.scalingFormula && (
                        <div className="mb-3 p-2 bg-white rounded border border-gray-200">
                          <div className="text-xs text-gray-600 mb-1">Current Limit</div>
                          {(() => {
                            // Display different values based on constraint type
                            if (type === 'share_issuance') {
                              // For share issuance: show max shares and value
                              if (limit !== undefined && limit !== null && shareData) {
                                const maxShares = Math.floor(limit);
                                const maxValue = maxShares * shareData.sharePrice;
                                return (
                                  <div className="space-y-1">
                                    <div className="text-lg font-bold text-gray-900">
                                      {formatNumber(maxShares, { decimals: 0 })} shares/year
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      ≈ {formatNumber(maxValue, { currency: true })} at {formatNumber(shareData.sharePrice, { currency: true })}/share
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                      of {formatNumber(shareData.totalShares, { decimals: 0 })} total shares
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="text-sm font-semibold text-green-700">
                                    No limit (above threshold)
                                  </div>
                                );
                              }
                            } else if (type === 'share_buyback') {
                              // For share buyback: show max shares and value
                              if (limit !== undefined && limit !== null && shareData) {
                                const maxShares = Math.floor(limit);
                                const maxValue = maxShares * shareData.sharePrice;
                                return (
                                  <div className="space-y-1">
                                    <div className="text-lg font-bold text-gray-900">
                                      {formatNumber(maxShares, { decimals: 0 })} shares/year
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      ≈ {formatNumber(maxValue, { currency: true })} at {formatNumber(shareData.sharePrice, { currency: true })}/share
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                      of {formatNumber(shareData.outstandingShares, { decimals: 0 })} outstanding shares
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="text-sm font-semibold text-green-700">
                                    No limit (above threshold)
                                  </div>
                                );
                              }
                            } else if (type === 'dividend_change') {
                              // For dividend change: show min/max rate
                              if (shareData && dividendLimits) {
                                return (
                                  <div className="space-y-1">
                                    <div className="text-sm font-semibold text-gray-900">
                                      Rate Range
                                    </div>
                                    <div className="text-xs text-gray-600 space-y-0.5">
                                      <div>
                                        Min: {formatNumber(dividendLimits.min, { currency: true, decimals: 4 })}/share
                                      </div>
                                      <div>
                                        Max: {formatNumber(dividendLimits.max, { currency: true, decimals: 4 })}/share
                                      </div>
                                      {shareData.dividendRate > 0 && (
                                        <div className="text-gray-500 mt-1">
                                          Current: {formatNumber(shareData.dividendRate, { currency: true, decimals: 4 })}/share
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="text-sm font-semibold text-green-700">
                                    {shareData ? 'No current dividend set' : 'Loading...'}
                                  </div>
                                );
                              }
                            } else {
                              // For other constraints (vineyard_purchase): show currency amount
                              if (limit !== undefined && limit !== null) {
                                return (
                                  <div className="space-y-1">
                                    <div className="text-lg font-bold text-gray-900">
                                      {formatNumber(limit, { currency: true })}
                                    </div>
                                    {currentBalance !== null && (
                                      <div className="text-xs text-gray-500">
                                        of {formatNumber(currentBalance, { currency: true })} available
                                      </div>
                                    )}
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="text-sm font-semibold text-green-700">
                                    No limit (above threshold)
                                  </div>
                                );
                              }
                            }
                          })()}
                        </div>
                      )}

                      {/* Scaling Formula Explanation */}
                      {constraint.scalingFormula && effectiveSatisfaction !== null && (
                        <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
                          <div className="text-xs font-semibold text-gray-700 mb-1">
                            How Limits Scale
                          </div>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            {type === 'vineyard_purchase' && (
                              <>
                                <div>Base: (1 - Satisfaction) × Balance</div>
                                <div className="text-gray-500">
                                  At {formatNumber(effectiveSatisfaction * 100, { decimals: 1 })}%: {formatNumber((1 - effectiveSatisfaction) * 100, { decimals: 1 })}% of balance
                                </div>
                                <div className="text-gray-500 mt-1">
                                  Also considers: Fixed asset ratio, liquidity, profit margin
                                </div>
                              </>
                            )}
                            {type === 'share_issuance' && (
                              <>
                                <div>Base: {formatNumber(0.2 * 100, { decimals: 0 })}% to {formatNumber(0.5 * 100, { decimals: 0 })}% of total shares/year</div>
                                <div className="text-gray-500">
                                  At {formatNumber(effectiveSatisfaction * 100, { decimals: 1 })}%: {formatNumber((0.2 + effectiveSatisfaction * 0.3) * 100, { decimals: 1 })}% max
                                </div>
                                <div className="text-gray-500 mt-1">
                                  Also considers: Share price (reduces if &lt;€0.50)
                                </div>
                              </>
                            )}
                            {type === 'share_buyback' && (
                              <>
                                <div>Base: {formatNumber(0.10 * 100, { decimals: 0 })}% to {formatNumber(0.25 * 100, { decimals: 0 })}% of outstanding shares/year</div>
                                <div className="text-gray-500">
                                  At {formatNumber(effectiveSatisfaction * 100, { decimals: 1 })}%: {formatNumber((0.10 + effectiveSatisfaction * 0.15) * 100, { decimals: 1 })}% max
                                </div>
                                <div className="text-gray-500 mt-1">
                                  Also considers: Debt ratio (20-30%), cash availability
                                </div>
                              </>
                            )}
                            {type === 'dividend_change' && (
                              <>
                                <div>Base: {formatNumber(0.03 * 100, { decimals: 0 })}% to {formatNumber(0.10 * 100, { decimals: 0 })}% change per season</div>
                                <div className="text-gray-500">
                                  At {formatNumber(effectiveSatisfaction * 100, { decimals: 1 })}%: ±{formatNumber((0.03 + effectiveSatisfaction * 0.07) * 100, { decimals: 1 })}% max
                                </div>
                                <div className="text-gray-500 mt-1">
                                  Also considers: Cash reserves, profit margin
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Status Message */}
                      {isBlocked && (
                        <div className="text-xs text-red-700 italic bg-red-100 p-2 rounded border border-red-200">
                          {constraint.message}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
