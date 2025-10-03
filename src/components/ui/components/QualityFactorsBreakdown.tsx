import React, { useState, useEffect } from 'react';
import { Vineyard, WineBatch } from '@/lib/types/types';
import { QualityFactorsDisplay } from './qualityFactorBar';
import { getVineyardQualityFactors } from '@/lib/services/sales/wineValueIndexCalculationService';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/shadCN/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/shadCN/tooltip';
import { formatNumber } from '@/lib/utils';
import { getWineQualityCategory, getColorCategory } from '@/lib/utils/utils';
import { getVineyardPrestigeBreakdown } from '@/lib/services/prestige/prestigeService';
import { REGION_PRICE_RANGES } from '@/lib/constants/vineyardConstants';

// Helper function to get regional price range
const getRegionalPriceRange = (country: string, region: string): [number, number] => {
  const countryData = REGION_PRICE_RANGES[country as keyof typeof REGION_PRICE_RANGES];
  if (!countryData) return [5000, 30000]; // Default fallback
  const regionData = countryData[region as keyof typeof countryData];
  return regionData || [5000, 30000]; // Default fallback
};

// Helper function to get the maximum land value across all regions
const getMaxLandValue = (): number => {
  let maxValue = 0;
  
  // Iterate through all countries and regions to find the highest max price
  // Skip Bourgogne and Champagne to allow them to break the scale
  for (const [countryName, country] of Object.entries(REGION_PRICE_RANGES)) {
    for (const [regionName, priceRange] of Object.entries(country)) {
      // Skip Bourgogne and Champagne to allow them to break the scale
      if (countryName === "France" && (regionName === "Bourgogne" || regionName === "Champagne")) {
        continue;
      }
      const [, maxPrice] = priceRange as [number, number];
      maxValue = Math.max(maxValue, maxPrice);
    }
  }
  
  return maxValue;
};

// Simple chevron icons as SVG components
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

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
  let factors, rawValues, qualityScore, qualityCategory;
  
  try {
    const qualityData = getQualityFactors();
    factors = qualityData.factors;
    rawValues = qualityData.rawValues;
    qualityScore = qualityData.qualityScore;
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
              <span>Wine Value Index:</span>
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
                ({formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}×0.6) + ({formatNumber(factors.vineyardPrestige, { decimals: 2, forceDecimals: true })}×0.4) = {formatNumber(qualityScore, { decimals: 2, forceDecimals: true })}
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
                    {/* Land Value Card */}
                    <Card className="border-blue-200 bg-blue-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-blue-800 text-base">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          Land Value Factor
                        </CardTitle>
                        <CardDescription className="text-blue-700">
                          €{formatNumber(vineyard.landValue || 0, { decimals: 0, forceDecimals: false })} per hectare
                          <br />
                          <span className="text-xs text-blue-600">
                            Calculated from: Regional prestige, altitude ({vineyard.altitude}m), aspect ({vineyard.aspect})
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
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
                                      <p className="font-medium mb-1">Land Value Calculation:</p>
                                      <p className="text-xs mb-2">Your vineyard's land value is calculated dynamically based on multiple factors:</p>
                                      
                                      <p className="font-medium mb-1">Calculation Formula:</p>
                                      <p className="text-xs font-mono mb-2">landValue = basePrice + rawPriceFactor × (maxPrice - basePrice)</p>
                                      
                                      <p className="font-medium mb-1">Raw Price Factor:</p>
                                      <p className="text-xs mb-1">rawPriceFactor = (prestige + altitude + aspect) ÷ 3</p>
                                      <ul className="text-xs space-y-1 ml-2">
                                        <li>• <strong>Prestige:</strong> {vineyard.region} regional standing</li>
                                        <li>• <strong>Altitude:</strong> {vineyard.altitude}m vs. optimal range</li>
                                        <li>• <strong>Aspect:</strong> {vineyard.aspect} sun exposure rating</li>
                                      </ul>
                                      
                                      <p className="font-medium mt-2 mb-1">Regional Scaling:</p>
                                      <p className="text-xs">Perfect factors (rawPriceFactor=1) reach the region's maximum price</p>
                                      
                                      <p className="font-medium mt-2 mb-1">Global Normalization:</p>
                                      <p className="text-xs">Final value is normalized using asymmetrical scaling for the quality index calculation.</p>
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
                                
                                {/* Formula with actual values */}
                                <div className="bg-blue-50 p-2 rounded text-xs">
                                  <div className="font-medium text-blue-700 mb-1">Formula: landValue = basePrice + rawPriceFactor × (maxPrice - basePrice)</div>
                                  <div className="font-medium text-blue-700 mb-1">Raw Price Factor: (prestige + altitude + aspect) ÷ 3</div>
                                  
                                  <div className="mt-2 space-y-1">
                                    <div className="font-mono text-blue-600">
                                      Prestige: {formatNumber(factors.regionalPrestige, { decimals: 2, forceDecimals: true })}
                                    </div>
                                    <div className="font-mono text-blue-600">
                                      Altitude: {formatNumber(factors.altitudeRating, { decimals: 2, forceDecimals: true })} ({vineyard.altitude}m)
                                    </div>
                                    <div className="font-mono text-blue-600">
                                      Aspect: {formatNumber(factors.aspectRating, { decimals: 2, forceDecimals: true })} ({vineyard.aspect})
                                    </div>
                                    <div className="font-mono text-blue-800 font-medium border-t border-blue-300 pt-1">
                                      Raw Factor: ({formatNumber(factors.regionalPrestige, { decimals: 2, forceDecimals: true })} + {formatNumber(factors.altitudeRating, { decimals: 2, forceDecimals: true })} + {formatNumber(factors.aspectRating, { decimals: 2, forceDecimals: true })}) ÷ 3 = {formatNumber((factors.regionalPrestige + factors.altitudeRating + factors.aspectRating) / 3, { decimals: 2, forceDecimals: true })}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Regional Price Range */}
                                <div className="bg-blue-50 p-2 rounded text-xs">
                                  <div className="font-medium text-blue-700 mb-1">Regional Price Range ({vineyard.region}):</div>
                                  <div className="font-mono text-blue-600">
                                    €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })} - €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { decimals: 0, forceDecimals: false })} per hectare
                                  </div>
                                </div>
                                
                                {/* Final Calculation */}
                                <div className="bg-blue-100 p-2 rounded text-xs">
                                  <div className="font-medium text-blue-800 mb-1">Final Calculation:</div>
                                  <div className="font-mono text-blue-700">
                                    €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })} + {formatNumber((factors.regionalPrestige + factors.altitudeRating + factors.aspectRating) / 3, { decimals: 2, forceDecimals: true })} × (€{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[1], { decimals: 0, forceDecimals: false })} - €{formatNumber(getRegionalPriceRange(vineyard.country, vineyard.region)[0], { decimals: 0, forceDecimals: false })}) = €{formatNumber(vineyard.landValue || 0, { decimals: 0, forceDecimals: false })}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Normalization Calculation */}
                            <div className="mt-3 pt-3 border-t border-blue-200">
                              <div className="text-xs space-y-1">
                                <div className="font-medium text-blue-800 mb-2">Normalization for Quality Index:</div>
                                <div className="font-mono text-blue-700">
                                  asymmetricalScale(€{formatNumber(vineyard.landValue || 0, { decimals: 0, forceDecimals: false })} / €{formatNumber(getMaxLandValue(), { decimals: 0, forceDecimals: false })}) = {formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}
                                </div>
                                <div className="font-mono text-blue-600">
                                  Global Max: €{formatNumber(getMaxLandValue(), { decimals: 0, forceDecimals: false })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Vineyard Prestige Card */}
                    <Card className="border-purple-200 bg-purple-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-purple-800 text-base">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          Vineyard Prestige
                        </CardTitle>
                        <CardDescription className="text-purple-700">
                          Combined prestige from vine age, environmental factors, and achievements
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
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
                                      <p className="font-medium mb-1">Vineyard Prestige Sources:</p>
                                      <p className="text-xs mb-2">Prestige accumulates from multiple sources with different decay rates.</p>
                                      <p className="font-medium mb-1">Prestige Components:</p>
                                      <ul className="text-xs space-y-1">
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
                        </div>
                      </CardContent>
                    </Card>

                    {/* Regional Factors Card */}
                    <Card className="border-green-200 bg-green-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-green-800 text-base">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          Regional Factors
                        </CardTitle>
                        <CardDescription className="text-green-700">
                          {vineyard.region}, {vineyard.country}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm space-y-2">
                          <div className="flex justify-between">
                            <span>Regional Prestige:</span>
                            <span className="font-mono">{formatNumber(factors.regionalPrestige, { decimals: 2, forceDecimals: true })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Altitude Rating:</span>
                            <span className="font-mono">{formatNumber(factors.altitudeRating, { decimals: 2, forceDecimals: true })} ({vineyard.altitude}m)</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Aspect Rating:</span>
                            <span className="font-mono">{formatNumber(factors.aspectRating, { decimals: 2, forceDecimals: true })} ({vineyard.aspect})</span>
                          </div>
                        </div>
                        <div className="text-xs text-green-600 space-y-2">
                          <p>
                            <strong>Regional Quality Factors:</strong> These represent the inherent quality potential of your vineyard's location and environment.
                          </p>
                          <div className="bg-green-100 p-2 rounded text-xs">
                            <p className="font-medium mb-1">Factor Calculations:</p>
                            <ul className="space-y-1 text-xs">
                              <li>• <strong>Regional Prestige:</strong> Based on {vineyard.country} wine reputation and {vineyard.region} regional standing</li>
                              <li>• <strong>Altitude Rating:</strong> {vineyard.altitude}m elevation vs. optimal range for {vineyard.region}</li>
                              <li>• <strong>Aspect Rating:</strong> {vineyard.aspect} orientation vs. optimal sun exposure for {vineyard.region}</li>
                            </ul>
                          </div>
                          <div className="bg-green-100 p-2 rounded text-xs">
                            <p className="font-medium mb-1">Your Location Analysis:</p>
                            <p className="text-xs">
                              <strong>{vineyard.region}, {vineyard.country}</strong> - Regional prestige: {formatNumber(factors.regionalPrestige, { decimals: 2, forceDecimals: true })}<br/>
                              <strong>Altitude:</strong> {vineyard.altitude}m (Rating: {formatNumber(factors.altitudeRating, { decimals: 2, forceDecimals: true })})<br/>
                              <strong>Aspect:</strong> {vineyard.aspect} (Rating: {formatNumber(factors.aspectRating, { decimals: 2, forceDecimals: true })})
                            </p>
                          </div>
                          <p>
                            <strong>Impact:</strong> These factors are permanent and represent the natural advantages of your vineyard's location. Premium regions like Bordeaux, Tuscany, or Napa Valley have higher regional prestige.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Grape Suitability Card */}
                    {vineyard.grape && (
                      <Card className="border-orange-200 bg-orange-50">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-orange-800 text-base">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            Grape Suitability
                          </CardTitle>
                          <CardDescription className="text-orange-700">
                            {vineyard.grape} in {vineyard.region}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="text-sm">
                            <div className="flex justify-between">
                              <span>Suitability Score:</span>
                              <span className="font-mono">{formatNumber(factors.grapeSuitability, { decimals: 2, forceDecimals: true })}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Suitability Level:</span>
                              <span className={`font-medium ${
                                factors.grapeSuitability >= 0.8 ? 'text-green-600' :
                                factors.grapeSuitability >= 0.7 ? 'text-green-500' :
                                factors.grapeSuitability >= 0.6 ? 'text-yellow-600' :
                                factors.grapeSuitability >= 0.5 ? 'text-yellow-500' :
                                factors.grapeSuitability >= 0.4 ? 'text-orange-500' :
                                factors.grapeSuitability >= 0.3 ? 'text-orange-600' :
                                factors.grapeSuitability >= 0.2 ? 'text-red-500' :
                                factors.grapeSuitability >= 0.1 ? 'text-red-600' :
                                'text-red-700'
                              }`}>
                                {getColorCategory(factors.grapeSuitability)}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-orange-600 space-y-2">
                            <p>
                              <strong>Grape Suitability Analysis:</strong> How well {vineyard.grape} grapes are suited to the climate and soil conditions of {vineyard.region}.
                            </p>
                            <div className="bg-orange-100 p-2 rounded text-xs">
                              <p className="font-medium mb-1">Suitability Calculation:</p>
                              <p className="text-xs">
                                Based on {vineyard.grape}'s natural preferences vs. {vineyard.region}'s climate, soil, and growing conditions.
                              </p>
                              <p className="text-xs mt-1">
                                <strong>Current Score:</strong> {formatNumber(factors.grapeSuitability, { decimals: 2, forceDecimals: true })} ({getColorCategory(factors.grapeSuitability)})
                              </p>
                            </div>
                            <div className="bg-orange-100 p-2 rounded text-xs">
                              <p className="font-medium mb-1">Quality Impact:</p>
                              <p className="text-xs">
                                Higher suitability means {vineyard.grape} grapes will develop better characteristics in {vineyard.region}'s environment, 
                                leading to superior wine quality and balance.
                              </p>
                            </div>
                            <p>
                              <strong>Regional Match:</strong> Some grape varieties are naturally suited to specific regions (e.g., Pinot Noir in Burgundy, Cabernet in Bordeaux). 
                              Your {formatNumber(factors.grapeSuitability * 100, { decimals: 0, forceDecimals: true })}% suitability indicates how well {vineyard.grape} thrives in {vineyard.region}.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Prestige Breakdown */}
                {(vineyard || wineBatchVineyard) && prestigeBreakdown && (
                  <Card className="border-purple-200 bg-purple-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-purple-800 text-base">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        Vineyard Prestige Breakdown
                      </CardTitle>
                      <CardDescription className="text-purple-700">
                        Detailed sources contributing to {(vineyard || wineBatchVineyard)?.name}'s prestige
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const targetVineyard = vineyard || wineBatchVineyard;
                        const vineyardData = targetVineyard ? prestigeBreakdown[targetVineyard.id] : null;
                        if (!vineyardData || !vineyardData.events || vineyardData.events.length === 0) {
                          return (
                            <div className="text-sm text-purple-600">
                              No prestige events found for this vineyard.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-purple-300">
                              <span className="text-sm font-semibold text-purple-800">Total Vineyard Prestige:</span>
                              <span className="text-lg font-bold text-purple-900">
                                {formatNumber(vineyardData.totalPrestige, { decimals: 2, forceDecimals: true })}
                              </span>
                            </div>
                            {vineyardData.events.map((event: any, index: number) => (
                              <div key={index} className="flex items-center justify-between py-3 px-4 bg-purple-100 rounded-lg border border-purple-200">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-purple-800 mb-1">{event.description}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-purple-600 bg-purple-200 px-2 py-1 rounded">
                                      {event.type.replace('vineyard_', '').replace('_', ' ')}
                                    </span>
                                    <span className="text-xs text-purple-600">
                                      {event.decayRate === 0 ? 'No decay' : `${formatNumber((1 - event.decayRate) * 100, { decimals: 1, forceDecimals: true })}% weekly decay`}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="text-sm font-bold text-purple-900">
                                    {formatNumber(event.currentAmount, { decimals: 2, forceDecimals: true })}
                                  </p>
                                  {event.originalAmount !== event.currentAmount && (
                                    <p className="text-xs text-purple-600">
                                      (was {formatNumber(event.originalAmount, { decimals: 2, forceDecimals: true })})
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                {/* Improvement Suggestions */}
                {vineyard && (
                  <Card className="border-gray-200 bg-gray-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-gray-800 text-base">
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        Improvement Opportunities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-2">
                        {factors.altitudeRating < 0.6 && (
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-600">⚠️</span>
                            <div>
                              <span className="font-medium">Altitude Optimization:</span>
                              <span className="text-gray-600 ml-1">
                                Your vineyard's altitude ({vineyard.altitude}m) is below optimal for {vineyard.region}.
                                Consider vineyards in higher elevations for better quality.
                              </span>
                            </div>
                          </div>
                        )}

                        {factors.grapeSuitability < 0.6 && vineyard.grape && (
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-600">⚠️</span>
                            <div>
                              <span className="font-medium">Grape Selection:</span>
                              <span className="text-gray-600 ml-1">
                                {vineyard.grape} has {formatNumber(factors.grapeSuitability * 100, { decimals: 0, forceDecimals: true })}% suitability in {vineyard.region}.
                                Consider more suitable varieties for this region.
                              </span>
                            </div>
                          </div>
                        )}

                        {factors.landValue < 0.5 && (
                          <div className="flex items-start gap-2">
                            <span className="text-blue-600">💡</span>
                            <div>
                              <span className="font-medium">Land Value Enhancement:</span>
                              <span className="text-gray-600 ml-1">
                                Higher land values in premium regions would significantly improve your wine value index.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </div>
  );
};
