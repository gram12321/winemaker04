import React, { useState, useEffect } from 'react';
import { LandSearchOptions, calculateLandSearchCost, getAccessibleRegions, calculateRegionDistribution, calculateLandSearchWork } from '@/lib/services';
import { ASPECTS, GRAPE_VARIETIES } from '@/lib/types/types';
import { formatCurrency } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/utils';
import { Button } from '@/components/ui/shadCN/button';
import * as SliderPrimitive from '@radix-ui/react-slider';

// Two-thumb slider built on Radix Slider primitives
const DualSlider: React.FC<{
  value: [number, number];
  min: number;
  max: number;
  step?: number;
  onChange: (value: [number, number]) => void;
}> = ({ value, min, max, step = 1, onChange }) => {
  return (
    <SliderPrimitive.Root
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={(v) => onChange([v[0] as number, v[1] as number])}
      className="relative flex items-center select-none touch-none w-full h-6"
    >
      <SliderPrimitive.Track className="bg-gray-700 relative grow rounded-full h-2">
        <SliderPrimitive.Range className="absolute bg-green-500 rounded-full h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block w-4 h-4 bg-white rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400" />
      <SliderPrimitive.Thumb className="block w-4 h-4 bg-white rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400" />
    </SliderPrimitive.Root>
  );
};
// import { Badge } from '@/components/ui/shadCN/badge';
import { X } from 'lucide-react';
import { getGameState } from '@/lib/services';
import { COUNTRY_REGION_MAP, ALL_SOIL_TYPES } from '@/lib/constants/vineyardConstants';

interface LandSearchOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchStarted?: () => void;
}

export const LandSearchOptionsModal: React.FC<LandSearchOptionsModalProps> = ({
  isOpen,
  onClose,
  onSearchStarted
}) => {
  const [options, setOptions] = useState<LandSearchOptions>({
    numberOfOptions: 3,
    regions: [],
    selectedCountries: [],
    hectareRange: [0.05, 2000],
    soilTypes: [...ALL_SOIL_TYPES],
    aspectPreferences: [...ASPECTS],
    minGrapeSuitability: 0,
    grapeVarieties: []
  });

  // Preview calculations for search results
  const [previewStats, setPreviewStats] = useState<{
    totalCost: number;
    totalWork: number;
    timeEstimate: string;
    accessibleRegions: number;
    selectedRegions: number;
    totalProbability: number; // sum of probabilities of selected regions (0-1)
  }>({
    totalCost: 0,
    totalWork: 0,
    timeEstimate: 'Calculating...',
    accessibleRegions: 0,
    selectedRegions: 0,
    totalProbability: 0
  });

  const [redistributedProbabilities, setRedistributedProbabilities] = useState<Array<{region: string, probability: number}>>([]);

  // Get company prestige for calculations
  const gameState = getGameState();

  // Calculate preview stats whenever options change
  useEffect(() => {
    const totalCost = calculateLandSearchCost(options, gameState.prestige || 0);
    const { totalWork } = calculateLandSearchWork(options, gameState.prestige || 0);
    const weeks = Math.ceil(totalWork / 100); // Assuming 100 work units per week
    const timeEstimate = `${weeks} week${weeks === 1 ? '' : 's'}`;

    // Get accessible regions, filtered by grape suitability and soil types
    const accessible = getAccessibleRegions(
      gameState.prestige || 0, 
      options.grapeVarieties || [], 
      options.minGrapeSuitability || 0,
      options.soilTypes || []
    );
    
    // Filter by selected regions - options.regions contains EXCLUDED regions
    const excludedRegions = options.regions;
    const includedRegions = accessible.filter(region => !excludedRegions.includes(region));
    
    // Calculate region distribution
    const distribution = calculateRegionDistribution(includedRegions, gameState.prestige || 0);
    setRedistributedProbabilities(distribution.probabilities);

    // New: compute selected regions and total probability
    const selectedRegions = distribution.probabilities.length;
    const totalProbability = distribution.totalSum;

    setPreviewStats({
      totalCost,
      totalWork,
      timeEstimate,
      accessibleRegions: distribution.probabilities.length,
      selectedRegions,
      totalProbability
    });
  }, [options, gameState.prestige]);

  // Handle submit
  const handleSubmit = async () => {
    const { startLandSearch } = await import('@/lib/services');
    const activityId = await startLandSearch(options);
    if (activityId) {
      onClose();
      if (onSearchStarted) {
        onSearchStarted();
      }
    }
  };

  if (!isOpen) return null;

  // Get all available regions for the multi-select (removed unused variable)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Land Search</h2>
            <p className="text-sm text-gray-400 mt-1">Configure parameters for finding vineyard properties</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Region Selection */}
            <div className="space-y-6">
              {/* Region Selection */}
              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Regions (leave empty for all accessible)
                </label>
                
                {/* Country Bulk Selector */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs font-medium text-gray-300 uppercase tracking-wide">
                      Bulk Select Countries
                    </div>
                    <button
                      onClick={() => setOptions(prev => ({ ...prev, regions: [] }))}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      Reset Selection
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {Object.keys(COUNTRY_REGION_MAP).map((country) => {
                      // Check if all regions in this country are excluded
                      const countryRegions = [...(COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP] as readonly string[])];
                      const excludedCountryRegions = countryRegions.filter(region => options.regions.includes(region));
                      const allRegionsExcluded = excludedCountryRegions.length === countryRegions.length;
                      
                      return (
                        <div 
                          key={country} 
                          className={`p-2 rounded border-dashed cursor-pointer transition-all duration-200 ${
                            allRegionsExcluded 
                              ? 'bg-gray-600 border-gray-500 text-gray-400 opacity-60' 
                              : 'bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 text-gray-300 hover:text-white'
                          }`}
                          onClick={() => {
                            if (allRegionsExcluded) {
                              // If all regions are excluded, include all regions from this country
                              const newRegions = options.regions.filter(region => !countryRegions.includes(region));
                              setOptions(prev => ({ ...prev, regions: newRegions }));
                            } else {
                              // If some/all regions are included, exclude all regions from this country
                              const newRegions = [...new Set([...options.regions, ...countryRegions])];
                              setOptions(prev => ({ ...prev, regions: newRegions }));
                            }
                          }}
                        >
                          <div className="text-center">
                            <div className="text-xs font-medium">{country}</div>
                            <div className="text-[10px] text-gray-500 mt-1">
                              {excludedCountryRegions.length}/{countryRegions.length} excluded
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Click countries to exclude/include all regions from that country. Countries with all regions excluded are filtered out.
                  </p>
                </div>

                {/* Region Grid */}
                <div className="space-y-4">
                  {(() => {
                    // Get ALL regions (not filtered by grape suitability or soil) to show them all
                    const allRegions = getAccessibleRegions(gameState.prestige || 0);
                    
                    // Get accessible regions filtered by grape suitability and soil types
                    const accessible = getAccessibleRegions(
                      gameState.prestige || 0, 
                      options.grapeVarieties || [], 
                      options.minGrapeSuitability || 0,
                      options.soilTypes || []
                    );
                    
                    // Group ALL regions by country maintaining original order
                    const regionsByCountry = allRegions.reduce((acc, region) => {
                      // Find country for this region
                      let country = '';
                      for (const [countryName, regions] of Object.entries(COUNTRY_REGION_MAP)) {
                        if ((regions as any).includes(region)) {
                          country = countryName;
                          break;
                        }
                      }
                      
                      if (!acc[country]) acc[country] = [];
                      acc[country].push(region);
                      return acc;
                    }, {} as Record<string, string[]>);

                    // Filter out countries where all regions are excluded (manually OR by grape suitability OR by soil)
                    const filteredCountries = Object.entries(regionsByCountry).filter(([country]) => {
                      const countryRegions = [...(COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP] as readonly string[])];
                      const manuallyExcludedRegions = countryRegions.filter(region => options.regions.includes(region));
                      const grapeAndSoilFilteredRegions = countryRegions.filter(region => 
                        !accessible.includes(region)
                      );
                      const totalExcludedRegions = new Set([...manuallyExcludedRegions, ...grapeAndSoilFilteredRegions]).size;
                      return totalExcludedRegions < countryRegions.length; // Show country if not all regions are excluded
                    });

                    return filteredCountries.map(([country, regions]) => (
                      <div key={country} className="border-b border-dashed border-gray-600 pb-3 last:border-b-0">
                        <div className="text-xs font-medium text-gray-300 mb-2 uppercase tracking-wide">
                          {country}
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {regions.map((region) => {
                            // Check if region is manually excluded
                            const isManuallyExcluded = options.regions.includes(region);
                            
                            // Check if region is filtered out by grape suitability or soil types
                            const isGrapeOrSoilFiltered = !accessible.includes(region);
                            
                            // Region is "excluded" if either manually excluded OR grape/soil filtered
                            const isExcluded = isManuallyExcluded || isGrapeOrSoilFiltered;
                            
                            // For excluded regions, show 0% probability
                            // For included regions, use redistributed probability
                            const redistributedRegion = redistributedProbabilities.find(r => r.region === region);
                            const probability = isExcluded ? 0 : (redistributedRegion ? redistributedRegion.probability : 0);
                            
                            const probabilityColors = probability > 0.5 
                              ? 'text-green-500 bg-green-50' 
                              : probability > 0.1 
                                ? 'text-yellow-500 bg-yellow-50' 
                                : 'text-red-500 bg-red-50';

                            return (
                              <div 
                                key={region} 
                                className={`p-2 rounded border-dashed cursor-pointer transition-all duration-200 ${
                                  isExcluded 
                                    ? 'bg-gray-600 border-gray-500 text-gray-400 opacity-60' 
                                    : 'bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 text-gray-300 hover:text-white'
                                }`}
                                onClick={() => {
                                  // Only allow clicking if not grape/soil filtered (filtering is automatic)
                                  if (!isGrapeOrSoilFiltered) {
                                    // Clicking excludes/includes the region in the search
                                    const newRegions = isManuallyExcluded
                                      ? options.regions.filter(r => r !== region)
                                      : [...options.regions, region];
                                    setOptions(prev => ({ ...prev, regions: newRegions }));
                                  }
                                }}
                              >
                                <div className="text-center">
                                  <div className="text-xs font-medium mb-1">{region}</div>
                                  <div className={`text-xs px-1.5 py-0.5 rounded ${
                                    isExcluded ? 'bg-gray-500 text-gray-300' : probabilityColors
                                  }`}>
                                    {isExcluded ? '0%' : `${formatNumber(probability * 100, { smartMaxDecimals: true })}%`}
                                  </div>
                                  {isGrapeOrSoilFiltered && (
                                    <div className="text-[10px] text-gray-500 mt-1">Filtered</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Click countries to exclude/include all regions from that country. Click individual regions to exclude them from search (red = excluded). Countries with all regions excluded are automatically filtered out. Grape suitability and soil type selections can also filter out regions. Higher company prestige increases chances of finding properties in premium regions.
                </p>
              </div>
            </div>

            {/* Middle Column - Combined Controls */}
            <div className="space-y-6">
            {/* Hectare Range */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Hectare Range ({formatNumber(options.hectareRange[0], { smartDecimals: true, smartMaxDecimals: true })} - {formatNumber(options.hectareRange[1], { smartDecimals: true, smartMaxDecimals: true })} hectares)
                </label>
                {(() => {
                  // Log slider helpers: map slider [0,1000] to hectares [0.05,2000]
                  const MIN_HA = 0.05;
                  const MAX_HA = 2000;
                  const SLIDER_MAX = 1000;
                  const toHa = (s: number) => MIN_HA * Math.pow(MAX_HA / MIN_HA, s / SLIDER_MAX);
                  const toSlider = (ha: number) => {
                    const clamped = Math.max(MIN_HA, Math.min(MAX_HA, ha));
                    return Math.round(Math.log(clamped / MIN_HA) / Math.log(MAX_HA / MIN_HA) * SLIDER_MAX);
                  };
                  const minSlider = toSlider(options.hectareRange[0]);
                  const maxSlider = toSlider(options.hectareRange[1]);
                  return (
                    <div className="space-y-2">
                    <DualSlider
                      value={[minSlider, maxSlider]}
                      min={0}
                      max={SLIDER_MAX}
                      step={1}
                      onChange={([sMin, sMax]) => {
                        const newMin = toHa(Math.min(sMin, sMax));
                        const newMax = toHa(Math.max(sMin, sMax));
                        setOptions(prev => ({ ...prev, hectareRange: [newMin, newMax] }));
                      }}
                    />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{formatNumber(MIN_HA, { smartMaxDecimals: true })} ha</span>
                        <span>{formatNumber(MAX_HA)} ha</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

            {/* Altitude Range (normalized 0-1) */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Altitude Range (normalized, optional)
                </label>
                {(() => {
                  const MIN_N = 0;
                  const MAX_N = 1;
                  const STEP = 0.01;
                  const currentMin = options.altitudeRange?.[0] ?? MIN_N;
                  const currentMax = options.altitudeRange?.[1] ?? MAX_N;
                  return (
                    <div className="space-y-2">
                    <DualSlider
                      value={[currentMin, currentMax]}
                      min={MIN_N}
                      max={MAX_N}
                      step={STEP}
                      onChange={([minVal, maxVal]) => {
                        const newMin = Math.min(minVal, maxVal);
                        const newMax = Math.max(minVal, maxVal);
                        setOptions(prev => ({ ...prev, altitudeRange: [newMin, newMax] }));
                      }}
                    />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{Math.round((currentMin) * 100)}%</span>
                        <span>{Math.round((currentMax) * 100)}%</span>
                      </div>
                      <p className="text-xs text-gray-400">Normalized by region. Higher is always better.</p>
                    </div>
                  );
                })()}
              </div>

              {/* Grape Variety Selection */}
              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Grape Variety Preferences (optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {GRAPE_VARIETIES.map((grape) => (
                    <label key={grape} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.grapeVarieties?.includes(grape) || false}
                        onChange={(e) => {
                          const current = options.grapeVarieties || [];
                          const newGrapes = e.target.checked
                            ? [...current, grape]
                            : current.filter(g => g !== grape);
                          setOptions(prev => ({ ...prev, grapeVarieties: newGrapes }));
                        }}
                        className="mr-2 h-4 w-4 rounded border-gray-500 bg-gray-700 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-white">{grape}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Select grape varieties to filter regions by suitability. Higher suitability requirements will exclude more regions and increase cost.
                </p>
              </div>

              {/* Min Grape Suitability */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Min Grape Suitability ({Math.round((options.minGrapeSuitability || 0) * 100)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={options.minGrapeSuitability || 0}
                  onChange={(e) => setOptions(prev => ({ ...prev, minGrapeSuitability: Number(e.target.value) }))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Any Suitability</span>
                  <span>Perfect Match</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Higher values ensure better grape variety compatibility but limit options.
                </p>
              </div>

              {/* Aspect Preferences */}
              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Aspect Preferences (optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ASPECTS.map((aspect) => (
                    <label key={aspect} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.aspectPreferences?.includes(aspect) || false}
                        onChange={(e) => {
                          const current = options.aspectPreferences || [];
                          const newAspects = e.target.checked
                            ? [...current, aspect]
                            : current.filter(a => a !== aspect);
                          setOptions(prev => ({ ...prev, aspectPreferences: newAspects }));
                        }}
                        className="mr-2 h-4 w-4 rounded border-gray-500 bg-gray-700 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-white">{aspect}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Soil Type Preferences */}
              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Soil Type Preferences (optional)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {[...ALL_SOIL_TYPES].sort().map((soil) => (
                    <label key={soil} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.soilTypes?.includes(soil) || false}
                        onChange={(e) => {
                          const current = options.soilTypes || [];
                          const newSoils = e.target.checked
                            ? [...current, soil]
                            : current.filter(s => s !== soil);
                          setOptions(prev => ({ ...prev, soilTypes: newSoils }));
                        }}
                        className="mr-2 h-4 w-4 rounded border-gray-500 bg-gray-700 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-white">{soil}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Preview & Estimates */}
            <div className="space-y-6">
              {/* Number of Options */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Number of Properties ({formatNumber(options.numberOfOptions)})
                </label>
                <input
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  value={options.numberOfOptions}
                  onChange={(e) => setOptions(prev => ({ ...prev, numberOfOptions: Number(e.target.value) }))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{formatNumber(3)}</span>
                  <span>{formatNumber(10)}</span>
                </div>
              </div>

              {/* Search Preview */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Expected Results</h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                  {/* Property Count */}
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Properties to Find</h4>
                    <div className="bg-blue-600 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-white">{options.numberOfOptions}</div>
                      <div className="text-xs text-blue-100 mt-1">properties will be generated</div>
                    </div>
                  </div>

                  {/* Accessible Regions */}
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Accessible Regions</h4>
                    <div className="bg-gray-700 rounded-lg p-3">
                      <div className="text-lg font-bold text-white text-center">{previewStats.accessibleRegions}</div>
                      <div className="text-xs text-gray-300 mt-1 text-center">
                        {options.regions.length > 0 ? 'Selected regions' : 'All accessible regions'}
                      </div>
                    </div>
                  </div>

                  {/* Search Probability */}
                  {(() => {
                    const totalProb01 = Math.min(1, Math.max(0, previewStats.totalProbability || 0));
                    const percentLabel = formatNumber(totalProb01 * 100, { smartMaxDecimals: true });
                    const isGuaranteed = totalProb01 >= 0.999;
                    
                    // Calculate probability of finding at least 1 property
                    const atLeastOneProb = 1 - Math.pow(1 - totalProb01, options.numberOfOptions);
                    const atLeastOnePercent = formatNumber(atLeastOneProb * 100, { smartMaxDecimals: true });
                    
                    return (
                      <div>
                        <h4 className="text-sm font-medium text-white mb-2">Search Probability</h4>
                        <div className={`${isGuaranteed ? 'bg-green-700' : 'bg-red-600'} rounded-lg p-3`}>
                          <div className="text-lg font-bold text-white text-center">
                            {previewStats.selectedRegions} regions selected
                          </div>
                          {isGuaranteed ? (
                            <>
                              <div className="text-xs text-green-100 mt-1 text-center">
                                100% chance to find {options.numberOfOptions} propert{options.numberOfOptions !== 1 ? 'ies' : 'y'}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-xs text-red-100 mt-1 text-center">
                                {percentLabel}% chance per property
                              </div>
                              <div className="text-[11px] text-red-100 mt-1 text-center">
                                May find 0-{options.numberOfOptions} propert{options.numberOfOptions !== 1 ? 'ies' : 'y'}
                              </div>
                              <div className="text-[10px] text-red-200 mt-1 text-center">
                                {atLeastOnePercent}% to find at least 1 property
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Search Estimates */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Search Estimates</h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Search Cost:</span>
                    <span className="text-white font-medium">{formatCurrency(previewStats.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Work Required:</span>
                    <span className="text-white font-medium">{Math.round(previewStats.totalWork)} units</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Estimated Time:</span>
                    <span className="text-white font-medium">{previewStats.timeEstimate}</span>
                  </div>
                </div>
              </div>

              {/* Search Criteria Summary */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Search Criteria</h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Properties:</span>
                    <span className="text-white">{formatNumber(options.numberOfOptions)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Regions:</span>
                    <span className="text-white">{options.regions.length > 0 ? `${formatNumber(redistributedProbabilities.length)} accessible` : 'All accessible'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Hectares:</span>
                    <span className="text-white">{formatNumber(options.hectareRange[0])}-{formatNumber(options.hectareRange[1])}</span>
                  </div>
                  {options.altitudeRange && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Altitude:</span>
                      <span className="text-white">{formatNumber(options.altitudeRange[0])}-{formatNumber(options.altitudeRange[1])}m</span>
                    </div>
                  )}
                  {options.aspectPreferences && options.aspectPreferences.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Aspects:</span>
                      <span className="text-white">{options.aspectPreferences.length}</span>
                    </div>
                  )}
                  {options.soilTypes && options.soilTypes.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Soil Types:</span>
                      <span className="text-white">{options.soilTypes.length}</span>
                    </div>
                  )}
                  {options.grapeVarieties && options.grapeVarieties.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Grape Varieties:</span>
                      <span className="text-white">{options.grapeVarieties.join(', ')}</span>
                    </div>
                  )}
                  {options.minGrapeSuitability && options.minGrapeSuitability > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Min Suitability:</span>
                      <span className="text-white">{Math.round(options.minGrapeSuitability * 100)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Start Search ({formatCurrency(previewStats.totalCost)})
          </Button>
        </div>
      </div>
    </div>
  );
};
