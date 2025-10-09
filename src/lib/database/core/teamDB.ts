// Team Database Operations
// Pure CRUD operations for team data persistence in Supabase

import { supabase } from './supabase';
import { StaffTeam } from '@/lib/types/types';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

/**
 * Save or update a team in the database
 */
export async function saveTeamToDb(team: StaffTeam): Promise<boolean> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to save team.');
      return false;
    }

    const { error } = await supabase
      .from('teams')
      .upsert({
        id: team.id,
        company_id: companyId,
        name: team.name,
        description: team.description,
        icon: team.icon,
        default_task_types: team.defaultTaskTypes,
        member_ids: team.memberIds
      });

    if (error) {
      console.error('Error saving team to Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in saveTeamToDb:', error);
    return false;
  }
}

/**
 * Load all teams for the current company
 */
export async function loadTeamsFromDb(): Promise<StaffTeam[]> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to load teams.');
      return [];
    }

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading teams from Supabase:', error);
      return [];
    }

    // Convert database records to StaffTeam objects
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      icon: row.icon || '👥',
      defaultTaskTypes: row.default_task_types || [],
      memberIds: row.member_ids || []
    }));
  } catch (error) {
    console.error('Error in loadTeamsFromDb:', error);
    return [];
  }
}

/**
 * Delete a team from the database
 */
export async function deleteTeamFromDb(teamId: string): Promise<boolean> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to delete team.');
      return false;
    }

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error deleting team from Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteTeamFromDb:', error);
    return false;
  }
}

/**
 * Get a single team by ID
 */
export async function getTeamByIdFromDb(teamId: string): Promise<StaffTeam | null> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to get team.');
      return null;
    }

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      console.error('Error getting team from Supabase:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      icon: data.icon || '👥',
      defaultTaskTypes: data.default_task_types || [],
      memberIds: data.member_ids || []
    };
  } catch (error) {
    console.error('Error in getTeamByIdFromDb:', error);
    return null;
  }
}

/**
 * Save multiple teams to the database
 */
export async function saveTeamsToDb(teams: StaffTeam[]): Promise<boolean> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to save teams.');
      return false;
    }

    const teamsData = teams.map(team => ({
      id: team.id,
      company_id: companyId,
      name: team.name,
      description: team.description,
      icon: team.icon,
      default_task_types: team.defaultTaskTypes,
      member_ids: team.memberIds
    }));

    const { error } = await supabase
      .from('teams')
      .upsert(teamsData);

    if (error) {
      console.error('Error saving teams to Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in saveTeamsToDb:', error);
    return false;
  }
}
