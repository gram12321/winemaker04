
import React, { useMemo, useState } from 'react';
import type { StaffActivityAdapter, StaffRecord } from '../featureTypes';
import { toStaffRecord, toStaffTeam, toStaffTeamRecord } from '../services/staffModels';
import { removeStaff } from '../services/staffService';
import { assignStaffToTeam, removeStaffFromTeam, addTeam, updateTeam, removeTeam } from '../services/teamService';
import { createTeam } from '../services/teamDefinitions';
import { getStaffExperiencePresentation } from '../services/staffPresentationService';
import { calculateTotalWeeklyWages, getWageColorClass } from '../services/wageCalculations';
import { formatNumber, EMOJI_OPTIONS, getColorClass } from '@/lib/utils';
import { getSkillLevelInfo, SPECIALIZED_ROLES } from '@/lib/constants/staffConstants';
import { WEEKS_PER_MONTH } from '@/lib/constants/timeConstants';
import { Button, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, Label, Input } from '@/components/ui';
import StaffModal from './StaffModal';
import { StaffSkillBarsList } from './StaffSkillBar';
import { Users, Search, Edit3, Plus, Check, X } from 'lucide-react';
import { WorkCategory } from '@/lib/types/types';
import { useGameState, useGameStateWithData } from '@/hooks/useGameState';

interface StaffPageProps {
  title: string;
  activity: StaffActivityAdapter;
}

const createEmptyTeamData = () => ({ name: '', description: '', icon: '👥', defaultTaskTypes: [] as string[] });
type TeamDraft = ReturnType<typeof createEmptyTeamData>;

interface TeamIconPickerProps {
  open: boolean;
  value: string;
  onOpenChange(open: boolean): void;
  onSelect(icon: string): void;
}

function TeamIconPicker({ open, value, onOpenChange, onSelect }: TeamIconPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-2xl p-1">{value}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Icon</DialogTitle>
          <DialogDescription>Choose an emoji icon for your team</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-6 gap-2">
          {EMOJI_OPTIONS.map(emoji => (
            <Button key={emoji} variant="outline" size="sm" className="text-2xl p-2" onClick={() => onSelect(emoji)}>
              {emoji}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TeamTaskTypePickerProps {
  open: boolean;
  selectedTaskTypes: string[];
  onOpenChange(open: boolean): void;
  onSelect(taskType: string): void;
  getDisplayName(taskType: string): string;
}

function TeamTaskTypePicker({ open, selectedTaskTypes, onOpenChange, onSelect, getDisplayName }: TeamTaskTypePickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 w-6 p-0"><Edit3 className="h-3 w-3" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Task Types</DialogTitle>
          <DialogDescription>Choose which task types this team will handle</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(WorkCategory).map(category => {
            const taskType = category.toLowerCase();
            const selected = selectedTaskTypes.includes(taskType);
            return (
              <Button key={taskType} variant={selected ? 'default' : 'outline'} size="sm" className="justify-start" onClick={() => onSelect(taskType)} disabled={selected}>
                {getDisplayName(taskType)}
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const StaffPage: React.FC<StaffPageProps> = ({ title, activity }) => {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffRecord | null>(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [showTeamAssignmentDialog, setShowTeamAssignmentDialog] = useState(false);
  const [staffForTeamAssignment, setStaffForTeamAssignment] = useState<StaffRecord | null>(null);

  const [isCreatingNewTeam, setIsCreatingNewTeam] = useState(false);
  const [editingField, setEditingField] = useState<'name' | 'description' | 'icon' | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTaskTypePicker, setShowTaskTypePicker] = useState(false);
  const [newTeamData, setNewTeamData] = useState(createEmptyTeamData);

  const { staff: gameStaff, teams: gameTeams } = useGameState();
  const activities = useGameStateWithData(activity.reads.getAll, []);
  const allStaff = (gameStaff || []).map(toStaffRecord);
  const allTeams = (gameTeams || []).map(toStaffTeamRecord);
  const totalWages = calculateTotalWeeklyWages(allStaff);
  const { staffTaskCounts, totalActiveTasks } = useMemo(() => {
    const counts = new Map<string, number>();
    const activityList = Array.isArray(activities) ? activities : [];

    activityList.forEach(activity => {
      const assignedIds = activity.params?.assignedStaffIds;

      if (!Array.isArray(assignedIds) || assignedIds.length === 0) {
        return;
      }

      assignedIds.forEach(id => {
        counts.set(id, (counts.get(id) || 0) + 1);
      });
    });

    return {
      staffTaskCounts: counts,
      totalActiveTasks: activityList.length
    };
  }, [activities]);

  const filteredStaff = selectedTeamFilter === 'all'
    ? allStaff
    : allStaff.filter(staff => (staff.teamIds || []).includes(selectedTeamFilter));


  const handleFireStaff = async (staffId: string) => {
    await removeStaff(staffId);
  };

  const handleStaffCardClick = (staff: StaffRecord) => {
    setSelectedStaff(staff);
    setShowStaffModal(true);
  };

  const handleTeamAssignment = (staff: StaffRecord) => {
    setStaffForTeamAssignment(staff);
    setShowTeamAssignmentDialog(true);
  };

  const handleAssignToTeam = async (teamId: string) => {
    if (staffForTeamAssignment) {
      await assignStaffToTeam(staffForTeamAssignment.id, teamId);
      setShowTeamAssignmentDialog(false);
      setStaffForTeamAssignment(null);
    }
  };

  const handleRemoveFromTeam = async (teamId: string) => {
    if (staffForTeamAssignment) {
      await removeStaffFromTeam(staffForTeamAssignment.id, teamId);
      setShowTeamAssignmentDialog(false);
      setStaffForTeamAssignment(null);
    }
  };

  const handleStartCreatingTeam = () => {
    setIsCreatingNewTeam(true);
    setNewTeamData(createEmptyTeamData());
  };

  const handleSaveNewTeam = async () => {
    if (!newTeamData.name.trim()) return;

    try {
      const newTeam = createTeam(
        newTeamData.name.trim(),
        newTeamData.description.trim(),
        newTeamData.defaultTaskTypes,
        newTeamData.icon,
      );

      await addTeam(toStaffTeam(newTeam));
      setIsCreatingNewTeam(false);
      setNewTeamData(createEmptyTeamData());
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  const handleCancelNewTeam = () => {
    setIsCreatingNewTeam(false);
    setNewTeamData(createEmptyTeamData());
  };

  const handleNewTeamDataUpdate = <Field extends keyof TeamDraft>(field: Field, value: TeamDraft[Field]) => {
    setNewTeamData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStartEdit = (field: 'name' | 'description' | 'icon', currentValue: string) => {
    setEditingField(field);
    setTempValue(currentValue);
  };

  const handleSaveEdit = async (teamId: string) => {
    const team = allTeams.find(t => t.id === teamId);
    if (!team || !editingField) return;

    const updatedTeam = {
      ...team,
      [editingField]: tempValue
    };

    await updateTeam(toStaffTeam(updatedTeam));
    setEditingField(null);
    setTempValue('');
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setTempValue('');
  };

  const handleEmojiSelect = (emoji: string): void => {
    if (editingField === 'icon') {
      setTempValue(emoji);
      setShowEmojiPicker(false);
    } else {
      handleNewTeamDataUpdate('icon', emoji);
      setShowEmojiPicker(false);
    }
  };

  const handleTaskTypeSelect = (taskType: string) => {
    if (isCreatingNewTeam) {
      if (!newTeamData.defaultTaskTypes.includes(taskType)) {
        handleNewTeamDataUpdate('defaultTaskTypes', [...newTeamData.defaultTaskTypes, taskType]);
      }
    }
    setShowTaskTypePicker(false);
  };

  const handleTaskTypeRemove = (taskType: string) => {
    if (isCreatingNewTeam) {
      handleNewTeamDataUpdate('defaultTaskTypes',
        newTeamData.defaultTaskTypes.filter(t => t !== taskType)
      );
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    const team = allTeams.find(t => t.id === teamId);
    if (team && window.confirm(`Are you sure you want to delete the team "${team.name}"? All staff members will be unassigned from this team.`)) {
      await removeTeam(teamId);
      if (selectedTeamFilter === teamId) {
        setSelectedTeamFilter('all');
      }
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <div
        className="h-28 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-indigo-900 to-transparent p-2.5">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-white text-base font-semibold flex items-center gap-2">
                <span className="text-base">👥</span>
                Staff Management
              </h2>
              <p className="text-white/90 text-xs mt-0.5">Manage your winery staff</p>
            </div>
          </div>
        </div>
      </div>


      <div className="hidden lg:grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg shadow p-3">
          <div className="text-xs text-gray-600 mb-1">Total Staff</div>
          <div className="text-lg font-semibold text-gray-900">{allStaff.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3">
          <div className="text-xs text-gray-600 mb-1">Total Monthly Wages</div>
          <div className="text-lg font-semibold text-gray-900">{formatNumber(totalWages * WEEKS_PER_MONTH, { currency: true })}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3">
          <div className="text-xs text-gray-600 mb-1">Average Wage</div>
          <div className="text-lg font-semibold text-gray-900">
            {allStaff.length > 0 ? formatNumber(totalWages / allStaff.length, { currency: true }) : formatNumber(0, { currency: true })}
          </div>
        </div>
      </div>

      <div className="lg:hidden grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-gray-900">{allStaff.length}</div>
          <div className="text-xs text-gray-500">Total Staff</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-blue-600">{formatNumber(totalWages * WEEKS_PER_MONTH, { currency: true })}</div>
          <div className="text-xs text-gray-500">Monthly Wages</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-green-600">
            {allStaff.length > 0 ? formatNumber(totalWages / allStaff.length, { currency: true }) : formatNumber(0, { currency: true })}
          </div>
          <div className="text-xs text-gray-500">Avg Wage</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-purple-600">{allTeams.length}</div>
          <div className="text-xs text-gray-500">Teams</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-base font-semibold text-gray-900">{title}</h1>
            <p className="text-xs text-gray-600 mt-0.5">Manage your winery staff and teams</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleStartCreatingTeam}
              disabled={isCreatingNewTeam}
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Team
            </Button>
            <Button
              onClick={() => setShowSearchModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Search className="mr-2 h-4 w-4" />
              Search for Staff
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Filter by Team:</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedTeamFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTeamFilter('all')}
              className="text-xs"
            >
              All Teams ({allStaff.length})
            </Button>
            {allTeams.map(team => (
              <Button
                key={team.id}
                variant={selectedTeamFilter === team.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTeamFilter(team.id)}
                className="text-xs flex items-center gap-1"
              >
                <span>{team.icon}</span>
                {team.name} ({allStaff.filter(s => (s.teamIds || []).includes(team.id)).length})
              </Button>
            ))}
          </div>
        </div>

        {isCreatingNewTeam && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-gray-900">Create New Team</h4>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveNewTeam} disabled={!newTeamData.name.trim()}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelNewTeam}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <TeamIconPicker
                open={showEmojiPicker}
                value={newTeamData.icon}
                onOpenChange={setShowEmojiPicker}
                onSelect={handleEmojiSelect}
              />

              <Input
                value={newTeamData.name}
                onChange={(e) => handleNewTeamDataUpdate('name', e.target.value)}
                placeholder="Team Name"
                className="text-lg font-semibold"
                autoFocus
              />
            </div>

            <Input
              value={newTeamData.description}
              onChange={(e) => handleNewTeamDataUpdate('description', e.target.value)}
              placeholder="Team Description"
              className="text-sm"
            />

            <div className="text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Label className="font-medium">Default Task Types:</Label>
                <TeamTaskTypePicker
                  open={showTaskTypePicker}
                  selectedTaskTypes={newTeamData.defaultTaskTypes}
                  onOpenChange={setShowTaskTypePicker}
                  onSelect={handleTaskTypeSelect}
                  getDisplayName={activity.catalog.getTaskTypeDisplayName}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {newTeamData.defaultTaskTypes.map(taskType => (
                  <Badge
                    key={taskType}
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-red-100"
                    onClick={() => handleTaskTypeRemove(taskType)}
                  >
                    {activity.catalog.getTaskTypeDisplayName(taskType)} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedTeamFilter !== 'all' && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            {(() => {
              const team = allTeams.find(t => t.id === selectedTeamFilter);
              if (!team) return null;

              return (
                <>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {editingField === 'icon' && editingField ? (
                          <TeamIconPicker
                            open={showEmojiPicker}
                            value={tempValue}
                            onOpenChange={setShowEmojiPicker}
                            onSelect={handleEmojiSelect}
                          />
                        ) : (
                          <span
                            className="text-2xl cursor-pointer hover:bg-gray-100 rounded p-1"
                            onClick={() => handleStartEdit('icon', team.icon || '👥')}
                          >
                            {team.icon}
                          </span>
                        )}

                        {editingField === 'name' ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="text-lg font-semibold"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(team.id);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                            <Button size="sm" onClick={() => handleSaveEdit(team.id)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <h4
                            className="text-lg font-semibold cursor-pointer hover:bg-gray-100 rounded p-1"
                            onClick={() => handleStartEdit('name', team.name)}
                          >
                            {team.name}
                          </h4>
                        )}
                      </div>

                      {editingField === 'description' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(team.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <Button size="sm" onClick={() => handleSaveEdit(team.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <p
                          className="text-sm text-gray-600 cursor-pointer hover:bg-gray-100 rounded p-1"
                          onClick={() => handleStartEdit('description', team.description)}
                        >
                          {team.description}
                        </p>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteTeam(team.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="font-medium">Default Task Types:</Label>
                      <TeamTaskTypePicker
                        open={showTaskTypePicker}
                        selectedTaskTypes={team.defaultTaskTypes}
                        onOpenChange={setShowTaskTypePicker}
                        onSelect={async taskType => {
                          const updatedTeam = {
                            ...team,
                            defaultTaskTypes: [...team.defaultTaskTypes, taskType],
                          };
                          await updateTeam(toStaffTeam(updatedTeam));
                        }}
                        getDisplayName={activity.catalog.getTaskTypeDisplayName}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {team.defaultTaskTypes.map(taskType => (
                        <Badge
                          key={taskType}
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-red-100"
                          onClick={async () => {
                            const updatedTeam = {
                              ...team,
                              defaultTaskTypes: team.defaultTaskTypes.filter(t => t !== taskType)
                            };
                            await updateTeam(toStaffTeam(updatedTeam));
                          }}
                        >
                    {activity.catalog.getTaskTypeDisplayName(taskType)} ×
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    {allStaff.filter(s => (s.teamIds || []).includes(team.id)).length} staff member(s) assigned
                  </div>
                </>
              );
            })()}
          </div>
        )}

      </div>


      {filteredStaff.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          {selectedTeamFilter === 'all' ? (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-1">No Staff Members</h3>
              <p className="text-xs text-gray-600 mb-4">Start a staff search to find candidates to hire.</p>
              <Button
                onClick={() => setShowSearchModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Search className="mr-2 h-4 w-4" />
                Search for Your First Employee
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                No Staff in {allTeams.find(t => t.id === selectedTeamFilter)?.name || 'This Team'}
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                This team currently has no assigned staff members.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={() => setSelectedTeamFilter('all')}
                  variant="outline"
                  className="text-xs"
                >
                  View All Staff
                </Button>
                <Button
                  onClick={() => setShowSearchModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Search for Staff
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
            {filteredStaff.map(staff => {
              const skillInfo = getSkillLevelInfo(staff.skillLevel);
              const assignedTaskCount = staffTaskCounts.get(staff.id) ?? 0;
              const taskLabel = totalActiveTasks === 1 ? 'task' : 'tasks';
              const experiencePresentation = getStaffExperiencePresentation(staff);

              return (
                <div
                  key={staff.id}
                  className="bg-white rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleStaffCardClick(staff)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{staff.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-600">{staff.nationality}</span>
                        <Badge variant="outline" className={`text-2xs ${getColorClass(staff.skillLevel)}`}>
                          {skillInfo.name} ({formatNumber(staff.skillLevel * 100, { smartDecimals: true })}%)
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">Teams:</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {(staff.teamIds || []).length > 0 ? (
                            (staff.teamIds || []).map(teamId => {
                              const team = allTeams.find(t => t.id === teamId);
                              return team ? (
                                <Badge key={teamId} variant="secondary" className="text-2xs flex items-center gap-1">
                                  <span>{team.icon}</span>
                                  {team.name}
                                </Badge>
                              ) : null;
                            })
                          ) : (
                            <Badge variant="outline" className="text-2xs">No Teams</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 text-gray-400 hover:text-gray-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTeamAssignment(staff);
                            }}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Assigned to {assignedTaskCount}/{totalActiveTasks} {taskLabel}.
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFireStaff(staff.id);
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Fire
                    </Button>
                  </div>

                  <div className="mb-2">
                    <StaffSkillBarsList staff={staff} />
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Wage:</span> <span className={getWageColorClass(staff.wage, 'weekly')}>{formatNumber(staff.wage, { currency: true })}/wk</span>
                      </div>
                    </div>

                    {staff.specializedRoles.length > 0 && (
                      <div className="flex gap-1">
                        {staff.specializedRoles.map(role => (
                          <Badge key={role} variant="secondary" className="text-2xs bg-amber-100 text-amber-900" title={SPECIALIZED_ROLES[role].description}>
                            {SPECIALIZED_ROLES[role].title}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {experiencePresentation.taskMastery.length > 0 && (
                      <span className="text-2xs text-emerald-700">Task mastery: {experiencePresentation.taskMastery.map(mastery => mastery.label).join(', ')}</span>
                    )}
                  </div>

                  {experiencePresentation.grapeMastery.length > 0 && (
                    <div className="mt-1 text-2xs text-purple-700">
                      Grape mastery: {experiencePresentation.grapeMastery.map(mastery => mastery.label).join(', ')}
                    </div>
                  )}

                  <div className="text-2xs text-gray-500 mt-1">
                    Total XP: {formatNumber(experiencePresentation.totalXP, { decimals: 0 })}
                  </div>

                  <div className="text-2xs text-gray-500 mt-1">
                    Hired: Week {staff.hireDate.week}, {staff.hireDate.season} {staff.hireDate.year}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={showTeamAssignmentDialog} onOpenChange={setShowTeamAssignmentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Teams for {staffForTeamAssignment?.name}</DialogTitle>
            <DialogDescription>
              Assign or remove teams for this staff member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Current Teams:</h4>
              {(staffForTeamAssignment?.teamIds || []).length ? (
                <div className="space-y-1">
                  {(staffForTeamAssignment?.teamIds || []).map(teamId => {
                    const team = allTeams.find(t => t.id === teamId);
                    return team ? (
                      <div key={teamId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <span>{team.icon}</span>
                          <span>{team.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFromTeam(teamId)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Not assigned to any teams</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Available Teams:</h4>
              <div className="space-y-1">
                {allTeams
                  .filter(team => !(staffForTeamAssignment?.teamIds || []).includes(team.id))
                  .map(team => (
                    <Button
                      key={team.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleAssignToTeam(team.id)}
                    >
                      <span className="mr-2">{team.icon}</span>
                      {team.name}
                    </Button>
                  ))}
                {allTeams.filter(team => !(staffForTeamAssignment?.teamIds || []).includes(team.id)).length === 0 && (
                  <p className="text-gray-500 text-sm">All teams assigned</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {activity.ui.renderStaffSearchOptions({
        isOpen: showSearchModal,
        onClose: () => setShowSearchModal(false),
      })}

      <StaffModal
        isOpen={showStaffModal}
        onClose={() => {
          setShowStaffModal(false);
          setSelectedStaff(null);
        }}
        staff={selectedStaff}
        activityApi={activity}
        onFire={handleFireStaff}
      />
    </div>
  );
};

