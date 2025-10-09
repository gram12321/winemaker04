import React, { useState, useMemo } from 'react';
import { WorkCategory } from '@/lib/types/types';
import { getAllTeams, createTeam, addTeam, removeTeam, updateTeam, assignStaffToTeam, getAllStaff } from '@/lib/services';
import { getTaskTypeDisplayName } from '@/lib/constants/activityConstants';
import { getStaffRoleDisplayName } from '@/lib/constants/staffConstants';
import { Button } from '@/components/ui/shadCN/button';
import { Badge } from '@/components/ui/shadCN/badge';
import { Input } from '@/components/ui/shadCN/input';
import { Label } from '@/components/ui/shadCN/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/shadCN/dialog';
import { Trash2, Plus, Users, Check, X, Edit3 } from 'lucide-react';

// Emoji options for team icons
const EMOJI_OPTIONS = [
  '📊', '🔧', '🍇', '🍷', '💼', '👥', '🌟', '⚡', '🎯', '🚀', 
  '💡', '🔥', '⭐', '🎪', '🏆', '🎨', '🎵', '🎮', '📱', '💻',
  '🏢', '🏭', '🌍', '🌱', '🌿', '🍃', '🌺', '🌻', '🌸', '🌷'
];

interface TeamManagementProps {
  className?: string;
  defaultSelectedTeamId?: string;
}

/**
 * Team Management Component
 * Allows users to view, create, edit, and manage staff teams
 */
export const TeamManagement: React.FC<TeamManagementProps> = ({ className, defaultSelectedTeamId }) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(defaultSelectedTeamId || null);
  const [editingField, setEditingField] = useState<'name' | 'description' | 'icon' | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTaskTypePicker, setShowTaskTypePicker] = useState(false);
  const [showNewTeamEmojiPicker, setShowNewTeamEmojiPicker] = useState(false);
  const [showNewTeamTaskTypePicker, setShowNewTeamTaskTypePicker] = useState(false);
  const [isCreatingNewTeam, setIsCreatingNewTeam] = useState(false);
  const [newTeamData, setNewTeamData] = useState({
    name: '',
    description: '',
    icon: '👥',
    defaultTaskTypes: [] as string[]
  });

  const teams = getAllTeams();
  const allStaff = getAllStaff();
  const selectedTeam = selectedTeamId ? teams.find(t => t.id === selectedTeamId) : null;
  
  // Set default selected team if provided and not already set
  React.useEffect(() => {
    if (defaultSelectedTeamId && !selectedTeamId && teams.length > 0) {
      setSelectedTeamId(defaultSelectedTeamId);
    }
  }, [defaultSelectedTeamId, selectedTeamId, teams.length]);
  
  // Get staff in selected team
  const getStaffInTeam = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return [];
    return allStaff.filter(staff => team.memberIds.includes(staff.id));
  };


  // Handle team selection
  const handleTeamSelect = (teamId: string) => {
    setSelectedTeamId(teamId);
    setEditingField(null);
  };

  // Handle starting inline edit
  const handleStartEdit = (field: 'name' | 'description' | 'icon', currentValue: string) => {
    setEditingField(field);
    setTempValue(currentValue);
  };

  // Handle saving inline edit
  const handleSaveEdit = () => {
    if (!selectedTeam || !editingField) return;

    const updatedTeam = {
      ...selectedTeam,
      [editingField]: tempValue
    };

    updateTeam(updatedTeam);
    setEditingField(null);
    setTempValue('');
  };

  // Handle canceling inline edit
  const handleCancelEdit = () => {
    setEditingField(null);
    setTempValue('');
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    if (!selectedTeam) return;
    
    const updatedTeam = {
      ...selectedTeam,
      icon: emoji
    };

    updateTeam(updatedTeam);
    setShowEmojiPicker(false);
  };

  // Handle task type selection
  const handleTaskTypeSelect = (taskType: string) => {
    if (!selectedTeam) return;
    
    if (!selectedTeam.defaultTaskTypes.includes(taskType)) {
      const updatedTeam = {
        ...selectedTeam,
        defaultTaskTypes: [...selectedTeam.defaultTaskTypes, taskType]
      };
      updateTeam(updatedTeam);
    }
    setShowTaskTypePicker(false);
  };

  // Handle task type removal
  const handleTaskTypeRemove = (taskType: string) => {
    if (!selectedTeam) return;
    
    const updatedTeam = {
      ...selectedTeam,
      defaultTaskTypes: selectedTeam.defaultTaskTypes.filter(t => t !== taskType)
    };
    updateTeam(updatedTeam);
  };

  // Handle start creating new team
  const handleStartCreatingTeam = () => {
    setIsCreatingNewTeam(true);
    setNewTeamData({
      name: '',
      description: '',
      icon: '👥',
      defaultTaskTypes: []
    });
    setSelectedTeamId(null); // Deselect current team
  };

  // Handle save new team
  const handleSaveNewTeam = () => {
    if (!newTeamData.name.trim()) return;

    try {
      const newTeam = createTeam(
        newTeamData.name.trim(),
        newTeamData.description.trim(),
        newTeamData.defaultTaskTypes,
        newTeamData.icon
      );
      
      addTeam(newTeam);
      setIsCreatingNewTeam(false);
      setSelectedTeamId(newTeam.id); // Select the newly created team
      setShowNewTeamEmojiPicker(false);
      setShowNewTeamTaskTypePicker(false);
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  // Handle cancel new team creation
  const handleCancelNewTeam = () => {
    setIsCreatingNewTeam(false);
    setNewTeamData({
      name: '',
      description: '',
      icon: '👥',
      defaultTaskTypes: []
    });
    setShowNewTeamEmojiPicker(false);
    setShowNewTeamTaskTypePicker(false);
  };

  // Handle new team data update
  const handleNewTeamDataUpdate = (field: keyof typeof newTeamData, value: any) => {
    setNewTeamData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  // Handle assign staff to team
  const handleAssignStaff = (staffId: string, teamId: string | null) => {
    assignStaffToTeam(staffId, teamId);
  };

  // Handle remove staff from team
  const handleRemoveStaffFromTeam = (staffId: string) => {
    if (selectedTeam) {
      assignStaffToTeam(staffId, null);
    }
  };

  // Memoize task type options from WorkCategory enum
  const taskTypeOptions = useMemo(() => 
    Object.values(WorkCategory).map(cat => cat.toLowerCase()),
    []
  );
  
  // Memoize unassigned staff to avoid recalculation on every render
  const unassignedStaff = useMemo(() => 
    allStaff.filter(staff => !staff.teamId),
    [allStaff]
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Team Management</h2>
        <Button 
          size="sm" 
          className="bg-blue-600 hover:bg-blue-700" 
          onClick={handleStartCreatingTeam}
          disabled={isCreatingNewTeam}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Team
        </Button>
      </div>

      {/* Team Selection */}
      <div className="flex flex-wrap gap-2">
        {teams.map(team => (
          <Button
            key={team.id}
            variant={selectedTeamId === team.id ? "default" : "outline"}
            size="sm"
            onClick={() => handleTeamSelect(team.id)}
            className="flex items-center gap-2"
          >
            <span>{team.icon}</span>
            <span>{team.name}</span>
            <Badge variant="secondary" className="ml-1">
              {team.memberIds.length}
            </Badge>
          </Button>
        ))}
      </div>

      {/* New Team Creation */}
      {isCreatingNewTeam && (
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Create New Team</h3>
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
            <Dialog open={showNewTeamEmojiPicker} onOpenChange={setShowNewTeamEmojiPicker}>
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
                      onClick={() => {
                        handleNewTeamDataUpdate('icon', emoji);
                        setShowNewTeamEmojiPicker(false);
                      }}
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
              <Dialog open={showNewTeamTaskTypePicker} onOpenChange={setShowNewTeamTaskTypePicker}>
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
                    {taskTypeOptions.map(taskType => (
                      <Button
                        key={taskType}
                        variant={newTeamData.defaultTaskTypes.includes(taskType) ? "default" : "outline"}
                        size="sm"
                        className="justify-start"
                        onClick={() => {
                          if (!newTeamData.defaultTaskTypes.includes(taskType)) {
                            handleNewTeamDataUpdate('defaultTaskTypes', [...newTeamData.defaultTaskTypes, taskType]);
                          }
                        }}
                        disabled={newTeamData.defaultTaskTypes.includes(taskType)}
                      >
                        {getTaskTypeDisplayName(taskType)}
                      </Button>
                    ))}
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
                  onClick={() => {
                    handleNewTeamDataUpdate('defaultTaskTypes', 
                      newTeamData.defaultTaskTypes.filter(t => t !== taskType)
                    );
                  }}
                >
                  {getTaskTypeDisplayName(taskType)} ×
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Team Details */}
      {selectedTeam ? (
        <div className="bg-white rounded-lg border p-4 space-y-4">
          {/* Team Header */}
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {editingField === 'icon' ? (
                  <Dialog open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-2xl p-1">
                        {selectedTeam.icon}
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
                    onClick={() => handleStartEdit('icon', selectedTeam.icon || '👥')}
                  >
                    {selectedTeam.icon}
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
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <h3 
                    className="text-lg font-semibold cursor-pointer hover:bg-gray-100 rounded p-1"
                    onClick={() => handleStartEdit('name', selectedTeam.name)}
                  >
                    {selectedTeam.name}
                  </h3>
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
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p 
                  className="text-sm text-gray-600 cursor-pointer hover:bg-gray-100 rounded p-1"
                  onClick={() => handleStartEdit('description', selectedTeam.description)}
                >
                  {selectedTeam.description}
                </p>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete the team "${selectedTeam.name}"? All staff members will be unassigned from this team.`)) {
                  removeTeam(selectedTeam.id);
                  setSelectedTeamId(null);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Team Configuration */}
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
                    {taskTypeOptions.map(taskType => (
                      <Button
                        key={taskType}
                        variant={selectedTeam.defaultTaskTypes.includes(taskType) ? "default" : "outline"}
                        size="sm"
                        className="justify-start"
                        onClick={() => handleTaskTypeSelect(taskType)}
                        disabled={selectedTeam.defaultTaskTypes.includes(taskType)}
                      >
                        {getTaskTypeDisplayName(taskType)}
                      </Button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedTeam.defaultTaskTypes.map(taskType => (
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

          {/* Team Members */}
          <div>
            <Label className="font-medium">Team Members ({selectedTeam.memberIds.length})</Label>
            <div className="mt-2 space-y-2">
              {getStaffInTeam(selectedTeam.id).map(staff => (
                <div key={staff.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium text-sm">{staff.name}</div>
                    <div className="text-xs text-gray-600">
                      {getStaffRoleDisplayName(staff.specializations)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveStaffFromTeam(staff.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {getStaffInTeam(selectedTeam.id).length === 0 && (
                <p className="text-sm text-gray-500 italic">No members in this team</p>
              )}
            </div>
          </div>

          {/* Available Staff */}
          <div>
            <Label className="font-medium">Available Staff ({unassignedStaff.length})</Label>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {unassignedStaff.map(staff => (
                <div key={staff.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium text-sm">{staff.name}</div>
                    <div className="text-xs text-gray-600">
                      {getStaffRoleDisplayName(staff.specializations)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAssignStaff(staff.id, selectedTeam.id)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {unassignedStaff.length === 0 && (
                <p className="text-sm text-gray-500 italic">No available staff</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-8 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Team</h3>
          <p className="text-sm text-gray-600">
            Choose a team from the list above to view and manage its members
          </p>
        </div>
      )}

    </div>
  );
};
