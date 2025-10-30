import React, { useState, useEffect } from 'react';
import { Vineyard, WineBatch } from '@/lib/types/types';
import { GrapeQualityFactorsDisplay } from './grapeQualityBar';
import { getVineyardGrapeQualityFactors, getMaxLandValue } from '@/lib/services/wine/winescore/grapeQualityCalculation';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';
import { FactorCard } from '@/components/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, MobileDialogWrapper, TooltipSection, TooltipRow, tooltipStyles } from '@/components/ui/shadCN/tooltip';
import { formatNumber, formatPercent, ChevronDownIcon, ChevronRightIcon } from '@/lib/utils';
import { getGrapeQualityCategory, getColorCategory, getColorClass } from '@/lib/utils/utils';
import { getVineyardPrestigeBreakdown, getRegionalPriceRange } from '@/lib/services';
import { getEventDisplayData, BoundedVineyardPrestigeFactor } from '@/lib/services';
import { getAllFeatureConfigs } from '@/lib/constants/wineFeatures/commonFeaturesUtil';

interface GrapeQualityFactorsBreakdownProps {
  vineyard?: Vineyard;
  wineBatch?: WineBatch;
  className?: string;
  showFactorDetails?: boolean;
}

export const GrapeQualityFactorsBreakdown: React.FC<GrapeQualityFactorsBreakdownProps> = ({
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

  // Get grape quality factors from centralized calculation
  const getGrapeQualityFactors = () => {
    if (vineyard) {
      return getVineyardGrapeQualityFactors(vineyard);
    } else if (wineBatch && wineBatchVineyard) {

      return getVineyardGrapeQualityFactors(wineBatchVineyard);
    } else if (wineBatch) {

      throw new Error(`Vineyard data not found for wine batch ${wineBatch.id}. Cannot calculate grape quality factors.`);
    }
    
    // No vineyard or wine batch provided - fail hard
    throw new Error('No vineyard or wine batch provided. Cannot calculate grape quality factors.');
  };

  // Get grape quality factors with error handling
  let factors: any, rawValues: any, grapeQualityScore: number, grapeQualityCategory: string;
  
  try {
    const grapeQualityData = getGrapeQualityFactors();
    factors = grapeQualityData.factors;
    rawValues = grapeQualityData.rawValues;


    grapeQualityScore = Math.max(0, Math.min(1, grapeQualityData.grapeQualityScore));
    grapeQualityCategory = getGrapeQualityCategory(grapeQualityScore);
  } catch (error) {

    return (
      <div className={`space-y-4 ${className}`}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <span className="text-red-600">⚠️</span>
            <div>
              <h3 className="font-medium">Grape Quality Analysis Unavailable</h3>
              <p className="text-sm text-red-600 mt-1">
                {error instanceof Error ? error.message : 'Unable to calculate grape quality factors.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
        {/* Grape Quality Score Overview */}
        <div className="p-3 bg-white rounded border border-blue-300">
          <div className="text-sm">
            <div className="flex justify-between mb-1">
              <span>Grape Quality Score:</span>
              <span className={`font-mono ${getColorClass(grapeQualityScore)}`}>
                {formatNumber(grapeQualityScore, { decimals: 2, forceDecimals: true })}
              </span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Grape Quality Category:</span>
              <span className="font-medium">{grapeQualityCategory}</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <MobileDialogWrapper 
                    content={
                      <div className={tooltipStyles.text}>
                        <TooltipSection title="Weighted Calculation">
                          <TooltipRow 
                            label="Land Value:" 
                            value={`${formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })} × 0.6 = ${formatNumber(factors.landValue * 0.6, { decimals: 2, forceDecimals: true })}`}
                            valueRating={factors.landValue}
                            monospaced
                          />
                          <TooltipRow 
                            label="Vineyard Prestige:" 
                            value={`${formatNumber(factors.vineyardPrestige, { decimals: 2, forceDecimals: true })} × 0.4 = ${formatNumber(factors.vineyardPrestige * 0.4, { decimals: 2, forceDecimals: true })}`}
                            valueRating={factors.vineyardPrestige}
                            monospaced
                          />
                          <TooltipRow 
                            label="Weighted Sum:" 
                            value={formatNumber((factors.landValue * 0.6) + (factors.vineyardPrestige * 0.4), { decimals: 2, forceDecimals: true })}
                            valueRating={(factors.landValue * 0.6) + (factors.vineyardPrestige * 0.4)}
                            monospaced
                          />
                          <TooltipRow 
                            label="Overgrowth Penalty:" 
                            value={formatNumber(factors.overgrowthPenalty, { decimals: 2, forceDecimals: true })}
                            valueRating={factors.overgrowthPenalty}
                            monospaced
                          />
                          <div className="mt-2 pt-2 border-t border-gray-600">
                            <TooltipRow 
                              label="Final Score:" 
                              value={formatNumber(grapeQualityScore, { decimals: 2, forceDecimals: true })}
                              valueRating={grapeQualityScore}
                              monospaced
                            />
                          </div>
                        </TooltipSection>
                      </div>
                    } 
                    title="Weighted Calculation"
                    triggerClassName="flex justify-between text-lg font-bold cursor-help"
                  >
                  <div className="flex justify-between text-lg font-bold cursor-help">
                    <span>Grape Quality Score:</span>
                    <span className={`font-mono ${getColorClass(grapeQualityScore)}`}>
                      {formatNumber(grapeQualityScore, { decimals: 2, forceDecimals: true })}
                    </span>
                  </div>
                  </MobileDialogWrapper>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="max-w-xs" variant="panel" density="compact">
                  <div className={tooltipStyles.text}>
                    <TooltipSection title="Weighted Calculation">
                      <TooltipRow 
                        label="Land Value:" 
                        value={`${formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })} × 0.6 = ${formatNumber(factors.landValue * 0.6, { decimals: 2, forceDecimals: true })}`}
                        valueRating={factors.landValue}
                        monospaced
                      />
                      <TooltipRow 
                        label="Vineyard Prestige:" 
                        value={`${formatNumber(factors.vineyardPrestige, { decimals: 2, forceDecimals: true })} × 0.4 = ${formatNumber(factors.vineyardPrestige * 0.4, { decimals: 2, forceDecimals: true })}`}
                        valueRating={factors.vineyardPrestige}
                        monospaced
                      />
                      <TooltipRow 
                        label="Weighted Sum:" 
                        value={formatNumber((factors.landValue * 0.6) + (factors.vineyardPrestige * 0.4), { decimals: 2, forceDecimals: true })}
                        valueRating={(factors.landValue * 0.6) + (factors.vineyardPrestige * 0.4)}
                        monospaced
                      />
                      <TooltipRow 
                        label="Overgrowth Penalty:" 
                        value={formatNumber(factors.overgrowthPenalty, { decimals: 2, forceDecimals: true })}
                        valueRating={factors.overgrowthPenalty}
                        monospaced
                      />
                      <div className="mt-2 pt-2 border-t border-gray-600">
                        <TooltipRow 
                          label="Final Score:" 
                          value={formatNumber(grapeQualityScore, { decimals: 2, forceDecimals: true })}
                          valueRating={grapeQualityScore}
                          monospaced
                        />
                      </div>
                    </TooltipSection>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Grape Quality Factors Display */}
        <GrapeQualityFactorsDisplay
          factors={factors}
          vineyard={vineyard}
          showValues={true}
          rawValues={rawValues}
          showGrapeQualityScore={false}
          title="Grape Quality Factors"
          className="bg-white rounded border"
        />

        {/* Feature Impacts Section */}
        {wineBatch && (
          <FeatureImpactsSection 
            wineBatch={wineBatch}
            baseQuality={grapeQualityScore}
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
                      description={`${formatNumber(vineyard.landValue || 0, { currency: true })} per hectare - Calculated from: altitude (${vineyard.altitude}m) and aspect (${vineyard.aspect})`}
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
                                    <MobileDialogWrapper 
                                      content={
                                        <div className={tooltipStyles.text}>
                                          <TooltipSection title="💰 Land Value Calculation">
                                            <TooltipRow 
                                              label="Category:" 
                                              value={getColorCategory(factors.landValue)}
                                              badge
                                              valueRating={factors.landValue}
                                            />
                                            <div className="mt-2 pt-2 border-t border-gray-600">
                                              <div className="text-xs text-gray-300 mb-2">Your vineyard's land value is calculated dynamically based on multiple factors:</div>
                                              
                                              <div className="text-xs font-medium text-blue-300 mb-1">Calculation Formula:</div>
                                              <div className="text-xs font-mono mb-2 text-gray-300">landValue = basePrice + altitudeAspectRate × (maxPrice - basePrice)</div>
                                              
                                              <div className="text-xs font-medium text-blue-300 mb-1">Raw Price Factor:</div>
                                              <div className="text-xs mb-1 text-gray-300">altitudeAspectRate = (altitude + aspect) ÷ 2</div>
                                              <ul className="text-xs space-y-1 ml-2 text-gray-300">
                                                <li>• <strong>Altitude:</strong> {vineyard.altitude}m vs. optimal range</li>
                                                <li>• <strong>Aspect:</strong> {vineyard.aspect} sun exposure rating</li>
                                              </ul>
                                              
                                              <div className="text-xs font-medium mt-2 mb-1 text-green-300">Regional Scaling:</div>
                                              <div className="text-xs text-gray-300 mb-2">Perfect factors (altitudeAspectRate=1) reach the region's maximum price</div>
                                              
                                              <TooltipRow 
                                                label="Regional Price Range:" 
                                                value={`${formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { currency: true })} - ${formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { currency: true })} per hectare in ${vineyard.region}`}
                                              />
                                              
                                              <div className="text-xs font-medium mt-2 mb-1 text-purple-300">Global Normalization:</div>
                                              <div className="text-xs text-gray-300">Final value is normalized using asymmetrical scaling for the grape quality index calculation.</div>
                                            </div>
                                          </TooltipSection>
                                        </div>
                                      } 
                                      title="💰 Land Value Calculation"
                                      triggerClassName="text-blue-600 cursor-help"
                                    >
                                    <span className="text-blue-600 cursor-help">ℹ️</span>
                                    </MobileDialogWrapper>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={8} className="max-w-sm" variant="panel" density="compact">
                                    <div className={tooltipStyles.text}>
                                      <TooltipSection title="💰 Land Value Calculation">
                                        <TooltipRow 
                                          label="Category:" 
                                          value={getColorCategory(factors.landValue)}
                                          badge
                                          valueRating={factors.landValue}
                                        />
                                        <div className="mt-2 pt-2 border-t border-gray-600">
                                          <div className="text-xs text-gray-300 mb-2">Your vineyard's land value is calculated dynamically based on multiple factors:</div>
                                      
                                          <div className="text-xs font-medium text-blue-300 mb-1">Calculation Formula:</div>
                                          <div className="text-xs font-mono mb-2 text-gray-300">landValue = basePrice + altitudeAspectRate × (maxPrice - basePrice)</div>
                                      
                                          <div className="text-xs font-medium text-blue-300 mb-1">Raw Price Factor:</div>
                                          <div className="text-xs mb-1 text-gray-300">altitudeAspectRate = (altitude + aspect) ÷ 2</div>
                                      <ul className="text-xs space-y-1 ml-2 text-gray-300">
                                        <li>• <strong>Altitude:</strong> {vineyard.altitude}m vs. optimal range</li>
                                        <li>• <strong>Aspect:</strong> {vineyard.aspect} sun exposure rating</li>
                                      </ul>
                                      
                                          <div className="text-xs font-medium mt-2 mb-1 text-green-300">Regional Scaling:</div>
                                          <div className="text-xs text-gray-300 mb-2">Perfect factors (altitudeAspectRate=1) reach the region's maximum price</div>
                                      
                                          <TooltipRow 
                                            label="Regional Price Range:" 
                                            value={`€${formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })} - €${formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { decimals: 0, forceDecimals: false })} per hectare in ${vineyard.region}`}
                                          />
                                      
                                          <div className="text-xs font-medium mt-2 mb-1 text-purple-300">Global Normalization:</div>
                                          <div className="text-xs text-gray-300">Final value is normalized using asymmetrical scaling for the grape quality index calculation.</div>
                                        </div>
                                      </TooltipSection>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div className="space-y-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <MobileDialogWrapper
                                      content={
                                        <div className={tooltipStyles.text}>
                                          <TooltipSection title="Land Value">
                                            <TooltipRow 
                                              label="Raw Value:" 
                                              value={`${formatNumber(vineyard.landValue || 0, { currency: true })} per hectare`}
                                            />
                                            <TooltipRow 
                                              label="Normalized:" 
                                              value={formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}
                                              valueRating={factors.landValue}
                                              monospaced
                                            />
                                          </TooltipSection>
                                        </div>
                                      }
                                      title="Land Value Details"
                                      triggerClassName="flex justify-between cursor-help"
                                    >
                                      <div className="flex justify-between cursor-help">
                                        <span className="text-blue-700">{formatNumber(vineyard.landValue || 0, { currency: true })} per hectare</span>
                                        <span className={`font-mono ${getColorClass(factors.landValue)}`}>→ {formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}</span>
                                      </div>
                                    </MobileDialogWrapper>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={8} className="max-w-xs" variant="panel" density="compact">
                                    <div className={tooltipStyles.text}>
                                      <TooltipSection title="Land Value">
                                        <TooltipRow 
                                          label="Raw Value:" 
                                          value={`${formatNumber(vineyard.landValue || 0, { currency: true })} per hectare`}
                                        />
                                        <TooltipRow 
                                          label="Normalized:" 
                                          value={formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}
                                          valueRating={factors.landValue}
                                          monospaced
                                        />
                                      </TooltipSection>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <div className="flex justify-between">
                                <span className="text-blue-700">Weight in Index:</span>
                                <span className="font-mono text-blue-800">60%</span>
                              </div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <MobileDialogWrapper
                                      content={
                                        <div className={tooltipStyles.text}>
                                          <TooltipSection title="Contribution">
                                            <TooltipRow 
                                              label="Land Value:" 
                                              value={formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}
                                              valueRating={factors.landValue}
                                              monospaced
                                            />
                                            <TooltipRow 
                                              label="Weight:" 
                                              value="60%"
                                            />
                                            <div className="mt-2 pt-2 border-t border-gray-600">
                                              <TooltipRow 
                                                label="Contribution:" 
                                                value={formatNumber(factors.landValue * 0.6, { decimals: 2, forceDecimals: true })}
                                                valueRating={factors.landValue * 0.6}
                                                monospaced
                                              />
                                            </div>
                                          </TooltipSection>
                                        </div>
                                      }
                                      title="Contribution Details"
                                      triggerClassName="flex justify-between font-medium border-t border-blue-300 pt-2 cursor-help"
                                    >
                                      <div className="flex justify-between font-medium border-t border-blue-300 pt-2 cursor-help">
                                        <span className="text-blue-800">Contribution:</span>
                                        <span className={`font-mono ${getColorClass(factors.landValue * 0.6)}`}>{formatNumber(factors.landValue * 0.6, { decimals: 2, forceDecimals: true })}</span>
                                      </div>
                                    </MobileDialogWrapper>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={8} className="max-w-xs" variant="panel" density="compact">
                                    <div className={tooltipStyles.text}>
                                      <TooltipSection title="Contribution">
                                        <TooltipRow 
                                          label="Land Value:" 
                                          value={formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}
                                          valueRating={factors.landValue}
                                          monospaced
                                        />
                                        <TooltipRow 
                                          label="Weight:" 
                                          value="60%"
                                        />
                                        <div className="mt-2 pt-2 border-t border-gray-600">
                                          <TooltipRow 
                                            label="Contribution:" 
                                            value={formatNumber(factors.landValue * 0.6, { decimals: 2, forceDecimals: true })}
                                            valueRating={factors.landValue * 0.6}
                                            monospaced
                                          />
                                        </div>
                                      </TooltipSection>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
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
                                          <MobileDialogWrapper 
                                            content={
                                              <div className={tooltipStyles.text}>
                                                <TooltipSection title="Land Value Formula">
                                                  <div className="text-xs text-gray-300">Land value = Regional Baseprice + Regional modifier × (Regional Maxprice - Regional Baseprice)</div>
                                                </TooltipSection>
                                              </div>
                                            } 
                                            title="Land Value Formula"
                                            triggerClassName="font-mono text-blue-700 cursor-help"
                                          >
                                        <div className="font-mono text-blue-700 cursor-help">
                                          {formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { currency: true })} + <span className={getColorClass((factors.altitudeRating + factors.aspectRating) / 2)}>{formatNumber((factors.altitudeRating + factors.aspectRating) / 2, { decimals: 2, forceDecimals: true })}</span> × ({formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { currency: true })} - {formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { currency: true })}) = {formatNumber(vineyard.landValue || 0, { currency: true })}
                                        </div>
                                          </MobileDialogWrapper>
                                      </TooltipTrigger>
                                        <TooltipContent side="top" sideOffset={8} className="max-w-xs" variant="panel" density="compact">
                                          <div className={tooltipStyles.text}>
                                            <TooltipSection title="Land Value Formula">
                                              <div className="text-xs text-gray-300">Land value = Regional Baseprice + Regional modifier × (Regional Maxprice - Regional Baseprice)</div>
                                            </TooltipSection>
                                          </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Regional Modifier with tooltip breakdown */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                          <MobileDialogWrapper 
                                            content={
                                              <div className={tooltipStyles.text}>
                                                <TooltipSection title="Regional Modifier Breakdown">
                                                  <TooltipRow label="Formula:" value="(altitude + aspect) ÷ 2" />
                                                  <div className="mt-2 pt-2 border-t border-gray-600">
                                                    <TooltipRow 
                                                      label="Altitude:" 
                                                      value={`${formatNumber(factors.altitudeRating, { decimals: 2, forceDecimals: true })} (${vineyard.altitude}m)`}
                                                      valueRating={factors.altitudeRating}
                                                    />
                                                    <TooltipRow 
                                                      label="Aspect:" 
                                                      value={`${formatNumber(factors.aspectRating, { decimals: 2, forceDecimals: true })} (${vineyard.aspect})`}
                                                      valueRating={factors.aspectRating}
                                                    />
                                                  </div>
                                                </TooltipSection>
                                              </div>
                                            } 
                                            title="Regional Modifier Breakdown"
                                            triggerClassName="font-mono text-blue-800 font-medium cursor-help"
                                          >
                                        <div className="font-mono text-blue-800 font-medium cursor-help">
                                          Regional Modifier: (<span className={getColorClass(factors.altitudeRating)}>{formatNumber(factors.altitudeRating, { decimals: 2, forceDecimals: true })}</span> + <span className={getColorClass(factors.aspectRating)}>{formatNumber(factors.aspectRating, { decimals: 2, forceDecimals: true })}</span>) ÷ 2 = <span className={getColorClass((factors.altitudeRating + factors.aspectRating) / 2)}>{formatNumber((factors.altitudeRating + factors.aspectRating) / 2, { decimals: 2, forceDecimals: true })}</span>
                                        </div>
                                          </MobileDialogWrapper>
                                      </TooltipTrigger>
                                        <TooltipContent side="top" sideOffset={8} className="max-w-xs" variant="panel" density="compact">
                                          <div className={tooltipStyles.text}>
                                            <TooltipSection title="Regional Modifier Breakdown">
                                              <TooltipRow label="Formula:" value="(altitude + aspect) ÷ 2" />
                                              <div className="mt-2 pt-2 border-t border-gray-600">
                                                <TooltipRow 
                                                  label="Altitude:" 
                                                  value={`${formatNumber(factors.altitudeRating, { decimals: 2, forceDecimals: true })} (${vineyard.altitude}m)`}
                                                  valueRating={factors.altitudeRating}
                                                />
                                                <TooltipRow 
                                                  label="Aspect:" 
                                                  value={`${formatNumber(factors.aspectRating, { decimals: 2, forceDecimals: true })} (${vineyard.aspect})`}
                                                  valueRating={factors.aspectRating}
                                                />
                                              </div>
                                            </TooltipSection>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                
                                {/* Regional Price Range */}
                                <div className="bg-blue-50 p-2 rounded text-xs">
                                  <div className="font-medium text-blue-700 mb-1">Regional Price Range ({vineyard.region}):</div>
                                  <div className="font-mono text-blue-600">
                                    {formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { currency: true })} - {formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { currency: true })} per hectare
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
                                      <MobileDialogWrapper 
                                        content={
                                          <div className={tooltipStyles.text}>
                                            <TooltipSection title="Normalization Calculation">
                                              <TooltipRow 
                                                label="Land Value:" 
                                                value={formatNumber(vineyard.landValue || 0, { currency: true })}
                                              />
                                              <TooltipRow 
                                                label="Global Max:" 
                                                value={formatNumber(getMaxLandValue(), { currency: true })}
                                              />
                                              <div className="mt-2 pt-2 border-t border-gray-600">
                                                <TooltipRow 
                                                  label="Result:" 
                                                  value={formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}
                                                  valueRating={factors.landValue}
                                                  monospaced
                                                />
                                              </div>
                                            </TooltipSection>
                                          </div>
                                        } 
                                        title="Normalization Calculation"
                                        triggerClassName="font-mono text-blue-700 cursor-help"
                                      >
                                      <div className="font-mono text-blue-700 cursor-help">
                                        Scaling ({formatNumber(vineyard.landValue || 0, { currency: true })} / {formatNumber(getMaxLandValue(), { currency: true })}) = <span className={getColorClass(factors.landValue)}>{formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}</span>
                                      </div>
                                      </MobileDialogWrapper>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" sideOffset={8} className="max-w-xs" variant="panel" density="compact">
                                      <div className={tooltipStyles.text}>
                                        <TooltipSection title="Normalization Calculation">
                                          <TooltipRow 
                                            label="Land Value:" 
                                            value={`€${formatNumber(vineyard.landValue || 0, { decimals: 0, forceDecimals: false })}`}
                                          />
                                          <TooltipRow 
                                            label="Global Max:" 
                                            value={`€${formatNumber(getMaxLandValue(), { decimals: 0, forceDecimals: false })}`}
                                          />
                                          <div className="mt-2 pt-2 border-t border-gray-600">
                                            <TooltipRow 
                                              label="Result:" 
                                              value={formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}
                                              valueRating={factors.landValue}
                                              monospaced
                                            />
                                          </div>
                                        </TooltipSection>
                                      </div>
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
                                    <MobileDialogWrapper 
                                      content={
                                        <div className={tooltipStyles.text}>
                                          <TooltipSection title="🌟 Vineyard Prestige Sources">
                                            <TooltipRow 
                                              label="Category:" 
                                              value={getColorCategory(factors.vineyardPrestige)}
                                              badge
                                              valueRating={factors.vineyardPrestige}
                                            />
                                            <div className="mt-2 pt-2 border-t border-gray-600">
                                              <div className="text-xs text-gray-300 mb-2">Prestige accumulates from multiple sources with different decay rates.</div>
                                              <div className="text-xs font-medium text-purple-300 mb-1">Prestige Components:</div>
                                              <ul className="text-xs space-y-1 ml-2 text-gray-300">
                                                <li>• <strong>Base Prestige:</strong> Permanent foundation (no decay)</li>
                                                <li>• <strong>Vine Age:</strong> Increases over time, permanent</li>
                                                <li>• <strong>Land Value:</strong> Based on property value, permanent</li>
                                                <li>• <strong>Regional Prestige:</strong> Location-based, permanent</li>
                                                <li>• <strong>Sales Events:</strong> Temporary boosts (95% weekly decay)</li>
                                                <li>• <strong>Achievements:</strong> Special accomplishments, permanent</li>
                                              </ul>
                                            </div>
                                          </TooltipSection>
                                        </div>
                                      } 
                                      title="🌟 Vineyard Prestige Sources"
                                      triggerClassName="text-purple-600 cursor-help"
                                    >
                                    <span className="text-purple-600 cursor-help">ℹ️</span>
                                    </MobileDialogWrapper>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={8} className="max-w-xs" variant="panel" density="compact">
                                    <div className={tooltipStyles.text}>
                                      <TooltipSection title="🌟 Vineyard Prestige Sources">
                                        <TooltipRow 
                                          label="Category:" 
                                          value={getColorCategory(factors.vineyardPrestige)}
                                          badge
                                          valueRating={factors.vineyardPrestige}
                                        />
                                        <div className="mt-2 pt-2 border-t border-gray-600">
                                          <div className="text-xs text-gray-300 mb-2">Prestige accumulates from multiple sources with different decay rates.</div>
                                          <div className="text-xs font-medium text-purple-300 mb-1">Prestige Components:</div>
                                          <ul className="text-xs space-y-1 ml-2 text-gray-300">
                                        <li>• <strong>Base Prestige:</strong> Permanent foundation (no decay)</li>
                                        <li>• <strong>Vine Age:</strong> Increases over time, permanent</li>
                                        <li>• <strong>Land Value:</strong> Based on property value, permanent</li>
                                        <li>• <strong>Regional Prestige:</strong> Location-based, permanent</li>
                                        <li>• <strong>Sales Events:</strong> Temporary boosts (95% weekly decay)</li>
                                        <li>• <strong>Achievements:</strong> Special accomplishments, permanent</li>
                                      </ul>
                                        </div>
                                      </TooltipSection>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div className="space-y-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <MobileDialogWrapper
                                      content={
                                        <div className={tooltipStyles.text}>
                                          <TooltipSection title="Vineyard Prestige">
                                            <TooltipRow 
                                              label="Prestige Score:" 
                                              value={formatNumber(factors.vineyardPrestige, { decimals: 2, forceDecimals: true })}
                                              valueRating={factors.vineyardPrestige}
                                              monospaced
                                            />
                                          </TooltipSection>
                                        </div>
                                      }
                                      title="Vineyard Prestige Details"
                                      triggerClassName="flex justify-between cursor-help"
                                    >
                                      <div className="flex justify-between cursor-help">
                                        <span className="text-purple-700">Prestige Score:</span>
                                        <span className={`font-mono ${getColorClass(factors.vineyardPrestige)}`}>{formatNumber(factors.vineyardPrestige, { decimals: 2, forceDecimals: true })}</span>
                                      </div>
                                    </MobileDialogWrapper>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={8} className="max-w-xs" variant="panel" density="compact">
                                    <div className={tooltipStyles.text}>
                                      <TooltipSection title="Vineyard Prestige">
                                        <TooltipRow 
                                          label="Prestige Score:" 
                                          value={formatNumber(factors.vineyardPrestige, { decimals: 2, forceDecimals: true })}
                                          valueRating={factors.vineyardPrestige}
                                          monospaced
                                        />
                                      </TooltipSection>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <div className="flex justify-between">
                                <span className="text-purple-700">Weight in Index:</span>
                                <span className="font-mono text-purple-800">40%</span>
                              </div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <MobileDialogWrapper
                                      content={
                                        <div className={tooltipStyles.text}>
                                          <TooltipSection title="Contribution">
                                            <TooltipRow 
                                              label="Vineyard Prestige:" 
                                              value={formatNumber(factors.vineyardPrestige, { decimals: 2, forceDecimals: true })}
                                              valueRating={factors.vineyardPrestige}
                                              monospaced
                                            />
                                            <TooltipRow 
                                              label="Weight:" 
                                              value="40%"
                                            />
                                            <div className="mt-2 pt-2 border-t border-gray-600">
                                              <TooltipRow 
                                                label="Contribution:" 
                                                value={formatNumber(factors.vineyardPrestige * 0.4, { decimals: 2, forceDecimals: true })}
                                                valueRating={factors.vineyardPrestige * 0.4}
                                                monospaced
                                              />
                                            </div>
                                          </TooltipSection>
                                        </div>
                                      }
                                      title="Contribution Details"
                                      triggerClassName="flex justify-between font-medium border-t border-purple-300 pt-2 cursor-help"
                                    >
                                      <div className="flex justify-between font-medium border-t border-purple-300 pt-2 cursor-help">
                                        <span className="text-purple-800">Contribution:</span>
                                        <span className={`font-mono ${getColorClass(factors.vineyardPrestige * 0.4)}`}>{formatNumber(factors.vineyardPrestige * 0.4, { decimals: 2, forceDecimals: true })}</span>
                                      </div>
                                    </MobileDialogWrapper>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={8} className="max-w-xs" variant="panel" density="compact">
                                    <div className={tooltipStyles.text}>
                                      <TooltipSection title="Contribution">
                                        <TooltipRow 
                                          label="Vineyard Prestige:" 
                                          value={formatNumber(factors.vineyardPrestige, { decimals: 2, forceDecimals: true })}
                                          valueRating={factors.vineyardPrestige}
                                          monospaced
                                        />
                                        <TooltipRow 
                                          label="Weight:" 
                                          value="40%"
                                        />
                                        <div className="mt-2 pt-2 border-t border-gray-600">
                                          <TooltipRow 
                                            label="Contribution:" 
                                            value={formatNumber(factors.vineyardPrestige * 0.4, { decimals: 2, forceDecimals: true })}
                                            valueRating={factors.vineyardPrestige * 0.4}
                                            monospaced
                                          />
                                        </div>
                                      </TooltipSection>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
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
  // Use current grape quality (feature effects are already applied)
  const currentGrapeQuality = wineBatch.grapeQuality;
  const qualityDifference = currentGrapeQuality - baseQuality;
  const presentFeatures = (wineBatch.features || []).filter(f => f.isPresent);
  const configs = getAllFeatureConfigs();
  
  // Calculate which features have non-zero impact
  const featuresWithImpact = presentFeatures.filter(feature => {
    const config = configs.find(c => c.id === feature.id);
    if (!config?.effects.quality) return false;
    
    const qualityEffect = config.effects.quality;
    let impactValue = 0;
    
    if (qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
      impactValue = qualityEffect.amount * feature.severity;
    } else if (qualityEffect.type === 'power') {
      const scaledPenalty = qualityEffect.basePenalty! * (1 + Math.pow(baseQuality, qualityEffect.exponent!));
      impactValue = -scaledPenalty;
    } else if (qualityEffect.type === 'bonus') {
      const bonusAmount = typeof qualityEffect.amount === 'function' 
        ? qualityEffect.amount(feature.severity)
        : qualityEffect.amount;
      if (bonusAmount !== undefined) {
        impactValue = bonusAmount;
      }
    }
    
    return Math.abs(impactValue) >= 0.001;
  });
  
  if (featuresWithImpact.length === 0) {
    return (
      <div className="p-3 bg-white rounded border border-gray-300">
        <div className="text-sm">
          <div className="flex justify-between mb-1">
            <span className="font-medium">Feature Impacts:</span>
            <span className="text-gray-500">None</span>
          </div>
          <div className="text-xs text-gray-500">No wine features currently affecting grape quality</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-3 bg-white rounded border border-purple-300">
      <div className="text-sm space-y-3">
        <div className="flex justify-between">
          <span className="font-medium">Feature Impacts:</span>
          <span className={`font-mono ${qualityDifference !== 0 ? (qualityDifference > 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'}`}>
            {qualityDifference !== 0 ? `${qualityDifference > 0 ? '+' : ''}${formatPercent(Math.abs(qualityDifference))}` : 'No impact'}
          </span>
        </div>
        
        <div className="flex justify-between text-lg font-bold">
          <span>Final Grape Quality:</span>
          <span className={`font-mono ${getColorClass(currentGrapeQuality)}`}>
            {formatNumber(currentGrapeQuality, { decimals: 2, forceDecimals: true })}
            <span className="text-sm font-normal ml-2">({getGrapeQualityCategory(currentGrapeQuality)})</span>
          </span>
        </div>
        
        <div className="space-y-2">
          {featuresWithImpact.map(feature => {
            const config = configs.find(c => c.id === feature.id);
            if (!config) return null;
            
            const qualityEffect = config.effects.quality;
            if (!qualityEffect) return null;
            
            let impactText = '';
            let impactValue = 0;
            
            if (qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
              impactValue = qualityEffect.amount * feature.severity;
            } else if (qualityEffect.type === 'power') {
              const scaledPenalty = qualityEffect.basePenalty! * (1 + Math.pow(baseQuality, qualityEffect.exponent!));
              impactValue = -scaledPenalty;
            } else if (qualityEffect.type === 'bonus') {
              const bonusAmount = typeof qualityEffect.amount === 'function' 
                ? qualityEffect.amount(feature.severity)
                : qualityEffect.amount;
              if (bonusAmount !== undefined) {
                impactValue = bonusAmount;
              }
            }
            if (impactValue !== 0) {
              impactText = `${impactValue > 0 ? '+' : ''}${formatPercent(Math.abs(impactValue))}`;
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
