import React, { useState } from 'react';
import { WineCharacteristics } from '@/lib/types/types';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import {
  calculateWineBalance,
  calculateCharacteristicBreakdown,
  calculateRules,
  RANGE_ADJUSTMENTS,
  RULES
} from '@/lib/balance';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/shadCN/tooltip';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/shadCN/card';
import { formatNumber } from '@/lib/utils';

// Simple chevron icons as SVG components
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

interface BalanceScoreBreakdownProps {
  characteristics: WineCharacteristics;
  className?: string;
  showWineStyleRules?: boolean;
}

export const BalanceScoreBreakdown: React.FC<BalanceScoreBreakdownProps> = ({ 
  characteristics, 
  className = "",
  showWineStyleRules = false
}) => {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const [penaltiesExpanded, setPenaltiesExpanded] = useState(false);
  const [synergiesExpanded, setSynergiesExpanded] = useState(false);
  const [filteredSource, setFilteredSource] = useState<string | null>(null);

  // Calculate all results using the new clean system
  const balanceResult = calculateWineBalance(
    characteristics, 
    BASE_BALANCED_RANGES, 
    RANGE_ADJUSTMENTS, 
    RULES
  );
  
  const breakdown = calculateCharacteristicBreakdown(
    characteristics, 
    BASE_BALANCED_RANGES, 
    RANGE_ADJUSTMENTS, 
    RULES
  );

  // These are calculated within the breakdown, no need to calculate separately

  const getActiveTargets = (source: string) => {
    const targets: string[] = [];
    
    // Check penalty rules where this characteristic is a source
    RULES.penalties.forEach(rule => {
      if (rule.sources.includes(source as any) && rule.condition(characteristics)) {
        rule.targets.forEach(target => {
          if (!targets.includes(target)) {
            targets.push(target);
          }
        });
      }
    });
    
    return targets;
  };

  // Filter rules based on selected source
  const getFilteredPenalties = () => {
    if (!filteredSource) return RULES.penalties;
    return RULES.penalties.filter(rule => rule.sources.includes(filteredSource as any));
  };

  const getFilteredSynergies = () => {
    if (!filteredSource) return RULES.synergies;
    return RULES.synergies.filter(rule => rule.sources.includes(filteredSource as any));
  };

  // Handle characteristic click for filtering
  const handleCharacteristicClick = (source: string) => {
    setFilteredSource(filteredSource === source ? null : source);
  };

  return (
    <TooltipProvider>
      <div className={`space-y-4 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(characteristics).map(([key, value]) => {
            const charKey = key as keyof WineCharacteristics;
            const calc = breakdown[charKey];
            
            const isTargetOfHover = hoveredSource && getActiveTargets(hoveredSource).includes(key);
            const hasSynergyWithHover = hoveredSource && 
              RULES.synergies.some(rule => 
                rule.condition(characteristics) && 
                rule.targets.includes(charKey) &&
                rule.sources.includes(hoveredSource as any)
              );
            
            return (
              <div 
                key={key} 
                className={`p-3 bg-white rounded border transition-all duration-200 cursor-pointer ${
                  filteredSource === key ? 'border-blue-500 shadow-blue-200 shadow-lg bg-blue-50' :
                  isTargetOfHover ? 'border-red-400 shadow-red-200 shadow-lg' : 
                  hasSynergyWithHover ? 'border-yellow-400 shadow-yellow-200 shadow-lg' : 
                  'border-gray-200 hover:border-gray-300'
                }`}
                onMouseEnter={() => setHoveredSource(key)}
                onMouseLeave={() => setHoveredSource(null)}
                onClick={() => handleCharacteristicClick(key)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <img src={`/assets/icons/characteristics/${key}.png`} alt={`${key} icon`} className="w-4 h-4 opacity-80" />
                  <span className="font-medium capitalize">{key}</span>
                  <span className="text-sm text-gray-600">({formatNumber(value, { decimals: 2, forceDecimals: true })})</span>
                </div>
                
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>DistanceInside:</span>
                    <span className="font-mono">{calc.distanceInside.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DistanceOutside:</span>
                    <span className="font-mono">{calc.distanceOutside.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Penalty (2×Outside):</span>
                    <span className="font-mono">{calc.penalty.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base TotalDistance:</span>
                    <span className="font-mono">{calc.baseTotalDistance.toFixed(3)}</span>
                  </div>
                  {(calc.totalScalingMultiplier !== 1 || calc.synergyReduction > 0) && (
                    <div className="space-y-1">
                      {calc.totalScalingMultiplier !== 1 && (
                        <div className="flex justify-between">
                          <span>Cross-trait scaling:</span>
                          <span className={`font-mono ${calc.totalScalingMultiplier > 1 ? 'text-red-600' : 'text-green-600'}`}>
                            {calc.totalScalingMultiplier.toFixed(2)}x
                          </span>
                        </div>
                      )}
                      {calc.synergyReduction > 0 && (
                        <div className="flex justify-between">
                          <span>Synergy reduction:</span>
                          <span className="font-mono text-yellow-600">
                            -{(calc.synergyReduction * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Final TotalDistance:</span>
                    <span className="font-mono">{calc.finalTotalDistance.toFixed(3)}</span>
                  </div>
                  
                  {/* Show all rules from this characteristic */}
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs font-medium text-gray-600 mb-1">Rules from {key}:</div>
                    <div className="space-y-1">
                      {(() => {
                        // Get penalty rules where this characteristic is a source
                        const sourceRules = RULES.penalties.filter(rule => 
                          rule.sources.includes(key as any)
                        );
                        if (sourceRules.length === 0) return null;
                        
                        const penaltyRuleElements = sourceRules.map((rule, idx) => {
                          const isActive = rule.condition(characteristics);
                          
                          return (
                            <div 
                              key={idx}
                              className={`flex items-center gap-1 text-xs ${isActive ? 'font-bold text-red-600' : 'text-gray-500'}`}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help font-bold">
                                    {rule.name}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p><strong>{rule.name}</strong></p>
                                  <p className="text-sm text-gray-600">{rule.requirement}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {rule.condition(characteristics) ? 
                                      `Currently applying penalty to ${rule.targets.join(', ')}` : 
                                      'Condition not met - no penalty applied'
                                    }
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              {/* Show all characteristics involved in the condition */}
                              <div className="flex items-center gap-1">
                                {/* Extract characteristics mentioned in the requirement */}
                                {(() => {
                                  const requirement = rule.requirement.toLowerCase();
                                  const mentionedChars = Object.keys(characteristics).filter(char => 
                                    requirement.includes(char.toLowerCase())
                                  );
                                  
                                  return mentionedChars.map((char, charIdx) => {
                                    // Determine if this char needs to be high or low
                                    const charRequirement = requirement.match(new RegExp(`${char}[<>]=?\\s*([0-9.]+)`));
                                    const threshold = charRequirement ? parseFloat(charRequirement[1]) : 0.5;
                                    const needsHigh = requirement.includes(`${char}>`) || requirement.includes(`${char}>=`);
                                    const currentValue = characteristics[char as keyof typeof characteristics];
                                    
                                    return (
                                      <React.Fragment key={char}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1">
                                              <img 
                                                src={`/assets/icons/characteristics/${char}.png`} 
                                                alt={`${char} icon`} 
                                                className="w-3 h-3 opacity-80 cursor-help" 
                                              />
                                              <span className="text-xs">
                                                {char}
                                                <span className={`ml-1 ${isActive ? 'text-red-500' : ''}`}>
                                                  {needsHigh ? '↑' : '↓'}
                                                </span>
                                              </span>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>{char} needs to be {needsHigh ? 'high' : 'low'} ({needsHigh ? '>' : '<'}{threshold.toFixed(1)})</p>
                                            <p>Current: {currentValue.toFixed(1)}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                        {charIdx < mentionedChars.length - 1 && (
                                          <span className={isActive ? 'text-red-500' : ''}>+</span>
                                        )}
                                      </React.Fragment>
                                    );
                                  });
                                })()}
                              </div>
                              
                              <span className={isActive ? 'text-red-500' : ''}>→</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1">
                                    <span className="flex items-center gap-1">
                                      {rule.targets.map((target, targetIdx) => (
                                        <React.Fragment key={target}>
                                          <img 
                                            src={`/assets/icons/characteristics/${target}.png`} 
                                            alt={`${target} icon`} 
                                            className="w-3 h-3 opacity-80 cursor-help" 
                                          />
                                          <span className="text-xs">
                                            {target}
                                          </span>
                                          {targetIdx < rule.targets.length - 1 && <span className="text-xs text-gray-400">+</span>}
                                        </React.Fragment>
                                      ))}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{rule.targets.join(', ')} get the penalty</p>
                                  <p>Current values: {rule.targets.map(t => `${t}: ${characteristics[t as keyof WineCharacteristics].toFixed(1)}`).join(', ')}</p>
                                </TooltipContent>
                              </Tooltip>
                              {/* Show penalty strength when active */}
                              {isActive && (() => {
                                // Get detailed penalty breakdown using existing calculation logic
                                const { detailedBreakdown } = calculateRules(
                                  characteristics, 
                                  BASE_BALANCED_RANGES, 
                                  RULES, 
                                  false, // not dry run
                                  true // return detailed breakdown
                                );
                                
                                const sourceKey = rule.sources.join('+');
                                const breakdown = detailedBreakdown?.[sourceKey];
                                
                                if (!breakdown) {
                                  // Fallback to simple display if detailed breakdown not available
                                  return (
                                    <span className="text-red-600 font-bold ml-3">
                                      ⚠️ {rule.cap ? (rule.cap * 100).toFixed(1) : '40.0'}% penalty
                                    </span>
                                  );
                                }
                                
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-red-600 font-bold ml-3 cursor-help">
                                        ⚠️ {breakdown.penaltyPercentage.toFixed(1)}% penalty
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                      <div className="space-y-2">
                                        <p className="font-bold text-sm">Penalty Calculation Breakdown</p>
                                        <div className="text-xs space-y-1">
                                          <div><strong>Rule:</strong> {breakdown.ruleName}</div>
                                          <div><strong>Sources:</strong> {breakdown.sources.join(', ')}</div>
                                          <div><strong>Targets:</strong> {breakdown.targets.join(', ')}</div>
                                          <div className="border-t pt-1 mt-2">
                                            <div><strong>avgDeviation:</strong> {breakdown.avgDeviation.toFixed(3)}</div>
                                            <div><strong>k (scaling):</strong> {breakdown.k}</div>
                                            <div><strong>p (power):</strong> {breakdown.p}</div>
                                            <div><strong>cap (maximum):</strong> {breakdown.cap}</div>
                                            <div className="border-t pt-1 mt-1">
                                              <div><strong>rawEffect:</strong> {breakdown.k} × {breakdown.avgDeviation.toFixed(3)}^({breakdown.p}) = {breakdown.rawEffect.toFixed(3)}</div>
                                              <div><strong>cappedEffect:</strong> min({breakdown.cap}, {breakdown.rawEffect.toFixed(3)}) = {breakdown.cappedEffect.toFixed(3)}</div>
                                              <div><strong>penalty:</strong> {breakdown.cappedEffect.toFixed(3)} × 100 = {breakdown.penaltyPercentage.toFixed(1)}%</div>
                                              {breakdown.hitsCap && (
                                                <div className="text-orange-600 font-bold">⚠️ Hit cap limit!</div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })()}
                            </div>
                          );
                        });

                        // Add synergy rules for this characteristic
                        const synergyRuleElements = RULES.synergies
                          .filter(rule => rule.targets.includes(charKey))
                          .map((rule, idx) => {
                            const isActive = rule.condition(characteristics);
                            
                            return (
                              <div 
                                key={`synergy-${idx}`}
                                className={`flex items-center gap-1 text-xs ${isActive ? 'font-bold text-green-600' : 'text-gray-500'}`}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help font-bold">
                                      {rule.name}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p><strong>{rule.name}</strong></p>
                                    <p className="text-sm text-gray-600">{rule.requirement}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {isActive ? 
                                        `Currently providing synergy bonus for: ${rule.targets.join(', ')}` : 
                                        'Condition not met - no synergy bonus'
                                      }
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                                <span>-</span>
                                {/* Show all characteristics involved in the synergy */}
                                <div className="flex items-center gap-1">
                                  {rule.sources.map((char, charIdx) => {
                                    const currentValue = characteristics[char as keyof WineCharacteristics];
                                    return (
                                      <React.Fragment key={char}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1">
                                              <img 
                                                src={`/assets/icons/characteristics/${char}.png`} 
                                                alt={`${char} icon`} 
                                                className="w-3 h-3 opacity-80 cursor-help" 
                                              />
                                              <span className="text-xs">
                                                {char}
                                              </span>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>{char} - part of synergy</p>
                                            <p>Current: {currentValue.toFixed(1)}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                        {charIdx < rule.sources.length - 1 && (
                                          <span className={isActive ? 'text-green-500' : ''}>+</span>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                                
                                <span className={isActive ? 'text-green-500' : ''}>→</span>
                                
                                {/* Show what gets the synergy benefit */}
                                <div className="flex items-center gap-1">
                                  {rule.targets.map((char, charIdx) => (
                                    <React.Fragment key={char}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-1">
                                            <img 
                                              src={`/assets/icons/characteristics/${char}.png`} 
                                              alt={`${char} icon`} 
                                              className="w-3 h-3 opacity-80 cursor-help" 
                                            />
                                            <span className="text-xs">
                                              {char}
                                            </span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{char} gets synergy benefit</p>
                                          <p>Reduces penalties on this characteristic</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      {charIdx < rule.targets.length - 1 && (
                                        <span className={isActive ? 'text-green-500' : ''}>+</span>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                                {/* Show synergy strength when active */}
                                {isActive && (() => {
                                  // Get detailed synergy breakdown using existing calculation logic
                                  const { synergyBreakdown } = calculateRules(
                                    characteristics, 
                                    BASE_BALANCED_RANGES, 
                                    RULES, 
                                    false, // not dry run
                                    true // return detailed breakdown
                                  );
                                  
                                  const sourceKey = rule.sources.join('+');
                                  const breakdown = synergyBreakdown?.[sourceKey];
                                  
                                  if (!breakdown) {
                                    // Fallback to simple display if detailed breakdown not available
                                    return (
                                      <span className="text-green-600 font-bold ml-3">
                                        ✨ -{rule.cap ? (rule.cap * 100).toFixed(1) : '75.0'}% reduction
                                      </span>
                                    );
                                  }
                                  
                                  return (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-green-600 font-bold ml-3 cursor-help">
                                          ✨ -{breakdown.synergyPercentage.toFixed(1)}% reduction
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm">
                                        <div className="space-y-2">
                                          <p className="font-bold text-sm">Synergy Calculation Breakdown</p>
                                          <div className="text-xs space-y-1">
                                            <div><strong>Rule:</strong> {breakdown.ruleName}</div>
                                            <div><strong>Sources:</strong> {breakdown.sources.join(', ')}</div>
                                            <div><strong>Targets:</strong> {breakdown.targets.join(', ')}</div>
                                            <div className="border-t pt-1 mt-2">
                                              <div><strong>avgDeviation:</strong> {breakdown.avgDeviation.toFixed(3)}</div>
                                              <div><strong>k (scaling):</strong> {breakdown.k}</div>
                                              <div><strong>p (power):</strong> {breakdown.p}</div>
                                              <div><strong>cap (maximum):</strong> {breakdown.cap}</div>
                                              <div className="border-t pt-1 mt-1">
                                                <div><strong>rawEffect:</strong> {breakdown.k} × {breakdown.avgDeviation.toFixed(3)}^({breakdown.p}) = {breakdown.rawEffect.toFixed(3)}</div>
                                                <div><strong>cappedEffect:</strong> min({breakdown.cap}, {breakdown.rawEffect.toFixed(3)}) = {breakdown.cappedEffect.toFixed(3)}</div>
                                                <div><strong>synergy:</strong> {breakdown.cappedEffect.toFixed(3)} × 100 = {breakdown.synergyPercentage.toFixed(1)}%</div>
                                                {breakdown.hitsCap && (
                                                  <div className="text-orange-600 font-bold">⚠️ Hit cap limit!</div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })()}
                              </div>
                            );
                          });

                        return (
                          <div className="space-y-2">
                            {penaltyRuleElements.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-gray-700 mb-1">Penalties:</div>
                                <div className="space-y-1">{penaltyRuleElements}</div>
                              </div>
                            )}
                            {synergyRuleElements.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-gray-700 mb-1">Synergies:</div>
                                <div className="space-y-1">{synergyRuleElements}</div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="p-3 bg-white rounded border border-blue-300">
          <div className="text-sm">
            <div className="flex justify-between mb-1">
              <span>Average TotalDistance:</span>
              <span className="font-mono">
                {(Object.values(breakdown).reduce((sum, calc) => sum + calc.finalTotalDistance, 0) / 6).toFixed(3)}
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

        {/* Filter Buttons for Wine Style Rules */}
        {showWineStyleRules && (
          <div className="p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-gray-700">Filter Wine Style Rules by source:</span>
              {filteredSource && (
                <button 
                  onClick={() => setFilteredSource(null)}
                  className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full hover:bg-red-200 transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(characteristics).map((key) => {
                const isActive = filteredSource === key;
                const hasRules = RULES.penalties.some(rule => rule.sources.includes(key as any)) || 
                                RULES.synergies.some(rule => rule.sources.includes(key as any));
                
                return (
                  <button
                    key={key}
                    onClick={() => handleCharacteristicClick(key)}
                    disabled={!hasRules}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : hasRules
                          ? 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                          : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    <img 
                      src={`/assets/icons/characteristics/${key}.png`} 
                      alt={`${key} icon`} 
                      className="w-4 h-4 opacity-80" 
                    />
                    <span className="capitalize">{key}</span>
                    {hasRules && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {RULES.penalties.filter(rule => rule.sources.includes(key as any)).length + 
                         RULES.synergies.filter(rule => rule.sources.includes(key as any)).length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {filteredSource && (
              <div className="mt-3 p-2 bg-blue-100 rounded text-sm text-blue-800">
                <strong>Active filter:</strong> Showing only rules where {filteredSource} is a source characteristic
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wine Style Rules Section */}
      {showWineStyleRules && (
        <div className="mt-8 space-y-6">
          {/* Wine Style Penalties Section */}
          <div>
            <button
              onClick={() => setPenaltiesExpanded(!penaltiesExpanded)}
              className="flex items-center gap-2 text-lg font-medium text-gray-800 hover:text-gray-900 transition-colors"
            >
              {penaltiesExpanded ? (
                <ChevronDownIcon className="w-5 h-5" />
              ) : (
                <ChevronRightIcon className="w-5 h-5" />
              )}
              Wine Style Penalties
              {filteredSource && (
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  Filtered by {filteredSource}
                </span>
              )}
            </button>
            
            {penaltiesExpanded && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-4">
                  Cross-trait penalty relationships that increase penalties on target characteristics.
                  {filteredSource && (
                    <span className="block mt-2">
                      <strong>Filtered view:</strong> Showing only penalties where {filteredSource} is a source characteristic.
                      <button 
                        onClick={() => setFilteredSource(null)}
                        className="ml-2 text-blue-600 hover:text-blue-800 underline"
                      >
                        Clear filter
                      </button>
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getFilteredPenalties().map((rule, index) => (
                    <Card key={index} className="border-red-200 bg-red-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-red-800 text-base">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          {rule.name}
                        </CardTitle>
                        <CardDescription className="text-red-700">
                          {rule.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-red-600">
                          <span className="font-medium">Requirement:</span>
                          <div className="flex items-center gap-1">
                            {rule.requirement.split(',').map((req, idx) => {
                              const cleanReq = req.trim().replace(/[()]/g, '');
                              const charName = cleanReq.split(/[><=\s]/)[0].trim();
                              
                              return (
                                <div key={idx} className="flex items-center gap-1">
                                  {idx > 0 && <span>,</span>}
                                  <img 
                                    src={`/assets/icons/characteristics/${charName}.png`} 
                                    alt={charName} 
                                    className="w-3 h-3" 
                                  />
                                  <span>{req.trim()}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-red-600">
                          <span className="font-medium">Effect:</span>
                          <span>Increases penalties on {rule.targets.join(', ')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Wine Style Synergies Section */}
          <div>
            <button
              onClick={() => setSynergiesExpanded(!synergiesExpanded)}
              className="flex items-center gap-2 text-lg font-medium text-gray-800 hover:text-gray-900 transition-colors"
            >
              {synergiesExpanded ? (
                <ChevronDownIcon className="w-5 h-5" />
              ) : (
                <ChevronRightIcon className="w-5 h-5" />
              )}
              Wine Style Synergies
              {filteredSource && (
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  Filtered by {filteredSource}
                </span>
              )}
            </button>
            
            {synergiesExpanded && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-4">
                  These classic wine combinations work harmoniously together, reducing penalties.
                  {filteredSource && (
                    <span className="block mt-2">
                      <strong>Filtered view:</strong> Showing only synergies where {filteredSource} is a source characteristic.
                      <button 
                        onClick={() => setFilteredSource(null)}
                        className="ml-2 text-blue-600 hover:text-blue-800 underline"
                      >
                        Clear filter
                      </button>
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getFilteredSynergies().map((rule, index) => (
                    <Card key={index} className="border-green-200 bg-green-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-green-800 text-base">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          {rule.name}
                        </CardTitle>
                        <CardDescription className="text-green-700">
                          {rule.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-green-600">
                          <span className="font-medium">Requirement:</span>
                          <div className="flex items-center gap-1">
                            {rule.requirement.split(',').map((req, idx) => {
                              const cleanReq = req.trim().replace(/[()]/g, '');
                              const charName = cleanReq.split(/[><=\s]/)[0].trim();
                              
                              return (
                                <div key={idx} className="flex items-center gap-1">
                                  {idx > 0 && <span>,</span>}
                                  <img 
                                    src={`/assets/icons/characteristics/${charName}.png`} 
                                    alt={charName} 
                                    className="w-3 h-3" 
                                  />
                                  <span>{req.trim()}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-green-600">
                          <span className="font-medium">Effect:</span>
                          <span>Reduces penalties on {rule.targets.join(', ')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </TooltipProvider>
  );
};