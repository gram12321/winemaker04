
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLoadingState, useGameStateWithData } from '@/hooks';
import { harvestVineyard, getAllVineyards, purchaseVineyard, getGameState, getAspectRating, getAltitudeRating, getAllActivities } from '@/lib/services';
import { calculateVineyardYield } from '@/lib/services/wine/vineyardManager';
import { Vineyard as VineyardType, WorkCategory } from '@/lib/types/types';
import { LandBuyingModal, PlantingOptionsModal } from '../ui';
import { formatCurrency, formatNumber, getBadgeColorClasses } from '@/lib/utils/utils';
import { generateVineyardPurchaseOptions, VineyardPurchaseOption } from '@/lib/services/wine/landBuyingService';
import { getCountryFlag } from '@/lib/utils';



const Vineyard: React.FC = () => {
  const { withLoading } = useLoadingState();
  const [showPlantDialog, setShowPlantDialog] = useState(false);
  const [showBuyLandModal, setShowBuyLandModal] = useState(false);
  const [selectedVineyard, setSelectedVineyard] = useState<VineyardType | null>(null);
  const [landPurchaseOptions, setLandPurchaseOptions] = useState<VineyardPurchaseOption[]>([]);
  const [expectedYields, setExpectedYields] = useState<Record<string, number>>({});
  const vineyards = useGameStateWithData(getAllVineyards, []);
  const activities = useGameStateWithData(getAllActivities, []);
  const gameState = useGameStateWithData(() => Promise.resolve(getGameState()), { money: 0 });

  // Get vineyards with active planting activities from game state
  const vineyardsWithActivePlanting = useMemo(() => {
    const activePlantingVineyards = new Set<string>();
    
    activities
      .filter(activity => 
        activity.status === 'active' && 
        activity.category === WorkCategory.PLANTING &&
        activity.targetId
      )
      .forEach(activity => {
        activePlantingVineyards.add(activity.targetId!);
      });
    
    return activePlantingVineyards;
  }, [activities]);

  // Calculate expected yields when vineyards change
  useEffect(() => {
    const calculateYields = () => {
      const yields: Record<string, number> = {};
      for (const vineyard of vineyards) {
        if (vineyard.grape) {
          yields[vineyard.id] = calculateVineyardYield(vineyard);
        }
      }
      setExpectedYields(yields);
    };
    
    calculateYields();
  }, [vineyards]);

  const handleHarvestVineyard = useCallback((vineyard: VineyardType) => withLoading(async () => {
    const result = await harvestVineyard(vineyard.id);
    if (result.success && result.quantity && vineyard.grape) {
      const ripenessPercent = Math.round((vineyard.ripeness || 0) * 100);
      const message = ripenessPercent < 30 
        ? `Harvested ${result.quantity} kg of ${vineyard.grape} grapes (${ripenessPercent}% ripeness - low yield). Wine batch created in winery.`
        : `Harvested ${result.quantity} kg of ${vineyard.grape} grapes! Wine batch created in winery.`;
      alert(message);
    }
  }), [withLoading]);



  const handleShowBuyLandModal = useCallback(() => {
    const options = generateVineyardPurchaseOptions(5, vineyards);
    setLandPurchaseOptions(options);
    setShowBuyLandModal(true);
  }, [vineyards]);

  const handlePurchaseVineyard = useCallback((option: VineyardPurchaseOption) => withLoading(async () => {
    await purchaseVineyard(option);
  }), [withLoading]);

  const getActionButtons = useCallback((vineyard: VineyardType) => {
    if (!vineyard.grape) {
      const hasActivePlanting = vineyardsWithActivePlanting.has(vineyard.id);
      return (
        <button 
          onClick={() => {
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
        return (
          <button 
            onClick={() => handleHarvestVineyard(vineyard)}
            className={`px-2 py-1 rounded text-xs font-medium ${
              (vineyard.ripeness || 0) < 0.3 
                ? 'bg-gray-400 hover:bg-gray-500 text-white' 
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
            title={(vineyard.ripeness || 0) < 0.3 ? 'Low ripeness - will yield very little' : 'Ready to harvest'}
          >
            Harvest
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
        return null;
    }
  }, [handleHarvestVineyard, vineyardsWithActivePlanting]);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">{vineyards.length}</div>
          <div className="text-sm text-gray-500">Total Vineyards</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">{totalHectares} ha</div>
          <div className="text-sm text-gray-500">Total Area</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalValue)}</div>
          <div className="text-sm text-gray-500">Total Value</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-purple-600">{activeVineyards}/{plantedVineyards}</div>
          <div className="text-sm text-gray-500">Active/Planted</div>
        </div>
      </div>
      
      {/* Vineyard Image */}
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1516594798947-e65505dbb29d?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-4">
          <div className="flex justify-between items-end">
            <h3 className="text-white text-xl font-semibold">Vineyard Portfolio</h3>
            <button 
              onClick={handleShowBuyLandModal}
              className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded"
            >
              Buy Land
            </button>
          </div>
        </div>
      </div>

      {/* Vineyards Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vineyard</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size & Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Characteristics</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vine Info</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status & Actions</th>
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
                  <tr key={vineyard.id} className="hover:bg-gray-50">
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
                          {/* Expected Yield */}
                          <div className="mt-2 text-xs">
                            <div className="text-gray-500">
                              Expected Yield: <span className="font-medium text-green-600">
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

      <PlantingOptionsModal
        isOpen={showPlantDialog}
        vineyard={selectedVineyard}
        onClose={() => {
          setShowPlantDialog(false);
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
    </div>
  );
};

export default Vineyard;
