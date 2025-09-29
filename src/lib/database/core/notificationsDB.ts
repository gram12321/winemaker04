// ===== NOTIFICATION OPERATIONS =====

import { supabase } from './supabase';
import { getCurrentCompanyId } from '../../utils/companyUtils';

const NOTIFICATIONS_TABLE = 'notifications';

export type DbNotificationType = 'info' | 'warning' | 'error' | 'success';

export interface DbNotificationRecord {
  id: string;
  timestamp: string;
  text: string;
  type: DbNotificationType;
}

export const saveNotification = async (notification: DbNotificationRecord): Promise<void> => {
  try {
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .upsert({
        id: notification.id,
        company_id: getCurrentCompanyId(),
        timestamp: notification.timestamp,
        text: notification.text,
        type: notification.type,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    // Silently fail - notifications are non-critical for gameplay
  }
};

export const loadNotifications = async (): Promise<DbNotificationRecord[]> => {
  try {
    const { data, error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .select('*')
      .eq('company_id', getCurrentCompanyId())
      .order('timestamp', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      text: row.text,
      type: row.type as DbNotificationType
    }));
  } catch (error) {
    return [];
  }
};

export const clearNotifications = async (): Promise<void> => {
  try {
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .delete()
      .eq('company_id', getCurrentCompanyId());

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};
