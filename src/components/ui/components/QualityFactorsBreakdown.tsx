import React, { useState, useEffect } from 'react';
import { Vineyard, WineBatch } from '@/lib/types/types';
import { QualityFactorsDisplay } from './qualityFactorBar';
import { getVineyardQualityFactors } from '@/lib/services/sales/wineValueIndexCalculationService';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/shadCN/card';
import { formatNumber } from '@/lib/utils';
import { getWineQualityCategory, getColorCategory } from '@/lib/utils/utils';
import { getVineyardPrestigeBreakdown } from '@/lib/services/prestige/prestigeService';

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

  // Load prestige breakdown data
  useEffect(() => {
    if (vineyard && showFactorDetails) {
      getVineyardPrestigeBreakdown().then((breakdown) => {
        setPrestigeBreakdown(breakdown);
      }).catch((error) => {
        console.error('Failed to load prestige breakdown:', error);
      });
    }
  }, [vineyard, showFactorDetails]);

  // Get quality factors from centralized calculation
  const getQualityFactors = () => {
    if (vineyard) {
      return getVineyardQualityFactors(vineyard);
    } else if (wineBatch) {
      // For wine batches, use placeholder values (would need vineyard lookup in real implementation)
      return {
        factors: {
          landValue: 0.5,
          vineyardPrestige: 0.5,
          regionalPrestige: 0.5,
          altitudeRating: 0.5,
          aspectRating: 0.5,
          grapeSuitability: 0.5
        },
        rawValues: {
          landValue: 0,
          vineyardPrestige: 0.5,
          regionalPrestige: 0.5,
          altitudeRating: '0m',
          aspectRating: 'North',
          grapeSuitability: ''
        },
        qualityScore: wineBatch.quality || 0.5
      };
    }
    
    // Default fallback
    return {
      factors: {
        landValue: 0,
        vineyardPrestige: 0,
        regionalPrestige: 0,
        altitudeRating: 0,
        aspectRating: 0,
        grapeSuitability: 0
      },
      rawValues: {
        landValue: 0,
        vineyardPrestige: 0,
        regionalPrestige: 0,
        altitudeRating: '0m',
        aspectRating: 'North',
        grapeSuitability: ''
      },
      qualityScore: 0
    };
  };

  const { factors, rawValues, qualityScore } = getQualityFactors();

  // Get quality category for display
  const qualityCategory = getWineQualityCategory(qualityScore);

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
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-sm">
                          <div className="flex justify-between">
                            <span>Normalized Value:</span>
                            <span className="font-mono">{formatNumber(factors.landValue, { decimals: 2, forceDecimals: true })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Weight in Index:</span>
                            <span className="font-mono">60%</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Contribution:</span>
                            <span className="font-mono">{formatNumber(factors.landValue * 0.6, { decimals: 2, forceDecimals: true })}</span>
                          </div>
                        </div>
                        <p className="text-xs text-blue-600">
                          Land value is normalized using logarithmic scaling to handle the wide range of prices across regions.
                        </p>
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
                        <div className="text-sm">
                          <div className="flex justify-between">
                            <span>Prestige Score:</span>
                            <span className="font-mono">{formatNumber(factors.vineyardPrestige, { decimals: 2, forceDecimals: true })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Weight in Index:</span>
                            <span className="font-mono">40%</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Contribution:</span>
                            <span className="font-mono">{formatNumber(factors.vineyardPrestige * 0.4, { decimals: 2, forceDecimals: true })}</span>
                          </div>
                        </div>
                        <p className="text-xs text-purple-600">
                          Vineyard prestige accumulates from multiple sources including vine age, land value, grape suitability, and achievements.
                        </p>
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
                        <p className="text-xs text-green-600">
                          These factors represent the inherent quality potential of your vineyard's location and environment.
                        </p>
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
                          <p className="text-xs text-orange-600">
                            How well {vineyard.grape} grapes are suited to the climate and soil conditions of {vineyard.region}.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Prestige Breakdown */}
                {vineyard && prestigeBreakdown && (
                  <Card className="border-purple-200 bg-purple-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-purple-800 text-base">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        Vineyard Prestige Breakdown
                      </CardTitle>
                      <CardDescription className="text-purple-700">
                        Detailed sources contributing to {vineyard.name}'s prestige
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const vineyardData = prestigeBreakdown[vineyard.id];
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
