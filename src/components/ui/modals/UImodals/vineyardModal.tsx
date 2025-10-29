import React from 'react';
import { Vineyard as VineyardType } from '@/lib/types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../shadCN/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../shadCN/card';
import { Badge } from '../../shadCN/badge';
import { Separator } from '../../shadCN/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../shadCN/tooltip';
import { Grape, MapPin, Ruler, Mountain, Compass, BarChart3 } from 'lucide-react';
import { DialogProps } from '@/lib/types/UItypes';
import { formatCurrency, formatNumber, getBadgeColorClasses, getFlagIcon, formatPercent, getColorCategory, getColorClass } from '@/lib/utils';
import { getAltitudeRating, getAspectRating, calculateVineyardExpectedYield, calculateAdjustedLandValueBreakdown } from '@/lib/services';
import { REGION_ALTITUDE_RANGES, REGION_ASPECT_RATINGS, REGION_PRESTIGE_RANKINGS, REGION_PRICE_RANGES } from '@/lib/constants';
import { getRegionalPriceRange } from '@/lib/services';
import { getVineyardGrapeQualityFactors } from '@/lib/services/wine/winescore/grapeQualityCalculation';

interface VineyardModalProps extends DialogProps {
  vineyard: VineyardType | null;
}

const VineyardModal: React.FC<VineyardModalProps> = ({ isOpen, onClose, vineyard }) => {
  if (!vineyard) return null;

  const altitudeRating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
  const aspectRating = getAspectRating(vineyard.country, vineyard.region, vineyard.aspect);
  const altitudeColors = getBadgeColorClasses(altitudeRating);
  const aspectColors = getBadgeColorClasses(aspectRating);

  const altitudeRange = (REGION_ALTITUDE_RANGES as unknown as Record<string, Record<string, readonly [number, number]>>)[
    vineyard.country
  ]?.[vineyard.region];

  const aspectRegionMap = (REGION_ASPECT_RATINGS as Record<string, Record<string, Record<string, number>>>)[
    vineyard.country
  ]?.[vineyard.region];
  const aspectValues = aspectRegionMap ? Object.values(aspectRegionMap) : undefined;
  const aspectMin = aspectValues ? Math.min(...aspectValues) : undefined;
  const aspectMax = aspectValues ? Math.max(...aspectValues) : undefined;
  const bestAspect = aspectRegionMap
    ? Object.entries(aspectRegionMap).reduce(
        (best, [dir, val]) => (val > best.value ? { dir, value: val } : best),
        { dir: Object.keys(aspectRegionMap)[0], value: aspectRegionMap[Object.keys(aspectRegionMap)[0]] }
      )
    : undefined;

  const prestigeRanking = (REGION_PRESTIGE_RANKINGS as unknown as Record<string, Record<string, number>>)[
    vineyard.country
  ]?.[vineyard.region];
  const regionalPriceRange = (REGION_PRICE_RANGES as unknown as Record<string, Record<string, readonly [number, number]>>)[
    vineyard.country
  ]?.[vineyard.region];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col sm:max-h-[85vh]">
        {/* Top image bar */}
        <div
          className="h-36 bg-cover bg-center relative"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1516594798947-e65505dbb29d?w=1200&h=300&fit=crop')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
            <div>
              <div className="text-white text-lg font-semibold flex items-center gap-2">
                <Grape className="h-5 w-5" />
                {vineyard.name}
              </div>
              <div className="text-white/80 text-xs flex items-center gap-2">
                <span className={getFlagIcon(vineyard.country)} />
                {vineyard.region}, {vineyard.country}
              </div>
            </div>
            <Badge variant="outline" className="bg-white/90 text-gray-900">
              {vineyard.grape ?? 'Unplanted'}
            </Badge>
          </div>
        </div>

        <div className="p-4 pb-6 space-y-4 overflow-y-auto flex-1">
          <DialogHeader>
            <DialogTitle className="text-base">Vineyard Details</DialogTitle>
            <DialogDescription className="text-xs">
              Overview of land characteristics, vine information, and current status.
            </DialogDescription>
          </DialogHeader>

          {/* Quick stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-medium flex items-center gap-2">
                  <Ruler className="h-4 w-4" /> Size & Value
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 text-sm">
                <div className="font-semibold">{vineyard.hectares} ha</div>
                <div className="text-muted-foreground text-xs">
                  Base: {formatCurrency(vineyard.landValue)}/ha
                </div>
                <Separator className="my-2" />
                <div className="text-xs font-medium">Total {formatCurrency(vineyard.vineyardTotalValue)}</div>
                {vineyard.hectares > 0 && (
                  <div className="text-xs text-muted-foreground">Adj. per ha: {formatCurrency((vineyard.vineyardTotalValue || 0) / vineyard.hectares)}</div>
                )}
                {(() => {
                  const b = calculateAdjustedLandValueBreakdown(vineyard);
                  return (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Stored total; updated annually at New Year.
                      <div className="mt-1 space-y-0.5 font-mono">
                        <div>Base: €{formatNumber(b.basePerHa, { decimals: 0 })}/ha</div>
                        <div>Planted: +{formatNumber(b.plantedBonusPct * 100, { decimals: 2 })}%</div>
                        <div>Vine age×prestige: +{formatNumber(b.ageBonusPct * 100, { decimals: 2 })}%</div>
                        <div>Prestige: +{formatNumber(b.prestigeBonusPct * 100, { decimals: 2 })}%</div>
                        <div>Projected next New Year: ×{formatNumber(b.totalMultiplier, { decimals: 3, forceDecimals: true })} → €{formatNumber(b.adjustedPerHa, { decimals: 0 })}/ha</div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-medium flex items-center gap-2">
                  <Mountain className="h-4 w-4" /> Altitude
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span>{vineyard.altitude}m</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${altitudeColors.text} ${altitudeColors.bg}`}>
                    {formatNumber(altitudeRating, { decimals: 2, forceDecimals: true })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">Regional suitability</div>
                {altitudeRange && (
                  <div className="text-xs text-muted-foreground mt-1">Region range: {altitudeRange[0]}–{altitudeRange[1]} m</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-medium flex items-center gap-2">
                  <Compass className="h-4 w-4" /> Aspect
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 text-sm">
                <div className="flex items-center gap-2 capitalize">
                  <span>{vineyard.aspect}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${aspectColors.text} ${aspectColors.bg}`}>
                    {formatNumber(aspectRating, { decimals: 2, forceDecimals: true })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">Orientation suitability</div>
                {aspectMin !== undefined && aspectMax !== undefined && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Region range: {formatNumber(aspectMin, { decimals: 2, forceDecimals: true })}–{formatNumber(aspectMax, { decimals: 2, forceDecimals: true })}
                  </div>
                )}
                {bestAspect && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Best: <span className="font-medium capitalize">{bestAspect.dir}</span> ({formatNumber(bestAspect.value, { decimals: 2, forceDecimals: true })})
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Location & Terrain
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Country</span>
                  <div className="flex items-center gap-2">
                    <span className={getFlagIcon(vineyard.country)} />
                    <span>{vineyard.country}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Region</span>
                  <span>{vineyard.region}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Soil</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-medium cursor-help">{vineyard.soil.join(', ')}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="text-xs">Primary soil composition</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {prestigeRanking !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prestige rating</span>
                    <span className="font-medium">{formatPercent(prestigeRanking, 0, true)}</span>
                  </div>
                )}
                {regionalPriceRange && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Regional land value</span>
                    <span className="font-medium">
                      {formatCurrency(regionalPriceRange[0])} – {formatCurrency(regionalPriceRange[1])}/ha
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-medium">Vine Information</CardTitle>
              </CardHeader>
              <CardContent className="py-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Grape</span>
                  <span className="font-medium">{vineyard.grape ?? 'Not planted'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Age</span>
                  <span className="font-medium">
                    {vineyard.vineAge === null ? 'Not planted' : vineyard.vineAge === 0 ? 'Newly planted' : `${vineyard.vineAge} years`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Density</span>
                  <span className="font-medium">{vineyard.density > 0 ? `${formatNumber(vineyard.density, { decimals: 0 })} vines/ha` : 'Not planted'}</span>
                </div>
                
                {/* Vineyard Health */}
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Vineyard Health</span>
                    <span>{Math.round((vineyard.vineyardHealth || 1.0) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 relative group cursor-help">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        (vineyard.vineyardHealth || 1.0) < 0.3
                          ? 'bg-red-500'
                          : (vineyard.vineyardHealth || 1.0) < 0.6
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, (vineyard.vineyardHealth || 1.0) * 100)}%` }}
                    />
                    {/* Health Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-64">
                      <div className="text-xs">
                        <div className="font-medium text-gray-200 mb-2">Vineyard Health: {Math.round(vineyard.vineyardHealth * 100)}%</div>
                        
                        {vineyard.healthTrend && (vineyard.healthTrend.seasonalDecay > 0 || vineyard.healthTrend.plantingImprovement > 0) ? (
                          <div className="space-y-1">
                            <div className="font-medium text-gray-300 mb-1">Health Changes This Season:</div>
                            
                            {vineyard.healthTrend.seasonalDecay > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">Seasonal decay:</span>
                                <span className="text-red-400 font-medium">
                                  -{formatNumber(vineyard.healthTrend.seasonalDecay * 100, { decimals: 1 })}%
                                </span>
                              </div>
                            )}
                            
                            {vineyard.healthTrend.plantingImprovement > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">Recent planting:</span>
                                <span className="text-green-400 font-medium">
                                  +{formatNumber(vineyard.healthTrend.plantingImprovement * 100, { decimals: 1 })}%
                                </span>
                              </div>
                            )}
                            
                            {(vineyard.healthTrend.netChange > 0 || vineyard.healthTrend.netChange < 0) && (
                              <div className="flex justify-between items-center pt-1 border-t border-gray-600">
                                <span className="font-medium text-gray-200">Net change:</span>
                                <span className={`font-medium ${vineyard.healthTrend.netChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {vineyard.healthTrend.netChange > 0 ? '+' : ''}{formatNumber(vineyard.healthTrend.netChange * 100, { decimals: 1 })}%
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-400">No significant changes this season</div>
                        )}
                        
                        {vineyard.plantingHealthBonus && vineyard.plantingHealthBonus > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-600">
                            <div className="text-gray-400">
                              Gradual improvement: +{formatNumber(vineyard.plantingHealthBonus * 100, { decimals: 1 })}% remaining
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>

                {vineyard.grape && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Ripeness</span>
                        <span>{Math.round((vineyard.ripeness || 0) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            (vineyard.ripeness || 0) < 0.3
                              ? 'bg-red-400'
                              : (vineyard.ripeness || 0) < 0.7
                              ? 'bg-amber-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(100, (vineyard.ripeness || 0) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Vine Yield</span>
                        <span>{Math.round((vineyard.vineYield || 0.02) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            (vineyard.vineYield || 0.02) < 0.3
                              ? 'bg-red-400'
                              : (vineyard.vineYield || 0.02) < 0.7
                              ? 'bg-amber-500'
                              : (vineyard.vineYield || 0.02) < 1.0
                              ? 'bg-green-500'
                              : 'bg-purple-500'
                          }`}
                          style={{ width: `${Math.min(100, (vineyard.vineYield || 0.02) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-medium">Clearing Information</CardTitle>
              </CardHeader>
              <CardContent className="py-3 text-sm space-y-3">

                {/* Clearing Task Status */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-700">Clearing Task Status:</div>
                  <div className="space-y-1">
                    {(() => {
                      const overgrowth = vineyard.overgrowth || { vegetation: 0, debris: 0, uproot: 0, replant: 0 };
                      
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Clear Vegetation:</span>
                            <span className={`font-medium ${overgrowth.vegetation === 0 ? 'text-green-600' : overgrowth.vegetation === 1 ? 'text-amber-600' : 'text-orange-600'}`}>
                              {overgrowth.vegetation === 0 ? 'Completed this year' : 
                               overgrowth.vegetation === 1 ? '1 year ago' : 
                               `${overgrowth.vegetation} years ago`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Remove Debris:</span>
                            <span className={`font-medium ${overgrowth.debris === 0 ? 'text-green-600' : overgrowth.debris === 1 ? 'text-amber-600' : 'text-orange-600'}`}>
                              {overgrowth.debris === 0 ? 'Completed this year' : 
                               overgrowth.debris === 1 ? '1 year ago' : 
                               `${overgrowth.debris} years ago`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Replant Vines:</span>
                            <span className={`font-medium ${overgrowth.replant === 0 ? 'text-green-600' : overgrowth.replant === 1 ? 'text-amber-600' : 'text-orange-600'}`}>
                              {overgrowth.replant === 0 ? 'Completed this year' : 
                               overgrowth.replant === 1 ? '1 year ago' : 
                               `${overgrowth.replant} years ago`}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 italic mt-2">
                            Tasks can only be performed once per year. Green = done this year, Amber = 1 year ago, Orange = 2+ years ago
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <Separator />

                {/* Incoming Health Improvements */}
                {vineyard.plantingHealthBonus && vineyard.plantingHealthBonus > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-700">Incoming Health Improvements:</div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-700 font-medium">Planting Health Bonus:</span>
                        <span className="text-green-600 font-medium">
                          +{formatNumber(vineyard.plantingHealthBonus * 100, { decimals: 1 })}%
                        </span>
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        Gradual improvement over 5 years from recent planting/replanting
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expected Yield Breakdown */}
            {vineyard.grape && (() => {
              const yieldBreakdown = calculateVineyardExpectedYield(vineyard);
              
              return yieldBreakdown ? (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Expected Yield Calculation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <div className="text-sm space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Final Yield:</span>
                          <span className="font-medium ml-2">{formatNumber(yieldBreakdown.totalYield)} kg</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Vines:</span>
                          <span className="font-medium ml-2">{Math.round(yieldBreakdown.totalVines)}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Density:</span>
                        <span className="font-medium ml-2">{formatNumber(vineyard.density, { decimals: 0 })} vines/ha</span>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="text-xs text-muted-foreground mb-1">Calculation Formula:</div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs font-mono bg-gray-50 p-2 rounded cursor-help">
                                {Math.round(yieldBreakdown.totalVines)} vines × {yieldBreakdown.baseYieldPerVine} kg/vine × {formatNumber(yieldBreakdown.breakdown.finalMultiplier, { decimals: 3, smartDecimals: true })} = {formatNumber(yieldBreakdown.totalYield)} kg
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">
                                <div className="font-medium mb-2">Combined Multiplier Formula:</div>
                                <div className="font-mono">Suitability × Natural Yield × Ripeness × Vine Yield × Health</div>
                                <div className="mt-2 space-y-1">
                                  <div>Grape Suitability: {formatPercent(yieldBreakdown.breakdown.grapeSuitability, 1)}</div>
                                  <div>Natural Yield: {formatPercent(yieldBreakdown.breakdown.naturalYield, 1)}</div>
                                  <div>Ripeness: {formatPercent(yieldBreakdown.breakdown.ripeness, 1)}</div>
                                  <div>Vine Yield: {formatPercent(yieldBreakdown.breakdown.vineYield, 1)}</div>
                                  <div>Health: {formatPercent(yieldBreakdown.breakdown.health, 1)}</div>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="text-xs text-muted-foreground mb-1">Multiplier Factors:</div>
                        <div className="space-y-1">
                          <div className="text-xs flex justify-between">
                            <span>Grape Suitability:</span>
                            <span className={`font-medium ${getColorClass(yieldBreakdown.breakdown.grapeSuitability)}`}>
                              {formatPercent(yieldBreakdown.breakdown.grapeSuitability, 1)}
                            </span>
                          </div>
                          <div className="text-xs flex justify-between">
                            <span>Natural Yield:</span>
                            <span className={`font-medium ${getColorClass(yieldBreakdown.breakdown.naturalYield)}`}>
                              {formatPercent(yieldBreakdown.breakdown.naturalYield, 1)}
                            </span>
                          </div>
                          <div className="text-xs flex justify-between">
                            <span>Ripeness:</span>
                            <span className={`font-medium ${getColorClass(yieldBreakdown.breakdown.ripeness)}`}>
                              {formatPercent(yieldBreakdown.breakdown.ripeness, 1)}
                            </span>
                          </div>
                          <div className="text-xs flex justify-between">
                            <span>Vine Yield:</span>
                            <span className={`font-medium ${getColorClass(yieldBreakdown.breakdown.vineYield)}`}>
                              {formatPercent(yieldBreakdown.breakdown.vineYield, 1)}
                            </span>
                          </div>
                          <div className="text-xs flex justify-between">
                            <span>Health:</span>
                            <span className={`font-medium ${getColorClass(yieldBreakdown.breakdown.health)}`}>
                              {formatPercent(yieldBreakdown.breakdown.health, 1)}
                            </span>
                          </div>
                          <div className="border-t pt-1 mt-1">
                            <div className="text-xs flex justify-between font-medium">
                              <span>Combined:</span>
                              <span className={getColorClass(yieldBreakdown.breakdown.finalMultiplier)}>
                                {formatNumber(yieldBreakdown.breakdown.finalMultiplier, { smartDecimals: true, decimals: 3 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null;
            })()}
          </div>

          {/* Land Value Factor (detailed) */}
          {(() => {
            try {
              const qualityData = getVineyardGrapeQualityFactors(vineyard);
              const factors = qualityData.factors;
              return (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      Land Value Calculation
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-blue-600 cursor-help">ℹ️</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="max-w-sm">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium text-sm">💰 Land Value Calculation</p>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getBadgeColorClasses(factors.landValue).bg} ${getBadgeColorClasses(factors.landValue).text}`}>
                                  {getColorCategory(factors.landValue)}
                                </span>
                              </div>
                              <p className="text-xs mb-2 text-gray-300">Your vineyard's land value is calculated dynamically based on multiple factors:</p>
                              <p className="font-medium mb-1 text-blue-300">Calculation Formula:</p>
                              <p className="text-xs font-mono mb-2 text-gray-300">Land value = Regional Baseprice + Regional modifier × (Regional Maxprice - Regional Baseprice</p>
                              <p className="font-medium mb-1 text-blue-300">Raw Price Factor:</p>
                              <p className="text-xs mb-1 text-gray-300">Regional Modifier = (Altitude + Aspect) ÷ 2</p>
                              <ul className="text-xs space-y-1 ml-2 text-gray-300">
                                <li>• <strong>Altitude:</strong> {vineyard.altitude}m vs. optimal range</li>
                                <li>• <strong>Aspect:</strong> {vineyard.aspect} sun exposure rating</li>
                              </ul>
                              <p className="font-medium mt-2 mb-1 text-green-300">Regional Scaling:</p>
                              <p className="text-xs text-gray-300">Perfect factors (altitudeAspectRate=1) reach the region's maximum price</p>
                              <p className="font-medium mt-2 mb-1 text-green-300">Regional Price Range:</p>
                              <p className="text-xs text-gray-300">€{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })} - €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { decimals: 0, forceDecimals: false })} per hectare in {vineyard.region}</p>
                              <p className="font-medium mt-2 mb-1 text-purple-300">Global Normalization:</p>
                              <p className="text-xs text-gray-300">Final value is normalized using asymmetrical scaling for the quality index calculation.</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 text-sm space-y-3">
                    <div className="text-xs space-y-2">
                      <div className="space-y-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="font-mono text-gray-700 cursor-help">
                                €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })} + {formatNumber((factors.altitudeRating + factors.aspectRating) / 2, { decimals: 2, forceDecimals: true })} × (€{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { decimals: 0, forceDecimals: false })} - €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })}) = €{formatNumber(vineyard.landValue || 0, { decimals: 0, forceDecimals: false })}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">Land value = Regional Baseprice + Regional modifier × (Regional Maxprice - Regional Baseprice)</div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-xs text-gray-600">
                        Annual adjustments to total value: planted grape suitability (up to ~5%), vine age × prestige (up to ~3%), vineyard prestige (up to ~2%).
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium text-gray-700 mb-1">Regional Price Range ({vineyard.region}):</div>
                        <div className="font-mono text-gray-600">
                          €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })} - €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { decimals: 0, forceDecimals: false })} per hectare
                        </div>
                      </div>
                      <div className="space-y-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="font-mono text-gray-800 font-medium cursor-help">
                                Regional Modifier: ({formatNumber(factors.altitudeRating, { decimals: 2, forceDecimals: true })} + {formatNumber(factors.aspectRating, { decimals: 2, forceDecimals: true })}) ÷ 2 = {formatNumber((factors.altitudeRating + factors.aspectRating) / 2, { decimals: 2, forceDecimals: true })}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs space-y-1">
                                <div>Regional Modifier: (altitude + aspect) ÷ 2</div>
                                <div>Altitude: {formatNumber(factors.altitudeRating, { decimals: 2, forceDecimals: true })} ({vineyard.altitude}m)</div>
                                <div>Aspect: {formatNumber(factors.aspectRating, { decimals: 2, forceDecimals: true })} ({vineyard.aspect})</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              );
            } catch {
              return null;
            }
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VineyardModal;



