import React, { useState, useEffect, useMemo } from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../shadCN/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../shadCN/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../shadCN/card';
import { Badge } from '../../shadCN/badge';
import { TooltipSection, TooltipRow, tooltipStyles, UnifiedTooltip } from '../../shadCN/tooltip';
import { Wine, Calendar, MapPin, Award, AlertTriangle, TrendingUp, BarChart3, Radar as RadarIcon } from 'lucide-react';
import { DialogProps } from '@/lib/types/UItypes';
import { formatNumber, getFlagIcon } from '@/lib/utils';
import { getCharacteristicIconSrc } from '@/lib/utils/icons';
import { getQualityCategory, getQualityDescription, getWineBalanceCategory, getWineBalanceDescription, getColorClass } from '@/lib/utils/utils';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';
import { FAMILY_TO_DESCRIPTORS } from '@/lib/constants/taste/flavorFamilies';
import { LandValueModifierFactorsBreakdown } from '../../components/landValueModifierBreakdown';
import { BalanceScoreBreakdown } from '../../components/BalanceScoreBreakdown';
import { FeatureDisplay } from '../../components/FeatureDisplay';
import { WineCharacteristicsDisplay } from '../../components/characteristicBar';
import { getWineAgeFromHarvest, getWineBatchDisplayName } from '@/lib/services';
import { useWineBalance, useWinePriceCalculator } from '@/hooks';
import { calculateEstimatedPriceBreakdown } from '@/lib/services/wine/winescore/wineScoreCalculation';
import { calculateTasteEvaluationDetails } from '@/lib/services/wine/taste/tasteIndexService';
import type { FlavorFamilyId } from '@/lib/types/taste';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer } from 'recharts';

interface WineModalProps extends DialogProps {
  wineBatch: WineBatch | null;
  wineName?: string;
}

const FLAVOR_FAMILY_LABELS: Record<FlavorFamilyId, string> = {
  flower: 'Floral',
  citrus: 'Citrus',
  treeFruit: 'Tree Fruit',
  tropicalFruit: 'Tropical',
  redFruit: 'Red Fruit',
  blackFruit: 'Black Fruit',
  driedFruit: 'Dried Fruit',
  spiceFlavor: 'Spice',
  vegetable: 'Vegetable',
  earth: 'Earth',
  microbial: 'Microbial',
  oakAging: 'Oak Aging',
  generalAging: 'General Aging',
  faults: 'Faults'
};

const FLAVOR_WHEEL_ORDER: FlavorFamilyId[] = [
  'blackFruit',
  'redFruit',
  'spiceFlavor',
  'driedFruit',
  'earth',
  'citrus',
  'flower',
  'generalAging'
];

const FLAVOR_WHEEL_COLORS: Record<FlavorFamilyId, string> = {
  blackFruit: '#7f1d1d',
  redFruit: '#be123c',
  spiceFlavor: '#0f766e',
  driedFruit: '#9a3412',
  earth: '#166534',
  citrus: '#65a30d',
  flower: '#4f46e5',
  generalAging: '#b45309',
  treeFruit: '#ea580c',
  tropicalFruit: '#dc2626',
  vegetable: '#15803d',
  microbial: '#65a30d',
  oakAging: '#ca8a04',
  faults: '#7f1d1d'
};

const formatDescriptorLabel = (value: string): string => (
  value.replace(/([A-Z])/g, ' $1').replace(/^./, (v) => v.toUpperCase())
);

const formatOriginStageLabel = (stage: string): string => {
  if (stage === 'baseline') return 'Baseline';
  if (stage === 'anchor') return 'Anchors';
  if (stage === 'process') return 'Process';
  if (stage === 'feature') return 'Features';
  if (stage === 'interaction') return 'Interactions';
  return formatDescriptorLabel(stage);
};

const formatOriginSourceLabel = (source: string): string => {
  if (source.startsWith('grapeBaseline.')) {
    const grape = source.replace('grapeBaseline.', '');
    return `Grape Baseline (${grape})`;
  }
  if (source.startsWith('anchor.')) {
    return `Anchor: ${formatDescriptorLabel(source.replace('anchor.', ''))}`;
  }
  if (source.startsWith('process.')) {
    return `Process: ${formatDescriptorLabel(source.replace('process.', '').replace(/\./g, ' '))}`;
  }
  if (source.startsWith('feature.')) {
    return `Feature: ${formatDescriptorLabel(source.replace('feature.', ''))}`;
  }
  if (source.startsWith('interaction.')) {
    return `Interaction: ${formatDescriptorLabel(source.replace('interaction.', '').replace(/\./g, ' '))}`;
  }
  return formatDescriptorLabel(source.replace(/\./g, ' '));
};

interface PolarTickProps {
  payload?: {
    value?: string;
  };
  x?: string | number;
  y?: string | number;
  textAnchor?: 'start' | 'middle' | 'end' | 'inherit';
}

/**
 * Unified Wine Modal
 * Comprehensive wine details in a tabbed interface
 * Replaces separate TasteIndexBreakdownModal, BalanceBreakdownModal, and expand/collapse patterns
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

  // Calculate current balance from characteristics (reflects feature evolution)
  const balanceResult = useWineBalance(wineBatch?.characteristics || null);
  const currentBalance: number = balanceResult?.score ?? wineBatch?.balance ?? 0;

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

  const tasteDetails = useMemo(
    () => {
      if (!wineBatch) return null;
      return calculateTasteEvaluationDetails(wineBatch, vineyard || undefined);
    },
    [wineBatch, vineyard]
  );

  const tasteEvaluation = tasteDetails?.evaluation ?? null;

  const flavorFamilyRows = useMemo(() => {
    if (!tasteEvaluation) return [];
    return Object.entries(tasteEvaluation.families)
      .sort(([, a], [, b]) => b - a)
      .map(([familyId, value]) => ({
        familyId: familyId as FlavorFamilyId,
        label: FLAVOR_FAMILY_LABELS[familyId as FlavorFamilyId] || familyId,
        value
      }));
  }, [tasteEvaluation]);

  const descriptorRows = useMemo(() => {
    if (!tasteEvaluation) return [];
    return Object.entries(tasteEvaluation.descriptors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([descriptorId, value]) => ({
        descriptorId,
        label: descriptorId.replace(/([A-Z])/g, ' $1').replace(/^./, (v) => v.toUpperCase()),
        value
      }));
  }, [tasteEvaluation]);

  const flavorWheelData = useMemo(() => {
    if (!tasteEvaluation) return [];
    return FLAVOR_WHEEL_ORDER.map((familyId) => {
      const value = tasteEvaluation.families[familyId] || 0;
      return {
        familyId,
        family: FLAVOR_FAMILY_LABELS[familyId],
        value,
        valuePercent: Number((value * 100).toFixed(2)),
        color: FLAVOR_WHEEL_COLORS[familyId]
      };
    });
  }, [tasteEvaluation]);

  const flavorOriginRows = useMemo(() => {
    if (!tasteDetails) return [];
    return [...tasteDetails.profileOrigins.familyOrigins].sort((a, b) => b.value - a.value);
  }, [tasteDetails]);

  const metricRows: Array<{ key: 'harmony' | 'complexity' | 'intensity' | 'typicity' | 'layerBalance'; label: string }> = [
    { key: 'harmony', label: 'Harmony' },
    { key: 'complexity', label: 'Complexity' },
    { key: 'intensity', label: 'Intensity' },
    { key: 'typicity', label: 'Typicity' },
    { key: 'layerBalance', label: 'Layer Balance' }
  ];

  // Early return AFTER all hooks are called
  if (!wineBatch || !estimatedPriceBreakdown || !tasteEvaluation || !tasteDetails) return null;

  const displayName = wineName || getWineBatchDisplayName(wineBatch);
  const currentTasteIndex: number = tasteEvaluation.tasteIndex;
  const landValueModifier: number = wineBatch.landValueModifier;
  const currentWineScore = estimatedPriceBreakdown.wineScore;
  const hasFeatureMultiplier = Math.abs(estimatedPriceBreakdown.featurePriceMultiplier - 1) > 0.0005;
  const hasCompanyPrestigeMultiplier = Math.abs(estimatedPriceBreakdown.companyPrestigeMultiplier - 1) > 0.0005;
  const hasVineyardPrestigeMultiplier = Math.abs(estimatedPriceBreakdown.vineyardPrestigeMultiplier - 1) > 0.0005;
  const tasteCategory = getQualityCategory(currentTasteIndex);
  const tasteColorClass = getColorClass(currentTasteIndex);
  const complexityComponents = tasteDetails.metricExplainability.complexity.components;
  const descriptorEntropy = complexityComponents.find((component) => component.label === 'Descriptor entropy')?.value ?? 0;
  const familyEntropy = complexityComponents.find((component) => component.label === 'Family entropy')?.value ?? 0;
  const activeDescriptorRatio = complexityComponents.find((component) => component.label === 'Active descriptor ratio')?.value ?? 0;
  const characteristicOrder: Array<keyof WineBatch['characteristics']> = ['acidity','aroma','body','spice','sweetness','tannins'] as any;
  const characteristicIconSrc: Record<string,string> = {
    body: getCharacteristicIconSrc('body'),
    aroma: getCharacteristicIconSrc('aroma'),
    spice: getCharacteristicIconSrc('spice'),
    acidity: getCharacteristicIconSrc('acidity'),
    sweetness: getCharacteristicIconSrc('sweetness'),
    tannins: getCharacteristicIconSrc('tannins')
  };

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
                {wineBatch.harvestStartDate.year} Vintage - {weeksSinceHarvest} weeks old
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
              <TabsTrigger value="balance" className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Structure
              </TabsTrigger>
              <TabsTrigger value="features" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Features
              </TabsTrigger>
              <TabsTrigger value="taste" className="flex items-center gap-1">
                <RadarIcon className="h-3 w-3" />
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
                                  value={formatNumber(currentBalance, { decimals: 2, forceDecimals: true })}
                                  valueRating={currentBalance}
                                />
                                <TooltipRow
                                  label="Category:"
                                  value={getWineBalanceCategory(currentBalance)}
                                />
                                <div className="mt-2 pt-2 border-t border-gray-600">
                                  <div className="text-xs text-gray-300">{getWineBalanceDescription(currentBalance)}</div>
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
                            <div className={`font-medium ${getColorClass(currentBalance)}`}>
                              {formatNumber(currentBalance, { decimals: 2, forceDecimals: true })}
                            </div>
                            <div className="text-xs text-gray-500">{getWineBalanceCategory(currentBalance)}</div>
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

            {/* Structure Tab */}
            <TabsContent value="balance" className="mt-4">
              <div className="space-y-4">
                {/* Structure Index Bar */}
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
                      showBalanceScore={true}
                    />
                  </CardContent>
                </Card>

                {/* Structure Breakdown */}
                <BalanceScoreBreakdown 
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

            {/* Taste Tab */}
            <TabsContent value="taste" className="mt-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <RadarIcon className="h-4 w-4" /> Flavor Wheel
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    {flavorWheelData.length > 2 ? (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={flavorWheelData}>
                            <PolarGrid stroke="#d1d5db" />
                            <PolarAngleAxis
                              dataKey="family"
                              tick={(props: PolarTickProps) => {
                                const { payload, x, y, textAnchor } = props;
                                if (x === undefined || y === undefined) return null;
                                const datum = flavorWheelData.find((row) => row.family === payload?.value);
                                return (
                                  <text
                                    x={x}
                                    y={y}
                                    textAnchor={textAnchor}
                                    fill={datum?.color || '#4b5563'}
                                    fontSize={12}
                                  >
                                    {payload?.value}
                                  </text>
                                );
                              }}
                            />
                            <PolarRadiusAxis
                              angle={90}
                              domain={[0, 100]}
                              tickCount={6}
                              tick={false}
                              axisLine={false}
                            />
                            <RechartsRadar
                              name="Flavor Intensity"
                              dataKey="valuePercent"
                              stroke="#1d4ed8"
                              fill="#3b82f6"
                              fillOpacity={0.2}
                              strokeWidth={2}
                              isAnimationActive={false}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Insufficient flavor data for radar display.</div>
                    )}
                    <div className="mt-2 text-[11px] text-gray-500">
                      Wheel uses fixed Wine-Folly-style family order so visual shape stays stable between renders.
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium">Taste Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      {metricRows.map(({ key, label }) => {
                        const explain = tasteDetails.metricExplainability[key];
                        return (
                          <UnifiedTooltip
                            key={key}
                            content={
                              <div className="text-xs space-y-2">
                                <div className="font-semibold">{label}</div>
                                <div>{explain.description}</div>
                                <div className="text-gray-500">{explain.formula}</div>
                                <div className="border-t border-gray-200 pt-1">
                                  {explain.components.map((component) => (
                                    <div key={component.label} className="space-y-0.5">
                                      <div className="flex justify-between gap-2">
                                        <span>{component.label}</span>
                                        <span className="font-medium">
                                          {formatNumber(component.value * 100, { smartDecimals: true })}%
                                        </span>
                                      </div>
                                      {component.note && (
                                        <div className="text-[11px] text-gray-500">{component.note}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            }
                            side="top"
                            className="max-w-sm"
                            variant="panel"
                            density="compact"
                          >
                            <div className="border rounded p-2 cursor-help">
                              <div className="text-xs text-gray-500">{label}</div>
                              <div className={`font-semibold ${getColorClass(explain.score)}`}>
                                {formatNumber(explain.score * 100, { smartDecimals: true })}%
                              </div>
                            </div>
                          </UnifiedTooltip>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium">Metric Definitions</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 text-xs space-y-2">
                    <div className="text-gray-600">
                      These terms are normalized to 0-1 and feed Harmony and Complexity directly.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="border rounded p-2">
                        <div className="font-semibold">harmonyRaw</div>
                        <div className="text-gray-600">
                          Weighted average pair compatibility before clamping. Positive values mean synergy dominates; negative values mean clash dominates.
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          Current: {formatNumber(tasteDetails.interactionSummary.harmonyRaw, { decimals: 3, forceDecimals: true })}
                        </div>
                      </div>
                      <div className="border rounded p-2">
                        <div className="font-semibold">descriptorEntropy</div>
                        <div className="text-gray-600">
                          Shannon-style spread across all descriptors. Higher means flavor intensity is distributed across many descriptors rather than concentrated in a few.
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          Current: {formatNumber(descriptorEntropy, { decimals: 3, forceDecimals: true })}
                        </div>
                      </div>
                      <div className="border rounded p-2">
                        <div className="font-semibold">familyEntropy</div>
                        <div className="text-gray-600">
                          Shannon-style spread across flavor families. Higher means better family-level diversity instead of one dominant family.
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          Current: {formatNumber(familyEntropy, { decimals: 3, forceDecimals: true })}
                        </div>
                      </div>
                      <div className="border rounded p-2">
                        <div className="font-semibold">activeDescriptorRatio</div>
                        <div className="text-gray-600">
                          Share of descriptors above activity threshold (at least 25%). Higher means more descriptors are materially present.
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          Current: {formatNumber(activeDescriptorRatio * 100, { smartDecimals: true })}% active
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium">Taste Index Calculation</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 text-xs space-y-2">
                    <div className="text-gray-600">{tasteDetails.indexFormula}</div>
                    <div className="border rounded divide-y">
                      {tasteDetails.indexTerms.map((term) => (
                        <div key={term.metric} className="px-2 py-1.5 flex justify-between">
                          <span className="capitalize">
                            {term.metric} ({formatNumber(term.weight * 100, { smartDecimals: true })}%)
                          </span>
                          <span className="font-medium">
                            {formatNumber(term.weight, { decimals: 2, forceDecimals: true })} × {formatNumber(term.metricValue, { decimals: 3, forceDecimals: true })} = {formatNumber(term.contribution, { decimals: 3, forceDecimals: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-gray-200 flex justify-between text-sm">
                      <span className="font-medium">Taste Index</span>
                      <span className={`font-semibold ${getColorClass(tasteEvaluation.tasteIndex)}`}>
                        {formatNumber(tasteEvaluation.tasteIndex * 100, { smartDecimals: true })}%
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium">Synergy and Clash Contributions</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2">
                        <div className="font-semibold text-green-700">Top Synergies</div>
                        {tasteDetails.interactionSummary.topSynergies.length === 0 ? (
                          <div className="text-gray-500">No positive family interactions detected.</div>
                        ) : (
                          tasteDetails.interactionSummary.topSynergies.map((interaction) => (
                            <div key={`${interaction.familyA}-${interaction.familyB}`} className="border rounded px-2 py-1.5">
                              <div className="flex justify-between">
                                <span>{FLAVOR_FAMILY_LABELS[interaction.familyA]} + {FLAVOR_FAMILY_LABELS[interaction.familyB]}</span>
                                <span className="font-medium text-green-700">
                                  +{formatNumber(interaction.normalizedContribution, { decimals: 3, forceDecimals: true })}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500">
                                Compatibility {formatNumber(interaction.compatibility, { decimals: 2, forceDecimals: true })}, pair weight {formatNumber(interaction.pairWeight, { decimals: 3, forceDecimals: true })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="font-semibold text-red-700">Top Clashes</div>
                        {tasteDetails.interactionSummary.topClashes.length === 0 ? (
                          <div className="text-gray-500">No negative family interactions detected.</div>
                        ) : (
                          tasteDetails.interactionSummary.topClashes.map((interaction) => (
                            <div key={`${interaction.familyA}-${interaction.familyB}`} className="border rounded px-2 py-1.5">
                              <div className="flex justify-between">
                                <span>{FLAVOR_FAMILY_LABELS[interaction.familyA]} + {FLAVOR_FAMILY_LABELS[interaction.familyB]}</span>
                                <span className="font-medium text-red-700">
                                  {formatNumber(interaction.normalizedContribution, { decimals: 3, forceDecimals: true })}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500">
                                Compatibility {formatNumber(interaction.compatibility, { decimals: 2, forceDecimals: true })}, pair weight {formatNumber(interaction.pairWeight, { decimals: 3, forceDecimals: true })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-500">
                      harmonyRaw is the weighted average of family-pair compatibility, with pair mass = sum(f[a]*f[b]) across active pairs.
                      Current harmonyRaw: {formatNumber(tasteDetails.interactionSummary.harmonyRaw, { decimals: 3, forceDecimals: true })}, pair mass: {formatNumber(tasteDetails.interactionSummary.pairMass, { decimals: 3, forceDecimals: true })}.
                      Harmony metric then applies: clamp01(0.5 + 0.5*harmonyRaw).
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium">Flavor Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <div className="text-[11px] text-gray-600 mb-3">
                      Descriptors are atomic flavor notes, while Flavor Families are grouped categories built from descriptors.
                      Some families currently contain one descriptor (for example, Black Fruit), so the same name can appear in both lists.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-gray-600">Flavor Families</div>
                        {flavorFamilyRows.map((row) => (
                          <div key={row.familyId} className="text-xs">
                            <div className="flex justify-between">
                              <UnifiedTooltip
                                content={
                                  <div className="text-xs space-y-1">
                                    <div className="font-semibold">{row.label}</div>
                                    <div>
                                      Descriptors: {FAMILY_TO_DESCRIPTORS[row.familyId]
                                        .map((descriptorId) => descriptorId.replace(/([A-Z])/g, ' $1').replace(/^./, (v) => v.toUpperCase()))
                                        .join(', ')}
                                    </div>
                                    <div className="text-gray-500">This family contributes to harmony, complexity, and intensity metrics.</div>
                                  </div>
                                }
                                side="top"
                                className="max-w-sm"
                                variant="panel"
                                density="compact"
                              >
                                <span className="cursor-help">{row.label}</span>
                              </UnifiedTooltip>
                              <span className="font-medium">{formatNumber(row.value * 100, { smartDecimals: true })}%</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded bg-gray-100 overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${Math.max(1, row.value * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                        <details className="mt-2 rounded border border-gray-200 p-2">
                          <summary className="cursor-pointer font-medium text-[11px] text-gray-700">Expand full family-to-descriptor map</summary>
                          <div className="mt-2 space-y-1 text-[11px]">
                            {Object.entries(FAMILY_TO_DESCRIPTORS).map(([familyId, descriptorIds]) => (
                              <div key={familyId}>
                                <span className="font-medium">{FLAVOR_FAMILY_LABELS[familyId as FlavorFamilyId]}:</span>{' '}
                                {descriptorIds.map((descriptorId) => descriptorId.replace(/([A-Z])/g, ' $1').replace(/^./, (v) => v.toUpperCase())).join(', ')}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-gray-600">Top Descriptors</div>
                        {descriptorRows.map((row) => (
                          <div key={row.descriptorId} className="text-xs">
                            <div className="flex justify-between">
                              <span>{row.label}</span>
                              <span className="font-medium">{formatNumber(row.value * 100, { smartDecimals: true })}%</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded bg-gray-100 overflow-hidden">
                              <div className="h-full bg-amber-500" style={{ width: `${Math.max(1, row.value * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium">Flavor Origins</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 text-xs space-y-3">
                    <div className="text-gray-600">
                      Origins show how flavor was built in raw space before normalization to 0-1 descriptor intensity.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      {tasteDetails.profileOrigins.stageTotals.map((stageTotal) => (
                        <div key={stageTotal.stage} className="border rounded p-2">
                          <div className="font-medium">{formatOriginStageLabel(stageTotal.stage)}</div>
                          <div className={`text-[11px] ${stageTotal.signedDeltaRaw >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            Signed: {stageTotal.signedDeltaRaw >= 0 ? '+' : ''}{formatNumber(stageTotal.signedDeltaRaw, { decimals: 3, forceDecimals: true })}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Absolute: {formatNumber(stageTotal.absoluteDeltaRaw, { decimals: 3, forceDecimals: true })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {flavorOriginRows.map((familyOrigin) => {
                        const descriptorIds = FAMILY_TO_DESCRIPTORS[familyOrigin.familyId];
                        return (
                          <details key={familyOrigin.familyId} className="rounded border border-gray-200 p-2">
                            <summary className="cursor-pointer flex items-center justify-between gap-2">
                              <span className="font-medium">{FLAVOR_FAMILY_LABELS[familyOrigin.familyId]}</span>
                              <span>{formatNumber(familyOrigin.value * 100, { smartDecimals: true })}%</span>
                            </summary>
                            <div className="mt-2 space-y-2">
                              <div>
                                <div className="text-[11px] font-medium text-gray-700">All Source Drivers</div>
                                {familyOrigin.topSources.length === 0 ? (
                                  <div className="text-[11px] text-gray-500">No tracked drivers for this family.</div>
                                ) : (
                                  <div className="space-y-1 mt-1">
                                    {familyOrigin.topSources.map((source) => (
                                      <div key={`${source.stage}-${source.source}`} className="flex justify-between text-[11px]">
                                        <span>{formatOriginSourceLabel(source.source)}</span>
                                        <span className={source.impactRaw >= 0 ? 'text-green-700' : 'text-red-700'}>
                                          {source.impactRaw >= 0 ? '+' : ''}{formatNumber(source.impactRaw, { decimals: 3, forceDecimals: true })} ({formatOriginStageLabel(source.stage)})
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <div className="text-[11px] font-medium text-gray-700">Family Descriptors</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mt-1">
                                  {descriptorIds.map((descriptorId) => {
                                    const descriptorOrigin = tasteDetails.profileOrigins.descriptorOrigins[descriptorId];
                                    const allTerms = descriptorOrigin?.terms || [];
                                    return (
                                      <div key={descriptorId} className="rounded bg-gray-50 p-1.5 text-[11px]">
                                        <div className="flex justify-between">
                                          <span>{formatDescriptorLabel(descriptorId)}</span>
                                          <span>{formatNumber((descriptorOrigin?.normalizedValue || 0) * 100, { smartDecimals: true })}%</span>
                                        </div>
                                        {allTerms.length === 0 ? (
                                          <div className="text-gray-500">No tracked drivers</div>
                                        ) : allTerms.map((term, index) => (
                                          <div key={`${descriptorId}-${term.source}-${index}`} className="flex justify-between text-gray-600">
                                            <span>
                                              {formatOriginSourceLabel(term.source)}
                                              {term.occurrences && term.occurrences > 1 ? ` (${term.occurrences}x)` : ''}
                                            </span>
                                            <span className={term.deltaRaw >= 0 ? 'text-green-700' : 'text-red-700'}>
                                              {term.deltaRaw >= 0 ? '+' : ''}{formatNumber(term.deltaRaw, { decimals: 3, forceDecimals: true })}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </details>
                        );
                      })}
                    </div>
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
                                <img src={characteristicIconSrc[key as string]} alt={`${key} icon`} className="h-5 w-5 object-contain" />
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
                                          <span className="text-[10px] text-muted-foreground">({e.count}x)</span>
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


