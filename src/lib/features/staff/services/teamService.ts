
import { v4 as uuidv4 } from 'uuid';
import { StaffTeam } from '@/lib/types/types';
import { getGameState, updateGameState } from '@/lib/services/core/gameState';
import { notificationService } from '@/lib/services/core/notificationService';
import { NotificationCategory } from '@/lib/types/types';
import { saveTeamToDb, loadTeamsFromDb, deleteTeamAndStaffAssignmentsFromDb, saveTeamsToDb, setStaffTeamMembershipInDb } from '@/lib/database/core/teamDB';


function getDefaultTeams(): StaffTeam[] {
  return [
    {
      id: uuidv4(),
      name: 'Administration & Research Team',
      description: 'Handle company administration, research, and paperwork',
      memberIds: [],
      icon: '📊',
      defaultTaskTypes: ['administration_and_research']
    },
    {
      id: uuidv4(),
      name: 'Finance & HR Team',
      description: 'Manage company finances and human resources',
      memberIds: [],
      icon: '💰',
      defaultTaskTypes: ['finance_and_staff', 'staff_search', 'staff_hiring', 'land_search', 'lender_search', 'take_loan']
    },
    {
      id: uuidv4(),
      name: 'Vineyard Team',
      description: 'Coordinate vineyard operations',
      memberIds: [],
      icon: '🍇',
      defaultTaskTypes: ['planting', 'harvesting', 'clearing', 'uprooting']
    },
    {
      id: uuidv4(),
      name: 'Winery Team',
      description: 'Oversee winery processes',
      memberIds: [],
      icon: '🍷',
      defaultTaskTypes: ['crushing', 'fermentation']
    },
    {
      id: uuidv4(),
      name: 'Maintenance Team',
      description: 'Maintain cellar equipment and facilities',
      memberIds: [],
      icon: '🔧',
      defaultTaskTypes: ['maintenance']
    },
    {
      id: uuidv4(),
      name: 'Sales Team',
      description: 'Manage your sales force',
      memberIds: [],
      icon: '💼',
      defaultTaskTypes: ['sales']
    }
  ];
}

function upgradeDefaultMaintenanceTeam(teams: StaffTeam[]): StaffTeam[] {
  let changed = false;
  const updatedTeams = teams.map((team) => {
    const isDefaultWineryTeam = team.name === 'Winery Team'
      && (team.defaultTaskTypes.includes('crushing') || team.defaultTaskTypes.includes('fermentation'));
    if (!isDefaultWineryTeam || !team.defaultTaskTypes.includes('maintenance')) return team;
    changed = true;
    return { ...team, defaultTaskTypes: team.defaultTaskTypes.filter((taskType) => taskType !== 'maintenance') };
  });

  const maintenanceTeam = updatedTeams.find((team) => team.name === 'Maintenance Team');
  if (!maintenanceTeam) {
    return [
      ...updatedTeams,
      {
        id: uuidv4(),
        name: 'Maintenance Team',
        description: 'Maintain cellar equipment and facilities',
        memberIds: [],
        icon: '🔧',
        defaultTaskTypes: ['maintenance'],
      },
    ];
  }
  if (!maintenanceTeam.defaultTaskTypes.includes('maintenance')) {
    return updatedTeams.map((team) => team.id === maintenanceTeam.id
      ? { ...team, defaultTaskTypes: [...team.defaultTaskTypes, 'maintenance'] }
      : team);
  }

  return changed ? updatedTeams : teams;
}

/**
 * Get team for a specific work category based on default task types
 * Maps WorkCategory enum to task type string (lowercase) and finds matching team
 */

/**
 * Create a new team
 */

/**
 * Add a team to the game state and database
 */
export async function addTeam(team: StaffTeam): Promise<StaffTeam> {
  const gameState = getGameState();
  const currentTeams = gameState.teams || [];

  const existingTeam = currentTeams.find(t => t.name === team.name);
  if (existingTeam) {
    await notificationService.addMessage('A team with this name already exists', 'teamService.addTeam', 'Team Creation Error', NotificationCategory.SYSTEM);
    throw new Error('Team name already exists');
  }

  const success = await saveTeamToDb(team);
  if (!success) {
    console.error('Failed to save team to database');
    throw new Error('Failed to save team to database');
  }

  const updatedTeams = [...currentTeams, team];
  updateGameState({ teams: updatedTeams });

  await notificationService.addMessage(`Team "${team.name}" has been created!`, 'teamService.createTeam', 'Team Creation', NotificationCategory.STAFF_MANAGEMENT);
  return team;
}

/**
 * Remove a team from the game state and database
 */
export async function removeTeam(teamId: string): Promise<boolean> {
  const gameState = getGameState();
  const currentTeams = gameState.teams || [];
  const team = currentTeams.find(t => t.id === teamId);

  if (!team) {
    await notificationService.addMessage('Team not found', 'teamService.removeTeam', 'Team Deletion Error', NotificationCategory.SYSTEM);
    return false;
  }

  const success = await deleteTeamAndStaffAssignmentsFromDb(teamId);
  if (!success) {
    console.error('Failed to delete team from database');
    return false;
  }

  const allStaff = gameState.staff || [];
  const updatedStaff = allStaff.map(staff =>
    staff.teamIds.includes(teamId) ? { ...staff, teamIds: staff.teamIds.filter(id => id !== teamId) } : staff
  );

  const updatedTeams = currentTeams.filter(t => t.id !== teamId);
  updateGameState({ teams: updatedTeams, staff: updatedStaff });

  await notificationService.addMessage(`Team "${team.name}" has been deleted`, 'teamService.removeTeam', 'Team Deletion', NotificationCategory.STAFF_MANAGEMENT);
  return true;
}

/**
 * Update an existing team
 */
export async function updateTeam(updatedTeam: StaffTeam): Promise<StaffTeam> {
  const gameState = getGameState();
  const currentTeams = gameState.teams || [];

  const teamIndex = currentTeams.findIndex(t => t.id === updatedTeam.id);
  if (teamIndex === -1) {
    await notificationService.addMessage('Team not found', 'teamService.updateTeam', 'Team Update Error', NotificationCategory.SYSTEM);
    throw new Error('Team not found');
  }

  const existingTeam = currentTeams.find(t => t.name === updatedTeam.name && t.id !== updatedTeam.id);
  if (existingTeam) {
    await notificationService.addMessage('A team with this name already exists', 'teamService.updateTeam', 'Team Update Error', NotificationCategory.SYSTEM);
    throw new Error('Team name already exists');
  }

  const success = await saveTeamToDb(updatedTeam);
  if (!success) {
    console.error('Failed to update team in database');
    throw new Error('Failed to update team in database');
  }

  const updatedTeams = [...currentTeams];
  updatedTeams[teamIndex] = updatedTeam;
  updateGameState({ teams: updatedTeams });

  await notificationService.addMessage(`Team "${updatedTeam.name}" has been updated!`, 'teamService.updateTeam', 'Team Update', NotificationCategory.STAFF_MANAGEMENT);
  return updatedTeam;
}

/**
 * Get all teams
 */

/**
 * Assign a staff member to a team
 */
export async function assignStaffToTeam(staffId: string, teamId: string): Promise<boolean> {
  const gameState = getGameState();
  const allStaff = gameState.staff || [];
  const allTeams = gameState.teams || [];

  const staff = allStaff.find(s => s.id === staffId);
  if (!staff) {
    await notificationService.addMessage('Staff member not found', 'teamService.assignStaff', 'Staff Assignment Error', NotificationCategory.SYSTEM);
    return false;
  }

  const team = allTeams.find(t => t.id === teamId);
  if (!team) {
    await notificationService.addMessage('Team not found', 'teamService.assignStaff', 'Staff Assignment Error', NotificationCategory.SYSTEM);
    return false;
  }

  const assignedInStaff = staff.teamIds.includes(teamId);
  const assignedInTeam = team.memberIds.includes(staffId);
  if (assignedInStaff && assignedInTeam) {
    await notificationService.addMessage('Staff member is already assigned to this team', 'teamService.assignStaff', 'Staff Assignment Error', NotificationCategory.SYSTEM);
    return false;
  }

  const updatedTeam = {
    ...team,
    memberIds: [...new Set([...team.memberIds, staffId])]
  };

  const updatedTeams = allTeams.map(t =>
    t.id === teamId ? updatedTeam : t
  );

  const updatedStaffMember = {
    ...staff,
    teamIds: [...new Set([...staff.teamIds, teamId])]
  };

  const updatedStaff = allStaff.map(s =>
    s.id === staffId ? updatedStaffMember : s
  );

  if (!await setStaffTeamMembershipInDb(staffId, teamId, true)) {
    console.error('Failed to persist staff-team assignment to database');
    await notificationService.addMessage('Failed to save team assignment', 'teamService.assignStaff', 'Staff Assignment Error', NotificationCategory.SYSTEM);
    return false;
  }

  updateGameState({ staff: updatedStaff, teams: updatedTeams });

  return true;
}

/**
 * Remove a staff member from a team
 */
export async function removeStaffFromTeam(staffId: string, teamId: string): Promise<boolean> {
  const gameState = getGameState();
  const allStaff = gameState.staff || [];
  const allTeams = gameState.teams || [];

  const staff = allStaff.find(s => s.id === staffId);
  if (!staff) {
    await notificationService.addMessage('Staff member not found', 'teamService.removeStaffFromTeam', 'Staff Removal Error', NotificationCategory.SYSTEM);
    return false;
  }

  const team = allTeams.find(t => t.id === teamId);
  if (!team) {
    await notificationService.addMessage('Team not found', 'teamService.removeStaffFromTeam', 'Staff Removal Error', NotificationCategory.SYSTEM);
    return false;
  }

  if (!staff.teamIds.includes(teamId) && !team.memberIds.includes(staffId)) {
    await notificationService.addMessage('Staff member is not assigned to this team', 'teamService.removeStaffFromTeam', 'Staff Removal Error', NotificationCategory.SYSTEM);
    return false;
  }

  const updatedTeam = {
    ...team,
    memberIds: team.memberIds.filter(id => id !== staffId)
  };

  const updatedTeams = allTeams.map(t =>
    t.id === teamId ? updatedTeam : t
  );

  const updatedStaffMember = {
    ...staff,
    teamIds: staff.teamIds.filter(id => id !== teamId)
  };

  const updatedStaff = allStaff.map(s =>
    s.id === staffId ? updatedStaffMember : s
  );

  if (!await setStaffTeamMembershipInDb(staffId, teamId, false)) {
    console.error('Failed to persist staff-team removal to database');
    await notificationService.addMessage('Failed to save team removal', 'teamService.removeStaffFromTeam', 'Staff Removal Error', NotificationCategory.SYSTEM);
    return false;
  }

  updateGameState({ staff: updatedStaff, teams: updatedTeams });

  await notificationService.addMessage(`${staff.name} removed from ${team.name}`, 'teamService.removeStaffFromTeam', 'Staff Removal', NotificationCategory.STAFF_MANAGEMENT);

  return true;
}


/**
 * Initialize teams system with default teams or load from database
 */
export async function initializeTeamsSystem(): Promise<void> {
  try {
    const dbTeams = await loadTeamsFromDb();

    if (dbTeams.length > 0) {
      // Move the built-in Maintenance task class off Winery and into its own team.
      const teams = upgradeDefaultMaintenanceTeam(dbTeams);
      if (teams !== dbTeams) await saveTeamsToDb(teams);
      updateGameState({ teams });
    } else {
      const defaultTeams = getDefaultTeams();

      const success = await saveTeamsToDb(defaultTeams);
      if (success) {
        updateGameState({ teams: defaultTeams });
      } else {
        console.error('[Teams] Failed to save default teams to database');
        updateGameState({ teams: defaultTeams });
      }
    }
  } catch (error) {
    console.error('[Teams] Error initializing teams system:', error);
    const defaultTeams = getDefaultTeams();
    updateGameState({ teams: defaultTeams });
  }
}

/**
 * Reset teams to default configuration
 */

