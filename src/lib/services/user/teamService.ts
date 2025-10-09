// Team Service
// Business logic for staff team management

import { v4 as uuidv4 } from 'uuid';
import { StaffTeam, WorkCategory } from '@/lib/types/types';
import { getGameState, updateGameState } from '../core/gameState';
import { notificationService } from '@/components/layout/NotificationCenter';
import { saveTeamToDb, loadTeamsFromDb, deleteTeamFromDb, saveTeamsToDb } from '@/lib/database/core/teamDB';

// ===== DEFAULT TEAMS =====

export function getDefaultTeams(): StaffTeam[] {
  return [
    {
      id: uuidv4(),
      name: 'Administration Team',
      description: 'Handle company administration and paperwork',
      memberIds: [],
      icon: '📊',
      defaultTaskTypes: ['administration']
    },
    {
      id: uuidv4(),
      name: 'Building & Maintenance Team',
      description: 'Maintain and upgrade facilities',
      memberIds: [],
      icon: '🔧',
      defaultTaskTypes: ['maintenance', 'building', 'upgrading']
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
    notificationService.error('A team with this name already exists');
    throw new Error('Team name already exists');
  }
  
  // Save to database
  const success = await saveTeamToDb(team);
  if (!success) {
    notificationService.error('Failed to save team to database');
    throw new Error('Failed to save team to database');
  }
  
  const updatedTeams = [...currentTeams, team];
  updateGameState({ teams: updatedTeams });
  
  notificationService.success(`Team "${team.name}" has been created!`);
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
    notificationService.error('Team not found');
    return false;
  }
  
  // Delete from database
  const success = await deleteTeamFromDb(teamId);
  if (!success) {
    notificationService.error('Failed to delete team from database');
    return false;
  }
  
  // Remove team assignments from all staff members
  const allStaff = gameState.staff || [];
  const updatedStaff = allStaff.map(staff => 
    staff.teamId === teamId ? { ...staff, teamId: null } : staff
  );
  
  const updatedTeams = currentTeams.filter(t => t.id !== teamId);
  updateGameState({ teams: updatedTeams, staff: updatedStaff });
  
  notificationService.info(`Team "${team.name}" has been deleted`);
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
    notificationService.error('Team not found');
    throw new Error('Team not found');
  }
  
  // Check if team name already exists (excluding current team)
  const existingTeam = currentTeams.find(t => t.name === updatedTeam.name && t.id !== updatedTeam.id);
  if (existingTeam) {
    notificationService.error('A team with this name already exists');
    throw new Error('Team name already exists');
  }
  
  // Save to database
  const success = await saveTeamToDb(updatedTeam);
  if (!success) {
    notificationService.error('Failed to update team in database');
    throw new Error('Failed to update team in database');
  }
  
  const updatedTeams = [...currentTeams];
  updatedTeams[teamIndex] = updatedTeam;
  updateGameState({ teams: updatedTeams });
  
  notificationService.success(`Team "${updatedTeam.name}" has been updated!`);
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
export function assignStaffToTeam(staffId: string, teamId: string | null): boolean {
  const gameState = getGameState();
  const allStaff = gameState.staff || [];
  const allTeams = gameState.teams || [];
  
  const staff = allStaff.find(s => s.id === staffId);
  if (!staff) {
    notificationService.error('Staff member not found');
    return false;
  }
  
  // If assigning to a team, verify team exists
  if (teamId && !allTeams.find(t => t.id === teamId)) {
    notificationService.error('Team not found');
    return false;
  }
  
  // Update teams: remove staff from old team, add to new team
  const updatedTeams = allTeams.map(team => {
    // Remove from current team
    if (team.id === staff.teamId) {
      return {
        ...team,
        memberIds: team.memberIds.filter(id => id !== staffId)
      };
    }
    // Add to new team
    if (team.id === teamId && !team.memberIds.includes(staffId)) {
      return {
        ...team,
        memberIds: [...team.memberIds, staffId]
      };
    }
    return team;
  });
  
  // Update staff member
  const updatedStaff = allStaff.map(s => 
    s.id === staffId ? { ...s, teamId } : s
  );
  
  updateGameState({ staff: updatedStaff, teams: updatedTeams });
  
  const teamName = teamId ? updatedTeams.find(t => t.id === teamId)?.name : 'No Team';
  notificationService.success(`${staff.name} assigned to ${teamName}`);
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
export function resetTeamsToDefault(): void {
  const defaultTeams = getDefaultTeams();
  
  // Clear all team assignments from staff
  const gameState = getGameState();
  const allStaff = gameState.staff || [];
  const updatedStaff = allStaff.map(staff => ({ ...staff, teamId: null }));
  
  updateGameState({ 
    teams: defaultTeams,
    staff: updatedStaff
  });
  
  notificationService.info('Teams reset to default configuration');
}
