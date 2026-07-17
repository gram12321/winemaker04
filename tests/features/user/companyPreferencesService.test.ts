import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCompanyPreferences,
  setToastNotifications,
} from '@/lib/features/user/services/companyPreferencesService';

describe('company preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores toast preferences independently for each company', () => {
    setToastNotifications('company-a', false);

    expect(getCompanyPreferences('company-a')).toEqual({ toastNotifications: false });
    expect(getCompanyPreferences('company-b')).toEqual({ toastNotifications: true });
    expect(localStorage.getItem('player_account_preferences:company-a')).toBe('{"toastNotifications":false}');
  });

  it('uses the default when persisted preferences are malformed', () => {
    localStorage.setItem('player_account_preferences:company-a', '{not json');

    expect(getCompanyPreferences('company-a')).toEqual({ toastNotifications: true });
  });
});
