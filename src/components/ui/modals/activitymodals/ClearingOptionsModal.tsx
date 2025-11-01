import React, { useState, useEffect } from 'react';
import { Vineyard } from '@/lib/types/types';
import { formatNumber, getColorClass } from '@/lib/utils/utils';
import { WorkCalculationTable } from '@/components/ui';
import { calculateClearingWork } from '@/lib/services/activity';
import { getGameState } from '@/lib/services';
import { CLEARING_TASKS } from '@/lib/constants/activityConstants';

interface ClearingOptionsModalProps {
  isOpen: boolean;
  vineyard: Vineyard | null;
  onClose: () => void;
  onSubmit: (options: {
    tasks: { [key: string]: boolean };
    replantingIntensity: number;
  }) => void;
}

const ClearingOptionsModal: React.FC<ClearingOptionsModalProps> = ({
  isOpen,
  vineyard,
  onClose,
  onSubmit,
}) => {
  const [options, setOptions] = useState<{
    tasks: { [key: string]: boolean };
    replantingIntensity: number;
  }>({
    tasks: {
      'clear-vegetation': false,
      'remove-debris': false,
      'uproot-vines': false,
      'replant-vines': false,
    },
    replantingIntensity: 100,
  });

  const [workEstimate, setWorkEstimate] = useState({
    totalWork: 0,
    timeEstimate: 'Calculating...',
  });

  const [projectedHealth, setProjectedHealth] = useState<number>(vineyard?.vineyardHealth || 1.0);
  const [workFactors, setWorkFactors] = useState<Array<{
    label: string;
    value: string | number;
    unit?: string;
    modifier?: number;
    modifierLabel?: string;
    isPrimary?: boolean;
  }>>([]);

  // Reset options when modal opens/closes or vineyard changes
  useEffect(() => {
    if (isOpen && vineyard) {
      setOptions({
        tasks: {
          'clear-vegetation': false,
          'remove-debris': false,
          'uproot-vines': false,
          'replant-vines': false,
        },
        replantingIntensity: 100,
      });
      setProjectedHealth(vineyard.vineyardHealth);
    }
  }, [isOpen, vineyard]);

  // Calculate work and health improvements
  useEffect(() => {
    if (!vineyard) return;

    // Calculate work using the dedicated clearing work calculator
    const workResult = calculateClearingWork(vineyard, options);
    
    // Calculate health improvements for display
    let healthImprovement = 0;
    Object.entries(options.tasks).forEach(([taskId, isSelected]) => {
      if (!isSelected) return;
      
      const task = Object.values(CLEARING_TASKS).find(t => t.id === taskId);
      if (!task) return;
      
      // Additive health tasks use healthImprovement
      if ('healthImprovement' in task && task.healthImprovement) {
        healthImprovement += task.healthImprovement;
      }
    });

    // Calculate projected health with mixed additive and setHealth logic
    let newHealth = vineyard.vineyardHealth + healthImprovement; // Start with current health + additive improvements
    
    // Handle setHealth tasks (uproot and replant) - these set absolute values
    if (options.tasks['uproot-vines']) {
      const uprootIntensity = options.replantingIntensity / 100;
      const uprootTask = Object.values(CLEARING_TASKS).find(t => t.id === 'uproot-vines');
      if (uprootTask && 'setHealth' in uprootTask && uprootTask.setHealth !== undefined) {
        // Blend current health with set health based on intensity
        newHealth = newHealth * (1 - uprootIntensity) + uprootTask.setHealth * uprootIntensity;
      }
    }
    
    if (options.tasks['replant-vines']) {
      const replantIntensity = options.replantingIntensity / 100;
      const replantTask = Object.values(CLEARING_TASKS).find(t => t.id === 'replant-vines');
      if (replantTask && 'setHealth' in replantTask && replantTask.setHealth !== undefined) {
        // Blend current health with set health based on intensity
        newHealth = newHealth * (1 - replantIntensity) + replantTask.setHealth * replantIntensity;
      }
    }
    
    // Ensure health stays within bounds
    newHealth = Math.max(0.1, Math.min(1.0, newHealth));
    setProjectedHealth(newHealth);

    // Calculate time estimate
    const weeks = workResult.totalWork > 0 ? Math.ceil(workResult.totalWork / 25) : 0; // 25 = BASE_WORK_UNITS
    const timeEstimate = `${weeks} week${weeks === 1 ? '' : 's'}`;

    setWorkEstimate({
      totalWork: workResult.totalWork,
      timeEstimate,
    });

    setWorkFactors(workResult.workFactors);
  }, [options, vineyard]);

  const handleTaskChange = (taskId: string, checked: boolean) => {
    setOptions(prev => {
      const newTasks = { ...prev.tasks };
      
      // Make uproot and replant mutually exclusive
      if (checked && (taskId === 'uproot-vines' || taskId === 'replant-vines')) {
        // If checking uproot, uncheck replant and vice versa
        if (taskId === 'uproot-vines') {
          newTasks['replant-vines'] = false;
        } else if (taskId === 'replant-vines') {
          newTasks['uproot-vines'] = false;
        }
      }
      
      newTasks[taskId] = checked;
      
      return {
        ...prev,
        tasks: newTasks,
        // Reset replanting intensity if uprooting or replanting is unchecked
        replantingIntensity: (taskId === 'uproot-vines' || taskId === 'replant-vines') && !checked ? 100 : prev.replantingIntensity,
      };
    });
  };

  const handleSliderChange = (value: number) => {
    setOptions(prev => ({
      ...prev,
      replantingIntensity: value,
      // Don't auto-select any tasks - let user choose uproot vs replant vs both
    }));
  };

  const handleSubmit = () => {
    const finalOptions = { ...options };
    if (!options.tasks['uproot-vines'] && !options.tasks['replant-vines']) {
      finalOptions.replantingIntensity = 100;
    }
    onSubmit(finalOptions);
  };

  const canSubmit = (): boolean => {
    return Object.values(options.tasks).some(isSelected => isSelected);
  };

  if (!isOpen || !vineyard) return null;

  // Check seasonal and yearly limits for individual tasks
  const gameState = getGameState();
  const currentSeason = gameState.season;
  const wasClearVegetationDoneThisYear = (vineyard.overgrowth?.vegetation ?? 0) === 0;
  const wasRemoveDebrisDoneThisYear = (vineyard.overgrowth?.debris ?? 0) === 0;
  
  // Seasonal restrictions
  const isClearVegetationBlockedBySeason = currentSeason === 'Winter';

  const healthImprovement = projectedHealth - vineyard.vineyardHealth;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            Clear Vineyard: {vineyard.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-gray-600">
            Select clearing tasks to improve the health of this {vineyard.hectares} hectare vineyard.
          </p>
          
          {/* Seasonal and yearly limit warnings */}
          {(() => {
            const warnings = [];
            const seasonalWarnings = [];
            
            if (isClearVegetationBlockedBySeason) {
              seasonalWarnings.push("Clear vegetation is not available in winter (vegetation is dormant)");
            }
            
            if (wasClearVegetationDoneThisYear) {
              warnings.push("Clear vegetation was already done this year");
            }
            if (wasRemoveDebrisDoneThisYear) {
              warnings.push("Remove debris was already done this year");
            }
            
            if (seasonalWarnings.length > 0) {
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center">
                    <div className="text-blue-600 mr-2">❄️</div>
                    <div className="text-sm text-blue-800">
                      <strong>Seasonal Restrictions:</strong> {seasonalWarnings.join(", ")}. You can still perform vine uprooting and replanting tasks.
                    </div>
                  </div>
                </div>
              );
            }
            
            if (warnings.length > 0) {
              return (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center">
                    <div className="text-yellow-600 mr-2">⚠️</div>
                    <div className="text-sm text-yellow-800">
                      <strong>Yearly Limits:</strong> {warnings.join(", ")}. You can still perform vine uprooting and replanting tasks.
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Work Estimate */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Work Estimate</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <div><span className="font-medium">Field Size:</span> {vineyard.hectares} hectares</div>
              <div><span className="font-medium">Task:</span> Clearing</div>
              <div><span className="font-medium">Total Work:</span> {formatNumber(workEstimate.totalWork, { decimals: 0 })} units</div>
              <div><span className="font-medium">Time:</span> {workEstimate.timeEstimate}</div>
            </div>
            
            {/* Work Calculation Table */}
            {workFactors.length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <WorkCalculationTable 
                  factors={workFactors} 
                  totalWork={workEstimate.totalWork} 
                />
              </div>
            )}
          </div>

          {/* Clearing Tasks */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Clearing Tasks</h3>
            
            {/* Clear Vegetation */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="clear-vegetation"
                checked={options.tasks['clear-vegetation']}
                onChange={(e) => handleTaskChange('clear-vegetation', e.target.checked)}
                disabled={wasClearVegetationDoneThisYear || isClearVegetationBlockedBySeason}
                className={`mr-3 h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine ${
                  wasClearVegetationDoneThisYear || isClearVegetationBlockedBySeason ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              <label htmlFor="clear-vegetation" className={`text-sm ${wasClearVegetationDoneThisYear || isClearVegetationBlockedBySeason ? 'text-gray-400' : 'text-gray-700'}`}>
                Clear vegetation
                <span className="text-green-600 ml-2 font-medium">(+10% health)</span>
                {wasClearVegetationDoneThisYear && <span className="text-yellow-600 ml-2 text-xs">(Yearly limit reached)</span>}
                {isClearVegetationBlockedBySeason && <span className="text-blue-600 ml-2 text-xs">(Not available in winter)</span>}
              </label>
            </div>
            
            {/* Remove Debris */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remove-debris"
                checked={options.tasks['remove-debris']}
                onChange={(e) => handleTaskChange('remove-debris', e.target.checked)}
                disabled={wasRemoveDebrisDoneThisYear}
                className={`mr-3 h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine ${
                  wasRemoveDebrisDoneThisYear ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              <label htmlFor="remove-debris" className={`text-sm ${wasRemoveDebrisDoneThisYear ? 'text-gray-400' : 'text-gray-700'}`}>
                Remove debris
                <span className="text-green-600 ml-2 font-medium">(+5% health)</span>
                {wasRemoveDebrisDoneThisYear && <span className="text-yellow-600 ml-2 text-xs">(Yearly limit reached)</span>}
              </label>
            </div>
            
            {/* Uproot Vines */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="uproot-vines"
                checked={options.tasks['uproot-vines']}
                onChange={(e) => handleTaskChange('uproot-vines', e.target.checked)}
                disabled={!vineyard.grape}
                className="mr-3 h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label htmlFor="uproot-vines" className={`text-sm ${!vineyard.grape ? 'text-gray-400' : 'text-gray-700'}`}>
                Uproot vines
                {vineyard.grape && (
                  <span className="text-gray-500 ml-2">(Current: {vineyard.grape})</span>
                )}
                <span className="text-red-600 ml-2 font-medium">(Sets health to 50%)</span>
              </label>
            </div>
            
            {/* Replant Vines */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="replant-vines"
                checked={options.tasks['replant-vines']}
                onChange={(e) => handleTaskChange('replant-vines', e.target.checked)}
                disabled={!vineyard.grape}
                className="mr-3 h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label htmlFor="replant-vines" className={`text-sm ${!vineyard.grape ? 'text-gray-400' : 'text-gray-700'}`}>
                Replant vines
                <span className="text-green-600 ml-2 font-medium">(Sets health to 50% + 20% gradual improvement)</span>
              </label>
            </div>
            
            {/* Vine Replanting Slider - only show if uprooting or replanting is checked */}
            {(options.tasks['uproot-vines'] || options.tasks['replant-vines']) && vineyard.grape && (
              <div className="ml-6 mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={options.replantingIntensity}
                  onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-sm text-gray-700 mt-1">
                  Replanting intensity: <span className="font-medium">{options.replantingIntensity}%</span>
                  {vineyard.vineAge !== null && vineyard.vineAge > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      (Vine age: {vineyard.vineAge} → 
                      {formatNumber(vineyard.vineAge * (1 - options.replantingIntensity/100), { smartDecimals: true })} years)
                    </span>
                  )}
                </div>
                
                {/* Warning messages based on task and intensity */}
                {options.tasks['uproot-vines'] && options.replantingIntensity === 100 && (
                  <div className="mt-2 p-2 bg-orange-100 border border-orange-300 rounded text-xs text-orange-800">
                    <strong>⚠️ Warning:</strong> 100% uprooting will reset this vineyard to barren status and allow you to plant a different grape variety.
                  </div>
                )}
                
                {options.tasks['replant-vines'] && options.replantingIntensity === 100 && (
                  <div className="mt-2 p-2 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800">
                    <strong>ℹ️ Note:</strong> 100% replanting will replace all vines with new ones of the same grape variety and density. You will NOT be able to choose a different grape variety.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Health Impact */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium text-green-900 mb-3">Vineyard Health Impact</h3>
            
            {/* Single Health Bar with Projected Change */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Vineyard Health:</span>
                <span className={`text-sm font-medium ${getColorClass(projectedHealth)}`}>{formatNumber(projectedHealth * 100, { smartDecimals: true })}%</span>
              </div>
              
              <div className="relative">
                {/* Background bar */}
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  {/* Current health (dark reddish-brown) */}
                  <div 
                    className="absolute left-0 top-0 h-full bg-amber-800 rounded-l-full" 
                    style={{ width: `${vineyard.vineyardHealth * 100}%` }}
                  ></div>
                  
                  {/* Projected improvement (light green) */}
                  {healthImprovement > 0 && (
                    <div 
                      className="absolute h-full bg-green-400" 
                      style={{ 
                        left: `${vineyard.vineyardHealth * 100}%`,
                        width: `${healthImprovement * 100}%`
                      }}
                    ></div>
                  )}
                  
                  {/* Gradual improvement overlay for replanting (semi-transparent green) */}
                  {options.tasks['replant-vines'] && (
                    <div 
                      className="absolute h-full bg-green-300 opacity-50" 
                      style={{ 
                        left: `${(vineyard.vineyardHealth + healthImprovement) * 100}%`,
                        width: `${(0.2 * options.replantingIntensity / 100) * 100}%` // Scales with replanting intensity (20% max at 100% intensity)
                      }}
                    ></div>
                  )}
                  
                  {/* Health reduction (dark red) - for vine removal scenarios */}
                  {healthImprovement < 0 && (
                    <div 
                      className="absolute h-full bg-red-800" 
                      style={{ 
                        left: `${(vineyard.vineyardHealth + healthImprovement) * 100}%`,
                        width: `${Math.abs(healthImprovement) * 100}%`
                      }}
                    ></div>
                  )}
                </div>
              </div>
              
              {/* Health Change Indicator */}
              {healthImprovement !== 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Current: {formatNumber(vineyard.vineyardHealth * 100, { smartDecimals: true })}%</span>
                  <span className={`font-medium ${healthImprovement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {healthImprovement > 0 ? '+' : ''}{formatNumber(healthImprovement * 100, { smartDecimals: true })}% health {healthImprovement > 0 ? 'improvement' : 'reduction'}
                  </span>
                </div>
              )}
              
              {/* Gradual improvement info for replanting */}
              {options.tasks['replant-vines'] && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-300 opacity-50 rounded"></div>
                    <span className="text-green-700 font-medium">Gradual Improvement:</span>
                    <span className="text-green-600">+{formatNumber(0.2 * options.replantingIntensity / 100 * 100, { smartDecimals: true })}% health over 5 years</span>
                  </div>
                  <div className="text-green-600 mt-1">
                    The semi-transparent green bar shows the additional health that will gradually improve over time (scales with replanting intensity).
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit()}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              canSubmit()
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Start Clearing
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClearingOptionsModal;
