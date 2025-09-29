
import React, { useMemo, useCallback, useState } from 'react';
import { useLoadingState, useGameStateWithData, useWineBatchBalance, useFormattedBalance, useBalanceQuality } from '@/hooks';
import { getAllWineBatches, getAllVineyards, formatCompletedWineName, startFermentation, stopFermentation, bottleWine, progressFermentation, isActionAvailable, getBatchStatus } from '@/lib/services';
import { WineBatch, WineCharacteristics, Vineyard } from '@/lib/types/types';
import { Button, WineCharacteristicsDisplay, CrushingOptionsModal, BalanceBreakdownModal } from '../ui';
import { getWineQualityCategory, getColorCategory, getColorClass, formatPercent } from '@/lib/utils/utils';
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { REGION_ALTITUDE_RANGES, REGION_GRAPE_SUITABILITY } from '@/lib/constants/vineyardConstants';
import { modifyHarvestCharacteristics } from '@/lib/services/wine/characteristics/harvestCharacteristics';

// Component for wine batch balance display (needed to use hooks properly)
const WineBatchBalanceDisplay: React.FC<{ batch: WineBatch }> = ({ batch }) => {
  const balanceResult = useWineBatchBalance(batch);
  const formattedBalance = useFormattedBalance(balanceResult);
  const balanceQuality = useBalanceQuality(balanceResult);
  
  return (
    <div className="text-xs text-gray-600 mt-1">
      Balance: <span className="font-medium">{formattedBalance}</span> ({balanceQuality})
    </div>
  );
};

// Component for wine quality category display
const WineQualityDisplay: React.FC<{ batch: WineBatch }> = ({ batch }) => {
  const qualityCategory = getWineQualityCategory(batch.quality);
  const qualityLabel = getColorCategory(batch.quality);
  const colorClass = getColorClass(batch.quality);
  
  return (
    <div className="text-xs text-gray-600 mt-1">
      Quality: <span className={`font-medium ${colorClass}`}>{qualityCategory}</span> ({qualityLabel})
    </div>
  );
};

// Component for detailed wine characteristics display
const WineBatchCharacteristicsDisplay: React.FC<{ batch: WineBatch; vineyards: Vineyard[] }> = ({ batch, vineyards }) => {
  const balanceResult = useWineBatchBalance(batch);
  
  // Build optional tooltips by recomputing harvest deltas from vineyard data
  const tooltips = useMemo(() => {
    const vineyard = vineyards.find(v => v.id === batch.vineyardId);
    if (!vineyard) return undefined;
    const base = GRAPE_CONST[batch.grape]?.baseCharacteristics as WineCharacteristics | undefined;
    if (!base) return undefined;

    const country = vineyard.country;
    const region = vineyard.region;
    const altitude = vineyard.altitude;
    const countryAlt = (REGION_ALTITUDE_RANGES as any)[country] || {};
    const [minAlt, maxAlt] = (countryAlt[region] as [number, number]) || [0, 100];
    const suitCountry = (REGION_GRAPE_SUITABILITY as any)[country] || {};
    const suitability = (suitCountry[region]?.[batch.grape] ?? 0.5) as number;

    // Use stored breakdown data if available, otherwise fall back to recalculating harvest breakdown
    let breakdown = batch.breakdown;
    
    // If no breakdown data exists (legacy batches), recalculate harvest breakdown
    if (!breakdown) {
      const harvestBreakdown = modifyHarvestCharacteristics({
        baseCharacteristics: base,
        ripeness: vineyard.ripeness || 0.5,
        qualityFactor: batch.quality,
        suitability,
        altitude,
        medianAltitude: (minAlt + maxAlt) / 2,
        maxAltitude: maxAlt,
        grapeColor: GRAPE_CONST[batch.grape].grapeColor
      });
      breakdown = harvestBreakdown.breakdown;
    }

    const formatDelta = (n?: number) => (typeof n === 'number' && Math.abs(n) > 0.0001 ? `${(n * 100).toFixed(1)}%` : undefined);

    const keys = Object.keys(base) as (keyof WineCharacteristics)[];
    const map: Partial<Record<keyof WineCharacteristics, string>> = {};
    for (const k of keys) {
      const parts: string[] = [];
      
      // Find all effects for this characteristic
      const characteristicEffects = breakdown?.effects?.filter(e => e.characteristic === k) || [];
      
      // Add each effect to the tooltip
      for (const effect of characteristicEffects) {
        const delta = formatDelta(effect.modifier);
        if (delta) {
          // Use the full description as the effect name (e.g., "Grape Ripeness", "Hand Pressing")
          const effectName = effect.description;
          parts.push(`${effectName} ${effect.modifier >= 0 ? '+' : ''}${delta}`);
        }
      }
      
      if (parts.length) map[k] = parts.join(' • ');
    }
    return map;
  }, [batch, vineyards]);

  return (
    <div className="mt-3">
      <WineCharacteristicsDisplay 
        characteristics={batch.characteristics} 
        adjustedRanges={balanceResult?.dynamicRanges}
        collapsible={true}
        defaultExpanded={false}
        title="Wine Characteristics"
        tooltips={tooltips}
        baseValues={GRAPE_CONST[batch.grape]?.baseCharacteristics}
        showBalanceScore={true}
      />
    </div>
  );
};

const Winery: React.FC = () => {
  const { withLoading } = useLoadingState();
  const wineBatches = useGameStateWithData(getAllWineBatches, [] as WineBatch[]);
  const vineyards = useGameStateWithData(getAllVineyards, [] as Vineyard[]);
  
  // Crushing modal state
  const [crushingModalOpen, setCrushingModalOpen] = useState(false);
  const [selectedBatchForCrushing, setSelectedBatchForCrushing] = useState<WineBatch | null>(null);
  
  // Balance breakdown modal state
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [selectedBatchForBalance, setSelectedBatchForBalance] = useState<WineBatch | null>(null);

  // Handle opening crushing modal
  const handleCrushingClick = useCallback((batchId: string) => {
    const batch = wineBatches.find(b => b.id === batchId);
    if (batch) {
      setSelectedBatchForCrushing(batch);
      setCrushingModalOpen(true);
    }
  }, [wineBatches]);

  // Handle closing crushing modal
  const handleCrushingModalClose = useCallback(() => {
    setCrushingModalOpen(false);
    setSelectedBatchForCrushing(null);
  }, []);

  // Handle opening balance breakdown modal
  const handleBalanceBreakdownClick = useCallback((batchId: string) => {
    const batch = wineBatches.find(b => b.id === batchId);
    if (batch) {
      setSelectedBatchForBalance(batch);
      setBalanceModalOpen(true);
    }
  }, [wineBatches]);

  // Handle closing balance breakdown modal
  const handleBalanceModalClose = useCallback(() => {
    setBalanceModalOpen(false);
    setSelectedBatchForBalance(null);
  }, []);

  const handleAction = useCallback((batchId: string, action: 'ferment' | 'stop' | 'bottle' | 'progress') => withLoading(async () => {
    switch (action) {
      case 'ferment':
        await startFermentation(batchId);
        break;
      case 'stop':
        await stopFermentation(batchId);
        break;
      case 'bottle':
        await bottleWine(batchId);
        break;
      case 'progress':
        await progressFermentation(batchId, 25); // Progress by 25%
        break;
    }
  }), [withLoading]);

  // Separate batches by completion status (memoized)
  const activeBatches = useMemo(() => wineBatches.filter(batch => batch.state !== 'bottled'), [wineBatches]);
  const completedWines = useMemo(() => wineBatches.filter(batch => batch.state === 'bottled'), [wineBatches]);

  return (
    <div className="space-y-6">
      {/* Winery Banner */}
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-purple-900 to-transparent p-4">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-white text-2xl font-semibold flex items-center gap-3">
                <span className="text-2xl">🍷</span>
                Winery Operations
              </h2>
              <p className="text-white/90 text-sm mt-1">Transform grapes into fine wines</p>
            </div>
            <div className="text-white/80 text-sm">
              {activeBatches.length} Active • {completedWines.length} Completed
            </div>
          </div>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Active Batches</h3>
              <p className="text-3xl font-bold text-gray-900">{activeBatches.length}</p>
              <p className="text-sm text-gray-500">In production</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-100 text-orange-800">
              <span className="text-2xl">⚗️</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Completed Wines</h3>
              <p className="text-3xl font-bold text-gray-900">{completedWines.length}</p>
              <p className="text-sm text-gray-500">Ready for sale</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-100 text-purple-800">
              <span className="text-2xl">🍷</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Total Bottles</h3>
              <p className="text-3xl font-bold text-gray-900">
                {completedWines.reduce((total, batch) => total + batch.quantity, 0)}
              </p>
              <p className="text-sm text-gray-500">Available</p>
            </div>
            <div className="p-3 rounded-lg bg-green-100 text-green-800">
              <span className="text-2xl">🍾</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Production */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h4 className="text-lg font-semibold text-gray-800">Wine Production</h4>
        </div>
        <div className="p-6">
          {activeBatches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No wine batches in production. Harvest some grapes to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {activeBatches.map((batch) => (
                <div key={batch.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className="font-semibold text-gray-900">
                        {batch.grape} - {batch.vineyardName}
                      </h5>
                      <p className="text-sm text-gray-600">
                        {batch.quantity} {batch.state === 'bottled' ? 'bottles' : 'kg'} • Harvest {batch.harvestDate.year}
                      </p>
                      <p className="text-sm font-medium text-gray-800 mt-1">
                        {getBatchStatus(batch)}
                      </p>
                      <WineBatchBalanceDisplay batch={batch} />
                      <WineQualityDisplay batch={batch} />
                      
                      {/* Wine Characteristics Display */}
                      <WineBatchCharacteristicsDisplay batch={batch} vineyards={vineyards} />
                      
                      {/* Fermentation Progress Bar */}
                      {batch.state === 'must_fermenting' && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${batch.fermentationProgress || 0}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Fermentation Progress: {formatPercent((batch.fermentationProgress || 0) / 100, 0, true)}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 ml-4">
                      <Button 
                        onClick={() => handleBalanceBreakdownClick(batch.id)}
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      >
                        Balance Analysis
                      </Button>
                      
                      {isActionAvailable(batch, 'crush') && (
                        <Button 
                          onClick={() => handleCrushingClick(batch.id)}
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          Crush Grapes
                        </Button>
                      )}
                      
                      {isActionAvailable(batch, 'ferment') && (
                        <Button 
                          onClick={() => handleAction(batch.id, 'ferment')}
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          Start Fermentation
                        </Button>
                      )}
                      
                      {batch.state === 'must_fermenting' && (batch.fermentationProgress || 0) < 100 && (
                        <Button 
                          onClick={() => handleAction(batch.id, 'progress')}
                          size="sm"
                          variant="outline"
                        >
                          Progress (+{formatPercent(0.25, 0, true)})
                        </Button>
                      )}
                      
                      {isActionAvailable(batch, 'stop') && (
                        <Button 
                          onClick={() => handleAction(batch.id, 'stop')}
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          Stop Fermentation
                        </Button>
                      )}
                      
                      {isActionAvailable(batch, 'bottle') && (
                        <Button 
                          onClick={() => handleAction(batch.id, 'bottle')}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Bottle Wine
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Completed Wines */}
      {completedWines.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h4 className="text-lg font-semibold text-gray-800">Completed Wines</h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedWines.map((batch) => (
                <div key={batch.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-semibold text-gray-900">
                        {formatCompletedWineName(batch)}
                      </h5>
                      <p className="text-sm text-gray-600">
                        {batch.quantity} bottles
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Completed Week {batch.completedAt?.week}, {batch.completedAt?.season} {batch.completedAt?.year}
                      </p>
                      
                      {/* Balance and Characteristics for completed wines */}
                      <WineBatchBalanceDisplay batch={batch} />
                      <WineQualityDisplay batch={batch} />
                      <WineBatchCharacteristicsDisplay batch={batch} vineyards={vineyards} />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-2xl">🍷</div>
                      <Button 
                        onClick={() => handleBalanceBreakdownClick(batch.id)}
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      >
                        Balance Analysis
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Crushing Options Modal */}
      <CrushingOptionsModal
        isOpen={crushingModalOpen}
        onClose={handleCrushingModalClose}
        batch={selectedBatchForCrushing}
      />

      {/* Balance Breakdown Modal */}
      <BalanceBreakdownModal
        isOpen={balanceModalOpen}
        onClose={handleBalanceModalClose}
        characteristics={selectedBatchForBalance?.characteristics || {} as WineCharacteristics}
        wineName={selectedBatchForBalance ? `${selectedBatchForBalance.grape} - ${selectedBatchForBalance.vineyardName}` : "Wine"}
      />
    </div>
  );
};

export default Winery;
