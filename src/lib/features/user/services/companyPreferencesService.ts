export interface CompanyPreferences {
  toastNotifications: boolean;
}

const DEFAULT_PREFERENCES: CompanyPreferences = { toastNotifications: true };

function preferenceKey(companyId: string): string {
  return `user_preferences:${companyId}`;
}

export function getCompanyPreferences(companyId: string): CompanyPreferences {
  try {
    const stored = localStorage.getItem(preferenceKey(companyId));
    return stored ? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function setToastNotifications(companyId: string, toastNotifications: boolean): void {
  localStorage.setItem(preferenceKey(companyId), JSON.stringify({ toastNotifications }));
}
