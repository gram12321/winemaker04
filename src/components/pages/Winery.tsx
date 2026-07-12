
import React, { useMemo, useCallback, useState } from 'react';
import { useLoadingState, useGameStateWithData, useWineBatchStructureIndex, useFormattedStructureIndex, useStructureIndexQuality } from '@/hooks';
import { getAllWineBatches, bottleWine, isActionAvailable, getWineBatchDisplayName } from '@/lib/services';
import { WineBatch } from '@/lib/types/types';
import { Button, BuyMarketModal, CrushingOptionsModal, WineModal, SellGrapesModal, StorageVesselInventory } from '../ui';
import { FeatureDisplay } from '../ui/components/FeatureDisplay';
import { UnifiedTooltip, tooltipStyles, TooltipSection } from '../ui/shadCN/tooltip';
import { FermentationOptionsModal } from '../ui/modals/activitymodals/FermentationOptionsModal';
import { getQualityCategory, getColorClass, getCharacteristicDisplayName, formatNumber, getCharacteristicEffectColorInfo, getCharacteristicEffectColorClass } from '@/lib/utils/utils';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import { isFermentationActionAvailable } from '@/lib/services/wine/winery/fermentationManager';
import { getCombinedFermentationEffects } from '@/lib/services/wine/characteristics/fermentationCharacteristics';
import { resolveWineAnchors } from '@/lib/services/wine/anchors/wineAnchorService';
import { CharacteristicIcon } from '@/lib/utils/icons';
import { getTasteQualityIndex } from '@/lib/services/wine/winescore/wineScoreCalculation';

const WineBatchStructureDisplay: React.FC<{ batch: WineBatch }> = ({ batch }) => {
  const structureResult = useWineBatchStructureIndex(batch);
  const formattedStructureIndex = useFormattedStructureIndex(structureResult);
  const structureQuality = useStructureIndexQuality(structureResult);
  
  return (
    <div className="text-xs text-gray-600 mt-1">
      Structure: <span className="font-medium">{formattedStructureIndex}</span> ({structureQuality})
    </div>
  );
};

// Component for taste quality display
const TasteQualityDisplay: React.FC<{ batch: WineBatch }> = ({ batch }) => {
  const tasteQualityIndex = getTasteQualityIndex(batch);
  const qualityCategory = getQualityCategory(tasteQualityIndex);
  const colorClass = getColorClass(tasteQualityIndex);
  const qualityPercentage = formatNumber(tasteQualityIndex * 100, { smartDecimals: true });

  return (
    <div className="text-xs text-gray-600 mt-1">
      Taste Quality: <span className={`font-medium ${colorClass}`}>{qualityPercentage}%</span> ({qualityCategory})
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
  const effects = getCombinedFermentationEffects(method, temperature, resolveWineAnchors(batch.wineAnchors));
  
  if (effects.length === 0) return null;
  
  return (
    <div className="mt-2">
      <div className="text-xs text-gray-600 mb-1">Weekly Effects:</div>
      <div className="flex flex-wrap gap-1">
        {effects.map((effect, index) => {
          const content = (
            <div className={tooltipStyles.text}>
              <TooltipSection>
                <p className={"capitalize"}>{getCharacteristicDisplayName(effect.characteristic)}</p>
              </TooltipSection>
            </div>
          );
          
          // Use ideal-range-aware color coding for fermentation effects
          const currentValue = batch.characteristics[effect.characteristic] || 0;
          const balancedRange = BASE_BALANCED_RANGES[effect.characteristic];
          const balancedRangeCopy: [number, number] = [balancedRange[0], balancedRange[1]];
          const colorInfo = getCharacteristicEffectColorInfo(currentValue, effect.modifier, balancedRangeCopy);
          const colorClass = getCharacteristicEffectColorClass(currentValue, effect.modifier, balancedRangeCopy);
          const bgClass = colorInfo.isGood ? 'bg-green-100' : 'bg-red-100';
          
          return (
            <UnifiedTooltip
              key={index}
              content={content}
              title={getCharacteristicDisplayName(effect.characteristic)}
              side="top"
              variant="panel"
              density="compact"
              triggerClassName="inline-block"
              showMobileHint={true}
              mobileHintVariant="corner-dot"
            >
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
            </UnifiedTooltip>
          );
        })}
      </div>
    </div>
  );
};


const Winery: React.FC = () => {
  const { withLoading } = useLoadingState();
  const wineBatches = useGameStateWithData(getAllWineBatches, [] as WineBatch[]);
  const [isBuyMarketOpen, setIsBuyMarketOpen] = useState(false);
  
  // Unified modal state
  const [modals, setModals] = useState({
    crushing: null as WineBatch | null,
    fermentation: null as WineBatch | null,
    wine: null as WineBatch | null,
    sellGrapes: null as WineBatch | null,
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
              <div>{activeBatches.length} Active Batches</div>
              <Button
                size="sm"
                className="mt-2 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => setIsBuyMarketOpen(true)}
              >
                Buy from Market
              </Button>
            </div>
          </div>
        </div>
      </div>

      <StorageVesselInventory />
      
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
              {activeBatches.map((batch) => {
                const displayName = getWineBatchDisplayName(batch);
                return (
                  <div key={batch.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  {/* Wine Batch Header */}
                  <div className="flex justify-between items-start mb-3">
                    <h5 className="font-semibold text-gray-900 text-base">
                      {displayName}
                    </h5>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button onClick={() => openModal('wine', batch.id)} size="sm" variant="outline" className="text-purple-600 border-purple-600 hover:bg-purple-50">
                        Wine Details
                      </Button>

                      {isActionAvailable(batch, 'crush') && (
                        <>
                          <Button onClick={() => openModal('crushing', batch.id)} size="sm" className="bg-orange-600 hover:bg-orange-700">
                            Crush Grapes
                          </Button>
                        </>
                      )}

                      <Button onClick={() => openModal('sellGrapes', batch.id)} size="sm" variant="outline" className="text-amber-600 border-amber-600 hover:bg-amber-50">
                        Sell Grapes
                      </Button>
                      
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
                      <WineBatchStructureDisplay batch={batch} />
                      <TasteQualityDisplay batch={batch} />
                      
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
                );
              })}
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
        wineName={modals.wine ? getWineBatchDisplayName(modals.wine) : 'Wine'}
      />

      <SellGrapesModal
        isOpen={!!modals.sellGrapes}
        onClose={() => closeModal('sellGrapes')}
        batch={modals.sellGrapes}
      />

      <BuyMarketModal
        isOpen={isBuyMarketOpen}
        onClose={() => setIsBuyMarketOpen(false)}
      />
    </div>
  );
};

export default Winery;



