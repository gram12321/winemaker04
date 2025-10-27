
import React, { useState, useMemo, useCallback } from 'react';
import { useLoadingState, useGameStateWithData } from '@/hooks';
import { getAllVineyards, getGameState, getAspectRating, getAltitudeRating, getAllActivities } from '@/lib/services';
import { Vineyard as VineyardType, WorkCategory } from '@/lib/types/types';
import { LandSearchOptionsModal, LandSearchResultsModal, PlantingOptionsModal, HarvestOptionsModal, VineyardModal } from '../ui';
import ClearingOptionsModal from '../ui/modals/activitymodals/ClearingOptionsModal';
import { FeatureDisplay } from '../ui/components/FeatureDisplay';
import HealthTooltip from '../ui/vineyard/HealthTooltip';
import { formatCurrency, formatNumber, getBadgeColorClasses } from '@/lib/utils/utils';
import { getFlagIcon } from '@/lib/utils';
import { clearPendingLandSearchResults, calculateVineyardExpectedYield } from '@/lib/services';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/shadCN/tooltip';

// Component for expected yield tooltip display
const ExpectedYieldTooltip: React.FC<{ vineyard: VineyardType }> = ({ vineyard }) => {
  if (!vineyard.grape) {
    return (
      <div className="text-xs text-gray-500">
        Expected Yield: <span className="font-medium">0 kg</span>
      </div>
    );
  }

  const yieldBreakdown = calculateVineyardExpectedYield(vineyard);

  if (!yieldBreakdown) {
    return (
      <div className="text-xs text-gray-500">
        Expected Yield: <span className="font-medium">Calculating...</span>
      </div>
    );
  }

  const { totalYield, totalVines, breakdown: details } = yieldBreakdown;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="text-xs text-gray-500 cursor-help hover:text-blue-600 transition-colors">
            Expected Yield: <span className="font-medium">{formatNumber(totalYield)} kg</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-sm">
          <div className="text-xs space-y-2">
            <div className="font-medium">Expected Yield Calculation</div>
            <div className="border-t pt-2 space-y-1">
              <div className="font-mono">
                {Math.round(totalVines)} vines × {yieldBreakdown.baseYieldPerVine} kg/vine × {formatNumber(details.finalMultiplier, { decimals: 3, smartDecimals: true })}
              </div>
              <div className="text-muted-foreground mt-1">= {formatNumber(totalYield)} kg</div>
            </div>
            <div className="border-t pt-2 space-y-1">
              <div className="text-muted-foreground text-xs">Combined Multiplier Breakdown:</div>
              <div>Grape Suitability: {formatNumber(details.grapeSuitability * 100, { decimals: 1 })}%</div>
              <div>Natural Yield: {formatNumber(details.naturalYield * 100, { decimals: 1 })}%</div>
              <div>Ripeness: {formatNumber(details.ripeness * 100, { decimals: 1 })}%</div>
              <div>Vine Yield: {formatNumber(details.vineYield * 100, { decimals: 1 })}%</div>
              <div>Health: {formatNumber(details.health * 100, { decimals: 1 })}%</div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  const [selectedVineyard, setSelectedVineyard] = useState<VineyardType | null>(null);
  const vineyards = useGameStateWithData(getAllVineyards, []);
  const activities = useGameStateWithData(getAllActivities, []);
  const gameState = useGameStateWithData(() => Promise.resolve(getGameState()), { money: 0 });

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

  const getActionButtons = useCallback((vineyard: VineyardType) => {
    if (!vineyard.grape) {
      const hasActivePlanting = vineyardsWithActiveActivities.planting.has(vineyard.id);
      const hasActiveClearing = vineyardsWithActiveActivities.clearing.has(vineyard.id);
      return (
        <div className="flex flex-col space-y-1">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedVineyard(vineyard);
              setShowPlantDialog(true);
            }}
            disabled={hasActivePlanting}
            className={`px-2 py-1 rounded text-xs font-medium ${
              hasActivePlanting 
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {hasActivePlanting ? 'Planting...' : 'Plant'}
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleShowClearingModal(vineyard);
            }}
            disabled={hasActiveClearing}
            className={`px-2 py-1 rounded text-xs font-medium ${
              hasActiveClearing 
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
            title={hasActiveClearing ? 'Clearing in progress...' : 'Clear vegetation and debris to improve vineyard health'}
          >
            {hasActiveClearing ? 'Clearing...' : 'Clear'}
          </button>
        </div>
      );
    }

    switch (vineyard.status) {
      case 'Planting':
        // Show that planting is in progress
        const plantingActivity = activities.find(
          (a) => a.category === WorkCategory.PLANTING && a.status === 'active' && a.targetId === vineyard.id
        );
        const targetDensity = plantingActivity?.params?.density || vineyard.density || 1;
        const currentDensity = vineyard.density || 0;
        const plantingProgress = targetDensity > 0 ? Math.round((currentDensity / targetDensity) * 100) : 0;
        
        return (
          <div className="space-y-1">
            <div className="text-xs text-emerald-600 font-medium">
              Planting in progress... ({plantingProgress}% complete)
            </div>
            <div className="text-xs text-gray-500">
              {currentDensity}/{targetDensity} vines/ha
            </div>
          </div>
        );
      case 'Planted':
        const hasActiveClearingPlanted = vineyardsWithActiveActivities.clearing.has(vineyard.id);
        return (
          <div className="space-y-1">
            <div className="text-xs text-gray-500">
              Planted (will grow in Spring)
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleShowClearingModal(vineyard);
              }}
              disabled={hasActiveClearingPlanted}
              className={`px-2 py-1 rounded text-xs font-medium ${
                hasActiveClearingPlanted 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
              title={hasActiveClearingPlanted ? 'Clearing in progress...' : 'Clear vegetation and debris to improve vineyard health'}
            >
              {hasActiveClearingPlanted ? 'Clearing...' : 'Clear'}
            </button>
          </div>
        );
      case 'Growing':
        const hasActiveHarvesting = vineyardsWithActiveActivities.harvesting.has(vineyard.id);
        const hasActiveClearingGrowing = vineyardsWithActiveActivities.clearing.has(vineyard.id);
        return (
          <div className="space-y-1">
            <button 
              onClick={(e) => { e.stopPropagation(); handleShowHarvestDialog(vineyard); }}
              disabled={hasActiveHarvesting}
              className={`w-full px-2 py-1 rounded text-xs font-medium ${
                hasActiveHarvesting 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : (vineyard.ripeness || 0) < 0.3 
                    ? 'bg-gray-400 hover:bg-gray-500 text-white' 
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
              title={
                hasActiveHarvesting 
                  ? 'Harvesting in progress...'
                  : (vineyard.ripeness || 0) < 0.3 
                    ? 'Low ripeness - will yield very little' 
                    : 'Ready to harvest'
              }
            >
              {hasActiveHarvesting ? 'Harvesting...' : 'Harvest'}
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleShowClearingModal(vineyard);
              }}
              disabled={hasActiveClearingGrowing}
              className={`w-full px-2 py-1 rounded text-xs font-medium ${
                hasActiveClearingGrowing 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
              title={hasActiveClearingGrowing ? 'Clearing in progress...' : 'Clear vegetation and debris to improve vineyard health'}
            >
              {hasActiveClearingGrowing ? 'Clearing...' : 'Clear'}
            </button>
          </div>
        );
      case 'Harvested':
        const hasActiveClearingHarvested = vineyardsWithActiveActivities.clearing.has(vineyard.id);
        return (
          <div className="space-y-1">
            <div className="text-xs text-gray-500">
              Harvested (will go dormant in Winter)
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleShowClearingModal(vineyard);
              }}
              disabled={hasActiveClearingHarvested}
              className={`px-2 py-1 rounded text-xs font-medium ${
                hasActiveClearingHarvested 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
              title={hasActiveClearingHarvested ? 'Clearing in progress...' : 'Clear vegetation and debris to improve vineyard health'}
            >
              {hasActiveClearingHarvested ? 'Clearing...' : 'Clear'}
            </button>
          </div>
        );
      case 'Dormant':
        const hasActiveClearingDormant = vineyardsWithActiveActivities.clearing.has(vineyard.id);
        return (
          <div className="space-y-1">
            <div className="text-xs text-gray-500">
              Dormant
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleShowClearingModal(vineyard);
              }}
              disabled={hasActiveClearingDormant}
              className={`px-2 py-1 rounded text-xs font-medium ${
                hasActiveClearingDormant 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
              title={hasActiveClearingDormant ? 'Clearing in progress...' : 'Clear vegetation and debris to improve vineyard health'}
            >
              {hasActiveClearingDormant ? 'Clearing...' : 'Clear'}
            </button>
          </div>
        );
      default:
        // Handle "Harvesting (X%)" status
        if (typeof vineyard.status === 'string' && vineyard.status.startsWith('Harvesting')) {
          return (
            <div className="text-xs text-purple-600 font-medium">
              {vineyard.status}
            </div>
          );
        }
        return null;
    }
  }, [handleShowHarvestDialog, vineyardsWithActiveActivities]);

  // Memoize summary statistics
  const { totalHectares, totalValue, plantedVineyards, activeVineyards } = useMemo(() => {
    const totalHectares = vineyards.reduce((sum, v) => sum + v.hectares, 0);
    const totalValue = vineyards.reduce((sum, v) => sum + v.vineyardTotalValue, 0);
    const plantedVineyards = vineyards.filter(v => v.grape).length;
    const activeVineyards = vineyards.filter(v => v.status === 'Growing').length;
    return { totalHectares, totalValue, plantedVineyards, activeVineyards };
  }, [vineyards]);

  // Status color mapping
  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'Barren': 'text-gray-500',
      'Planting': 'text-emerald-500',
      'Planted': 'text-green-500',
      'Growing': 'text-blue-500',
      'Harvested': 'text-purple-500',
      'Dormant': 'text-orange-500'
    };
    return statusColors[status] || 'text-gray-500';
  };


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
          <div className="text-base font-bold text-blue-600">{formatCurrency(totalValue)}</div>
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
          <div className="text-base font-bold text-blue-600">{formatCurrency(totalValue)}</div>
          <div className="text-xs text-gray-500">Total Value</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-purple-600">{activeVineyards}/{plantedVineyards}</div>
          <div className="text-xs text-gray-500">Active/Planted</div>
        </div>
      </div>

      {/* Vineyards Table - Desktop */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
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
                    </td>

                    {/* Details & Characteristics */}
                    <td className="px-4 py-4">
                      <div className="text-xs text-gray-900 space-y-1">
                        <div>
                          <span className="font-medium">Size:</span> {vineyard.hectares} ha | 
                          <span className="font-medium ml-1">Value:</span> {formatCurrency(vineyard.vineyardTotalValue)}
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
                              <span className={`ml-1 px-1 py-0.5 rounded text-xs ${colors.text} ${colors.bg}`}>
                                {formatNumber(rating, { decimals: 2, forceDecimals: true })}
                              </span>
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
                              <span className={`ml-1 px-1 py-0.5 rounded text-xs ${colors.text} ${colors.bg}`}>
                                {formatNumber(rating, { decimals: 2, forceDecimals: true })}
                              </span>
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
                        Prestige: {formatNumber(vineyard.vineyardPrestige ?? 0, { decimals: 2, forceDecimals: true })}
                      </div>
                      <div className="text-xs text-gray-500">
                        Density: {vineyard.density > 0 ? `${formatNumber(vineyard.density, { decimals: 0 })} vines/ha` : 'Not planted'}
                      </div>
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        {/* Vineyard Health Progress Bar - Always show */}
                        <div>
                          <div className="text-xs text-gray-500 mb-1">
                            Health: {Math.round((vineyard.vineyardHealth || 1.0) * 100)}%
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 relative group cursor-help">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                (vineyard.vineyardHealth || 1.0) < 0.3 ? 'bg-red-500' :
                                (vineyard.vineyardHealth || 1.0) < 0.6 ? 'bg-amber-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(100, (vineyard.vineyardHealth || 1.0) * 100)}%` }}
                            ></div>
                            {/* Health Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-64">
                              <HealthTooltip vineyard={vineyard} />
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </div>

                        {vineyard.grape ? (
                          <>
                            {/* Ripeness Progress Bar */}
                            <div>
                              <div className="text-xs text-gray-500 mb-1">
                                Ripeness: {Math.round((vineyard.ripeness || 0) * 100)}%
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    (vineyard.ripeness || 0) < 0.3 ? 'bg-red-400' :
                                    (vineyard.ripeness || 0) < 0.7 ? 'bg-amber-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(100, (vineyard.ripeness || 0) * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            {/* Vine Yield Progress Bar */}
                            <div>
                              <div className="text-xs text-gray-500 mb-1">
                                Vine Yield: {Math.round((vineyard.vineYield || 0.02) * 100)}%
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    (vineyard.vineYield || 0.02) < 0.3 ? 'bg-red-400' :
                                    (vineyard.vineYield || 0.02) < 0.7 ? 'bg-amber-500' : 
                                    (vineyard.vineYield || 0.02) < 1.0 ? 'bg-green-500' : 'bg-purple-500'
                                  }`}
                                  style={{ width: `${Math.min(100, (vineyard.vineYield || 0.02) * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            {/* Expected Yield Tooltip */}
                            <div className="text-xs">
                              <ExpectedYieldTooltip vineyard={vineyard} />
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-gray-400">No grape planted</div>
                        )}
                      </div>
                    </td>

                    {/* Status & Actions */}
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <div className={`text-sm font-medium ${getStatusColor(vineyard.status)}`}>
                          {vineyard.status}
                        </div>
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
                  <div className={`text-sm font-medium ${getStatusColor(vineyard.status)}`}>
                    {vineyard.status}
                  </div>
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
                      <div className="font-bold text-blue-600">{formatCurrency(vineyard.vineyardTotalValue)}</div>
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
                                <span className={`px-2 py-0.5 rounded text-xs ${colors.text} ${colors.bg}`}>
                                  {formatNumber(rating, { decimals: 2, forceDecimals: true })}
                                </span>
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
                                <span className={`px-2 py-0.5 rounded text-xs ${colors.text} ${colors.bg}`}>
                                  {formatNumber(rating, { decimals: 2, forceDecimals: true })}
                                </span>
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
                          <span className="text-gray-900">
                            {formatNumber(vineyard.vineyardPrestige ?? 0, { decimals: 2, forceDecimals: true })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Density:</span>
                          <span className="text-gray-900">
                            {vineyard.density > 0 ? `${formatNumber(vineyard.density, { decimals: 0 })} vines/ha` : 'Not planted'}
                          </span>
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
                              <span>{Math.round((vineyard.vineyardHealth || 1.0) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 relative group cursor-help">
                              <div 
                                className={`h-3 rounded-full transition-all duration-300 ${
                                  (vineyard.vineyardHealth || 1.0) < 0.3 ? 'bg-red-500' :
                                  (vineyard.vineyardHealth || 1.0) < 0.6 ? 'bg-amber-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, (vineyard.vineyardHealth || 1.0) * 100)}%` }}
                              ></div>
                              {/* Health Tooltip */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-64">
                                <HealthTooltip vineyard={vineyard} />
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Ripeness Progress */}
                          <div>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Ripeness</span>
                              <span>{Math.round((vineyard.ripeness || 0) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className={`h-3 rounded-full transition-all duration-300 ${
                                  (vineyard.ripeness || 0) < 0.3 ? 'bg-red-400' :
                                  (vineyard.ripeness || 0) < 0.7 ? 'bg-amber-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, (vineyard.ripeness || 0) * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          {/* Vine Yield Progress */}
                          <div>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Vine Yield</span>
                              <span>{Math.round((vineyard.vineYield || 0.02) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className={`h-3 rounded-full transition-all duration-300 ${
                                  (vineyard.vineYield || 0.02) < 0.3 ? 'bg-red-400' :
                                  (vineyard.vineYield || 0.02) < 0.7 ? 'bg-amber-500' : 
                                  (vineyard.vineYield || 0.02) < 1.0 ? 'bg-green-500' : 'bg-purple-500'
                                }`}
                                style={{ width: `${Math.min(100, (vineyard.vineYield || 0.02) * 100)}%` }}
                              ></div>
                            </div>
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
    </div>
  );
};

export default Vineyard;
