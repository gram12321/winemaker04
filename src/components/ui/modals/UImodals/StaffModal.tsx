import React, { useMemo } from 'react';
import { Activity, Staff } from '@/lib/types/types';
import { DialogProps } from '@/lib/types/UItypes';
import { formatNumber, getFlagIcon, getSpecializationIcon, getColorClass } from '@/lib/utils';
import { calculateStaffWorkContribution, getWageColorClass, getAllTeams, getAllActivities } from '@/lib/services';
import { WORK_CATEGORY_INFO, getSkillLevelInfo, SPECIALIZED_ROLES } from '@/lib/constants';
import { normalizeXP } from '@/lib/utils/calculator';
import { calculateEffectiveSkill } from '@/lib/services/user/staffService';
import { StaffSkillBarsList, Button, Badge } from '@/components/ui';
import { useGameState, useGameStateWithData } from '@/hooks';

interface StaffModalProps extends DialogProps {
  staff: Staff | null;
  onFire?: (staffId: string) => void;
}

const StaffModal: React.FC<StaffModalProps> = ({ isOpen, onClose, staff, onFire }) => {
  const gameState = useGameState();
  const activities = useGameStateWithData(getAllActivities, []);
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

  if (!isOpen || !staff) return null;

  const skillInfo = getSkillLevelInfo(staff.skillLevel);
  const allTeams = getAllTeams();

  const handleFire = () => {
    if (onFire && confirm(`Are you sure you want to fire ${staff.name}?`)) {
      onFire(staff.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col scrollbar-styled">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className={`${getFlagIcon(staff.nationality)} text - base`}></span>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-styled">
          <div className="space-y-6">
            {/* Personal Information */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Nationality:</span>
                  <div className="text-white font-medium flex items-center gap-2 mt-1">
                    <span className={`${getFlagIcon(staff.nationality)} text - base`}></span>
                    {staff.nationality}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Skill Level:</span>
                  <div className={`font - medium mt - 1 ${getColorClass(staff.skillLevel)} `}>
                    {skillInfo.name} ({formatNumber(staff.skillLevel * 100, { decimals: 0 })}%)
                  </div>
                </div>
                {staff.specializations.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-gray-400">Specializations:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {staff.specializations.map(spec => (
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
              <h3 className="font-semibold text-white mb-4">Skills</h3>
              <StaffSkillBarsList staff={staff} />
              <p className="text-xs text-gray-400 mt-3">
                Skills range from 0-100% based on training and experience.
                {staff.specializations.length > 0 && (
                  <span className="block mt-1">
                    Specializations provide bonuses to specific skill areas.
                  </span>
                )}
              </p>
            </div>

            {/* Compensation */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Compensation</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Weekly Wage:</span>
                  <span className={`font - medium ${getWageColorClass(staff.wage, 'weekly')} `}>{formatNumber(staff.wage, { currency: true })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Seasonal Wage (12 weeks):</span>
                  <span className={`font - medium ${getWageColorClass(staff.wage * 12, 'seasonal')} `}>{formatNumber(staff.wage * 12, { currency: true })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Annual Wage (48 weeks):</span>
                  <span className={`font - medium ${getWageColorClass(staff.wage * 48, 'annual')} `}>{formatNumber(staff.wage * 48, { currency: true })}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Wages are calculated based on skill level and specializations.
                Payments are processed at the start of each season (every 12 weeks).
                {staff.specializations.length > 0 && (
                  <span className="block mt-1">
                    This employee has {staff.specializations.length} specialization{staff.specializations.length > 1 ? 's' : ''}, which increases their base wage.
                  </span>
                )}
              </p>
            </div>

            {/* Experience Breakdown */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Experience Breakdown</h3>
              {staff.experience && Object.keys(staff.experience).length > 0 ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Skill Experience */}
                  <div>
                    <span className="text-gray-400 block mb-2">Skill Experience</span>
                    <div className="space-y-3">
                      {Object.entries(staff.experience)
                        .filter(([key]) => key.startsWith('skill:'))
                        .map(([key, value]) => {
                          const skillName = key.replace('skill:', '');
                          // Use normalizeXP with raw XP
                          const progress = normalizeXP(value) * 100;

                          return (
                            <div key={key} className="text-white">
                              <div className="flex justify-between items-center mb-1">
                                <span className="capitalize">{skillName.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span className="text-xs text-gray-400">{formatNumber(value, { decimals: 0 })} XP</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progress}% ` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      {Object.keys(staff.experience).filter(k => k.startsWith('skill:')).length === 0 && (
                        <span className="text-gray-500 text-xs italic">No skill experience yet</span>
                      )}
                    </div>
                  </div>

                  {/* Other Experience (e.g. Grapes) */}
                  <div>
                    <span className="text-gray-400 block mb-2">Specialized Experience</span>
                    <div className="space-y-3">
                      {Object.entries(staff.experience)
                        .filter(([key]) => !key.startsWith('skill:'))
                        .map(([key, value]) => {
                          const [type, name] = key.split(':');
                          // Use normalizeXP with raw XP
                          const progress = normalizeXP(value) * 100;

                          return (
                            <div key={key} className="text-white">
                              <div className="flex justify-between items-center mb-1">
                                <span className="capitalize">
                                  <span className="text-gray-500 text-xs mr-1">{type}:</span>
                                  {name}
                                </span>
                                <span className="text-xs text-gray-400">{formatNumber(value, { decimals: 0 })} XP</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progress}% ` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      {Object.keys(staff.experience).filter(k => !k.startsWith('skill:')).length === 0 && (
                        <span className="text-gray-500 text-xs italic">No specialized experience yet</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No experience gained yet.</p>
              )}
            </div>

            {/* Employment Details */}
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

            {/* Active Assignments */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Active Assignments</h3>
              {activeAssignments.length > 0 ? (
                <div className="space-y-3">
                  {activeAssignments.map(activity => {
                    const categoryInfo = WORK_CATEGORY_INFO[activity.category];
                    const assignmentProgress = activity.totalWork > 0
                      ? Math.min(100, Math.round((activity.completedWork / activity.totalWork) * 100))
                      : 0;
                    const assignedCount = Array.isArray(activity.params?.assignedStaffIds)
                      ? activity.params.assignedStaffIds.length
                      : 0;
                    const relevantSkillKey = (categoryInfo?.skill ?? 'field') as keyof Staff['skills'];
                    const assignedIds = activity.params?.assignedStaffIds || [];
                    const assignedStaff = allStaffMembers.filter(member => assignedIds.includes(member.id));
                    const grapeVariety = activity.params?.grape;
                    const teamWorkPerWeek = assignedStaff.length > 0
                      ? calculateStaffWorkContribution(assignedStaff, activity.category, staffTaskCounts, grapeVariety)
                      : 0;

                    const totalIndividualWork = assignedStaff.reduce((total, member) => {
                      const memberSkill = member.skills[relevantSkillKey] ?? 0;
                      const rawXP = member.experience?.[`skill:${relevantSkillKey} `] || 0;
                      const skillWithXP = calculateEffectiveSkill(memberSkill, rawXP);
                      const hasSpecialization = member.specializations.includes(relevantSkillKey);
                      const effectiveSkill = hasSpecialization ? skillWithXP * 1.2 : skillWithXP;
                      const memberTaskCount = staffTaskCounts.get(member.id) || 1;
                      return total + (member.workforce * effectiveSkill) / memberTaskCount;
                    }, 0);

                    const personalSkillValue = staff.skills[relevantSkillKey] ?? 0;
                    const personalRawXP = staff.experience?.[`skill:${relevantSkillKey} `] || 0;
                    const personalSkillWithXP = calculateEffectiveSkill(personalSkillValue, personalRawXP);
                    const personalSpecialization = staff.specializations.includes(relevantSkillKey);
                    const personalEffectiveSkill = personalSpecialization ? personalSkillWithXP * 1.2 : personalSkillWithXP;
                    const personalTaskCount = staffTaskCounts.get(staff.id) || 1;
                    const personalBaseContribution = (staff.workforce * personalEffectiveSkill) / personalTaskCount;
                    const personalWorkPerWeek = totalIndividualWork > 0
                      ? (personalBaseContribution / totalIndividualWork) * teamWorkPerWeek
                      : 0;
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

        {/* Footer */}
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
