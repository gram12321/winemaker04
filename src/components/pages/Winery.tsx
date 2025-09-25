
import React, { useMemo, useCallback } from 'react';
import { useLoadingState, useGameStateWithData, useWineBatchBalance, useFormattedBalance, useBalanceQuality } from '@/hooks';
import { getAllWineBatches, getAllVineyards, formatCompletedWineName, crushGrapes, startFermentation, stopFermentation, bottleWine, progressFermentation, isActionAvailable, getBatchStatus } from '@/lib/services';
import { WineBatch, WineCharacteristics, Vineyard } from '@/lib/types/types';
import { Button, WineCharacteristicsDisplay } from '../ui';
import { getWineQualityCategory, getColorCategory, getColorClass, formatPercent } from '@/lib/utils/utils';
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { REGION_ALTITUDE_RANGES, REGION_GRAPE_SUITABILITY } from '@/lib/constants/vineyardConstants';
import { deriveHarvestCharacteristics } from '@/lib/services/wine/harvestCharacteristics';

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

    const { debug } = deriveHarvestCharacteristics(base, {
      ripeness: vineyard.ripeness || 0.5,
      qualityFactor: batch.quality,
      suitability,
      altitude,
      medianAltitude: (minAlt + maxAlt) / 2,
      maxAltitude: maxAlt,
      grapeColor: GRAPE_CONST[batch.grape].grapeColor
    });

    const formatDelta = (n?: number) => (typeof n === 'number' && Math.abs(n) > 0.0001 ? `${(n * 100).toFixed(1)}%` : undefined);

    const keys = Object.keys(base) as (keyof WineCharacteristics)[];
    const map: Partial<Record<keyof WineCharacteristics, string>> = {};
    for (const k of keys) {
      const parts: string[] = [];
      const r = formatDelta((debug.ripenessDelta as any)[k]);
      if (r) parts.push(`Ripeness ${Number((debug.ripenessDelta as any)[k]) >= 0 ? '+' : ''}${r}`);
      const q = formatDelta((debug.qualityDelta as any)[k]);
      if (q) parts.push(`Quality ${Number((debug.qualityDelta as any)[k]) >= 0 ? '+' : ''}${q}`);
      const a = formatDelta((debug.altitudeDelta as any)[k]);
      if (a) parts.push(`Altitude ${Number((debug.altitudeDelta as any)[k]) >= 0 ? '+' : ''}${a}`);
      const s = formatDelta((debug.suitabilityDelta as any)[k]);
      if (s) parts.push(`Suitability ${Number((debug.suitabilityDelta as any)[k]) >= 0 ? '+' : ''}${s}`);
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
      />
    </div>
  );
};

const Winery: React.FC = () => {
  const { withLoading } = useLoadingState();
  const wineBatches = useGameStateWithData(getAllWineBatches, [] as WineBatch[]);
  const vineyards = useGameStateWithData(getAllVineyards, [] as Vineyard[]);

  const handleAction = useCallback((batchId: string, action: 'crush' | 'ferment' | 'stop' | 'bottle' | 'progress') => withLoading(async () => {
    switch (action) {
      case 'crush':
        await crushGrapes(batchId);
        break;
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
  const activeBatches = useMemo(() => wineBatches.filter(batch => batch.process !== 'bottled'), [wineBatches]);
  const completedWines = useMemo(() => wineBatches.filter(batch => batch.process === 'bottled'), [wineBatches]);

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
                        {batch.quantity} {batch.stage === 'bottled' ? 'bottles' : 'kg'} • Harvest {batch.harvestDate.year}
                      </p>
                      <p className="text-sm font-medium text-gray-800 mt-1">
                        {getBatchStatus(batch)}
                      </p>
                      <WineBatchBalanceDisplay batch={batch} />
                      <WineQualityDisplay batch={batch} />
                      
                      {/* Wine Characteristics Display */}
                      <WineBatchCharacteristicsDisplay batch={batch} vineyards={vineyards} />
                      
                      {/* Fermentation Progress Bar */}
                      {batch.process === 'fermentation' && (
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
                      {isActionAvailable(batch, 'crush') && (
                        <Button 
                          onClick={() => handleAction(batch.id, 'crush')}
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
                      
                      {batch.process === 'fermentation' && (batch.fermentationProgress || 0) < 100 && (
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
                    <div className="text-2xl">🍷</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Winery;
