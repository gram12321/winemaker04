import React, { useState } from 'react';
import { DYNAMIC_ADJUSTMENTS, SYNERGY_RULES } from '@/lib/constants/balanceAdjustments';
import { WineCharacteristics } from '@/lib/types/types';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import { calculateWineBalance, getSynergyReductions } from '@/lib/services/wine/balanceCalculator';
import { WineCharacteristicsDisplay } from '@/components/ui/components/characteristicBar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/shadCN/tooltip';

export const CrossTraitPenaltyTab: React.FC = () => {
  // Start each characteristic at its balanced range midpoint
  const [characteristics, setCharacteristics] = useState<WineCharacteristics>({
    acidity: (BASE_BALANCED_RANGES.acidity[0] + BASE_BALANCED_RANGES.acidity[1]) / 2, // 0.5
    aroma: (BASE_BALANCED_RANGES.aroma[0] + BASE_BALANCED_RANGES.aroma[1]) / 2, // 0.5
    body: (BASE_BALANCED_RANGES.body[0] + BASE_BALANCED_RANGES.body[1]) / 2, // 0.6
    spice: (BASE_BALANCED_RANGES.spice[0] + BASE_BALANCED_RANGES.spice[1]) / 2, // 0.5
    sweetness: (BASE_BALANCED_RANGES.sweetness[0] + BASE_BALANCED_RANGES.sweetness[1]) / 2, // 0.5
    tannins: (BASE_BALANCED_RANGES.tannins[0] + BASE_BALANCED_RANGES.tannins[1]) / 2 // 0.5
  });

  // Track hover state for visual connections
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);

  const updateCharacteristic = (key: keyof WineCharacteristics, value: number) => {
    setCharacteristics(prev => ({ ...prev, [key]: value }));
  };

  // Calculate penalty scaling for each characteristic
  const calculatePenaltyScaling = () => {
    const scaling: Record<string, Record<string, number>> = {};
    
    for (const [source, dirs] of Object.entries(DYNAMIC_ADJUSTMENTS)) {
      const sourceValue = characteristics[source as keyof WineCharacteristics];
      // Use the true base balanced range for this characteristic
      const [min, max] = BASE_BALANCED_RANGES[source as keyof WineCharacteristics];
      const midpoint = (min + max) / 2;
      const halfWidth = Math.max(0.0001, (max - min) / 2);
      const deviation = (sourceValue - midpoint) / halfWidth;
      
      scaling[source] = {};
      
      for (const dir of ['above', 'below'] as const) {
        const set = (dirs as any)[dir];
        const rules = set?.penaltyScales || [];
        
        for (const rule of rules) {
          const target = rule.target;
          const k = rule.k;
          const p = rule.p ?? 1;
          const cap = rule.cap;
          
          let multiplier = 1;
          if (dir === 'above' && deviation > 0) {
            multiplier = 1 + k * Math.pow(Math.abs(deviation), p);
          } else if (dir === 'below' && deviation < 0) {
            multiplier = 1 + k * Math.pow(Math.abs(deviation), p);
          }
          
          if (cap) {
            multiplier = Math.max(cap[0], Math.min(cap[1], multiplier));
          }
          
          scaling[source][target] = multiplier;
        }
      }
    }
    
    return scaling;
  };

  const penaltyScaling = calculatePenaltyScaling();
  const balanceResult = calculateWineBalance(characteristics);
  const synergyReductions = getSynergyReductions(characteristics);

  // Get active synergies for a given characteristic
  const getActiveSynergies = (char: string) => {
    const synergies: string[] = [];
    
    for (const rule of SYNERGY_RULES) {
      if (rule.condition(characteristics) && rule.characteristics.includes(char as keyof WineCharacteristics)) {
        const otherChars = rule.characteristics.filter(c => c !== char);
        synergies.push(otherChars.join(' + '));
      }
    }
    
    return synergies;
  };

  // Get active targets for a given source (for hover visualization)
  const getActiveTargets = (source: string) => {
    const targets: string[] = [];
    const sourceValue = characteristics[source as keyof WineCharacteristics];
    const [min, max] = BASE_BALANCED_RANGES[source as keyof WineCharacteristics];
    const midpoint = (min + max) / 2;
    const halfWidth = Math.max(0.0001, (max - min) / 2);
    const deviation = (sourceValue - midpoint) / halfWidth;
    
    const sourceRules = DYNAMIC_ADJUSTMENTS[source as keyof WineCharacteristics];
    if (!sourceRules) return targets;
    
    for (const dir of ['above', 'below'] as const) {
      const set = sourceRules[dir];
      const rules = set?.penaltyScales || [];
      
      for (const rule of rules) {
        const isActive = (dir === 'above' && deviation > 0) || (dir === 'below' && deviation < 0);
        if (isActive && !targets.includes(rule.target)) {
          targets.push(rule.target);
        }
      }
    }
    
    return targets;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Cross-Trait Scaling (applied to TotalDistance)</h2>
        <p className="text-sm text-gray-600 mt-1">
          Some characteristics make the TotalDistance of other characteristics harsher when they deviate
          from their midpoints. Additionally, good characteristic combinations provide synergy reductions
          that make penalties less harsh. TotalDistance = DistanceInside + Penalty, where Penalty = 2 × DistanceOutside.
          This reflects how traits interact in real wines (e.g., high acidity with high tannins is more acceptable
          than either alone).
        </p>
      </section>

      <section>
        <h3 className="text-lg font-medium">Interactive Penalty Scaling</h3>
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600">
            Adjust characteristics below to see how they affect penalty scaling on other traits.
          </p>
          <button
            onClick={() => setCharacteristics({
              acidity: (BASE_BALANCED_RANGES.acidity[0] + BASE_BALANCED_RANGES.acidity[1]) / 2,
              aroma: (BASE_BALANCED_RANGES.aroma[0] + BASE_BALANCED_RANGES.aroma[1]) / 2,
              body: (BASE_BALANCED_RANGES.body[0] + BASE_BALANCED_RANGES.body[1]) / 2,
              spice: (BASE_BALANCED_RANGES.spice[0] + BASE_BALANCED_RANGES.spice[1]) / 2,
              sweetness: (BASE_BALANCED_RANGES.sweetness[0] + BASE_BALANCED_RANGES.sweetness[1]) / 2,
              tannins: (BASE_BALANCED_RANGES.tannins[0] + BASE_BALANCED_RANGES.tannins[1]) / 2
            })}
            className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
          >
            Reset to Midpoints
          </button>
        </div>
        
        <div className="space-y-3">
          {Object.entries(characteristics).map(([key, value]) => (
            <div key={key} className="flex items-center gap-4">
              <div className="w-20 flex items-center gap-2">
                <img 
                  src={`/assets/icons/characteristics/${key}.png`} 
                  alt={`${key} icon`} 
                  className="w-4 h-4 opacity-80" 
                />
                <span className="text-sm font-medium capitalize">{key}</span>
              </div>
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={value}
                  onChange={(e) => updateCharacteristic(key as keyof WineCharacteristics, parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
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
        <h3 className="text-lg font-medium">Live Balance Calculation</h3>
        <div className="p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Current Balance Score:</span>
            <span className={`text-2xl font-bold ${balanceResult.score > 0.8 ? 'text-green-600' : balanceResult.score > 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
              {Math.round(balanceResult.score * 100)}%
            </span>
          </div>
          <WineCharacteristicsDisplay 
            characteristics={characteristics}
            adjustedRanges={balanceResult.dynamicRanges}
            showValues={true}
            title="Wine Characteristics"
            collapsible={false}
          />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-medium">Balance Score Breakdown</h3>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(characteristics).map(([key, value]) => {
              const charKey = key as keyof WineCharacteristics;
              const [min, max] = balanceResult.dynamicRanges[charKey];
              const midpoint = (min + max) / 2;
              
              // Calculate components
              const distanceInside = Math.abs(value - midpoint);
              const distanceOutside = value < min ? (min - value) : (value > max ? (value - max) : 0);
              const penalty = 2 * distanceOutside;
              const baseTotalDistance = distanceInside + penalty;
              
              // Apply cross-trait scaling from all sources
              let totalScalingMultiplier = 1;
              for (const [, targets] of Object.entries(penaltyScaling)) {
                if (targets[key] !== undefined) {
                  totalScalingMultiplier *= targets[key];
                }
              }
              let finalTotalDistance = baseTotalDistance * totalScalingMultiplier;
              
              // Apply synergy reduction
              const synergyReduction = synergyReductions[key as keyof WineCharacteristics];
              if (synergyReduction > 0) {
                finalTotalDistance *= (1 - synergyReduction);
              }
              
              const activeTargets = getActiveTargets(key);
              const activeSynergies = getActiveSynergies(key);
              const isHovered = hoveredSource === key;
              const isTargetOfHover = hoveredSource && getActiveTargets(hoveredSource).includes(key);
              const hasSynergyWithHover = hoveredSource && 
                SYNERGY_RULES.some(rule => 
                  rule.condition(characteristics) && 
                  rule.characteristics.includes(key as keyof WineCharacteristics) &&
                  rule.characteristics.includes(hoveredSource as keyof WineCharacteristics)
                );
              
              return (
                <div 
                  key={key} 
                  className={`p-3 bg-white rounded border transition-all duration-200 ${
                    isTargetOfHover ? 'border-red-400 shadow-red-200 shadow-lg' : 
                    hasSynergyWithHover ? 'border-yellow-400 shadow-yellow-200 shadow-lg' : 
                    'border-gray-200'
                  }`}
                  onMouseEnter={() => setHoveredSource(key)}
                  onMouseLeave={() => setHoveredSource(null)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <img src={`/assets/icons/characteristics/${key}.png`} alt={`${key} icon`} className="w-4 h-4 opacity-80" />
                    <span className="font-medium capitalize">{key}</span>
                    <span className="text-sm text-gray-600">({Math.round(value * 100)}%)</span>
                    {isHovered && (activeTargets.length > 0 || activeSynergies.length > 0) && (
                      <div className="absolute right-2 top-2 z-10">
                        {activeTargets.map((target) => (
                          <div key={target} className="flex items-center gap-1 mb-1">
                            <div className="w-6 h-0.5 bg-red-500"></div>
                            <div className="w-0 h-0 border-l-3 border-l-red-500 border-t-1.5 border-t-transparent border-b-1.5 border-b-transparent"></div>
                            <img 
                              src={`/assets/icons/characteristics/${target}.png`} 
                              alt={`${target} icon`} 
                              className="w-3 h-3 opacity-80" 
                            />
                          </div>
                        ))}
                        {activeSynergies.map((synergy) => (
                          <div key={synergy} className="flex items-center gap-1 mb-1">
                            <div className="w-6 h-0.5 bg-yellow-500"></div>
                            <div className="w-0 h-0 border-l-3 border-l-yellow-500 border-t-1.5 border-t-transparent border-b-1.5 border-b-transparent"></div>
                            <span className="text-xs text-yellow-600 font-medium">{synergy}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>DistanceInside:</span>
                      <span className="font-mono">{distanceInside.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DistanceOutside:</span>
                      <span className="font-mono">{distanceOutside.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Penalty (2×Outside):</span>
                      <span className="font-mono">{penalty.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Base TotalDistance:</span>
                      <span className="font-mono">{baseTotalDistance.toFixed(3)}</span>
                    </div>
                    {(totalScalingMultiplier !== 1 || synergyReduction > 0) && (
                      <div className="space-y-1">
                        {totalScalingMultiplier !== 1 && (
                          <div className="flex justify-between">
                            <span>Cross-trait scaling:</span>
                            <span className={`font-mono ${totalScalingMultiplier > 1 ? 'text-red-600' : 'text-green-600'}`}>
                              {totalScalingMultiplier.toFixed(2)}x
                            </span>
                          </div>
                        )}
                        {synergyReduction > 0 && (
                          <div className="flex justify-between">
                            <span>Synergy reduction:</span>
                            <span className="font-mono text-yellow-600">
                              -{(synergyReduction * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {Object.entries(penaltyScaling).map(([source, targets]) => {
                            if (!targets[key]) return null;
                            const sourceValue = characteristics[source as keyof WineCharacteristics];
                            const [min, max] = BASE_BALANCED_RANGES[source as keyof WineCharacteristics];
                            const midpoint = (min + max) / 2;
                            const halfWidth = (max - min) / 2;
                            const deviation = Math.abs(sourceValue - midpoint) / halfWidth;
                            const isAbove = sourceValue > midpoint;
                            
                            // Find the rule that applies
                            const sourceRules = DYNAMIC_ADJUSTMENTS[source as keyof WineCharacteristics];
                            const direction = isAbove ? 'above' : 'below';
                            const rules = sourceRules?.[direction]?.penaltyScales || [];
                            const rule = rules.find((r: any) => r.target === key);
                            
                            if (!rule) return null;
                            
                            // Calculate the linear strength that would give us this scaling factor
                            const actualScaling = targets[key];
                            const linearStrength = (actualScaling - 1) / deviation;
                            
                            const tooltip = `Deviation = |[${source.charAt(0).toUpperCase() + source.slice(1)}] - [${source.charAt(0).toUpperCase() + source.slice(1)}Midpoint]| / [${key.charAt(0).toUpperCase() + key.slice(1)}RangeWidth]
Deviation = |${Math.round(sourceValue * 100)}% - ${Math.round(midpoint * 100)}%| / ${Math.round(halfWidth * 100)}% = ${deviation.toFixed(2)}
Strength: ${linearStrength.toFixed(2)}x (per unit deviation)
Penalty scaling = ${deviation.toFixed(2)} × ${linearStrength.toFixed(2)}x = ${actualScaling.toFixed(2)}x
Base penalty: ${baseTotalDistance.toFixed(3)} → Scaled penalty: ${(baseTotalDistance * actualScaling).toFixed(3)}`;
                            
                            return (
                              <div 
                                key={source}
                                className="flex items-center gap-1"
                                title={tooltip}
                              >
                                <span className="capitalize">{source} ({Math.round(sourceValue * 100)}%):</span>
                                <span className={`font-mono ${targets[key] > 1 ? 'text-red-600' : 'text-green-600'}`}>
                                  {targets[key].toFixed(2)}x
                                </span>
                                <span className="text-gray-500">({isAbove ? '↑' : '↓'})</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span>Final TotalDistance:</span>
                      <span className="font-mono">{finalTotalDistance.toFixed(3)}</span>
                    </div>
                    
                    {/* Show all rules from this characteristic */}
                    <div className="mt-2 pt-2 border-t">
                      <div className="text-xs font-medium text-gray-600 mb-1">Rules from {key}:</div>
                      <div className="space-y-1">
                        {(() => {
                          const sourceRules = DYNAMIC_ADJUSTMENTS[key as keyof WineCharacteristics];
                          if (!sourceRules) return null;
                          
                          const rules = [];
                          for (const dir of ['above', 'below'] as const) {
                            const set = sourceRules[dir];
                            const penaltyRules = set?.penaltyScales || [];
                            for (const rule of penaltyRules) {
                              rules.push({ direction: dir, rule });
                            }
                          }
                          if (rules.length === 0) return null;
                          
                          const sourceValue = characteristics[key as keyof WineCharacteristics];
                          const [min, max] = BASE_BALANCED_RANGES[key as keyof WineCharacteristics];
                          const midpoint = (min + max) / 2;
                          const isAbove = sourceValue > midpoint;
                          const isBelow = sourceValue < midpoint;
                          
                          const penaltyRuleElements = rules.map(({ direction, rule }, idx) => {
                            const isActive = (direction === 'above' && isAbove) || (direction === 'below' && isBelow);
                            
                            return (
                              <div 
                                key={idx}
                                className={`flex items-center gap-1 text-xs ${isActive ? 'font-bold text-blue-600' : 'text-gray-500'}`}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <img 
                                      src={`/assets/icons/characteristics/${key}.png`} 
                                      alt={`${key} icon`} 
                                      className="w-3 h-3 opacity-80 cursor-help" 
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{key}</p>
                                  </TooltipContent>
                                </Tooltip>
                                <span>{direction === 'above' ? '↑' : '↓'}</span>
                                <span>→</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <img 
                                      src={`/assets/icons/characteristics/${rule.target}.png`} 
                                      alt={`${rule.target} icon`} 
                                      className="w-3 h-3 opacity-80 cursor-help" 
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{rule.target}</p>
                                  </TooltipContent>
                                </Tooltip>
                                <span>💪{rule.k}</span>
                              </div>
                            );
                          });

                          // Add synergy rules for this characteristic
                          const synergyRuleElements = SYNERGY_RULES.map((rule, idx) => {
                            if (!rule.characteristics.includes(key as keyof WineCharacteristics)) return null;
                            
                            const otherChars = rule.characteristics.filter(c => c !== key);
                            const isActive = rule.condition(characteristics);
                            const reduction = rule.reduction(characteristics);
                            
                            // Get requirement description based on rule index
                            let requirement = '';
                            if (idx === 0) { // Acidity + Tannins synergy
                              requirement = '(both >70%)';
                            } else if (idx === 1) { // Body + Spice synergy
                              requirement = '(both 60-80%)';
                            } else if (idx === 2) { // Aroma + Body + Sweetness synergy
                              requirement = '(aroma>body, sweet 40-60%)';
                            } else if (idx === 3) { // Acidity + Sweetness synergy
                              requirement = '(both 40-60%)';
                            } else if (idx === 4) { // Aroma + Sweetness + Body synergy
                              requirement = '(aroma>60%, sweet>60%, body>70%)';
                            } else if (idx === 5) { // Tannins + Body + Spice synergy
                              requirement = '(tannins>70%, body>60%, spice>50%)';
                            } else if (idx === 6) { // Aroma + Acidity synergy
                              requirement = '(aroma>70%, acidity>60%)';
                            }
                            
                            return (
                              <div 
                                key={`synergy-${idx}`}
                                className={`flex items-center gap-1 text-xs ${isActive ? 'font-bold text-yellow-600' : 'text-gray-500'}`}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <img 
                                      src={`/assets/icons/characteristics/${key}.png`} 
                                      alt={`${key} icon`} 
                                      className="w-3 h-3 opacity-80 cursor-help" 
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{key}</p>
                                  </TooltipContent>
                                </Tooltip>
                                <span>+</span>
                                {otherChars.map((char, charIdx) => (
                                  <div key={charIdx} className="flex items-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <img 
                                          src={`/assets/icons/characteristics/${char}.png`} 
                                          alt={`${char} icon`} 
                                          className="w-3 h-3 opacity-80 cursor-help" 
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{char}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    {charIdx < otherChars.length - 1 && <span>+</span>}
                                  </div>
                                ))}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">
                                      🟡{isActive ? `-${(reduction * 100).toFixed(0)}%` : 'synergy'}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{requirement}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            );
                          }).filter(Boolean);

                          return [...penaltyRuleElements, ...synergyRuleElements];
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
          </div>
          
          <div className="mt-4 p-3 bg-white rounded border border-blue-300">
            <div className="text-sm">
              <div className="flex justify-between mb-1">
                <span>Average TotalDistance:</span>
                <span className="font-mono">
                  {(Object.values(characteristics).reduce((sum, _, idx) => {
                    const key = Object.keys(characteristics)[idx] as keyof WineCharacteristics;
                    const value = characteristics[key];
                    const [min, max] = balanceResult.dynamicRanges[key];
                    const midpoint = (min + max) / 2;
                    const distanceInside = Math.abs(value - midpoint);
                    const distanceOutside = value < min ? (min - value) : (value > max ? (value - max) : 0);
                    const penalty = 2 * distanceOutside;
                    const baseTotalDistance = distanceInside + penalty;
                    let totalScalingMultiplier = 1;
                    for (const [, targets] of Object.entries(penaltyScaling)) {
                      if (targets[key] !== undefined) {
                        totalScalingMultiplier *= targets[key];
                      }
                    }
                    let finalTotalDistance = baseTotalDistance * totalScalingMultiplier;
                    
                    // Apply synergy reduction
                    const synergyReduction = synergyReductions[key as keyof WineCharacteristics];
                    if (synergyReduction > 0) {
                      finalTotalDistance *= (1 - synergyReduction);
                    }
                    
                    return sum + finalTotalDistance;
                  }, 0) / 6).toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Balance Score (1 - 2×Avg):</span>
                <span className="font-mono font-medium">{balanceResult.score.toFixed(3)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Final Score:</span>
                <span>{Math.round(balanceResult.score * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section>
        <h3 className="text-lg font-medium">Wine Style Penalties</h3>
        <p className="text-sm text-gray-600 mt-1 mb-4">
          These combinations make wines feel unbalanced or harsh, increasing penalty severity.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="font-medium text-red-800">Harsh Acidity</span>
            </div>
            <p className="text-sm text-red-700">High spice clashes with high acidity, creating an unbalanced, harsh wine.</p>
          </div>
          
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="font-medium text-red-800">Overpowered Light Body</span>
            </div>
            <p className="text-sm text-red-700">High spice overwhelms light-bodied wines, making them feel thin and unbalanced.</p>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="font-medium text-red-800">Flat Heavy Body</span>
            </div>
            <p className="text-sm text-red-700">Low spice makes high body wines feel flat and lifeless.</p>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="font-medium text-red-800">Clashing Sweetness</span>
            </div>
            <p className="text-sm text-red-700">High acidity makes sweet wines taste overly tart and unbalanced.</p>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="font-medium text-red-800">Astringent Tannins</span>
            </div>
            <p className="text-sm text-red-700">High tannins without sufficient body create harsh, astringent wines.</p>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="font-medium text-red-800">Overpowered Aroma</span>
            </div>
            <p className="text-sm text-red-700">High body without matching aroma creates dull, heavy wines.</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-medium">Wine Style Synergies</h3>
        <p className="text-sm text-gray-600 mt-1 mb-4">
          These classic wine combinations work harmoniously together, reducing penalties.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="font-medium text-green-800">Bold Red Structure</span>
            </div>
            <p className="text-sm text-green-700">High acidity + high tannins create classic, structured red wines.</p>
          </div>

          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="font-medium text-green-800">Balanced Body & Spice</span>
            </div>
            <p className="text-sm text-green-700">Matching body and spice create harmonious, well-rounded wines.</p>
          </div>

          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="font-medium text-green-800">Classic Balance</span>
            </div>
            <p className="text-sm text-green-700">Acidity and sweetness in harmony - the foundation of great wine.</p>
          </div>

          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="font-medium text-green-800">Dessert Wine Body</span>
            </div>
            <p className="text-sm text-green-700">Rich aroma, sweetness, and body create luxurious dessert wines.</p>
          </div>

          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="font-medium text-green-800">Powerful Red Blend</span>
            </div>
            <p className="text-sm text-green-700">Tannins, body, and spice combine for complex, age-worthy reds.</p>
          </div>

          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="font-medium text-green-800">Bright & Aromatic</span>
            </div>
            <p className="text-sm text-green-700">High aroma with good acidity creates fresh, lively wines.</p>
          </div>

          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="font-medium text-green-800">Elegant Complexity</span>
            </div>
            <p className="text-sm text-green-700">Aroma leads body with balanced sweetness for refined wines.</p>
          </div>
        </div>
      </section>
      </div>
    </TooltipProvider>
  );
};


