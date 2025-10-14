import { useState } from 'react';
import { BalanceScoreBreakdown, CharacteristicSliderGrid } from '@/components/ui';
import { WineCharacteristics } from '@/lib/types/types';
import { useWineBalance } from '@/hooks';
import { WineCharacteristicsDisplay } from '@/components/ui/components/characteristicBar';
import { calculateMidpointCharacteristics, RESET_BUTTON_CLASSES } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/shadCN/tooltip';

export function CrossTraitPenaltyTab() {
  const [characteristics, setCharacteristics] = useState<WineCharacteristics>(calculateMidpointCharacteristics());

  const updateCharacteristic = (key: keyof WineCharacteristics, value: number) => {
    setCharacteristics(prev => ({ ...prev, [key]: value }));
  };

  const balanceResult = useWineBalance(characteristics);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold">Cross-Trait Scaling (applied to TotalDistance)</h2>
          <p className="text-sm text-gray-600 mt-1">
            Characteristics affect each other's penalty severity. Good combinations provide synergy reductions.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-medium">Interactive Penalty Scaling</h3>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">
              Adjust characteristics to see penalty scaling effects.
            </p>
            <button
              onClick={() => setCharacteristics(calculateMidpointCharacteristics())}
              className={RESET_BUTTON_CLASSES}
            >
              Reset to Midpoints
            </button>
          </div>
          
          <CharacteristicSliderGrid
            characteristics={characteristics}
            onChange={(key, value) => updateCharacteristic(key as keyof WineCharacteristics, value)}
            className="space-y-3"
          />
        </section>

        <section>
          <h3 className="text-lg font-medium">Live Balance Calculation</h3>
          <div className="p-4 rounded-lg">
            {balanceResult && (
              <WineCharacteristicsDisplay 
                characteristics={characteristics}
                adjustedRanges={balanceResult.dynamicRanges}
                showValues={true}
                title="Wine Characteristics"
                collapsible={false}
                showBalanceScore={true}
              />
            )}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-medium">Balance Score Breakdown</h3>
          <div className="p-4 bg-gray-50 rounded-lg">
            <BalanceScoreBreakdown 
              characteristics={characteristics} 
              showWineStyleRules={true}
            />
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
};