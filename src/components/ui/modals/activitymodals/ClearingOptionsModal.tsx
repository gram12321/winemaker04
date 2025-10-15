import React, { useState, useEffect } from 'react';
import { Vineyard } from '@/lib/types/types';
import { CLEARING_TASKS } from '@/lib/constants/activityConstants';
import { formatNumber } from '@/lib/utils/utils';
import { calculateTotalWork } from '@/lib/services/activity/workcalculators/workCalculator';
import { WorkCalculationTable } from '@/components/ui/activities/workCalculationTable';
import { WorkFactor } from '@/lib/services/activity/workcalculators/workCalculator';
import { DEFAULT_VINE_DENSITY } from '@/lib/constants/activityConstants';
import { getAltitudeRating } from '@/lib/services/vineyard/vineyardValueCalc';
import { SOIL_DIFFICULTY_MODIFIERS } from '@/lib/constants/vineyardConstants';

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
  const [workFactors, setWorkFactors] = useState<WorkFactor[]>([]);

  // Work modifier functions (same as in clearingManager.ts)
  const getSoilTypeModifier = (soil: string[]): number => {
    let totalModifier = 0;
    let validSoils = 0;
    
    soil.forEach(soilType => {
      const modifier = SOIL_DIFFICULTY_MODIFIERS[soilType as keyof typeof SOIL_DIFFICULTY_MODIFIERS];
      if (modifier !== undefined) {
        totalModifier += modifier;
        validSoils++;
      }
    });
    
    return validSoils > 0 ? totalModifier / validSoils : 0;
  };

  const getOvergrowthModifier = (yearsSinceLastClearing: number): number => {
    if (yearsSinceLastClearing <= 0) return 0;
    
    const baseIncrease = 0.10; // 10% base increase per year
    const decayRate = 0.5; // Diminishing factor
    
    const maxModifier = baseIncrease / decayRate; // Theoretical maximum
    const actualModifier = maxModifier * (1 - Math.pow(1 - decayRate, yearsSinceLastClearing));
    
    return Math.min(actualModifier, 2.0); // Cap at 200%
  };

  const getVineAgeModifier = (vineAge: number | null): number => {
    if (!vineAge || vineAge <= 0) return 0;
    
    const maxAge = 100; // Practical maximum
    const ageRatio = Math.min(vineAge / maxAge, 1); // Normalize to 0-1
    
    const baseModifier = 1.8; // Maximum 180% work increase
    const actualModifier = baseModifier * (1 - Math.exp(-3 * ageRatio)); // Exponential decay function
    
    return actualModifier;
  };

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

    let totalClearingWork = 0;
    let healthImprovement = 0;
    const factors: WorkFactor[] = [];

    // Calculate work modifiers for this vineyard
    const soilModifier = getSoilTypeModifier(vineyard.soil);
    const altitudeRating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
    const terrainModifier = altitudeRating * 1.5; // Up to +150% work for very high altitude
    const overgrowthModifier = getOvergrowthModifier(vineyard.yearsSinceLastClearing || 0);

    // Add vineyard size factor
    factors.push({
      label: 'Vineyard Size',
      value: vineyard.hectares,
      unit: 'hectares',
      isPrimary: true
    });

    // Add environmental factors
    if (Math.abs(soilModifier) >= 0) { // Show all soil modifiers (including 0%)
      factors.push({
        label: 'Soil Type',
        value: vineyard.soil.join(', '),
        modifier: soilModifier,
        modifierLabel: 'soil difficulty'
      });
    }

    if (Math.abs(terrainModifier) > 0.01) {
      factors.push({
        label: 'Terrain Difficulty',
        value: `${vineyard.altitude}m altitude`,
        modifier: terrainModifier,
        modifierLabel: 'altitude effect'
      });
    }

    if (Math.abs(overgrowthModifier) > 0.01) {
      factors.push({
        label: 'Overgrowth',
        value: `${vineyard.yearsSinceLastClearing || 0} years since last clearing`,
        modifier: overgrowthModifier,
        modifierLabel: 'overgrowth effect'
      });
    }

    // Calculate work for each selected task
    Object.entries(options.tasks).forEach(([taskId, isSelected]) => {
      if (!isSelected) return;

      const task = Object.values(CLEARING_TASKS).find(t => t.id === taskId);
      if (!task) return;

      let taskAmount = vineyard.hectares;
      
      // Handle uprooting and replanting with intensity scaling
      if (taskId === 'uproot-vines' || taskId === 'replant-vines') {
        taskAmount *= (options.replantingIntensity / 100);
        
        // Add replanting intensity factor
        factors.push({
          label: 'Replanting Intensity',
          value: `${options.replantingIntensity}%`,
          modifier: (options.replantingIntensity / 100) - 1, // -1 to 0 range
          modifierLabel: 'work scaling'
        });
        
        // Note: Health setting is handled separately in health calculation logic
      } else {
        // Additive health tasks use healthImprovement
        if ('healthImprovement' in task && task.healthImprovement) {
          healthImprovement += task.healthImprovement;
        }
      }

      if (taskAmount <= 0) return;

      // Get task-specific modifiers
      let taskModifiers = [soilModifier, terrainModifier, overgrowthModifier];
      
      // Add vine age modifier for vine uprooting and replanting tasks
      if (taskId === 'uproot-vines' || taskId === 'replant-vines') {
        const vineAgeModifier = getVineAgeModifier(vineyard.vineAge);
        taskModifiers.push(vineAgeModifier);
        
        if (Math.abs(vineAgeModifier) > 0.01) {
          factors.push({
            label: 'Vine Age',
            value: `${vineyard.vineAge || 0} years`,
            modifier: vineAgeModifier,
            modifierLabel: 'removal difficulty'
          });
        }
      }

      // Use the proper work calculator
      const taskWork = calculateTotalWork(taskAmount, {
        rate: task.rate,
        initialWork: task.initialWork,
        useDensityAdjustment: taskId === 'uproot-vines' || taskId === 'replant-vines', // Vine uprooting and replanting use density adjustment
        density: vineyard.density,
        workModifiers: taskModifiers
      });
      
      totalClearingWork += taskWork;

      // Add task-specific factor
      factors.push({
        label: task.name,
        value: taskAmount,
        unit: 'hectares',
        modifier: task.initialWork / (taskAmount * task.rate * 25), // Initial work as modifier
        modifierLabel: 'setup work'
      });

      // Add density factor for vine uprooting and replanting
      if ((taskId === 'uproot-vines' || taskId === 'replant-vines') && vineyard.density > 0) {
        const densityModifier = (vineyard.density / DEFAULT_VINE_DENSITY) - 1; // Use correct constant
        if (Math.abs(densityModifier) > 0.05) { // Only show if significant (>5%)
          factors.push({
            label: 'Vine Density',
            value: `${formatNumber(vineyard.density, { decimals: 0 })} vines/ha`,
            modifier: densityModifier,
            modifierLabel: 'density effect'
          });
        }
      }
    });

    // Add total tasks factor
    const selectedTaskCount = Object.values(options.tasks).filter(Boolean).length;
    if (selectedTaskCount > 0) {
      factors.push({
        label: 'Selected Tasks',
        value: selectedTaskCount,
        modifier: selectedTaskCount > 1 ? 0.1 : 0, // 10% efficiency bonus for multiple tasks
        modifierLabel: 'task coordination'
      });
    }

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
    const weeks = totalClearingWork > 0 ? Math.ceil(totalClearingWork / 25) : 0; // 25 = BASE_WORK_UNITS
    const timeEstimate = `${weeks} week${weeks === 1 ? '' : 's'}`;

    setWorkEstimate({
      totalWork: Math.round(totalClearingWork),
      timeEstimate,
    });

    setWorkFactors(factors);
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
                className="mr-3 h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine"
              />
              <label htmlFor="clear-vegetation" className="text-sm text-gray-700">
                Clear vegetation
                <span className="text-green-600 ml-2 font-medium">(+10% health)</span>
              </label>
            </div>
            
            {/* Remove Debris */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remove-debris"
                checked={options.tasks['remove-debris']}
                onChange={(e) => handleTaskChange('remove-debris', e.target.checked)}
                className="mr-3 h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine"
              />
              <label htmlFor="remove-debris" className="text-sm text-gray-700">
                Remove debris
                <span className="text-green-600 ml-2 font-medium">(+5% health)</span>
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
                <span className="text-green-600 ml-2 font-medium">(Sets health to 70%)</span>
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
                      {(vineyard.vineAge * (1 - options.replantingIntensity/100)).toFixed(1)} years)
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
                <span className="text-sm font-medium text-gray-700">{Math.round(projectedHealth * 100)}%</span>
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
                  <span className="text-gray-600">Current: {Math.round(vineyard.vineyardHealth * 100)}%</span>
                  <span className={`font-medium ${healthImprovement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {healthImprovement > 0 ? '+' : ''}{Math.round(healthImprovement * 100)}% health {healthImprovement > 0 ? 'improvement' : 'reduction'}
                  </span>
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
            className={`px-4 py-2 rounded-md font-medium ${
              canSubmit()
                ? 'bg-wine-600 hover:bg-wine-700 text-white'
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
