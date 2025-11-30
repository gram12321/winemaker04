import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/shadCN/card';
import { Tabs, TabsList, TabsTrigger, TabsContent, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui';
import { formatNumber, getRangeColor } from '@/lib/utils';
import { useGameState } from '@/hooks';
import { 
  getBoardSatisfactionBreakdown,
  boardEnforcer,
  getShareholderBreakdown,
  calculateFinancialData,
  calculateCreditRating,
  type BoardSatisfactionBreakdown,
  type CreditRatingBreakdown
} from '@/lib/services';
import { getCurrentCompanyId } from '@/lib/utils';
import { 
  BOARD_CONSTRAINTS, 
  BOARD_SATISFACTION_WEIGHTS, 
  CREDIT_RATING_WEIGHTS,
  type BoardConstraintType 
} from '@/lib/constants';
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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const companyId = getCurrentCompanyId();
        if (!companyId) {
          setLoading(false);
          return;
        }

        // Load board satisfaction breakdown (uses current company)
        const satisfactionBreakdown = await getBoardSatisfactionBreakdown();
        setBreakdown(satisfactionBreakdown);

        // Load shareholder breakdown for pie chart
        const shareholderData = await getShareholderBreakdown();
        setShareholderBreakdown(shareholderData);

        // Load historical satisfaction data
        const history = await getBoardSatisfactionHistory(companyId, 48); // Last 48 weeks
        const historyData = history.map(snapshot => ({
          period: `W${snapshot.week} ${snapshot.season.substring(0, 3)} ${snapshot.year}`,
          satisfaction: snapshot.satisfactionScore,
          performance: snapshot.performanceScore,
          stability: snapshot.stabilityScore,
          consistency: snapshot.consistencyScore,
          ownership: 1 - snapshot.ownershipPressure // Convert ownership pressure to ownership factor
        }));
        setSatisfactionHistory(historyData);

        // Load consistency history (last 12 weeks for details)
        const consistencyHistory = await getBoardSatisfactionHistory(companyId, 12);
        setConsistencyHistory(consistencyHistory.map(s => ({
          period: `W${s.week} ${s.season.substring(0, 3)} ${s.year}`,
          satisfaction: s.satisfactionScore
        })));

        // Get current company balance for scaling constraint calculations
        const financialData = await calculateFinancialData('year');
        const balance = financialData.cashMoney;
        setCurrentBalance(balance);

        // Get credit rating breakdown for stability score details
        const creditRating = await calculateCreditRating();
        setCreditRatingBreakdown({
          assetHealth: creditRating.assetHealth,
          companyStability: creditRating.companyStability
        });

        // Check constraint statuses
        // Use effective satisfaction (satisfaction × nonPlayerOwnership%) for constraint checks
        // Non-player ownership includes both family and public investors
        const rawSatisfaction = satisfactionBreakdown.satisfaction;
        const nonPlayerOwnershipPct = shareholderData.nonPlayerOwnershipPct / 100; // Convert to 0-1
        const effectiveSatisfactionValue = rawSatisfaction * nonPlayerOwnershipPct;
        setEffectiveSatisfaction(effectiveSatisfactionValue);
        
        const constraints: typeof activeConstraints = [];
        
        for (const [type, constraint] of Object.entries(BOARD_CONSTRAINTS)) {
          const constraintType = type as BoardConstraintType;
          let status: 'none' | 'warning' | 'blocked' = 'none';
          let limit: number | undefined = undefined;

          // Use effective satisfaction for constraint checks
          if (effectiveSatisfactionValue <= constraint.maxThreshold) {
            status = 'blocked';
          } else if (effectiveSatisfactionValue <= constraint.startThreshold) {
            status = 'warning';
          }

          // For scaling constraints, always get the limit to display (even when blocked)
          if (constraint.scalingFormula) {
            const limitResult = await boardEnforcer.getActionLimit(constraintType, balance);
            if (limitResult) {
              limit = limitResult.limit ?? undefined;
            }
          }

          constraints.push({
            type: constraintType,
            constraint,
            status,
            limit
          });
        }

        setActiveConstraints(constraints);
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
                    {shareholderBreakdown && shareholderBreakdown.nonPlayerOwnershipPct > 0 && (
                      <div className="text-xs text-gray-500 space-y-0.5 mt-2 pt-2 border-t border-gray-200">
                        <div className="text-gray-600 font-semibold mb-1">Effective Satisfaction (for Constraints):</div>
                        <div>
                          {formatNumber(breakdown.satisfaction * 100, { decimals: 1 })}% × {formatNumber(shareholderBreakdown.nonPlayerOwnershipPct, { decimals: 1 })}% (Non-Player Ownership: Family + Public Investors) ={' '}
                          <span className="font-semibold text-blue-600">
                            {formatNumber(breakdown.satisfaction * (shareholderBreakdown.nonPlayerOwnershipPct / 100) * 100, { decimals: 1 })}%
                          </span>
                        </div>
                        <div className="text-gray-400 italic mt-1">
                          Constraints are applied based on effective satisfaction, not raw satisfaction. Non-player ownership includes both family and public investors.
                        </div>
                      </div>
                    )}
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
                        Effective Satisfaction: {formatNumber(breakdown.satisfaction * (shareholderBreakdown.nonPlayerOwnershipPct / 100) * 100, { decimals: 1 })}%
                      </div>
                      <div className="text-xs text-gray-500">
                        Constraints use: Satisfaction × Non-Player Ownership %
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

          <TabsContent value="constraints" className="space-y-4 mt-0">
            {/* Effective Satisfaction Display with Visual Bar */}
            {effectiveSatisfaction !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="text-sm font-semibold text-blue-900 mb-2">
                  Effective Satisfaction (Used for Constraints)
                </div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="text-2xl font-bold text-blue-700">
                    {formatNumber(effectiveSatisfaction * 100, { decimals: 1, forceDecimals: true })}%
                  </div>
                  {/* Visual indicator bar */}
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-3 relative">
                      {/* Current satisfaction indicator */}
                      <div
                        className={`h-3 rounded-full transition-all ${
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
                    </div>
                  </div>
                </div>
                <div className="text-xs text-blue-600">
                  Constraints are evaluated using: Raw Satisfaction × Non-Player Ownership %
                </div>
              </div>
            )}

            {/* Constraints List - Compact Accordion */}
            <Accordion type="multiple" className="w-full space-y-2">
                {activeConstraints.map(({ type, constraint, status, limit }) => {
                  // Determine explicit status
                  const isBlocked = status === 'blocked';
                  const isLimited = status === 'warning';

                  // Format constraint name
                  const constraintName = constraint.type
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (l) => l.toUpperCase());

                  return (
                    <AccordionItem
                      key={type}
                      value={type}
                      className={`border rounded-md ${
                        isBlocked
                          ? 'border-red-300 bg-red-50'
                          : isLimited
                          ? 'border-yellow-300 bg-yellow-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <AccordionTrigger className="px-3 py-2 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="font-semibold text-xs text-gray-900">
                            {constraintName}
                          </div>
                          <div
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
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
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <div className="space-y-3 pt-2">
                          {/* Status Explanation */}
                          <div className="text-xs text-gray-700">
                            {isBlocked
                              ? 'This action is currently blocked by the board.'
                              : isLimited
                              ? 'This action is limited by the board.'
                              : 'This action is fully allowed without restrictions.'}
                          </div>

                          {/* Threshold Values */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-gray-500 mb-0.5">Start</div>
                              <div className="text-xs font-semibold text-gray-900">
                                {formatNumber(constraint.startThreshold * 100, {
                                  decimals: 0,
                                  forceDecimals: true,
                                })}
                                %
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-0.5">Block</div>
                              <div className="text-xs font-semibold text-gray-900">
                                {formatNumber(constraint.maxThreshold * 100, {
                                  decimals: 0,
                                  forceDecimals: true,
                                })}
                                %
                              </div>
                            </div>
                          </div>

                          {/* Limits/Restrictions (for scaling constraints) */}
                          {constraint.scalingFormula && (
                            <div className="pt-2 border-t border-gray-300">
                              <div className="text-xs text-gray-500 mb-1.5">Scaling Limit</div>
                              {limit !== undefined && limit !== null ? (
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-700">Limit:</span>
                                    <span className="text-xs font-semibold text-gray-900">
                                      {formatNumber(limit, { currency: true })}
                                    </span>
                                  </div>
                                  {currentBalance !== null && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-700">Balance:</span>
                                      <span className="text-xs text-gray-600">
                                        {formatNumber(currentBalance, { currency: true })}
                                      </span>
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-500 mt-1.5">
                                    (1 - Satisfaction) × Balance
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-600">
                                  No limit (above threshold)
                                </div>
                              )}
                            </div>
                          )}

                          {/* Constraint Message */}
                          {isBlocked && (
                            <div className="text-xs text-gray-600 italic pt-2 border-t border-gray-300">
                              {constraint.message}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
