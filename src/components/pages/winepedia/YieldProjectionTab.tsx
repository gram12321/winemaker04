import { useMemo, useState } from 'react';
import { SimpleCard } from '@/components/ui';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, ReferenceLine, Area, ComposedChart } from 'recharts';
import { formatNumber } from '@/lib/utils/utils';
import { calculateVineyardYield, calculateVineYieldProgression, calculateGrapeSuitabilityMetrics } from '@/lib/services';
import { Vineyard, GrapeVariety, Aspect } from '@/lib/types/types';
import { DEFAULT_VINE_DENSITY } from '@/lib/constants';
import { GRAPE_VARIETIES } from '@/lib/types/types';

// Use existing constants from vineyardConstants
import { COUNTRY_REGION_MAP, REGION_ALTITUDE_RANGES } from '@/lib/constants/vineyardConstants';

function createVineyard(overrides: Partial<Vineyard>): Vineyard {
  return {
    id: 'projection',
    name: 'Projection Vineyard',
    country: 'France',
    region: 'Bordeaux',
    hectares: 1,
    grape: 'Chardonnay' as GrapeVariety,
    vineAge: 10,
    soil: ['Gravel'],
    altitude: 60,
    aspect: 'South',
    density: DEFAULT_VINE_DENSITY,
    vineyardHealth: 1.0,
    landValue: 0,
    vineyardTotalValue: 0,
    status: 'Growing',
    ripeness: 1.0,
    vineyardPrestige: 0,
    vineYield: 0.02, // Default vine yield factor
    ...overrides
  };
}

export function YieldProjectionTab() {
  const [country, setCountry] = useState<string>('France');
  const [region, setRegion] = useState<string>('Bordeaux');
  
  // Get available countries and regions from constants
  const availableCountries = Object.keys(COUNTRY_REGION_MAP);
  const availableRegions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP] || [];
  const [grape, setGrape] = useState<GrapeVariety>('Chardonnay');
  const [hectares, setHectares] = useState<number>(1);
  const [density, setDensity] = useState<number>(DEFAULT_VINE_DENSITY);
  const [ripeness, setRipeness] = useState<number>(0.9);
  const vineyardAge = 10; // Fixed vineyard age for charts
  const [health, setHealth] = useState<number>(1.0);
  const [vineAge, setVineAge] = useState<number>(5);

  const defaultAltitude = useMemo(() => {
    const countryData = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
    const range = countryData ? (countryData as any)[region] as [number, number] : undefined;
    if (!range) {
      throw new Error(`Missing altitude range for ${region}/${country}`);
    }
    return Math.round((range[0] + range[1]) / 2);
  }, [country, region]);

  // Calculate baseline vine yield for a given age
  const calculateBaselineVineYield = (age: number): number => {
    let currentYield = 0.02; // Start from age 0
    
    for (let a = 0; a < age; a++) {
      const { expectedDelta, targetValue } = calculateVineYieldProgression(a, currentYield);
      
      if (targetValue !== undefined) {
        // For exponential decay, use target value directly
        currentYield = Math.max(0.01, targetValue);
      } else {
        // For other ages, accumulate delta
        currentYield = Math.max(0.01, currentYield + expectedDelta);
      }
    }
    
    return currentYield;
  };

  const currentYield = useMemo(() => {
    const baselineVineYield = calculateBaselineVineYield(vineAge);
    const v = createVineyard({ country, region, grape, hectares, density, ripeness, vineAge: vineyardAge, vineyardHealth: health, vineYield: baselineVineYield, altitude: defaultAltitude });
    return calculateVineyardYield(v);
  }, [country, region, grape, hectares, density, ripeness, vineyardAge, health, vineAge, defaultAltitude]);

  const suitabilityMetrics = useMemo(() => {
    const defaultAspect: Aspect = 'South';
    return calculateGrapeSuitabilityMetrics(grape, region, country, defaultAltitude, defaultAspect);
  }, [country, region, grape, defaultAltitude]);
  const suitability = suitabilityMetrics.overall;

  const yieldVsRipeness = useMemo(() => {
    const points = [] as { ripeness: number; yieldKg: number }[];
    const baselineVineYield = calculateBaselineVineYield(vineAge);
    for (let i = 0; i <= 40; i++) {
      const r = i / 40;
      const v = createVineyard({ country, region, grape, hectares, density, ripeness: r, vineAge: vineyardAge, vineyardHealth: health, vineYield: baselineVineYield, altitude: defaultAltitude });
      points.push({ ripeness: r, yieldKg: calculateVineyardYield(v) });
    }
    return points;
  }, [country, region, grape, hectares, density, vineyardAge, health, vineAge, defaultAltitude]);

  const yieldVsAge = useMemo(() => {
    const points = [] as { age: number; yieldKg: number }[];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * 200;
      const baselineVineYield = calculateBaselineVineYield(a);
      const v = createVineyard({
        country,
        region,
        grape,
        hectares,
        density,
        ripeness,
        vineAge: a,
        vineyardHealth: health,
        vineYield: baselineVineYield,
        altitude: defaultAltitude
      });
      points.push({ age: a, yieldKg: calculateVineyardYield(v) });
    }
    return points;
  }, [country, region, grape, hectares, density, ripeness, health, defaultAltitude]);

  const yieldVsHectares = useMemo(() => {
    const points = [] as { hectares: number; yieldKg: number }[];
    const baselineVineYield = calculateBaselineVineYield(vineAge);
    // Cover a practical range from 0.1 to 20 ha with more resolution at small sizes
    const steps = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 12.5, 15, 20];
    for (const h of steps) {
      const v = createVineyard({
        country,
        region,
        grape,
        hectares: h,
        density,
        ripeness,
        vineAge: vineyardAge,
        vineyardHealth: health,
        vineYield: baselineVineYield,
        altitude: defaultAltitude
      });
      points.push({ hectares: h, yieldKg: calculateVineyardYield(v) });
    }
    return points;
  }, [country, region, grape, density, ripeness, vineyardAge, health, vineAge, defaultAltitude]);

  // Vine Yield Progression with min/max bands - using the exact function from vineyardManager
  const vineYieldProgression = useMemo(() => {
    const points: { age: number; baseline: number; min: number; max: number }[] = [];
    let currentYield = 0.02; // Always start from 0.02 for the progression
    let minYield = 0.02;
    let maxYield = 0.02;
    
    for (let a = 0; a <= 200; a++) {
      // Store current values first
      points.push({ age: a, baseline: currentYield, min: minYield, max: maxYield });
      
      // Then apply the progression for the NEXT year using the exact same logic as the game
      if (a < 200) {
        const { expectedDelta, targetValue } = calculateVineYieldProgression(a, currentYield);
        
        if (targetValue !== undefined) {
          // For exponential decay, calculate the delta and apply randomness to it
          const expectedDelta = targetValue - currentYield;
          currentYield = Math.max(0.01, targetValue);
          
          // Calculate min/max for exponential decay (50-150% randomness applied to delta)
          const minDelta = expectedDelta * 0.5;  // 50% of delta (worst case)
          const maxDelta = expectedDelta * 1.5; // 150% of delta (best case)
          minYield = Math.max(0.01, minYield + minDelta);
          maxYield = Math.max(0.01, maxYield + maxDelta);
        } else {
          // For other ages, accumulate delta with randomness
          if (expectedDelta === 0) {
            // For zero baseline, use absolute ±0.1 range
            const randomOffset = 0.1; // Max offset
            minYield = Math.max(0.01, minYield - randomOffset);
            maxYield = Math.max(0.01, maxYield + randomOffset);
            currentYield = Math.max(0.01, currentYield + expectedDelta);
          } else if (expectedDelta > 0) {
            // For positive baseline: 25% to 175% of baseline
            const minDelta = expectedDelta * 0.25;  // Worst case: lowest growth
            const maxDelta = expectedDelta * 1.75; // Best case: highest growth
            minYield = Math.max(0.01, minYield + minDelta);
            maxYield = Math.max(0.01, maxYield + maxDelta);
            currentYield = Math.max(0.01, currentYield + expectedDelta);
          } else {
            // For negative baseline: 25% to 175% of baseline (maintaining negative)
            const minDelta = expectedDelta * 1.75; // Worst case: most negative (largest decline)
            const maxDelta = expectedDelta * 0.25; // Best case: least negative (smallest decline)
            minYield = Math.max(0.01, minYield + minDelta);
            maxYield = Math.max(0.01, maxYield + maxDelta);
            currentYield = Math.max(0.01, currentYield + expectedDelta);
          }
        }
      }
    }
    return points;
  }, []); // Remove vineYield dependency since we always start from 0.02

  return (
    <SimpleCard
      title="Interactive Yield Projection"
      description="Configure parameters to simulate expected harvest yield (kg). Uses the same yield function as the game."
    >
      <div className="space-y-6">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select className="w-full p-2 border rounded" value={country} onChange={e => { setCountry(e.target.value); setRegion(COUNTRY_REGION_MAP[e.target.value as keyof typeof COUNTRY_REGION_MAP][0]); }}>
                {availableCountries.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
              <select className="w-full p-2 border rounded" value={region} onChange={e => setRegion(e.target.value)}>
                {(availableRegions || []).map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grape Variety</label>
              <select className="w-full p-2 border rounded" value={grape} onChange={e => setGrape(e.target.value as GrapeVariety)}>
                {GRAPE_VARIETIES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hectares</label>
              <input className="w-full p-2 border rounded" type="number" min={0.1} step={0.1} value={hectares} onChange={e => setHectares(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Density (vines/ha)</label>
              <input className="w-full p-2 border rounded" type="number" min={500} step={100} value={density} onChange={e => setDensity(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ripeness</label>
              <input className="w-full" type="range" min={0} max={1} step={0.01} value={ripeness} onChange={e => setRipeness(Number(e.target.value))} />
              <div className="text-xs text-gray-500">{formatNumber(ripeness, { decimals: 2, forceDecimals: true })}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Health</label>
              <input className="w-full" type="range" min={0} max={1} step={0.01} value={health} onChange={e => setHealth(Number(e.target.value))} />
              <div className="text-xs text-gray-500">{formatNumber(health, { decimals: 2, forceDecimals: true })}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vine Age (years)</label>
              <input className="w-full" type="range" min={0} max={50} step={1} value={vineAge} onChange={e => setVineAge(Number(e.target.value))} />
              <div className="text-xs text-gray-500">{vineAge} years (Vine Yield: {formatNumber(calculateBaselineVineYield(vineAge), { decimals: 2, forceDecimals: true })})</div>
            </div>
            <div className="flex items-end">
              <div className="text-sm space-y-1">
                <div>Current Yield: <span className="font-semibold">{formatNumber(currentYield, { decimals: 0 })} kg</span></div>
                <div>
                  Suitability (overall): <span className="font-semibold">{formatNumber(suitability, { decimals: 2, forceDecimals: true })}</span>
                  <div className="text-xs text-gray-500 mt-1">
                    Region match {formatNumber(suitabilityMetrics.region, { decimals: 2, forceDecimals: true })} • Altitude match {formatNumber(suitabilityMetrics.altitude, { decimals: 2, forceDecimals: true })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Yield vs Ripeness</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yieldVsRipeness}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ripeness" domain={[0, 1]} tickFormatter={(v) => formatNumber(v, { decimals: 1, forceDecimals: true })} />
                    <YAxis tickFormatter={(v) => formatNumber(v, { decimals: 0 }) + ' kg'} />
                    <RechartsTooltip 
                      formatter={(value: number) => [formatNumber(value, { decimals: 0 }), 'Yield (kg)']}
                      labelFormatter={(value: number) => `Ripeness: ${formatNumber(value, { decimals: 2, forceDecimals: true })}`}
                    />
                    <ReferenceLine x={ripeness} stroke="#16a34a" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="yieldKg" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Yield vs Age</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yieldVsAge}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="age" domain={[0, 200]} tickFormatter={(v) => `${v}y`} />
                    <YAxis tickFormatter={(v) => formatNumber(v, { decimals: 0 }) + ' kg'} />
                    <RechartsTooltip 
                      formatter={(value: number) => [formatNumber(value, { decimals: 0 }), 'Yield (kg)']}
                      labelFormatter={(value: number) => `Age: ${formatNumber(value, { decimals: 0 })} years`}
                    />
                    <ReferenceLine x={vineyardAge} stroke="#be123c" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="yieldKg" stroke="#e11d48" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Yield vs Hectares</h4>
              <div className="text-sm text-gray-600 mb-2">
                Includes grape–region suitability via the core yield function. Density fixed to current value; ripeness {formatNumber(ripeness, {decimals:2, forceDecimals:true})}, age {vineyardAge}y, health {formatNumber(health, {decimals:2, forceDecimals:true})}.
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yieldVsHectares}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hectares" tickFormatter={(v) => `${formatNumber(v, { decimals: 2 })} ha`} />
                    <YAxis tickFormatter={(v) => formatNumber(v, { decimals: 0 }) + ' kg'} />
                    <RechartsTooltip 
                      formatter={(value: number) => [formatNumber(value, { decimals: 0 }), 'Yield (kg)']}
                      labelFormatter={(value: number) => `Hectares: ${formatNumber(value, { decimals: 2 })} ha`}
                    />
                    <ReferenceLine x={hectares} stroke="#1d4ed8" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="yieldKg" stroke="#2563eb" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Vine Yield Progression (Baseline only) */}
          <div className="grid grid-cols-1 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Vine Yield Progression (with Min/Max Bands)</h4>
              <div className="text-sm text-gray-600 mb-2">
                Shows the expected vine yield progression over time with min/max bands representing the possible range from randomness in updateVineyardVineYields.
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={vineYieldProgression}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="age" domain={[0, 200]} tickFormatter={(v) => `${v}y`} />
                    <YAxis tickFormatter={(v) => formatNumber(v, { decimals: 2, forceDecimals: true })} />
                    <RechartsTooltip 
                      formatter={(value: number, name: string) => [
                        formatNumber(value, { decimals: 2, forceDecimals: true }), 
                        name === 'baseline' ? 'Baseline' : name === 'min' ? 'Min Possible' : 'Max Possible'
                      ]}
                      labelFormatter={(value: number) => `Age: ${formatNumber(value, { decimals: 0 })} years`}
                    />
                    <ReferenceLine x={vineyardAge} stroke="#9333ea" strokeDasharray="4 4" />
                    <Area 
                      type="monotone" 
                      dataKey="max" 
                      stroke="none" 
                      fill="#0ea5e9" 
                      fillOpacity={0.1}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="min" 
                      stroke="none" 
                      fill="#ffffff" 
                      fillOpacity={1}
                    />
                    <Line type="monotone" dataKey="baseline" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 2D Heatmap: Ripeness (X) × Age (Y) → Yield */}
          <div className="border rounded-lg p-6">
            <h4 className="text-lg font-semibold mb-2">Yield Heatmap (Ripeness × Age)</h4>
            <p className="text-sm text-gray-600 mb-4">
              Color shows yield (kg) for combinations of ripeness (X axis 0–1) and age (Y axis 0–200). Other parameters use current selections.
            </p>
            {
              (() => {
                // Build grid
                const ripenessSteps = 21; // 0..1 step 0.05
                const ageSteps = 21; // 0..200 step 10
                const cells: { r: number; a: number; y: number }[] = [];
                let minY = Number.POSITIVE_INFINITY;
                let maxY = 0;
                for (let i = 0; i < ageSteps; i++) {
                  const a = (i / (ageSteps - 1)) * 200;
                  const baselineVineYield = calculateBaselineVineYield(a);
                  for (let j = 0; j < ripenessSteps; j++) {
                    const r = (j / (ripenessSteps - 1));
                    const v = createVineyard({ country, region, grape, hectares, density, ripeness: r, vineAge: a, vineyardHealth: health, vineYield: baselineVineYield });
                    const y = calculateVineyardYield(v);
                    cells.push({ r, a, y });
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                  }
                }
                const range = Math.max(1, maxY - minY);
                const toColor = (y: number) => {
                  // Map yield to color: low=light, high=deep blue
                  const t = (y - minY) / range; // 0..1
                  const hue = 220; // blue
                  const sat = 85; // %
                  const light = 92 - Math.round(t * 60); // 92% → 32%
                  return `hsl(${hue} ${sat}% ${light}%)`;
                };
                return (
                  <div>
                    <div className="overflow-auto">
                      <div
                        className="grid"
                        style={{
                          gridTemplateColumns: `repeat(${ripenessSteps}, minmax(8px, 1fr))`,
                          gridTemplateRows: `repeat(${ageSteps}, minmax(8px, 1fr))`,
                          gap: 1
                        }}
                      >
                        {cells.map((c, idx) => (
                          <div
                            key={idx}
                            title={`Ripeness ${formatNumber(c.r, {decimals:2, forceDecimals:true})}, Age ${formatNumber(c.a, {decimals:0})}y\nYield ${formatNumber(c.y, {decimals:0})} kg`}
                            style={{ background: toColor(c.y) }}
                            className="w-4 h-4 md:w-5 md:h-5"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-600">
                      <div>Ripeness 0 → 1</div>
                      <div>Age 200y (top to bottom)</div>
                    </div>
                  </div>
                );
              })()
            }
          </div>
      </div>
    </SimpleCard>
  );
}

export default YieldProjectionTab;

