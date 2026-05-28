
import React, { useState, useMemo, useCallback } from 'react';
import { BarChart3, Grape, HeartPulse } from 'lucide-react';
import { useLoadingState, useGameState, useGameStateWithData } from '@/hooks';
import { buildVineyardWeatherRows, buildWeatherContext, getAllVineyards, getGameState, getAspectRating, getAltitudeRating, getAllActivities, getCurrentCompany, getWeatherIcon, sellVineyard, calculateAdjustedLandValueBreakdown } from '@/lib/services';
import { Vineyard as VineyardType, WorkCategory } from '@/lib/types/types';
import { LandSearchOptionsModal, LandSearchResultsModal, PlantingOptionsModal, HarvestOptionsModal, VineyardModal, VineyardStatusBadge } from '../ui';
import { WarningModal } from '@/components/ui/modals/UImodals/WarningModal';
import ClearingOptionsModal from '../ui/modals/activitymodals/ClearingOptionsModal';
import { FeatureDisplay } from '../ui/components/FeatureDisplay';
import { formatNumber, formatSigned, getBadgeColorClasses, getRatingForRange, getRangeColor } from '@/lib/utils/utils';
import { getFlagIcon } from '@/lib/utils';
import { clearPendingLandSearchResults, calculateVineyardExpectedYield } from '@/lib/services';
import { UnifiedTooltip, TooltipSection, TooltipRow, tooltipStyles } from '../ui/shadCN/tooltip';

// Progress bar color helpers via global utils
const getHealthProgressColor = (health: number): string => getRangeColor(health, 0, 1, 'higher_better').bg;
const getRipenessProgressColor = (ripeness: number): string => getRangeColor(ripeness, 0, 1, 'higher_better').bg;
const getVineYieldProgressColor = (vineYield: number): string => {
  if (vineYield >= 1.0) return 'bg-purple-500';
  const normalizedYield = Math.max(0.02, Math.min(1.0, vineYield));
  return getRangeColor(normalizedYield, 0.02, 1.0, 'higher_better').bg;
};

const getExpectedYieldProgressPercent = (yieldKg: number): number => {
  return Math.max(0, Math.min(100, (yieldKg / 10000) * 100));
};

const formatPercentValue = (value: number): string => `${formatNumber(value * 100, { decimals: 2, forceDecimals: true })}%`;
const formatSignedPercentPoints = (value: number): string => `${value >= 0 ? '+' : ''}${formatNumber(value * 100, { decimals: 2, forceDecimals: true })}%`;

// Consolidated tooltip content builder
const buildTooltipContent = (type: string, data: any) => {
  const {
    vineyard,
    value,
    label,
    description,
    weatherImpact,
    projectedValue,
    weatherBreakdown,
    siteResponse,
    normalProgressionImpact,
    weatherOnlyImpact
  } = data;
  
  switch (type) {
    case 'health':
      const healthTrend = vineyard.healthTrend;
      const hasWeatherProjection = typeof weatherImpact === 'number' && typeof projectedValue === 'number';
      const hasWeatherBreakdown = !!weatherBreakdown;
      const healthSeasonalNetChange = healthTrend?.netChange ?? 0;
      if (!healthTrend || (healthTrend.seasonalDecay === 0 && healthTrend.plantingImprovement === 0)) {
        return (
          <div className={tooltipStyles.text}>
            <TooltipSection>
              <p className={tooltipStyles.title}>Vineyard Health: {formatPercentValue(vineyard.vineyardHealth)}</p>
              <p className={tooltipStyles.muted}>No major season-to-date health drift is recorded.</p>
            </TooltipSection>
            {hasWeatherProjection && (
              <TooltipSection title="Next Week Forecast (Normal + Weather)">
                <TooltipRow label="Current" value={formatPercentValue(value || 0)} monospaced />
                {hasWeatherBreakdown && (
                  <>
                    <TooltipRow label="Weather" value={`${weatherBreakdown.weatherState} (${weatherBreakdown.weatherIntensity})`} />
                    <TooltipRow label="Base health delta" value={formatSigned(weatherBreakdown.baseHealthDeviation)} monospaced />
                    <TooltipRow label="Seasonal adjustment" value={`x${formatNumber(weatherBreakdown.seasonAdjustmentMultiplier, { smartDecimals: true })}`} monospaced />
                    <TooltipRow label="Site parameters" value={`Aspect x${formatNumber(weatherBreakdown.aspectResponse, { smartDecimals: true })}, Altitude x${formatNumber(weatherBreakdown.altitudeResponse, { smartDecimals: true })}, Terroir x${formatNumber(weatherBreakdown.terroirResponse, { smartDecimals: true })}, Soil x${formatNumber(weatherBreakdown.soilResponse, { smartDecimals: true })}`} />
                    <TooltipRow label="Site response" value={`x${formatNumber(siteResponse || 1, { smartDecimals: true })}`} monospaced />
                  </>
                )}
                <TooltipRow label="Normal progression" value={formatSignedPercentPoints(normalProgressionImpact || 0)} monospaced valueRating={(normalProgressionImpact || 0) >= 0 ? 0.9 : 0.1} />
                <TooltipRow label="Weather delta" value={formatSignedPercentPoints(weatherOnlyImpact || 0)} monospaced valueRating={(weatherOnlyImpact || 0) >= 0 ? 0.9 : 0.1} />
                <TooltipRow label="Net expected change next week" value={formatSignedPercentPoints(weatherImpact)} monospaced valueRating={weatherImpact >= 0 ? 0.9 : 0.1} />
                <TooltipRow label="Projected level (next week)" value={formatPercentValue(projectedValue)} monospaced />
                <TooltipRow label="Formula" value={`${formatPercentValue(value || 0)} + ${formatSignedPercentPoints(normalProgressionImpact || 0)} + ${formatSignedPercentPoints(weatherOnlyImpact || 0)} = ${formatPercentValue(projectedValue)}`} monospaced />
                <p className={tooltipStyles.muted}>Projected level combines baseline weekly progression and weather impact.</p>
              </TooltipSection>
            )}
          </div>
        );
      }
      const hasPositiveChange = healthSeasonalNetChange > 0;
      return (
        <div className={tooltipStyles.text}>
          <TooltipSection>
            <p className={tooltipStyles.title}>Vineyard Health: {formatPercentValue(vineyard.vineyardHealth)}</p>
            <p className={tooltipStyles.muted}>Season context and weekly weather forecast are separated below.</p>
          </TooltipSection>
          <TooltipSection title="Season-to-Date Context (Not Next Week)">
            {healthTrend.seasonalDecay !== 0 && (
              <TooltipRow label="Seasonal decay" value={formatSignedPercentPoints(-Math.abs(healthTrend.seasonalDecay))} valueRating={0.1} />
            )}
            {healthTrend.plantingImprovement > 0 && (
              <TooltipRow label="Planting recovery" value={formatSignedPercentPoints(healthTrend.plantingImprovement)} valueRating={0.9} />
            )}
            {(healthSeasonalNetChange !== 0) && (
              <TooltipRow label="Net season trend" value={formatSignedPercentPoints(healthSeasonalNetChange)} valueRating={hasPositiveChange ? 0.9 : 0.1} />
            )}
            <p className={tooltipStyles.muted}>These values are season-to-date context and are not the one-week weather delta.</p>
          </TooltipSection>
          {hasWeatherProjection && (
            <TooltipSection title="Next Week Forecast (Normal + Weather)">
              <TooltipRow label="Current" value={formatPercentValue(value || 0)} monospaced />
              {hasWeatherBreakdown && (
                <>
                  <TooltipRow label="Weather" value={`${weatherBreakdown.weatherState} (${weatherBreakdown.weatherIntensity})`} />
                  <TooltipRow label="Base health delta" value={formatSigned(weatherBreakdown.baseHealthDeviation)} monospaced />
                  <TooltipRow label="Seasonal adjustment" value={`x${formatNumber(weatherBreakdown.seasonAdjustmentMultiplier, { smartDecimals: true })}`} monospaced />
                  <TooltipRow label="Site parameters" value={`Aspect x${formatNumber(weatherBreakdown.aspectResponse, { smartDecimals: true })}, Altitude x${formatNumber(weatherBreakdown.altitudeResponse, { smartDecimals: true })}, Terroir x${formatNumber(weatherBreakdown.terroirResponse, { smartDecimals: true })}, Soil x${formatNumber(weatherBreakdown.soilResponse, { smartDecimals: true })}`} />
                  <TooltipRow label="Site response" value={`x${formatNumber(siteResponse || 1, { smartDecimals: true })}`} monospaced />
                </>
              )}
              <TooltipRow label="Normal progression" value={formatSignedPercentPoints(normalProgressionImpact || 0)} monospaced valueRating={(normalProgressionImpact || 0) >= 0 ? 0.9 : 0.1} />
              <TooltipRow label="Weather delta" value={formatSignedPercentPoints(weatherOnlyImpact || 0)} monospaced valueRating={(weatherOnlyImpact || 0) >= 0 ? 0.9 : 0.1} />
              <TooltipRow label="Net expected change next week" value={formatSignedPercentPoints(weatherImpact)} monospaced valueRating={weatherImpact >= 0 ? 0.9 : 0.1} />
              <TooltipRow label="Projected level (next week)" value={formatPercentValue(projectedValue)} monospaced />
              <TooltipRow label="Formula" value={`${formatPercentValue(value || 0)} + ${formatSignedPercentPoints(normalProgressionImpact || 0)} + ${formatSignedPercentPoints(weatherOnlyImpact || 0)} = ${formatPercentValue(projectedValue)}`} monospaced />
              <p className={tooltipStyles.muted}>Projected level combines baseline weekly progression and weather impact.</p>
            </TooltipSection>
          )}
          {(vineyard.plantingHealthBonus ?? 0) > 0 && (
            <TooltipSection>
              <p className={tooltipStyles.muted}>Gradual improvement: +{formatPercentValue(vineyard.plantingHealthBonus)} remaining</p>
            </TooltipSection>
          )}
        </div>
      );

    case 'ripeness':
      return (
        <div className={tooltipStyles.text}>
          <TooltipSection>
            <p className={tooltipStyles.title}>Ripeness: {formatPercentValue(value)}</p>
            <p className={tooltipStyles.muted}>Ripeness affects taste quality baseline and harvest yield. Higher ripeness produces better grapes.</p>
          </TooltipSection>
          <TooltipSection title="Quality Impact">
            <TooltipRow label="Current Level:" value={value < 0.3 ? 'Very Low' : value < 0.7 ? 'Moderate' : 'Good'} valueRating={value} />
            <p className={tooltipStyles.muted}>
              {value < 0.3 ? 'Very low ripeness will yield very little and poor quality grapes.'
               : value < 0.7 ? 'Moderate ripeness provides decent yield and quality.'
               : 'Good ripeness provides optimal yield and quality grapes.'}
            </p>
          </TooltipSection>
          {typeof weatherImpact === 'number' && typeof projectedValue === 'number' && (
            <TooltipSection title="Next Week Forecast (Normal + Weather)">
              <TooltipRow label="Current" value={formatPercentValue(value || 0)} monospaced />
              {weatherBreakdown && (
                <>
                  <TooltipRow label="Weather" value={`${weatherBreakdown.weatherState} (${weatherBreakdown.weatherIntensity})`} />
                  <TooltipRow label="Base ripeness delta" value={formatSigned(weatherBreakdown.baseRipenessDeviation)} monospaced />
                  <TooltipRow label="Site parameters" value={`Aspect x${formatNumber(weatherBreakdown.aspectResponse, { smartDecimals: true })}, Altitude x${formatNumber(weatherBreakdown.altitudeResponse, { smartDecimals: true })}, Terroir x${formatNumber(weatherBreakdown.terroirResponse, { smartDecimals: true })}, Soil x${formatNumber(weatherBreakdown.soilResponse, { smartDecimals: true })}`} />
                  <TooltipRow label="Site response" value={`x${formatNumber(siteResponse || 1, { smartDecimals: true })}`} monospaced />
                </>
              )}
              <TooltipRow label="Normal progression" value={formatSignedPercentPoints(normalProgressionImpact || 0)} monospaced valueRating={(normalProgressionImpact || 0) >= 0 ? 0.9 : 0.1} />
              <TooltipRow label="Weather delta" value={formatSignedPercentPoints(weatherOnlyImpact || 0)} monospaced valueRating={(weatherOnlyImpact || 0) >= 0 ? 0.9 : 0.1} />
              <TooltipRow label="Net expected change next week" value={formatSignedPercentPoints(weatherImpact)} monospaced valueRating={weatherImpact >= 0 ? 0.9 : 0.1} />
              <TooltipRow label="Projected level (next week)" value={formatPercentValue(projectedValue)} monospaced />
              <TooltipRow label="Formula" value={`${formatPercentValue(value || 0)} + ${formatSignedPercentPoints(normalProgressionImpact || 0)} + ${formatSignedPercentPoints(weatherOnlyImpact || 0)} = ${formatPercentValue(projectedValue)}`} monospaced />
              <p className={tooltipStyles.muted}>Projected level combines baseline weekly progression and weather impact.</p>
            </TooltipSection>
          )}
        </div>
      );

    case 'vineYield':
      const isExceptional = value >= 1.0;
      return (
        <div className={tooltipStyles.text}>
          <TooltipSection>
            <p className={tooltipStyles.title}>Vine Yield: {formatNumber(value * 100, { smartDecimals: true })}%</p>
            <p className={tooltipStyles.muted}>
              {isExceptional ? 'Exceptional yield! This vineyard is producing above normal capacity.'
               : 'Vine yield represents the productivity of individual vines. Higher yield means more grapes per vine.'}
            </p>
          </TooltipSection>
          <TooltipSection title="Impact">
            <TooltipRow label="Yield Level:" value={value < 0.3 ? 'Low' : value < 0.7 ? 'Moderate' : value < 1.0 ? 'Good' : 'Exceptional'} valueRating={isExceptional ? 1.0 : getRatingForRange(value, 0.02, 1.0, 'higher_better')} />
            <p className={tooltipStyles.muted}>
              {value < 0.3 ? 'Low vine yield reduces overall harvest amount.'
               : value < 0.7 ? 'Moderate vine yield provides decent harvest amounts.'
               : value < 1.0 ? 'Good vine yield provides optimal harvest amounts.'
               : 'Exceptional yield provides bonus harvest amounts!'}
            </p>
          </TooltipSection>
        </div>
      );

    case 'rating':
      return (
        <div className={tooltipStyles.text}>
          <TooltipSection>
            <p className={tooltipStyles.title}>{label}: {formatNumber(value, { smartDecimals: true })}</p>
            <p className={tooltipStyles.muted}>{description}</p>
          </TooltipSection>
          <TooltipSection title="Rating Scale">
            <TooltipRow label="Rating:" value={value < 0.3 ? 'Poor' : value < 0.5 ? 'Below Average' : value < 0.7 ? 'Good' : value < 0.9 ? 'Excellent' : 'Perfect'} valueRating={value} />
            <p className={tooltipStyles.muted}>
              {value < 0.3 ? 'Poor rating significantly reduces land-value modifier.'
               : value < 0.5 ? 'Below average rating reduces land-value modifier.'
               : value < 0.7 ? 'Good rating provides a decent land-value modifier.'
               : value < 0.9 ? 'Excellent rating provides a high land-value modifier.'
               : 'Perfect rating provides the maximum land-value modifier.'}
            </p>
          </TooltipSection>
        </div>
      );

    case 'prestige':
      return (
        <div className={tooltipStyles.text}>
          <TooltipSection>
            <p className={tooltipStyles.title}>Vineyard Prestige: {formatNumber(value, { smartDecimals: true })}</p>
            <p className={tooltipStyles.muted}>Prestige is earned from vineyard quality, land value, vine age, and wine features.</p>
          </TooltipSection>
          <TooltipSection title="Impact">
            <TooltipRow label="Prestige Level:" value={value < 1 ? 'Low' : value < 5 ? 'Moderate' : value < 10 ? 'High' : 'Very High'} valueRating={getRatingForRange(value, 0, 10, 'higher_better')} />
            <p className={tooltipStyles.muted}>Higher prestige improves customer relationships and wine sales prices. Prestige can come from land value, vine age, and wine features.</p>
          </TooltipSection>
        </div>
      );

    case 'density':
      if (value === 0) {
        return (
          <div className={tooltipStyles.text}>
            <TooltipSection>
              <p className={tooltipStyles.title}>Vine Density: Not planted</p>
              <p className={tooltipStyles.muted}>No vines have been planted yet. Plant vines to start producing grapes.</p>
            </TooltipSection>
          </div>
        );
      }
      return (
        <div className={tooltipStyles.text}>
          <TooltipSection>
            <p className={tooltipStyles.title}>Vine Density: {formatNumber(value, { decimals: 0 })} vines/ha</p>
            <p className={tooltipStyles.muted}>Vine density affects yield, quality, and prestige. Lower density (premium) increases prestige but may reduce yield.</p>
          </TooltipSection>
          <TooltipSection title="Impact">
            <TooltipRow label="Density Level:" value={value < 3000 ? 'Very Low (Premium)' : value < 5000 ? 'Low (Premium)' : value < 10000 ? 'Normal' : 'High'} valueRating={getRatingForRange(value, 1500, 10000, 'lower_better')} />
            <p className={tooltipStyles.muted}>
              {value < 3000 ? 'Very low density (premium approach) maximizes prestige but reduces yield.'
               : value < 5000 ? 'Low density (premium approach) increases prestige with moderate yield.'
               : value < 10000 ? 'Normal density provides balanced yield and prestige.'
               : 'High density maximizes yield but reduces prestige.'}
            </p>
          </TooltipSection>
        </div>
      );

    case 'expectedYield':
      if (!vineyard.grape) {
        return (
          <div className={tooltipStyles.text}>
            <TooltipSection>
              <p className={tooltipStyles.title}>Expected Yield: 0 kg</p>
              <p className={tooltipStyles.muted}>No grape planted</p>
            </TooltipSection>
          </div>
        );
      }
      const yieldBreakdown = calculateVineyardExpectedYield(vineyard);
      if (!yieldBreakdown) {
        return (
          <div className={tooltipStyles.text}>
            <TooltipSection>
              <p className={tooltipStyles.title}>Expected Yield: Calculating...</p>
            </TooltipSection>
          </div>
        );
      }
      const { totalYield, totalVines, breakdown: details } = yieldBreakdown;
      return (
        <div className={tooltipStyles.text}>
          <TooltipSection>
            <p className={tooltipStyles.title}>Expected Yield: {formatNumber(totalYield, { smartDecimals: true })} kg</p>
          </TooltipSection>
          <TooltipSection title="Calculation">
            <TooltipRow label="Formula:" value={`${formatNumber(totalVines, { decimals: 0 })} vines × ${yieldBreakdown.baseYieldPerVine} kg/vine × ${formatNumber(details.finalMultiplier, { decimals: 3, smartDecimals: true })}`} monospaced={true} />
            <TooltipRow label="Result:" value={`${formatNumber(totalYield, { smartDecimals: true })} kg`} valueRating={getRatingForRange(totalYield, 0, 10000, 'higher_better')} />
          </TooltipSection>
          <TooltipSection title="Multiplier Breakdown">
            <TooltipRow label="Grape Suitability:" value={`${formatNumber(details.grapeSuitability * 100, { smartDecimals: true })}%`} valueRating={details.grapeSuitability} />
            <TooltipRow label="Natural Yield:" value={`${formatNumber(details.naturalYield * 100, { smartDecimals: true })}%`} valueRating={details.naturalYield} />
            <TooltipRow label="Ripeness:" value={`${formatNumber(details.ripeness * 100, { smartDecimals: true })}%`} valueRating={details.ripeness} />
            <TooltipRow label="Vine Yield:" value={`${formatNumber(details.vineYield * 100, { smartDecimals: true })}%`} valueRating={details.vineYield} />
            <TooltipRow label="Health:" value={`${formatNumber(details.health * 100, { smartDecimals: true })}%`} valueRating={details.health} />
          </TooltipSection>
        </div>
      );

    default:
      return null;
  }
};

// Component for expected yield tooltip display
const ExpectedYieldTooltip: React.FC<{ vineyard: VineyardType }> = ({ vineyard }) => {
  if (!vineyard.grape) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="inline-flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />Expected Yield</span>
          <span className="font-medium">0 kg</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden relative" />
      </div>
    );
  }

  const yieldBreakdown = calculateVineyardExpectedYield(vineyard);

  if (!yieldBreakdown) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="inline-flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />Expected Yield</span>
          <span className="font-medium">Calculating...</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden relative" />
      </div>
    );
  }

  const { totalYield } = yieldBreakdown;
  const expectedYieldPercent = getExpectedYieldProgressPercent(totalYield);
  const expectedYieldBarClass = getRangeColor(totalYield, 0, 10000, 'higher_better').bg;

  return (
    <UnifiedTooltip
      content={buildTooltipContent('expectedYield', { vineyard })}
      title="Expected Yield Details"
      side="right"
      className="max-w-sm"
      variant="panel"
      density="compact"
      triggerClassName="w-full cursor-help"
    >
      <div className="space-y-1 text-xs text-gray-600 hover:text-blue-600 transition-colors">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />Expected Yield</span>
          <span className="font-medium">{formatNumber(totalYield, { smartDecimals: true })} kg</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-300 ${expectedYieldBarClass}`}
            style={{ width: `${expectedYieldPercent}%`, minWidth: totalYield > 0 ? '2px' : '0px' }}
          ></div>
        </div>
      </div>
    </UnifiedTooltip>
  );
};

const Vineyard: React.FC = () => {
  const { withLoading } = useLoadingState();
  const [showPlantDialog, setShowPlantDialog] = useState(false);
  const [showHarvestDialog, setShowHarvestDialog] = useState(false);
  const [showLandSearchModal, setShowLandSearchModal] = useState(false);
  const [showLandResultsModal, setShowLandResultsModal] = useState(false);
  const [showVineyardModal, setShowVineyardModal] = useState(false);
  const [showClearingModal, setShowClearingModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedVineyard, setSelectedVineyard] = useState<VineyardType | null>(null);
  const vineyards = useGameStateWithData(getAllVineyards, []);
  const activities = useGameStateWithData(getAllActivities, []);
  const gameState = useGameStateWithData(() => Promise.resolve(getGameState()), { money: 0, season: 'Spring' });
  const liveGameState = useGameState();
  const currentCompany = getCurrentCompany();

  const weatherContext = useMemo(() => {
    if (!currentCompany?.id) {
      return null;
    }
    return buildWeatherContext(liveGameState, currentCompany.id);
  }, [liveGameState, currentCompany?.id]);

  const vineyardWeatherById = useMemo(() => {
    if (!weatherContext) {
      return new Map<string, ReturnType<typeof buildVineyardWeatherRows>[number]>();
    }
    const rows = buildVineyardWeatherRows(vineyards, weatherContext);
    return new Map(rows.map((row) => [row.id, row]));
  }, [vineyards, weatherContext]);

  // Get vineyards with active activities from game state
  const vineyardsWithActiveActivities = useMemo(() => {
    const activePlantingVineyards = new Set<string>();
    const activeHarvestingVineyards = new Set<string>();
    const activeClearingVineyards = new Set<string>();
    
    activities
      .filter(activity => 
        activity.status === 'active' && 
        activity.targetId
      )
      .forEach(activity => {
        if (activity.category === WorkCategory.PLANTING) {
          activePlantingVineyards.add(activity.targetId!);
        } else if (activity.category === WorkCategory.HARVESTING) {
          activeHarvestingVineyards.add(activity.targetId!);
        } else if (activity.category === WorkCategory.CLEARING) {
          activeClearingVineyards.add(activity.targetId!);
        }
      });
    
    return { 
      planting: activePlantingVineyards,
      harvesting: activeHarvestingVineyards,
      clearing: activeClearingVineyards
    };
  }, [activities]);

  const handleShowHarvestDialog = useCallback((vineyard: VineyardType) => {
    setSelectedVineyard(vineyard);
    setShowHarvestDialog(true);
  }, []);



  // Note: Land search results are now handled globally by GlobalSearchResultsDisplay

  const handleRowClick = useCallback((vineyard: VineyardType) => {
    setSelectedVineyard(vineyard);
    setShowVineyardModal(true);
  }, []);

  const handleShowClearingModal = useCallback((vineyard: VineyardType) => {
    setSelectedVineyard(vineyard);
    setShowClearingModal(true);
  }, []);

  const handleSellVineyard = useCallback(async (vineyard: VineyardType) => {
    setSelectedVineyard(vineyard);
    setShowSellModal(true);
  }, []);

  const confirmSellVineyard = useCallback(async () => {
    if (!selectedVineyard) return;
    const vineyard = selectedVineyard;
    setShowSellModal(false);
    await withLoading(async () => {
      const result = await sellVineyard(vineyard.id, { penaltyRate: 0.10 });
      if (result.success) {
        setSelectedVineyard(null);
      }
    });
  }, [withLoading, selectedVineyard]);

  const handleClearingSubmit = useCallback(async (options: {
    tasks: { [key: string]: boolean };
    replantingIntensity: number;
  }) => {
    if (!selectedVineyard) return;
    
    await withLoading(async () => {
      // Import the clearing activity manager
      const { createClearingActivity } = await import('@/lib/services/vineyard/clearingManager');
      
      const success = await createClearingActivity(
        selectedVineyard.id,
        selectedVineyard.name,
        options
      );
      
      if (success) {
        setShowClearingModal(false);
        setSelectedVineyard(null);
      }
    });
  }, [selectedVineyard, withLoading]);

  const renderActionButton = (
    {
      label,
      disabled,
      onClick,
      primary,
      title,
      fullWidth
    }: { label: string; disabled?: boolean; onClick: (e: React.MouseEvent) => void; primary: 'plant' | 'harvest' | 'clear'; title?: string; fullWidth?: boolean }
  ) => {
    const base = `${fullWidth ? 'w-full' : ''} px-2 py-1 rounded text-xs font-medium`;
    const classes = disabled
      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
      : primary === 'plant'
        ? 'bg-green-600 hover:bg-green-700 text-white'
        : primary === 'harvest'
          ? 'bg-purple-600 hover:bg-purple-700 text-white'
          : 'bg-orange-600 hover:bg-orange-700 text-white';
    
    const button = (
      <button onClick={onClick} disabled={disabled} className={`${base} ${classes}`}>
        {label}
      </button>
    );

    // Wrap with tooltip if title is provided
    if (title) {
      return (
        <UnifiedTooltip
          content={<div className={tooltipStyles.text}><p>{title}</p></div>}
          side="top"
          className="max-w-xs"
          variant="panel"
          density="compact"
        >
          {button}
        </UnifiedTooltip>
      );
    }

    return button;
  };

  const getActionButtons = useCallback((vineyard: VineyardType) => {
    // Barren / No grape
    if (!vineyard.grape) {
      const hasActivePlanting = vineyardsWithActiveActivities.planting.has(vineyard.id);
      const hasActiveClearing = vineyardsWithActiveActivities.clearing.has(vineyard.id);
      const isWinter = gameState.season === 'Winter';
      const plantDisabled = hasActivePlanting || isWinter;
      const plantTitle = isWinter 
        ? 'Planting is not allowed in Winter. Plant in Spring, Summer, or Fall.' 
        : hasActivePlanting 
          ? 'Planting in progress...' 
          : 'Plant vines in this vineyard';
      return (
        <div className="flex flex-col space-y-1">
          {renderActionButton({
            label: hasActivePlanting ? 'Planting...' : 'Plant',
            disabled: plantDisabled,
            primary: 'plant',
            title: plantTitle,
            onClick: (e) => { e.stopPropagation(); setSelectedVineyard(vineyard); setShowPlantDialog(true); }
          })}
          {renderActionButton({
            label: hasActiveClearing ? 'Clearing...' : 'Clear',
            disabled: hasActiveClearing,
            primary: 'clear',
            title: hasActiveClearing ? 'Clearing in progress...' : 'Clear vegetation and debris to improve vineyard health',
            onClick: (e) => { e.stopPropagation(); handleShowClearingModal(vineyard); }
          })}
        </div>
      );
    }

    // Status-specific
    // Check for active planting activity first - only show "Planting in progress" if activity exists
    const plantingActivity = activities.find(
      (a) => a.category === WorkCategory.PLANTING && a.status === 'active' && a.targetId === vineyard.id
    );
    
    if (vineyard.status === 'Planting' && plantingActivity) {
        const targetDensity = plantingActivity.params.density || vineyard.density || 1;
        const currentDensity = vineyard.density || 0;
        const plantingProgress = targetDensity > 0 ? formatNumber((currentDensity / targetDensity) * 100, { smartDecimals: true }) : 0;
        return (
          <div className="space-y-1">
          <div className="text-xs text-emerald-600 font-medium">Planting in progress... ({plantingProgress}% complete)</div>
          <div className="text-xs text-gray-500">{currentDensity}/{targetDensity} vines/ha</div>
          </div>
        );
    }
    
    // If status is 'Planting' but no active activity exists, treat as Growing
    // This handles the edge case where activity completed but status update hasn't propagated yet
    // The status will be fixed on next game tick, but show correct buttons in the meantime
    if (vineyard.status === 'Planting' && !plantingActivity) {
      // No active planting activity - treat as Growing if vineyard has grapes and density
      if (vineyard.grape && vineyard.density > 0) {
        // Fall through to Growing status handling
        const hasActiveHarvesting = vineyardsWithActiveActivities.harvesting.has(vineyard.id);
        const hasActiveClearingGrowing = vineyardsWithActiveActivities.clearing.has(vineyard.id);
        return (
          <div className="space-y-1">
          {renderActionButton({
            label: hasActiveHarvesting ? 'Harvesting...' : 'Harvest',
            disabled: hasActiveHarvesting,
            primary: 'harvest',
            fullWidth: true,
            title: hasActiveHarvesting
                  ? 'Harvesting in progress...'
                  : (vineyard.ripeness || 0) < 0.3 
                    ? 'Low ripeness - will yield very little' 
                : 'Ready to harvest',
            onClick: (e) => { e.stopPropagation(); handleShowHarvestDialog(vineyard); }
          })}
          {renderActionButton({
            label: hasActiveClearingGrowing ? 'Clearing...' : 'Clear',
            disabled: hasActiveClearingGrowing,
            primary: 'clear',
            fullWidth: true,
            title: hasActiveClearingGrowing ? 'Clearing in progress...' : 'Clear vegetation and debris to improve vineyard health',
            onClick: (e) => { e.stopPropagation(); handleShowClearingModal(vineyard); }
          })}
          </div>
        );
      }
    }

    if (vineyard.status === 'Planted') {
      const disabled = vineyardsWithActiveActivities.clearing.has(vineyard.id);
        return (
          <div className="space-y-1">
          <div className="text-xs text-gray-500">Planted (will grow in Spring)</div>
          {renderActionButton({
            label: disabled ? 'Clearing...' : 'Clear',
            disabled,
            primary: 'clear',
            title: disabled ? 'Clearing in progress...' : 'Clear vegetation and debris to improve vineyard health',
            onClick: (e) => { e.stopPropagation(); handleShowClearingModal(vineyard); }
          })}
          </div>
        );
    }

    if (vineyard.status === 'Growing') {
        const hasActiveHarvesting = vineyardsWithActiveActivities.harvesting.has(vineyard.id);
        const hasActiveClearingGrowing = vineyardsWithActiveActivities.clearing.has(vineyard.id);
        return (
          <div className="space-y-1">
          {renderActionButton({
            label: hasActiveHarvesting ? 'Harvesting...' : 'Harvest',
            disabled: hasActiveHarvesting,
            primary: 'harvest',
            fullWidth: true,
            title: hasActiveHarvesting
                  ? 'Harvesting in progress...'
                  : (vineyard.ripeness || 0) < 0.3 
                    ? 'Low ripeness - will yield very little' 
                : 'Ready to harvest',
            onClick: (e) => { e.stopPropagation(); handleShowHarvestDialog(vineyard); }
          })}
          {renderActionButton({
            label: hasActiveClearingGrowing ? 'Clearing...' : 'Clear',
            disabled: hasActiveClearingGrowing,
            primary: 'clear',
            fullWidth: true,
            title: hasActiveClearingGrowing ? 'Clearing in progress...' : 'Clear vegetation and debris to improve vineyard health',
            onClick: (e) => { e.stopPropagation(); handleShowClearingModal(vineyard); }
          })}
          </div>
        );
    }

    if (vineyard.status === 'Harvested') {
      const disabled = vineyardsWithActiveActivities.clearing.has(vineyard.id);
        return (
          <div className="space-y-1">
          <div className="text-xs text-gray-500">Harvested (will go dormant in Winter)</div>
          {renderActionButton({
            label: disabled ? 'Clearing...' : 'Clear',
            disabled,
            primary: 'clear',
            title: disabled ? 'Clearing in progress...' : 'Clear vegetation and debris to improve vineyard health',
            onClick: (e) => { e.stopPropagation(); handleShowClearingModal(vineyard); }
          })}
          </div>
        );
    }

    if (vineyard.status === 'Dormant') {
      const disabled = vineyardsWithActiveActivities.clearing.has(vineyard.id);
        return (
          <div className="space-y-1">
          <div className="text-xs text-gray-500">Dormant</div>
          {renderActionButton({
            label: disabled ? 'Clearing...' : 'Clear',
            disabled,
            primary: 'clear',
            title: disabled ? 'Clearing in progress...' : 'Clear vegetation and debris to improve vineyard health',
            onClick: (e) => { e.stopPropagation(); handleShowClearingModal(vineyard); }
          })}
          </div>
        );
    }

        if (typeof vineyard.status === 'string' && vineyard.status.startsWith('Harvesting')) {
      return <div className="text-xs text-purple-600 font-medium">{vineyard.status}</div>;
        }
        return null;
  }, [activities, handleShowHarvestDialog, vineyardsWithActiveActivities, gameState.season]);

  // Memoize summary statistics
  const { totalHectares, totalValue, plantedVineyards, activeVineyards } = useMemo(() => {
    const totalHectares = Number(vineyards.reduce((sum, v) => sum + v.hectares, 0).toFixed(2));
    const totalValue = vineyards.reduce((sum, v) => sum + v.vineyardTotalValue, 0);
    const plantedVineyards = vineyards.filter(v => v.grape).length;
    const activeVineyards = vineyards.filter(v => v.status === 'Growing').length;
    return { totalHectares, totalValue, plantedVineyards, activeVineyards };
  }, [vineyards]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800">Vineyard Management</h2>
      
      
      
      {/* Vineyard Image */}
      <div 
        className="h-36 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1516594798947-e65505dbb29d?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-3">
          <div className="flex justify-between items-end">
            <h3 className="text-white text-base font-semibold">Vineyard Portfolio</h3>
            <button 
              onClick={() => setShowLandSearchModal(true)}
              className="bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded"
            >
              Search for Land
            </button>
          </div>
        </div>
      </div>

      {/* Summary Statistics - Desktop/Tablet (hidden on mobile) */}
      <div className="hidden lg:grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-gray-900">{vineyards.length}</div>
          <div className="text-xs text-gray-500">Total Vineyards</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-green-600">{totalHectares} ha</div>
          <div className="text-xs text-gray-500">Total Area</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-blue-600">{formatNumber(totalValue, { currency: true })}</div>
          <div className="text-xs text-gray-500">Total Value</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-purple-600">{activeVineyards}/{plantedVineyards}</div>
          <div className="text-xs text-gray-500">Active/Planted</div>
        </div>
      </div>

      {/* Summary Statistics - Mobile (shown below image) */}
      <div className="lg:hidden grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-gray-900">{vineyards.length}</div>
          <div className="text-xs text-gray-500">Total Vineyards</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-green-600">{totalHectares} ha</div>
          <div className="text-xs text-gray-500">Total Area</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-blue-600">{formatNumber(totalValue, { currency: true })}</div>
          <div className="text-xs text-gray-500">Total Value</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-purple-600">{activeVineyards}/{plantedVineyards}</div>
          <div className="text-xs text-gray-500">Active/Planted</div>
        </div>
      </div>

      {/* Vineyards Table - Desktop */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div>
          <table className="w-full table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Vineyard & Location</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Details & Characteristics</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Vine Details</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Progress</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Status & Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vineyards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No vineyards yet. Create your first vineyard to get started!
                  </td>
                </tr>
              ) : (
                vineyards.map((vineyard) => (
                  <tr key={vineyard.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleRowClick(vineyard)}>
                    {/* Vineyard & Location */}
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">{vineyard.name}</div>
                      <div className="text-sm text-gray-500">
                        {vineyard.grape ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {vineyard.grape}
                          </span>
                        ) : (
                          <span className="text-gray-400">No grape planted</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {vineyard.region}, {vineyard.country}
                        <span className={`${getFlagIcon(vineyard.country)} ml-1`}></span>
                      </div>
                      <div className="mt-2">
                        <button
                          className="px-2 py-1 rounded text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
                          title="Sell this vineyard for cash (10% fee)"
                          onClick={(e) => { e.stopPropagation(); handleSellVineyard(vineyard); }}
                        >
                          Sell
                        </button>
                      </div>
                    </td>

                    {/* Details & Characteristics */}
                    <td className="px-4 py-4">
                      <div className="text-xs text-gray-900 space-y-1">
                        <div>
                          <div>
                            <span className="font-medium">Size:</span> {vineyard.hectares} ha
                          </div>
                          <div className="mt-0.5">
                            <span className="font-medium">Value:</span>
                          {(() => {
                            const b = calculateAdjustedLandValueBreakdown(vineyard);
                            return (
                              <UnifiedTooltip
                                content={
                                  <div className={tooltipStyles.text}>
                                    <TooltipSection>
                                      <p className={tooltipStyles.title}>Vineyard Value</p>
                                      <p className={tooltipStyles.muted}>Stored total: {formatNumber(vineyard.vineyardTotalValue || 0, { currency: true, decimals: 0 })}</p>
                                    </TooltipSection>
                                    <TooltipSection>
                                      <TooltipRow label="Base (per ha)" value={`${formatNumber(b.basePerHa, { currency: true, decimals: 0 })}`} monospaced={true} />
                                      <TooltipRow label="Planted" value={`+${formatNumber(b.plantedBonusPct * 100, { smartDecimals: true })}%`} monospaced={true} />
                                      {b.grapeSuitabilityComponents && (
                                        <>
                                          <TooltipRow
                                            label="  Region match"
                                            value={`${formatNumber(b.grapeSuitabilityComponents.region * 100, { smartDecimals: true })}%`}
                                            monospaced={true}
                                          />
                                          <TooltipRow
                                            label="  Altitude match"
                                            value={`${formatNumber(b.grapeSuitabilityComponents.altitude * 100, { smartDecimals: true })}%`}
                                            monospaced={true}
                                          />
                                          <TooltipRow
                                            label="  Sun exposure match"
                                            value={`${formatNumber(b.grapeSuitabilityComponents.sunExposure * 100, { smartDecimals: true })}%`}
                                            monospaced={true}
                                          />
                                        </>
                                      )}
                                      <TooltipRow label="Vine age×prestige" value={`+${formatNumber(b.ageBonusPct * 100, { smartDecimals: true })}%`} monospaced={true} />
                                      <TooltipRow label="Prestige" value={`+${formatNumber(b.prestigeBonusPct * 100, { smartDecimals: true })}%`} monospaced={true} />
                                      <TooltipRow label="Total multiplier" value={`×${formatNumber(b.totalMultiplier, { decimals: 3, forceDecimals: true })}`} monospaced={true} />
                                      <TooltipRow label="Adjusted (per ha)" value={`${formatNumber(b.adjustedPerHa, { currency: true, decimals: 0 })}`} monospaced={true} />
                                      <TooltipRow label="Projected Total" value={`${formatNumber(b.adjustedTotal, { currency: true, decimals: 0 })}`} monospaced={true} />
                                    </TooltipSection>
                                  </div>
                                }
                                title="Vineyard Value Adjustments"
                                side="top"
                                className="max-w-sm"
                                variant="panel"
                                density="compact"
                                triggerClassName="inline-block ml-1 cursor-help"
                              >
                                <span className="ml-1 underline decoration-dotted">
                                  {formatNumber(vineyard.vineyardTotalValue, { currency: true })}
                                </span>
                              </UnifiedTooltip>
                            );
                          })()}
                          {vineyard.hectares > 0 && (
                            <span className="text-xs text-gray-500 ml-1">(per ha: {formatNumber((vineyard.vineyardTotalValue || 0) / vineyard.hectares, { currency: true })})</span>
                          )}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Soil:</span> {vineyard.soil.join(', ')}
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium">Altitude:</span> 
                          <span className="ml-1">{vineyard.altitude}m</span>
                          {(() => {
                            const rating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
                            const colors = getBadgeColorClasses(rating);
                            return (
                              <UnifiedTooltip
                                content={buildTooltipContent('rating', { label: 'Altitude Rating', value: rating, description: 'Altitude affects land-value modifier. Each region has an optimal altitude range for grape growing.' })}
                                title="Altitude Rating Details"
                                side="top"
                                className="max-w-sm"
                                variant="panel"
                                density="compact"
                                triggerClassName="inline-block ml-1 cursor-help"
                              >
                                <span className={`ml-1 px-1 py-0.5 rounded text-xs cursor-help ${colors.text} ${colors.bg}`}>
                                  {formatNumber(rating, { decimals: 2, forceDecimals: true })}
                                </span>
                              </UnifiedTooltip>
                            );
                          })()}
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium">Aspect:</span> 
                          <span className="ml-1">{vineyard.aspect}</span>
                          {(() => {
                            const rating = getAspectRating(vineyard.country, vineyard.region, vineyard.aspect);
                            const colors = getBadgeColorClasses(rating);
                            return (
                              <UnifiedTooltip
                                content={buildTooltipContent('rating', { label: 'Aspect Rating', value: rating, description: 'Aspect (direction the vineyard faces) affects sun exposure and land-value modifier.' })}
                                title="Aspect Rating Details"
                                side="top"
                                className="max-w-sm"
                                variant="panel"
                                density="compact"
                                triggerClassName="inline-block ml-1 cursor-help"
                              >
                                <span className={`ml-1 px-1 py-0.5 rounded text-xs cursor-help ${colors.text} ${colors.bg}`}>
                                  {formatNumber(rating, { decimals: 2, forceDecimals: true })}
                                </span>
                              </UnifiedTooltip>
                            );
                          })()}
                        </div>
                      </div>
                    </td>

                    {/* Vine Details */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {vineyard.vineAge === null ? (
                          <span className="text-gray-400">Not planted</span>
                        ) : vineyard.vineAge === 0 ? (
                          <span className="text-green-600">Newly planted</span>
                        ) : (
                          <span>{vineyard.vineAge} years old</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Prestige:</span>
                        <UnifiedTooltip
                          content={buildTooltipContent('prestige', { value: vineyard.vineyardPrestige ?? 0 })}
                          title="Prestige Details"
                          side="top"
                          className="max-w-sm"
                          variant="panel"
                          density="compact"
                          triggerClassName="inline-block ml-1 cursor-help"
                        >
                          {(() => { const { badge } = getRangeColor(vineyard.vineyardPrestige ?? 0, 0, 10, 'higher_better'); return (
                            <span className={`ml-1 px-1 py-0.5 rounded text-xs cursor-help ${badge.text} ${badge.bg}`}>
                              {formatNumber(vineyard.vineyardPrestige ?? 0, { decimals: 2, forceDecimals: true })}
                            </span>
                          ); })()}
                        </UnifiedTooltip>
                      </div>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Density:</span>
                        {vineyard.density > 0 ? (
                          <UnifiedTooltip
                            content={buildTooltipContent('density', { value: vineyard.density })}
                            title="Density Details"
                            side="top"
                            className="max-w-sm"
                            variant="panel"
                            density="compact"
                            triggerClassName="inline-block ml-1 cursor-help"
                          >
                            {(() => { const { badge } = getRangeColor(vineyard.density, 1500, 10000, 'lower_better'); return (
                              <span className={`ml-1 px-1 py-0.5 rounded text-xs cursor-help ${badge.text} ${badge.bg}`}>
                                {formatNumber(vineyard.density, { decimals: 0 })} vines/ha
                              </span>
                            ); })()}
                          </UnifiedTooltip>
                        ) : (
                          <span className="text-gray-400 ml-1">Not planted</span>
                        )}
                      </div>
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        {(() => {
                          const weatherRow = vineyardWeatherById.get(vineyard.id);
                          const currentHealth = vineyard.vineyardHealth || 1.0;
                          const currentRipeness = vineyard.ripeness || 0;
                          return (
                            <>
                              {weatherRow && (
                                <div className="flex justify-end mb-1">
                                  <UnifiedTooltip
                                    title="Weather Impact Snapshot"
                                    content={
                                      <div className={tooltipStyles.text}>
                                        <TooltipSection title="Current Weather">
                                          <TooltipRow label="State" value={`${weatherRow.breakdown.weatherState} (${weatherRow.breakdown.weatherIntensity})`} />
                                          <TooltipRow label="Site response" value={`x${formatNumber(weatherRow.siteResponse, { smartDecimals: true })}`} monospaced />
                                        </TooltipSection>
                                        <TooltipSection title="Site Parameters">
                                          <TooltipRow label="Aspect" value={`x${formatNumber(weatherRow.breakdown.aspectResponse, { smartDecimals: true })}`} monospaced />
                                          <TooltipRow label="Altitude" value={`x${formatNumber(weatherRow.breakdown.altitudeResponse, { smartDecimals: true })}`} monospaced />
                                          <TooltipRow label="Terroir" value={`x${formatNumber(weatherRow.breakdown.terroirResponse, { smartDecimals: true })}`} monospaced />
                                          <TooltipRow label="Soil" value={`x${formatNumber(weatherRow.breakdown.soilResponse, { smartDecimals: true })}`} monospaced />
                                        </TooltipSection>
                                        <TooltipSection title="Next-Week Deltas">
                                          <TooltipRow label="Ripeness normal" value={formatSigned(weatherRow.ripenessNormalDelta)} monospaced />
                                          <TooltipRow label="Ripeness weather" value={formatSigned(weatherRow.ripenessWeatherDelta)} monospaced />
                                          <TooltipRow label="Ripeness net" value={formatSigned(weatherRow.ripenessDelta)} monospaced />
                                          <TooltipRow label="Health normal" value={formatSigned(weatherRow.healthNormalDelta)} monospaced />
                                          <TooltipRow label="Health weather" value={formatSigned(weatherRow.healthWeatherDelta)} monospaced />
                                          <TooltipRow label="Health net" value={formatSigned(weatherRow.healthDelta)} monospaced />
                                        </TooltipSection>
                                      </div>
                                    }
                                    side="top"
                                    className="max-w-sm"
                                    variant="panel"
                                    density="compact"
                                  >
                                    <span className="cursor-help text-[18px] leading-none">{getWeatherIcon(weatherRow.breakdown.weatherState)}</span>
                                  </UnifiedTooltip>
                                </div>
                              )}

                              <div>
                                <div className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1.5">
                                  <HeartPulse className="h-3.5 w-3.5" />
                                  <span>Health: {formatPercentValue(currentHealth)}</span>
                                </div>
                                <UnifiedTooltip
                                  content={buildTooltipContent('health', {
                                    vineyard,
                                    value: currentHealth,
                                    weatherImpact: weatherRow?.healthDelta,
                                    normalProgressionImpact: weatherRow?.healthNormalDelta,
                                    weatherOnlyImpact: weatherRow?.healthWeatherDelta,
                                    projectedValue: weatherRow?.healthProjected,
                                    weatherBreakdown: weatherRow?.breakdown,
                                    siteResponse: weatherRow?.siteResponse
                                  })}
                                  title="Vineyard Health Details"
                                  side="top"
                                  className="max-w-sm"
                                  variant="panel"
                                  density="compact"
                                  triggerClassName="w-full cursor-help"
                                >
                                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden relative">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${getHealthProgressColor(currentHealth)}`}
                                      style={{
                                        width: `${Math.min(100, Math.max(0, currentHealth * 100))}%`,
                                        minWidth: currentHealth > 0 ? '2px' : '0px'
                                      }}
                                    ></div>
                                  </div>
                                </UnifiedTooltip>
                              </div>

                              {vineyard.grape ? (
                                <>
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1.5">
                                      <Grape className="h-3.5 w-3.5" />
                                      <span>Ripeness: {formatPercentValue(currentRipeness)}</span>
                                    </div>
                                    <UnifiedTooltip
                                      content={buildTooltipContent('ripeness', {
                                        value: currentRipeness,
                                        weatherImpact: weatherRow?.ripenessDelta,
                                        normalProgressionImpact: weatherRow?.ripenessNormalDelta,
                                        weatherOnlyImpact: weatherRow?.ripenessWeatherDelta,
                                        projectedValue: weatherRow?.ripenessProjected,
                                        weatherBreakdown: weatherRow?.breakdown,
                                        siteResponse: weatherRow?.siteResponse
                                      })}
                                      title="Ripeness Details"
                                      side="top"
                                      className="max-w-sm"
                                      variant="panel"
                                      density="compact"
                                      triggerClassName="w-full cursor-help"
                                    >
                                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden relative">
                                        <div
                                          className={`h-full rounded-full transition-all duration-300 ${getRipenessProgressColor(currentRipeness)}`}
                                          style={{
                                            width: `${Math.min(100, Math.max(0, currentRipeness * 100))}%`,
                                            minWidth: currentRipeness > 0 ? '2px' : '0px'
                                          }}
                                        ></div>
                                      </div>
                                    </UnifiedTooltip>
                                  </div>

                                  <div className="text-xs">
                                    <ExpectedYieldTooltip vineyard={vineyard} />
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-gray-400">No grape planted</div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Status & Actions */}
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <VineyardStatusBadge status={vineyard.status} />
                        <div className="flex flex-col space-y-1">
                          {getActionButtons(vineyard)}
                        </div>
                        
                        {/* Harvest features */}
                        {vineyard.grape && (
                          <div className="mt-3 pt-2 border-t border-gray-200">
                            <FeatureDisplay vineyard={vineyard} showPreviewRisks={true} />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vineyards Cards - Mobile */}
      <div className="lg:hidden space-y-4">
        {vineyards.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No vineyards yet. Create your first vineyard to get started!
          </div>
        ) : (
          vineyards.map((vineyard) => (
            <div key={vineyard.id} className="bg-white rounded-lg shadow overflow-hidden cursor-pointer" onClick={() => handleRowClick(vineyard)}>
              {/* Card Header */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 border-b">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{vineyard.name}</h3>
                    <div className="text-sm text-gray-600 mt-1">
                      {vineyard.grape ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {vineyard.grape}
                        </span>
                      ) : (
                        <span className="text-gray-400">No grape planted</span>
                      )}
                    </div>
                  </div>
                  <VineyardStatusBadge status={vineyard.status} />
                </div>
                
                {/* Location and Size/Value */}
                <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
                  <div className="flex items-center">
                    <span className={`${getFlagIcon(vineyard.country)} mr-2`}></span>
                    {vineyard.region}, {vineyard.country}
                  </div>
                  <div className="flex items-center space-x-4 text-xs">
                    <div className="text-right">
                      <div className="text-gray-500 uppercase">Size</div>
                      <div className="font-bold text-gray-900">{vineyard.hectares} ha</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500 uppercase">Value</div>
                      <div className="font-bold text-blue-600">{formatNumber(vineyard.vineyardTotalValue, { currency: true })}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Card Body */}
              <div className="p-4 space-y-4">
                {/* Characteristics and Vine Details - 2 Column Grid */}
                <div className="border-t pt-3">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Characteristics Section */}
                    <div>
                      <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Characteristics</div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Soil:</span>
                          <span className="text-gray-900">{vineyard.soil.join(', ')}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Altitude:</span>
                          <div className="flex items-center">
                            <span className="text-gray-900 mr-2">{vineyard.altitude}m</span>
                            {(() => {
                              const rating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
                              const colors = getBadgeColorClasses(rating);
                              return (
                                <UnifiedTooltip
                                  content={buildTooltipContent('rating', { label: 'Altitude Rating', value: rating, description: 'Altitude affects land-value modifier. Each region has an optimal altitude range for grape growing.' })}
                                  title="Altitude Rating Details"
                                  side="top"
                                  className="max-w-sm"
                                  variant="panel"
                                  density="compact"
                                  triggerClassName="inline-block cursor-help"
                                >
                                  <span className={`px-2 py-0.5 rounded text-xs cursor-help ${colors.text} ${colors.bg}`}>
                                    {formatNumber(rating, { decimals: 2, forceDecimals: true })}
                                  </span>
                                </UnifiedTooltip>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Aspect:</span>
                          <div className="flex items-center">
                            <span className="text-gray-900 mr-2">{vineyard.aspect}</span>
                            {(() => {
                              const rating = getAspectRating(vineyard.country, vineyard.region, vineyard.aspect);
                              const colors = getBadgeColorClasses(rating);
                              return (
                                <UnifiedTooltip
                                  content={buildTooltipContent('rating', { label: 'Aspect Rating', value: rating, description: 'Aspect (direction the vineyard faces) affects sun exposure and land-value modifier.' })}
                                  title="Aspect Rating Details"
                                  side="top"
                                  className="max-w-sm"
                                  variant="panel"
                                  density="compact"
                                  triggerClassName="inline-block cursor-help"
                                >
                                  <span className={`px-2 py-0.5 rounded text-xs cursor-help ${colors.text} ${colors.bg}`}>
                                    {formatNumber(rating, { decimals: 2, forceDecimals: true })}
                                  </span>
                                </UnifiedTooltip>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vine Details Section */}
                    <div>
                      <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Vine Details</div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Age:</span>
                          <span className="text-gray-900">
                            {vineyard.vineAge === null ? (
                              <span className="text-gray-400">Not planted</span>
                            ) : vineyard.vineAge === 0 ? (
                              <span className="text-green-600">Newly planted</span>
                            ) : (
                              <span>{vineyard.vineAge} years old</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Prestige:</span>
                          <UnifiedTooltip
                            content={buildTooltipContent('prestige', { value: vineyard.vineyardPrestige ?? 0 })}
                            title="Prestige Details"
                            side="top"
                            className="max-w-sm"
                            variant="panel"
                            density="compact"
                            triggerClassName="inline-block cursor-help"
                          >
                            {(() => { const { badge } = getRangeColor(vineyard.vineyardPrestige ?? 0, 0, 10, 'higher_better'); return (
                              <span className={`px-2 py-0.5 rounded text-xs cursor-help ${badge.text} ${badge.bg}`}>
                                {formatNumber(vineyard.vineyardPrestige ?? 0, { decimals: 2, forceDecimals: true })}
                              </span>
                            ); })()}
                          </UnifiedTooltip>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Density:</span>
                          {vineyard.density > 0 ? (
                            <UnifiedTooltip
                              content={buildTooltipContent('density', { value: vineyard.density })}
                              title="Density Details"
                              side="top"
                              className="max-w-sm"
                              variant="panel"
                              density="compact"
                              triggerClassName="inline-block cursor-help"
                            >
                              {(() => { const { badge } = getRangeColor(vineyard.density, 1500, 10000, 'lower_better'); return (
                                <span className={`px-2 py-0.5 rounded text-xs cursor-help ${badge.text} ${badge.bg}`}>
                                  {formatNumber(vineyard.density, { decimals: 0 })} vines/ha
                                </span>
                              ); })()}
                            </UnifiedTooltip>
                          ) : (
                            <span className="text-gray-400">Not planted</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vine Info Section with Health Integration */}
                {vineyard.grape && (
                  <div className="border-t pt-3">
                    <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Vine Information & Health</div>
                    <div className="space-y-3">
                      {/* Progress Bars and Yield - 2 Column Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Left Column - Progress Bars */}
                        <div className="space-y-3">
                          {/* Vineyard Health Progress */}
                          <div>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Health</span>
                              <span>{formatPercentValue(vineyard.vineyardHealth || 1.0)}</span>
                            </div>
                            <UnifiedTooltip
                              content={buildTooltipContent('health', { vineyard })}
                              title="Vineyard Health Details"
                              side="top"
                              className="max-w-sm"
                              variant="panel"
                              density="compact"
                              triggerClassName="w-full cursor-help"
                            >
                              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${getHealthProgressColor(vineyard.vineyardHealth || 1.0)}`}
                                  style={{ 
                                    width: `${Math.min(100, Math.max(0, (vineyard.vineyardHealth || 1.0) * 100))}%`,
                                    minWidth: (vineyard.vineyardHealth || 1.0) > 0 ? '2px' : '0px'
                                  }}
                                ></div>
                              </div>
                            </UnifiedTooltip>
                          </div>
                          
                          {/* Ripeness Progress */}
                          <div>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Ripeness</span>
                              <span>{formatPercentValue(vineyard.ripeness || 0)}</span>
                            </div>
                            <UnifiedTooltip
                              content={buildTooltipContent('ripeness', { value: vineyard.ripeness || 0 })}
                              title="Ripeness Details"
                              side="top"
                              className="max-w-sm"
                              variant="panel"
                              density="compact"
                              triggerClassName="w-full cursor-help"
                            >
                              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${getRipenessProgressColor(vineyard.ripeness || 0)}`}
                                  style={{ 
                                    width: `${Math.min(100, Math.max(0, (vineyard.ripeness || 0) * 100))}%`,
                                    minWidth: (vineyard.ripeness || 0) > 0 ? '2px' : '0px'
                                  }}
                                ></div>
                              </div>
                            </UnifiedTooltip>
                          </div>
                          
                          {/* Vine Yield Progress */}
                          <div>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Vine Yield</span>
                              <span>{formatNumber((vineyard.vineYield || 0.02) * 100, { smartDecimals: true })}%</span>
                            </div>
                            <UnifiedTooltip
                              content={buildTooltipContent('vineYield', { value: vineyard.vineYield || 0.02 })}
                              title="Vine Yield Details"
                              side="top"
                              className="max-w-sm"
                              variant="panel"
                              density="compact"
                              triggerClassName="w-full cursor-help"
                            >
                              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${getVineYieldProgressColor(vineyard.vineYield || 0.02)}`}
                                  style={{ 
                                    width: `${Math.min(100, Math.max(0, (vineyard.vineYield || 0.02) * 100))}%`,
                                    minWidth: (vineyard.vineYield || 0.02) > 0 ? '2px' : '0px'
                                  }}
                                ></div>
                              </div>
                            </UnifiedTooltip>
                          </div>
                        </div>
                        
                        {/* Right Column - Expected Yield and Harvest Risks */}
                        <div className="flex flex-col justify-center space-y-3">
                          <div className="bg-green-50 rounded-lg p-3 text-center">
                            <ExpectedYieldTooltip vineyard={vineyard} />
                          </div>
                          
                          {/* Harvest Risks */}
                          <div>
                            <FeatureDisplay vineyard={vineyard} showPreviewRisks={true} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Card Footer - Actions */}
              <div className="bg-gray-50 px-4 py-3 border-t" onClick={(e) => e.stopPropagation()}>
                {getActionButtons(vineyard)}
              </div>
            </div>
          ))
        )}
      </div>

      <PlantingOptionsModal
        isOpen={showPlantDialog}
        vineyard={selectedVineyard}
        onClose={() => {
          setShowPlantDialog(false);
          setSelectedVineyard(null);
        }}
      />

      <HarvestOptionsModal
        isOpen={showHarvestDialog}
        vineyard={selectedVineyard}
        onClose={() => {
          setShowHarvestDialog(false);
          setSelectedVineyard(null);
        }}
      />

      <LandSearchOptionsModal
        isOpen={showLandSearchModal}
        onClose={() => setShowLandSearchModal(false)}
        onSearchStarted={() => setShowLandSearchModal(false)}
      />

      <LandSearchResultsModal
        isOpen={showLandResultsModal}
        onClose={() => {
          setShowLandResultsModal(false);
          clearPendingLandSearchResults();
        }}
        options={gameState.pendingLandSearchResults?.options || []}
      />

      <VineyardModal
        isOpen={showVineyardModal}
        onClose={() => setShowVineyardModal(false)}
        vineyard={selectedVineyard}
      />

      <ClearingOptionsModal
        isOpen={showClearingModal}
        vineyard={selectedVineyard}
        onClose={() => {
          setShowClearingModal(false);
          setSelectedVineyard(null);
        }}
        onSubmit={handleClearingSubmit}
      />
      {showSellModal && selectedVineyard && (
        <WarningModal
          isOpen={showSellModal}
          onClose={() => setShowSellModal(false)}
          severity={'warning'}
          title={'Confirm Vineyard Sale'}
          message={`Are you sure you want to sell "${selectedVineyard.name}"? This action cannot be undone.`}
          details={`You will receive 90% of its current value after a 10% fee.\n\nEstimated proceeds: ${formatNumber((selectedVineyard.vineyardTotalValue || 0) * 0.9, { currency: true })}\nCurrent value: ${formatNumber(selectedVineyard.vineyardTotalValue || 0, { currency: true })}`}
          actions={[
            { label: 'Cancel', onClick: () => {}, variant: 'outline' },
            { label: 'Sell Vineyard', onClick: () => { confirmSellVineyard(); }, variant: 'destructive' }
          ]}
        />
      )}
    </div>
  );
};

export default Vineyard;
