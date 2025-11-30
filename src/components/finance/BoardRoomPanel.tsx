import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/shadCN/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { formatNumber, getRangeColor } from '@/lib/utils';
import { useGameState } from '@/hooks';
import { 
  getBoardSatisfactionBreakdown,
  boardEnforcer,
  type BoardSatisfactionBreakdown
} from '@/lib/services';
import { getCurrentCompanyId } from '@/lib/utils';
import { BOARD_CONSTRAINTS, type BoardConstraintType } from '@/lib/constants/boardConstants';
import { SimpleCard } from '@/components/ui';
import { getBoardSatisfactionHistory } from '@/lib/database';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

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
  }>>([]);
  const [activeConstraints, setActiveConstraints] = useState<Array<{
    type: BoardConstraintType;
    constraint: typeof BOARD_CONSTRAINTS[BoardConstraintType];
    status: 'none' | 'warning' | 'blocked';
    limit?: number;
  }>>([]);

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

        // Load historical satisfaction data
        const history = await getBoardSatisfactionHistory(companyId, 48); // Last 48 weeks
        const historyData = history.map(snapshot => ({
          period: `W${snapshot.week} ${snapshot.season.substring(0, 3)} ${snapshot.year}`,
          satisfaction: snapshot.satisfactionScore,
          performance: snapshot.performanceScore,
          stability: snapshot.stabilityScore,
          consistency: snapshot.consistencyScore
        }));
        setSatisfactionHistory(historyData);

        // Check constraint statuses
        const satisfaction = satisfactionBreakdown.satisfaction;
        const constraints: typeof activeConstraints = [];
        
        for (const [type, constraint] of Object.entries(BOARD_CONSTRAINTS)) {
          const constraintType = type as BoardConstraintType;
          let status: 'none' | 'warning' | 'blocked' = 'none';
          let limit: number | undefined = undefined;

          if (satisfaction <= constraint.maxThreshold) {
            status = 'blocked';
          } else if (satisfaction <= constraint.startThreshold) {
            status = 'warning';
            
            // For scaling constraints, get the limit
            if (constraint.scalingFormula) {
              // Get current balance for context (simplified - in real implementation would pass proper context)
              const limitResult = await boardEnforcer.getActionLimit(constraintType, 1000000, companyId);
              if (limitResult) {
                limit = limitResult.limit ?? undefined;
              }
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
                </div>
              </SimpleCard>

              <SimpleCard title="Ownership Breakdown">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Player Ownership:</span>
                    <span className="font-semibold text-blue-600">
                      {formatNumber(breakdown.playerOwnershipPct, { decimals: 2, forceDecimals: true })}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Outside Ownership:</span>
                    <span className="font-semibold text-orange-600">
                      {formatNumber(100 - breakdown.playerOwnershipPct, { decimals: 2, forceDecimals: true })}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Higher outside ownership increases board influence and constraints
                  </div>
                </div>
              </SimpleCard>
            </div>

            {/* Satisfaction Components */}
            <SimpleCard title="Satisfaction Components">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Performance Score</div>
                  <div className={`font-semibold text-lg ${getRangeColor(breakdown.performanceScore, 0, 1, 'higher_better').text}`}>
                    {formatNumber(breakdown.performanceScore * 100, { decimals: 1, forceDecimals: true })}%
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
                    Cash ratio, debt ratio, asset health
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Consistency Score</div>
                  <div className={`font-semibold text-lg ${getRangeColor(breakdown.consistencyScore, 0, 1, 'higher_better').text}`}>
                    {formatNumber(breakdown.consistencyScore * 100, { decimals: 1, forceDecimals: true })}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Historical performance volatility
                  </div>
                </div>
              </div>
            </SimpleCard>

            {/* Historical Trend */}
            {satisfactionHistory.length > 0 && (
              <SimpleCard title="Satisfaction Trend (Last 48 Weeks)">
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
                        strokeWidth={2} 
                        dot={false}
                        name="Satisfaction"
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
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SimpleCard>
            )}

            {/* Detailed Metrics */}
            <SimpleCard title="Performance Metrics Details">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-gray-600 mb-1">Earnings/Share Delta</div>
                  <div className={`font-semibold ${(breakdown.details.performanceMetrics.earningsPerShare || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(breakdown.details.performanceMetrics.earningsPerShare || 0, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: false })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Revenue/Share Delta</div>
                  <div className={`font-semibold ${(breakdown.details.performanceMetrics.revenuePerShare || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(breakdown.details.performanceMetrics.revenuePerShare || 0, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: false })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Profit Margin Delta</div>
                  <div className={`font-semibold ${(breakdown.details.performanceMetrics.profitMargin || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(breakdown.details.performanceMetrics.profitMargin || 0, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: false })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Revenue Growth Delta</div>
                  <div className={`font-semibold ${(breakdown.details.performanceMetrics.revenueGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(breakdown.details.performanceMetrics.revenueGrowth || 0, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: false })}
                  </div>
                </div>
              </div>
            </SimpleCard>

            <SimpleCard title="Stability Metrics Details">
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-gray-600 mb-1">Cash Ratio</div>
                  <div className="font-semibold text-gray-900">
                    {formatNumber(breakdown.details.stabilityMetrics.cashRatio * 100, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: true })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Debt Ratio</div>
                  <div className="font-semibold text-gray-900">
                    {formatNumber(breakdown.details.stabilityMetrics.debtRatio * 100, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: true })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Fixed Asset Ratio</div>
                  <div className="font-semibold text-gray-900">
                    {formatNumber(breakdown.details.stabilityMetrics.fixedAssetRatio * 100, { decimals: 2, forceDecimals: true, percent: true, percentIsDecimal: true })}
                  </div>
                </div>
              </div>
            </SimpleCard>
          </TabsContent>

          <TabsContent value="constraints" className="space-y-4 mt-0">
            <div className="space-y-3">
              {activeConstraints.map(({ type, constraint, status, limit }) => {
                const getStatusColor = () => {
                  if (status === 'blocked') return 'border-red-300 bg-red-50';
                  if (status === 'warning') return 'border-yellow-300 bg-yellow-50';
                  return 'border-gray-200 bg-gray-50';
                };

                const getStatusIcon = () => {
                  if (status === 'blocked') return '🚫';
                  if (status === 'warning') return '⚠️';
                  return '✓';
                };

                const getStatusText = () => {
                  if (status === 'blocked') return 'Blocked';
                  if (status === 'warning') return 'Limited';
                  return 'Allowed';
                };

                return (
                  <Card key={type} className={`border-2 ${getStatusColor()}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span>{getStatusIcon()}</span>
                          <span>{constraint.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                        </span>
                        <span className={`text-sm font-normal ${
                          status === 'blocked' ? 'text-red-600' :
                          status === 'warning' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {getStatusText()}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-2">
                        <div className="text-gray-700">
                          {constraint.message}
                        </div>
                        {limit !== undefined && (
                          <div className="text-xs text-gray-600">
                            <strong>Current Limit:</strong> {formatNumber(limit, { currency: true })}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Thresholds: Starts at {constraint.startThreshold * 100}% satisfaction, blocked at {constraint.maxThreshold * 100}% satisfaction
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
