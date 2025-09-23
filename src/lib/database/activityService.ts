import { Activity } from '@/lib/types/types';
import { supabase } from './supabase';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

// Supabase integration for activities
export async function saveActivityToDb(activity: Activity): Promise<boolean> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to save activity.');
      return false;
    }

    const activityData = {
      id: activity.id,
      company_id: companyId,
      category: activity.category,
      title: activity.title,
      total_work: activity.totalWork,
      completed_work: activity.completedWork,
      target_id: activity.targetId || null,
      params: activity.params,
      status: activity.status,
      game_week: activity.gameWeek,
      game_season: activity.gameSeason,
      game_year: activity.gameYear,
      is_cancellable: activity.isCancellable,
      created_at: activity.createdAt.toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('activities')
      .upsert(activityData);

    if (error) {
      console.error('Error saving activity to Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in saveActivityToDb:', error);
    return false;
  }
}

export async function loadActivitiesFromDb(): Promise<Activity[]> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to load activities.');
      return [];
    }

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading activities from Supabase:', error);
      return [];
    }

    // Convert database records to Activity objects
    return (data || []).map(record => ({
      id: record.id,
      category: record.category,
      title: record.title,
      totalWork: record.total_work,
      completedWork: record.completed_work,
      targetId: record.target_id,
      params: record.params || {},
      status: record.status,
      gameWeek: record.game_week,
      gameSeason: record.game_season,
      gameYear: record.game_year,
      isCancellable: record.is_cancellable,
      createdAt: new Date(record.created_at)
    }));
  } catch (error) {
    console.error('Error in loadActivitiesFromDb:', error);
    return [];
  }
}

export async function updateActivityInDb(activityId: string, updates: Partial<Activity>): Promise<boolean> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to update activity.');
      return false;
    }

    // Prepare update data (only include fields that exist in the database)
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.totalWork !== undefined) updateData.total_work = updates.totalWork;
    if (updates.completedWork !== undefined) updateData.completed_work = updates.completedWork;
    if (updates.targetId !== undefined) updateData.target_id = updates.targetId;
    if (updates.params !== undefined) updateData.params = updates.params;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.gameWeek !== undefined) updateData.game_week = updates.gameWeek;
    if (updates.gameSeason !== undefined) updateData.game_season = updates.gameSeason;
    if (updates.gameYear !== undefined) updateData.game_year = updates.gameYear;
    if (updates.isCancellable !== undefined) updateData.is_cancellable = updates.isCancellable;

    const { error } = await supabase
      .from('activities')
      .update(updateData)
      .eq('id', activityId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error updating activity in Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateActivityInDb:', error);
    return false;
  }
}

export async function removeActivityFromDb(activityId: string): Promise<boolean> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to remove activity.');
      return false;
    }

    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', activityId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error removing activity from Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in removeActivityFromDb:', error);
    return false;
  }
}

export async function getActivitiesByTarget(targetId: string): Promise<Activity[]> {
  const activities = await loadActivitiesFromDb();
  return activities.filter(activity => 
    activity.targetId === targetId && activity.status === 'active'
  );
}

export async function getActivitiesByCategory(category: string): Promise<Activity[]> {
  const activities = await loadActivitiesFromDb();
  return activities.filter(activity => 
    activity.category === category && activity.status === 'active'
  );
}

export async function hasActiveActivity(targetId: string, category?: string): Promise<boolean> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      console.error('No company ID found to check for active activity.');
      return false;
    }

    let query = supabase
      .from('activities')
      .select('id')
      .eq('company_id', companyId)
      .eq('target_id', targetId)
      .eq('status', 'active');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      console.error('Error checking for active activity:', error);
      return false;
    }

    return (data && data.length > 0);
  } catch (error) {
    console.error('Error in hasActiveActivity:', error);
    return false;
  }
}
