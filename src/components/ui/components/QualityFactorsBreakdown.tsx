import React, { useState, useEffect } from 'react';
import { Vineyard, WineBatch } from '@/lib/types/types';
import { QualityFactorsDisplay } from './qualityFactorBar';
import { getVineyardQualityFactors, getMaxLandValue } from '@/lib/services/wine/winescore/wineQualityCalculationService';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';
import { FactorCard } from '@/components/ui/shadCN/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/shadCN/tooltip';
import { formatNumber, ChevronDownIcon, ChevronRightIcon } from '@/lib/utils';
import { getWineQualityCategory, getColorCategory, getBadgeColorClasses } from '@/lib/utils/utils';
import { getVineyardPrestigeBreakdown, getRegionalPriceRange } from '@/lib/services';
import { getEventDisplayData, BoundedVineyardPrestigeFactor } from '@/lib/services/prestige/prestigeService';
import { getAllFeatureConfigs } from '@/lib/constants/wineFeatures/commonFeaturesUtil';
import { calculateEffectiveQuality } from '@/lib/services/wine/features/featureEffectsService';

interface QualityFactorsBreakdownProps {
  vineyard?: Vineyard;
  wineBatch?: WineBatch;
  className?: string;
  showFactorDetails?: boolean;
}

export const QualityFactorsBreakdown: React.FC<QualityFactorsBreakdownProps> = ({
  vineyard,
  wineBatch,
  className = "",
  showFactorDetails = true
}) => {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [prestigeBreakdown, setPrestigeBreakdown] = useState<any>(null);
  const [wineBatchVineyard, setWineBatchVineyard] = useState<Vineyard | null>(null);

  // Load prestige breakdown data
  useEffect(() => {
    const targetVineyard = vineyard || wineBatchVineyard;
    if (targetVineyard && showFactorDetails) {
      getVineyardPrestigeBreakdown().then((breakdown) => {
        setPrestigeBreakdown(breakdown);
      }).catch((error) => {
        console.error('Failed to load prestige breakdown:', error);
      });
    }
  }, [vineyard, wineBatchVineyard, showFactorDetails]);

  // Load vineyard data for wine batches
  useEffect(() => {
    if (wineBatch && !vineyard) {
      loadVineyards().then((vineyards) => {
        const foundVineyard = vineyards.find(v => v.id === wineBatch.vineyardId);
        setWineBatchVineyard(foundVineyard || null);
      }).catch((error) => {
        console.error('Failed to load vineyard for wine batch:', error);
      });
    }
  }, [wineBatch, vineyard]);

  // Get quality factors from centralized calculation
  const getQualityFactors = () => {
    if (vineyard) {
      return getVineyardQualityFactors(vineyard);
    } else if (wineBatch && wineBatchVineyard) {
      // For wine batches, use the looked-up vineyard data
      return getVineyardQualityFactors(wineBatchVineyard);
    } else if (wineBatch) {
      // Wine batch without vineyard data - fail hard
      throw new Error(`Vineyard data not found for wine batch ${wineBatch.id}. Cannot calculate quality factors.`);
    }
    
    // No vineyard or wine batch provided - fail hard
    throw new Error('No vineyard or wine batch provided. Cannot calculate quality factors.');
  };

  // Get quality factors with error handling
  let factors: any, rawValues: any, qualityScore: number, qualityCategory: string;
  
  try {
    const qualityData = getQualityFactors();
    factors = qualityData.factors;
    rawValues = qualityData.rawValues;

    // Use the service-provided bounded prestige and quality so UI matches actual calculation
    qualityScore = Math.max(0, Math.min(1, qualityData.qualityScore));
    qualityCategory = getWineQualityCategory(qualityScore);
  } catch (error) {
    // Display error state
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <span className="text-red-600">⚠️</span>
            <div>
              <h3 className="font-medium">Quality Analysis Unavailable</h3>
              <p className="text-sm text-red-600 mt-1">
                {error instanceof Error ? error.message : 'Unable to calculate quality factors.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
        {/* Quality Score Overview */}
        <div className="p-3 bg-white rounded border border-blue-300">
          <div className="text-sm">
            <div className="flex justify-between mb-1">
              <span>Wine Quality Score:</span>
              <span className="font-mono">
                {formatNumber(qualityScore, { decimals: 2, forceDecimals: true })}
              </span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Quality Category:</span>
              <span className="font-medium">{qualityCategory}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Weighted Calculation:</span>
              <span className="font-mono">
                (({formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}×0.6) + ({formatNumber(factors.vineyardPrestige, { decimals: 2, forceDecimals: true })}×0.4)) × {formatNumber(factors.overgrowthPenalty, { decimals: 2, forceDecimals: true })} = {formatNumber(qualityScore, { decimals: 2, forceDecimals: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Quality Factors Display */}
        <QualityFactorsDisplay
          factors={factors}
          vineyard={vineyard}
          showValues={true}
          rawValues={rawValues}
          showQualityScore={false}
          title="Quality Factors"
          className="bg-white rounded border"
        />

        {/* Feature Impacts Section */}
        {wineBatch && (
          <FeatureImpactsSection 
            wineBatch={wineBatch}
            baseQuality={qualityScore}
          />
        )}

        {/* Factor Details Section */}
        {showFactorDetails && (
          <div>
            <button
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              className="flex items-center gap-2 text-lg font-medium text-gray-800 hover:text-gray-900 transition-colors"
            >
              {detailsExpanded ? (
                <ChevronDownIcon className="w-5 h-5" />
              ) : (
                <ChevronRightIcon className="w-5 h-5" />
              )}
              Factor Details & Analysis
            </button>

            {detailsExpanded && (
              <div className="mt-4 space-y-4">
                {/* Individual Factor Cards */}
                {vineyard && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <FactorCard
                      title="Land Value Factor"
                      description={`€${formatNumber(vineyard.landValue || 0, { decimals: 0, forceDecimals: false })} per hectare - Calculated from: altitude (${vineyard.altitude}m) and aspect (${vineyard.aspect})`}
                      color="blue"
                    >
                      <div className="text-sm space-y-3">
                          {/* Your Calculation Section */}
                          <div className="bg-blue-100 p-3 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-blue-800">Your Calculation:</span>
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
                                      <p className="text-xs font-mono mb-2 text-gray-300">landValue = basePrice + altitudeAspectRate × (maxPrice - basePrice)</p>
                                      
                                      <p className="font-medium mb-1 text-blue-300">Raw Price Factor:</p>
                                      <p className="text-xs mb-1 text-gray-300">altitudeAspectRate = (altitude + aspect) ÷ 2</p>
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
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-blue-700">€{formatNumber(vineyard.landValue || 0, { decimals: 0, forceDecimals: false })} per hectare</span>
                                <span className="font-mono text-blue-800">→ {formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-blue-700">Weight in Index:</span>
                                <span className="font-mono text-blue-800">60%</span>
                              </div>
                              <div className="flex justify-between font-medium border-t border-blue-300 pt-2">
                                <span className="text-blue-800">Contribution:</span>
                                <span className="font-mono text-blue-900">{formatNumber(factors.landValue * 0.6, { decimals: 2, forceDecimals: true })}</span>
                              </div>
                            </div>
                            
                            {/* Land Value Calculation Breakdown */}
                            <div className="mt-3 pt-3 border-t border-blue-200">
                              <div className="text-xs space-y-2">
                                <div className="font-medium text-blue-800 mb-2">Land Value Calculation:</div>
                                
                                {/* Calculation blocks (updated to match modal flow) */}
                                <div className="bg-blue-50 p-2 rounded text-xs space-y-2">
                                  {/* Final Calculation first with tooltip showing the formula */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="font-mono text-blue-700 cursor-help">
                                          €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })} + {formatNumber((factors.altitudeRating + factors.aspectRating) / 2, { decimals: 2, forceDecimals: true })} × (€{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { decimals: 0, forceDecimals: false })} - €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })}) = €{formatNumber(vineyard.landValue || 0, { decimals: 0, forceDecimals: false })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="text-xs">Land value = Regional Baseprice + Regional modifier × (Regional Maxprice - Regional Baseprice)</div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Regional Modifier with tooltip breakdown */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="font-mono text-blue-800 font-medium cursor-help">
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
                                
                                {/* Regional Price Range */}
                                <div className="bg-blue-50 p-2 rounded text-xs">
                                  <div className="font-medium text-blue-700 mb-1">Regional Price Range ({vineyard.region}):</div>
                                  <div className="font-mono text-blue-600">
                                    €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })} - €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { decimals: 0, forceDecimals: false })} per hectare
                                  </div>
                                </div>
                                
                                {/* keep existing regional price box below */}
                              </div>
                            </div>
                            
                            {/* Normalization Calculation */}
                            <div className="mt-3 pt-3 border-t border-blue-200">
                              <div className="text-xs space-y-1">
                                <div className="font-medium text-blue-800 mb-2">Normalization to World Land Value:</div>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="font-mono text-blue-700 cursor-help">
                                        Scaling (€{formatNumber(vineyard.landValue || 0, { decimals: 0, forceDecimals: false })} / €{formatNumber(getMaxLandValue(), { decimals: 0, forceDecimals: false })}) = {formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-xs">Global Max: €{formatNumber(getMaxLandValue(), { decimals: 0, forceDecimals: false })}</div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          </div>
                        </div>
                    </FactorCard>

                    <FactorCard
                      title="Vineyard Prestige"
                      description="Combined prestige from vine age, environmental factors, and achievements"
                      color="purple"
                    >
                        <div className="text-sm space-y-3">
                          {/* Your Calculation Section */}
                          <div className="bg-purple-100 p-3 rounded-lg border border-purple-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-purple-800">Your Calculation:</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-purple-600 cursor-help">ℹ️</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="max-w-xs">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="font-medium text-sm">🌟 Vineyard Prestige Sources</p>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getBadgeColorClasses(factors.vineyardPrestige).bg} ${getBadgeColorClasses(factors.vineyardPrestige).text}`}>
                                          {getColorCategory(factors.vineyardPrestige)}
                                        </span>
                                      </div>
                                      <p className="text-xs mb-2 text-gray-300">Prestige accumulates from multiple sources with different decay rates.</p>
                                      <p className="font-medium mb-1 text-purple-300">Prestige Components:</p>
                                      <ul className="text-xs space-y-1 text-gray-300">
                                        <li>• <strong>Base Prestige:</strong> Permanent foundation (no decay)</li>
                                        <li>• <strong>Vine Age:</strong> Increases over time, permanent</li>
                                        <li>• <strong>Land Value:</strong> Based on property value, permanent</li>
                                        <li>• <strong>Regional Prestige:</strong> Location-based, permanent</li>
                                        <li>• <strong>Sales Events:</strong> Temporary boosts (95% weekly decay)</li>
                                        <li>• <strong>Achievements:</strong> Special accomplishments, permanent</li>
                                      </ul>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-purple-700">Prestige Score:</span>
                                <span className="font-mono text-purple-800">{formatNumber(factors.vineyardPrestige, { decimals: 2, forceDecimals: true })}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-purple-700">Weight in Index:</span>
                                <span className="font-mono text-purple-800">40%</span>
                              </div>
                              <div className="flex justify-between font-medium border-t border-purple-300 pt-2">
                                <span className="text-purple-800">Contribution:</span>
                                <span className="font-mono text-purple-900">{formatNumber(factors.vineyardPrestige * 0.4, { decimals: 2, forceDecimals: true })}</span>
                              </div>
                            </div>
                          </div>

                          {/* Vineyard Prestige Calculation Breakdown */}
                          {(vineyard || wineBatchVineyard) && (
                            <div className="mt-3 pt-3 border-t border-purple-200">
                              {(() => {
                                const tv = vineyard || (wineBatchVineyard as Vineyard);
                                const b = BoundedVineyardPrestigeFactor(tv);

                                return (
                                  <div className="text-xs space-y-2">
                                    <div className="font-medium text-purple-800 mb-2">Vineyard Prestige Calculation:</div>
                                    <div className="bg-purple-50 p-2 rounded font-mono">
                                      <div>ageScaled = asym(min(0.98, {formatNumber(b.ageWithSuitability01, { decimals: 3, forceDecimals: true })})) − 1 = {formatNumber(b.ageScaled, { decimals: 2, smartDecimals: true })}</div>
                                      <div>landPerHa = asym( squashed({formatNumber(b.landWithSuitability01, { decimals: 3, forceDecimals: true })}) ) − 1 = {formatNumber(b.landPerHa, { decimals: 2, smartDecimals: true })}</div>
                                      <div>size = sqrt(hectares) {b.sqrtHectares > Math.sqrt(5) ? `→ compressed(${formatNumber(b.sizeFactor, { decimals: 2, forceDecimals: true })})` : `= ${formatNumber(b.sizeFactor, { decimals: 2, forceDecimals: true })}`}</div>
                                      <div>landScaled = landPerHa × size = {formatNumber(b.landScaled, { decimals: 2, smartDecimals: true })}</div>
                                      <div>permanentRaw = ageScaled + landScaled = {formatNumber(b.permanentRaw, { decimals: 2, smartDecimals: true })}</div>
                                      <div>decayingComponent = max(0, currentPrestige − permanentRaw) = {formatNumber(b.decayingComponent, { decimals: 2, smartDecimals: true })}</div>
                                      <div>combinedRaw = permanentRaw + decaying = {formatNumber(b.combinedRaw, { decimals: 2, smartDecimals: true })}</div>
                                      <div>boundedFactor = min(combinedRaw ÷ 500, 0.99) = {formatNumber(b.boundedFactor, { decimals: 3, forceDecimals: true })}</div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Minimal Vineyard Prestige Events */}
                          {(prestigeBreakdown && (vineyard || wineBatchVineyard)) && (() => {
                            const targetVineyard = vineyard || wineBatchVineyard;
                            const vineyardData = targetVineyard ? prestigeBreakdown[targetVineyard.id] : null;
                            if (!vineyardData || !Array.isArray(vineyardData.events) || vineyardData.events.length === 0) {
                              return null;
                            }
                            return (
                              <div className="mt-2 space-y-1">
                                <div className="text-xs text-purple-700 font-medium">Vineyard Prestige</div>
                                <div className="rounded border border-purple-200 bg-purple-50/50">
                                  {vineyardData.events.map((event: any, idx: number) => {
                                    try {
                                      const titleBase = getEventDisplayData({
                                        id: event.id ?? `${idx}`,
                                        type: event.type,
                                        amount: event.amount,
                                        timestamp: Date.now(),
                                        decayRate: event.decayRate,
                                        description: event.description,
                                        sourceId: event.sourceId,
                                        originalAmount: event.originalAmount,
                                        currentAmount: event.currentAmount,
                                        metadata: event.metadata
                                      } as any).titleBase;
                                      return (
                                        <div key={idx} className={`px-2 py-0.5 text-xs text-purple-800 flex items-center justify-between ${idx !== vineyardData.events.length - 1 ? 'border-b border-purple-200' : ''}`}>
                                          <span className="truncate mr-2" title={event.description}>{titleBase}</span>
                                          <span className="font-mono">{formatNumber(event.currentAmount ?? event.amount, { decimals: 2, forceDecimals: true })}</span>
                                        </div>
                                      );
                                    } catch {
                                      const full = String(event.description ?? '');
                                      return (
                                        <div key={idx} className={`px-2 py-0.5 text-xs text-purple-800 flex items-center justify-between ${idx !== vineyardData.events.length - 1 ? 'border-b border-purple-200' : ''}`}>
                                          <span className="truncate mr-2" title={full}>{full}</span>
                                          <span className="font-mono">{formatNumber(event.currentAmount ?? event.amount, { decimals: 2, forceDecimals: true })}</span>
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                    </FactorCard>


                  </div>
                )}


              </div>
            )}
          </div>
        )}
      </div>
  );
};

// Feature Impacts Section Component
interface FeatureImpactsSectionProps {
  wineBatch: WineBatch;
  baseQuality: number;
}

function FeatureImpactsSection({ wineBatch, baseQuality }: FeatureImpactsSectionProps) {
  const effectiveQuality = calculateEffectiveQuality(wineBatch);
  const qualityDifference = effectiveQuality - baseQuality;
  const presentFeatures = (wineBatch.features || []).filter(f => f.isPresent);
  
  if (presentFeatures.length === 0) {
    return (
      <div className="p-3 bg-white rounded border border-gray-300">
        <div className="text-sm">
          <div className="flex justify-between mb-1">
            <span className="font-medium">Feature Impacts:</span>
            <span className="text-gray-500">None</span>
          </div>
          <div className="text-xs text-gray-500">No wine features currently affecting quality</div>
        </div>
      </div>
    );
  }
  
  const configs = getAllFeatureConfigs();
  
  return (
    <div className="p-3 bg-white rounded border border-purple-300">
      <div className="text-sm space-y-3">
        <div className="flex justify-between">
          <span className="font-medium">Feature Impacts:</span>
          <span className={`font-mono ${qualityDifference !== 0 ? (qualityDifference > 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'}`}>
            {qualityDifference !== 0 ? `${qualityDifference > 0 ? '+' : ''}${(qualityDifference * 100).toFixed(1)}%` : 'No impact'}
          </span>
        </div>
        
        <div className="flex justify-between text-lg font-bold">
          <span>Final Quality:</span>
          <span className="font-mono">
            {formatNumber(effectiveQuality, { decimals: 2, forceDecimals: true })}
            <span className="text-sm font-normal ml-2">({getWineQualityCategory(effectiveQuality)})</span>
          </span>
        </div>
        
        <div className="space-y-2">
          {presentFeatures.map(feature => {
            const config = configs.find(c => c.id === feature.id);
            if (!config) return null;
            
            const qualityEffect = config.effects.quality;
            let impactText = '';
            
            if (qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
              impactText = `${(qualityEffect.amount * feature.severity * 100).toFixed(1)}%`;
            } else if (qualityEffect.type === 'power') {
              const scaledPenalty = qualityEffect.basePenalty! * (1 + Math.pow(baseQuality, qualityEffect.exponent!));
              impactText = `-${(scaledPenalty * 100).toFixed(1)}%`;
            } else if (qualityEffect.type === 'bonus') {
              const bonusAmount = typeof qualityEffect.amount === 'function' 
                ? qualityEffect.amount(feature.severity)
                : qualityEffect.amount;
              if (bonusAmount !== undefined) {
                impactText = `+${(bonusAmount * 100).toFixed(1)}%`;
              }
            }
            
            const isBonus = qualityEffect.type === 'bonus';
            const colorClass = isBonus ? 'text-green-600' : 'text-red-600';
            
            return (
              <div key={config.id} className="flex justify-between text-xs">
                <span className="flex items-center gap-1">
                  <span>{config.icon}</span>
                  <span>{config.name}:</span>
                </span>
                <span className={`${colorClass} font-mono`}>{impactText}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
