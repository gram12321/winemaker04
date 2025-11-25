import { useMemo } from 'react';
import { SimpleCard } from '@/components/ui';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { formatNumber } from '@/lib/utils/utils';
import { calculateSkewedMultiplier, calculateInvertedSkewedMultiplier, calculateAsymmetricalMultiplier, calculateSymmetricalMultiplier, vineyardAgePrestigeModifier, calculateAsymmetricalScaler01, NormalizeScrewed1000To01WithTail, Normalize1000To01WithTail, normalizeXP } from '@/lib/utils/calculator';
import { calculateVineyardYield } from '@/lib/services';
import { Vineyard, GrapeVariety } from '@/lib/types/types';
import { DEFAULT_VINE_DENSITY } from '@/lib/constants';

export function MathematicalModelsTab() {
  const chartData = useMemo(() => {
    const generateSkewedData = () => {
      const data = [];
      for (let i = 0; i <= 20; i++) {
        const x = i / 200;
        const y = calculateSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      for (let i = 1; i <= 30; i++) {
        const x = 0.1 + (i / 30) * 0.8;
        const y = calculateSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      for (let i = 1; i <= 20; i++) {
        const x = 0.9 + (i / 20) * 0.1;
        const y = calculateSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      return data;
    };

    const generateInvertedSkewedData = () => {
      const data = [];
      for (let i = 0; i <= 20; i++) {
        const x = i / 200;
        const y = calculateInvertedSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      for (let i = 1; i <= 30; i++) {
        const x = 0.1 + (i / 30) * 0.8;
        const y = calculateInvertedSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      for (let i = 1; i <= 20; i++) {
        const x = 0.9 + (i / 20) * 0.1;
        const y = calculateInvertedSkewedMultiplier(x);
        data.push({ input: x, output: y });
      }
      return data;
    };

    // Generate asymmetrical data with more points at high end (0.8-1.0)
    const generateAsymmetricalData = () => {
      const data = [];
      // Low to medium density (0-0.8): 30 points
      for (let i = 0; i <= 30; i++) {
        const x = (i / 30) * 0.8; // 0 to 0.8
        const y = calculateAsymmetricalMultiplier(x);
        data.push({ input: x, multiplier: y });
      }
      // High density at high end (0.8-1.0): 40 points
      for (let i = 1; i <= 40; i++) {
        const x = 0.8 + (i / 40) * 0.2; // 0.8 to 1.0
        const y = calculateAsymmetricalMultiplier(x);
        data.push({ input: x, multiplier: y });
      }
      return data;
    };

    // NEW: Generate 0-1 asymmetrical scaler data
    const generateAsymmetricalScalerData = () => {
      const data = [] as { input: number; output: number }[];
      // Emphasize 0-0.4 and 0.6-0.85 ranges
      for (let i = 0; i <= 50; i++) {
        const x = i / 50; // 0..1
        const y = calculateAsymmetricalScaler01(x);
        data.push({ input: x, output: y });
      }
      return data;
    };

    // Generate NormalizeScrewed1000To01WithTail data
    const generatePrestigeNormalizationData = () => {
      const data = [] as { prestige: number; normalized: number }[];

      // Dense points in early range (0-10): 30 points
      for (let i = 0; i <= 30; i++) {
        const prestige = (i / 30) * 10; // 0 to 10
        const normalized = NormalizeScrewed1000To01WithTail(prestige);
        data.push({ prestige, normalized });
      }

      // Medium density (10-100): 25 points
      for (let i = 1; i <= 25; i++) {
        const prestige = 10 + (i / 25) * 90; // 10 to 100
        const normalized = NormalizeScrewed1000To01WithTail(prestige);
        data.push({ prestige, normalized });
      }

      // High density (100-1000): 30 points
      for (let i = 1; i <= 30; i++) {
        const prestige = 100 + (i / 30) * 900; // 100 to 1000
        const normalized = NormalizeScrewed1000To01WithTail(prestige);
        data.push({ prestige, normalized });
      }

      // Very high range (1000-2000): 20 points
      for (let i = 1; i <= 20; i++) {
        const prestige = 1000 + (i / 20) * 1000; // 1000 to 2000
        const normalized = NormalizeScrewed1000To01WithTail(prestige);
        data.push({ prestige, normalized });
      }

      return data;
    };

    // Generate Normalize1000To01WithTail data (generic, not prestige-specific)
    const generateNormalizationDataNew = () => {
      const data = [] as { input: number; normalized: number }[];

      // Dense points in early range (0-10): 30 points
      for (let i = 0; i <= 30; i++) {
        const value = (i / 30) * 10; // 0 to 10
        const normalized = Normalize1000To01WithTail(value);
        data.push({ input: value, normalized });
      }

      // Medium density (10-100): 25 points
      for (let i = 1; i <= 25; i++) {
        const value = 10 + (i / 25) * 90; // 10 to 100
        const normalized = Normalize1000To01WithTail(value);
        data.push({ input: value, normalized });
      }

      // Higher resolution around 100-250: 30 points
      for (let i = 1; i <= 30; i++) {
        const value = 100 + (i / 30) * 150; // 100 to 250
        const normalized = Normalize1000To01WithTail(value);
        data.push({ input: value, normalized });
      }

      // 250-1000: 30 points
      for (let i = 1; i <= 30; i++) {
        const value = 250 + (i / 30) * 750; // 250 to 1000
        const normalized = Normalize1000To01WithTail(value);
        data.push({ input: value, normalized });
      }

      // Very high range (1000-2000): 20 points
      for (let i = 1; i <= 20; i++) {
        const value = 1000 + (i / 20) * 1000; // 1000 to 2000
        const normalized = Normalize1000To01WithTail(value);
        data.push({ input: value, normalized });
      }

      return data;
    };

    // Generate symmetrical data with more points at extremes (0-0.1 and 0.9-1.0)
    const generateSymmetricalData = () => {
      const data = [];
      // Dense points at low end (0-0.1): 20 points
      for (let i = 0; i <= 20; i++) {
        const x = i / 200; // 0 to 0.1
        const y = calculateSymmetricalMultiplier(x, 0.7, 1.3);
        data.push({ input: x, multiplier: y });
      }
      // Medium density in middle (0.1-0.9): 30 points
      for (let i = 1; i <= 30; i++) {
        const x = 0.1 + (i / 30) * 0.8; // 0.1 to 0.9
        const y = calculateSymmetricalMultiplier(x, 0.7, 1.3);
        data.push({ input: x, multiplier: y });
      }
      // Dense points at high end (0.9-1.0): 20 points
      for (let i = 1; i <= 20; i++) {
        const x = 0.9 + (i / 20) * 0.1; // 0.9 to 1.0
        const y = calculateSymmetricalMultiplier(x, 0.7, 1.3);
        data.push({ input: x, multiplier: y });
      }
      return data;
    };

    // Helper: construct a vineyard object for yield projection
    const createVineyard = (overrides: Partial<Vineyard>): Vineyard => ({
      id: 'test-vineyard',
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
    });

    // Generate prestige-by-age data extending to 200 years
    const generateAgeData = () => {
      const data = [];
      // More points in early years (0-25): 30 points
      for (let i = 0; i <= 30; i++) {
        const age = (i / 30) * 25; // 0 to 25 years
        const modifier = vineyardAgePrestigeModifier(age);
        data.push({ age, modifier });
      }
      // Medium density (25-100): 25 points
      for (let i = 1; i <= 25; i++) {
        const age = 25 + (i / 25) * 75; // 25 to 100 years
        const modifier = vineyardAgePrestigeModifier(age);
        data.push({ age, modifier });
      }
      // High density at high end (100-200): 20 points
      for (let i = 1; i <= 20; i++) {
        const age = 100 + (i / 20) * 100; // 100 to 200 years
        const modifier = vineyardAgePrestigeModifier(age);
        data.push({ age, modifier });
      }
      return data;
    };

    // Yield projection by ripeness (0..1) for a fixed age/density
    const generateYieldByRipeness = () => {
      const data = [] as { ripeness: number; yieldKg: number }[];
      for (let i = 0; i <= 40; i++) {
        const r = i / 40; // 0..1
        const vineyard = createVineyard({ ripeness: r, vineAge: 10, density: DEFAULT_VINE_DENSITY });
        data.push({ ripeness: r, yieldKg: calculateVineyardYield(vineyard) });
      }
      return data;
    };

    // Yield projection by age (0..200) at fixed ripeness/density
    const generateYieldByAge = () => {
      const data = [] as { age: number; yieldKg: number }[];
      for (let i = 0; i <= 40; i++) {
        const age = (i / 40) * 200; // 0..200
        const vineyard = createVineyard({ ripeness: 0.9, vineAge: age });
        data.push({ age, yieldKg: calculateVineyardYield(vineyard) });
      }
      return data;
    };

    return {
      skewedData: generateSkewedData(),
      invertedSkewedData: generateInvertedSkewedData(),
      asymmetricalData: generateAsymmetricalData(),
      asymmetricalScalerData: generateAsymmetricalScalerData(),
      symmetricalData: generateSymmetricalData(),
      ageData: generateAgeData(),
      yieldByRipeness: generateYieldByRipeness(),
      yieldByAge: generateYieldByAge(),
      prestigeNormalizationData: generatePrestigeNormalizationData(),
      normalizationDataNew: generateNormalizationDataNew(),
      xpProgressData: (() => {
        const data = [];
        // 10 XP to 1000 XP
        for (let i = 1; i <= 20; i++) {
          const x = i * 50;
          data.push({ input: x, output: normalizeXP(x) });
        }
        // 1k to 10k XP
        for (let i = 1; i <= 18; i++) {
          const x = 1000 + i * 500;
          data.push({ input: x, output: normalizeXP(x) });
        }
        // 10k to 100k XP
        for (let i = 1; i <= 18; i++) {
          const x = 10000 + i * 5000;
          data.push({ input: x, output: normalizeXP(x) });
        }
        // 100k to 1M XP
        for (let i = 1; i <= 18; i++) {
          const x = 100000 + i * 50000;
          data.push({ input: x, output: normalizeXP(x) });
        }
        // 1M to 5M XP
        for (let i = 1; i <= 10; i++) {
          const x = 1000000 + i * 400000;
          data.push({ input: x, output: normalizeXP(x) });
        }
        return data;
      })()
    };
  }, []); // Empty dependency array - only generate once

  return (
    <SimpleCard
      title="Mathematical Models"
      description="Advanced mathematical functions used throughout the game for realistic scaling and probability calculations"
    >
      <div className="space-y-8">

        {/* Skewed Multiplier */}
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Skewed Multiplier</h3>
          <p className="text-gray-600 mb-4">
            Maps 0-1 input to 0-1 output heavily skewed toward 0 with exponential approach to 1.
            Used for quality-based calculations where most values are low.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Input → Output Mappings:</h4>
              <div className="space-y-1 text-sm font-mono">
                <div>0.0 → 0.000</div>
                <div>0.1 → 0.015</div>
                <div>0.2 → 0.060</div>
                <div>0.3 → 0.135</div>
                <div>0.4 → 0.240</div>
                <div>0.5 → 0.370</div>
                <div>0.6 → 0.480</div>
                <div>0.7 → 0.560</div>
                <div>0.8 → 0.710</div>
                <div>0.9 → 0.860</div>
                <div>0.95 → 0.960</div>
                <div>0.99 → 0.992</div>
                <div>1.0 → 1.000</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Mathematical Progression:</h4>
              <div className="space-y-1 text-sm">
                <div>• 0.0-0.4: Polynomial (x² × 1.5)</div>
                <div>• 0.4-0.7: Logarithmic scaling</div>
                <div>• 0.7-0.9: Linear scaling</div>
                <div>• 0.9-0.95: Exponential</div>
                <div>• 0.95-0.99: Logistic curve</div>
                <div>• 0.99-1.0: Sigmoid</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Usage in Game:</h4>
              <div className="space-y-1 text-sm">
                <div>• <strong>Grape Quality Index</strong> - Converts grape quality score to 0-1 index</div>
                <div>• <strong>Customer Market Share</strong> - Generates realistic market share distribution</div>
                <div>• <strong>Order Rejection Probability</strong> - Calculates rejection probability based on price ratio</div>
              </div>
              <div className="mt-3">
                <h5 className="font-semibold mb-2">Curve Shape:</h5>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.skewedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="input" domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 1, forceDecimals: true })} />
                      <YAxis domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 2, forceDecimals: true })} />
                      <RechartsTooltip
                        formatter={(value: number) => [formatNumber(value, { decimals: 3, forceDecimals: true }), 'Output']}
                        labelFormatter={(value: number) => `Input: ${formatNumber(value, { decimals: 2, forceDecimals: true })}`}
                      />
                      <Line type="monotone" dataKey="output" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Normalize1000To01WithTail */}
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Normalization (Normalize1000To01WithTail)</h3>
          <p className="text-gray-600 mb-4">
            Converts raw values (0-1000+) to a normalized 0-1 scale with gentler low-end boost and the same high-tail compression as the original.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Input → Normalized Mappings (approx.):</h4>
              <div className="space-y-1 text-sm font-mono">
                <div>0 → 0.100</div>
                <div>10 → 0.200</div>
                <div>100 → 0.500</div>
                <div>250 → 0.900</div>
                <div>1000 → 0.950</div>
                <div>2000 → 0.999</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Usage in Game:</h4>
              <div className="space-y-1 text-sm">
                <div>• <strong>Alternative Normalization</strong> - Option with reduced low-end boost</div>
                <div>• <strong>Compatibility:</strong> Same tail compression for extreme values</div>
              </div>
              <div className="mt-3">
                <h5 className="font-semibold mb-2">Curve Shape:</h5>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.normalizationDataNew}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="input" domain={[0, 2000]} tickFormatter={(value) => formatNumber(value, { decimals: 0 })} />
                      <YAxis domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 2, forceDecimals: true })} />
                      <RechartsTooltip
                        formatter={(value: number) => [formatNumber(value, { decimals: 3, forceDecimals: true }), 'Normalized']}
                        labelFormatter={(value: number) => `Input: ${formatNumber(value, { decimals: 0 })}`}
                      />
                      <Line type="monotone" dataKey="normalized" stroke="#2563eb" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Intervals:</h4>
              <div className="space-y-1 text-sm">
                <div>• 0–10: ~0.1–0.2</div>
                <div>• 10–100: ~0.2–0.5</div>
                <div>• 100–250: ~0.5–0.9</div>
                <div>• 250–1000: ~0.9–0.95</div>
                <div>• 1000+: Tail compression to 0.999</div>
              </div>
            </div>
          </div>
        </div>

        {/* Inverted Skewed Multiplier */}
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Inverted Skewed Multiplier</h3>
          <p className="text-gray-600 mb-4">
            Mathematical inverse of Skewed Multiplier. Maps 0-1 input to 0-1 output heavily skewed toward 1.
            Used for market share penalties where small customers get high modifiers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Input → Output Mappings:</h4>
              <div className="space-y-1 text-sm font-mono">
                <div>0.0 → 1.000</div>
                <div>0.1 → 0.985</div>
                <div>0.2 → 0.940</div>
                <div>0.3 → 0.865</div>
                <div>0.4 → 0.760</div>
                <div>0.5 → 0.630</div>
                <div>0.6 → 0.520</div>
                <div>0.7 → 0.440</div>
                <div>0.8 → 0.290</div>
                <div>0.9 → 0.140</div>
                <div>0.95 → 0.040</div>
                <div>0.99 → 0.008</div>
                <div>1.0 → 0.000</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Usage in Game:</h4>
              <div className="space-y-1 text-sm">
                <div>• <strong>Customer Relationship.ts</strong> - Market share modifier for customer relationship calculation</div>
                <div>• <strong>Formula:</strong> marketShareModifier = 1 - calculateInvertedSkewedMultiplier(customer.marketShare)</div>
                <div>• <strong>Effect:</strong> Small customers (1% market share) get ~0.99 modifier, large customers (50%+) get ~0.4 modifier</div>
              </div>
              <div className="mt-3">
                <h5 className="font-semibold mb-2">Curve Shape:</h5>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.invertedSkewedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="input" domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 1, forceDecimals: true })} />
                      <YAxis domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 2, forceDecimals: true })} />
                      <RechartsTooltip
                        formatter={(value: number) => [formatNumber(value, { decimals: 3, forceDecimals: true }), 'Output']}
                        labelFormatter={(value: number) => `Input: ${formatNumber(value, { decimals: 2, forceDecimals: true })}`}
                      />
                      <Line type="monotone" dataKey="output" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Mathematical Properties:</h4>
              <div className="space-y-1 text-sm">
                <div>• Formula: 1 - calculateSkewedMultiplier(1 - score)</div>
                <div>• Perfect inverse of Skewed Multiplier</div>
                <div>• Small inputs → High outputs</div>
                <div>• Large inputs → Low outputs</div>
                <div>• Ideal for penalty systems</div>
              </div>
            </div>
          </div>
        </div>

        {/* Asymmetrical Multiplier */}
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Asymmetrical Multiplier</h3>
          <p className="text-gray-600 mb-4">
            Asymmetrical multiplier using multi-segment scaling with smooth transitions.
            Maps 0–1 input values to multipliers using polynomial → logarithmic → linear → exponential → strong exponential → super-exponential progression.

            This creates a continuously rising, asymmetrical distribution where:
            • Low values (0–0.3) get modest multipliers
            • Medium values (0.3–0.6) achieve steady improvement
            • High values (0.6–0.8) gain strong multipliers
            • Very high values (0.8–0.9) reach powerful boosts
            • Excellent values (0.9–0.95) show steep exponential escalation
            • Exceptional values (0.95–0.98) surge through strong super-exponential growth
            • Legendary values (0.98–1.0) enter astronomical scaling — capped for safety

            Generic function for any asymmetrical scaling need (quality multipliers, bonus rewards, prestige scoring, etc.)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Input → Output Mappings (approximate):</h4>
              <div className="space-y-1 text-sm font-mono">
                <div>0.0 → 1.00×</div>
                <div>0.1 → 1.02×</div>
                <div>0.2 → 1.08×</div>
                <div>0.3 → 1.18×</div>
                <div>0.4 → 1.35×</div>
                <div>0.5 → 1.55×</div>
                <div>0.6 → 1.78×</div>
                <div>0.7 → 2.28×</div>
                <div>0.8 → 2.78×</div>
                <div>0.85 → 3.78×</div>
                <div>0.9 → 5.28×</div>
                <div>0.92 → 8.28×</div>
                <div>0.95 → 15.28×</div>
                <div>0.96 → 25.28×</div>
                <div>0.98 → 55.28×</div>
                <div>0.99 → ≈ 5,000×</div>
                <div>0.999 → ≈ 500,000×</div>
                <div>1.0 → 50,000,000× (capped)</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Usage in Game:</h4>
              <div className="space-y-1 text-sm">
                <div>• <strong>Wine Pricing</strong> - Quality multiplier for final wine price calculation</div>
                <div>• <strong>Formula:</strong> finalPrice = basePrice × calculateAsymmetricalMultiplier(qualityIndex)</div>
                <div>• <strong>Example:</strong> 0.95 quality wine gets 15.28x price multiplier, 0.99 quality gets 5,000x multiplier</div>
              </div>
              <div className="mt-3">
                <h5 className="font-semibold mb-2">Curve Shape:</h5>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.asymmetricalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="input" domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 1, forceDecimals: true })} />
                      <YAxis scale="log" domain={[1, 100000000]} tickFormatter={(value) => {
                        if (value >= 1000000) return `${formatNumber(value / 1000000, { decimals: 0, forceDecimals: true })}M`;
                        if (value >= 1000) return `${formatNumber(value / 1000, { decimals: 0, forceDecimals: true })}K`;
                        return formatNumber(value, { decimals: 0, forceDecimals: true });
                      }} />
                      <RechartsTooltip
                        formatter={(value: number) => [formatNumber(value, { decimals: 1, forceDecimals: true }) + 'x', 'Multiplier']}
                        labelFormatter={(value: number) => `Input: ${formatNumber(value, { decimals: 2, forceDecimals: true })}`}
                      />
                      <Line type="monotone" dataKey="multiplier" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Mathematical progression by segment:</h4>
              <div className="space-y-1 text-sm">
                <div>• 0.0–0.3: Polynomial (x² × 2 + 1.0)</div>
                <div>• 0.3–0.6: Logarithmic scaling</div>
                <div>• 0.6–0.8: Linear scaling</div>
                <div>• 0.8–0.9: Exponential growth</div>
                <div>• 0.9–0.95: Strong exponential</div>
                <div>• 0.95–0.98: Very strong exponential</div>
                <div>• 0.98–1.0: Calibrated dual-segment super-exponential growth (safely capped at 50 M×)</div>
              </div>
            </div>
          </div>
        </div>

        {/* NEW: Asymmetrical 0-1 Scaler */}
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Asymmetrical 0-1 Scaler</h3>
          <p className="text-gray-600 mb-4">
            Maps 0-1 → 0-1 with fast rise around 0.3-0.4 and early saturation by ~0.75.
            Used for land value normalization (landValue / maxGlobalValue).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Input → Output (approx):</h4>
              <div className="space-y-1 text-sm font-mono">
                <div>0.0 → 0.00</div>
                <div>0.1 → 0.02</div>
                <div>0.2 → 0.10</div>
                <div>0.35 → 0.50</div>
                <div>0.6 → 0.80</div>
                <div>0.75 → 0.98</div>
                <div>0.85 → 0.995</div>
                <div>1.0 → 1.00</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Usage in Game:</h4>
              <div className="space-y-1 text-sm">
                <div>• <strong>Land Value Normalization</strong> - Quality index land factor</div>
                <div>• <strong>Formula:</strong> normalized = calculateAsymmetricalScaler01(landValue / maxGlobalValue)</div>
              </div>
              <div className="mt-3">
                <h5 className="font-semibold mb-2">Curve Shape:</h5>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.asymmetricalScalerData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="input" domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 1, forceDecimals: true })} />
                      <YAxis domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 2, forceDecimals: true })} />
                      <RechartsTooltip
                        formatter={(value: number) => [formatNumber(value, { decimals: 3, forceDecimals: true }), 'Output']}
                        labelFormatter={(value: number) => `Input: ${formatNumber(value, { decimals: 2, forceDecimals: true })}`}
                      />
                      <Line type="monotone" dataKey="output" stroke="#dc2626" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Properties:</h4>
              <div className="space-y-1 text-sm">
                <div>• 0-1 input → 0-1 output</div>
                <div>• Monotonic increasing</div>
                <div>• Adjustable breakpoints for tuning</div>
                <div>• Early saturation for premium tiers</div>
              </div>
            </div>
          </div>
        </div>

        {/* NormalizeScrewed1000To01WithTail */}
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Prestige Normalization (NormalizeScrewed1000To01WithTail)</h3>
          <p className="text-gray-600 mb-4">
            Converts raw prestige values (0-1000+) to a normalized 0-1 scale with "screwed" distribution and tail compression.
            Designed to make both low and high prestige values meaningful while compressing extreme values.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Prestige → Normalized Mappings:</h4>
              <div className="space-y-1 text-sm font-mono">
                <div>0 → 0.100</div>
                <div>1 → 0.195</div>
                <div>5 → 0.445</div>
                <div>10 → 0.700</div>
                <div>50 → 0.822</div>
                <div>100 → 0.900</div>
                <div>500 → 0.953</div>
                <div>1000 → 0.980</div>
                <div>2000 → 0.999</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Usage in Game:</h4>
              <div className="space-y-1 text-sm">
                <div>• <strong>Customer Relationships</strong> - Normalize company prestige for relationship calculations</div>
                <div>• <strong>Wine Pricing</strong> - Add company/vineyard prestige bonuses to wine prices</div>
                <div>• <strong>Prestige Scaling</strong> - Used in prestige calculator for event impact scaling</div>
                <div>• <strong>Land Search</strong> - Normalize company prestige for region probability calculations</div>
              </div>
              <div className="mt-3">
                <h5 className="font-semibold mb-2">Curve Shape:</h5>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.prestigeNormalizationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="prestige" domain={[0, 2000]} tickFormatter={(value) => formatNumber(value, { decimals: 0 })} />
                      <YAxis domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 2, forceDecimals: true })} />
                      <RechartsTooltip
                        formatter={(value: number) => [formatNumber(value, { decimals: 3, forceDecimals: true }), 'Normalized']}
                        labelFormatter={(value: number) => `Prestige: ${formatNumber(value, { decimals: 0 })}`}
                      />
                      <Line type="monotone" dataKey="normalized" stroke="#7c3aed" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Mathematical Segments:</h4>
              <div className="space-y-1 text-sm">
                <div>• 0-10: Polynomial (0.1 + 0.6×x^0.8)</div>
                <div>• 10-100: Logarithmic (0.7 + 0.2×log)</div>
                <div>• 100-1000: Square root (0.9 + 0.08×√x)</div>
                <div>• 1000+: Tail compression (0.98 + 0.02×x)</div>
                <div>• Output range: 0.1 to 0.999</div>
                <div>• Designed for meaningful scaling</div>
              </div>
              <div className="mt-3">
                <h5 className="font-semibold mb-2">Key Properties:</h5>
                <div className="space-y-1 text-sm">
                  <div>• Low prestige (1-10): Gets 0.1-0.7 range</div>
                  <div>• Medium prestige (10-100): Gets 0.7-0.9 range</div>
                  <div>• High prestige (100-1000): Gets 0.9-0.98 range</div>
                  <div>• Extreme prestige (1000+): Compressed tail</div>
                  <div>• Consistent across all game systems</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Symmetrical Multiplier */}
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Symmetrical Multiplier</h3>
          <p className="text-gray-600 mb-4">
            Creates bell curve distribution where input 0.5 maps to exactly 1.0x multiplier.
            Most values cluster around 1.0x with rare extremes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Input → Output Mappings (0.7-1.3 range):</h4>
              <div className="space-y-1 text-sm font-mono">
                <div>0.0 → 0.701x</div>
                <div>0.1 → 0.85x</div>
                <div>0.2 → 0.95x</div>
                <div>0.3 → 0.98x</div>
                <div>0.4 → 0.99x</div>
                <div>0.5 → 1.00x</div>
                <div>0.6 → 0.99x</div>
                <div>0.7 → 0.98x</div>
                <div>0.8 → 0.95x</div>
                <div>0.9 → 0.85x</div>
                <div>1.0 → 0.701x</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Usage in Game:</h4>
              <div className="space-y-1 text-sm">
                <div>• <strong>Currently Unused</strong> - Available for future features</div>
              </div>
              <div className="mt-3">
                <h5 className="font-semibold mb-2">Curve Shape:</h5>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.symmetricalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="input" domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 1, forceDecimals: true })} />
                      <YAxis domain={[0.7, 1.3]} allowDataOverflow={false} tickFormatter={(value) => formatNumber(value, { decimals: 2, forceDecimals: true }) + 'x'} />
                      <RechartsTooltip
                        formatter={(value: number) => [formatNumber(value, { decimals: 2, forceDecimals: true }) + 'x', 'Multiplier']}
                        labelFormatter={(value: number) => `Input: ${formatNumber(value, { decimals: 2, forceDecimals: true })}`}
                      />
                      <Line type="monotone" dataKey="multiplier" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Features:</h4>
              <div className="space-y-1 text-sm">
                <div>• Perfect symmetry around 0.5</div>
                <div>• Bell curve distribution</div>
                <div>• Configurable min/max range</div>
                <div>• Smooth transitions</div>
                <div>• Ideal for balanced systems</div>
              </div>
            </div>
          </div>
        </div>

        {/* Vineyard Age Prestige Modifier */}
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Vineyard Age Prestige Modifier</h3>
          <p className="text-gray-600 mb-4">
            Calculates prestige modifier based on vine age using different mathematical approaches for different age ranges.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Age → Modifier Mappings:</h4>
              <div className="space-y-1 text-sm font-mono">
                <div>0 years → 0.01</div>
                <div>1 year → 0.02</div>
                <div>3 years → 0.10</div>
                <div>10 years → 0.26</div>
                <div>25 years → 0.50</div>
                <div>50 years → 0.80</div>
                <div>100 years → 0.95</div>
                <div>200+ years → 0.95</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Usage in Game:</h4>
              <div className="space-y-1 text-sm">
                <div>• <strong>Vineyard Value Calculation</strong> - Age contribution (30% of vineyard value calculation)</div>
                <div>• <strong>Formula:</strong> ageContribution = vineyardAgePrestigeModifier(vineyard.vineAge) × 0.3</div>
                <div>• <strong>Effect:</strong> 25-year-old vines contribute 0.15 to vineyard value, 100-year-old vines contribute 0.285</div>
              </div>
              <div className="mt-3">
                <h5 className="font-semibold mb-2">Curve Shape:</h5>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.ageData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="age" domain={[0, 200]} tickFormatter={(value) => `${value}y`} />
                      <YAxis domain={[0, 1]} tickFormatter={(value) => formatNumber(value, { decimals: 2, forceDecimals: true })} />
                      <RechartsTooltip
                        formatter={(value: number) => [formatNumber(value, { decimals: 3, forceDecimals: true }), 'Modifier']}
                        labelFormatter={(value: number) => `Age: ${value} years`}
                      />
                      <Line type="monotone" dataKey="modifier" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Mathematical Progression:</h4>
              <div className="space-y-1 text-sm">
                <div>• 0-3 years: Polynomial (x²/100 + 0.01)</div>
                <div>• 3-25 years: Linear progression</div>
                <div>• 25-100 years: Arctangent curve</div>
                <div>• 100+ years: Capped at 0.95</div>
                <div>• Realistic aging simulation</div>
              </div>
            </div>
          </div>
        </div>


        {/* Yield Projection (Ripeness and Age) */}
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Yield Projection</h3>
          <p className="text-gray-600 mb-4">
            Expected harvest yield (kg) under fixed assumptions (1 ha, density {DEFAULT_VINE_DENSITY}, Chardonnay, Bordeaux, health 1.0).
            Charts show how yield scales with ripeness and age independently.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Yield vs Ripeness</h4>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.yieldByRipeness}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ripeness" domain={[0, 1]} tickFormatter={(v) => formatNumber(v, { decimals: 1, forceDecimals: true })} />
                    <YAxis tickFormatter={(v) => formatNumber(v, { decimals: 0 }) + ' kg'} />
                    <RechartsTooltip
                      formatter={(value: number) => [formatNumber(value, { decimals: 0 }), 'Yield (kg)']}
                      labelFormatter={(value: number) => `Ripeness: ${formatNumber(value, { decimals: 2, forceDecimals: true })}`}
                    />
                    <Line type="monotone" dataKey="yieldKg" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Yield vs Age</h4>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.yieldByAge}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="age" domain={[0, 200]} tickFormatter={(v) => `${v}y`} />
                    <YAxis tickFormatter={(v) => formatNumber(v, { decimals: 0 }) + ' kg'} />
                    <RechartsTooltip
                      formatter={(value: number) => [formatNumber(value, { decimals: 0 }), 'Yield (kg)']}
                      labelFormatter={(value: number) => `Age: ${formatNumber(value, { decimals: 0 })} years`}
                    />
                    <Line type="monotone" dataKey="yieldKg" stroke="#e11d48" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
        {/* XP Progress Model */}
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">XP Progress Model (normalizeXP)</h3>
          <p className="text-gray-600 mb-4">
            Calculates visual progress (0-1) based on normalized XP (XP/1000).
            Designed to provide visible progress for early game (25 XP) while scaling to accommodate millions of XP in the late game without maxing out.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">XP → Progress Mappings:</h4>
              <div className="space-y-1 text-sm font-mono">
                <div>0 XP → 0%</div>
                <div>25 XP → ~1.9% (Visible start)</div>
                <div>1,000 XP → 25% (1 Year)</div>
                <div>10,000 XP → 60% (Veteran)</div>
                <div>100,000 XP → 85% (Expert)</div>
                <div>1,000,000 XP → 95% (Master)</div>
                <div>&gt;1M XP → Approaches 100%</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Mathematical Segments:</h4>
              <div className="space-y-1 text-sm">
                <div>• 0-1k: Power curve (0.25 * x^0.7)</div>
                <div>• 1k-10k: Logarithmic (0.25 + 0.35 * log10)</div>
                <div>• 10k-100k: Logarithmic (0.60 + 0.25 * log10)</div>
                <div>• 100k-1M: Slow Log (0.85 + 0.10 * log10)</div>
                <div>• &gt;1M: Tail Squashing</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SimpleCard>
  );
}
