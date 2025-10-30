import React, { useState, useEffect } from 'react';
import { StaffSearchOptions, calculateStaffSearchCost, calculateSearchWork, calculateHiringWorkRange, calculateSearchPreview, startStaffSearch } from '@/lib/services/activity/activitymanagers/staffSearchManager';
import { SPECIALIZED_ROLES, getSkillLevelInfo } from '@/lib/constants/staffConstants';
import { formatNumber, getSpecializationIcon } from '@/lib/utils';
import { Button } from '@/components/ui';
import { X } from 'lucide-react';

interface StaffSearchOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchStarted?: () => void;
}

export const StaffSearchOptionsModal: React.FC<StaffSearchOptionsModalProps> = ({
  isOpen,
  onClose,
  onSearchStarted
}) => {
  const [options, setOptions] = useState<StaffSearchOptions>({
    numberOfCandidates: 5,
    skillLevel: 0.3,
    specializations: []
  });

  // Preview calculations for search results
  const [previewStats, setPreviewStats] = useState<{
    skillRange: string;
    wageRange: string;
    specializationBonus: string;
  }>({
    skillRange: 'Calculating...',
    wageRange: 'Calculating...',
    specializationBonus: 'None'
  });

  const [searchWorkEstimate, setSearchWorkEstimate] = useState<{ totalWork: number; cost: number }>({
    totalWork: 0,
    cost: 0
  });

  // Hiring work estimate (range based on candidate quality spread)
  const [hiringWorkEstimate, setHiringWorkEstimate] = useState<{ minWork: number; maxWork: number }>({
    minWork: 0,
    maxWork: 0
  });

  // Calculate preview stats whenever options change
  useEffect(() => {
    const preview = calculateSearchPreview(options);
    
    setPreviewStats({
      skillRange: preview.skillRange,
      wageRange: `${formatNumber(preview.minWeeklyWage, { currency: true })} - ${formatNumber(preview.maxWeeklyWage, { currency: true })}`,
      specializationBonus: preview.specializationBonusText
    });
  }, [options]);

  // Calculate work estimates whenever options change
  useEffect(() => {
    // Search work calculation
    const totalWork = calculateSearchWork(options);
    const cost = calculateStaffSearchCost(options);

    setSearchWorkEstimate({
      totalWork: Math.round(totalWork),
      cost: Math.round(cost)
    });

    // Hiring work calculation (range)
    const hiring = calculateHiringWorkRange(options.skillLevel, options.specializations);
    setHiringWorkEstimate({
      minWork: hiring.minWork,
      maxWork: hiring.maxWork
    });
  }, [options]);


  // Handle submit
  const handleSubmit = async () => {
    const activityId = await startStaffSearch(options);
    if (activityId) {
      onClose();
      if (onSearchStarted) {
        onSearchStarted();
      }
    }
  };

  if (!isOpen) return null;

  const skillInfo = getSkillLevelInfo(options.skillLevel);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Staff Search</h2>
            <p className="text-sm text-gray-400 mt-1">Configure parameters for finding new staff candidates</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Search Configuration */}
            <div className="space-y-6">
              {/* Number of Candidates */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Number of Candidates ({options.numberOfCandidates})
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={options.numberOfCandidates}
                  onChange={(e) => setOptions(prev => ({ ...prev, numberOfCandidates: Number(e.target.value) }))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              {/* Skill Level */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Minimum Skill Level ({skillInfo.name})
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={options.skillLevel}
                  onChange={(e) => setOptions(prev => ({ ...prev, skillLevel: Number(e.target.value) }))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Novice</span>
                  <span>Master</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {skillInfo.description}
                </p>
              </div>

              {/* Specializations */}
              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Specializations (optional)
                </label>
                <div className="space-y-2">
                  {Object.entries(SPECIALIZED_ROLES).map(([key, role]) => (
                    <label key={key} className="flex items-start cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.specializations.includes(key)}
                        onChange={(e) => {
                          const newSpecs = e.target.checked
                            ? [...options.specializations, key]
                            : options.specializations.filter(s => s !== key);
                          setOptions(prev => ({ ...prev, specializations: newSpecs }));
                        }}
                        className="mr-3 mt-1 h-4 w-4 rounded border-gray-500 bg-gray-700 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white flex items-center gap-2">
                          <span>{getSpecializationIcon(key)}</span>
                          <span>{role.title}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{role.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Preview & Estimates */}
            <div className="space-y-6">
              {/* Search Preview */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Expected Results</h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                  {/* Candidate Count */}
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Candidates to Find</h4>
                    <div className="bg-blue-600 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-white">{options.numberOfCandidates}</div>
                      <div className="text-xs text-blue-100 mt-1">candidates will be generated</div>
                    </div>
                  </div>

                  {/* Skill Range */}
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Skill Range</h4>
                    <div className="bg-gray-700 rounded-lg p-3">
                      <div className="text-lg font-bold text-white text-center">{previewStats.skillRange}</div>
                      <div className="text-xs text-gray-300 mt-1 text-center">
                        Each candidate's skills will vary within this range
                      </div>
                    </div>
                  </div>

                  {/* Wage Range */}
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Weekly Wage Range</h4>
                    <div className="bg-green-600 rounded-lg p-3">
                      <div className="text-lg font-bold text-white text-center">{previewStats.wageRange}</div>
                      <div className="text-xs text-green-100 mt-1 text-center">
                        Based on skill level and specializations. Paid seasonally.
                      </div>
                    </div>
                  </div>

                  {/* Specialization Bonus */}
                  {options.specializations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Wage Bonus</h4>
                      <div className="bg-purple-600 rounded-lg p-3">
                        <div className="text-lg font-bold text-white text-center">{previewStats.specializationBonus}</div>
                        <div className="text-xs text-purple-100 mt-1 text-center">
                          Affects wages, search work, and hiring work
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Search Estimates */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Search Estimates</h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Search Cost:</span>
                    <span className="text-white font-medium">{formatNumber(searchWorkEstimate.cost, { currency: true })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Work Required:</span>
                    <span className="text-white font-medium">{searchWorkEstimate.totalWork} units</span>
                  </div>
                </div>
              </div>

              {/* Hiring Estimates */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Hiring Estimates (per selected candidate)</h3>
                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Work Required:</span>
                    <span className="text-white font-medium">{hiringWorkEstimate.minWork} - {hiringWorkEstimate.maxWork} units</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Actual hiring work depends on the candidate's generated skills and wage. 
                    Time to complete depends on your current staff's work capacity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Start Search ({formatNumber(searchWorkEstimate.cost, { currency: true })})
          </Button>
        </div>
      </div>
    </div>
  );
};

