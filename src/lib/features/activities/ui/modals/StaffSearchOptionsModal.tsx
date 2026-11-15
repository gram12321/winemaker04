import { Dialog, DialogContent, DialogTitle } from '@/components/ui/shadCN/dialog';
import React, { useState } from 'react';
import { SpecializedRole } from '@/lib/types/types';
import type { StaffSearchOptions } from '../../services/workcalculators/staffSearchWorkCalculator';
import { calculateStaffSearchCost, calculateSearchWork, calculateHiringWorkRange, calculateSearchPreview } from '../../services/workcalculators/staffSearchWorkCalculator';
import { startStaffSearch } from '../../services/activitymanagers/staffSearchManager';
import { getSkillLevelInfo, SPECIALIZED_ROLES } from '@/lib/constants/staffConstants';
import { formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui';

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
    specializedRoles: []
  });

  const preview = calculateSearchPreview(options);
  const previewStats = {
    skillRange: preview.skillRange,
    wageRange: `${formatNumber(preview.minWeeklyWage, { currency: true })} - ${formatNumber(preview.maxWeeklyWage, { currency: true })}`,
    specializationBonus: preview.specializationBonusText,
  };
  const searchWorkEstimate = {
    totalWork: calculateSearchWork(options),
    cost: calculateStaffSearchCost(options),
  };
  const hiringWorkEstimate = calculateHiringWorkRange(options.skillLevel, options.specializedRoles);


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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent onPointerDownOutside={(event) => event.preventDefault()} aria-describedby={undefined} className="bg-gray-900 rounded-lg shadow-lg w-full max-w-4xl overflow-hidden flex flex-col w-[calc(100%-1rem)] max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] min-w-0 gap-0 p-0 [&>button]:text-gray-200">
        {/* Header */}
        <div className="flex justify-between items-start shrink-0 gap-3 p-4 pr-16 sm:p-6 sm:pr-16 border-b border-gray-700">
          <div>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-white">Staff Search</DialogTitle>
            <p className="text-sm text-gray-400 mt-1">Configure parameters for finding new staff candidates</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
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
                  aria-label="Number of candidates"
                  min="1"
                  max="10"
                  step="1"
                  value={options.numberOfCandidates}
                  onChange={(e) => setOptions(prev => ({ ...prev, numberOfCandidates: Number(e.target.value) }))}
                  className="min-h-11 w-full cursor-pointer accent-green-500"
                />
                <input
                  type="number"
                  aria-label="Number of candidates precise value"
                  className="mt-2 min-h-11 w-full rounded border border-gray-600 bg-gray-800 p-2 text-base text-white"
                  min={1}
                  max={10}
                  step={1}
                  value={options.numberOfCandidates ?? 1}
                  onChange={event => {
                    if (event.target.validity.valid && Number.isFinite(event.target.valueAsNumber)) {
                      const value = event.target.valueAsNumber;
                      setOptions(previous => ({ ...previous, numberOfCandidates: value }));
                    }
                  }}
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
                  aria-label="Minimum skill level"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={options.skillLevel}
                  onChange={(e) => setOptions(prev => ({ ...prev, skillLevel: Number(e.target.value) }))}
                  className="min-h-11 w-full cursor-pointer accent-green-500"
                />
                <input
                  type="number"
                  aria-label="Minimum skill level precise value"
                  className="mt-2 min-h-11 w-full rounded border border-gray-600 bg-gray-800 p-2 text-base text-white"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={options.skillLevel ?? 0.1}
                  onChange={event => {
                    if (event.target.validity.valid && Number.isFinite(event.target.valueAsNumber)) {
                      const value = event.target.valueAsNumber;
                      setOptions(previous => ({ ...previous, skillLevel: value }));
                    }
                  }}
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
                <label className="block text-sm font-medium text-white mb-3">Broad Roles (optional)</label>
                <div className="space-y-2 mb-6">
                  {(Object.keys(SPECIALIZED_ROLES) as SpecializedRole[]).map(role => (
                    <label key={role} className="flex min-h-11 items-start cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.specializedRoles.includes(role)}
                        onChange={event => setOptions(previous => ({
                          ...previous,
                          specializedRoles: event.target.checked
                            ? [...previous.specializedRoles, role]
                            : previous.specializedRoles.filter(current => current !== role),
                        }))}
                        className="mr-3 mt-1 h-4 w-4 rounded border-gray-500 bg-gray-700 text-amber-600 focus:ring-amber-500"
                      />
                      <div><div className="text-sm font-medium text-white">{SPECIALIZED_ROLES[role].title}</div><div className="text-xs text-gray-400">{SPECIALIZED_ROLES[role].description}</div></div>
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
                      <div className="text-xl sm:text-2xl font-bold text-white">{options.numberOfCandidates}</div>
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
                        Based on XP-adjusted primary skills and specialized roles. Paid seasonally.
                      </div>
                    </div>
                  </div>

                  {/* Specialization Bonus */}
                  {options.specializedRoles.length > 0 && (
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
                    <span className="text-white font-medium">{formatNumber(searchWorkEstimate.totalWork, { smartDecimals: true })} units</span>
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
        <div className="shrink-0 flex flex-col sm:flex-row sm:justify-end gap-2 p-4 sm:p-6 border-t [&_button]:min-h-11 [&_button]:whitespace-normal border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="min-h-11 h-auto w-full sm:w-auto whitespace-normal bg-green-600 hover:bg-green-700 text-white"
          >
            Start Search ({formatNumber(searchWorkEstimate.cost, { currency: true })})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

