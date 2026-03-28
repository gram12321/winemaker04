import React, { useState, useEffect, useMemo } from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../shadCN/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../shadCN/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../shadCN/card';
import { Badge } from '../../shadCN/badge';
import { TooltipSection, TooltipRow, tooltipStyles, UnifiedTooltip } from '../../shadCN/tooltip';
import { Wine, Calendar, MapPin, Award, AlertTriangle, TrendingUp, BarChart3, Radar } from 'lucide-react';
import { DialogProps } from '@/lib/types/UItypes';
import { formatNumber, getFlagIcon } from '@/lib/utils';
import { getCharacteristicIconSrc } from '@/lib/utils/icons';
import { getQualityCategory, getQualityDescription, getWineStructureCategory, getWineStructureDescription, getColorClass } from '@/lib/utils/utils';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';
import { LandValueModifierFactorsBreakdown } from '../../components/landValueModifierBreakdown';
import { StructureIndexBreakdown } from '../../components/StructureIndexBreakdown';
import { FeatureDisplay } from '../../components/FeatureDisplay';
import { WineCharacteristicsDisplay } from '../../components/characteristicBar';
import { getWineAgeFromHarvest, getWineBatchDisplayName } from '@/lib/services';
import { useWineStructureIndex, useWinePriceCalculator } from '@/hooks';
import { calculateEstimatedPriceBreakdown } from '@/lib/services/wine/winescore/wineScoreCalculation';

interface WineModalProps extends DialogProps {
  wineBatch: WineBatch | null;
  wineName?: string;
}

/**
 * Unified Wine Modal
 * Comprehensive wine details in a tabbed interface
 * Replaces separate TasteIndexBreakdownModal, structure breakdown modal, and expand/collapse patterns
 */
export const WineModal: React.FC<WineModalProps> = ({ 
  isOpen, 
  onClose, 
  wineBatch,
  wineName 
}) => {
  const [vineyard, setVineyard] = useState<Vineyard | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { prestige } = useWinePriceCalculator();

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

  // Calculate current structure index from characteristics (reflects feature evolution)
  const structureIndexResult = useWineStructureIndex(wineBatch?.characteristics || null);
  const currentStructureIndex: number = structureIndexResult?.score ?? wineBatch?.structureIndex ?? 0;

  // Calculate wine age using service layer
  const weeksSinceHarvest = wineBatch ? getWineAgeFromHarvest(wineBatch.harvestStartDate || { week: 1, season: 'Spring', year: 2024 }) : 0;

  const estimatedPriceBreakdown = useMemo(
    () => {
      if (!wineBatch) return null;
      return calculateEstimatedPriceBreakdown(
        wineBatch,
        vineyard || undefined,
        prestige,
        vineyard?.vineyardPrestige
      );
    },
    [wineBatch, vineyard, prestige]
  );

  // Early return AFTER all hooks are called
  if (!wineBatch || !estimatedPriceBreakdown) return null;

  const displayName = wineName || getWineBatchDisplayName(wineBatch);
  const currentTasteIndex: number = wineBatch.tasteIndex;
  const landValueModifier: number = wineBatch.landValueModifier;
  const currentWineScore = (currentTasteIndex + currentStructureIndex) / 2;
  const hasFeatureMultiplier = Math.abs(estimatedPriceBreakdown.featurePriceMultiplier - 1) > 0.0005;
  const hasCompanyPrestigeMultiplier = Math.abs(estimatedPriceBreakdown.companyPrestigeMultiplier - 1) > 0.0005;
  const hasVineyardPrestigeMultiplier = Math.abs(estimatedPriceBreakdown.vineyardPrestigeMultiplier - 1) > 0.0005;
  const tasteCategory = getQualityCategory(currentTasteIndex);
  const tasteColorClass = getColorClass(currentTasteIndex);
  const characteristicOrder: Array<keyof WineBatch['characteristics']> = ['acidity','aroma','body','spice','sweetness','tannins'] as any;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-y-auto scrollbar-styled">
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
              <Badge variant="outline" className={`${tasteColorClass} bg-white/90`}>
                {tasteCategory}
              </Badge>
            </div>
          </div>
        </div>

        <div className="p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Wine Details</DialogTitle>
            <DialogDescription className="text-xs">
              Comprehensive analysis of taste, land-value modifier, structure, and feature effects.
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
                Land Value
              </TabsTrigger>
              <TabsTrigger value="structure" className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Structure
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
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Wine Score:</span>
                        <UnifiedTooltip
                          content={
                            <div className={tooltipStyles.text}>
                              <TooltipSection title="Wine Score Details">
                                <TooltipRow
                                  label="Overall Score:"
                                  value={formatNumber(currentWineScore, { decimals: 2, forceDecimals: true })}
                                  valueRating={currentWineScore}
                                />
                                <TooltipRow
                                  label="Category:"
                                  value={getQualityCategory(currentWineScore)}
                                />
                                <div className="mt-2 pt-2 border-t border-gray-600">
                                  <div className="text-xs text-gray-300">{getQualityDescription(currentWineScore)}</div>
                                </div>
                              </TooltipSection>
                            </div>
                          }
                          title="Wine Score Details"
                          side="top"
                          sideOffset={8}
                          className="max-w-xs"
                          variant="panel"
                          density="compact"
                          triggerClassName="text-right cursor-help"
                        >
                          <div className="text-right cursor-help">
                            <div className={`font-medium ${getColorClass(currentWineScore)}`}>
                              {formatNumber(currentWineScore, { decimals: 2, forceDecimals: true })}
                            </div>
                            <div className="text-xs text-gray-500">{getQualityCategory(currentWineScore)}</div>
                          </div>
                        </UnifiedTooltip>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Structure:</span>
                        <UnifiedTooltip
                          content={
                            <div className={tooltipStyles.text}>
                              <TooltipSection title="Structure Index Details">
                                <TooltipRow 
                                  label="Structure Index:"
                                  value={formatNumber(currentStructureIndex, { decimals: 2, forceDecimals: true })}
                                  valueRating={currentStructureIndex}
                                />
                                <TooltipRow
                                  label="Category:"
                                  value={getWineStructureCategory(currentStructureIndex)}
                                />
                                <div className="mt-2 pt-2 border-t border-gray-600">
                                  <div className="text-xs text-gray-300">{getWineStructureDescription(currentStructureIndex)}</div>
                                </div>
                              </TooltipSection>
                            </div>
                          }
                          title="Structure Index Details"
                          side="top"
                          sideOffset={8}
                          className="max-w-xs"
                          variant="panel"
                          density="compact"
                          triggerClassName="text-right cursor-help"
                        >
                          <div className="text-right cursor-help">
                            <div className={`font-medium ${getColorClass(currentStructureIndex)}`}>
                              {formatNumber(currentStructureIndex, { decimals: 2, forceDecimals: true })}
                            </div>
                            <div className="text-xs text-gray-500">{getWineStructureCategory(currentStructureIndex)}</div>
                          </div>
                        </UnifiedTooltip>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Taste Index:</span>
                        <UnifiedTooltip
                          content={
                            <div className={tooltipStyles.text}>
                              <TooltipSection title="Taste Index Details">
                                <TooltipRow
                                  label="Taste Index:"
                                  value={formatNumber(currentTasteIndex, { decimals: 2, forceDecimals: true })}
                                  valueRating={currentTasteIndex}
                                />
                                <TooltipRow
                                  label="Category:"
                                  value={getQualityCategory(currentTasteIndex)}
                                />
                                <div className="mt-2 pt-2 border-t border-gray-600">
                                  <div className="text-xs text-gray-300">{getQualityDescription(currentTasteIndex)}</div>
                                </div>
                              </TooltipSection>
                            </div>
                          }
                          title="Taste Index Details"
                          side="top"
                          sideOffset={8}
                          className="max-w-xs"
                          variant="panel"
                          density="compact"
                          triggerClassName="text-right cursor-help"
                        >
                          <div className="text-right cursor-help">
                            <div className={`font-medium ${getColorClass(currentTasteIndex)}`}>
                              {formatNumber(currentTasteIndex, { decimals: 2, forceDecimals: true })}
                            </div>
                            <div className="text-xs text-gray-500">{getQualityCategory(currentTasteIndex)}</div>
                          </div>
                        </UnifiedTooltip>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Land Value Modifier:</span>
                        <div className="text-right">
                          <div className={`font-medium ${getColorClass(landValueModifier)}`}>
                            {formatNumber(landValueModifier, { decimals: 2, forceDecimals: true })}
                          </div>
                          <div className="text-xs text-gray-500">{getQualityCategory(landValueModifier)}</div>
                        </div>
                      </div>
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

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Estimated Price
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current estimate:</span>
                      <span className="font-medium text-gray-900">
                        {formatNumber(estimatedPriceBreakdown.finalPrice, { currency: true, decimals: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Score curve multiplier:</span>
                      <span className="font-medium">
                        {formatNumber(estimatedPriceBreakdown.wineScoreMultiplier, { decimals: 2, forceDecimals: true })}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Land value multiplier:</span>
                      <span className="font-medium">
                        {formatNumber(estimatedPriceBreakdown.landValuePriceMultiplier, { decimals: 2, forceDecimals: true })}x
                      </span>
                    </div>
                    {hasFeatureMultiplier && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Feature multiplier:</span>
                        <span className="font-medium">
                          {formatNumber(estimatedPriceBreakdown.featurePriceMultiplier, { decimals: 2, forceDecimals: true })}x
                        </span>
                      </div>
                    )}
                    {hasCompanyPrestigeMultiplier && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Company prestige:</span>
                        <span className="font-medium">
                          {formatNumber(estimatedPriceBreakdown.companyPrestigeMultiplier, { decimals: 2, forceDecimals: true })}x
                        </span>
                      </div>
                    )}
                    {hasVineyardPrestigeMultiplier && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vineyard prestige:</span>
                        <span className="font-medium">
                          {formatNumber(estimatedPriceBreakdown.vineyardPrestigeMultiplier, { decimals: 2, forceDecimals: true })}x
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-gray-200 text-xs text-gray-500">
                      Formula: Base Price (Wine Score x Base Rate) x Score Curve x Land Multiplier
                      {hasFeatureMultiplier ? ' x Feature Multiplier' : ''}
                      {hasCompanyPrestigeMultiplier ? ' x Company Prestige' : ''}
                      {hasVineyardPrestigeMultiplier ? ' x Vineyard Prestige' : ''}
                    </div>
                  </CardContent>
                </Card>

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
                      <span className="font-medium">{formatNumber(wineBatch.naturalYield * 100, { smartDecimals: true })}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fragile:</span>
                      <span className="font-medium">{formatNumber(wineBatch.fragile * 100, { smartDecimals: true })}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prone to Oxidation:</span>
                      <span className="font-medium">{formatNumber(wineBatch.proneToOxidation * 100, { smartDecimals: true })}%</span>
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

            {/* Land Value Modifier Tab */}
            <TabsContent value="quality" className="mt-4">
              {vineyard ? (
                <LandValueModifierFactorsBreakdown
                  vineyard={vineyard}
                  wineBatch={wineBatch}
                  showFactorDetails={true}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Land value modifier analysis unavailable - vineyard data not found for this wine batch.</p>
                </div>
              )}
            </TabsContent>

            {/* Structure tab */}
            <TabsContent value="structure" className="mt-4">
              <div className="space-y-4">
                {/* Structure index bar */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Structure Index
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <WineCharacteristicsDisplay 
                      characteristics={wineBatch.characteristics}
                      showValues={true}
                      collapsible={false}
                      title=""
                      showStructureIndex={true}
                    />
                  </CardContent>
                </Card>

                {/* Structure breakdown */}
                <StructureIndexBreakdown 
                  characteristics={wineBatch.characteristics}
                  showWineStyleRules={true}
                />
              </div>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features" className="mt-4">
              <div className="space-y-4">
                {/* 3-Column Horizontal Grid */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Column 1: Evolving Features */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Evolving Features
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3">
                      <FeatureDisplay 
                        batch={wineBatch} 
                        showEvolving={true}
                        showActive={false}
                        showRisks={false}
                        expanded={true}
                        className="text-sm"
                      />
                    </CardContent>
                  </Card>

                  {/* Column 2: Active Features */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Active Features
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3">
                      <FeatureDisplay 
                        batch={wineBatch} 
                        showEvolving={false}
                        showActive={true}
                        showRisks={false}
                        expanded={true}
                        className="text-sm"
                      />
                    </CardContent>
                  </Card>

                  {/* Column 3: Risks */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Risks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3">
                      <FeatureDisplay 
                        batch={wineBatch} 
                        showEvolving={false}
                        showActive={false}
                        showRisks={true}
                        expanded={true}
                        className="text-sm"
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Preview Risks for Next Actions */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Upcoming Risks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <FeatureDisplay 
                      batch={wineBatch} 
                      showPreviewRisks={true}
                      showForNextAction={true}
                      expanded={true}
                      className="text-sm"
                    />
                  </CardContent>
                </Card>
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
                      showStructureIndex={false}
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
                        // Calculate base by subtracting all effects from current characteristics
                        const currentVal = (wineBatch.characteristics as any)[key] as number;
                        const effects = (wineBatch.breakdown?.effects || []).filter(e => e.characteristic === (key as any));
                        const totalEffect = effects.reduce((sum, effect) => sum + effect.modifier, 0);
                        const baseVal = currentVal - totalEffect;
                        
                        // Group effects by description and sum their modifiers
                        const groupedEffects = effects.reduce((acc, effect) => {
                          const existing = acc.find(e => e.description === effect.description);
                          if (existing) {
                            existing.modifier += effect.modifier;
                            existing.count = (existing.count || 1) + 1;
                          } else {
                            acc.push({ ...effect, count: 1 });
                          }
                          return acc;
                        }, [] as Array<{ characteristic: keyof WineBatch['characteristics']; modifier: number; description: string; count: number }>);
                        
                        return (
                          <div key={key as string} className="border rounded p-3 bg-white">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <img src={getCharacteristicIconSrc(key)} alt={`${key} icon`} className="h-5 w-5 object-contain" />
                                <span className="font-medium capitalize">{key}</span>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded ${getColorClass(currentVal)} bg-gray-50`}>{formatNumber(currentVal,{decimals:2,forceDecimals:true})}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">{wineBatch.grape} Base: {formatNumber(baseVal,{decimals:2,forceDecimals:true})}</div>
                            <div className="space-y-1">
                              {groupedEffects.length === 0 ? (
                                <div className="text-xs text-muted-foreground">No effects.</div>
                              ) : (
                                <>
                                  {groupedEffects.map((e, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-gray-50">
                                      <div className="text-xs flex items-center gap-1">
                                        {e.description}
                                        {e.count > 1 && (
                                          <span className="text-[10px] text-muted-foreground">({e.count}×)</span>
                                        )}
                                      </div>
                                      <div className={`text-xs font-semibold ${e.modifier>=0?'text-green-700':'text-red-700'}`}>
                                        {e.modifier>=0?'+':''}{formatNumber(e.modifier,{decimals:3,forceDecimals:true})}
                                      </div>
                                    </div>
                                  ))}
                                  <div className="flex items-center justify-between p-2 rounded bg-blue-50 border border-blue-200">
                                    <div className="text-xs font-medium text-blue-800">Total effects</div>
                                    <div className={`text-xs font-semibold ${totalEffect>=0?'text-green-700':'text-red-700'}`}>
                                      {totalEffect>=0?'+':''}{formatNumber(totalEffect,{decimals:3,forceDecimals:true})}
                                    </div>
                                  </div>
                                </>
                              )}
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


