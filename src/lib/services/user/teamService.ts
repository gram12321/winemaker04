// Team Service
// Business logic for staff team management

import { v4 as uuidv4 } from 'uuid';
import { StaffTeam, WorkCategory } from '@/lib/types/types';
import { getGameState, updateGameState } from '../core/gameState';
import { notificationService } from '@/lib/services';
import { NotificationCategory } from '@/lib/types/types';
import { saveTeamToDb, loadTeamsFromDb, deleteTeamFromDb, saveTeamsToDb } from '@/lib/database/core/teamDB';
import { saveStaffToDb } from '@/lib/database/core/staffDB';

// ===== DEFAULT TEAMS =====

export function getDefaultTeams(): StaffTeam[] {
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
      name: 'Sales Team',
      description: 'Manage your sales force',
      memberIds: [],
      icon: '💼',
      defaultTaskTypes: ['sales']
    }
  ];
}

/**
 * Get team for a specific work category based on default task types
 * Maps WorkCategory enum to task type string (lowercase) and finds matching team
 */
export function getTeamForCategory(category: WorkCategory): StaffTeam | null {
  const teams = getAllTeams();

  // Convert WorkCategory enum to lowercase task type string
  // e.g., WorkCategory.PLANTING -> 'planting'
  const taskType = category.toLowerCase();

  // Find team that has this task type in their defaultTaskTypes
  const matchingTeam = teams.find(team =>
    team.defaultTaskTypes.includes(taskType)
  );

  return matchingTeam || null;
}

// ===== TEAM MANAGEMENT FUNCTIONS =====

/**
 * Create a new team
 */
export function createTeam(
  name: string,
  description: string,
  defaultTaskTypes: string[] = [],
  icon: string = '👥'
): StaffTeam {
  return {
    id: uuidv4(),
    name,
    description,
    memberIds: [],
    icon,
    defaultTaskTypes
  };
}

/**
 * Add a team to the game state and database
 */
export async function addTeam(team: StaffTeam): Promise<StaffTeam> {
  const gameState = getGameState();
  const currentTeams = gameState.teams || [];

  // Check if team name already exists
  const existingTeam = currentTeams.find(t => t.name === team.name);
  if (existingTeam) {
    await notificationService.addMessage('A team with this name already exists', 'teamService.addTeam', 'Team Creation Error', NotificationCategory.SYSTEM);
    throw new Error('Team name already exists');
  }

  // Save to database
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

  // Delete from database
  const success = await deleteTeamFromDb(teamId);
  if (!success) {
    console.error('Failed to delete team from database');
    return false;
  }

  // Remove team assignments from all staff members
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

  // Check if team name already exists (excluding current team)
  const existingTeam = currentTeams.find(t => t.name === updatedTeam.name && t.id !== updatedTeam.id);
  if (existingTeam) {
    await notificationService.addMessage('A team with this name already exists', 'teamService.updateTeam', 'Team Update Error', NotificationCategory.SYSTEM);
    throw new Error('Team name already exists');
  }

  // Save to database
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
export function getAllTeams(): StaffTeam[] {
  return getGameState().teams || [];
}

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

  // Verify team exists
  const team = allTeams.find(t => t.id === teamId);
  if (!team) {
    await notificationService.addMessage('Team not found', 'teamService.assignStaff', 'Staff Assignment Error', NotificationCategory.SYSTEM);
    return false;
  }

  // Check if staff is already assigned to this team
  if (staff.teamIds.includes(teamId)) {
    await notificationService.addMessage('Staff member is already assigned to this team', 'teamService.assignStaff', 'Staff Assignment Error', NotificationCategory.SYSTEM);
    return false;
  }

  // Update teams: add staff to team
  const updatedTeam = {
    ...team,
    memberIds: [...team.memberIds, staffId]
  };

  const updatedTeams = allTeams.map(t =>
    t.id === teamId ? updatedTeam : t
  );

  // Update staff member: add team to their assignments
  const updatedStaffMember = {
    ...staff,
    teamIds: [...staff.teamIds, teamId]
  };

  const updatedStaff = allStaff.map(s =>
    s.id === staffId ? updatedStaffMember : s
  );

  // Persist to database
  const staffSaved = await saveStaffToDb(updatedStaffMember);
  const teamSaved = await saveTeamToDb(updatedTeam);

  if (!staffSaved || !teamSaved) {
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

  // Check if staff is assigned to this team
  if (!staff.teamIds.includes(teamId)) {
    await notificationService.addMessage('Staff member is not assigned to this team', 'teamService.removeStaffFromTeam', 'Staff Removal Error', NotificationCategory.SYSTEM);
    return false;
  }

  // Update teams: remove staff from team
  const updatedTeam = {
    ...team,
    memberIds: team.memberIds.filter(id => id !== staffId)
  };

  const updatedTeams = allTeams.map(t =>
    t.id === teamId ? updatedTeam : t
  );

  // Update staff member: remove team from their assignments
  const updatedStaffMember = {
    ...staff,
    teamIds: staff.teamIds.filter(id => id !== teamId)
  };

  const updatedStaff = allStaff.map(s =>
    s.id === staffId ? updatedStaffMember : s
  );

  // Persist to database
  const staffSaved = await saveStaffToDb(updatedStaffMember);
  const teamSaved = await saveTeamToDb(updatedTeam);

  if (!staffSaved || !teamSaved) {
    console.error('Failed to persist staff-team removal to database');
    await notificationService.addMessage('Failed to save team removal', 'teamService.removeStaffFromTeam', 'Staff Removal Error', NotificationCategory.SYSTEM);
    return false;
  }

  updateGameState({ staff: updatedStaff, teams: updatedTeams });

  await notificationService.addMessage(`${staff.name} removed from ${team.name}`, 'teamService.removeStaffFromTeam', 'Staff Removal', NotificationCategory.STAFF_MANAGEMENT);

  return true;
}

// ===== INITIALIZATION FUNCTIONS =====

/**
 * Initialize teams system with default teams or load from database
 */
export async function initializeTeamsSystem(): Promise<void> {
  try {
    // Try to load teams from database first
    const dbTeams = await loadTeamsFromDb();

    if (dbTeams.length > 0) {
      // Load teams from database
      updateGameState({ teams: dbTeams });
    } else {
      // No teams in database, create default teams
      const defaultTeams = getDefaultTeams();

      // Save default teams to database
      const success = await saveTeamsToDb(defaultTeams);
      if (success) {
        updateGameState({ teams: defaultTeams });
      } else {
        console.error('[Teams] Failed to save default teams to database');
        // Still set in game state even if database save failed
        updateGameState({ teams: defaultTeams });
      }
    }
  } catch (error) {
    console.error('[Teams] Error initializing teams system:', error);
    // Fallback to default teams if database fails
    const defaultTeams = getDefaultTeams();
    updateGameState({ teams: defaultTeams });
  }
}

/**
 * Reset teams to default configuration
 */
export async function resetTeamsToDefault(): Promise<void> {
  const defaultTeams = getDefaultTeams();

  // Clear all team assignments from staff
  const gameState = getGameState();
  const allStaff = gameState.staff || [];
  const updatedStaff = allStaff.map(staff => ({ ...staff, teamIds: [] }));

  updateGameState({
    teams: defaultTeams,
    staff: updatedStaff
  });

  await notificationService.addMessage('Teams reset to default configuration', 'teamService.resetTeamsToDefault', 'Team Reset', NotificationCategory.STAFF_MANAGEMENT);
}

