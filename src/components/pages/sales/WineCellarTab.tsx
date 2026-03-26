import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WineBatch } from '@/lib/types/types';
import { formatNumber, formatPercent, getQualityCategory, getColorClass, getRangeColor, getRatingForRange } from '@/lib/utils/utils';
import { getCharacteristicIconSrc } from '@/lib/utils/icons';
import { SALES_CONSTANTS } from '@/lib/constants';
import { useTableSortWithAccessors, SortableColumn } from '@/hooks';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Button, UnifiedTooltip, TooltipSection, TooltipRow, tooltipStyles } from '../../ui';
import { useWineBatchBalance, useFormattedBalance, useBalanceQuality, useWineCombinedScore, useWineFeatureDetails, useWinePriceCalculator } from '@/hooks';
import { triggerTopicUpdate } from '@/hooks/useGameUpdates';
import { saveWineBatch } from '@/lib/database/activities/inventoryDB';
import { calculateAgingStatus, getFeatureDisplayData, calculateWeeklyRiskIncrease } from '@/lib/services';
import { getCharacteristicEffectColorInfo } from '@/lib/utils/utils';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import { calculateEstimatedPriceBreakdown, getTasteIndex } from '@/lib/services/wine/winescore/wineScoreCalculation';
import { Pencil, Save, RotateCcw } from 'lucide-react';

const BatchBadge: React.FC<{ batch: WineBatch; className?: string }> = ({ batch, className = '' }) => {
 const groupSize = batch.batchGroupSize ?? 0;
 const batchNumber = batch.batchNumber ?? 0;

 if (groupSize <= 1 || batchNumber <= 0) {
 return null;
 }

 return (
 <span className={`inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 ${className}`}>
 Batch {batchNumber}/{groupSize}
 </span>
 );
};


// Component for combined balance and quality display
const BalanceAndQualityDisplay: React.FC<{ batch: WineBatch }> = ({ batch }) => {
 const balanceResult = useWineBatchBalance(batch);
 const formattedBalance = useFormattedBalance(balanceResult);
 const balanceQuality = useBalanceQuality(balanceResult);
 const balanceColorClass = getColorClass(batch.balance);

 const tasteIndex = getTasteIndex(batch);
 const qualityCategory = getQualityCategory(tasteIndex);
 const qualityColorClass = getColorClass(tasteIndex);
 const qualityPercentage = formatNumber(tasteIndex * 100, { smartDecimals: true });

 return (
 <div className="text-xs text-gray-600 space-y-1">
 <div>
 <span className="font-medium">Balance:</span> <span className={`font-medium ${balanceColorClass}`}>{formattedBalance}</span> ({balanceQuality})
 </div>
 <div>
 <span className="font-medium">Taste:</span> <span className={`font-medium ${qualityColorClass}`}>{qualityPercentage}%</span> ({qualityCategory})
 </div>
 </div>
 );
};

// Component for wine score display with tooltip
const WineScoreDisplay: React.FC<{ wine: WineBatch }> = ({ wine }) => {
 const wineScoreData = useWineCombinedScore(wine);
 const featureDetails = useWineFeatureDetails(wine);

 if (!wineScoreData || !featureDetails) return null;

 const { currentTasteIndex, tasteIndexPenalty, presentFeatures, hasTasteAffectingFeatures } = featureDetails;
 const baselineTasteIndex = wine.bornTasteIndex;

 return (
 <UnifiedTooltip
 content={
 <div className="space-y-1 text-xs">
 <div className="font-semibold">Wine Score Calculation</div>
 <div>Base Taste Index: <span className="font-medium">{formatPercent(baselineTasteIndex, 1, true)}</span></div>
 {hasTasteAffectingFeatures && tasteIndexPenalty > 0.001 && (
 <>
 <div className="text-red-600">
 Feature Penalty: <span className="font-medium">-{formatPercent(tasteIndexPenalty, 1, true)}</span>
 </div>
 <div className="ml-2 text-xs text-gray-600">
 {presentFeatures.map((f: any, idx: number) => (
 <div key={idx}> {f.feature.icon} {f.config.name}</div>
 ))}
 </div>
 <div>Current Taste Index: <span className="font-medium">{formatPercent(currentTasteIndex, 1, true)}</span></div>
 </>
 )}
 <div>Balance: <span className="font-medium">{formatPercent(wine.balance, 1, true)}</span></div>
 <div className="border-t pt-1 mt-1">Wine Score: <span className="font-medium">{wineScoreData.formattedScore}</span></div>
 <div className="border-t pt-1 mt-2 text-[10px] text-gray-500">
 Formula: (Taste Index + Balance) / 2
 </div>
 </div>
 }
 side="top"
 className="max-w-xs"
 variant="default"
 >
 <span className={`inline-flex px-2 py-1 text-[10px] font-semibold rounded-full cursor-help ${wineScoreData.badgeClasses.bg} ${wineScoreData.badgeClasses.text}`}>
 {wineScoreData.formattedScore}
 </span>
 </UnifiedTooltip>
 );
};


// Component for estimated price display with tooltip
const EstimatedPriceDisplay: React.FC<{
 wine: WineBatch;
 estimatedPrice: number;
 companyPrestige: number;
 vineyardPrestige?: number;
}> = ({ wine, estimatedPrice, companyPrestige, vineyardPrestige }) => {
 const wineScoreData = useWineCombinedScore(wine);
 const featureDetails = useWineFeatureDetails(wine);

 if (!wineScoreData || !featureDetails) return null;

 const breakdown = calculateEstimatedPriceBreakdown(
 wine,
 undefined,
 companyPrestige,
 vineyardPrestige
 );
 const hasFeatureMultiplier = Math.abs(breakdown.featurePriceMultiplier - 1) > 0.0005;
 const hasCompanyPrestige = Math.abs(breakdown.companyPrestigeMultiplier - 1) > 0.0005;
 const hasVineyardPrestige = Math.abs(breakdown.vineyardPrestigeMultiplier - 1) > 0.0005;

 const { presentFeatures, hasTasteAffectingFeatures, priceImpact } = featureDetails;

 return (
 <div className="space-y-1">
 <UnifiedTooltip
 content={
 <div className="space-y-1 text-xs">
 <div className="font-semibold">Estimated Price Calculation</div>
 <div>Taste Index: <span className="font-medium">{formatPercent(breakdown.tasteIndex, 1, true)}</span></div>
 <div>Balance: <span className="font-medium">{formatPercent(breakdown.balance, 1, true)}</span></div>
 <div>Wine Score: <span className="font-medium">{wineScoreData.formattedScore}</span></div>
 {hasTasteAffectingFeatures && priceImpact && priceImpact.priceDifference > 0.01 && (
 <>
 <div className="text-red-600 text-[10px]">
 Price reduced by {formatNumber(priceImpact.priceDifference, { currency: true, decimals: 2 })} due to:
 </div>
 <div className="text-[10px] text-gray-600">
 Reduction: {formatPercent(priceImpact.priceDifference / Math.max(0.0001, priceImpact.priceWithoutFeatures), 1, true)}
 </div>
 <div className="ml-2 text-[10px] text-gray-600">
 {presentFeatures.map((f: any, idx: number) => (
 <div key={idx}> {f.feature.icon} {f.config.name}</div>
 ))}
 </div>
 </>
 )}
 <div className="border-t pt-1 mt-1">Base Rate: <span className="font-medium">{formatNumber(SALES_CONSTANTS.BASE_RATE_PER_BOTTLE, { currency: true, decimals: 2 })}/bottle</span></div>
 <div>Base Price: <span className="font-medium">{formatNumber(breakdown.basePrice, { currency: true, decimals: 2 })}</span></div>
 <div>Score Curve Multiplier: <span className="font-medium">{formatNumber(breakdown.wineScoreMultiplier, { decimals: 2, forceDecimals: true })}x </span></div>
 <div>Land Value Modifier Index: <span className="font-medium">{formatNumber(breakdown.landValueModifier, { decimals: 2, forceDecimals: true })}</span></div>
 <div>Land Value Price Multiplier: <span className="font-medium">{formatNumber(breakdown.landValuePriceMultiplier, { decimals: 2, forceDecimals: true })}x </span></div>
 {hasFeatureMultiplier && (
 <div>Feature Multiplier: <span className="font-medium">{formatNumber(breakdown.featurePriceMultiplier, { decimals: 2, forceDecimals: true })} x</span></div>
 )}
 {hasCompanyPrestige && (
 <div>Company Prestige Multiplier: <span className="font-medium">{formatNumber(breakdown.companyPrestigeMultiplier, { decimals: 2, forceDecimals: true })}x </span></div>
 )}
 {hasVineyardPrestige && (
 <div>Vineyard Prestige Multiplier: <span className="font-medium">{formatNumber(breakdown.vineyardPrestigeMultiplier, { decimals: 2, forceDecimals: true })}x </span></div>
 )}
 <div className="border-t pt-1 mt-1">Final Estimated Price: <span className="font-medium">{formatNumber(breakdown.finalPrice, { currency: true, decimals: 2 })}</span></div>
 <div className="border-t pt-1 mt-2 text-[10px] text-gray-500">
 Formula: Base Price (Wine Score x Base Rate) x Score Curve x Land Multiplier{hasFeatureMultiplier ? ' x Feature Multiplier' : ''}{hasCompanyPrestige ? ' x Company Prestige' : ''}{hasVineyardPrestige ? ' x Vineyard Prestige' : ''}
 </div>
 <div className="text-[10px] text-gray-500">
 = {formatNumber(breakdown.wineScore, { decimals: 3, forceDecimals: true })} x {formatNumber(breakdown.baseRate, { decimals: 2, forceDecimals: true })} x {formatNumber(breakdown.wineScoreMultiplier, { decimals: 3, forceDecimals: true })} x {formatNumber(breakdown.landValuePriceMultiplier, { decimals: 3, forceDecimals: true })}{hasFeatureMultiplier ? ` x ${formatNumber(breakdown.featurePriceMultiplier, { decimals: 3, forceDecimals: true })}` : ''}{hasCompanyPrestige ? ` x ${formatNumber(breakdown.companyPrestigeMultiplier, { decimals: 3, forceDecimals: true })}` : ''}{hasVineyardPrestige ? ` x ${formatNumber(breakdown.vineyardPrestigeMultiplier, { decimals: 3, forceDecimals: true })}` : ''}
 </div>
 </div>
 }
 side="top"
 className="max-w-xs"
 variant="default"
 >
 <span className="cursor-help">{formatNumber(estimatedPrice, { currency: true, decimals: 2 })}</span>
 </UnifiedTooltip>
 </div>
 );
};


// Use centralized aging calculation service (imported from services)

// Component for aging progress bar with visual indicators
const AgingProgressBar: React.FC<{ wine: WineBatch }> = ({ wine }) => {
 const status = calculateAgingStatus(wine);

 const peakStatusLabels = {
 'developing': ' Developing',
 'early-peak': ' Early Peak',
 'peak': ' Peak Window',
 'mature': ' Mature',
 'past-peak': ' Past Peak'
 };

 return (
 <UnifiedTooltip
 content={
 <div className="space-y-1 text-xs">
 <div className="font-semibold">Aging Progress</div>
 <div>Age: <span className="font-medium">{formatNumber(status.ageInYears, { decimals: 2, adaptiveNearOne: true })} years ({status.ageInWeeks} weeks)</span></div>
 <div>Status: <span className="font-medium">{peakStatusLabels[status.peakStatus]}</span></div>
 <div>Maturity: <span className="font-medium">{formatNumber(status.progressPercent, { decimals: 2, adaptiveNearOne: true, smartDecimals: true })}%</span></div>
 <div className="border-t pt-1 mt-2 text-[10px] text-gray-500">
 Aging improves quality, characteristics, and value. Risk of oxidation increases over time.
 </div>
 </div>
 }
 side="top"
 className="max-w-xs"
 variant="default"
 >
 <div className="w-full space-y-1 cursor-help">
 <div className="flex justify-between items-center text-xs">
 <span className="font-medium">
 {status.ageInYears >= 1
 ? `${formatNumber(status.ageInYears, { decimals: 1, adaptiveNearOne: true })} years`
 : `${status.ageInWeeks} weeks`
 }
 </span>
 <span className="text-[10px] text-gray-500">{status.agingStage}</span>
 </div>
 <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
 <div
 className={`h-full ${status.progressColor} transition-all duration-300`}
 style={{ width: `${status.progressPercent}%` }}
 />
 </div>
 <div className="text-[10px] text-gray-600">{peakStatusLabels[status.peakStatus]} {formatNumber(status.progressPercent, { decimals: 2, adaptiveNearOne: true, smartDecimals: true })}%</div>
 </div>
 </UnifiedTooltip>
 );
};

// Component for manifested features (active features with severity > 0)
const ManifestedFeatures: React.FC<{ wine: WineBatch }> = ({ wine }) => {
 const displayData = getFeatureDisplayData(wine);

 if (displayData.activeFeatures.length === 0) {
 return <span className="text-[10px] text-gray-400"></span>;
 }

 return (
 <div className="flex gap-1">
 {displayData.activeFeatures.map(({ config }) => (
 <UnifiedTooltip
 key={config.id}
 content={<div className="text-xs">{config.name}</div>}
 side="top"
 variant="default"
 >
 <span className="text-sm cursor-help">{config.icon}</span>
 </UnifiedTooltip>
 ))}
 </div>
 );
};

// Component for risk features (features with risk > 0 but not yet manifested)
const RiskFeatures: React.FC<{ wine: WineBatch }> = ({ wine }) => {
 const displayData = getFeatureDisplayData(wine);

 if (displayData.riskFeatures.length === 0) {
 return <span className="text-[10px] text-gray-400"></span>;
 }

 return (
 <div className="space-y-1">
 {displayData.riskFeatures.map(({ feature, config, expectedWeeks }) => {
 const risk = feature.risk || 0;
 const riskPercent = formatNumber(risk * 100, { smartDecimals: true });

 // Check if this is an accumulation feature to show weekly increase
 const isAccumulation = config.behavior === 'accumulation';
 // Convert WineFeature to FeatureRiskInfo for calculateWeeklyRiskIncrease
 const featureRiskInfo = {
 featureId: feature.id,
 featureName: feature.name,
 icon: feature.icon,
 currentRisk: risk,
 newRisk: risk,
 riskIncrease: 0,
 isPresent: feature.isPresent,
 severity: feature.severity
 };
 const weeklyIncrease = isAccumulation ? calculateWeeklyRiskIncrease(wine, featureRiskInfo) : undefined;
 const weeklyIncreasePercent = weeklyIncrease ? formatNumber(weeklyIncrease * 100, { smartDecimals: true }) : null;

 // Use intelligent color coding for risk (lower risk = better colors)
 const riskColorClass = getRangeColor(1 - risk, 0, 1, 'higher_better').text;

 const displayElement = (
 <div className="text-xs">
 <span className="font-medium">{config.icon} {config.name}:</span>{' '}
 <span className={riskColorClass}>
 {riskPercent}% risk
 </span>
 {weeklyIncreasePercent && (
 <span className="text-gray-600"> (+{weeklyIncreasePercent}%/wk)</span>
 )}
 {expectedWeeks !== undefined && (
 <span className="text-gray-400 ml-1 text-[10px]">(~{expectedWeeks}w)</span>
 )}
 </div>
 );

 const tooltipBody = (
 <div className={`${tooltipStyles.text} space-y-2`}>
 <TooltipSection>
 <p className={tooltipStyles.title}>{config.name}</p>
 <p className={tooltipStyles.muted}>{config.description}</p>
 </TooltipSection>
 <TooltipSection>
 <TooltipRow
 label={`${config.name} Risk`}
 value={`${riskPercent}%`}
 valueRating={getRatingForRange(1 - risk, 0, 1, 'higher_better')}
 monospaced={true}
 />
 <p className={tooltipStyles.muted}>Chance this batch develops {config.name.toLowerCase()}.</p>
 {weeklyIncreasePercent && (
 <div className="mt-1">
 <TooltipRow
 label="Weekly increase"
 value={`+${weeklyIncreasePercent}% per week`}
 monospaced={true}
 />
 <p className={`${tooltipStyles.text} text-yellow-400 mt-1`}>
 Cumulative: This risk accumulates over time
 </p>
 </div>
 )}
 {expectedWeeks !== undefined && (
 <div className={`${tooltipStyles.warning} mt-1`}>Expected ~{expectedWeeks} weeks (statistical average)</div>
 )}
 <p className="mt-2">
 <span className={tooltipStyles.muted}>Current state:</span> <span className={tooltipStyles.subtitle}>{wine.state}</span>
 </p>
 </TooltipSection>
 </div>
 );

 return (
 <UnifiedTooltip
 key={config.id}
 content={tooltipBody}
 title={`${config.name} Risk Details`}
 side="top"
 className="max-w-sm"
 variant="panel"
 density="compact"
 triggerClassName="inline-block"
 >
 <div className="cursor-help">
 {displayElement}
 </div>
 </UnifiedTooltip>
 );
 })}
 </div>
 );
};

// Component for current effects display (separate column)
// Component for weekly effects display (separate column)
const WeeklyEffectsDisplay: React.FC<{ wine: WineBatch }> = ({ wine }) => {
 if (wine.state !== 'bottled') return null;

 const displayData = getFeatureDisplayData(wine);

 // Get significant effects (filtered by threshold)
 const weeklyEffects = Object.entries(displayData.combinedWeeklyEffects).filter(([_, effect]) => Math.abs(effect) > 0.0001);

 if (weeklyEffects.length === 0) {
 return <span className="text-[10px] text-gray-400"></span>;
 }

 // Determine grid columns based on effect count
 const effectCount = weeklyEffects.length;
 let gridCols = 'grid-cols-1';
 if (effectCount >= 4 && effectCount <= 6) {
 gridCols = 'grid-cols-2';
 } else if (effectCount >= 7) {
 gridCols = 'grid-cols-3';
 }

 return (
 <div className={`grid ${gridCols} gap-1`}>
 {weeklyEffects.map(([char, effect]) => {
 const currentValue = wine.characteristics[char as keyof typeof wine.characteristics] || 0;
 const balancedRange = BASE_BALANCED_RANGES[char as keyof typeof BASE_BALANCED_RANGES];
 const colorInfo = getCharacteristicEffectColorInfo(currentValue, effect, balancedRange);
 const bgClass = colorInfo.isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
 return (
 <UnifiedTooltip
 key={char}
 content={<div className="text-xs capitalize">{char}: {effect > 0 ? '+' : ''}{formatNumber(effect * 100, { smartDecimals: true })}% per week</div>}
 side="top"
 className="max-w-xs"
 variant="default"
 >
 <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] w-full ${bgClass}`}>
 <img
 src={getCharacteristicIconSrc(char)}
 alt={char}
 className="w-3 h-3"
 />
 <span>{effect > 0 ? '+' : ''}{formatNumber(effect * 100, { smartDecimals: true })}%/wk</span>
 </span>
 </UnifiedTooltip>
 );
 })}
 </div>
 );
};

interface WineCellarTabProps {
 bottledWines: WineBatch[];
 showSoldOut: boolean;
 setShowSoldOut: (show: boolean) => void;
 onWineDetailsClick: (batchId: string) => void;
}

const WineCellarTab: React.FC<WineCellarTabProps> = ({
 bottledWines,
 showSoldOut,
 setShowSoldOut,
 onWineDetailsClick
}) => {
 const [editingPrices, setEditingPrices] = useState<{[key: string]: string}>({});

 // Advanced filtering state
 const [filters, setFilters] = useState({
 vineyard: 'all',
 grape: 'all',
 vintage: 'all',
 agingStatus: 'all',
 features: 'all'
 });

 // Get unique filter options from wines
 const filterOptions = useMemo(() => {
 const vineyards = new Set(bottledWines.map(w => w.vineyardName));
 const grapes = new Set(bottledWines.map(w => w.grape));
 const vintages = new Set(bottledWines.map(w => w.harvestStartDate.year));

 return {
 vineyards: Array.from(vineyards).sort(),
 grapes: Array.from(grapes).sort(),
 vintages: Array.from(vintages).sort((a, b) => b - a)
 };
 }, [bottledWines]);

 // Collapsible vintage groups state (for desktop hierarchical view)
 const [expandedVintages, setExpandedVintages] = useState<Set<number>>(new Set());
 const hasInitializedVintageExpansion = useRef(false);

 // Initialize with newest vintage expanded exactly once after data is available
 useEffect(() => {
 if (hasInitializedVintageExpansion.current) return;
 if (filterOptions.vintages.length === 0) return;

 setExpandedVintages(new Set([filterOptions.vintages[0]]));
 hasInitializedVintageExpansion.current = true;
 }, [filterOptions.vintages]);

 // Apply filters
 const filteredWines = useMemo(() => {
 return bottledWines.filter(wine => {
 // Vineyard filter
 if (filters.vineyard !== 'all' && wine.vineyardName !== filters.vineyard) return false;

 // Grape filter
 if (filters.grape !== 'all' && wine.grape !== filters.grape) return false;

 // Vintage filter
 if (filters.vintage !== 'all' && wine.harvestStartDate.year !== parseInt(filters.vintage)) return false;

 // Aging status filter
 if (filters.agingStatus !== 'all') {
 const status = calculateAgingStatus(wine);
 if (filters.agingStatus !== status.peakStatus) return false;
 }

 // Features filter - only check features that actually have an effect (> 0)
 if (filters.features !== 'all') {
 const displayData = getFeatureDisplayData(wine);
 const hasFeature = [
 ...displayData.activeFeatures,
 ...displayData.riskFeatures
 ].some(({ feature }) => feature.id === filters.features);
 if (!hasFeature) return false;
 }

 return true;
 });
 }, [bottledWines, filters]);

 // Define sortable columns for wine cellar
 const cellarColumns: SortableColumn<WineBatch>[] = [
 { key: 'grape' as any, label: 'Wine & Vineyard', sortable: true, accessor: (wine) => wine.grape },
 { key: 'harvestStartDate', label: 'Vintage', sortable: true, accessor: (wine) => wine.harvestStartDate.year },
 {
 key: 'agingProgress' as any,
 label: 'Aging Progress',
 sortable: true,
 accessor: (wine) => wine.agingProgress || 0
 },
 { key: 'balance' as any, label: 'Balance & Quality', sortable: false },
 {
 key: 'wineScore' as any,
 label: 'Score',
 sortable: true,
 accessor: (wine) => (wine.tasteIndex + wine.balance) / 2
 },
 { key: 'estimatedPrice' as any, label: 'Price', sortable: true },
 { key: 'quantity', label: 'Bottles', sortable: true },
 { key: 'manifested' as any, label: 'Manifested', sortable: false },
 { key: 'risk' as any, label: 'Risk', sortable: false },
 { key: 'weeklyEffects' as any, label: 'Weekly Effects', sortable: false }
 ];

 const {
 sortedData: sortedBottledWines,
 handleSort: handleCellarSort,
 getSortIndicator: getCellarSortIndicator,
 isColumnSorted: isCellarColumnSorted
 } = useTableSortWithAccessors(filteredWines, cellarColumns);

 // Use shared price calculator hook for consistent pricing with prestige bonuses
 const { calculatePrice, prestige, vineyards } = useWinePriceCalculator();

 const vineyardPrestigeById = useMemo(() => {
 const map: Record<string, number | undefined> = {};
 vineyards.forEach((vineyard) => {
 map[vineyard.id] = vineyard.vineyardPrestige;
 });
 return map;
 }, [vineyards]);

 // Precompute estimated prices per wine using the shared calculator
 const estimatedPriceById = useMemo(() => {
 const map: Record<string, number> = {};
 sortedBottledWines.forEach((w) => {
 map[w.id] = calculatePrice(w);
 });
 return map;
 }, [sortedBottledWines, calculatePrice]);

 // Group wines by vintage year for hierarchical display
 const winesByVintage = useMemo(() => {
 return sortedBottledWines.reduce((groups, wine) => {
 const vintage = wine.harvestStartDate.year;
 if (!groups[vintage]) {
 groups[vintage] = [];
 }
 groups[vintage].push(wine);
 return groups;
 }, {} as Record<number, WineBatch[]>);
 }, [sortedBottledWines]);

 // Sort vintage years (newest first)
 const sortedVintages = useMemo(() => {
 return Object.keys(winesByVintage)
 .map(Number)
 .sort((a, b) => b - a);
 }, [winesByVintage]);

 // Toggle vintage group expansion
 const toggleVintage = (vintage: number) => {
 const newExpanded = new Set(expandedVintages);
 if (newExpanded.has(vintage)) {
 newExpanded.delete(vintage);
 } else {
 newExpanded.add(vintage);
 }
 setExpandedVintages(newExpanded);
 };

 // Expand all / Collapse all
 const expandAll = () => setExpandedVintages(new Set(sortedVintages));
 const collapseAll = () => setExpandedVintages(new Set());

 const getBaselinePrice = (wine: WineBatch): number => {
 return wine.askingPrice ?? (estimatedPriceById[wine.id] || 0);
 };

 const getDisplayedPriceInput = (wine: WineBatch): string => {
 return editingPrices[wine.id] ?? getBaselinePrice(wine).toFixed(2);
 };

 const hasPendingPriceChange = (wine: WineBatch): boolean => {
 const pendingRaw = editingPrices[wine.id];
 if (pendingRaw === undefined) return false;

 const pending = parseFloat(pendingRaw.replace(',', '.'));
 if (isNaN(pending)) return true;

 return Math.abs(pending - getBaselinePrice(wine)) > 0.0005;
 };

 const handlePriceChange = (wineId: string, value: string) => {
 setEditingPrices(prev => ({
 ...prev,
 [wineId]: value
 }));
 };

 const handlePriceSave = async (wine: WineBatch) => {
 const baselinePrice = getBaselinePrice(wine);
 const newPriceStr = (editingPrices[wine.id] ?? baselinePrice.toFixed(2)).trim();
 const newPrice = parseFloat(newPriceStr.replace(',', '.'));

 // Enhanced validation
 if (isNaN(newPrice) || newPrice < 0) {
 alert('Please enter a valid price (must be positive)');
 return;
 }

 if (newPrice < 0.01) {
 alert('Price must be at least EUR 0.01');
 return;
 }

 if (newPrice > 10000) {
 alert('Price seems unusually high. Please confirm this is correct.');
 return;
 }

 if (Math.abs(newPrice - baselinePrice) < 0.0005) {
 handlePriceCancel(wine.id);
 return;
 }

 try {
 const updatedWine: WineBatch = {
 ...wine,
 askingPrice: newPrice
 };

 await saveWineBatch(updatedWine);
 // Notify only cellar-related subscribers
 triggerTopicUpdate('wine_batches');
 setEditingPrices(prev => {
 const updated = { ...prev };
 delete updated[wine.id];
 return updated;
 });
 // Data will be automatically refreshed by the reactive hooks
 } catch (error) {
 console.error('Error updating price:', error);
 alert('Error updating price');
 }
 };

 const handlePriceCancel = (wineId: string) => {
 setEditingPrices(prev => {
 const updated = { ...prev };
 delete updated[wineId];
 return updated;
 });
 };

 // Calculate filter summary stats
 const filterStats = useMemo(() => {
 const total = filteredWines.length;
 const totalBottles = filteredWines.reduce((sum, w) => sum + w.quantity, 0);
 const totalValue = filteredWines.reduce((sum, w) => {
 const price = w.askingPrice ?? estimatedPriceById[w.id] ?? 0;
 return sum + (w.quantity * price);
 }, 0);

 return { total, totalBottles, totalValue };
 }, [filteredWines, estimatedPriceById]);

 return (
 <div className="space-y-3">
 {/* Advanced Filters */}
 <div className="bg-white rounded-lg shadow p-3">
 <div className="flex justify-between items-center mb-3">
 <div>
 <h3 className="text-sm font-semibold">Wine Cellar Filters</h3>
 <p className="text-gray-500 text-xs">
 {filterStats.total} wine{filterStats.total !== 1 ? 's' : ''} {filterStats.totalBottles} bottles {formatNumber(filterStats.totalValue, { currency: true, decimals: 0 })} total value
 </p>
 </div>
 <div className="flex items-center space-x-2">
 <label className="flex items-center space-x-2">
 <input
 type="checkbox"
 checked={showSoldOut}
 onChange={(e) => setShowSoldOut(e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-xs font-medium">Show Sold Out</span>
 </label>
 </div>
 </div>

 <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
 <div>
 <label className="block text-gray-600 mb-1">Vineyard</label>
 <select
 className="w-full border rounded px-2 py-1 text-xs"
 value={filters.vineyard}
 onChange={(e) => setFilters(prev => ({ ...prev, vineyard: e.target.value }))}
 >
 <option value="all">All Vineyards</option>
 {filterOptions.vineyards.map(v => (
 <option key={v} value={v}>{v}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-gray-600 mb-1">Grape</label>
 <select
 className="w-full border rounded px-2 py-1 text-xs"
 value={filters.grape}
 onChange={(e) => setFilters(prev => ({ ...prev, grape: e.target.value }))}
 >
 <option value="all">All Grapes</option>
 {filterOptions.grapes.map(g => (
 <option key={g} value={g}>{g}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-gray-600 mb-1">Vintage</label>
 <select
 className="w-full border rounded px-2 py-1 text-xs"
 value={filters.vintage}
 onChange={(e) => setFilters(prev => ({ ...prev, vintage: e.target.value }))}
 >
 <option value="all">All Vintages</option>
 {filterOptions.vintages.map(v => (
 <option key={v} value={v.toString()}>{v}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-gray-600 mb-1">Aging Status</label>
 <select
 className="w-full border rounded px-2 py-1 text-xs"
 value={filters.agingStatus}
 onChange={(e) => setFilters(prev => ({ ...prev, agingStatus: e.target.value }))}
 >
 <option value="all">All Status</option>
 <option value="developing"> Developing</option>
 <option value="early-peak"> Early Peak</option>
 <option value="peak"> Peak Window</option>
 <option value="mature"> Mature</option>
 <option value="past-peak"> Past Peak</option>
 </select>
 </div>

 <div>
 <label className="block text-gray-600 mb-1">Features</label>
 <select
 className="w-full border rounded px-2 py-1 text-xs"
 value={filters.features}
 onChange={(e) => setFilters(prev => ({ ...prev, features: e.target.value }))}
 >
 <option value="all">All Features</option>
 <option value="terroir"> Terroir</option>
 <option value="oxidation"> Oxidation</option>
 <option value="bottle_aging"> Bottle Aging</option>
 <option value="green_flavor"> Green Flavor</option>
 <option value="stuck_fermentation"> Stuck Fermentation</option>
 </select>
 </div>
 </div>

 {/* Active filters indicator */}
 {(filters.vineyard !== 'all' || filters.grape !== 'all' || filters.vintage !== 'all' || filters.agingStatus !== 'all' || filters.features !== 'all') && (
 <div className="mt-2 flex items-center gap-2">
 <span className="text-xs text-gray-600">Active filters:</span>
 <div className="flex gap-1 flex-wrap">
 {filters.vineyard !== 'all' && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
 {filters.vineyard}
 <button onClick={() => setFilters(prev => ({ ...prev, vineyard: 'all' }))} className="ml-1 hover:text-blue-900">x </button>
 </span>
 )}
 {filters.grape !== 'all' && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">
 {filters.grape}
 <button onClick={() => setFilters(prev => ({ ...prev, grape: 'all' }))} className="ml-1 hover:text-purple-900">x </button>
 </span>
 )}
 {filters.vintage !== 'all' && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
 {filters.vintage}
 <button onClick={() => setFilters(prev => ({ ...prev, vintage: 'all' }))} className="ml-1 hover:text-amber-900">x </button>
 </span>
 )}
 {filters.agingStatus !== 'all' && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
 Aging: {filters.agingStatus}
 <button onClick={() => setFilters(prev => ({ ...prev, agingStatus: 'all' }))} className="ml-1 hover:text-green-900">x </button>
 </span>
 )}
 {filters.features !== 'all' && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">
 Feature: {filters.features}
 <button onClick={() => setFilters(prev => ({ ...prev, features: 'all' }))} className="ml-1 hover:text-orange-900">x </button>
 </span>
 )}
 <button
 onClick={() => setFilters({ vineyard: 'all', grape: 'all', vintage: 'all', agingStatus: 'all', features: 'all' })}
 className="text-xs text-blue-600 hover:text-blue-800"
 >
 Clear all
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Wine Cellar Table - Desktop (Hierarchical Vintage Grouping) */}
 <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
 <div className="p-3 border-b border-gray-200 flex justify-between items-center">
 <h3 className="text-sm font-semibold">Wine Cellar Inventory</h3>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={expandAll}
 className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
 >
 Expand All
 </button>
 <button
 type="button"
 onClick={collapseAll}
 className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
 >
 Collapse All
 </button>
 </div>
 </div>

 {sortedBottledWines.length === 0 ? (
 <div className="p-6 text-center text-gray-500 text-sm">
 No wines match the current filters
 </div>
 ) : (
 <div className="divide-y divide-gray-200">
 {sortedVintages.map((vintage) => {
 const vintageWines = winesByVintage[vintage];
 const isExpanded = expandedVintages.has(vintage);
 const vintageBottles = vintageWines.reduce((sum, w) => sum + w.quantity, 0);
 const vintageValue = vintageWines.reduce((sum, w) => sum + (w.quantity * (w.askingPrice ?? (estimatedPriceById[w.id] || 0))), 0);

 return (
 <div key={vintage} className="bg-white">
 {/* Vintage Header (Collapsible) */}
 <div
 className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors flex justify-between items-center"
 onClick={() => toggleVintage(vintage)}
 >
 <div className="flex items-center gap-3">
 <span className="text-lg font-mono leading-none">{isExpanded ? '-' : '+'}</span>
 <div>
 <h3 className="text-base font-bold text-gray-900">Vintage {vintage}</h3>
 <p className="text-xs text-gray-600">
 {vintageWines.length} wine{vintageWines.length !== 1 ? 's' : ''} {vintageBottles} bottles {formatNumber(vintageValue, { currency: true, decimals: 0 })} total
 </p>
 </div>
 </div>
 </div>

 {/* Vintage Wines Table (Collapsible) */}
 {isExpanded && (
 <div className="overflow-x-auto">
 <Table className="text-xs">
 <TableHeader>
 <TableRow>
 <TableHead
 sortable
 onSort={() => handleCellarSort('grape' as any)}
 sortIndicator={getCellarSortIndicator('grape' as any)}
 isSorted={isCellarColumnSorted('grape' as any)}
 >
 Wine & Vineyard
 </TableHead>
 <TableHead
 sortable
 onSort={() => handleCellarSort('agingProgress' as any)}
 sortIndicator={getCellarSortIndicator('agingProgress' as any)}
 isSorted={isCellarColumnSorted('agingProgress' as any)}
 className="w-48"
 >
 Aging Progress
 </TableHead>
 <TableHead>Balance & Quality</TableHead>
 <TableHead
 sortable
 onSort={() => handleCellarSort('wineScore' as any)}
 sortIndicator={getCellarSortIndicator('wineScore' as any)}
 isSorted={isCellarColumnSorted('wineScore' as any)}
 >
 Score
 </TableHead>
 <TableHead
 sortable
 onSort={() => handleCellarSort('estimatedPrice' as any)}
 sortIndicator={getCellarSortIndicator('estimatedPrice' as any)}
 isSorted={isCellarColumnSorted('estimatedPrice' as any)}
 >
 Price
 </TableHead>
 <TableHead
 sortable
 onSort={() => handleCellarSort('quantity')}
 sortIndicator={getCellarSortIndicator('quantity')}
 isSorted={isCellarColumnSorted('quantity')}
 >
 Bottles
 </TableHead>
 <TableHead>Manifested</TableHead>
 <TableHead>Risk</TableHead>
 <TableHead>Weekly Effects</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {vintageWines.map((wine) => (
 <TableRow key={wine.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onWineDetailsClick(wine.id)}>
 <TableCell className="font-medium text-gray-900">
 <div className="flex items-center gap-2">
 <span>{wine.grape}</span>
 <BatchBadge batch={wine} />
 </div>
 <div className="text-xs text-gray-500">{wine.vineyardName}</div>
 </TableCell>
 <TableCell className="text-gray-600">
 <AgingProgressBar wine={wine} />
 </TableCell>
 <TableCell className="text-gray-600">
 <BalanceAndQualityDisplay batch={wine} />
 </TableCell>
 <TableCell className="text-gray-600">
 <WineScoreDisplay wine={wine} />
 </TableCell>
 <TableCell className="text-gray-600 font-medium">
 <div>
 <EstimatedPriceDisplay
 wine={wine}
 estimatedPrice={estimatedPriceById[wine.id] || 0}
 companyPrestige={prestige}
 vineyardPrestige={vineyardPrestigeById[wine.vineyardId]}
 />
 </div>
 <div className="flex items-center space-x-2 mt-1" onClick={(e) => e.stopPropagation()}>
 <input
 type="number"
 step="0.01"
 min="0"
 value={getDisplayedPriceInput(wine)}
 onChange={(e) => handlePriceChange(wine.id, e.target.value)}
 onKeyDown={(e) => {
 e.stopPropagation();
 if (e.key === 'Enter') {
 void handlePriceSave(wine);
 }
 if (e.key === 'Escape') {
 handlePriceCancel(wine.id);
 }
 }}
 onClick={(e) => e.stopPropagation()}
 onFocus={(e) => e.stopPropagation()}
 onMouseDown={(e) => e.stopPropagation()}
 className="w-20 px-1.5 py-1 border rounded text-xs"
 />
 <Pencil className="h-3 w-3 text-gray-500" />
 <button
 onClick={(e) => {
 e.stopPropagation();
 void handlePriceSave(wine);
 }}
 disabled={!hasPendingPriceChange(wine)}
 className={`inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded border ${
 hasPendingPriceChange(wine)
 ? 'border-green-200 text-green-700 hover:bg-green-50'
 : 'border-gray-200 text-gray-400 cursor-not-allowed'
 }`}
 title="Save Price"
 >
 <Save className="h-3 w-3" />
 </button>
 {editingPrices[wine.id] !== undefined && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handlePriceCancel(wine.id);
 }}
 className="inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
 title="Reset Input"
 >
 <RotateCcw className="h-3 w-3" />
 </button>
 )}
 </div>
 </TableCell>
 <TableCell className="text-gray-600">
 {wine.quantity}
 </TableCell>
 <TableCell className="text-gray-600">
 <ManifestedFeatures wine={wine} />
 </TableCell>
 <TableCell className="text-gray-600">
 <RiskFeatures wine={wine} />
 </TableCell>
 <TableCell className="text-gray-600">
 <WeeklyEffectsDisplay wine={wine} />
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Wine Cellar Cards - Mobile (Enhanced) */}
 <div className="lg:hidden space-y-4">
 {sortedBottledWines.length === 0 ? (
 <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
 No wines match the current filters
 </div>
 ) : (
 sortedVintages.map((vintage) => (
 <div key={vintage} className="space-y-3">
 {/* Vintage Year Header */}
 <div className="bg-gradient-to-r from-amber-100 to-amber-200 rounded-lg p-3 border-l-4 border-amber-500">
 <h2 className="text-lg font-bold text-gray-900">
 Vintage {vintage}
 </h2>
 <p className="text-sm text-gray-700">
 {winesByVintage[vintage].length} wine{winesByVintage[vintage].length !== 1 ? 's' : ''} {winesByVintage[vintage].reduce((sum, w) => sum + w.quantity, 0)} bottles
 </p>
 </div>

 {/* Wines for this vintage */}
 <div className="space-y-3 ml-2">
 {winesByVintage[vintage].map((wine) => (
 <div key={wine.id} className="bg-white rounded-lg shadow overflow-hidden">
 {/* Card Header */}
 <div className="bg-gradient-to-r from-purple-50 to-amber-50 p-4 border-b">
 <div className="flex justify-between items-start">
 <div className="flex-1">
 <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
 {wine.grape}
 <BatchBadge batch={wine} />
 </h3>
 <div className="text-sm text-gray-600 mt-1">{wine.vineyardName}</div>
 <div className="text-xs text-gray-500 mt-1">
 Vintage {wine.harvestStartDate.year}
 </div>
 </div>
 <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
 wine.quantity > 0
 ? 'bg-green-100 text-green-800'
 : 'bg-red-100 text-red-800'
 }`}>
 {wine.quantity > 0 ? 'Available' : 'Sold Out'}
 </span>
 </div>
 </div>

 {/* Card Body */}
 <div className="p-4 space-y-4">
 {/* Aging Progress */}
 <div>
 <div className="text-xs text-gray-500 uppercase mb-1">Aging Progress</div>
 <AgingProgressBar wine={wine} />
 </div>

 {/* Score & Features */}
 <div className="grid grid-cols-3 gap-3">
 <div>
 <div className="text-xs text-gray-500 uppercase mb-1">Score</div>
 <WineScoreDisplay wine={wine} />
 </div>
 <div>
 <div className="text-xs text-gray-500 uppercase mb-1">Manifested</div>
 <ManifestedFeatures wine={wine} />
 </div>
 <div>
 <div className="text-xs text-gray-500 uppercase mb-1">Risk</div>
 <RiskFeatures wine={wine} />
 </div>
 </div>

 {/* Effects (for bottled wines) */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <div className="text-xs text-gray-500 uppercase mb-1">Weekly Effects</div>
 <WeeklyEffectsDisplay wine={wine} />
 </div>
 </div>

 {/* Pricing */}
 <div className="border-t pt-3">
 <div className="flex justify-between items-center mb-2">
 <span className="text-sm text-gray-600">Estimated Price:</span>
 <EstimatedPriceDisplay
 wine={wine}
 estimatedPrice={estimatedPriceById[wine.id] || 0}
 companyPrestige={prestige}
 vineyardPrestige={vineyardPrestigeById[wine.vineyardId]}
 />
 </div>
 <div className="flex justify-between items-center mb-2">
 <span className="text-sm text-gray-600">Asking Price:</span>
 <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
 <input
 type="number"
 step="0.01"
 min="0"
 value={getDisplayedPriceInput(wine)}
 onChange={(e) => handlePriceChange(wine.id, e.target.value)}
 onKeyDown={(e) => {
 e.stopPropagation();
 if (e.key === 'Enter') {
 void handlePriceSave(wine);
 }
 if (e.key === 'Escape') {
 handlePriceCancel(wine.id);
 }
 }}
 onClick={(e) => e.stopPropagation()}
 onFocus={(e) => e.stopPropagation()}
 onMouseDown={(e) => e.stopPropagation()}
 className="w-24 px-2 py-1 border rounded text-sm"
 />
 <Pencil className="h-4 w-4 text-gray-500" />
 <button
 onClick={(e) => {
 e.stopPropagation();
 void handlePriceSave(wine);
 }}
 disabled={!hasPendingPriceChange(wine)}
 className={`inline-flex items-center justify-center text-xs px-2 py-1 rounded border ${
 hasPendingPriceChange(wine)
 ? 'border-green-200 text-green-700 hover:bg-green-50'
 : 'border-gray-200 text-gray-400 cursor-not-allowed'
 }`}
 title="Save Price"
 >
 <Save className="h-4 w-4" />
 </button>
 {editingPrices[wine.id] !== undefined && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handlePriceCancel(wine.id);
 }}
 className="inline-flex items-center justify-center text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
 title="Reset Input"
 >
 <RotateCcw className="h-4 w-4" />
 </button>
 )}
 </div>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-sm text-gray-600">Bottles:</span>
 <span className="text-lg font-bold text-gray-900">{wine.quantity}</span>
 </div>
 </div>

 {/* Wine Details Button */}
 <div className="flex gap-2">
 <Button
 onClick={() => onWineDetailsClick(wine.id)}
 size="sm"
 variant="outline"
 className="flex-1 text-purple-600 border-purple-600 hover:bg-purple-50 text-xs"
 >
 View Details
 </Button>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 );
};

export default WineCellarTab;






