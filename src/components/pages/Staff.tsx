// Staff Management Page
// Main page for viewing and managing staff members

import React, { useState } from 'react';
import { getAllStaff, removeStaff, getAllTeams, assignStaffToTeam, removeStaffFromTeam, createTeam, addTeam, updateTeam, removeTeam } from '@/lib/services';
import type { Staff } from '@/lib/types/types';
import { formatCurrency, getSpecializationIcon, EMOJI_OPTIONS, getColorClass } from '@/lib/utils';
import { getWageColorClass } from '@/lib/services';
import { getSkillLevelInfo, SPECIALIZED_ROLES } from '@/lib/constants/staffConstants';
import { Button } from '@/components/ui/shadCN/button';
import { Badge } from '@/components/ui/shadCN/badge';
import { StaffSearchOptionsModal } from '@/components/ui/modals/activitymodals/StaffSearchOptionsModal';
import { StaffSearchResultsModal } from '@/components/ui/modals/activitymodals/StaffSearchResultsModal';
import StaffModal from '@/components/ui/modals/UImodals/StaffModal';
import { StaffSkillBarsList } from '@/components/ui/components/StaffSkillBar';
import { Users, Search, Edit3, Plus, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/shadCN/dialog';
import { Label } from '@/components/ui/shadCN/label';
import { Input } from '@/components/ui/shadCN/input';
import { getTaskTypeDisplayName } from '@/lib/constants/activityConstants';
import { WorkCategory } from '@/lib/types/types';

interface StaffPageProps {
  title: string;
}

/**
 * Staff Management Page
 * Displays all staff members with their skills, wages, and management options
 */
export const StaffPage: React.FC<StaffPageProps> = ({ title }) => {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [searchCandidates, setSearchCandidates] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [showTeamAssignmentDialog, setShowTeamAssignmentDialog] = useState(false);
  const [staffForTeamAssignment, setStaffForTeamAssignment] = useState<Staff | null>(null);
  
  // Team management states
  const [isCreatingNewTeam, setIsCreatingNewTeam] = useState(false);
  const [editingField, setEditingField] = useState<'name' | 'description' | 'icon' | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTaskTypePicker, setShowTaskTypePicker] = useState(false);
  const [newTeamData, setNewTeamData] = useState({
    name: '',
    description: '',
    icon: '👥',
    defaultTaskTypes: [] as string[]
  });
  
  const allStaff = getAllStaff();
  const allTeams = getAllTeams();
  const totalWages = allStaff.reduce((sum, staff) => sum + staff.wage, 0);
  
  // Filter staff based on selected team
  const filteredStaff = selectedTeamFilter === 'all' 
    ? allStaff 
    : allStaff.filter(staff => (staff.teamIds || []).includes(selectedTeamFilter));

  // Note: Staff search results are now handled globally by GlobalSearchResultsDisplay
  
  const handleFireStaff = async (staffId: string) => {
    await removeStaff(staffId);
  };

  const handleStaffCardClick = (staff: Staff) => {
    setSelectedStaff(staff);
    setShowStaffModal(true);
  };

  // Handle team assignment
  const handleTeamAssignment = (staff: Staff) => {
    setStaffForTeamAssignment(staff);
    setShowTeamAssignmentDialog(true);
  };

  const handleAssignToTeam = (teamId: string) => {
    if (staffForTeamAssignment) {
      assignStaffToTeam(staffForTeamAssignment.id, teamId);
      setShowTeamAssignmentDialog(false);
      setStaffForTeamAssignment(null);
    }
  };

  const handleRemoveFromTeam = (teamId: string) => {
    if (staffForTeamAssignment) {
      removeStaffFromTeam(staffForTeamAssignment.id, teamId);
      setShowTeamAssignmentDialog(false);
      setStaffForTeamAssignment(null);
    }
  };

  // Team management handlers
  const handleStartCreatingTeam = () => {
    setIsCreatingNewTeam(true);
    setNewTeamData({
      name: '',
      description: '',
      icon: '👥',
      defaultTaskTypes: []
    });
  };

  const handleSaveNewTeam = async () => {
    if (!newTeamData.name.trim()) return;

    try {
      const newTeam = createTeam(
        newTeamData.name.trim(),
        newTeamData.description.trim(),
        newTeamData.defaultTaskTypes,
        newTeamData.icon
      );
      
      await addTeam(newTeam);
      setIsCreatingNewTeam(false);
      setNewTeamData({
        name: '',
        description: '',
        icon: '👥',
        defaultTaskTypes: []
      });
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  const handleCancelNewTeam = () => {
    setIsCreatingNewTeam(false);
    setNewTeamData({
      name: '',
      description: '',
      icon: '👥',
      defaultTaskTypes: []
    });
  };

  const handleNewTeamDataUpdate = (field: keyof typeof newTeamData, value: any) => {
    setNewTeamData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Inline editing handlers
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

    await updateTeam(updatedTeam);
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
      // For new team creation
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
  
  // Render skill bars for a staff member
  const renderSkillBars = (staff: Staff) => (
    <StaffSkillBarsList staff={staff} />
  );
  
  return (
    <div className="space-y-3 text-sm">
      {/* Banner */}
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


      {/* Stats - Desktop/Tablet (hidden on mobile) */}
      <div className="hidden lg:grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg shadow p-3">
          <div className="text-xs text-gray-600 mb-1">Total Staff</div>
          <div className="text-lg font-semibold text-gray-900">{allStaff.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3">
          <div className="text-xs text-gray-600 mb-1">Total Monthly Wages</div>
          <div className="text-lg font-semibold text-gray-900">{formatCurrency(totalWages * 4)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3">
          <div className="text-xs text-gray-600 mb-1">Average Wage</div>
          <div className="text-lg font-semibold text-gray-900">
            {allStaff.length > 0 ? formatCurrency(totalWages / allStaff.length) : formatCurrency(0)}
          </div>
        </div>
      </div>

      {/* Stats - Mobile (2x2 grid) */}
      <div className="lg:hidden grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-gray-900">{allStaff.length}</div>
          <div className="text-xs text-gray-500">Total Staff</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-blue-600">{formatCurrency(totalWages * 4)}</div>
          <div className="text-xs text-gray-500">Monthly Wages</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-green-600">
            {allStaff.length > 0 ? formatCurrency(totalWages / allStaff.length) : formatCurrency(0)}
          </div>
          <div className="text-xs text-gray-500">Avg Wage</div>
        </div>
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="text-base font-bold text-purple-600">{allTeams.length}</div>
          <div className="text-xs text-gray-500">Teams</div>
        </div>
      </div>

      {/* Team Management Section */}
      <div className="bg-white rounded-lg border p-4 space-y-4">
        {/* Header */}
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

        {/* Team Filter */}
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

          {/* New Team Creation */}
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

              {/* New Team Header */}
              <div className="flex items-center gap-2 mb-1">
                <Dialog open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-2xl p-1">
                      {newTeamData.icon}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Select Icon</DialogTitle>
                      <DialogDescription>Choose an emoji icon for your team</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-6 gap-2">
                      {EMOJI_OPTIONS.map(emoji => (
                        <Button
                          key={emoji}
                          variant="outline"
                          size="sm"
                          className="text-2xl p-2"
                          onClick={() => handleEmojiSelect(emoji)}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
                
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

              {/* New Team Task Types */}
              <div className="text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Label className="font-medium">Default Task Types:</Label>
                  <Dialog open={showTaskTypePicker} onOpenChange={setShowTaskTypePicker}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0">
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Select Task Types</DialogTitle>
                        <DialogDescription>Choose which task types this team will handle</DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.values(WorkCategory).map(category => {
                          const taskType = category.toLowerCase();
                          return (
                            <Button
                              key={taskType}
                              variant={newTeamData.defaultTaskTypes.includes(taskType) ? "default" : "outline"}
                              size="sm"
                              className="justify-start"
                              onClick={() => handleTaskTypeSelect(taskType)}
                              disabled={newTeamData.defaultTaskTypes.includes(taskType)}
                            >
                              {getTaskTypeDisplayName(taskType)}
                            </Button>
                          );
                        })}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-wrap gap-1">
                  {newTeamData.defaultTaskTypes.map(taskType => (
                    <Badge 
                      key={taskType} 
                      variant="outline" 
                      className="text-xs cursor-pointer hover:bg-red-100"
                      onClick={() => handleTaskTypeRemove(taskType)}
                    >
                      {getTaskTypeDisplayName(taskType)} ×
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

        {/* Selected Team Details */}
        {selectedTeamFilter !== 'all' && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            {(() => {
              const team = allTeams.find(t => t.id === selectedTeamFilter);
              if (!team) return null;
              
              return (
                <>
                  {/* Team Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {editingField === 'icon' && editingField ? (
                          <Dialog open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-2xl p-1">
                                {tempValue}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Select Icon</DialogTitle>
                                <DialogDescription>Choose an emoji icon for your team</DialogDescription>
                              </DialogHeader>
                              <div className="grid grid-cols-6 gap-2">
                                {EMOJI_OPTIONS.map(emoji => (
                                  <Button
                                    key={emoji}
                                    variant="outline"
                                    size="sm"
                                    className="text-2xl p-2"
                                    onClick={() => handleEmojiSelect(emoji)}
                                  >
                                    {emoji}
                                  </Button>
                                ))}
                              </div>
                            </DialogContent>
                          </Dialog>
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

                  {/* Team Task Types */}
                  <div className="text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="font-medium">Default Task Types:</Label>
                      <Dialog open={showTaskTypePicker} onOpenChange={setShowTaskTypePicker}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0">
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Select Task Types</DialogTitle>
                            <DialogDescription>Choose which task types this team will handle</DialogDescription>
                          </DialogHeader>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.values(WorkCategory).map(category => {
                              const taskType = category.toLowerCase();
                              return (
                                <Button
                                  key={taskType}
                                  variant={team.defaultTaskTypes.includes(taskType) ? "default" : "outline"}
                                  size="sm"
                                  className="justify-start"
                                  onClick={async () => {
                                    if (!team.defaultTaskTypes.includes(taskType)) {
                                      const updatedTeam = {
                                        ...team,
                                        defaultTaskTypes: [...team.defaultTaskTypes, taskType]
                                      };
                                      await updateTeam(updatedTeam);
                                    }
                                  }}
                                  disabled={team.defaultTaskTypes.includes(taskType)}
                                >
                                  {getTaskTypeDisplayName(taskType)}
                                </Button>
                              );
                            })}
                          </div>
                        </DialogContent>
                      </Dialog>
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
                            await updateTeam(updatedTeam);
                          }}
                        >
                          {getTaskTypeDisplayName(taskType)} ×
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Team Stats */}
                  <div className="text-xs text-gray-500">
                    {allStaff.filter(s => (s.teamIds || []).includes(team.id)).length} staff member(s) assigned
                  </div>
                </>
              );
            })()}
          </div>
        )}

      </div>
      
      {/* Staff Content */}
      
      {/* Staff List */}
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
              
              return (
                <div
                  key={staff.id}
                  className="bg-white rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleStaffCardClick(staff)}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{staff.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-600">{staff.nationality}</span>
                        <Badge variant="outline" className={`text-2xs ${getColorClass(staff.skillLevel)}`}>
                          {skillInfo.name} ({Math.round(staff.skillLevel * 100)}%)
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
                  
                  {/* Skills */}
                  <div className="mb-2">
                    {renderSkillBars(staff)}
                  </div>
                  
                  {/* Footer */}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Wage:</span> <span className={getWageColorClass(staff.wage, 'weekly')}>{formatCurrency(staff.wage)}/wk</span>
                      </div>
                    </div>
                    
                    {staff.specializations.length > 0 && (
                      <div className="flex gap-1">
                        {staff.specializations.map(spec => (
                          <Badge key={spec} variant="secondary" className="text-2xs flex items-center gap-1">
                            <span>{getSpecializationIcon(spec)}</span>
                            <span>{SPECIALIZED_ROLES[spec]?.title || spec}</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Hire Date */}
                  <div className="text-2xs text-gray-500 mt-1">
                    Hired: Week {staff.hireDate.week}, {staff.hireDate.season} {staff.hireDate.year}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team Assignment Dialog */}
      <Dialog open={showTeamAssignmentDialog} onOpenChange={setShowTeamAssignmentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Teams for {staffForTeamAssignment?.name}</DialogTitle>
            <DialogDescription>
              Assign or remove teams for this staff member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current Teams */}
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
            
            {/* Available Teams */}
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
      
      {/* Staff Search Options Modal */}
      <StaffSearchOptionsModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSearchStarted={() => {
          // Modal auto-closes, results will show when search completes
        }}
      />

      {/* Staff Search Results Modal */}
      <StaffSearchResultsModal
        isOpen={showResultsModal}
        onClose={() => {
          setShowResultsModal(false);
          setSearchCandidates([]);
        }}
        candidates={searchCandidates}
      />

      {/* Staff Detail Modal */}
      <StaffModal
        isOpen={showStaffModal}
        onClose={() => {
          setShowStaffModal(false);
          setSelectedStaff(null);
        }}
        staff={selectedStaff}
        onFire={handleFireStaff}
      />
    </div>
  );
};

