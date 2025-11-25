// Staff Database Operations
// Pure CRUD operations for staff data persistence in Supabase

import { supabase } from './supabase';
import { Staff } from '@/lib/types/types';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

/**
 * Save or update a staff member in the database
 */
export async function saveStaffToDb(staff: Staff): Promise<boolean> {
  try {
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
        specializations: staff.specializations,
        wage: staff.wage,
        team_ids: staff.teamIds || [],
        skill_field: staff.skills.field,
        skill_winery: staff.skills.winery,
        skill_administration: staff.skills.financeAndStaff,
        skill_sales: staff.skills.sales,
        skill_maintenance: staff.skills.administrationAndResearch,
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
    return false;
  }
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
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      nationality: row.nationality,
      skillLevel: row.skill_level,
      specializations: row.specializations || [],
      wage: row.wage,
      teamIds: row.team_ids || [],
      skills: {
        field: row.skill_field,
        winery: row.skill_winery,
        financeAndStaff: row.skill_administration,
        sales: row.skill_sales,
        administrationAndResearch: row.skill_maintenance
      },
      experience: row.experience || {},
      workforce: row.workforce || 50,
      hireDate: {
        week: row.hire_date_week,
        season: row.hire_date_season,
        year: row.hire_date_year
      }
    }));
  } catch (error) {
    console.error('Error in loadStaffFromDb:', error);
    return [];
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

    return {
      id: data.id,
      name: data.name,
      nationality: data.nationality,
      skillLevel: data.skill_level,
      specializations: data.specializations || [],
      wage: data.wage,
      teamIds: data.team_ids || [],
      skills: {
        field: data.skill_field,
        winery: data.skill_winery,
        financeAndStaff: data.skill_administration,
        sales: data.skill_sales,
        administrationAndResearch: data.skill_maintenance
      },
      experience: data.experience || {},
      workforce: data.workforce || 50,
      hireDate: {
        week: data.hire_date_week,
        season: data.hire_date_season,
        year: data.hire_date_year
      }
    };
  } catch (error) {
    console.error('Error in getStaffByIdFromDb:', error);
    return null;
  }
}
