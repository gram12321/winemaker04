import { supabase } from './supabase';

const USER_SETTINGS_TABLE = 'user_settings';

/**
 * User Settings Database Operations
 * Pure CRUD operations for user settings data persistence
 */

export interface UserSettingsData {
  user_id: string;
  company_id: string;
  show_toast_notifications?: boolean;
  allow_resource_substitution?: boolean;
  show_detailed_input_section?: boolean;
  notification_categories?: Record<string, boolean>;
  notification_specific_messages?: Record<string, boolean>;
  view_preferences?: any;
}

export interface UserSettings {
  id?: string;
  userId: string;
  companyId: string;
  showToastNotifications: boolean;
  allowResourceSubstitution: boolean;
  showDetailedInputSection: boolean;
  notificationCategories: Record<string, boolean>;
  notificationSpecificMessages: Record<string, boolean>;
  viewPreferences: any;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Map database row to UserSettings
 */
function mapSettingsFromDB(dbSettings: any): UserSettings {
  return {
    id: dbSettings.id,
    userId: dbSettings.user_id,
    companyId: dbSettings.company_id,
    showToastNotifications: dbSettings.show_toast_notifications ?? true,
    allowResourceSubstitution: dbSettings.allow_resource_substitution ?? true,
    showDetailedInputSection: dbSettings.show_detailed_input_section ?? true,
    notificationCategories: dbSettings.notification_categories || {},
    notificationSpecificMessages: dbSettings.notification_specific_messages || {},
    viewPreferences: dbSettings.view_preferences || {},
    createdAt: new Date(dbSettings.created_at),
    updatedAt: new Date(dbSettings.updated_at)
  };
}

export const getUserSettings = async (userId: string, companyId: string): Promise<UserSettings | null> => {
  try {
    const { data, error } = await supabase
      .from(USER_SETTINGS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single();

    if (error) return null;
    return data ? mapSettingsFromDB(data) : null;
  } catch (error) {
    console.error('Error getting user settings:', error);
    return null;
  }
};

export const upsertUserSettings = async (settingsData: UserSettingsData): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from(USER_SETTINGS_TABLE)
      .upsert(settingsData, {
        onConflict: 'user_id,company_id'
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error upserting user settings:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

export const deleteUserSettings = async (userId: string, companyId?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    let query = supabase.from(USER_SETTINGS_TABLE).delete().eq('user_id', userId);
    
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user settings:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

