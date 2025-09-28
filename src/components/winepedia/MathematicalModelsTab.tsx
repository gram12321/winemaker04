import { useMemo } from 'react';
import { SimpleCard } from '../ui';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { formatNumber } from '@/lib/utils/utils';
import { 
  calculateSkewedMultiplier, 
  calculateInvertedSkewedMultiplier, 
  calculateAsymmetricalMultiplier, 
  calculateSymmetricalMultiplier, 
  vineyardAgePrestigeModifier
} from '@/lib/utils/calculator';
import { calculateVineyardYield } from '@/lib/services/vineyard/vineyardManager';
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
      symmetricalData: generateSymmetricalData(),
      ageData: generateAgeData(),
      yieldByRipeness: generateYieldByRipeness(),
      yieldByAge: generateYieldByAge()
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
                  <div>• <strong>Wine Quality Index</strong> - Converts combined wine quality score to 0-1 index</div>
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
              Creates asymmetrical distribution with modest multipliers for low values and astronomical multipliers for extreme values.
              Used for quality multipliers and rejection probabilities.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Input → Output Mappings:</h4>
                <div className="space-y-1 text-sm font-mono">
                  <div>0.0 → 1.0x</div>
                  <div>0.1 → 1.02x</div>
                  <div>0.2 → 1.08x</div>
                  <div>0.3 → 1.18x</div>
                  <div>0.4 → 1.35x</div>
                  <div>0.5 → 1.55x</div>
                  <div>0.6 → 1.78x</div>
                  <div>0.7 → 2.28x</div>
                  <div>0.8 → 2.78x</div>
                  <div>0.9 → 5.28x</div>
                  <div>0.95 → 15.28x</div>
                  <div>0.98 → 55.28x</div>
                  <div>0.99 → 5,000x</div>
                  <div>1.0 → 50,000,000x</div>
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
                          if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                          if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                          return value.toFixed(0);
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
                <h4 className="font-semibold mb-2">Mathematical Progression:</h4>
                <div className="space-y-1 text-sm">
                  <div>• 0.0-0.3: Polynomial (x² × 2 + 1.0)</div>
                  <div>• 0.3-0.6: Logarithmic scaling</div>
                  <div>• 0.6-0.8: Linear scaling</div>
                  <div>• 0.8-0.9: Exponential</div>
                  <div>• 0.9-0.95: Strong exponential</div>
                  <div>• 0.95-0.98: Very strong exponential</div>
                  <div>• 0.98-1.0: Unlimited exponential</div>
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
        </div>
    </SimpleCard>
  );
}
