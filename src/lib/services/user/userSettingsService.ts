import { 
  getUserSettings as loadUserSettingsFromDB, 
  upsertUserSettings as saveUserSettingsToDB, 
  deleteUserSettings as deleteUserSettingsFromDB,
  type UserSettings,
  type UserSettingsData
} from '@/lib/database';

export interface NotificationSettings {
  categories: Record<string, boolean>;
  specificMessages: Record<string, boolean>;
}

export interface ViewPreferences {
  hideEmpty: boolean;
  selectedTier: string;
  hierarchyView: boolean;
}

// Default settings
const DEFAULT_NOTIFICATION_CATEGORIES = {
  'Production': true,
  'Building': true,
  'Market': true,
  'Population': true,
  'Inventory': true,
  'Admin': true
};

const DEFAULT_NOTIFICATION_SPECIFIC_MESSAGES = {
  'Production:complete': true,
  'Inventory:auto-purchase': false
};

const DEFAULT_VIEW_PREFERENCES: ViewPreferences = {
  hideEmpty: false,
  selectedTier: 'all',
  hierarchyView: false
};

const DEFAULT_USER_SETTINGS: Omit<UserSettings, 'id' | 'userId' | 'companyId' | 'createdAt' | 'updatedAt'> = {
  showToastNotifications: true,
  allowResourceSubstitution: true,
  showDetailedInputSection: true,
  notificationCategories: DEFAULT_NOTIFICATION_CATEGORIES,
  notificationSpecificMessages: DEFAULT_NOTIFICATION_SPECIFIC_MESSAGES,
  viewPreferences: {
    market: DEFAULT_VIEW_PREFERENCES,
    inventory: DEFAULT_VIEW_PREFERENCES
  }
};

class UserSettingsService {
  public async getUserSettings(userId: string, companyId: string): Promise<UserSettings> {
    try {
      const settings = await loadUserSettingsFromDB(userId, companyId);

      if (!settings) {
        // Return default settings if none exist
        return {
          userId,
          companyId,
          ...DEFAULT_USER_SETTINGS
        };
      }

      return settings;
    } catch (error) {
      console.error('Error getting user settings:', error);
      return {
        userId,
        companyId,
        ...DEFAULT_USER_SETTINGS
      };
    }
  }

  public async saveUserSettings(settings: Partial<UserSettings> & { userId: string; companyId: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const settingsData: UserSettingsData = {
        user_id: settings.userId,
        company_id: settings.companyId,
        show_toast_notifications: settings.showToastNotifications,
        allow_resource_substitution: settings.allowResourceSubstitution,
        show_detailed_input_section: settings.showDetailedInputSection,
        notification_categories: settings.notificationCategories || DEFAULT_NOTIFICATION_CATEGORIES,
        notification_specific_messages: settings.notificationSpecificMessages || DEFAULT_NOTIFICATION_SPECIFIC_MESSAGES,
        view_preferences: settings.viewPreferences || {
          market: DEFAULT_VIEW_PREFERENCES,
          inventory: DEFAULT_VIEW_PREFERENCES
        }
      };

      return await saveUserSettingsToDB(settingsData);
    } catch (error) {
      console.error('Error saving user settings:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async updateNotificationSetting(
    userId: string,
    companyId: string,
    type: 'categories' | 'specificMessages',
    key: string,
    value: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current settings
      const currentSettings = await this.getUserSettings(userId, companyId);
      
      // Update the specific setting
      if (type === 'categories') {
        currentSettings.notificationCategories[key] = value;
      } else {
        currentSettings.notificationSpecificMessages[key] = value;
      }

      // Save updated settings
      return await this.saveUserSettings(currentSettings);
    } catch (error) {
      console.error('Error updating notification setting:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async updateViewPreferences(
    userId: string,
    companyId: string,
    viewName: 'market' | 'inventory',
    preferences: Partial<ViewPreferences>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current settings
      const currentSettings = await this.getUserSettings(userId, companyId);
      
      // Update view preferences
      if (!currentSettings.viewPreferences[viewName]) {
        currentSettings.viewPreferences[viewName] = DEFAULT_VIEW_PREFERENCES;
      }
      
      currentSettings.viewPreferences[viewName] = {
        ...currentSettings.viewPreferences[viewName]!,
        ...preferences
      };

      // Save updated settings
      return await this.saveUserSettings(currentSettings);
    } catch (error) {
      console.error('Error updating view preferences:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async deleteUserSettings(userId: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
    return await deleteUserSettingsFromDB(userId, companyId);
  }

  // Helper methods for localStorage fallback (for anonymous users)
  public getLocalSettings(companyId: string): UserSettings {
    try {
      const key = `company_settings_${companyId}`;
      const stored = localStorage.getItem(key);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          userId: 'anonymous',
          companyId,
          ...DEFAULT_USER_SETTINGS,
          ...parsed
        };
      }
    } catch (error) {
      console.error('Error getting local settings:', error);
    }

    return {
      userId: 'anonymous',
      companyId,
      ...DEFAULT_USER_SETTINGS
    };
  }

  public saveLocalSettings(companyId: string, settings: Partial<UserSettings>): void {
    try {
      const key = `company_settings_${companyId}`;
      const current = this.getLocalSettings(companyId);
      const updated = { ...current, ...settings };
      
      // Remove userId and companyId before storing
      const { userId, companyId: cId, ...settingsToStore } = updated;
      localStorage.setItem(key, JSON.stringify(settingsToStore));
    } catch (error) {
      console.error('Error saving local settings:', error);
    }
  }

  public clearLocalSettings(companyId?: string): void {
    try {
      if (companyId) {
        localStorage.removeItem(`company_settings_${companyId}`);
      } else {
        // Clear all company settings
        Object.keys(localStorage)
          .filter(key => key.startsWith('company_settings_'))
          .forEach(key => localStorage.removeItem(key));
      }
    } catch (error) {
      console.error('Error clearing local settings:', error);
    }
  }

}

export const userSettingsService = new UserSettingsService();
export default userSettingsService;
