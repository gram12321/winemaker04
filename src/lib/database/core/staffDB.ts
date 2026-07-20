// Staff Database Operations
// Pure CRUD operations for staff data persistence in Supabase

import { supabase } from './supabase';
import { Staff, SpecializedRole } from '@/lib/types/types';
import { isSpecializedRole } from '@/lib/constants/staffConstants';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { buildGameDate } from '../dbMapperUtils';

/**
 * Save or update a staff member in the database
 */
export async function saveStaffToDb(staff: Staff): Promise<boolean> {
  try {
    if (!Array.isArray(staff.specializedRoles) || !staff.specializedRoles.every(isSpecializedRole)) {
      throw new Error('Staff specializedRoles must be an array of valid roles.');
    }

    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to save staff.');
      return false;
    }

    const { error } = await supabase
      .from('staff')
      .upsert({
        id: staff.id,
        company_id: companyId,
        name: staff.name,
        nationality: staff.nationality,
        skill_level: staff.skillLevel,
        specialized_roles: staff.specializedRoles,
        wage: staff.wage,
        is_founder: staff.isFounder ?? false,
        team_ids: staff.teamIds || [],
        skill_field: staff.skills.field,
        skill_winery: staff.skills.winery,
        skill_maintenance: staff.skills.maintenance,
        skill_administration: staff.skills.financeAndStaff,
        skill_sales: staff.skills.sales,
        skill_administration_and_research: staff.skills.administrationAndResearch,
        workforce: staff.workforce,
        hire_date_week: staff.hireDate.week,
        hire_date_season: staff.hireDate.season,
        hire_date_year: staff.hireDate.year,
        experience: staff.experience || {}
      });

    if (error) {
      console.error('Error saving staff to Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in saveStaffToDb:', error);
    throw error;
  }
}

function readSpecializedRoles(row: Record<string, unknown>): SpecializedRole[] {
  if (!Object.prototype.hasOwnProperty.call(row, 'specialized_roles')) {
    throw new Error('Staff schema is missing required specialized_roles column.');
  }
  const specializedRoles = row.specialized_roles;
  if (!Array.isArray(specializedRoles) || !specializedRoles.every(isSpecializedRole)) {
    throw new Error('Staff specialized_roles must be an array of valid roles.');
  }
  return specializedRoles;
}

function mapStaffRow(row: Record<string, any>): Staff {
  return {
    id: row.id,
    name: row.name,
    nationality: row.nationality,
    skillLevel: row.skill_level,
    specializedRoles: readSpecializedRoles(row),
    wage: row.wage,
    isFounder: row.is_founder ?? false,
    teamIds: row.team_ids || [],
    skills: {
      field: row.skill_field,
      winery: row.skill_winery,
      maintenance: row.skill_maintenance,
      financeAndStaff: row.skill_administration,
      sales: row.skill_sales,
      administrationAndResearch: row.skill_administration_and_research
    },
    experience: row.experience || {},
    workforce: row.workforce || 50,
    hireDate: buildGameDate(row.hire_date_week, row.hire_date_season, row.hire_date_year)!
  };
}

/**
 * Load all staff members for the current company
 */
export async function loadStaffFromDb(): Promise<Staff[]> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to load staff.');
      return [];
    }

    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading staff from Supabase:', error);
      return [];
    }

    // Convert database records to Staff objects
    return (data || []).map(mapStaffRow);
  } catch (error) {
    console.error('Error in loadStaffFromDb:', error);
    throw error;
  }
}

/**
 * Delete a staff member from the database
 */
export async function deleteStaffFromDb(staffId: string): Promise<boolean> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to delete staff.');
      return false;
    }

    const { error } = await supabase
      .from('staff')
      .delete()
      .eq('id', staffId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error deleting staff from Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteStaffFromDb:', error);
    return false;
  }
}

/**
 * Get a single staff member by ID
 */
export async function getStaffByIdFromDb(staffId: string): Promise<Staff | null> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to get staff.');
      return null;
    }

    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      console.error('Error getting staff from Supabase:', error);
      return null;
    }

    return mapStaffRow(data);
  } catch (error) {
    console.error('Error in getStaffByIdFromDb:', error);
    throw error;
  }
}

/** Atomically remove a staff record and its memberships from company teams. */
export async function deleteStaffAndTeamMembershipsFromDb(staffId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_staff_and_team_memberships', { p_staff_id: staffId });
  if (error) {
    console.error('Error deleting staff memberships:', error);
    return false;
  }
  return data === true;
}
