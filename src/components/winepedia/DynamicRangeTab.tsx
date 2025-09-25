import React, { useState, useMemo } from 'react';
import { BASE_BALANCED_RANGES } from '@/lib/constants';
import { DYNAMIC_ADJUSTMENTS } from '@/lib/constants/balanceAdjustments';
import { WineCharacteristicsDisplay } from '@/components/ui/components/characteristicBar';
import { WineCharacteristics } from '@/lib/types/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/shadCN/tooltip';
import { calculateWineBalance } from '@/lib/services/wine/balanceCalculator';

export const DynamicRangeTab: React.FC = () => {
  const baseRanges = BASE_BALANCED_RANGES;
  
  // Interactive sliders state
  const [sliderValues, setSliderValues] = useState<WineCharacteristics>({
    acidity: (baseRanges.acidity[0] + baseRanges.acidity[1]) / 2,
    aroma: (baseRanges.aroma[0] + baseRanges.aroma[1]) / 2,
    body: (baseRanges.body[0] + baseRanges.body[1]) / 2,
    spice: (baseRanges.spice[0] + baseRanges.spice[1]) / 2,
    sweetness: (baseRanges.sweetness[0] + baseRanges.sweetness[1]) / 2,
    tannins: (baseRanges.tannins[0] + baseRanges.tannins[1]) / 2
  });


  // Calculate adjusted ranges based on current slider values
  const adjustedRanges = useMemo(() => {
    const adjusted: Record<keyof WineCharacteristics, [number, number]> = {
      acidity: [...baseRanges.acidity] as [number, number],
      aroma: [...baseRanges.aroma] as [number, number],
      body: [...baseRanges.body] as [number, number],
      spice: [...baseRanges.spice] as [number, number],
      sweetness: [...baseRanges.sweetness] as [number, number],
      tannins: [...baseRanges.tannins] as [number, number]
    };

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    for (const [k, v] of Object.entries(sliderValues)) {
      const source = k as keyof WineCharacteristics;
      const rulesByDir = DYNAMIC_ADJUSTMENTS[source];
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

  // Calculate balance score
  const balanceResult = calculateWineBalance(sliderValues);

  return (
    <TooltipProvider>
      <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Dynamic Range</h2>
        <p className="text-sm text-gray-600 mt-1">
          The accepted range for each characteristic starts from a base interval and can shift dynamically
          based on other characteristics. Higher or lower values in one trait may nudge the target trait’s
          accepted window slightly left or right.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-medium">Interactive Range Adjustments</h3>
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600">
            Adjust the sliders below to see how one characteristic affects the accepted ranges of others.
          </p>
          <button
            onClick={() => setSliderValues({
              acidity: (baseRanges.acidity[0] + baseRanges.acidity[1]) / 2,
              aroma: (baseRanges.aroma[0] + baseRanges.aroma[1]) / 2,
              body: (baseRanges.body[0] + baseRanges.body[1]) / 2,
              spice: (baseRanges.spice[0] + baseRanges.spice[1]) / 2,
              sweetness: (baseRanges.sweetness[0] + baseRanges.sweetness[1]) / 2,
              tannins: (baseRanges.tannins[0] + baseRanges.tannins[1]) / 2
            })}
            className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
          >
            Reset to Midpoints
          </button>
        </div>
        
        <div className="mt-3 space-y-2">
          {Object.entries(sliderValues).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3 py-1">
              <div className="w-24 flex items-center gap-2 text-xs">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <img 
                      src={`/assets/icons/characteristics/${key}.png`} 
                      alt={`${key} icon`} 
                      className="w-4 h-4 opacity-80 cursor-help"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{key}</p>
                  </TooltipContent>
                </Tooltip>
                <span className="font-medium capitalize">{key}</span>
              </div>
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={value}
                  onChange={(e) => setSliderValues(prev => ({
                    ...prev,
                    [key]: parseFloat(e.target.value)
                  }))}
                  className="w-full h-1.5 bg-gray-200 rounded appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                  <span>0%</span>
                  <span className="font-medium">{Math.round(value * 100)}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-medium">Adjusted Ranges (Live Preview)</h3>
        <div className="p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Current Balance Score:</span>
            <span className={`text-2xl font-bold ${balanceResult.score > 0.8 ? 'text-green-600' : balanceResult.score > 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
              {Math.round(balanceResult.score * 100)}%
            </span>
          </div>
          <WineCharacteristicsDisplay
            characteristics={sliderValues}
            adjustedRanges={adjustedRanges as any}
            showValues={true}
            title="Wine Characteristics"
            collapsible={false}
          />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-medium">Rule Summary (Visual)</h3>
        <p className="text-sm text-gray-600 mt-1">
          Arrows indicate how moving a source trait changes the target’s accepted range. Strength is a small
          factor applied proportionally to how far the source is from its midpoint.
        </p>
        <div className="mt-2 divide-y rounded border">
          {Object.entries(DYNAMIC_ADJUSTMENTS).map(([source, dirs]) => (
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
          The balance calculation measures distance from the (possibly shifted) midpoint of the target’s
          accepted range. Shifts are subtle and ensure traits influence each other without dominating the
          score.
        </p>
      </section>
      </div>
    </TooltipProvider>
  );
};


