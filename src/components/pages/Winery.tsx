
import React, { useMemo, useCallback, useState } from 'react';
import { useLoadingState, useGameStateWithData, useWineBatchBalance, useFormattedBalance, useBalanceQuality } from '@/hooks';
import { getAllWineBatches, bottleWine, isActionAvailable } from '@/lib/services';
import { WineBatch } from '@/lib/types/types';
import { Button, CrushingOptionsModal, WineModal } from '../ui';
import { FeatureDisplay } from '../ui/components/FeatureDisplay';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider, MobileDialogWrapper, tooltipStyles, TooltipSection } from '../ui/shadCN/tooltip';
import { FermentationOptionsModal } from '../ui/modals/activitymodals/FermentationOptionsModal';
import { getGrapeQualityCategory, getColorClass, getCharacteristicDisplayName, formatNumber, getCharacteristicEffectColorInfo, getCharacteristicEffectColorClass } from '@/lib/utils/utils';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import { isFermentationActionAvailable } from '@/lib/services/wine/winery/fermentationManager';
import { getCombinedFermentationEffects } from '@/lib/services/wine/characteristics/fermentationCharacteristics';
import { CharacteristicIcon } from '@/lib/utils/icons';

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

// Component for grape quality category display
const GrapeQualityDisplay: React.FC<{ batch: WineBatch }> = ({ batch }) => {
  const qualityCategory = getGrapeQualityCategory(batch.grapeQuality);
  const colorClass = getColorClass(batch.grapeQuality);
  const qualityPercentage = formatNumber(batch.grapeQuality * 100, { smartDecimals: true });

  return (
    <div className="text-xs text-gray-600 mt-1">
      Grape Quality: <span className={`font-medium ${colorClass}`}>{qualityPercentage}%</span> ({qualityCategory})
    </div>
  );
};

// Component for fermentation status badge
const FermentationStatusBadge: React.FC<{ batch: WineBatch }> = ({ batch }) => {
  if (batch.state !== 'must_fermenting') return null;
  
  const method = batch.fermentationOptions?.method || 'Basic';
  const temperature = batch.fermentationOptions?.temperature || 'Ambient';
  
  return (
    <div className="mt-2">
      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        <span className="w-2 h-2 bg-purple-600 rounded-full mr-2 animate-pulse"></span>
        Fermenting ({method}, {temperature})
      </div>
    </div>
  );
};

// Component for displaying expected fermentation effects
const FermentationEffectsDisplay: React.FC<{ batch: WineBatch }> = ({ batch }) => {
  if (batch.state !== 'must_fermenting' || !batch.fermentationOptions) return null;
  
  const method = batch.fermentationOptions.method;
  const temperature = batch.fermentationOptions.temperature;
  
  // Get combined effects for this fermentation setup
  const effects = getCombinedFermentationEffects(method, temperature);
  
  if (effects.length === 0) return null;
  
  return (
    <div className="mt-2">
      <div className="text-xs text-gray-600 mb-1">Weekly Effects:</div>
      <TooltipProvider>
        <div className="flex flex-wrap gap-1">
          {effects.map((effect, index) => {
            const content = (
              <div className={tooltipStyles.text}>
                <TooltipSection>
                  <p className={"capitalize"}>{getCharacteristicDisplayName(effect.characteristic)}</p>
                </TooltipSection>
              </div>
            );
            
            // Use balance-aware color coding for fermentation effects
            const currentValue = batch.characteristics[effect.characteristic] || 0;
            const balancedRange = BASE_BALANCED_RANGES[effect.characteristic];
            const balancedRangeCopy: [number, number] = [balancedRange[0], balancedRange[1]];
            const colorInfo = getCharacteristicEffectColorInfo(currentValue, effect.modifier, balancedRangeCopy);
            const colorClass = getCharacteristicEffectColorClass(currentValue, effect.modifier, balancedRangeCopy);
            const bgClass = colorInfo.isGood ? 'bg-green-100' : 'bg-red-100';
            
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <MobileDialogWrapper content={content} title={getCharacteristicDisplayName(effect.characteristic)} triggerClassName="inline-block">
                    <div className={`flex items-center ${bgClass} px-2 py-1 rounded text-xs cursor-help`}>
                      <CharacteristicIcon 
                        name={effect.characteristic}
                        size="xs"
                        className="mr-1"
                        tooltip={false}
                      />
                      <span className={`font-medium ${colorClass}`}>
                        {effect.modifier > 0 ? '+' : ''}{formatNumber(effect.modifier * 100, { smartDecimals: true })}%
                      </span>
                    </div>
                  </MobileDialogWrapper>
                </TooltipTrigger>
                <TooltipContent side="top" variant="panel" density="compact">
                  {content}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
};


const Winery: React.FC = () => {
  const { withLoading } = useLoadingState();
  const wineBatches = useGameStateWithData(getAllWineBatches, [] as WineBatch[]);
  
  // Unified modal state
  const [modals, setModals] = useState({
    crushing: null as WineBatch | null,
    fermentation: null as WineBatch | null,
    wine: null as WineBatch | null,
  });

  // Generic modal handlers
  const openModal = useCallback((type: keyof typeof modals, batchId: string) => {
    const batch = wineBatches.find(b => b.id === batchId);
    if (batch) setModals(prev => ({ ...prev, [type]: batch }));
  }, [wineBatches]);

  const closeModal = useCallback((type: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [type]: null }));
  }, []);

  const handleAction = useCallback((batchId: string, action: 'bottle') => withLoading(async () => {
    switch (action) {
      case 'bottle':
        await bottleWine(batchId);
        break;
    }
  }), [withLoading]);

  // Filter active batches (memoized)
  const activeBatches = useMemo(() => wineBatches.filter(batch => batch.state !== 'bottled'), [wineBatches]);

  return (
    <div className="space-y-3 text-sm">
      {/* Winery Banner */}
      <div 
        className="h-28 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-purple-900 to-transparent p-2.5">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-white text-base font-semibold flex items-center gap-2">
                <span className="text-base">🍷</span>
                Winery Operations
              </h2>
              <p className="text-white/90 text-xs mt-0.5">Transform grapes into fine wines</p>
            </div>
            <div className="text-white/80 text-xs">
              {activeBatches.length} Active Batches
            </div>
          </div>
        </div>
      </div>
      
      {/* Summary Cards - Desktop/Tablet (hidden on mobile) */}
      <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Active Batches</h3>
              <p className="text-xl font-bold text-gray-900">{activeBatches.length}</p>
              <p className="text-xs text-gray-500">In production</p>
            </div>
            <div className="p-2 rounded-lg bg-orange-100 text-orange-800">
              <span className="text-base">⚗️</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Production Status</h3>
              <p className="text-xl font-bold text-gray-900">
                {activeBatches.filter(batch => batch.state === 'must_fermenting').length} Fermenting
              </p>
              <p className="text-xs text-gray-500">Wine in progress</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-100 text-purple-800">
              <span className="text-base">🍷</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards - Mobile (2x2 grid) */}
      <div className="lg:hidden grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-gray-900">{activeBatches.length}</div>
          <div className="text-xs text-gray-500">Active Batches</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-purple-600">{activeBatches.filter(batch => batch.state === 'must_fermenting').length}</div>
          <div className="text-xs text-gray-500">Fermenting</div>
        </div>
      </div>

      {/* Active Production */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b">
          <h4 className="text-sm font-semibold text-gray-800">Wine Production</h4>
        </div>
        <div className="p-3">
          {activeBatches.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-xs">
              No wine batches in production. Harvest some grapes to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {activeBatches.map((batch) => (
                <div key={batch.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  {/* Wine Batch Header */}
                  <div className="flex justify-between items-start mb-3">
                    <h5 className="font-semibold text-gray-900 text-base">
                      {batch.grape} - {batch.vineyardName}
                    </h5>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button onClick={() => openModal('wine', batch.id)} size="sm" variant="outline" className="text-purple-600 border-purple-600 hover:bg-purple-50">
                        Wine Details
                      </Button>

                      {isActionAvailable(batch, 'crush') && (
                        <Button onClick={() => openModal('crushing', batch.id)} size="sm" className="bg-orange-600 hover:bg-orange-700">
                          Crush Grapes
                        </Button>
                      )}
                      
                      {isFermentationActionAvailable(batch, 'ferment') && (
                        <Button onClick={() => openModal('fermentation', batch.id)} size="sm" className="bg-purple-600 hover:bg-purple-700">
                          Start Fermentation
                        </Button>
                      )}
                      
                      {isFermentationActionAvailable(batch, 'bottle') && (
                        <Button onClick={() => handleAction(batch.id, 'bottle')} size="sm" className="bg-green-600 hover:bg-green-700">
                          Bottle Wine
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 4-Grid Layout */}
                  <div className="grid grid-cols-4 gap-4">
                    {/* Column 1: Overview */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-800">Overview</div>
                      <div className="text-xs text-gray-600">
                        {batch.quantity} {batch.state === 'bottled' ? 'bottles' : 'kg'} • Harvest {batch.harvestStartDate.year}
                      </div>
                      <WineBatchBalanceDisplay batch={batch} />
                      <GrapeQualityDisplay batch={batch} />
                      
                      <div className="text-xs font-medium text-gray-800 mt-3">
                        Current Activity: <span className="text-purple-600">
                          {batch.state
                            .split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ')}
                        </span>
                      </div>
                      
                      {/* Fermentation Status Badge */}
                      <FermentationStatusBadge batch={batch} />
                      
                      {/* Fermentation Effects Display */}
                      <FermentationEffectsDisplay batch={batch} />
                    </div>

                    {/* Column 2: Evolving Features */}
                    <div className="space-y-2">
                      <FeatureDisplay 
                        batch={batch} 
                        showEvolving={true}
                        showActive={false}
                        showRisks={false}
                        expanded={false}
                      />
                    </div>

                    {/* Column 3: Features */}
                    <div className="space-y-2">
                      <FeatureDisplay 
                        batch={batch} 
                        showEvolving={false}
                        showActive={true}
                        showRisks={false}
                        expanded={false}
                      />
                    </div>

                    {/* Column 4: Risks */}
                    <div className="space-y-2">
                      <FeatureDisplay 
                        batch={batch} 
                        showEvolving={false}
                        showActive={false}
                        showRisks={true}
                        expanded={false}
                      />
                      
                      {/* Next Action Risks */}
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <FeatureDisplay 
                          batch={batch} 
                          showPreviewRisks={true}
                          showForNextAction={true}
                          compact={true}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Modals */}
      <CrushingOptionsModal
        isOpen={!!modals.crushing}
        onClose={() => closeModal('crushing')}
        batch={modals.crushing}
      />

      <FermentationOptionsModal
        isOpen={!!modals.fermentation}
        onClose={() => closeModal('fermentation')}
        batch={modals.fermentation}
      />

      <WineModal
        isOpen={!!modals.wine}
        onClose={() => closeModal('wine')}
        wineBatch={modals.wine}
        wineName={modals.wine ? `${modals.wine.grape} - ${modals.wine.vineyardName}` : "Wine"}
      />
    </div>
  );
};

export default Winery;
