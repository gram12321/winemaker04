import React, { useState } from 'react';
import { WineCharacteristics } from '@/lib/types/types';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import { calculateWineBalance, calculateCharacteristicBreakdown, calculateRules, RANGE_ADJUSTMENTS, RULES } from '@/lib/balance';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { UnifiedTooltip, TooltipSection, TooltipRow, tooltipStyles } from '@/components/ui/shadCN/tooltip';
import { formatNumber, ChevronDownIcon, ChevronRightIcon } from '@/lib/utils';
import { getWineBalanceCategory, getRangeColor, getRatingForRange } from '@/lib/utils/utils';


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
    <>
      <div className={`space-y-4 ${className}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                className={`p-2 md:p-3 bg-white rounded border transition-all duration-200 cursor-pointer ${
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
                  <img src={`/assets/icons/characteristics/${key}.png`} alt={`${key} icon`} className="w-3 h-3 md:w-4 md:h-4 opacity-80" />
                  <span className="font-medium capitalize text-xs md:text-sm">{key}</span>
                  <span className="text-xs md:text-sm text-gray-600">({formatNumber(value, { decimals: 2, forceDecimals: true })})</span>
                </div>
                
                <div className="space-y-1 text-xs md:text-sm">
                    <UnifiedTooltip
                      content={
                        <div className={tooltipStyles.text}>
                          <TooltipSection title="DistanceInside Details">
                                <TooltipRow 
                                  label="DistanceInside:" 
                                  value={formatNumber(calc.distanceInside, { decimals: 2, forceDecimals: true })}
                                  valueRating={getRatingForRange(calc.distanceInside, 0, 0.2, 'lower_better')}
                                  monospaced
                                />
                                <div className="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-300">
                                  Distance from the midpoint of the balanced range. Lower values are better.
                                </div>
                              </TooltipSection>
                        </div>
                      }
                      title={`DistanceInside for ${key}`}
                      side="top"
                      sideOffset={8}
                      className="max-w-xs"
                      variant="panel"
                      density="compact"
                      triggerClassName="flex justify-between cursor-help"
                    >
                      <div className="flex justify-between w-full">
                        <span>DistanceInside:</span>
                        <span className={`font-mono ${getRangeColor(calc.distanceInside, 0, 0.2, 'lower_better').text}`}>
                          {formatNumber(calc.distanceInside, { decimals: 2, forceDecimals: true })}
                        </span>
                      </div>
                    </UnifiedTooltip>
                  <UnifiedTooltip
                    content={
                      <div className={tooltipStyles.text}>
                        <TooltipSection title="DistanceOutside Details">
                                <TooltipRow 
                                  label="DistanceOutside:" 
                                  value={formatNumber(calc.distanceOutside, { decimals: 2, forceDecimals: true })}
                                  valueRating={getRatingForRange(calc.distanceOutside, 0, 0.2, 'lower_better')}
                                  monospaced
                                />
                                <div className="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-300">
                                  Distance outside the balanced range. Values outside the range incur penalties. Lower values are better.
                                </div>
                              </TooltipSection>
                        </div>
                      }
                      title={`DistanceOutside for ${key}`}
                      side="top"
                      sideOffset={8}
                      className="max-w-xs"
                      variant="panel"
                      density="compact"
                      triggerClassName="flex justify-between cursor-help"
                    >
                      <div className="flex justify-between w-full">
                        <span>DistanceOutside:</span>
                        <span className={`font-mono ${getRangeColor(calc.distanceOutside, 0, 0.2, 'lower_better').text}`}>
                          {formatNumber(calc.distanceOutside, { decimals: 2, forceDecimals: true })}
                        </span>
                      </div>
                    </UnifiedTooltip>
                  <UnifiedTooltip
                    content={
                      <div className={tooltipStyles.text}>
                        <TooltipSection title="Penalty Details">
                                <TooltipRow 
                                  label="Penalty (2×Outside):" 
                                  value={formatNumber(calc.penalty, { decimals: 2, forceDecimals: true })}
                                  valueRating={getRatingForRange(calc.penalty, 0, 0.4, 'lower_better')}
                                  monospaced
                                />
                                <div className="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-300">
                                  Penalty is calculated as 2× the distance outside the balanced range. Lower values are better.
                                </div>
                              </TooltipSection>
                        </div>
                      }
                      title={`Penalty for ${key}`}
                      side="top"
                      sideOffset={8}
                      className="max-w-xs"
                      variant="panel"
                      density="compact"
                      triggerClassName="flex justify-between cursor-help"
                    >
                      <div className="flex justify-between w-full">
                        <span>Penalty (2×Outside):</span>
                        <span className={`font-mono ${getRangeColor(calc.penalty, 0, 0.4, 'lower_better').text}`}>
                          {formatNumber(calc.penalty, { decimals: 2, forceDecimals: true })}
                        </span>
                      </div>
                    </UnifiedTooltip>
                  <UnifiedTooltip
                    content={
                      <div className={tooltipStyles.text}>
                        <TooltipSection title="Base TotalDistance Details">
                                <TooltipRow 
                                  label="Base TotalDistance:" 
                                  value={formatNumber(calc.baseTotalDistance, { decimals: 2, forceDecimals: true })}
                                  valueRating={getRatingForRange(calc.baseTotalDistance, 0, 0.6, 'lower_better')}
                                  monospaced
                                />
                                <div className="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-300">
                                  Sum of distance inside and penalty. This is the base calculation before scaling and synergy adjustments.
                                </div>
                              </TooltipSection>
                        </div>
                      }
                      title={`Base TotalDistance for ${key}`}
                      side="top"
                      sideOffset={8}
                      className="max-w-xs"
                      variant="panel"
                      density="compact"
                      triggerClassName="flex justify-between cursor-help"
                    >
                      <div className="flex justify-between w-full">
                        <span>Base TotalDistance:</span>
                        <span className={`font-mono ${getRangeColor(calc.baseTotalDistance, 0, 0.6, 'lower_better').text}`}>
                          {formatNumber(calc.baseTotalDistance, { decimals: 2, forceDecimals: true })}
                        </span>
                      </div>
                    </UnifiedTooltip>
                  {(calc.totalScalingMultiplier !== 1 || calc.synergyReduction > 0) && (
                    <div className="space-y-1">
                      {calc.totalScalingMultiplier !== 1 && (
                        <div className="flex justify-between">
                          <span>Cross-trait scaling:</span>
                          <span className={`font-mono ${calc.totalScalingMultiplier > 1 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatNumber(calc.totalScalingMultiplier, { smartDecimals: true })}x
                          </span>
                        </div>
                      )}
                      {calc.synergyReduction > 0 && (
                        <div className="flex justify-between">
                          <span>Synergy reduction:</span>
                          <span className="font-mono text-yellow-600">
                            -{formatNumber(calc.synergyReduction * 100, { smartDecimals: true })}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <UnifiedTooltip
                    content={
                      <div className={tooltipStyles.text}>
                        <TooltipSection title="Final TotalDistance Details">
                                <TooltipRow 
                                  label="Final TotalDistance:" 
                                  value={formatNumber(calc.finalTotalDistance, { decimals: 2, forceDecimals: true })}
                                  valueRating={getRatingForRange(calc.finalTotalDistance, 0, 0.6, 'lower_better')}
                                  monospaced
                                />
                                <div className="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-300">
                                  Final calculated distance after all scaling and synergy adjustments. Lower values contribute to better balance score.
                                </div>
                              </TooltipSection>
                        </div>
                      }
                      title={`Final TotalDistance for ${key}`}
                      side="top"
                      sideOffset={8}
                      className="max-w-xs"
                      variant="panel"
                      density="compact"
                      triggerClassName="flex justify-between font-medium border-t pt-1 cursor-help"
                    >
                      <div className="flex justify-between font-medium border-t pt-1">
                        <span>Final TotalDistance:</span>
                        <span className={`font-mono ${getRangeColor(calc.finalTotalDistance, 0, 0.6, 'lower_better').text}`}>{formatNumber(calc.finalTotalDistance, { decimals: 2, forceDecimals: true })}</span>
                      </div>
                    </UnifiedTooltip>
                  
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
                              <UnifiedTooltip 
                                content={
                                  <div className={tooltipStyles.text}>
                                    <TooltipSection title={rule.name}>
                                      <TooltipRow 
                                        label="Requirement:" 
                                        value={rule.requirement}
                                      />
                                      <div className="mt-2 pt-2 border-t border-gray-600">
                                        <div className="text-xs text-gray-300">
                                          {rule.condition(characteristics) ? 
                                            `Currently applying penalty to ${rule.targets.join(', ')}` : 
                                            'Condition not met - no penalty applied'
                                          }
                                        </div>
                                      </div>
                                    </TooltipSection>
                                  </div>
                                } 
                                title={rule.name}
                                side="top"
                                sideOffset={8}
                                className="max-w-sm"
                                variant="panel"
                                density="compact"
                                triggerClassName="cursor-help font-bold"
                              >
                                <span className="cursor-help font-bold">
                                  {rule.name}
                                </span>
                              </UnifiedTooltip>
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
                                        <UnifiedTooltip 
                                          content={
                                            <div className={tooltipStyles.text}>
                                              <TooltipSection title={`${char} Requirement`}>
                                                <TooltipRow 
                                                  label="Needs to be:" 
                                                  value={`${needsHigh ? 'high' : 'low'} (${needsHigh ? '>' : '<'}${formatNumber(threshold, { smartDecimals: true })})`}
                                                />
                                              <TooltipRow 
                                                label="Current:" 
                                                value={formatNumber(currentValue, { decimals: 2, forceDecimals: true })}
                                                valueRating={getRatingForRange(currentValue, 0, 1, 'balanced', BASE_BALANCED_RANGES[char as keyof WineCharacteristics][0], BASE_BALANCED_RANGES[char as keyof WineCharacteristics][1])}
                                              />
                                            </TooltipSection>
                                          </div>
                                        } 
                                        title={`${char} Requirement`}
                                        side="top"
                                        sideOffset={8}
                                        className="max-w-xs"
                                        variant="panel"
                                        density="compact"
                                        triggerClassName="flex items-center gap-1"
                                      >
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
                                      </UnifiedTooltip>
                                        {charIdx < mentionedChars.length - 1 && (
                                          <span className={isActive ? 'text-red-500' : ''}>+</span>
                                        )}
                                      </React.Fragment>
                                    );
                                  });
                                })()}
                              </div>
                              
                              <span className={isActive ? 'text-red-500' : ''}>→</span>
                              <UnifiedTooltip 
                                content={
                                  <div className={tooltipStyles.text}>
                                    <TooltipSection title="Penalty Targets">
                                      <TooltipRow 
                                        label="Targets:" 
                                        value={rule.targets.join(', ')}
                                      />
                                      <div className="mt-2 pt-2 border-t border-gray-600">
                                        <div className="text-xs text-gray-300">Current values:</div>
                                        {rule.targets.map(t => (
                                          <TooltipRow 
                                            key={t}
                                            label={t} 
                                            value={formatNumber(characteristics[t as keyof WineCharacteristics], { decimals: 2, forceDecimals: true })}
                                            valueRating={getRatingForRange(characteristics[t as keyof WineCharacteristics], 0, 1, 'balanced', BASE_BALANCED_RANGES[t as keyof WineCharacteristics][0], BASE_BALANCED_RANGES[t as keyof WineCharacteristics][1])}
                                          />
                                        ))}
                                      </div>
                                    </TooltipSection>
                                  </div>
                                } 
                                title="Penalty Targets"
                                side="top"
                                sideOffset={8}
                                className="max-w-xs"
                                variant="panel"
                                density="compact"
                                triggerClassName="flex items-center gap-1 cursor-help"
                              >
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
                              </UnifiedTooltip>
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
                                      ⚠️ {rule.cap ? formatNumber(rule.cap * 100, { smartDecimals: true }) : '40.0'}% penalty
                                    </span>
                                  );
                                }
                                
                                return (
                                  <UnifiedTooltip 
                                    content={
                                      <div className={tooltipStyles.text}>
                                        <TooltipSection title="Penalty Calculation Breakdown">
                                          <TooltipRow 
                                            label="Rule:" 
                                            value={breakdown.ruleName}
                                          />
                                          <TooltipRow 
                                            label="Sources:" 
                                            value={breakdown.sources.join(', ')}
                                          />
                                          <TooltipRow 
                                            label="Targets:" 
                                            value={breakdown.targets.join(', ')}
                                          />
                                          <div className="mt-2 pt-2 border-t border-gray-600">
                                            <TooltipRow 
                                              label="avgDeviation:" 
                                              value={formatNumber(breakdown.avgDeviation, { decimals: 3, forceDecimals: true })}
                                              valueRating={getRatingForRange(breakdown.avgDeviation, 0, 0.5, 'lower_better')}
                                              monospaced
                                            />
                                            <TooltipRow 
                                              label="k (scaling):" 
                                              value={String(breakdown.k)}
                                            />
                                            <TooltipRow 
                                              label="p (power):" 
                                              value={String(breakdown.p)}
                                            />
                                            <TooltipRow 
                                              label="cap (maximum):" 
                                              value={String(breakdown.cap)}
                                            />
                                          </div>
                                          <div className="mt-2 pt-2 border-t border-gray-600">
                                            <div className="text-xs font-mono text-gray-300 space-y-1">
                                              <div>rawEffect: {breakdown.k} × {breakdown.avgDeviation.toFixed(3)}^({breakdown.p}) = {breakdown.rawEffect.toFixed(3)}</div>
                                              <div>cappedEffect: min({breakdown.cap}, {breakdown.rawEffect.toFixed(3)}) = {breakdown.cappedEffect.toFixed(3)}</div>
                                              <div>penalty: {breakdown.cappedEffect.toFixed(3)} × 100 = {breakdown.penaltyPercentage.toFixed(1)}%</div>
                                            </div>
                                            {breakdown.hitsCap && (
                                              <div className="text-orange-400 font-bold mt-2">⚠️ Hit cap limit!</div>
                                            )}
                                          </div>
                                        </TooltipSection>
                                      </div>
                                    } 
                                    title="Penalty Calculation Breakdown"
                                    side="top"
                                    sideOffset={8}
                                    className="max-w-sm"
                                    variant="panel"
                                    density="compact"
                                    triggerClassName="text-red-600 font-bold ml-3 cursor-help"
                                  >
                                    <span className="text-red-600 font-bold ml-3 cursor-help">
                                      ⚠️ {formatNumber(breakdown.penaltyPercentage, { smartDecimals: true })}% penalty
                                    </span>
                                  </UnifiedTooltip>
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
                                <UnifiedTooltip 
                                  content={
                                    <div className={tooltipStyles.text}>
                                      <TooltipSection title={rule.name}>
                                        <TooltipRow 
                                          label="Requirement:" 
                                          value={rule.requirement}
                                        />
                                        <div className="mt-2 pt-2 border-t border-gray-600">
                                          <div className="text-xs text-gray-300">
                                            {isActive ? 
                                              `Currently providing synergy bonus for: ${rule.targets.join(', ')}` : 
                                              'Condition not met - no synergy bonus'
                                            }
                                          </div>
                                        </div>
                                      </TooltipSection>
                                    </div>
                                  } 
                                  title={rule.name}
                                  side="top"
                                  sideOffset={8}
                                  className="max-w-sm"
                                  variant="panel"
                                  density="compact"
                                  triggerClassName="cursor-help font-bold"
                                >
                                  <span className="cursor-help font-bold">
                                    {rule.name}
                                  </span>
                                </UnifiedTooltip>
                                <span>-</span>
                                {/* Show all characteristics involved in the synergy */}
                                <div className="flex items-center gap-1">
                                  {rule.sources.map((char, charIdx) => {
                                    const currentValue = characteristics[char as keyof WineCharacteristics];
                                    return (
                                      <React.Fragment key={char}>
                                        <UnifiedTooltip 
                                          content={
                                            <div className={tooltipStyles.text}>
                                              <TooltipSection title={`${char} - Synergy Source`}>
                                                <TooltipRow 
                                                  label="Role:" 
                                                  value="Part of synergy"
                                                />
                                                <TooltipRow 
                                                  label="Current:" 
                                                  value={formatNumber(currentValue, { decimals: 2, forceDecimals: true })}
                                                  valueRating={getRatingForRange(currentValue, 0, 1, 'balanced', BASE_BALANCED_RANGES[char as keyof WineCharacteristics][0], BASE_BALANCED_RANGES[char as keyof WineCharacteristics][1])}
                                                />
                                              </TooltipSection>
                                            </div>
                                          } 
                                          title={`${char} - Synergy Source`}
                                          side="top"
                                          sideOffset={8}
                                          className="max-w-xs"
                                          variant="panel"
                                          density="compact"
                                          triggerClassName="flex items-center gap-1"
                                        >
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
                                        </UnifiedTooltip>
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
                                      <UnifiedTooltip 
                                        content={
                                          <div className={tooltipStyles.text}>
                                            <TooltipSection title={`${char} - Synergy Target`}>
                                              <TooltipRow 
                                                label="Benefit:" 
                                                value="Gets synergy benefit"
                                              />
                                              <div className="mt-2 pt-2 border-t border-gray-600">
                                                <div className="text-xs text-gray-300">Reduces penalties on this characteristic</div>
                                              </div>
                                            </TooltipSection>
                                          </div>
                                        } 
                                        title={`${char} - Synergy Target`}
                                        side="top"
                                        sideOffset={8}
                                        className="max-w-xs"
                                        variant="panel"
                                        density="compact"
                                        triggerClassName="flex items-center gap-1"
                                      >
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
                                      </UnifiedTooltip>
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
                                      ✨ -{rule.cap ? formatNumber(rule.cap * 100, { smartDecimals: true }) : '75.0'}% reduction
                                    </span>
                                    );
                                  }
                                  
                                  return (
                                    <UnifiedTooltip 
                                      content={
                                        <div className={tooltipStyles.text}>
                                          <TooltipSection title="Synergy Calculation Breakdown">
                                            <TooltipRow 
                                              label="Rule:" 
                                              value={breakdown.ruleName}
                                            />
                                            <TooltipRow 
                                              label="Sources:" 
                                              value={breakdown.sources.join(', ')}
                                            />
                                            <TooltipRow 
                                              label="Targets:" 
                                              value={breakdown.targets.join(', ')}
                                            />
                                            <div className="mt-2 pt-2 border-t border-gray-600">
                                              <TooltipRow 
                                                label="avgDeviation:" 
                                                value={formatNumber(breakdown.avgDeviation, { decimals: 3, forceDecimals: true })}
                                                monospaced
                                              />
                                              <TooltipRow 
                                                label="k (scaling):" 
                                                value={String(breakdown.k)}
                                              />
                                              <TooltipRow 
                                                label="p (power):" 
                                                value={String(breakdown.p)}
                                              />
                                              <TooltipRow 
                                                label="cap (maximum):" 
                                                value={String(breakdown.cap)}
                                              />
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-gray-600">
                                              <div className="text-xs font-mono text-gray-300 space-y-1">
                                                <div>rawEffect: {breakdown.k} × {breakdown.avgDeviation.toFixed(3)}^({breakdown.p}) = {breakdown.rawEffect.toFixed(3)}</div>
                                                <div>cappedEffect: min({breakdown.cap}, {breakdown.rawEffect.toFixed(3)}) = {breakdown.cappedEffect.toFixed(3)}</div>
                                                <div>synergy: {breakdown.cappedEffect.toFixed(3)} × 100 = {breakdown.synergyPercentage.toFixed(1)}%</div>
                                              </div>
                                              {breakdown.hitsCap && (
                                                <div className="text-orange-400 font-bold mt-2">⚠️ Hit cap limit!</div>
                                              )}
                                            </div>
                                          </TooltipSection>
                                        </div>
                                      } 
                                      title="Synergy Calculation Breakdown"
                                      side="top"
                                      sideOffset={8}
                                      className="max-w-sm"
                                      variant="panel"
                                      density="compact"
                                      triggerClassName="text-green-600 font-bold ml-3 cursor-help"
                                    >
                                      <span className="text-green-600 font-bold ml-3 cursor-help">
                                        ✨ -{formatNumber(breakdown.synergyPercentage, { smartDecimals: true })}% reduction
                                      </span>
                                    </UnifiedTooltip>
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
                {formatNumber((Object.values(breakdown).reduce((sum, calc) => sum + calc.finalTotalDistance, 0) / 6), { smartDecimals: true })}
              </span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Balance Score (1 - 2×Avg):</span>
              <span className="font-mono font-medium">{formatNumber(balanceResult.score, { smartDecimals: true })}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Final Score:</span>
              <div className="text-right">
                <div>{formatNumber(balanceResult.score * 100, { smartDecimals: true })}%</div>
                <div className="text-sm font-normal text-gray-600">{getWineBalanceCategory(balanceResult.score)}</div>
              </div>
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
    </>
  );
};