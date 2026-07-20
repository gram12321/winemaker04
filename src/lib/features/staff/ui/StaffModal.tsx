import React, { useEffect, useMemo, useState } from 'react';
import { Activity } from '@/lib/types/types';
import { DialogProps } from '@/lib/types/UItypes';
import { formatNumber, getFlagIcon, getColorClass } from '@/lib/utils';
import type { StaffActivityAdapter, StaffRecord } from '../featureTypes';
import { getStaffExperiencePresentation } from '../services/staffPresentationService';
import { getWageColorClass } from '../services/wageCalculations';
import { getSkillLevelInfo, SPECIALIZED_ROLES, WEEKS_PER_SEASON, WEEKS_PER_YEAR } from '@/lib/constants';
import { Button, Badge } from '@/components/ui';
import { StaffSkillBarsList } from './StaffSkillBar';
import { useGameState, useGameStateWithData } from '@/hooks/useGameState';

interface StaffModalProps extends DialogProps {
  staff: StaffRecord | null;
  activityApi: StaffActivityAdapter;
  onFire?: (staffId: string) => void;
}

const StaffModal: React.FC<StaffModalProps> = ({ isOpen, onClose, staff, activityApi, onFire }) => {
  const gameState = useGameState();
  const activities = useGameStateWithData(activityApi.reads.getAll, []);
  const allStaffMembers = gameState.staff ?? [];
  const { activeAssignments, staffTaskCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    const assignments: Activity[] = [];

    activities.forEach(activity => {
      const assignedIds = activity.params?.assignedStaffIds;
      if (!Array.isArray(assignedIds) || assignedIds.length === 0) {
        return;
      }

      assignedIds.forEach(id => {
        counts.set(id, (counts.get(id) || 0) + 1);
      });

      if (staff?.id && assignedIds.includes(staff.id)) {
        assignments.push(activity);
      }
    });

    return { activeAssignments: assignments, staffTaskCounts: counts };
  }, [activities, staff?.id]);
  const [assignmentPreviews, setAssignmentPreviews] = useState<Record<string, { teamWorkPerWeek: number; personalWorkPerWeek: number }>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(activeAssignments.map(async activity => {
      const assignedIds = activity.params.assignedStaffIds || [];
      const assignedStaff = allStaffMembers.filter(member => assignedIds.includes(member.id));
      const context = await activityApi.work.getContext(activity, activities, gameState, assignedIds);
      const preview = activityApi.work.getPreview(activity, assignedStaff, context);
      return [activity.id, {
        teamWorkPerWeek: preview.workPerWeek,
        personalWorkPerWeek: preview.allocation.contributions.get(staff?.id || '') || 0,
      }] as const;
    })).then(entries => {
      if (!cancelled) setAssignmentPreviews(Object.fromEntries(entries));
    }).catch(error => {
      console.error('Failed to calculate staff assignment previews:', error);
      if (!cancelled) setAssignmentPreviews({});
    });
    return () => { cancelled = true; };
  }, [activeAssignments, activities, allStaffMembers, gameState, staff?.id]);

  if (!isOpen || !staff) return null;

  const skillInfo = getSkillLevelInfo(staff.skillLevel);
  const experiencePresentation = getStaffExperiencePresentation(staff);
  const allTeams = gameState.teams || [];

  const handleFire = () => {
    if (onFire && confirm(`Are you sure you want to fire ${staff.name}?`)) {
      onFire(staff.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col scrollbar-styled">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className={`${getFlagIcon(staff.nationality)} text-base`}></span>
              {staff.name}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {staff.nationality} • {skillInfo.name} • Hired Week {staff.hireDate.week}, {staff.hireDate.season} {staff.hireDate.year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-styled">
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Nationality:</span>
                  <div className="text-white font-medium flex items-center gap-2 mt-1">
                    <span className={`${getFlagIcon(staff.nationality)} text-base`}></span>
                    {staff.nationality}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400">Broad role{staff.specializedRoles.length === 1 ? '' : 's'}:</span>
                  {staff.specializedRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {staff.specializedRoles.map(role => (
                        <Badge key={role} variant="secondary" className="text-xs bg-amber-600 text-white" title={SPECIALIZED_ROLES[role].description}>
                          {SPECIALIZED_ROLES[role].title}
                        </Badge>
                      ))}
                    </div>
                  ) : <div className="text-sm text-gray-500 mt-1">No broad role</div>}
                </div>
                <div>
                  <span className="text-gray-400">Skill Level:</span>
                  <div className={`font-medium mt-1 ${getColorClass(staff.skillLevel)}`}>
                    {skillInfo.name} ({formatNumber(staff.skillLevel * 100, { decimals: 0 })}%)
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Skills</h3>
              <StaffSkillBarsList staff={staff} />
              <p className="text-xs text-gray-400 mt-3">
                Skills range from 0-100% based on training and experience.
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Compensation</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Weekly Wage:</span>
                  <span className={`font-medium ${getWageColorClass(staff.wage, 'weekly')}`}>{formatNumber(staff.wage, { currency: true })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Seasonal Wage ({WEEKS_PER_SEASON} weeks):</span>
                  <span className={`font-medium ${getWageColorClass(staff.wage * WEEKS_PER_SEASON, 'seasonal')}`}>{formatNumber(staff.wage * WEEKS_PER_SEASON, { currency: true })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Annual Wage ({WEEKS_PER_YEAR} weeks):</span>
                  <span className={`font-medium ${getWageColorClass(staff.wage * WEEKS_PER_YEAR, 'annual')}`}>{formatNumber(staff.wage * WEEKS_PER_YEAR, { currency: true })}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Wages are calculated from XP-adjusted primary skills and the distinct primary-skill groups represented by broad roles.
                Payments are processed at the start of each season (every {WEEKS_PER_SEASON} weeks).
                {staff.specializedRoles.length > 0 && (
                  <span className="block mt-1">Broad role bonuses apply to every activity using the matching primary skill.</span>
                )}
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Experience Breakdown</h3>
              {experiencePresentation.totalXP > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400 block mb-2">Skill Experience</span>
                    <div className="space-y-3">
                      {experiencePresentation.skillExperience.map(item => (
                            <div key={item.key} className="text-white">
                              <div className="flex justify-between items-center mb-1">
                                <span className="capitalize">{item.label}</span>
                                <span className="text-xs text-gray-400">{formatNumber(item.xp, { decimals: 0 })} XP</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${item.progressPercent}% ` }}
                                ></div>
                              </div>
                            </div>
                      ))}
                      {experiencePresentation.skillExperience.length === 0 && (
                        <span className="text-gray-500 text-xs italic">No skill experience yet</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-400 block mb-2">Task Mastery</span>
                    <div className="space-y-3">
                      {experiencePresentation.taskMastery.map(item => (
                        <div key={item.key} className="text-white">
                          <div className="flex justify-between items-center mb-1"><span>{item.label}</span><span className="text-xs text-gray-400">{formatNumber(item.xp, { decimals: 0 })} XP</span></div>
                          <div className="w-full bg-gray-700 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${item.progressPercent}%` }} /></div>
                        </div>
                      ))}
                      {experiencePresentation.taskMastery.length === 0 && <span className="text-gray-500 text-xs italic">No task mastery yet</span>}
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-400 block mb-2">Grape Mastery</span>
                    <div className="space-y-3">
                      {experiencePresentation.grapeMastery.map(item => (
                            <div key={item.key} className="text-white">
                              <div className="flex justify-between items-center mb-1">
                                <span>{item.label}</span>
                                <span className="text-xs text-gray-400">{formatNumber(item.xp, { decimals: 0 })} XP</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${item.progressPercent}% ` }}
                                ></div>
                              </div>
                            </div>
                      ))}
                      {experiencePresentation.grapeMastery.length === 0 && (
                        <span className="text-gray-500 text-xs italic">No grape mastery yet</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No experience gained yet.</p>
              )}
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Employment Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Hire Date:</span>
                  <div className="text-white font-medium mt-1">
                    Week {staff.hireDate.week}, {staff.hireDate.season} {staff.hireDate.year}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Team Assignments:</span>
                  <div className="text-white font-medium mt-1">
                    {staff.teamIds.length > 0 ? (
                      <div className="space-y-1">
                        {staff.teamIds.map(teamId => {
                          const team = allTeams.find(t => t.id === teamId);
                          return team ? (
                            <div key={teamId} className="flex items-center gap-2">
                              <span>{team.icon}</span>
                              <span>{team.name}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      'Unassigned'
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Active Assignments</h3>
              {activeAssignments.length > 0 ? (
                <div className="space-y-3">
                  {activeAssignments.map(activity => {
                    const categoryInfo = activityApi.catalog.workCategoryInfo[activity.category];
                    const assignmentProgress = activity.totalWork > 0
                      ? Math.min(100, Math.round((activity.completedWork / activity.totalWork) * 100))
                      : 0;
                    const assignedCount = Array.isArray(activity.params?.assignedStaffIds)
                      ? activity.params.assignedStaffIds.length
                      : 0;
                    const assignmentPreview = assignmentPreviews[activity.id];
                    const teamWorkPerWeek = assignmentPreview?.teamWorkPerWeek || 0;
                    const personalTaskCount = staffTaskCounts.get(staff.id) || 1;
                    const personalWorkPerWeek = assignmentPreview?.personalWorkPerWeek || 0;
                    const attentionShare = 1 / Math.max(1, personalTaskCount);

                    return (
                      <div
                        key={activity.id}
                        className="rounded-md border border-gray-700 bg-gray-900/60 p-3"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">{activity.title}</p>
                            <p className="text-xs text-gray-400">
                              {categoryInfo?.displayName ?? activity.category}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500">
                            Week {activity.gameWeek}, {activity.gameSeason} {activity.gameYear}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-300">
                          <span>
                            Progress:{' '}
                            <span className="font-semibold text-white">
                              {formatNumber(assignmentProgress, { decimals: 0 })}%
                            </span>
                          </span>
                          <span>
                            Work:{' '}
                            <span className="font-semibold text-white">
                              {formatNumber(activity.completedWork, { decimals: 0 })}
                            </span>
                            {' / '}
                            {formatNumber(activity.totalWork, { decimals: 0 })}
                          </span>
                          <span>
                            Team Size:{' '}
                            <span className="font-semibold text-white">{assignedCount}</span>
                          </span>
                          <span>
                            Attention:{' '}
                            <span className="font-semibold text-white">
                              {formatNumber(attentionShare, { percent: true, decimals: 0 })}
                            </span>
                            <span className="text-gray-500">
                              {' '}
                              ({personalTaskCount} task{personalTaskCount === 1 ? '' : 's'})
                            </span>
                          </span>
                          <span>
                            Contribution:{' '}
                            <span className="font-semibold text-white">
                              {formatNumber(personalWorkPerWeek, { decimals: 0 })}
                            </span>
                            {' / '}
                            {formatNumber(teamWorkPerWeek, { decimals: 0 })} wk
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  This employee is not assigned to any active tasks.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
          >
            Close
          </Button>
          {onFire && (
            <Button
              onClick={handleFire}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Fire Employee
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffModal;
