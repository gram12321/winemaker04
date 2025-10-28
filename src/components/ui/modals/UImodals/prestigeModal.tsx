import React, { useState, useRef } from 'react';
import { PrestigeEvent } from '@/lib/types/types';
import { formatNumber, getRatingForRange, getColorClassForRange } from '@/lib/utils';
import { getEventDisplayData, consolidateWineFeatureEvents, ConsolidatedWineFeatureEvent } from '@/lib/services';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../shadCN/dialog';
import { Badge } from '../../shadCN/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../shadCN/card';
import { Separator } from '../../shadCN/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, TooltipSection, TooltipRow, TooltipHeader, tooltipStyles } from '../../shadCN/tooltip';
import { Star, TrendingUp, Grape, DollarSign, ChevronDown, ChevronRight } from 'lucide-react';
import { DialogProps } from '@/lib/types/UItypes';

/**
 * Prestige Modal
 * Modal for displaying detailed prestige breakdown and sources
 */
interface PrestigeModalProps extends DialogProps {
  totalPrestige: number;
  eventBreakdown: PrestigeEvent[];
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
  eventBreakdown,
  companyPrestige = 0,
  vineyardPrestige = 0,
  vineyards = []
}) => {
  // State initialization
  const [selectedVineyard, setSelectedVineyard] = useState<string>('all');
  const [selectedWine, setSelectedWine] = useState<string>('all');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const didInitAutoCollapse = useRef(false);

  const eventConfig = {
    company_finance: { icon: DollarSign, label: 'Company Finance', color: 'bg-blue-100 text-blue-800' },
    vineyard: { icon: Grape, label: 'Vineyard (Legacy)', color: 'bg-green-100 text-green-800' },
    sale: { icon: TrendingUp, label: 'Company Sales', color: 'bg-emerald-100 text-emerald-800' },
    cellar_collection: { icon: TrendingUp, label: 'Cellar Collection', color: 'bg-amber-100 text-amber-800' },
    achievement: { icon: Star, label: 'Achievements', color: 'bg-yellow-100 text-yellow-800' },
    vineyard_sale: { icon: Grape, label: 'Vineyard Sales', color: 'bg-green-100 text-green-800' },
    vineyard_base: { icon: Grape, label: 'Vineyard Base', color: 'bg-blue-100 text-blue-800' },
    vineyard_achievement: { icon: Star, label: 'Vineyard Achievements', color: 'bg-yellow-100 text-yellow-800' },
    vineyard_age: { icon: Star, label: 'Vine Age', color: 'bg-orange-100 text-orange-800' },
    vineyard_land: { icon: DollarSign, label: 'Land Value', color: 'bg-green-100 text-green-800' },
    wine_feature: { icon: Star, label: 'Wine Features', color: 'bg-purple-100 text-purple-800' },
    contract: { icon: DollarSign, label: 'Contracts', color: 'bg-purple-100 text-purple-800' },
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

  const formatAmount = (amount: number) => formatNumber(amount, { decimals: 2, forceDecimals: true });

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

  const EventDisplay = ({ event }: { event: PrestigeEvent }) => {
    const displayData = getEventDisplayData(event);
    const isAchievement = event.type === 'achievement' || event.type === 'vineyard_achievement';

    // Custom tooltip component for calculations using structured data
    const CalculationTooltip = ({ children, calculationData }: { children: React.ReactNode; calculationData: any }) => {
      const renderCalculationData = () => {
        if (!calculationData) return null;

        switch (calculationData.type) {
          case 'company_value':
            return (
              <div className="space-y-2">
                <TooltipRow 
                  label="Company Value:" 
                  value={`€${formatNumber(calculationData.companyValue, { smartDecimals: true })}`}
                  valueRating={getRatingForRange(calculationData.companyValue / 1000000, 0, 1000, 'exponential')}
                />
                <TooltipRow 
                  label="Company Scaling Value:" 
                  value={`€${formatNumber(calculationData.maxLandValue, { smartDecimals: true })}`}
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
                  label="Land Value per Hectare:" 
                  value={`€${formatNumber(calculationData.landValuePerHa, { smartDecimals: true })}/ha`}
                  valueRating={getRatingForRange(calculationData.landValuePerHa, 0, 100000, 'higher_better')}
                />
                <TooltipRow 
                  label="Total Hectares:" 
                  value={`${formatNumber(calculationData.hectares, { smartDecimals: true })} ha`}
                  valueRating={getRatingForRange(calculationData.hectares, 0, 50, 'higher_better')}
                />
                <TooltipRow 
                  label="Vine Density:" 
                  value={`${formatNumber(calculationData.density, { smartDecimals: true })} vines/ha`}
                  valueRating={getRatingForRange(calculationData.density, 1500, 15000, 'lower_better')}
                />
                <TooltipRow 
                  label="Density Modifier:" 
                  value={`×${formatNumber(calculationData.densityModifier, { smartDecimals: true })}`}
                  valueRating={getRatingForRange(calculationData.densityModifier, 0, 1, 'higher_better')}
                />
                <TooltipRow 
                  label="Suitability Factor:" 
                  value={formatNumber(calculationData.suitability, { smartDecimals: true })}
                  valueRating={getRatingForRange(calculationData.suitability, 0, 1, 'higher_better')}
                />
                <TooltipRow 
                  label="Size Factor:" 
                  value={formatNumber(calculationData.sizeFactor, { smartDecimals: true })}
                  valueRating={getRatingForRange(calculationData.sizeFactor, 0, 1, 'higher_better')}
                />
                <TooltipRow 
                  label="Final Prestige:" 
                  value={formatNumber(calculationData.finalPrestige, { smartDecimals: true })}
                  valueRating={getRatingForRange(calculationData.finalPrestige, 0, 10, 'higher_better')}
                />
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
              </div>
            );

          default:
            return null;
        }
      };

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {children}
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm" variant="panel" density="compact" scrollable maxHeight="max-h-60">
              <div className={tooltipStyles.text}>
                <TooltipSection title="Calculation Breakdown">
                  {renderCalculationData()}
                </TooltipSection>
                <div className="mt-2 border-t border-gray-600 pt-2 whitespace-pre-line text-gray-300">
                  {`Formula:\n- Company value is log-normalized against Company Scaling Value`}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    };

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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`${tooltipStyles.text} text-muted-foreground cursor-help`}>(details)</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm" variant="panel" density="compact" scrollable maxHeight="max-h-60">
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
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className={`${tooltipStyles.text} text-muted-foreground`}>{formatDecayRate(event.decayRate)}</p>
        </div>
        <div className="text-right">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className={`text-sm ${tooltipStyles.subtitle} cursor-help ${getColorClassForRange(event.currentAmount ?? event.amount, 0, 10, 'higher_better')}`}>{formatAmount(event.currentAmount ?? event.amount)}</p>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm" variant="panel" density="compact" scrollable maxHeight="max-h-60">
                {(() => {
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
                          // Less decay is better → use retention rate as rating (higher = better)
                          valueRating={event.decayRate === 0 ? getRatingForRange(1, 0, 1, 'higher_better') : getRatingForRange(event.decayRate, 0, 1, 'higher_better')}
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
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-[10px] cursor-help">
                        {feature.eventCount} {feature.eventCount === 1 ? 'event' : 'events'}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm" variant="panel" density="compact" scrollable maxHeight="max-h-60">
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
                                      Sale: €{formatNumber(saleValue, { smartDecimals: true })} ({saleVolume} bottles)
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
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
  
  // Group other company events by type
  const otherCompanyEvents = eventBreakdown.filter(event => ['company_finance', 'sale', 'contract', 'penalty', 'cellar_collection', 'achievement'].includes(event.type));
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
                            className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${
                              selectedWine === 'all'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            All Wines
                          </button>
                          {consolidatedCompanyWineFeatures.map((wine) => (
                            <button
                              key={`${wine.vineyardName}_${wine.grape}_${wine.vintage}`}
                              onClick={() => setSelectedWine(`${wine.vineyardName}_${wine.grape}_${wine.vintage}`)}
                              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${
                                selectedWine === `${wine.vineyardName}_${wine.grape}_${wine.vintage}`
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
                          {consolidatedCompanyWineFeatures.map((wine) => (
                            <div key={`${wine.vineyardId}_${wine.grape}_${wine.vintage}`} className="flex items-center justify-between py-2 px-3 bg-purple-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-purple-600" />
                                <span className="font-medium text-purple-800">{wine.vineyardName} - {wine.grape} ({wine.vintage})</span>
                                <Badge variant="outline" className="text-xs">
                                  {wine.features.length} {wine.features.length === 1 ? 'feature' : 'features'}
                                </Badge>
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
                            className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${
                              selectedWine === 'all'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            All Wines
                          </button>
                          {consolidatedCompanyWineFeatures.map((wine) => (
                            <button
                              key={`${wine.vineyardName}_${wine.grape}_${wine.vintage}`}
                              onClick={() => setSelectedWine(`${wine.vineyardName}_${wine.grape}_${wine.vintage}`)}
                              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${
                                selectedWine === `${wine.vineyardName}_${wine.grape}_${wine.vintage}`
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
                              const metadata: any = event.metadata ?? {};
                              const category = metadata.achievementCategory || 'other';
                              if (!acc[category]) acc[category] = [];
                              acc[category].push(event);
                              return acc;
                            }, {} as Record<string, PrestigeEvent[]>);

                            return Object.entries(achievementsByCategory).map(([category, categoryEvents]) => (
                              <div key={category}>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2 capitalize">
                                  {category} achievements:
                                </h4>
                                <div className="ml-2 space-y-3">
                                  {categoryEvents.map((event, index) => (
                                    <div key={event.id}>
                                      <EventDisplay event={event} />
                                      {index < categoryEvents.length - 1 && <Separator className="mt-3" />}
                                    </div>
                                  ))}
                                </div>
                                {Object.keys(achievementsByCategory).indexOf(category) < Object.keys(achievementsByCategory).length - 1 && (
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
                          className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${
                            selectedVineyard === 'all'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          All Vineyards
                        </button>
                        {vineyards.map((vineyard) => (
                          <button
                            key={vineyard.id}
                            onClick={() => setSelectedVineyard(vineyard.id)}
                            className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${
                              selectedVineyard === vineyard.id
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
                            <Badge variant="outline" className="text-xs">
                              {vineyard.events.length} {vineyard.events.length === 1 ? 'source' : 'sources'}
                            </Badge>
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
                          className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${
                            selectedVineyard === 'all'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          All Vineyards
                        </button>
                        {vineyards.map((vineyard) => (
                          <button
                            key={vineyard.id}
                            onClick={() => setSelectedVineyard(vineyard.id)}
                            className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium ${
                              selectedVineyard === vineyard.id
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
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  <span><strong>Company Value:</strong> Log-normalized by max land value; provides natural diminishing returns without additional scaling.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Grape className="h-4 w-4 text-green-500" />
                  <span><strong>Vineyard (Base):</strong> Two permanent sources per vineyard — Land Value and Vine Age.</span>
                </div>
                <div className="ml-6 text-xs text-muted-foreground space-y-1">
                  <div>• Land Value: log(totalValue/max + 1) → × suitability → asym(0–1) − 1</div>
                  <div>• Vine Age: ageModifier(0–1) → × suitability → asym(0–1) − 1</div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span><strong>Sales:</strong> Add temporary prestige that decays weekly (e.g., 5%).</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span><strong>Achievements:</strong> Special events; amounts and decay may vary.</span>
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
