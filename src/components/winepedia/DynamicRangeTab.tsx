import React, { useState, useMemo } from 'react';
import { BASE_BALANCED_RANGES } from '@/lib/constants';
import { WineCharacteristicsDisplay } from '@/components/ui/components/characteristicBar';
import { WineCharacteristics } from '@/lib/types/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/shadCN/tooltip';
import { calculateWineBalance, RANGE_ADJUSTMENTS, RULES } from '@/lib/balance';
import { calculateMidpointCharacteristics, createAdjustedRangesRecord, clamp01, RESET_BUTTON_CLASSES } from '@/lib/utils';
import { CharacteristicSliderGrid } from '../ui';

export const DynamicRangeTab: React.FC = () => {
  const baseRanges = BASE_BALANCED_RANGES;
  
  const [sliderValues, setSliderValues] = useState<WineCharacteristics>(calculateMidpointCharacteristics());
  const adjustedRanges = useMemo(() => {
    const adjusted = createAdjustedRangesRecord();

    for (const [k, v] of Object.entries(sliderValues)) {
      const source = k as keyof WineCharacteristics;
      const rulesByDir = RANGE_ADJUSTMENTS[source];
      if (!rulesByDir) continue;

      const [min, max] = baseRanges[source];
      const midpoint = (min + max) / 2;
      const fullRange = Math.max(0.0001, max - min);
      const deviationPct = (v - midpoint) / fullRange; // -0.5..+0.5 within range
      if (Math.abs(deviationPct) < 1e-6) continue;

      const direction = deviationPct > 0 ? 'above' : 'below';
      const set = rulesByDir[direction];
      const rules = set?.rangeShifts;
      if (!rules || rules.length === 0) continue;

      for (const rule of rules) {
        const target = rule.target;
        const [tmin, tmax] = adjusted[target];
        const targetWidth = Math.max(0.0001, tmax - tmin);
        const delta = rule.shiftPerUnit * deviationPct * targetWidth;
        let newMin = tmin + delta;
        let newMax = tmax + delta;

        if (rule.clamp) {
          newMin = Math.max(rule.clamp[0], newMin);
          newMax = Math.min(rule.clamp[1], newMax);
        }

        newMin = clamp01(newMin);
        newMax = clamp01(newMax);
        if (newMax - newMin < 0.02) {
          const center = (newMin + newMax) / 2;
          newMin = clamp01(center - 0.01);
          newMax = clamp01(center + 0.01);
        }

        adjusted[target] = [newMin, newMax];
      }
    }

    return adjusted;
  }, [sliderValues]);

  // Calculate balance for demonstration (currently unused in this tab)
  // const balanceResult = calculateWineBalance(sliderValues, baseRanges, RANGE_ADJUSTMENTS, RULES);

  return (
    <TooltipProvider>
      <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Dynamic Range</h2>
        <p className="text-sm text-gray-600 mt-1">
          Characteristic ranges shift based on other traits' values.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-medium">Interactive Range Adjustments</h3>
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600">
            Adjust sliders to see how characteristics affect each other's ranges.
          </p>
          <button
            onClick={() => setSliderValues(calculateMidpointCharacteristics())}
            className={RESET_BUTTON_CLASSES}
          >
            Reset to Midpoints
          </button>
        </div>
        
        <CharacteristicSliderGrid
          characteristics={sliderValues}
          onChange={(key, value) => setSliderValues(prev => ({ ...prev, [key]: value }))}
          className="mt-3"
        />
      </section>

      <section>
        <h3 className="text-lg font-medium">Adjusted Ranges (Live Preview)</h3>
        <div className="p-4 rounded-lg">
          <WineCharacteristicsDisplay
            characteristics={sliderValues}
            adjustedRanges={adjustedRanges as any}
            showValues={true}
            title="Wine Characteristics"
            collapsible={false}
            showBalanceScore={true}
          />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-medium">Rule Summary (Visual)</h3>
        <p className="text-sm text-gray-600 mt-1">
          Shows how traits affect each other's ranges.
        </p>
        <div className="mt-2 divide-y rounded border">
          {Object.entries(RANGE_ADJUSTMENTS).map(([source, dirs]) => (
            <div key={source} className="p-2">
              <div className="font-medium capitalize flex items-center gap-2 text-sm">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <img src={`/assets/icons/characteristics/${source}.png`} alt={`${source} icon`} className="w-4 h-4 opacity-80 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{source}</p>
                  </TooltipContent>
                </Tooltip>
                <span>{source}</span>
              </div>
              {(['above','below'] as const).map(dir => {
                const set = (dirs as any)[dir];
                const rules = set?.rangeShifts || [];
                if (!rules.length) return null;
                return (
                  <div key={dir} className="mt-1 ml-6 text-xs text-gray-700">
                    <div className="italic">{dir === 'above' ? '↑ when above midpoint' : '↓ when below midpoint'}</div>
                    <ul className="ml-4 list-disc">
                      {rules.map((r: any, idx: number) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <img src={`/assets/icons/characteristics/${r.target}.png`} className="w-3 h-3 opacity-80 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{r.target}</p>
                              </TooltipContent>
                            </Tooltip>
                            <span className="capitalize">{r.target}</span>
                          </span>
                          <span>range {r.shiftPerUnit < 0 ? '↓' : '↑'} (strength {Math.abs(r.shiftPerUnit)})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-medium">How this affects balance</h3>
        <p className="text-sm text-gray-600 mt-1">
          Balance calculation uses shifted ranges for more realistic scoring.
        </p>
      </section>
      </div>
    </TooltipProvider>
  );
};


