import React, { useState, useEffect, useMemo } from 'react';
import { WineBatch, Vineyard } from '@/lib/types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../shadCN/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../shadCN/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../shadCN/card';
import { Badge } from '../../shadCN/badge';
import { TooltipSection, TooltipRow, tooltipStyles, UnifiedTooltip } from '../../shadCN/tooltip';
import { Wine, Calendar, MapPin, Award, AlertTriangle, TrendingUp, BarChart3, Radar, History } from 'lucide-react';
import { DialogProps } from '@/lib/types/UItypes';
import { formatNumber, getFlagIcon } from '@/lib/utils';
import { getCharacteristicIconSrc } from '@/lib/utils/icons';
import { getQualityCategory, getQualityDescription, getWineStructureCategory, getWineStructureDescription, getColorClass } from '@/lib/utils/utils';
import { LandValueModifierFactorsBreakdown } from '../../components/landValueModifierBreakdown';
import { StructureIndexBreakdown } from '../../components/StructureIndexBreakdown';
import { FeatureDisplay } from '../../components/FeatureDisplay';
import { WineCharacteristicsDisplay } from '../../components/characteristicBar';
import { WineTasteProfilePanel } from '../../components/WineTasteProfilePanel';
import { getStoredVineyards, getWineAgeFromHarvest, getWineBatchDisplayName } from '@/lib/services';
import { useWineBatchStructureIndex, useWinePriceCalculator } from '@/hooks';
import { calculateEstimatedPriceBreakdown } from '@/lib/services/wine/winescore/wineScoreCalculation';
import { getAdminFeature } from '@/lib/features/admin';
import { analyzeWineAnchorDownstreamImpact } from '@/lib/services/wine/debug/wineAnchorImpactDebugService';
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';

interface WineModalProps extends DialogProps {
  wineBatch: WineBatch | null;
  wineName?: string;
}

/**
 * Unified Wine Modal
 * Comprehensive wine details in a tabbed interface
 * Replaces separate taste quality, structure breakdown modal, and expand/collapse patterns
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
      if (wineBatch.originSnapshot?.sourceKind === 'market' && wineBatch.originSnapshot.provenance) {
        const source = wineBatch.originSnapshot.provenance;
        setVineyard({
          id: wineBatch.vineyardId,
          name: wineBatch.vineyardName,
          country: source.country,
          region: source.region,
          hectares: 1,
          grape: wineBatch.grape,
          vineAge: source.vineAge,
          soil: source.soil,
          altitude: source.altitude,
          aspect: source.aspect,
          density: source.density,
          vineyardHealth: source.vineyardHealth,
          landValue: source.landValue,
          vineyardTotalValue: source.landValue,
          status: 'Growing',
          ripeness: source.ripeness,
          vineyardPrestige: source.vineyardPrestige,
          vineYield: 1,
          overgrowth: source.overgrowth ?? { vegetation: 0, debris: 0, uproot: 0, replant: 0 },
          pendingFeatures: source.pendingFeatures ?? [],
        });
        return;
      }

      getStoredVineyards().then((vineyards) => {
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

  // Structure index + ideal bands respect batch wine profile (anchors), same as Structure tab breakdown
  const batchStructureResult = useWineBatchStructureIndex(wineBatch);
  const currentStructureIndex: number =
    batchStructureResult?.score ?? wineBatch?.structureIndex ?? 0;

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
  const showDevAnchorDebug = getAdminFeature().isAvailable();
  const anchorDebug = useMemo(() => {
    if (!wineBatch) return null;
    return analyzeWineAnchorDownstreamImpact(
      wineBatch,
      vineyard || undefined,
      prestige,
      vineyard?.vineyardPrestige
    );
  }, [wineBatch, vineyard, prestige]);

  // Early return AFTER all hooks are called
  if (!wineBatch || !estimatedPriceBreakdown) return null;

  const displayName = wineName || getWineBatchDisplayName(wineBatch);
  const baseGrapeCharacteristics = GRAPE_CONST[wineBatch.grape]?.baseCharacteristics;
  const currentTasteQualityIndex: number = estimatedPriceBreakdown.tasteQualityIndex;
  const landValueModifier: number = wineBatch.landValueModifier;
  const currentWineScore = estimatedPriceBreakdown.wineScore;
  const hasFeatureMultiplier = Math.abs(estimatedPriceBreakdown.featurePriceMultiplier - 1) > 0.0005;
  const hasCompanyPrestigeMultiplier = Math.abs(estimatedPriceBreakdown.companyPrestigeMultiplier - 1) > 0.0005;
  const hasVineyardPrestigeMultiplier = Math.abs(estimatedPriceBreakdown.vineyardPrestigeMultiplier - 1) > 0.0005;
  const qualityCategory = getQualityCategory(currentTasteQualityIndex);
  const qualityColorClass = getColorClass(currentTasteQualityIndex);
  const characteristicOrder: Array<keyof WineBatch['characteristics']> = ['acidity','aroma','body','spice','sweetness','tannins'] as any;
  const harvestWineScore = (wineBatch.tasteQualityIndexHarvestSnapshot + wineBatch.structureIndexHarvestSnapshot) / 2;
  const snapshotRows = [
    {
      label: 'Taste Quality',
      harvest: wineBatch.tasteQualityIndexHarvestSnapshot,
      current: currentTasteQualityIndex,
      bottling: wineBatch.tasteQualityIndexBottlingSnapshot
    },
    {
      label: 'Structure',
      harvest: wineBatch.structureIndexHarvestSnapshot,
      current: currentStructureIndex,
      bottling: wineBatch.structureIndexBottlingSnapshot
    },
    {
      label: 'Land Value',
      harvest: wineBatch.landValueModifierHarvestSnapshot,
      current: landValueModifier,
      bottling: wineBatch.landValueModifierBottlingSnapshot
    },
    {
      label: 'Wine Score',
      harvest: harvestWineScore,
      current: currentWineScore,
      bottling: wineBatch.wineScoreBottlingSnapshot
    }
  ];
  const formatSnapshotValue = (value?: number | null): string =>
    typeof value === 'number' && Number.isFinite(value)
      ? formatNumber(value, { decimals: 2, forceDecimals: true })
      : 'n/a';
  const getDeltaTextClass = (value: number): string => {
    if (value > 0) return 'text-emerald-700';
    if (value < 0) return 'text-red-700';
    return 'text-muted-foreground';
  };
  const formatSigned = (value: number, currency: boolean = false): string => {
    const formatted = formatNumber(Math.abs(value), currency ? { currency: true, decimals: 2 } : { decimals: 3, forceDecimals: true });
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return currency ? formatNumber(0, { currency: true, decimals: 2 }) : formatNumber(0, { decimals: 3, forceDecimals: true });
  };
  const formatAnchorLabel = (key: string): string =>
    key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (value) => value.toUpperCase());
  const formatFlavorFamilyLabel = (key: string): string =>
    key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (value) => value.toUpperCase());
  const formatPriceInputLabel = (key: string): string => {
    const map: Record<string, string> = {
      basePrice: 'Base Price',
      wineScoreMultiplier: 'Wine Score Multiplier',
      landValuePriceMultiplier: 'Land Value Multiplier',
      featurePriceMultiplier: 'Feature Multiplier',
      prePrestigePrice: 'Pre-Prestige Price',
      companyPrestigeMultiplier: 'Company Prestige Multiplier',
      vineyardPrestigeMultiplier: 'Vineyard Prestige Multiplier',
      finalPrice: 'Final Price'
    };
    return map[key] || formatFlavorFamilyLabel(key);
  };
  const formatAnchorEffectDescription = (description: string): string => {
    if (description === 'Harvest identity (combined)') return 'Harvest anchor blend (multiple harvest additions)';
    if (description === 'Harvest identity') return 'Harvest anchor snapshot (single harvest)';
    return description;
  };
  const structureImpactOrder: Array<keyof WineBatch['characteristics']> = [
    'acidity',
    'aroma',
    'body',
    'spice',
    'sweetness',
    'tannins'
  ] as any;
  const TASTE_FAMILY_EPSILON = 0.0005;
  const anchorOrigins = anchorDebug
    ? Object.keys(anchorDebug.currentAnchors).map((anchorKey) => {
        const key = anchorKey as keyof typeof anchorDebug.currentAnchors;
        const rawEffects = anchorDebug.anchorEffects.filter((entry) => entry.anchor === key);
        const groupedEffects = rawEffects.reduce((acc, effect) => {
          const existing = acc.find((entry) => entry.description === effect.description);
          if (existing) {
            existing.modifier += effect.modifier;
            existing.count += 1;
          } else {
            acc.push({
              description: formatAnchorEffectDescription(effect.description),
              modifier: effect.modifier,
              count: 1
            });
          }
          return acc;
        }, [] as Array<{ description: string; modifier: number; count: number }>);
        const totalEffect = groupedEffects.reduce((sum, effect) => sum + effect.modifier, 0);
        const baseValue = anchorDebug.currentAnchors[key] - totalEffect;
        return {
          key: anchorKey,
          current: anchorDebug.currentAnchors[key],
          baseValue,
          totalEffect,
          groupedEffects
        };
      })
    : [];

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
                {wineBatch.harvestStartDate.year} Vintage • {weeksSinceHarvest} weeks since harvest
                {wineBatch.state === 'bottled' && wineBatch.agingProgress != null && wineBatch.agingProgress > 0 && (
                  <> • {wineBatch.agingProgress} weeks in bottle</>
                )}
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
              Taste quality, land value, structure, features, and origins—including how your wine profile shapes modifiers and scores.
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
                        <span className="text-muted-foreground">Vintage age:</span>
                        <span className="font-medium">{weeksSinceHarvest} weeks (since harvest)</span>
                      </div>
                      {wineBatch.state === 'bottled' && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Bottle age:</span>
                          <span className="font-medium">{wineBatch.agingProgress ?? 0} weeks (in bottle)</span>
                        </div>
                      )}
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
                        <span className="text-muted-foreground">Taste Quality:</span>
                        <UnifiedTooltip
                          content={
                            <div className={tooltipStyles.text}>
                              <TooltipSection title="Taste Quality Details">
                                <TooltipRow
                                  label="Taste Quality:"
                                  value={formatNumber(currentTasteQualityIndex, { decimals: 2, forceDecimals: true })}
                                  valueRating={currentTasteQualityIndex}
                                />
                                <TooltipRow
                                  label="Category:"
                                  value={getQualityCategory(currentTasteQualityIndex)}
                                />
                                <div className="mt-2 pt-2 border-t border-gray-600">
                                  <div className="text-xs text-gray-300">{getQualityDescription(currentTasteQualityIndex)}</div>
                                </div>
                              </TooltipSection>
                            </div>
                          }
                          title="Taste Quality Details"
                          side="top"
                          sideOffset={8}
                          className="max-w-xs"
                          variant="panel"
                          density="compact"
                          triggerClassName="text-right cursor-help"
                        >
                          <div className="text-right cursor-help">
                            <div className={`font-medium ${getColorClass(currentTasteQualityIndex)}`}>
                              {formatNumber(currentTasteQualityIndex, { decimals: 2, forceDecimals: true })}
                            </div>
                            <div className="text-xs text-gray-500">{getQualityCategory(currentTasteQualityIndex)}</div>
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
                      <History className="h-4 w-4" /> Snapshots
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 text-sm">
                    <div className="overflow-x-auto scrollbar-styled">
                      <div className="grid min-w-[34rem] grid-cols-[minmax(8rem,1fr)_repeat(3,minmax(5rem,6rem))] gap-2 text-[11px]">
                        <div className="font-medium text-muted-foreground">Metric</div>
                        <div className="text-right font-medium text-muted-foreground">Harvest</div>
                        <div className="text-right font-medium text-muted-foreground">Current</div>
                        <div className="text-right font-medium text-muted-foreground">Bottling</div>
                        {snapshotRows.map((row) => (
                          <React.Fragment key={row.label}>
                            <div className="rounded bg-muted/40 px-2 py-1 font-medium text-foreground">
                              {row.label}
                            </div>
                            <div className="rounded bg-muted/40 px-2 py-1 text-right font-mono tabular-nums">
                              {formatSnapshotValue(row.harvest)}
                            </div>
                            <div className="rounded bg-muted/40 px-2 py-1 text-right font-mono tabular-nums">
                              {formatSnapshotValue(row.current)}
                            </div>
                            <div className="rounded bg-muted/40 px-2 py-1 text-right font-mono tabular-nums">
                              {formatSnapshotValue(row.bottling)}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      Harvest and bottling values are frozen snapshots; current values update with cellar evolution.
                    </p>
                  </CardContent>
                </Card>

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

                {showDevAnchorDebug && anchorDebug && (
                  <Card className="border-amber-300 bg-amber-50/60">
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs font-medium flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Anchor Impact Trace
                        </span>
                        <Badge variant="outline" className="bg-white text-amber-900 border-amber-300">DEV</Badge>
                      </CardTitle>
                      <p className="text-[11px] text-amber-900/80">
                        Counterfactual trace: current anchors vs neutral anchors, with all other batch state unchanged.
                      </p>
                    </CardHeader>
                    <CardContent className="py-3 space-y-3">
                      {!anchorDebug.hasRecordedAnchorHistory && (
                        <div className="rounded border border-amber-300 bg-amber-100/70 px-2.5 py-2 text-[11px] text-amber-900">
                          This batch has no persisted anchor history. Origins below are shown as a single legacy snapshot from neutral.
                        </div>
                      )}
                      <div className="overflow-x-auto scrollbar-styled">
                        <div className="grid min-w-[34rem] grid-cols-[minmax(10rem,1fr)_repeat(3,minmax(5rem,7rem))] gap-2 text-[11px]">
                          <div className="font-medium text-amber-900/90">Anchor</div>
                          <div className="text-right font-medium text-amber-900/90">Current</div>
                          <div className="text-right font-medium text-amber-900/90">Neutral</div>
                          <div className="text-right font-medium text-amber-900/90">Delta</div>
                          {Object.keys(anchorDebug.currentAnchors).map((anchorKey) => {
                            const key = anchorKey as keyof typeof anchorDebug.currentAnchors;
                            const delta = anchorDebug.anchorDeltaFromNeutral[key];
                            return (
                              <React.Fragment key={anchorKey}>
                                <div className="rounded bg-white px-2 py-1 font-medium text-foreground">
                                  {formatAnchorLabel(anchorKey)}
                                </div>
                                <div className="rounded bg-white px-2 py-1 text-right font-mono tabular-nums">
                                  {formatNumber(anchorDebug.currentAnchors[key], { decimals: 3, forceDecimals: true })}
                                </div>
                                <div className="rounded bg-white px-2 py-1 text-right font-mono tabular-nums">
                                  {formatNumber(anchorDebug.neutralAnchors[key], { decimals: 3, forceDecimals: true })}
                                </div>
                                <div className={`rounded bg-white px-2 py-1 text-right font-mono tabular-nums ${getDeltaTextClass(delta)}`}>
                                  {formatSigned(delta)}
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>

                      <div className="overflow-x-auto scrollbar-styled">
                        <div className="grid min-w-[34rem] grid-cols-[minmax(10rem,1fr)_repeat(3,minmax(6rem,8rem))] gap-2 text-[11px]">
                          <div className="font-medium text-amber-900/90">Downstream</div>
                          <div className="text-right font-medium text-amber-900/90">Current</div>
                          <div className="text-right font-medium text-amber-900/90">Neutral</div>
                          <div className="text-right font-medium text-amber-900/90">Delta</div>

                          <div className="rounded bg-white px-2 py-1 font-medium text-foreground">Structure Index</div>
                          <div className="rounded bg-white px-2 py-1 text-right font-mono tabular-nums">{formatNumber(anchorDebug.current.structureIndex, { decimals: 3, forceDecimals: true })}</div>
                          <div className="rounded bg-white px-2 py-1 text-right font-mono tabular-nums">{formatNumber(anchorDebug.neutralBaseline.structureIndex, { decimals: 3, forceDecimals: true })}</div>
                          <div className={`rounded bg-white px-2 py-1 text-right font-mono tabular-nums ${getDeltaTextClass(anchorDebug.delta.structureIndex)}`}>{formatSigned(anchorDebug.delta.structureIndex)}</div>

                          <div className="rounded bg-white px-2 py-1 font-medium text-foreground">Taste Quality</div>
                          <div className="rounded bg-white px-2 py-1 text-right font-mono tabular-nums">{formatNumber(anchorDebug.current.tasteQualityIndex, { decimals: 3, forceDecimals: true })}</div>
                          <div className="rounded bg-white px-2 py-1 text-right font-mono tabular-nums">{formatNumber(anchorDebug.neutralBaseline.tasteQualityIndex, { decimals: 3, forceDecimals: true })}</div>
                          <div className={`rounded bg-white px-2 py-1 text-right font-mono tabular-nums ${getDeltaTextClass(anchorDebug.delta.tasteQualityIndex)}`}>{formatSigned(anchorDebug.delta.tasteQualityIndex)}</div>

                          <div className="rounded bg-white px-2 py-1 font-medium text-foreground">Wine Score</div>
                          <div className="rounded bg-white px-2 py-1 text-right font-mono tabular-nums">{formatNumber(anchorDebug.current.wineScore, { decimals: 3, forceDecimals: true })}</div>
                          <div className="rounded bg-white px-2 py-1 text-right font-mono tabular-nums">{formatNumber(anchorDebug.neutralBaseline.wineScore, { decimals: 3, forceDecimals: true })}</div>
                          <div className={`rounded bg-white px-2 py-1 text-right font-mono tabular-nums ${getDeltaTextClass(anchorDebug.delta.wineScore)}`}>{formatSigned(anchorDebug.delta.wineScore)}</div>

                          <div className="rounded bg-white px-2 py-1 font-medium text-foreground">Estimated Price</div>
                          <div className="rounded bg-white px-2 py-1 text-right font-mono tabular-nums">{formatNumber(anchorDebug.current.estimatedPrice, { currency: true, decimals: 2 })}</div>
                          <div className="rounded bg-white px-2 py-1 text-right font-mono tabular-nums">{formatNumber(anchorDebug.neutralBaseline.estimatedPrice, { currency: true, decimals: 2 })}</div>
                          <div className={`rounded bg-white px-2 py-1 text-right font-mono tabular-nums ${getDeltaTextClass(anchorDebug.delta.estimatedPrice)}`}>{formatSigned(anchorDebug.delta.estimatedPrice, true)}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[11px] font-medium text-amber-900/90">Anchor Origins</div>
                        <div className="text-[10px] text-muted-foreground">
                          Harvest anchor snapshot = anchor values created at harvest from grape, vineyard site, and ripeness.
                          If the batch receives another harvest addition, snapshots are blended by quantity.
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {anchorOrigins.map((origin) => (
                            <div key={origin.key} className="rounded border bg-white p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-medium">{formatAnchorLabel(origin.key)}</div>
                                <div className="text-xs font-mono tabular-nums">
                                  {formatNumber(origin.current, { decimals: 3, forceDecimals: true })}
                                </div>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                Base: <span className="font-mono">{formatNumber(origin.baseValue, { decimals: 3, forceDecimals: true })}</span>
                                {' | '}
                                Total effects: <span className={`font-mono ${getDeltaTextClass(origin.totalEffect)}`}>{formatSigned(origin.totalEffect)}</span>
                              </div>
                              <div className="space-y-1">
                                {origin.groupedEffects.map((effect) => (
                                  <div key={effect.description} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-[11px]">
                                    <div
                                      className="break-words pr-2"
                                      title={effect.description}
                                    >
                                      {effect.description}
                                      {effect.count > 1 && <span className="text-muted-foreground"> ({effect.count}x)</span>}
                                    </div>
                                    <div className={`font-mono tabular-nums ${getDeltaTextClass(effect.modifier)}`}>
                                      {formatSigned(effect.modifier)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="overflow-x-auto scrollbar-styled">
                        <div className="grid min-w-[48rem] grid-cols-[minmax(10rem,1fr)_repeat(4,minmax(5.5rem,7rem))] gap-2 text-[11px]">
                          <div className="font-medium text-amber-900/90">Isolated Anchor Impact (Totals)</div>
                          <div className="text-right font-medium text-amber-900/90">Structure Delta</div>
                          <div className="text-right font-medium text-amber-900/90">Taste Delta</div>
                          <div className="text-right font-medium text-amber-900/90">Score Delta</div>
                          <div className="text-right font-medium text-amber-900/90">Price Delta</div>
                          {anchorDebug.isolatedAnchorImpacts.map((impact) => (
                            <React.Fragment key={`isolated-${impact.anchor}`}>
                              <div className="rounded bg-white px-2 py-1 font-medium text-foreground">
                                {formatAnchorLabel(String(impact.anchor))}
                              </div>
                              <div className={`rounded bg-white px-2 py-1 text-right font-mono tabular-nums ${getDeltaTextClass(impact.delta.structureIndex)}`}>
                                {formatSigned(impact.delta.structureIndex)}
                              </div>
                              <div className={`rounded bg-white px-2 py-1 text-right font-mono tabular-nums ${getDeltaTextClass(impact.delta.tasteQualityIndex)}`}>
                                {formatSigned(impact.delta.tasteQualityIndex)}
                              </div>
                              <div className={`rounded bg-white px-2 py-1 text-right font-mono tabular-nums ${getDeltaTextClass(impact.delta.wineScore)}`}>
                                {formatSigned(impact.delta.wineScore)}
                              </div>
                              <div className={`rounded bg-white px-2 py-1 text-right font-mono tabular-nums ${getDeltaTextClass(impact.delta.estimatedPrice)}`}>
                                {formatSigned(impact.delta.estimatedPrice, true)}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[11px] font-medium text-amber-900/90">{'Isolated Anchor -> Structure Characteristic Delta'}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {anchorDebug.isolatedAnchorImpacts.map((impact) => (
                            <div key={`structure-detail-${impact.anchor}`} className="rounded border bg-white p-2.5 space-y-1.5">
                              <div className="text-xs font-medium">{formatAnchorLabel(String(impact.anchor))}</div>
                              <div className="grid grid-cols-[minmax(7rem,1fr)_minmax(5rem,auto)] gap-1 text-[11px]">
                                {structureImpactOrder.map((characteristic) => {
                                  const delta = impact.structureCharacteristicDelta[characteristic];
                                  return (
                                    <React.Fragment key={`${impact.anchor}-${String(characteristic)}`}>
                                      <div className="text-muted-foreground">{formatAnchorLabel(String(characteristic))}</div>
                                      <div className={`text-right font-mono tabular-nums ${getDeltaTextClass(delta)}`}>
                                        {formatSigned(delta)}
                                      </div>
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[11px] font-medium text-amber-900/90">{'Isolated Anchor -> Taste Family Delta (All families)'}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {anchorDebug.isolatedAnchorImpacts.map((impact) => {
                            const allTasteDeltas = Object.entries(impact.tasteFamilyDelta)
                              .map(([family, delta]) => ({ family, delta }))
                              .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
                            return (
                              <div key={`taste-detail-${impact.anchor}`} className="rounded border bg-white p-2.5 space-y-1.5">
                                <div className="text-xs font-medium">{formatAnchorLabel(String(impact.anchor))}</div>
                                <div className="grid grid-cols-[minmax(7rem,1fr)_minmax(5rem,auto)] gap-1 text-[11px]">
                                  {allTasteDeltas.map((entry) => (
                                    <React.Fragment key={`${impact.anchor}-${entry.family}`}>
                                      <div className="text-muted-foreground">{formatFlavorFamilyLabel(entry.family)}</div>
                                      <div
                                        className={`text-right font-mono tabular-nums ${
                                          Math.abs(entry.delta) <= TASTE_FAMILY_EPSILON ? 'text-muted-foreground' : getDeltaTextClass(entry.delta)
                                        }`}
                                      >
                                        {formatSigned(entry.delta)}
                                      </div>
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[11px] font-medium text-amber-900/90">{'Isolated Anchor -> Price Input Delta'}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {anchorDebug.isolatedAnchorImpacts.map((impact) => {
                            const topPriceDeltas = Object.entries(impact.priceInputDelta)
                              .map(([key, delta]) => ({ key, delta }))
                              .filter((entry) => Math.abs(entry.delta) > 0.0005)
                              .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
                            return (
                              <div key={`price-detail-${impact.anchor}`} className="rounded border bg-white p-2.5 space-y-1.5">
                                <div className="text-xs font-medium">{formatAnchorLabel(String(impact.anchor))}</div>
                                <div className="rounded bg-muted/30 px-2 py-1.5">
                                  <div className="text-[10px] font-medium text-muted-foreground">{'Flow: anchor -> structure/taste -> score -> price'}</div>
                                  <div className="mt-1 grid grid-cols-[minmax(8rem,1fr)_minmax(5rem,auto)] gap-1 text-[11px]">
                                    <div className="text-muted-foreground">Structure Delta</div>
                                    <div className={`text-right font-mono tabular-nums ${getDeltaTextClass(impact.delta.structureIndex)}`}>{formatSigned(impact.delta.structureIndex)}</div>
                                    <div className="text-muted-foreground">Taste Delta</div>
                                    <div className={`text-right font-mono tabular-nums ${getDeltaTextClass(impact.delta.tasteQualityIndex)}`}>{formatSigned(impact.delta.tasteQualityIndex)}</div>
                                    <div className="text-muted-foreground">Wine Score Delta</div>
                                    <div className={`text-right font-mono tabular-nums ${getDeltaTextClass(impact.delta.wineScore)}`}>{formatSigned(impact.delta.wineScore)}</div>
                                  </div>
                                </div>
                                {topPriceDeltas.length === 0 ? (
                                  <div className="text-[11px] text-muted-foreground">No material price-input movement.</div>
                                ) : (
                                  <div className="grid grid-cols-[minmax(8rem,1fr)_minmax(5rem,auto)] gap-1 text-[11px]">
                                    {topPriceDeltas.map((entry) => (
                                      <React.Fragment key={`${impact.anchor}-${entry.key}`}>
                                        <div className="text-muted-foreground">{formatPriceInputLabel(entry.key)}</div>
                                        <div className={`text-right font-mono tabular-nums ${getDeltaTextClass(entry.delta)}`}>
                                          {entry.key.toLowerCase().includes('price')
                                            ? formatSigned(entry.delta, true)
                                            : formatSigned(entry.delta)}
                                        </div>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                      <span className="text-muted-foreground">Vintage age:</span>
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
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Computed flavor wheel and tasting notes are on the <span className="font-medium text-foreground">Taste</span>{' '}
                  tab; here you see structure channels and balance rules.
                </p>

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
                      adjustedRanges={batchStructureResult?.adjustedRanges}
                      baseValues={baseGrapeCharacteristics}
                      structureIndexValue={currentStructureIndex}
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
                  wineAnchors={wineBatch.wineAnchors}
                  showWineStyleRules={true}
                />
              </div>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features" className="mt-4">
              <div className="space-y-4">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  See how present features skew fault, lees, and aging flavors on the{' '}
                  <span className="font-medium text-foreground">Taste</span> tab wheel.
                </p>

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

            {/* Taste tab */}
            <TabsContent value="taste" className="mt-4">
              <div className="space-y-4">
                <WineTasteProfilePanel batch={wineBatch} />
              </div>
            </TabsContent>

            {/* Origins Tab */}
            <TabsContent value="origins" className="mt-4">
              <div className="space-y-4">
                {wineBatch.originSnapshot && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> Source Snapshot
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 text-sm space-y-2">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Source</span>
                        <span className="font-medium capitalize">{wineBatch.originSnapshot.sourceKind}</span>
                      </div>
                      {wineBatch.originSnapshot.supplierName && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Supplier</span>
                          <span className="font-medium">{wineBatch.originSnapshot.supplierName}</span>
                        </div>
                      )}
                      {wineBatch.originSnapshot.terroirSummary && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Terroir</span>
                          <span className="font-medium text-right">{wineBatch.originSnapshot.terroirSummary}</span>
                        </div>
                      )}
                      {wineBatch.originSnapshot.previewState && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Preview State</span>
                          <span className="font-medium">{wineBatch.originSnapshot.previewState.replace('_', ' ')}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium">Characteristic origins</CardTitle>
                    <p className="text-[11px] text-muted-foreground font-normal mt-1 leading-relaxed">
                      Stacked modifiers by source. Harvest and winery steps were applied with strength shaped by your batch
                      wine profile; features continue to update that profile over time. The{' '}
                      <span className="font-medium text-foreground">Taste</span> tab turns the same state into flavor
                      families and notes (0–1 bars).
                    </p>
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

