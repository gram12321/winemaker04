import React from 'react';
import { WineLogEntry, WineBatch, Vineyard } from '@/lib/types/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from '../../ui';
import { Wine, TrendingUp, Award, BarChart3, MapPin, AlertTriangle } from 'lucide-react';
import { getColorClass, formatNumber, formatPercent, getGrapeQualityCategory } from '@/lib/utils/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/shadCN/tooltip';
import { calculateVineyardAnalytics } from '@/lib/services';

interface VineyardStatisticsTabProps {
  vineyards: Vineyard[];
  vineyardGroups: Record<string, WineLogEntry[]>;
  allBatches: WineBatch[];
}

const VineyardStatisticsTab: React.FC<VineyardStatisticsTabProps> = ({
  vineyards,
  vineyardGroups,
  allBatches
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {vineyards.map((vineyard) => {
        const vineyardEntries = vineyardGroups[vineyard.id] || [];
        const hasProduction = vineyardEntries.length > 0;
        
        if (!hasProduction) return null;

        // Calculate all analytics using service layer
        const analytics = calculateVineyardAnalytics(
          vineyard.id,
          vineyardEntries,
          vineyards,
          vineyardGroups,
          allBatches
        );

        return (
          <Card key={vineyard.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{vineyard.name}</CardTitle>
                  <CardDescription>{vineyard.region}, {vineyard.country}</CardDescription>
                </div>
                {analytics.totalVineyards > 1 && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    #{analytics.scoreRanking} of {analytics.totalVineyards}
                  </Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Production Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-purple-50 rounded-lg">
                  <div className="text-xl font-bold text-purple-900">{analytics.totalBottles}</div>
                  <div className="text-xs text-purple-600">Bottles</div>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-900">{vineyardEntries.length}</div>
                  <div className="text-xs text-blue-600">Vintages</div>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <div className="text-xl font-bold text-green-900">{formatNumber(analytics.totalRevenue, { currency: true, decimals: 0 })}</div>
                  <div className="text-xs text-green-600">Revenue</div>
                </div>
              </div>
              
              {/* Terroir Profile */}
              <div className="border-t pt-3">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Terroir Profile
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Soil:</span>
                    <span className="font-medium">{vineyard.soil.join(', ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Altitude:</span>
                    <span className="font-medium">{vineyard.altitude}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Aspect:</span>
                    <span className="font-medium">{vineyard.aspect}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vine Age:</span>
                    <span className="font-medium">{vineyard.vineAge || 0} years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Health:</span>
                    <span className={`font-medium ${getColorClass(vineyard.vineyardHealth)}`}>
                      {formatNumber(vineyard.vineyardHealth * 100, { decimals: 0 })}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Prestige:</span>
                    <span className="font-medium">{formatNumber(vineyard.vineyardPrestige, { decimals: 1 })}</span>
                  </div>
                </div>
              </div>
              
              {/* Score Metrics */}
              <div className="border-t pt-3">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" /> Score Metrics
                </h4>
                <div className="space-y-2">
                  {/* Wine Score Evolution Chart (Simple Bar Visualization) */}
                  {analytics.yearlyScores.length > 1 && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-1">Wine Score Evolution by Year</div>
                      <div className="flex items-end gap-1 h-16">
                        {analytics.yearlyScores.map((yearData, i) => {
                          const height = yearData.avgScore * 100;
                          const isFirst = i === 0;
                          const isLast = i === analytics.yearlyScores.length - 1;
                          
                          return (
                            <TooltipProvider key={yearData.year}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex-1 flex flex-col justify-end cursor-help">
                                    <div 
                                      className={`w-full rounded-t transition-all ${
                                        isLast 
                                          ? 'bg-purple-500' 
                                          : isFirst 
                                          ? 'bg-gray-300' 
                                          : 'bg-purple-300'
                                      }`}
                                      style={{ height: `${height}%` }}
                                    />
                                    <div className="text-[8px] text-center text-gray-500 mt-0.5">
                                      {yearData.year}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <div className="text-xs">
                                    <div className="font-semibold">{yearData.year}</div>
                                    <div>Wine Score: {formatPercent(yearData.avgScore, 1, true)}</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Avg Wine Score:</span>
                      <span className={`font-medium ${getColorClass(analytics.avgWineScore)}`}>
                        {formatPercent(analytics.avgWineScore, 0, true)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Avg Price:</span>
                      <span className="font-medium text-green-600">
                        {formatNumber(analytics.avgPrice, { currency: true, decimals: 0 })}/btl
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Consistency:</span>
                      <span className={`font-medium ${getColorClass(analytics.consistencyScore / 100)}`}>
                        {formatNumber(analytics.consistencyScore, { decimals: 0 })}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Trend:</span>
                      <span className={`font-medium ${
                        analytics.scoreTrend === null
                          ? 'text-blue-600'
                          : analytics.scoreTrend > 0.05 
                          ? 'text-green-600' 
                          : analytics.scoreTrend < -0.05 
                          ? 'text-red-600' 
                          : 'text-gray-600'
                      }`}>
                        {analytics.scoreTrend === null ? '🆕 First Vintage' : analytics.scoreTrend > 0.05 ? '📈 Improving' : analytics.scoreTrend < -0.05 ? '📉 Declining' : '➡️ Stable'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Comparative Rankings */}
              {analytics.totalVineyards > 1 && (
                <div className="border-t pt-3">
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Comparative Rankings
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-purple-50 rounded border border-purple-200">
                      <div className="font-bold text-purple-900">#{analytics.scoreRanking}</div>
                      <div className="text-[10px] text-purple-600">Wine Score</div>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                      <div className="font-bold text-green-900">#{analytics.priceRanking}</div>
                      <div className="text-[10px] text-green-600">Price/Bottle</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                      <div className="font-bold text-blue-900">#{analytics.roiRanking}</div>
                      <div className="text-[10px] text-blue-600">ROI/Hectare</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 text-center">
                    Revenue/Hectare: {formatNumber(analytics.revenuePerHectare, { currency: true, decimals: 0 })} • {formatNumber(analytics.bottlesPerHectare, { decimals: 0 })} bottles/ha
                  </div>
                </div>
              )}
              
              {/* Grape Performance */}
              {analytics.grapePerformance.length > 0 && (
                <div className="border-t pt-3">
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                    <Wine className="h-3 w-3" /> Grape Varieties Performance
                  </h4>
                  <div className="space-y-1.5">
                    {analytics.grapePerformance.map(grape => (
                      <div key={grape.variety} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-700">{grape.variety}</span>
                          <span className="text-gray-400">({grape.vintages}x)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-medium ${getColorClass(grape.avgWineScore)}`}>
                            {formatPercent(grape.avgWineScore, 0, true)}
                          </span>
                          <span className="text-gray-500">
                            {formatNumber(grape.avgPrice, { currency: true, decimals: 0 })}/btl
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Feature Statistics (Current Cellar) */}
              {analytics.featureStats.total > 0 && (
                <div className="border-t pt-3">
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Feature Analysis (Cellar)
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {analytics.featureStats.terroir > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">🌿 Terroir:</span>
                        <span className="font-medium text-green-600">
                          {analytics.featureStats.terroir} / {analytics.featureStats.total}
                        </span>
                      </div>
                    )}
                    {analytics.featureStats.bottleAging > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">🕰️ Bottle Aging:</span>
                        <span className="font-medium text-amber-600">
                          {analytics.featureStats.bottleAging} / {analytics.featureStats.total}
                        </span>
                      </div>
                    )}
                    {analytics.featureStats.oxidation > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">⚠️ Oxidation:</span>
                        <span className="font-medium text-red-600">
                          {analytics.featureStats.oxidation} / {analytics.featureStats.total}
                        </span>
                      </div>
                    )}
                    {analytics.featureStats.greenFlavor > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">🟢 Green Flavor:</span>
                        <span className="font-medium text-orange-600">
                          {analytics.featureStats.greenFlavor} / {analytics.featureStats.total}
                        </span>
                      </div>
                    )}
                  </div>
                  {analytics.featureStats.total > 0 && (
                    <div className="mt-2 text-[10px] text-gray-400 text-center">
                      Based on {analytics.featureStats.total} wine{analytics.featureStats.total !== 1 ? 's' : ''} currently in cellar
                    </div>
                  )}
                </div>
              )}
              
              {/* Aging Potential */}
              {analytics.agingPotential.agedWineCount > 0 && (
                <div className="border-t pt-3">
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                    🕰️ Aging Potential
                  </h4>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-600">Aged Wines (3+ years):</span>
                      <span className="font-medium text-amber-900">{analytics.agingPotential.agedWineCount} batches</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Avg Quality:</span>
                      <span className={`font-medium ${getColorClass(analytics.agingPotential.avgQuality || 0)}`}>
                        {formatPercent(analytics.agingPotential.avgQuality || 0, 0, true)}
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-700 mt-1 italic">
                      {analytics.agingPotential.avgQuality && analytics.agingPotential.avgQuality > analytics.avgQuality 
                        ? `✓ Aging improves quality (+${formatPercent(analytics.agingPotential.avgQuality - analytics.avgQuality, 1, true)})`
                        : 'Early aging data - needs more time'}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Best Wine Highlight */}
              <div className="border-t pt-3">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <Award className="h-3 w-3" /> Best Production
                </h4>
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">{analytics.bestWine.vintage} {analytics.bestWine.grape}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{analytics.bestWine.quantity} bottles • {formatNumber(analytics.bestWine.estimatedPrice, { currency: true, decimals: 0 })}/btl</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${getColorClass((analytics.bestWine.grapeQuality + analytics.bestWine.balance) / 2)}`}>
                        {formatPercent((analytics.bestWine.grapeQuality + analytics.bestWine.balance) / 2, 0, true)}
                      </div>
                      <div className="text-xs text-gray-500">{getGrapeQualityCategory((analytics.bestWine.grapeQuality + analytics.bestWine.balance) / 2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* No Production Data Message */}
      {Object.keys(vineyardGroups).length === 0 && (
        <Card className="md:col-span-2">
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Production Data</h3>
            <p className="text-gray-500">
              Start producing and bottling wines to see vineyard statistics here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VineyardStatisticsTab;


