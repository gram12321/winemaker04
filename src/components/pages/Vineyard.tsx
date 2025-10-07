
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLoadingState, useGameStateWithData } from '@/hooks';
import { getAllVineyards, purchaseVineyard, getGameState, getAspectRating, getAltitudeRating, getAllActivities } from '@/lib/services';
import { calculateVineyardYield } from '@/lib/services/vineyard/vineyardManager';
import { Vineyard as VineyardType, WorkCategory } from '@/lib/types/types';
import { LandBuyingModal, PlantingOptionsModal, HarvestOptionsModal, QualityFactorsBreakdown, VineyardModal } from '../ui';
import { formatCurrency, formatNumber, getBadgeColorClasses } from '@/lib/utils/utils';
import { generateVineyardPurchaseOptions, VineyardPurchaseOption } from '@/lib/services/vineyard/vinyardBuyingService';
import { getCountryFlag } from '@/lib/utils';



const Vineyard: React.FC = () => {
  const { withLoading } = useLoadingState();
  const [showPlantDialog, setShowPlantDialog] = useState(false);
  const [showHarvestDialog, setShowHarvestDialog] = useState(false);
  const [showBuyLandModal, setShowBuyLandModal] = useState(false);
  const [showVineyardModal, setShowVineyardModal] = useState(false);
  const [selectedVineyard, setSelectedVineyard] = useState<VineyardType | null>(null);
  const [landPurchaseOptions, setLandPurchaseOptions] = useState<VineyardPurchaseOption[]>([]);
  const [expectedYields, setExpectedYields] = useState<Record<string, number>>({});
  const vineyards = useGameStateWithData(getAllVineyards, []);
  const activities = useGameStateWithData(getAllActivities, []);
  const gameState = useGameStateWithData(() => Promise.resolve(getGameState()), { money: 0 });

  // Get vineyards with active activities from game state
  const vineyardsWithActiveActivities = useMemo(() => {
    const activePlantingVineyards = new Set<string>();
    const activeHarvestingVineyards = new Set<string>();
    
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
        }
      });
    
    return { 
      planting: activePlantingVineyards,
      harvesting: activeHarvestingVineyards
    };
  }, [activities]);

  // Calculate expected/remaining yields when vineyards or activities change
  useEffect(() => {
    const calculateYields = () => {
      const yields: Record<string, number> = {};
      for (const vineyard of vineyards) {
        if (!vineyard.grape) continue;

        const totalYield = calculateVineyardYield(vineyard);
        // If harvesting is active for this vineyard, show remaining yield
        const activeHarvest = activities.find(
          (a) => a.category === WorkCategory.HARVESTING && a.status === 'active' && a.targetId === vineyard.id
        );
        if (activeHarvest) {
          const harvestedSoFar = activeHarvest.params?.harvestedSoFar || 0;
          yields[vineyard.id] = Math.max(0, Math.round(totalYield - harvestedSoFar));
        } else {
          yields[vineyard.id] = Math.round(totalYield);
        }
      }
      setExpectedYields(yields);
    };

    calculateYields();
  }, [vineyards, activities]);

  const handleShowHarvestDialog = useCallback((vineyard: VineyardType) => {
    setSelectedVineyard(vineyard);
    setShowHarvestDialog(true);
  }, []);



  const handleShowBuyLandModal = useCallback(() => {
    const options = generateVineyardPurchaseOptions(5, vineyards);
    setLandPurchaseOptions(options);
    setShowBuyLandModal(true);
  }, [vineyards]);

  const handlePurchaseVineyard = useCallback((option: VineyardPurchaseOption) => withLoading(async () => {
    await purchaseVineyard(option);
  }), [withLoading]);

  const handleRowClick = useCallback((vineyard: VineyardType) => {
    setSelectedVineyard(vineyard);
    setShowVineyardModal(true);
  }, []);

  const getActionButtons = useCallback((vineyard: VineyardType) => {
    if (!vineyard.grape) {
      const hasActivePlanting = vineyardsWithActiveActivities.planting.has(vineyard.id);
      return (
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
      );
    }

    switch (vineyard.status) {
      case 'Planted':
        return (
          <div className="text-xs text-gray-500">
            Planted (will grow in Spring)
          </div>
        );
      case 'Growing':
        const hasActiveHarvesting = vineyardsWithActiveActivities.harvesting.has(vineyard.id);
        return (
          <button 
            onClick={(e) => { e.stopPropagation(); handleShowHarvestDialog(vineyard); }}
            disabled={hasActiveHarvesting}
            className={`px-2 py-1 rounded text-xs font-medium ${
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
        );
      case 'Harvested':
        return (
          <div className="text-xs text-gray-500">
            Harvested (will go dormant in Winter)
          </div>
        );
      case 'Dormant':
        return (
          <div className="text-xs text-gray-500">
            Dormant
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
      
      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
              onClick={handleShowBuyLandModal}
              className="bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded"
            >
              Buy Land
            </button>
          </div>
        </div>
      </div>

      {/* Vineyards Table - Desktop */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Vineyard</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Location</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Size & Value</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Characteristics</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Vine Info</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Status & Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vineyards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No vineyards yet. Create your first vineyard to get started!
                  </td>
                </tr>
              ) : (
                vineyards.map((vineyard) => (
                  <tr key={vineyard.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleRowClick(vineyard)}>
                    {/* Vineyard Name and Grape */}
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
                    </td>

                    {/* Location */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{vineyard.region}</div>
                      <div className="text-xs text-gray-500 flex items-center">
                        <span className={`flag-icon flag-icon-${getCountryFlag(vineyard.country)} mr-1`}></span>
                        {vineyard.country}
                      </div>
                    </td>

                    {/* Size & Value */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{vineyard.hectares} ha</div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(vineyard.landValue)}/ha
                      </div>
                      <div className="text-xs font-medium text-blue-600">
                        Total: {formatCurrency(vineyard.vineyardTotalValue)}
                      </div>
                    </td>

                    {/* Characteristics */}
                    <td className="px-4 py-4">
                      <div className="text-xs text-gray-900">
                        <div className="mb-1">
                          <span className="font-medium">Soil:</span> {vineyard.soil.join(', ')}
                        </div>
                        <div className="mb-1 flex items-center">
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

                    {/* Vine Info */}
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
                      {/* Ripeness Progress Bar */}
                      {vineyard.grape && (
                        <div className="mt-2">
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
                          
                          {/* Vine Yield Progress Bar */}
                          <div className="mt-2">
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
                          
                          {/* Expected/Remaining Yield */}
                          <div className="mt-2 text-xs">
                            <div className="text-gray-500">
                              {(vineyardsWithActiveActivities.harvesting.has(vineyard.id) ? 'Remaining Yield' : 'Expected Yield')}: <span className="font-medium text-green-600">
                                {formatNumber(expectedYields[vineyard.id] || 0, { decimals: 0 })} kg
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
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
            <div key={vineyard.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 border-b">
                <div className="flex justify-between items-start mb-2">
                  <div>
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
                
                {/* Location */}
                <div className="flex items-center text-sm text-gray-600 mt-2">
                  <span className={`flag-icon flag-icon-${getCountryFlag(vineyard.country)} mr-2`}></span>
                  {vineyard.region}, {vineyard.country}
                </div>
              </div>
              
              {/* Card Body */}
              <div className="p-4 space-y-4">
                {/* Size & Value Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Size</div>
                    <div className="text-lg font-bold text-gray-900">{vineyard.hectares} ha</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Total Value</div>
                    <div className="text-lg font-bold text-blue-600">{formatCurrency(vineyard.vineyardTotalValue)}</div>
                  </div>
                </div>
                
                {/* Characteristics Section */}
                <div className="border-t pt-3">
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

                {/* Quality Factors Section */}
                <div className="border-t pt-3">
                  <QualityFactorsBreakdown
                    vineyard={vineyard}
                    showFactorDetails={false}
                    className="bg-gray-50 p-3 rounded-lg"
                  />
                </div>
                
                {/* Vine Info Section */}
                {vineyard.grape && (
                  <div className="border-t pt-3">
                    <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Vine Information</div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Age:</span>
                        <span className="text-gray-900">
                          {vineyard.vineAge === null ? (
                            <span className="text-gray-400">Not planted</span>
                          ) : vineyard.vineAge === 0 ? (
                            <span className="text-green-600">Newly planted</span>
                          ) : (
                            <span>{vineyard.vineAge} years</span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Density:</span>
                        <span className="text-gray-900">
                          {vineyard.density > 0 ? `${formatNumber(vineyard.density, { decimals: 0 })} vines/ha` : 'Not planted'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Prestige:</span>
                        <span className="text-gray-900">
                          {formatNumber(vineyard.vineyardPrestige ?? 0, { decimals: 2, forceDecimals: true })}
                        </span>
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
                      
                      {/* Expected/Remaining Yield */}
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-600 mb-1">
                          {vineyardsWithActiveActivities.harvesting.has(vineyard.id) ? 'Remaining Yield' : 'Expected Yield'}
                        </div>
                        <div className="text-lg font-bold text-green-600">
                          {formatNumber(expectedYields[vineyard.id] || 0, { decimals: 0 })} kg
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Card Footer - Actions */}
              <div className="bg-gray-50 px-4 py-3 border-t">
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

      <LandBuyingModal
        isOpen={showBuyLandModal}
        onClose={() => setShowBuyLandModal(false)}
        options={landPurchaseOptions}
        onPurchase={handlePurchaseVineyard}
        currentMoney={gameState.money || 0}
      />

      <VineyardModal
        isOpen={showVineyardModal}
        onClose={() => setShowVineyardModal(false)}
        vineyard={selectedVineyard}
      />
    </div>
  );
};

export default Vineyard;
