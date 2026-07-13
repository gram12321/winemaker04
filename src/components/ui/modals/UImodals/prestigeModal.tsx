import React, { useState, useRef, useCallback } from 'react';
import { PrestigeEvent } from '@/lib/types/types';
import { formatNumber, getRatingForRange, getRangeColor } from '@/lib/utils';
import { STATUS_EMOJIS } from '@/lib/utils/icons';
import { getEventDisplayData, consolidateWineFeatureEvents, ConsolidatedWineFeatureEvent } from '@/lib/services';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../shadCN/dialog';
import { Badge } from '../../shadCN/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../shadCN/card';
import { Separator } from '../../shadCN/separator';
import { TooltipSection, TooltipRow, TooltipHeader, tooltipStyles, UnifiedTooltip } from '../../shadCN/tooltip';
import { Star, TrendingUp, Grape, DollarSign, ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import { DialogProps } from '@/lib/types/UItypes';

// Type definitions for calculation data
type CompanyValueCalculationData = {
  type: 'company_value';
  companyValue: number;
  maxLandValue: number;
  baseValue: number;
  finalPrestige: number;
};

type VineyardLandCalculationData = {
  type: 'vineyard_land';
  vineyardName: string;
  landValuePerHa: number;
  landNormalized01: number;
  landWithSuitability01: number;
  hectares: number;
  density: number;
  densityModifier: number;
  sizeFactor: number;
  asymScaling: number;
  suitability: number;
  finalPrestige: number;
};

type VineyardAgeCalculationData = {
  type: 'vineyard_age';
  vineyardName: string;
  vineAge: number;
  ageBase: number;
  grapeSuitability: number;
  densityModifier: number;
  finalPrestige: number;
};

type WineFeatureCalculationData = {
  type: 'wine_feature';
  featureName: string;
  wineName: string;
  eventType: string;
  level: string;
  baseAmount: number;
  finalPrestige: number;
};

type CalculationData =
  | CompanyValueCalculationData
  | VineyardLandCalculationData
  | VineyardAgeCalculationData
  | WineFeatureCalculationData
  | { [key: string]: any; type: string }; // Fallback for dynamic data

/**
 * Prestige Modal
 * Modal for displaying detailed prestige breakdown and sources
 */
interface PrestigeModalProps extends DialogProps {
  totalPrestige: number;
  eventBreakdown?: PrestigeEvent[];
  companyPrestige?: number;
  vineyardPrestige?: number;
  vineyards?: Array<{
    id: string;
    name: string;
    prestige: number;
    events: PrestigeEvent[];
  }>;
}

const PrestigeModal: React.FC<PrestigeModalProps> = ({
  isOpen,
  onClose,
  totalPrestige,
  eventBreakdown: rawEventBreakdown,
  companyPrestige = 0,
  vineyardPrestige = 0,
  vineyards: rawVineyards = []
}) => {
  const eventBreakdown = Array.isArray(rawEventBreakdown)
    ? rawEventBreakdown.filter((event): event is PrestigeEvent => Boolean(event && typeof event.type === 'string'))
    : [];

  const vineyards = Array.isArray(rawVineyards)
    ? rawVineyards
      .filter((vineyard): vineyard is NonNullable<typeof rawVineyards>[number] => Boolean(vineyard && typeof vineyard.id === 'string'))
      .map((vineyard) => ({
        ...vineyard,
        events: Array.isArray(vineyard.events)
          ? vineyard.events.filter((event): event is PrestigeEvent => Boolean(event && typeof event.type === 'string'))
          : []
      }))
    : [];

  // State initialization
  const [selectedVineyard, setSelectedVineyard] = useState<string>('all');
  const [selectedWine, setSelectedWine] = useState<string>('all');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const didInitAutoCollapse = useRef(false);

  const eventConfig = {
    company_finance: { icon: DollarSign, label: 'Company Finance', color: 'bg-blue-100 text-blue-800' },
    company_story: { icon: Star, label: 'Company Story', color: 'bg-indigo-100 text-indigo-800' },
    admin_cheat: { icon: Star, label: 'Admin Prestige', color: 'bg-slate-100 text-slate-800' },
    sale: { icon: TrendingUp, label: 'Company Sales', color: 'bg-emerald-100 text-emerald-800' },
    cellar_collection: { icon: TrendingUp, label: 'Cellar Collection', color: 'bg-amber-100 text-amber-800' },
    achievement: { icon: Star, label: 'Achievements & Milestones', color: 'bg-yellow-100 text-yellow-800' },
    research: { icon: FlaskConical, label: 'Research Milestones', color: 'bg-cyan-100 text-cyan-800' },
    vineyard_sale: { icon: Grape, label: 'Vineyard Sales', color: 'bg-green-100 text-green-800' },
    vineyard_achievement: { icon: Star, label: 'Vineyard Achievements', color: 'bg-yellow-100 text-yellow-800' },
    vineyard_age: { icon: Star, label: 'Vine Age', color: 'bg-orange-100 text-orange-800' },
    vineyard_land: { icon: DollarSign, label: 'Land Value', color: 'bg-green-100 text-green-800' },
    wine_feature: { icon: Star, label: 'Wine Features', color: 'bg-purple-100 text-purple-800' },
    penalty: { icon: Star, label: 'Penalties', color: 'bg-red-100 text-red-800' },
  };

  const getEventConfig = (type: string) => eventConfig[type as keyof typeof eventConfig] || { icon: Star, label: type, color: 'bg-gray-100 text-gray-800' };

  const formatDecayRate = (decayRate: number) => {
    if (decayRate === 0) return 'No decay';

    // decayRate is the weekly retention rate (0-1)
    // Calculate weekly decay rate
    const weeklyDecayRate = 1 - decayRate;
    const weeklyDecayPercent = weeklyDecayRate * 100;

    // Calculate annual retention rate (decayRate^52)
    const annualRetentionRate = Math.pow(decayRate, 52);
    const annualDecayPercent = (1 - annualRetentionRate) * 100;

    // For very small decay rates, show more precision
    if (weeklyDecayPercent < 0.1) {
      return `${formatNumber(weeklyDecayPercent, { decimals: 3 })}% weekly decay (${formatNumber(annualDecayPercent, { decimals: 1 })}% annually)`;
    } else if (weeklyDecayPercent < 1) {
      return `${formatNumber(weeklyDecayPercent, { decimals: 2 })}% weekly decay (${formatNumber(annualDecayPercent, { decimals: 1 })}% annually)`;
    } else {
      return `${formatNumber(weeklyDecayPercent, { decimals: 1 })}% weekly decay (${formatNumber(annualDecayPercent, { decimals: 1 })}% annually)`;
    }
  };

  const formatAmount = (amount: number | null | undefined) => {
    const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    return formatNumber(safeAmount, { decimals: 2, forceDecimals: true });
  };

  const formatProjectionAmount = (value: number, sourceCurrentValue: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    const safeCurrent = Number.isFinite(sourceCurrentValue) ? sourceCurrentValue : 0;
    const hasDirection = safeCurrent !== 0;
    const isTiny = Math.abs(safeValue) < 0.01;
    if (isTiny && hasDirection) {
      return safeCurrent > 0 ? '<0,01' : '>-0,01';
    }
    return formatAmount(safeValue);
  };

  const formatProjectionHorizonLabel = (weeks: number) => {
    if (weeks >= 52) {
      const years = weeks / 52;
      return `${formatNumber(years, { decimals: 2, forceDecimals: true })} years`;
    }
    if (weeks >= 4) {
      const months = weeks / 4;
      return `${formatNumber(months, { decimals: 2, forceDecimals: true })} months`;
    }
    return `${formatNumber(weeks, { decimals: 0 })} week${weeks === 1 ? '' : 's'}`;
  };

  const getEventMetadata = (event: PrestigeEvent): any => event.metadata ?? {};

  const getAchievementCategoryKey = (event: PrestigeEvent): string => {
    const metadata = getEventMetadata(event);
    if (typeof metadata.achievementCategory === 'string' && metadata.achievementCategory.trim()) {
      return metadata.achievementCategory.trim().toLowerCase();
    }
    return 'other';
  };

  const getAchievementCategoryLabel = (categoryKey: string): string => {
    const labels: Record<string, string> = {
      research: 'Research Milestones',
      financial: 'Financial Achievements',
      production: 'Production Achievements',
      time: 'Time Achievements',
      prestige: 'Prestige Achievements',
      sales: 'Sales Achievements',
      vineyard: 'Vineyard Achievements',
      special: 'Special Achievements',
      other: 'Other Milestones',
    };

    return labels[categoryKey] ?? `${categoryKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Achievements`;
  };

  // Memoized CalculationTooltip component
  const CalculationTooltip = useCallback(({ children, calculationData }: { children: React.ReactNode; calculationData: CalculationData }) => {
    const getFormulaText = (type: string) => {
      switch (type) {
        case 'company_value':
          return `Formula:\n- Company value is log-normalized against Company Scaling Value`;
        case 'vineyard_land':
          return `Formula:\n1. Land Value: log(€value / €max + 1) = normalized (0-1)\n2. Suitability: normalized × grape suitability\n3. Asymmetric Scaling: smooth curve for diminishing returns\n4. Size Bonus: ×√hectares (larger vineyards worth more)\n5. Density Modifier: premium approach (lower density = ×1.5, higher density = ×0.5)\n6. Final Prestige: all factors combined`;
        case 'vineyard_age':
          return `Formula:\n- Vine age is converted to a 0-1 scale with diminishing returns\n- Multiplied by grape suitability factor\n- Then scaled with asymmetric scaling and density modifier`;
        case 'wine_feature':
          return `Formula:\n- Base prestige amount varies by feature type and event\n- May include dynamic scaling based on company/vineyard prestige`;
        default:
          return '';
      }
    };

    const renderCalculationData = () => {
      if (!calculationData) return null;

      switch (calculationData.type) {
        case 'company_value':
          return (
            <div className="space-y-2">
              <TooltipRow
                label="Company Value:"
                value={formatNumber(calculationData.companyValue, { currency: true, smartDecimals: true })}
                valueRating={getRatingForRange(calculationData.companyValue / 1000000, 0, 1000, 'exponential')}
              />
              <TooltipRow
                label="Company Scaling Value:"
                value={formatNumber(calculationData.maxLandValue, { currency: true, smartDecimals: true })}
              />
              <TooltipRow
                label="Company Prestige Base:"
                value={`${formatNumber(calculationData.companyValue, { smartDecimals: true })} ÷ ${formatNumber(calculationData.maxLandValue, { smartDecimals: true })} = ${formatNumber(calculationData.baseValue, { smartDecimals: true })}`}
                monospaced={true}
              />
              <TooltipRow
                label="Final Prestige:"
                value={formatNumber(calculationData.finalPrestige, { smartDecimals: true })}
                valueRating={getRatingForRange(calculationData.finalPrestige, 0, 10, 'higher_better')}
              />
            </div>
          );

        case 'vineyard_land':
          return (
            <div className="space-y-2">
              <TooltipRow
                label="Vineyard:"
                value={calculationData.vineyardName}
              />
              <TooltipRow
                label="Land Value:"
                value={`${formatNumber(calculationData.landValuePerHa, { currency: true, smartDecimals: true })}/ha`}
                valueRating={getRatingForRange(calculationData.landValuePerHa, 0, 1000000, 'exponential')}
              />
              <TooltipRow
                label="Land Value (Normalized):"
                value={formatNumber(calculationData.landNormalized01, { smartDecimals: true })}
                valueRating={getRatingForRange(calculationData.landNormalized01, 0, 1, 'higher_better')}
              />
              <TooltipRow
                label="Land with Suitability:"
                value={formatNumber(calculationData.landWithSuitability01, { smartDecimals: true })}
                valueRating={getRatingForRange(calculationData.landWithSuitability01, 0, 1, 'higher_better')}
              />
              <TooltipRow
                label="Total Hectares:"
                value={`${formatNumber(calculationData.hectares, { smartDecimals: true })} ha`}
                valueRating={getRatingForRange(calculationData.hectares, 0, 100, 'exponential')}
              />
              <TooltipRow
                label="Vine Density:"
                value={`${formatNumber(calculationData.density, { smartDecimals: true })} vines/ha`}
                valueRating={getRatingForRange(calculationData.density, 1500, 10000, 'lower_better')}
              />
              <TooltipRow
                label="Density Modifier:"
                value={`×${formatNumber(calculationData.densityModifier, { smartDecimals: true })}`}
              />
              <TooltipRow
                label="Size Factor:"
                value={formatNumber(calculationData.sizeFactor, { smartDecimals: true })}
              />
              <TooltipRow
                label="Asymmetric Scaling:"
                value={formatNumber(calculationData.asymScaling, { smartDecimals: true })}
              />
              <TooltipRow
                label="Final Prestige:"
                value={formatNumber(calculationData.finalPrestige, { smartDecimals: true })}
                valueRating={getRatingForRange(calculationData.finalPrestige, 0, 10, 'higher_better')}
              />
              {/* Human-readable formula with explanations */}
              <div className="mt-2 border-t border-gray-600 pt-2 space-y-2 text-xs text-gray-400">
                <div>
                  <div className="mb-1">Formula:</div>
                  <div className="whitespace-pre-line">
                    {`Prestige = (AsymmetricScale( [Min/Max 0-1]( log(€[Land Value/ha] / [Global Max Land Value/ha] + 1) × [Grape Suitability] ) ) − 1) × [√hectares] × [Density Modifier]`}
                  </div>
                </div>
                <div>
                  <div>Density Modifier: [Vineyard Density / Default Density]</div>
                </div>
                {(() => {
                  const normalized = formatNumber(calculationData.landNormalized01, { smartDecimals: true });
                  const suitability = formatNumber(calculationData.suitability, { smartDecimals: true });
                  const withSuitability = formatNumber(calculationData.landWithSuitability01, { smartDecimals: true });
                  const perHaAsym = formatNumber(calculationData.asymScaling, { smartDecimals: true });
                  const size = formatNumber(calculationData.sizeFactor, { smartDecimals: true });
                  const densityMod = formatNumber(calculationData.densityModifier, { smartDecimals: true });
                  const final = formatNumber(calculationData.finalPrestige, { smartDecimals: true });
                  return (
                    <div>
                      <div className="mb-1">With values:</div>
                      <div className="whitespace-pre-line">
                        {`Prestige = (AsymmetricScale( clamp01( ${normalized} × ${suitability} ) = ${withSuitability} ) − 1) × ${size} × ${densityMod} = ${perHaAsym} × ${size} × ${densityMod} = ${final}`}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          );

        case 'vineyard_age':
          return (
            <div className="space-y-2">
              <TooltipRow
                label="Vineyard:"
                value={calculationData.vineyardName}
              />
              <TooltipRow
                label="Vine Age:"
                value={`${calculationData.vineAge} years`}
                valueRating={getRatingForRange(calculationData.vineAge, 0, 50, 'higher_better')}
              />
              <TooltipRow
                label="Age Base:"
                value={formatNumber(calculationData.ageBase, { smartDecimals: true })}
                valueRating={getRatingForRange(calculationData.ageBase, 0, 1, 'higher_better')}
              />
              <TooltipRow
                label="Grape Suitability:"
                value={formatNumber(calculationData.grapeSuitability, { smartDecimals: true })}
                valueRating={getRatingForRange(calculationData.grapeSuitability, 0, 1, 'higher_better')}
              />
              <TooltipRow
                label="Density Modifier:"
                value={`×${formatNumber(calculationData.densityModifier, { smartDecimals: true })}`}
                valueRating={getRatingForRange(calculationData.densityModifier, 0, 1, 'higher_better')}
              />
              <TooltipRow
                label="Final Prestige:"
                value={formatNumber(calculationData.finalPrestige, { smartDecimals: true })}
                valueRating={getRatingForRange(calculationData.finalPrestige, 0, 10, 'higher_better')}
              />
              {/* Human-readable formula with explanations */}
              <div className="mt-2 border-t border-gray-600 pt-2 space-y-2 text-xs text-gray-400">
                <div>
                  <div className="mb-1">Formula:</div>
                  <div className="whitespace-pre-line">
                    {`Prestige = (AsymmetricScale( [Age Modifier]( [Vine Age] → [0-1 Scale] ) × [Grape Suitability] ) ) − 1) × [Density Modifier]`}
                  </div>
                </div>
                <div>
                  <div>Age Modifier: Converts vine age to 0-1 scale with diminishing returns</div>
                </div>
                {(() => {
                  const ageBase = formatNumber(calculationData.ageBase, { smartDecimals: true });
                  const suitability = formatNumber(calculationData.grapeSuitability, { smartDecimals: true });
                  const densityMod = formatNumber(calculationData.densityModifier, { smartDecimals: true });
                  const final = formatNumber(calculationData.finalPrestige, { smartDecimals: true });
                  return (
                    <div>
                      <div className="mb-1">With values:</div>
                      <div className="whitespace-pre-line">
                        {`Prestige = (AsymmetricScale( ${ageBase} × ${suitability} ) ) − 1) × ${densityMod} = ${final}`}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          );

        case 'wine_feature':
          return (
            <div className="space-y-2">
              <TooltipRow
                label="Feature:"
                value={calculationData.featureName}
              />
              <TooltipRow
                label="Wine:"
                value={calculationData.wineName}
              />
              <TooltipRow
                label="Event Type:"
                value={calculationData.eventType}
              />
              <TooltipRow
                label="Level:"
                value={calculationData.level}
              />
              <TooltipRow
                label="Base Amount:"
                value={formatNumber(calculationData.baseAmount, { smartDecimals: true })}
                valueRating={getRatingForRange(calculationData.baseAmount, 0, 1, 'higher_better')}
              />
              <TooltipRow
                label="Final Prestige:"
                value={formatNumber(calculationData.finalPrestige, { smartDecimals: true })}
                valueRating={getRatingForRange(calculationData.finalPrestige, 0, 10, 'higher_better')}
              />
              {/* Human-readable formula with explanations */}
              <div className="mt-2 border-t border-gray-600 pt-2 space-y-2 text-xs text-gray-400">
                <div>
                  <div className="mb-1">Formula:</div>
                  <div className="whitespace-pre-line">
                    {`Prestige = [Base Amount] × [Dynamic Scaling Factors]`}
                  </div>
                </div>
                <div>
                  <div>Dynamic Scaling: May include company/vineyard prestige, batch size, quality, and sale value factors</div>
                </div>
                {(() => {
                  const baseAmount = formatNumber(calculationData.baseAmount, { smartDecimals: true });
                  const final = formatNumber(calculationData.finalPrestige, { smartDecimals: true });
                  return (
                    <div>
                      <div className="mb-1">With values:</div>
                      <div className="whitespace-pre-line">
                        {`Prestige = ${baseAmount} × [Dynamic Factors] = ${final}`}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          );

        default:
          return null;
      }
    };

    const tooltipBody = (
      <div className={tooltipStyles.text}>
        <TooltipSection title="Calculation Breakdown">
          {renderCalculationData()}
        </TooltipSection>
        <div className="mt-2 border-t border-gray-600 pt-2 whitespace-pre-line text-xs text-gray-300">
          {getFormulaText(calculationData?.type || '')}
        </div>
      </div>
    );

    return (
      <UnifiedTooltip
        content={tooltipBody}
        title="Calculation Details"
        side="top"
        className="max-w-sm"
        variant="panel"
        density="compact"
        scrollable
        maxHeight="max-h-60"
        triggerClassName="inline-block"
      >
        {children}
      </UnifiedTooltip>
    );
  }, []);

  // Estimate elapsed weeks based on decay retention and original/current amounts
  const estimateWeeksFromDecay = (
    originalAmount?: number,
    currentAmount?: number,
    decayRate?: number
  ) => {
    if (!originalAmount || !currentAmount || !decayRate) return undefined;
    if (originalAmount === 0 || currentAmount === 0) return undefined;
    if (decayRate <= 0 || decayRate >= 1) return undefined;

    // Handle both positive and negative values
    const ratio = currentAmount / originalAmount;
    if (ratio <= 0 || !isFinite(ratio)) return undefined;

    // For negative values, we need to ensure the ratio is still valid
    if (Math.abs(originalAmount) < 0.001 || Math.abs(currentAmount) < 0.001) return undefined;

    const weeks = Math.log(ratio) / Math.log(decayRate);
    if (!isFinite(weeks) || weeks < 0) return undefined;
    return Math.round(weeks);
  };

  type DecayProjectionPoint = {
    label: string;
    weeks: number;
    value: number;
    retentionPercent: number;
  };

  const projectionCandidates = [
    { label: '1 week', weeks: 1 },
    { label: '2 weeks', weeks: 2 },
    { label: '1 month', weeks: 4 },
    { label: '3 months', weeks: 13 },
    { label: '6 months', weeks: 26 },
    { label: '1 year', weeks: 52 },
    { label: '2 years', weeks: 104 },
    { label: '5 years', weeks: 260 },
    { label: '10 years', weeks: 520 },
    { label: '25 years', weeks: 1300 },
    { label: '50 years', weeks: 2600 },
    { label: '100 years', weeks: 5200 },
  ];

  const selectProjectionHorizons = (decayRate: number): Array<{ label: string; weeks: number }> => {
    if (!Number.isFinite(decayRate) || decayRate <= 0 || decayRate >= 1) return [];

    const halfLifeWeeks = Math.log(0.5) / Math.log(decayRate);
    const onePercentWeeks = Math.log(0.01) / Math.log(decayRate);

    let preferredWeeks: number[];
    if (halfLifeWeeks < 8) {
      preferredWeeks = [1, 4, 13, 26, 52];
    } else if (halfLifeWeeks < 52) {
      preferredWeeks = [4, 13, 26, 52, 104];
    } else if (halfLifeWeeks < 260) {
      preferredWeeks = [26, 52, 104, 260, 520];
    } else if (halfLifeWeeks < 1300) {
      preferredWeeks = [52, 104, 260, 520, 1300];
    } else {
      preferredWeeks = [260, 520, 1300, 2600, 5200];
    }

    // Avoid showing extremely long horizons for quickly vanishing sources.
    const maxRelevantWeeks = onePercentWeeks < 104 ? Math.max(26, Math.ceil(onePercentWeeks * 1.25)) : Infinity;

    const preferred = projectionCandidates.filter(candidate =>
      preferredWeeks.includes(candidate.weeks) && candidate.weeks <= maxRelevantWeeks
    );

    if (preferred.length >= 3) {
      return preferred;
    }

    // Fallback: add closest candidate horizons around quarter/half/full/double half-life.
    const targets = [0.25, 0.5, 1, 2, 4].map(multiplier => Math.max(1, Math.round(halfLifeWeeks * multiplier)));
    const augmented: Array<{ label: string; weeks: number }> = [...preferred];
    const used = new Set(augmented.map(item => item.weeks));

    for (const target of targets) {
      let best = null as { label: string; weeks: number } | null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of projectionCandidates) {
        if (used.has(candidate.weeks) || candidate.weeks > maxRelevantWeeks) continue;
        const distance = Math.abs(candidate.weeks - target);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }
      if (best) {
        augmented.push(best);
        used.add(best.weeks);
      }
      if (augmented.length >= 4) break;
    }

    return augmented.sort((a, b) => a.weeks - b.weeks);
  };

  const buildDecayProjection = (currentValue: number, decayRate: number): DecayProjectionPoint[] => {
    if (!Number.isFinite(currentValue) || !Number.isFinite(decayRate) || decayRate <= 0 || decayRate >= 1) {
      return [];
    }

    return selectProjectionHorizons(decayRate).map(horizon => {
      const retention = Math.pow(decayRate, horizon.weeks);
      return {
        label: horizon.label,
        weeks: horizon.weeks,
        value: currentValue * retention,
        retentionPercent: retention * 100,
      };
    });
  };

  const EventDisplay = ({ event }: { event: PrestigeEvent }) => {
    const displayData = getEventDisplayData(event);
    const isAchievement = event.type === 'achievement' || event.type === 'vineyard_achievement';
    const currentValue = event.currentAmount ?? event.amount;
    const hasDecay = Number.isFinite(event.decayRate) && event.decayRate > 0 && event.decayRate < 1;
    const decayProjection = hasDecay ? buildDecayProjection(currentValue, event.decayRate) : [];

    return (
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isAchievement ? (
              <p className={`text-sm ${tooltipStyles.subtitle}`}>{displayData.title}</p>
            ) : (
              displayData.calculationData ? (
                <CalculationTooltip calculationData={displayData.calculationData}>
                  <p className={`text-sm ${tooltipStyles.subtitle} cursor-help`}>{displayData.title}</p>
                </CalculationTooltip>
              ) : (
                <p className={`text-sm ${tooltipStyles.subtitle}`}>{displayData.title}</p>
              )
            )}
            {!isAchievement && displayData.displayInfo && (
              <UnifiedTooltip
                content={
                  <div className={tooltipStyles.text}>
                    <TooltipSection>
                      <TooltipHeader
                        title={displayData.title || 'Details'}
                        description={displayData.displayInfo || 'Additional information'}
                      />
                    </TooltipSection>
                    <div className="mt-2 border-t border-gray-600 pt-2 whitespace-pre-line text-gray-300">
                      {`Additional Info:\n- This prestige source contributes to your total company prestige\n- Some sources decay over time, others remain permanent`}
                    </div>
                  </div>
                }
                title={displayData.title || 'Details'}
                className="max-w-sm"
                variant="panel"
                density="compact"
                scrollable
                maxHeight="max-h-60"
                triggerClassName="inline-block"
              >
                <span className={`${tooltipStyles.text} text-muted-foreground cursor-help`}>(details)</span>
              </UnifiedTooltip>
            )}
          </div>
          {hasDecay && decayProjection.length > 0 ? (
            <UnifiedTooltip
              content={
                <div className={tooltipStyles.text}>
                  <TooltipSection title="Decay Projection">
                    <TooltipRow
                      label="Prestige now:"
                      value={formatAmount(currentValue)}
                      monospaced={true}
                    />
                    {decayProjection.map((projection) => (
                      <TooltipRow
                        key={projection.weeks}
                        label={`In ${formatProjectionHorizonLabel(projection.weeks)}:`}
                        value={`${formatProjectionAmount(projection.value, currentValue)} (${formatNumber(projection.retentionPercent, { decimals: 1, forceDecimals: true })}% retained)`}
                        monospaced={true}
                      />
                    ))}
                  </TooltipSection>
                </div>
              }
              title="Decay Projection"
              className="max-w-sm"
              variant="panel"
              density="compact"
              scrollable
              maxHeight="max-h-60"
              triggerClassName="inline-block"
              showMobileHint
              mobileHintVariant="corner-dot"
            >
              <p className={`${tooltipStyles.text} text-muted-foreground cursor-help`}>
                {formatDecayRate(event.decayRate)} {STATUS_EMOJIS.time}
              </p>
            </UnifiedTooltip>
          ) : (
            <p className={`${tooltipStyles.text} text-muted-foreground`}>{formatDecayRate(event.decayRate)}</p>
          )}
        </div>
        <div className="text-right">
          <UnifiedTooltip
            content={(() => {
              const original = event.originalAmount ?? event.amount;
              const current = event.currentAmount ?? event.amount;
              const weeks = estimateWeeksFromDecay(original, current, event.decayRate);
              return (
                <div className={tooltipStyles.text}>
                  <TooltipSection title="Prestige Details">
                    <TooltipRow
                      label="Original:"
                      value={formatAmount(original)}
                      monospaced={true}
                    />
                    <TooltipRow
                      label="Weekly decay:"
                      value={event.decayRate === 0 ? 'No decay' : `${formatNumber((1 - event.decayRate) * 100, { smartDecimals: true })}%`}
                      // Use logarithmic scale: 0.90-1.0 retention rate maps to 0-1 rating
                      // 0.90 retention (10% decay) = 0 rating (red)
                      // 1.0 retention (0% decay) = 1 rating (green)
                      valueRating={event.decayRate === 0 ? 1 : Math.max(0, Math.min(1, (event.decayRate - 0.90) / 0.10))}
                    />
                    {event.decayRate && event.decayRate > 0 && weeks !== undefined ? (
                      <TooltipRow
                        label="Estimation:"
                        value={`${formatAmount(original)} × ${formatNumber(event.decayRate, { decimals: 4 })}^${weeks} ≈ ${formatAmount(current)}`}
                        monospaced={true}
                      />
                    ) : (
                      <TooltipRow
                        label="Formula:"
                        value="Current ≈ Original × retention^weeks"
                        monospaced={true}
                      />
                    )}
                  </TooltipSection>
                  <div className="mt-2 border-t border-gray-600 pt-2 whitespace-pre-line text-gray-300">
                    {`Notes:\n- Weekly decay shows how much prestige is lost each week.\n- Lower decay means prestige lasts longer.`}
                  </div>
                </div>
              );
            })()}
            title="Prestige Details"
            className="max-w-sm"
            variant="panel"
            density="compact"
            scrollable
            maxHeight="max-h-60"
            triggerClassName="inline-block"
          >
            <p className={`text-sm ${tooltipStyles.subtitle} cursor-help ${getRangeColor(event.currentAmount ?? event.amount, 0, 10, 'higher_better').text}`}>{formatAmount(event.currentAmount ?? event.amount)}</p>
          </UnifiedTooltip>
          {event.originalAmount !== event.currentAmount && (
            <p className={`${tooltipStyles.text} text-muted-foreground`}>
              (was {formatAmount(event.originalAmount ?? event.amount)})
            </p>
          )}
        </div>
      </div>
    );
  };

  const ConsolidatedWineFeatureDisplay = ({ consolidatedEvent }: { consolidatedEvent: ConsolidatedWineFeatureEvent }) => {
    const { vineyardName, grape, vintage, features, totalAmount, totalOriginalAmount } = consolidatedEvent;

    const getEventTypeLabel = (eventType: string) => {
      switch (eventType) {
        case 'manifestation': return 'Manifestation';
        case 'sale': return 'Sale';
        default: return 'Event';
      }
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">
                {vineyardName} - {grape} ({vintage})
              </p>
              <Badge variant="outline" className="text-xs">
                {features.length} feature{features.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{formatAmount(totalAmount)}</p>
            {totalOriginalAmount !== totalAmount && (
              <p className="text-xs text-muted-foreground">
                (was {formatAmount(totalOriginalAmount)})
              </p>
            )}
          </div>
        </div>

        {/* Feature breakdown */}
        <div className="ml-4 space-y-1">
          {features.map((feature, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">
                  {feature.featureName} ({getEventTypeLabel(feature.eventType)})
                </span>
                <UnifiedTooltip
                  content={
                    <div className={tooltipStyles.text}>
                      <TooltipSection title={`${feature.featureName} Events`}>
                        <div className="space-y-2">
                          {feature.recentEvents.map((event, eventIdx) => {
                            const metadata: any = event.metadata ?? {};
                            const customerName = metadata.customerName || 'Unknown Customer';
                            const saleValue = metadata.saleValue || 0;
                            const saleVolume = metadata.saleVolume || 0;

                            return (
                              <div key={eventIdx} className="space-y-1">
                                <TooltipRow
                                  label={`${customerName}:`}
                                  value={`${formatAmount(event.amount)} prestige`}
                                  monospaced={true}
                                />
                                {saleValue > 0 && (
                                  <div className="ml-4 text-xs text-gray-400">
                                    Sale: {formatNumber(saleValue, { currency: true, smartDecimals: true })} ({saleVolume} bottles)
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </TooltipSection>
                      <div className="mt-2 border-t border-gray-600 pt-2 whitespace-pre-line text-gray-300">
                        {`Total: ${formatAmount(feature.totalAmount)} prestige\nDecay: ${formatDecayRate(feature.decayRate)}`}
                      </div>
                    </div>
                  }
                  title={`${feature.featureName} Events`}
                  className="max-w-sm"
                  variant="panel"
                  density="compact"
                  scrollable
                  maxHeight="max-h-60"
                  triggerClassName="inline-block"
                  showMobileHint
                  mobileHintVariant="corner-dot"
                >
                  <Badge variant="outline" className="text-[10px] cursor-help">
                    {feature.eventCount} {feature.eventCount === 1 ? 'event' : 'events'}
                  </Badge>
                </UnifiedTooltip>
              </div>
              <div className="text-right">
                <span className="font-medium">{formatAmount(feature.totalAmount)}</span>
                <span className="text-gray-500 ml-1">({formatDecayRate(feature.decayRate)})</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getFilteredVineyards = () =>
    selectedVineyard === 'all' ? vineyards : vineyards.filter(vineyard => vineyard.id === selectedVineyard);

  const getFilteredWines = () => {
    if (selectedWine === 'all') {
      return consolidatedCompanyWineFeatures;
    }
    return consolidatedCompanyWineFeatures.filter(wine =>
      `${wine.vineyardName}_${wine.grape}_${wine.vintage}` === selectedWine
    );
  };

  // Helper function to group events by type and feature name
  const groupEventsByTypeAndFeature = (events: PrestigeEvent[] = []) => {
    const groups = new Map<string, number>();

    for (const event of events ?? []) {
      if (!event || typeof event.type !== 'string') continue;

      if (event.type === 'wine_feature' && event.metadata) {
        const metadata: any = event.metadata;
        const featureName = metadata.featureName || 'Unknown Feature';
        const eventType = metadata.eventType || 'unknown';

        const key = `${eventType} ${featureName}`;
        groups.set(key, (groups.get(key) || 0) + 1);
      } else {
        // Handle other event types
        const eventType = event.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        groups.set(eventType, (groups.get(eventType) || 0) + 1);
      }
    }

    return Array.from(groups.entries())
      .map(([key, count]) => ({ type: key, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Collapsible section helpers
  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  const isSectionCollapsed = (sectionId: string) => collapsedSections.has(sectionId);

  // Auto-collapse sections with more than 3 items
  const shouldAutoCollapse = (items: any[]) => {
    return items.length > 3;
  };


  // Separate wine feature events by level (company vs vineyard)
  const allWineFeatureEvents = eventBreakdown.filter(event => event.type === 'wine_feature');

  const companyWineFeatureEvents = allWineFeatureEvents.filter(event => {
    const metadata: any = event.metadata ?? {};
    return metadata.level === 'company';
  });
  const vineyardWineFeatureEvents = allWineFeatureEvents.filter(event => {
    const metadata: any = event.metadata ?? {};
    return metadata.level === 'vineyard';
  });

  // Consolidate wine feature events by wine/vineyard
  const consolidatedCompanyWineFeatures = consolidateWineFeatureEvents(companyWineFeatureEvents);
  const consolidatedVineyardWineFeatures = consolidateWineFeatureEvents(vineyardWineFeatureEvents);

  // Group other company events by type (including research achievements)
  const otherCompanyEvents = eventBreakdown.filter(event => ['company_finance', 'company_story', 'sale', 'contract', 'penalty', 'cellar_collection', 'achievement'].includes(event.type));
  const groupedCompanyEvents = otherCompanyEvents.reduce((acc, event) => {
    if (!acc[event.type]) acc[event.type] = [];
    acc[event.type].push(event);
    return acc;
  }, {} as Record<string, PrestigeEvent[]>);

  // Auto-collapse sections with many items only once on initial render
  React.useEffect(() => {
    if (didInitAutoCollapse.current) return;

    const initialCollapsed = new Set<string>();

    // Auto-collapse all wines summary if it has more than 3 wines
    if (shouldAutoCollapse(consolidatedCompanyWineFeatures)) {
      initialCollapsed.add('all_wines_summary');
    }

    // Auto-collapse company event sections with more than 3 items
    Object.entries(groupedCompanyEvents).forEach(([type, events]) => {
      const sectionId = `company_${type}`;
      if (shouldAutoCollapse(events)) {
        initialCollapsed.add(sectionId);
      }
    });

    // Always start the Achievements section collapsed by default
    initialCollapsed.add('company_achievement');

    // Auto-collapse all vineyards summary if it has more than 3 vineyards
    if (shouldAutoCollapse(vineyards)) {
      initialCollapsed.add('all_vineyards_summary');
    }

    // Auto-collapse vineyard sections with more than 3 items
    vineyards.forEach((vineyard) => {
      const sectionId = `vineyard_${vineyard.id}`;
      if (shouldAutoCollapse(vineyard.events)) {
        initialCollapsed.add(sectionId);
      }
    });

    // Auto-collapse vineyard wine features sections with more than 3 items
    vineyards.forEach((vineyard) => {
      const vineyardWineFeatures = consolidatedVineyardWineFeatures.filter(
        wine => wine.vineyardId === vineyard.id || wine.vineyardName === vineyard.name
      );
      if (shouldAutoCollapse(vineyardWineFeatures)) {
        initialCollapsed.add(`vineyard_wine_features_${vineyard.id}`);
      }
    });

    // Start with legend collapsed by default
    initialCollapsed.add('prestige_legend');

    if (initialCollapsed.size > 0) {
      setCollapsedSections(initialCollapsed);
    }
    didInitAutoCollapse.current = true;
  }, [groupedCompanyEvents, vineyards, consolidatedCompanyWineFeatures, consolidatedVineyardWineFeatures]);

  // Render
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto scrollbar-styled">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Company Prestige Breakdown
          </DialogTitle>
          <DialogDescription>
            View detailed breakdown of your company's prestige from various sources including sales, vineyards, and company value.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Total Prestige Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Total Prestige</span>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  <Star className="h-4 w-4 mr-1" />
                  {formatAmount(totalPrestige)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your company's total prestige is calculated from various sources.
                  Some prestige sources decay over time, while others remain constant.
                </p>

                {/* Company vs Vineyard Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Company Prestige</span>
                    </div>
                    <p className="text-lg font-bold text-blue-900 mt-1">
                      {formatAmount(companyPrestige)}
                    </p>
                  </div>

                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Grape className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Vineyard Prestige</span>
                    </div>
                    <p className="text-lg font-bold text-green-900 mt-1">
                      {formatAmount(vineyardPrestige)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Prestige Sources */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Company Prestige Sources
            </h3>

            {/* Wine Features Section */}
            {consolidatedCompanyWineFeatures.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Star className="h-5 w-5 text-purple-600" />
                  Wine Features (Company Level)
                </h3>

                {getFilteredWines().length === 0 ? (
                  <Card>
                    <CardContent className="py-6 text-center text-muted-foreground">
                      No wine features found.
                    </CardContent>
                  </Card>
                ) : selectedWine === 'all' ? (
                  // Summary view for "All Wines"
                  <Card>
                    <CardHeader>
                      <div className="space-y-3">
                        <CardTitle
                          className="flex items-center gap-2 text-base cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded transition-colors"
                          onClick={() => toggleSection('all_wines_summary')}
                        >
                          <Star className="h-4 w-4 text-purple-600" />
                          All Wines Summary
                          <Badge className="bg-purple-100 text-purple-800">
                            {consolidatedCompanyWineFeatures.length} {consolidatedCompanyWineFeatures.length === 1 ? 'wine' : 'wines'}
                          </Badge>
                          {consolidatedCompanyWineFeatures.length > 1 && (
                            <>
                              {isSectionCollapsed('all_wines_summary') ? (
                                <ChevronRight className="h-4 w-4 ml-auto" />
                              ) : (
                                <ChevronDown className="h-4 w-4 ml-auto" />
                              )}
                            </>
                          )}
                        </CardTitle>

                        {/* Wine Filter Tabs */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setSelectedWine('all')}
                            className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${selectedWine === 'all'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                          >
                            All Wines
                          </button>
                          {consolidatedCompanyWineFeatures
                            .sort((a, b) => `${a.vineyardName} - ${a.grape} (${a.vintage})`.localeCompare(`${b.vineyardName} - ${b.grape} (${b.vintage})`))
                            .map((wine) => (
                              <button
                                key={`${wine.vineyardName}_${wine.grape}_${wine.vintage}`}
                                onClick={() => setSelectedWine(`${wine.vineyardName}_${wine.grape}_${wine.vintage}`)}
                                className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${selectedWine === `${wine.vineyardName}_${wine.grape}_${wine.vintage}`
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                              >
                                {wine.vineyardName} - {wine.grape} ({wine.vintage})
                              </button>
                            ))}
                        </div>
                      </div>
                    </CardHeader>
                    {!isSectionCollapsed('all_wines_summary') && (
                      <CardContent>
                        <div className="space-y-2">
                          {consolidatedCompanyWineFeatures
                            .sort((a, b) => `${a.vineyardName} - ${a.grape} (${a.vintage})`.localeCompare(`${b.vineyardName} - ${b.grape} (${b.vintage})`))
                            .map((wine) => (
                              <div key={`${wine.vineyardId}_${wine.grape}_${wine.vintage}`} className="flex items-center justify-between py-2 px-3 bg-purple-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Star className="h-4 w-4 text-purple-600" />
                                  <span className="font-medium text-purple-800">{wine.vineyardName} - {wine.grape} ({wine.vintage})</span>
                                  <UnifiedTooltip
                                    content={
                                      <div className={tooltipStyles.text}>
                                        <TooltipSection title="Feature Events">
                                          <div className="space-y-1">
                                            {groupEventsByTypeAndFeature(
                                              wine.features.flatMap(f => f.recentEvents)
                                            ).map((group, idx) => (
                                              <div key={idx} className="flex justify-between">
                                                <span className="capitalize">{group.type}</span>
                                                <span className="font-mono">×{group.count}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </TooltipSection>
                                      </div>
                                    }
                                    title="Feature Events"
                                    className="max-w-sm"
                                    variant="panel"
                                    density="compact"
                                    triggerClassName="inline-block"
                                    showMobileHint
                                    mobileHintVariant="corner-dot"
                                  >
                                    <Badge variant="outline" className="text-xs cursor-help">
                                      {wine.features.length} {wine.features.length === 1 ? 'feature' : 'features'}
                                    </Badge>
                                  </UnifiedTooltip>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-purple-900">
                                    {formatAmount(wine.totalAmount)} prestige
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ) : (
                  // Detailed view for selected wine
                  <Card>
                    <CardHeader>
                      <div className="space-y-3">
                        <CardTitle
                          className="flex items-center gap-2 text-base cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded transition-colors"
                          onClick={() => toggleSection(`wine_${selectedWine}`)}
                        >
                          <Star className="h-4 w-4 text-purple-600" />
                          {(() => {
                            const wine = consolidatedCompanyWineFeatures.find(w =>
                              `${w.vineyardName}_${w.grape}_${w.vintage}` === selectedWine
                            );
                            return wine ? `${wine.vineyardName} - ${wine.grape} (${wine.vintage})` : 'Selected Wine';
                          })()}
                          <Badge className="bg-purple-100 text-purple-800">
                            {(() => {
                              const wine = consolidatedCompanyWineFeatures.find(w =>
                                `${w.vineyardName}_${w.grape}_${w.vintage}` === selectedWine
                              );
                              return wine ? `${wine.features.length} ${wine.features.length === 1 ? 'feature' : 'features'}` : '0 features';
                            })()}
                          </Badge>
                          {(() => {
                            const wine = consolidatedCompanyWineFeatures.find(w =>
                              `${w.vineyardName}_${w.grape}_${w.vintage}` === selectedWine
                            );
                            return wine && wine.features.length > 1;
                          })() && (
                              <>
                                {isSectionCollapsed(`wine_${selectedWine}`) ? (
                                  <ChevronRight className="h-4 w-4 ml-auto" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 ml-auto" />
                                )}
                              </>
                            )}
                        </CardTitle>

                        {/* Wine Filter Tabs */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setSelectedWine('all')}
                            className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${selectedWine === 'all'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                          >
                            All Wines
                          </button>
                          {consolidatedCompanyWineFeatures
                            .sort((a, b) => `${a.vineyardName} - ${a.grape} (${a.vintage})`.localeCompare(`${b.vineyardName} - ${b.grape} (${b.vintage})`))
                            .map((wine) => (
                              <button
                                key={`${wine.vineyardName}_${wine.grape}_${wine.vintage}`}
                                onClick={() => setSelectedWine(`${wine.vineyardName}_${wine.grape}_${wine.vintage}`)}
                                className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${selectedWine === `${wine.vineyardName}_${wine.grape}_${wine.vintage}`
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                              >
                                {wine.vineyardName} - {wine.grape} ({wine.vintage})
                              </button>
                            ))}
                        </div>
                      </div>
                    </CardHeader>
                    {!isSectionCollapsed(`wine_${selectedWine}`) && (
                      <CardContent className="space-y-3">
                        {getFilteredWines().map((consolidatedEvent, index) => (
                          <div key={`${consolidatedEvent.vineyardId}_${consolidatedEvent.grape}_${consolidatedEvent.vintage}`}>
                            <ConsolidatedWineFeatureDisplay consolidatedEvent={consolidatedEvent} />
                            {index < getFilteredWines().length - 1 && <Separator className="mt-3" />}
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                )}
              </div>
            )}

            {/* Other Company Events */}
            {Object.keys(groupedCompanyEvents).length === 0 ? (
              consolidatedCompanyWineFeatures.length === 0 && (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground">
                    No company prestige events found.
                  </CardContent>
                </Card>
              )
            ) : (
              Object.entries(groupedCompanyEvents).map(([type, events]) => {
                const sectionId = `company_${type}`;
                const isCollapsed = isSectionCollapsed(sectionId);

                return (
                  <Card key={type}>
                    <CardHeader>
                      <CardTitle
                        className="flex items-center gap-2 text-base cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded transition-colors"
                        onClick={() => toggleSection(sectionId)}
                      >
                        {(() => {
                          const config = getEventConfig(type);
                          const IconComponent = config.icon;
                          return <IconComponent className="h-4 w-4" />;
                        })()}
                        {getEventConfig(type).label}
                        <Badge className={getEventConfig(type).color}>
                          {events.length} {events.length === 1 ? 'source' : 'sources'}
                        </Badge>
                        {events.length > 1 && (
                          <>
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 ml-auto" />
                            ) : (
                              <ChevronDown className="h-4 w-4 ml-auto" />
                            )}
                          </>
                        )}
                      </CardTitle>
                    </CardHeader>
                    {!isCollapsed && (
                      <CardContent className="space-y-3">
                        {type === 'achievement' ? (
                          // Group achievements by category
                          (() => {
                            const achievementsByCategory = events.reduce((acc, event) => {
                              const categoryKey = getAchievementCategoryKey(event);
                              if (!acc[categoryKey]) acc[categoryKey] = [];
                              acc[categoryKey].push(event);
                              return acc;
                            }, {} as Record<string, PrestigeEvent[]>);

                            return Object.entries(achievementsByCategory).map(([categoryKey, categoryEvents], categoryIndex, allCategories) => (
                              <div key={categoryKey}>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                  {getAchievementCategoryLabel(categoryKey)}:
                                </h4>
                                <div className="ml-2 space-y-3">
                                  {categoryEvents.map((event, index) => (
                                    <div key={event.id}>
                                      <EventDisplay event={event} />
                                      {index < categoryEvents.length - 1 && <Separator className="mt-3" />}
                                    </div>
                                  ))}
                                </div>
                                {categoryIndex < allCategories.length - 1 && (
                                  <Separator className="mt-4 mb-4" />
                                )}
                              </div>
                            ));
                          })()
                        ) : (
                          // Regular event display for non-achievements
                          events.map((event, index) => (
                            <div key={event.id}>
                              <EventDisplay event={event} />
                              {index < events.length - 1 && <Separator className="mt-3" />}
                            </div>
                          ))
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </div>

          {/* Vineyard Prestige Sources */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Grape className="h-5 w-5 text-green-600" />
              Vineyard Prestige Sources
            </h3>

            {getFilteredVineyards().length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground">
                  No vineyard prestige events found.
                </CardContent>
              </Card>
            ) : selectedVineyard === 'all' ? (
              // Summary view for "All Vineyards"
              <Card>
                <CardHeader>
                  <div className="space-y-3">
                    <CardTitle
                      className="flex items-center gap-2 text-base cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded transition-colors"
                      onClick={() => toggleSection('all_vineyards_summary')}
                    >
                      <Grape className="h-4 w-4 text-green-600" />
                      All Vineyards Summary
                      <Badge className="bg-green-100 text-green-800">
                        {vineyards.length} {vineyards.length === 1 ? 'vineyard' : 'vineyards'}
                      </Badge>
                      {vineyards.length > 1 && (
                        <>
                          {isSectionCollapsed('all_vineyards_summary') ? (
                            <ChevronRight className="h-4 w-4 ml-auto" />
                          ) : (
                            <ChevronDown className="h-4 w-4 ml-auto" />
                          )}
                        </>
                      )}
                    </CardTitle>

                    {/* Vineyard Filter Tabs */}
                    {vineyards.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedVineyard('all')}
                          className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${selectedVineyard === 'all'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                          All Vineyards
                        </button>
                        {vineyards
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((vineyard) => (
                            <button
                              key={vineyard.id}
                              onClick={() => setSelectedVineyard(vineyard.id)}
                              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${selectedVineyard === vineyard.id
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                              {vineyard.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                {!isSectionCollapsed('all_vineyards_summary') && (
                  <CardContent>
                    <div className="space-y-2">
                      {vineyards.map((vineyard) => (
                        <div key={vineyard.id} className="flex items-center justify-between py-2 px-3 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Grape className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-green-800">{vineyard.name}</span>
                            <UnifiedTooltip
                              content={
                                <div className={tooltipStyles.text}>
                                  <TooltipSection title="Prestige Sources">
                                    <div className="space-y-1">
                                      {groupEventsByTypeAndFeature(vineyard.events).map((group, idx) => (
                                        <div key={idx} className="flex justify-between">
                                          <span className="capitalize">{group.type}</span>
                                          <span className="font-mono">×{group.count}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipSection>
                                </div>
                              }
                              title="Prestige Sources"
                              className="max-w-sm"
                              variant="panel"
                              density="compact"
                              triggerClassName="inline-block"
                              showMobileHint
                              mobileHintVariant="corner-dot"
                            >
                              <Badge variant="outline" className="text-xs cursor-help">
                                {vineyard.events.length} {vineyard.events.length === 1 ? 'source' : 'sources'}
                              </Badge>
                            </UnifiedTooltip>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-green-900">
                              {formatAmount(vineyard.prestige)} prestige
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ) : (
              // Detailed view for selected vineyard
              <Card>
                <CardHeader>
                  <div className="space-y-3">
                    <CardTitle
                      className="flex items-center gap-2 text-base cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded transition-colors"
                      onClick={() => toggleSection(`vineyard_${selectedVineyard}`)}
                    >
                      <Grape className="h-4 w-4 text-green-600" />
                      {(() => {
                        const vineyard = vineyards.find(v => v.id === selectedVineyard);
                        return vineyard ? vineyard.name : 'Selected Vineyard';
                      })()}
                      <Badge className="bg-green-100 text-green-800">
                        {(() => {
                          const vineyard = vineyards.find(v => v.id === selectedVineyard);
                          return vineyard ? `${vineyard.events.length} ${vineyard.events.length === 1 ? 'source' : 'sources'}` : '0 sources';
                        })()}
                      </Badge>
                      <Badge variant="outline" className="ml-auto">
                        {(() => {
                          const vineyard = vineyards.find(v => v.id === selectedVineyard);
                          return vineyard ? `${formatAmount(vineyard.prestige)} prestige` : '0 prestige';
                        })()}
                      </Badge>
                      {(() => {
                        const vineyard = vineyards.find(v => v.id === selectedVineyard);
                        return vineyard && vineyard.events.length > 1;
                      })() && (
                          <>
                            {isSectionCollapsed(`vineyard_${selectedVineyard}`) ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </>
                        )}
                    </CardTitle>

                    {/* Vineyard Filter Tabs */}
                    {vineyards.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedVineyard('all')}
                          className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${selectedVineyard === 'all'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                          All Vineyards
                        </button>
                        {vineyards
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((vineyard) => (
                            <button
                              key={vineyard.id}
                              onClick={() => setSelectedVineyard(vineyard.id)}
                              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${selectedVineyard === vineyard.id
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                              {vineyard.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                {!isSectionCollapsed(`vineyard_${selectedVineyard}`) && (
                  <CardContent className="space-y-3">
                    {getFilteredVineyards().map((vineyard) => {
                      // Get wine features for this vineyard
                      const vineyardWineFeatures = consolidatedVineyardWineFeatures.filter(
                        wine => wine.vineyardId === vineyard.id || wine.vineyardName === vineyard.name
                      );

                      return (
                        <div key={vineyard.id} className="space-y-3">
                          {/* Vineyard Wine Features */}
                          {vineyardWineFeatures.length > 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle
                                  className="flex items-center gap-2 text-base cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded transition-colors"
                                  onClick={() => toggleSection(`vineyard_wine_features_${vineyard.id}`)}
                                >
                                  <Star className="h-4 w-4 text-purple-600" />
                                  Wine Features - {vineyard.name}
                                  <Badge className="bg-purple-100 text-purple-800">
                                    {vineyardWineFeatures.length} {vineyardWineFeatures.length === 1 ? 'wine' : 'wines'}
                                  </Badge>
                                  {vineyardWineFeatures.length > 1 && (
                                    <>
                                      {isSectionCollapsed(`vineyard_wine_features_${vineyard.id}`) ? (
                                        <ChevronRight className="h-4 w-4 ml-auto" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 ml-auto" />
                                      )}
                                    </>
                                  )}
                                </CardTitle>
                              </CardHeader>
                              {!isSectionCollapsed(`vineyard_wine_features_${vineyard.id}`) && (
                                <CardContent className="space-y-3">
                                  {vineyardWineFeatures.map((consolidatedEvent, index) => (
                                    <div key={`${consolidatedEvent.vineyardId}_${consolidatedEvent.grape}_${consolidatedEvent.vintage}`}>
                                      <ConsolidatedWineFeatureDisplay consolidatedEvent={consolidatedEvent} />
                                      {index < vineyardWineFeatures.length - 1 && <Separator className="mt-3" />}
                                    </div>
                                  ))}
                                </CardContent>
                              )}
                            </Card>
                          )}

                          {/* Other Vineyard Events */}
                          <Card>
                            <CardHeader>
                              <CardTitle
                                className="flex items-center gap-2 text-base cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded transition-colors"
                                onClick={() => toggleSection(`vineyard_${vineyard.id}`)}
                              >
                                <Grape className="h-4 w-4 text-green-600" />
                                {vineyard.name}
                                <Badge className="bg-green-100 text-green-800">
                                  {vineyard.events.length} {vineyard.events.length === 1 ? 'source' : 'sources'}
                                </Badge>
                                <Badge variant="outline" className="ml-auto">
                                  {formatAmount(vineyard.prestige)} prestige
                                </Badge>
                                {vineyard.events.length > 1 && (
                                  <>
                                    {isSectionCollapsed(`vineyard_${vineyard.id}`) ? (
                                      <ChevronRight className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </>
                                )}
                              </CardTitle>
                            </CardHeader>
                            {!isSectionCollapsed(`vineyard_${vineyard.id}`) && (
                              <CardContent className="space-y-3">
                                {vineyard.events.map((event, index) => (
                                  <div key={event.id}>
                                    <EventDisplay event={event} />
                                    {index < vineyard.events.length - 1 && <Separator className="mt-3" />}
                                  </div>
                                ))}
                              </CardContent>
                            )}
                          </Card>
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            )}
          </div>

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle
                className="text-base cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded transition-colors"
                onClick={() => toggleSection('prestige_legend')}
              >
                How Prestige Works
                {isSectionCollapsed('prestige_legend') ? (
                  <ChevronRight className="h-4 w-4 ml-auto" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-auto" />
                )}
              </CardTitle>
            </CardHeader>
            {!isSectionCollapsed('prestige_legend') && (
              <CardContent className="space-y-3 text-sm">
                {/* Company Prestige Sources */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Company Prestige Sources
                  </h4>
                  <div className="ml-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Company Value:</strong> Based on company value (total assets - total liabilities) vs. max land value. Uses logarithmic scaling for natural diminishing returns.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Sales:</strong> Temporary prestige from wine sales. Decays at 5% weekly (95% retention rate).
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Wine Features (Company):</strong> Prestige from wine features at company level. Can be positive (terroir, bottle aging) or negative (oxidation, stuck fermentation).
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Cellar Collection:</strong> Prestige from aged wines (5+ years) in your cellar. Permanent source.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Achievements:</strong> Special milestone rewards. Decay rates vary by achievement type.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vineyard Prestige Sources */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-green-700 flex items-center gap-2">
                    <Grape className="h-4 w-4" />
                    Vineyard Prestige Sources
                  </h4>
                  <div className="ml-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Land Value:</strong> Permanent prestige based on vineyard land value per hectare, adjusted for grape suitability and density.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Vine Age:</strong> Permanent prestige from vine maturity, enhanced by grape suitability and density modifiers.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Wine Features (Vineyard):</strong> Prestige from wine features at vineyard level. Same features as company level but calculated separately.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Vineyard Sales:</strong> Temporary prestige from sales of wines from this specific vineyard. Decays at 5% weekly.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Vineyard Achievements:</strong> Milestone rewards specific to vineyard activities (planting, aging, improvement, harvest).
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Mechanics */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Key Mechanics
                  </h4>
                  <div className="ml-4 space-y-1 text-xs text-muted-foreground">
                    <div>• <strong>Density Modifier:</strong> Lower vine density (1500 vines/ha) = higher prestige (1.5×), higher density (10000 vines/ha) = lower prestige (0.5×)</div>
                    <div>• <strong>Grape Suitability:</strong> Regional grape suitability multiplies both land and age prestige</div>
                    <div>• <strong>Decay Rates:</strong> Sales decay at 5% weekly (95% retention), some features decay at 2% weekly (98% retention)</div>
                    <div>• <strong>Permanent Sources:</strong> Company value, vineyard land/age, cellar collection, and achievements don't decay</div>
                    <div>• <strong>Wine Features:</strong> Can be positive (terroir, bottle aging) or negative (oxidation, stuck fermentation) prestige</div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrestigeModal;
