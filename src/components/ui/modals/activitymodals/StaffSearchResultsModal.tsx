// Staff Search Results Modal
// Displays generated candidate list after search completion

import React, { useState, useEffect } from 'react';
import { Staff } from '@/lib/types/types';
import { getSkillLevelInfo, SPECIALIZED_ROLES } from '@/lib/constants/staffConstants';
import { formatNumber, getFlagIcon, getSpecializationIcon, getColorClass } from '@/lib/utils';
import { getWageColorClass } from '@/lib/services';
import { Button, Badge, StaffSkillBarsList, WarningModal } from '@/components/ui';
import { startHiringProcess, clearPendingCandidates } from '@/lib/services/activity/activitymanagers/staffSearchManager';
import { X } from 'lucide-react';

interface StaffSearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: Staff[];
}

/**
 * Modal displaying staff search results
 * Shows all generated candidates with option to hire each
 * Removes candidates from list when hired to prevent duplicate hires
 */
export const StaffSearchResultsModal: React.FC<StaffSearchResultsModalProps> = ({
  isOpen,
  onClose,
  candidates
}) => {
  // Track which candidates have been hired (by ID)
  const [hiredCandidateIds, setHiredCandidateIds] = useState<Set<string>>(new Set());
  // Track which candidate is selected for preview
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  
  // Filter out candidates that have already been hired
  const availableCandidates = candidates?.filter(c => !hiredCandidateIds.has(c.id)) || [];
  
  // Auto-select first available candidate when modal opens or when candidates change
  useEffect(() => {
    if (availableCandidates.length > 0 && !selectedCandidateId) {
      setSelectedCandidateId(availableCandidates[0].id);
    } else if (availableCandidates.length > 0 && selectedCandidateId && !availableCandidates.find(c => c.id === selectedCandidateId)) {
      // If currently selected candidate was hired, select the first available one
      setSelectedCandidateId(availableCandidates[0].id);
    } else if (availableCandidates.length === 0) {
      // No candidates available, clear selection
      setSelectedCandidateId(null);
    }
  }, [availableCandidates, selectedCandidateId]);

  if (!isOpen || !candidates || candidates.length === 0) return null;

  const handleHire = async (candidate: Staff) => {
    const activityId = await startHiringProcess(candidate);
    if (activityId) {
      // Mark this candidate as hired (remove from available list)
      setHiredCandidateIds(prev => new Set([...prev, candidate.id]));
    }
  };

  const handleClose = () => {
    clearPendingCandidates();
    setHiredCandidateIds(new Set()); // Reset hired list
    setSelectedCandidateId(null); // Reset selected candidate
    onClose();
  };

  const handleCandidateSelect = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
  };

  // Get the selected candidate for preview
  const selectedCandidate = selectedCandidateId 
    ? candidates.find(c => c.id === selectedCandidateId)
    : null;

  // If all candidates have been hired, show completion message
  if (availableCandidates.length === 0 && hiredCandidateIds.size > 0) {
    return (
      <WarningModal
        isOpen={true}
        onClose={handleClose}
        severity="info"
        title="All Candidates Hired!"
        message={`You've hired all ${hiredCandidateIds.size} candidate${hiredCandidateIds.size !== 1 ? 's' : ''} from this search.`}
        actions={[
          {
            label: 'Close',
            onClick: handleClose,
            variant: 'default'
          }
        ]}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Staff Search Results</h2>
            <p className="text-sm text-gray-400 mt-1">
              {availableCandidates.length} candidate{availableCandidates.length !== 1 ? 's' : ''} available
              {hiredCandidateIds.size > 0 && ` (${hiredCandidateIds.size} already hired)`}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Two Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Candidate List */}
          <div className="w-1/2 border-r border-gray-700 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Available Candidates</h3>
              <div className="space-y-2">
                {availableCandidates.map((candidate, index) => {
                  const skillInfo = getSkillLevelInfo(candidate.skillLevel);
                  const isSelected = selectedCandidateId === candidate.id;
                  
                  return (
                    <div 
                      key={candidate.id || index} 
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-500' 
                          : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      }`}
                      onClick={() => handleCandidateSelect(candidate.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`${getFlagIcon(candidate.nationality)} text-lg`}></span>
                          <div className="flex-1">
                            <div className="font-medium text-white">{candidate.name}</div>
                            <div className="text-xs text-gray-400">{skillInfo.name}</div>
                            {candidate.specializations.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {candidate.specializations.map(spec => (
                                  <span key={spec} className="text-xs">
                                    {getSpecializationIcon(spec)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-white">{formatNumber(candidate.wage, { currency: true })}</div>
                          <div className="text-xs text-gray-400">per week</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Candidate Preview */}
          <div className="w-1/2 overflow-y-auto">
            {selectedCandidate ? (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Candidate Preview</h3>
                
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-sm font-medium text-white mb-4">Personal Information</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Name:</span>
                        <div className="flex items-center gap-2">
                          <span className={`${getFlagIcon(selectedCandidate.nationality)} text-base`}></span>
                          <span className="text-white font-medium">{selectedCandidate.name}</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Nationality:</span>
                        <span className="text-white">{selectedCandidate.nationality}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Skill Level:</span>
                        <Badge variant="outline" className={`text-xs bg-gray-600 text-white border-gray-500 ${getColorClass(selectedCandidate.skillLevel)}`}>
                          {getSkillLevelInfo(selectedCandidate.skillLevel).name} ({Math.round(selectedCandidate.skillLevel * 100)}%)
                        </Badge>
                      </div>
                      {selectedCandidate.specializations.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Specializations:</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {selectedCandidate.specializations.map(spec => (
                        <Badge key={spec} variant="secondary" className="text-xs bg-blue-600 text-white flex items-center gap-1">
                          <span>{getSpecializationIcon(spec)}</span>
                          <span>{SPECIALIZED_ROLES[spec]?.title || spec}</span>
                        </Badge>
                      ))}
                    </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-sm font-medium text-white mb-4">Skills</h4>
                    <StaffSkillBarsList staff={selectedCandidate} />
                    <p className="text-xs text-gray-400 mt-3">
                      Skills are randomly generated based on the skill level. Higher skill level means better overall skills.
                      {selectedCandidate.specializations.length > 0 && (
                        <span className="block mt-1">
                          Specializations provide bonuses to specific skill areas (marked with higher values).
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Weekly Wage */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-sm font-medium text-white mb-4">Weekly Wage</h4>
                    <div className="bg-green-600 rounded-lg p-4 text-center">
                      <div className={`text-3xl font-bold ${getWageColorClass(selectedCandidate.wage, 'weekly')}`}>
                        {formatNumber(selectedCandidate.wage, { currency: true })}
                      </div>
                      <div className="text-sm text-green-100 mt-2">
                        Wage is calculated based on average skill level. Paid seasonally (12 weeks).
                      </div>
                    </div>
                  </div>

                  {/* Hire Button */}
                  <div className="pt-4">
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleHire(selectedCandidate)}
                    >
                      Hire {selectedCandidate.name}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <div className="text-lg mb-2">Select a candidate</div>
                  <div className="text-sm">Choose a candidate from the list to view details</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            <span className="font-medium text-white">{availableCandidates.length}</span> candidate{availableCandidates.length !== 1 ? 's' : ''} remaining
          </div>
          <Button
            variant="outline"
            onClick={handleClose}
            className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

