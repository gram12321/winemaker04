// Staff Assignment Modal
// Modal for assigning staff members to activities

import React, { useState, useEffect } from 'react';
import { Activity, Staff } from '@/lib/types/types';
import { updateActivityInDb } from '@/lib/database/activities/activityDB';
import { calculateStaffWorkContribution, calculateEstimatedWeeks, getRelevantSkillName } from '@/lib/services/activity/workcalculators/workCalculator';
import { notificationService } from '@/components/layout/NotificationCenter';
import { NotificationCategory } from '@/lib/types/types';
import { triggerGameUpdateImmediate } from '@/hooks/useGameUpdates';
import { formatNumber, getFlagIcon, getSpecializationIcon, getSkillColor } from '@/lib/utils';
import { getSkillLevelInfo, SPECIALIZED_ROLES } from '@/lib/constants/staffConstants';
import { Button } from '@/components/ui/shadCN/button';
import { StaffSkillBarsList } from '@/components/ui/components/StaffSkillBar';
import { useGameState } from '@/hooks';
import { getTeamForCategory } from '@/lib/services/user/teamService';

interface StaffAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity;
}

/**
 * Modal for assigning staff to an activity
 * Shows available staff with skill visualizations and live work calculation
 */
export const StaffAssignmentModal: React.FC<StaffAssignmentModalProps> = ({
  isOpen,
  onClose,
  activity
}) => {
  const gameState = useGameState();
  const allStaff = gameState.staff || [];
  const currentAssignedIds = activity.params.assignedStaffIds || [];
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(currentAssignedIds);
  const [selectAll, setSelectAll] = useState(false);
  
  // Update select all state when selection changes
  useEffect(() => {
    setSelectAll(selectedStaffIds.length === allStaff.length && allStaff.length > 0);
  }, [selectedStaffIds, allStaff.length]);
  
  if (!isOpen) return null;
  
  const handleToggleStaff = (staffId: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };
  
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(allStaff.map(s => s.id));
    }
  };
  
  const handleSave = async () => {
    try {
      // Update activity with new staff assignments
      const success = await updateActivityInDb(activity.id, {
        params: {
          ...activity.params,
          assignedStaffIds: selectedStaffIds
        }
      });
      
      if (success) {
        // Trigger immediate UI update
        triggerGameUpdateImmediate();
        await notificationService.addMessage(`Assigned ${selectedStaffIds.length} staff to ${activity.title}`, 'staffAssignmentModal.handleSave', 'Staff Assignment', NotificationCategory.STAFF_MANAGEMENT);
        onClose();
      } else {
        await notificationService.addMessage('Failed to assign staff', 'staffAssignmentModal.handleSave', 'Staff Assignment Error', NotificationCategory.SYSTEM);
      }
    } catch (error) {
      console.error('Error assigning staff:', error);
      await notificationService.addMessage('Failed to assign staff', 'staffAssignmentModal.handleSave', 'Staff Assignment Error', NotificationCategory.SYSTEM);
    }
  };
  
  // Calculate work preview
  const selectedStaff = allStaff.filter(s => selectedStaffIds.includes(s.id));
  const staffTaskCounts = new Map<string, number>();
  // For now, assume each selected staff is only on this task (task count = 1)
  selectedStaff.forEach(s => staffTaskCounts.set(s.id, 1));
  
  const workPerWeek = selectedStaff.length > 0
    ? calculateStaffWorkContribution(selectedStaff, activity.category, staffTaskCounts)
    : 0;
  
  const remainingWork = activity.totalWork - activity.completedWork;
  const weeksToComplete = selectedStaff.length > 0
    ? calculateEstimatedWeeks(selectedStaff, activity.category, staffTaskCounts, remainingWork)
    : 0;
  
  const relevantSkill = getRelevantSkillName(activity.category);
  
  // Get the team that auto-assigns to this activity
  const defaultTeam = getTeamForCategory(activity.category);
  const teamMemberCount = defaultTeam?.memberIds.length || 0;
  
  // Render skill bars for a staff member (reusable list component)
  const renderSkillBars = (staff: Staff) => (
    <div className="w-60">
      <StaffSkillBarsList
        staff={staff}
        relevantSkill={relevantSkill.toLowerCase() as any}
        taskCountMap={staffTaskCounts}
      />
    </div>
  );
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">Assign Staff</h2>
            <p className="text-sm text-gray-400 mt-1">{activity.title}</p>
            {defaultTeam && (
              <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <span>{defaultTeam.icon}</span>
                <span className="italic">
                  Auto-assigns team: {defaultTeam.name} ({teamMemberCount} {teamMemberCount === 1 ? 'member' : 'members'})
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>
        
        {/* Work Preview */}
        <div className="bg-gray-800 p-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-white mb-3">Work Progress Preview</h3>
          
          <div className="grid grid-cols-3 gap-4 mb-3 text-sm text-gray-300">
            <div>
              <span className="font-medium">Work per Week:</span> {formatNumber(workPerWeek, { decimals: 0 })} units
            </div>
            <div>
              <span className="font-medium">Progress:</span> {formatNumber(activity.completedWork, { decimals: 0 })}/{formatNumber(activity.totalWork, { decimals: 0 })} units
            </div>
            <div>
              <span className="font-medium">Weeks to Complete:</span> {weeksToComplete > 0 ? weeksToComplete : 'N/A'}
            </div>
          </div>
          
          {/* Progress bar with completed work + week segments overlay */}
          <div className="h-4 bg-gray-700 rounded-full relative overflow-hidden">
            {/* Completed work - solid fill */}
            <div
              className="h-full bg-green-600 absolute left-0 top-0 transition-all duration-300"
              style={{ width: `${(activity.completedWork / activity.totalWork) * 100}%` }}
            />
            
            {/* Week segments overlay for remaining work */}
            {weeksToComplete > 0 && weeksToComplete <= 20 && (
              <div className="h-full flex absolute left-0 top-0 w-full">
                {Array.from({ length: weeksToComplete }, (_, index) => {
                  const weekStart = (index * workPerWeek) / activity.totalWork * 100;
                  const weekEnd = ((index + 1) * workPerWeek) / activity.totalWork * 100;
                  const completedPercent = (activity.completedWork / activity.totalWork) * 100;
                  
                  // Only show segments that extend beyond completed work
                  const segmentStart = Math.max(weekStart, completedPercent);
                  const segmentEnd = weekEnd;
                  const segmentWidth = Math.max(0, segmentEnd - segmentStart);
                  
                  if (segmentWidth <= 0) return null; // Don't render if fully completed
                  
                  return (
                    <div
                      key={index}
                      className="h-full transition-all duration-300 bg-gray-500 opacity-60 m-0.5 rounded-sm"
                      title={`Week ${index + 1} (Planned)`}
                      style={{
                        width: `${segmentWidth}%`,
                        marginLeft: `${segmentStart - weekStart}%`
                      }}
                    />
                  );
                })}
              </div>
            )}
            
            {/* Fallback for long activities - just show completed work */}
            {weeksToComplete > 20 && (
              <div
                className="h-full bg-green-600 absolute left-0 top-0 transition-all duration-300"
                style={{ width: `${(activity.completedWork / activity.totalWork) * 100}%` }}
              />
            )}
          </div>
          
          {weeksToComplete > 20 && (
            <div className="text-xs text-gray-400 text-center mt-1">
              Progress bar shows one segment for each week of estimated work.
            </div>
          )}
          
          <p className="text-xs text-gray-400 mt-2">
            Primary skill for this activity: <span className="font-medium" style={{ color: getSkillColor(relevantSkill.toLowerCase() as any) }}>{relevantSkill}</span>
          </p>
        </div>
        
        {/* Staff List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-white">Available Staff ({allStaff.length})</h3>
          </div>
          
          {allStaff.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No staff available.</p>
              <p className="text-sm mt-2">Hire staff from the Staff page to assign them to activities.</p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Nationality</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Skills</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Specializations</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Wage</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="rounded border-gray-500 bg-gray-700"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {allStaff.map(staff => {
                    const skillInfo = getSkillLevelInfo(staff.skillLevel);
                    
                    return (
                      <tr key={staff.id} className="hover:bg-gray-750 transition-colors">
                        <td className="px-4 py-3 text-sm text-white">
                          <div className="flex items-center gap-2">
                            <span className={`${getFlagIcon(staff.nationality)} text-base`}></span>
                            <div>
                              <div>{staff.name}</div>
                              <div className="text-xs text-gray-400">{skillInfo.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">{staff.nationality}</td>
                        <td className="px-4 py-3">{renderSkillBars(staff)}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {staff.specializations.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {staff.specializations.map(spec => (
                                <span key={spec} className="text-xs bg-blue-600 text-white px-2 py-1 rounded flex items-center gap-1">
                                  <span>{getSpecializationIcon(spec)}</span>
                                  <span>{SPECIALIZED_ROLES[spec]?.title || spec}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 text-right">€{formatNumber(staff.wage)}/wk</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedStaffIds.includes(staff.id)}
                            onChange={() => handleToggleStaff(staff.id)}
                            className="rounded border-gray-500 bg-gray-700"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Assign {selectedStaffIds.length} Staff
          </Button>
        </div>
      </div>
    </div>
  );
};

