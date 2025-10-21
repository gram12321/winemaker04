import React, { useState, useEffect } from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../shadCN/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../shadCN/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../shadCN/card';
import { Badge } from '../../shadCN/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../shadCN/tooltip';
import { Wine, Calendar, MapPin, Award, AlertTriangle, TrendingUp, BarChart3, Radar } from 'lucide-react';
import { DialogProps } from '@/lib/types/UItypes';
import { formatNumber, getFlagIcon } from '@/lib/utils';
import { getWineQualityCategory, getWineQualityDescription, getWineBalanceCategory, getWineBalanceDescription, getColorClass } from '@/lib/utils/utils';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';
import { QualityFactorsBreakdown } from '../../components/QualityFactorsBreakdown';
import { BalanceScoreBreakdown } from '../../components/BalanceScoreBreakdown';
import { FeatureStatusGrid } from '../../wine/WineryFeatureStatusGrid';
import { WineCharacteristicsDisplay } from '../../components/characteristicBar';
import { calculateEffectiveQuality, getBottleAgingSeverity, getWineAgeFromHarvest } from '@/lib/services';
import { getAllFeatureConfigs } from '@/lib/constants/wineFeatures/commonFeaturesUtil';
import { useWineBalance } from '@/hooks';

interface WineModalProps extends DialogProps {
  wineBatch: WineBatch | null;
  wineName?: string;
}

/**
 * Unified Wine Modal
 * Comprehensive wine details in a tabbed interface
 * Replaces separate QualityBreakdownModal, BalanceBreakdownModal, and expand/collapse patterns
 */
export const WineModal: React.FC<WineModalProps> = ({ 
  isOpen, 
  onClose, 
  wineBatch,
  wineName 
}) => {
  const [vineyard, setVineyard] = useState<Vineyard | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Load vineyard data
  useEffect(() => {
    if (wineBatch && wineBatch.vineyardId) {
      loadVineyards().then((vineyards) => {
        const foundVineyard = vineyards.find(v => v.id === wineBatch.vineyardId);
        setVineyard(foundVineyard || null);
      }).catch((error) => {
        console.error('Failed to load vineyard for wine batch:', error);
        setVineyard(null);
      });
    } else {
      setVineyard(null);
    }
  }, [wineBatch]);

  // Calculate current balance from characteristics (reflects feature evolution)
  const balanceResult = useWineBalance(wineBatch?.characteristics || null);
  const currentBalance: number = balanceResult?.score ?? wineBatch?.balance ?? 0;

  // Calculate wine age using service layer
  const weeksSinceHarvest = wineBatch ? getWineAgeFromHarvest(wineBatch.harvestStartDate || { week: 1, season: 'Spring', year: 2024 }) : 0;

  // Early return AFTER all hooks are called
  if (!wineBatch) return null;

  const displayName = wineName || `${wineBatch.grape} - ${wineBatch.vineyardName}`;
  const effectiveQuality: number = calculateEffectiveQuality(wineBatch) || 0;
  const qualityCategory = getWineQualityCategory(effectiveQuality);
  const qualityColorClass = getColorClass(effectiveQuality);
  const configs = getAllFeatureConfigs();
  const presentFeatures = (wineBatch.features || []).filter(f => f.isPresent);
  const characteristicOrder: Array<keyof WineBatch['characteristics']> = ['body','aroma','spice','acidity','sweetness','tannins'] as any;
  const characteristicIconSrc: Record<string,string> = {
    body: '/assets/icons/characteristics/body.png',
    aroma: '/assets/icons/characteristics/aroma.png',
    spice: '/assets/icons/characteristics/spice.png',
    acidity: '/assets/icons/characteristics/acidity.png',
    sweetness: '/assets/icons/characteristics/sweetness.png',
    tannins: '/assets/icons/characteristics/tannins.png'
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-y-auto">
        {/* Header with wine image */}
        <div
          className="h-32 bg-cover bg-center relative"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1200&h=300&fit=crop')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
            <div>
              <div className="text-white text-lg font-semibold flex items-center gap-2">
                <Wine className="h-5 w-5" />
                {displayName}
              </div>
              <div className="text-white/80 text-xs flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                {wineBatch.harvestStartDate.year} Vintage • {weeksSinceHarvest} weeks old
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/90 text-gray-900">
                {wineBatch.state.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge variant="outline" className={`${qualityColorClass} bg-white/90`}>
                {qualityCategory}
              </Badge>
            </div>
          </div>
        </div>

        <div className="p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Wine Details</DialogTitle>
            <DialogDescription className="text-xs">
              Comprehensive analysis of wine quality, balance, features, and characteristics.
            </DialogDescription>
          </DialogHeader>

          {/* Tabbed Interface */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview" className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="quality" className="flex items-center gap-1">
                <Award className="h-3 w-3" />
                Quality
              </TabsTrigger>
              <TabsTrigger value="balance" className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Balance
              </TabsTrigger>
              <TabsTrigger value="features" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Features
              </TabsTrigger>
              <TabsTrigger value="taste" className="flex items-center gap-1">
                <Radar className="h-3 w-3" />
                Taste
              </TabsTrigger>
              <TabsTrigger value="origins" className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Origins
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-4">
              <div className="space-y-4">
                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs font-medium flex items-center gap-2">
                        <Wine className="h-4 w-4" /> Wine Info
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quantity:</span>
                        <span className="font-medium">{wineBatch.quantity} {wineBatch.state === 'bottled' ? 'bottles' : 'kg'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">State:</span>
                        <span className="font-medium capitalize">{wineBatch.state.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Age:</span>
                        <span className="font-medium">{weeksSinceHarvest} weeks</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs font-medium flex items-center gap-2">
                        <Award className="h-4 w-4" /> Scores
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 text-sm space-y-3">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex justify-between cursor-help">
                              <span className="text-muted-foreground">Wine Score:</span>
                              <div className="text-right">
                                <div className={`font-medium ${getColorClass((effectiveQuality + currentBalance) / 2)}`}>
                                  {formatNumber((effectiveQuality + currentBalance) / 2, { decimals: 2, forceDecimals: true })}
                                </div>
                                <div className="text-xs text-gray-500">{getWineQualityCategory((effectiveQuality + currentBalance) / 2)}</div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <div className="text-xs">{getWineQualityDescription((effectiveQuality + currentBalance) / 2)}</div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex justify-between cursor-help">
                              <span className="text-muted-foreground">Balance:</span>
                              <div className="text-right">
                                <div className={`font-medium ${getColorClass(currentBalance)}`}>
                                  {formatNumber(currentBalance, { decimals: 2, forceDecimals: true })}
                                </div>
                                <div className="text-xs text-gray-500">{getWineBalanceCategory(currentBalance)}</div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <div className="text-xs">{getWineBalanceDescription(currentBalance)}</div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex justify-between cursor-help">
                              <span className="text-muted-foreground">Quality:</span>
                              <div className="text-right">
                                <div className={`font-medium ${getColorClass(effectiveQuality)}`}>
                                  {formatNumber(effectiveQuality, { decimals: 2, forceDecimals: true })}
                                </div>
                                <div className="text-xs text-gray-500">{getWineQualityCategory(effectiveQuality)}</div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <div className="text-xs">{getWineQualityDescription(effectiveQuality)}</div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> Vineyard
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{wineBatch.vineyardName}</span>
                      </div>
                      {vineyard && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Location:</span>
                            <div className="flex items-center gap-1">
                              <span className={getFlagIcon(vineyard.country)} />
                              <span className="font-medium">{vineyard.region}</span>
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Size:</span>
                            <span className="font-medium">{vineyard.hectares} ha</span>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Grape Information */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Wine className="h-4 w-4" /> Grape Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Grape:</span>
                      <span className="font-medium">{wineBatch.grape}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Color:</span>
                      <span className="font-medium capitalize">{wineBatch.grapeColor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Natural Yield:</span>
                      <span className="font-medium">{formatNumber(wineBatch.naturalYield * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fragile:</span>
                      <span className="font-medium">{formatNumber(wineBatch.fragile * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prone to Oxidation:</span>
                      <span className="font-medium">{formatNumber(wineBatch.proneToOxidation * 100)}%</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Harvest Information */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Harvest Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Start Date:</span>
                      <span className="font-medium">
                        Week {wineBatch.harvestStartDate.week}, {wineBatch.harvestStartDate.season} {wineBatch.harvestStartDate.year}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">End Date:</span>
                      <span className="font-medium">
                        Week {wineBatch.harvestEndDate.week}, {wineBatch.harvestEndDate.season} {wineBatch.harvestEndDate.year}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Age:</span>
                      <span className="font-medium">{weeksSinceHarvest} weeks</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Quality Tab */}
            <TabsContent value="quality" className="mt-4">
              {vineyard ? (
                <QualityFactorsBreakdown
                  vineyard={vineyard}
                  wineBatch={wineBatch}
                  showFactorDetails={true}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Quality analysis unavailable - vineyard data not found for this wine batch.</p>
                </div>
              )}
            </TabsContent>

            {/* Balance Tab */}
            <TabsContent value="balance" className="mt-4">
              <div className="space-y-4">
                {/* Balance Score Bar */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Balance Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <WineCharacteristicsDisplay 
                      characteristics={wineBatch.characteristics}
                      showValues={true}
                      collapsible={false}
                      title=""
                      showBalanceScore={true}
                    />
                  </CardContent>
                </Card>

                {/* Balance Breakdown */}
                <BalanceScoreBreakdown 
                  characteristics={wineBatch.characteristics}
                  showWineStyleRules={true}
                />
              </div>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features" className="mt-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Feature Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <FeatureStatusGrid 
                      batch={wineBatch} 
                      showImpact={true}
                      showEvolution={true}
                      className="text-sm"
                    />
                  </CardContent>
                </Card>

                {/* Feature Details */}
                {presentFeatures.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs font-medium">Active Features</CardTitle>
                    </CardHeader>
                    <CardContent className="py-3">
                      <div className="space-y-3">
                        {presentFeatures.map(feature => {
                          const config = configs.find(c => c.id === feature.id);
                          if (!config) return null;

                          const qualityEffect = config.effects.quality;
                          let impactText = '';
                          
                          if (qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
                            impactText = `${(qualityEffect.amount * feature.severity * 100).toFixed(1)}%`;
                          } else if (qualityEffect.type === 'power') {
                            const scaledPenalty = qualityEffect.basePenalty! * (1 + Math.pow(wineBatch.quality, qualityEffect.exponent!));
                            impactText = `-${(scaledPenalty * 100).toFixed(1)}%`;
                          }

                          return (
                            <div key={config.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{config.icon}</span>
                                <div>
                                  <div className="font-medium text-sm">{config.name}</div>
                                  <div className="text-xs text-gray-600">{config.description}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  {config.manifestation === 'binary' ? 'Present' : 
                                    config.id === 'bottle_aging' ? 
                                      `${formatNumber(getBottleAgingSeverity(wineBatch) * 100, { decimals: 1, adaptiveNearOne: true })}%` :
                                      `${Math.round(feature.severity * 100)}%`}
                                </div>
                                {impactText && (
                                  <div className="text-xs text-gray-600">Quality: {impactText}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Taste Diagram Tab */}
            <TabsContent value="taste" className="mt-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Radar className="h-4 w-4" /> Taste Profile Diagram
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <div className="text-center">
                        <Radar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Taste Profile</h3>
                        <p className="text-sm text-gray-500 mb-4">
                          Spiderweb diagram showing wine characteristics
                        </p>
                        <div className="text-xs text-gray-400">
                          Coming Soon: Interactive taste visualization
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Characteristics for Reference */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Characteristics Reference
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <WineCharacteristicsDisplay 
                      characteristics={wineBatch.characteristics}
                      showValues={true}
                      collapsible={false}
                      title=""
                      showBalanceScore={false}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Origins Tab */}
            <TabsContent value="origins" className="mt-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium">Characteristic Origins</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 text-sm space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {characteristicOrder.map((key) => {
                        const baseMap = ((wineBatch.breakdown as any)?.base) as Record<string, number> | undefined;
                        const finalMap = ((wineBatch.breakdown as any)?.final) as Record<string, number> | undefined;
                        const baseVal = baseMap ? baseMap[key as string] : undefined;
                        const finalVal = (finalMap ? finalMap[key as string] : (wineBatch.characteristics as any)[key]) as number;
                        const effects = (wineBatch.breakdown?.effects || []).filter(e => e.characteristic === (key as any));
                        return (
                          <div key={key as string} className="border rounded p-3 bg-white">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <img src={characteristicIconSrc[key as string]} alt={`${key} icon`} className="h-5 w-5 object-contain" />
                                <span className="font-medium capitalize">{key}</span>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded ${getColorClass(finalVal)} bg-gray-50`}>{formatNumber(finalVal,{decimals:2,forceDecimals:true})}</span>
                            </div>
                            {baseVal !== undefined && (
                              <div className="text-xs text-muted-foreground mb-2">Base: {formatNumber(baseVal,{decimals:2,forceDecimals:true})}</div>
                            )}
                            <div className="space-y-1">
                              {effects.length === 0 ? (
                                <div className="text-xs text-muted-foreground">No harvest effects.</div>
                              ) : effects.map((e, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded bg-gray-50">
                                  <div className="text-xs">{e.description}</div>
                                  <div className={`text-xs font-semibold ${e.modifier>=0?'text-green-700':'text-red-700'}`}>
                                    {e.modifier>=0?'+':''}{formatNumber(e.modifier,{decimals:3,forceDecimals:true})}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WineModal;
