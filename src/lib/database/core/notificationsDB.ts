// ===== NOTIFICATION OPERATIONS =====

import { supabase } from './supabase';
import { getCurrentCompanyId } from '../../utils/companyUtils';

const NOTIFICATIONS_TABLE = 'notifications';

// Removed DbNotificationType - using category as the meaningful identifier

export interface DbNotificationRecord {
  id: string;
  game_week: number;
  game_season: string;
  game_year: number;
  text: string;
  origin?: string;
  userFriendlyOrigin?: string;
  category?: string;
}

export interface NotificationFilter {
  id: string;
  type: 'origin' | 'category';
  value: string;
  description?: string;
  createdAt: string;
}

export interface NotificationFilterRecord {
  id: string;
  company_id: string;
  filter_type: 'origin' | 'category';
  filter_value: string;
  description?: string;
  created_at: string;
}

export const saveNotification = async (notification: DbNotificationRecord): Promise<void> => {
  try {
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .upsert({
        id: notification.id,
        company_id: getCurrentCompanyId(),
        game_week: notification.game_week,
        game_season: notification.game_season,
        game_year: notification.game_year,
        text: notification.text,
        origin: notification.origin || null,
        userFriendlyOrigin: notification.userFriendlyOrigin || null,
        category: notification.category || null
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
      .order('game_year', { ascending: false })
      .order('game_season', { ascending: false })
      .order('game_week', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      game_week: row.game_week,
      game_season: row.game_season,
      game_year: row.game_year,
      text: row.text,
      origin: row.origin,
      userFriendlyOrigin: row.userFriendlyOrigin,
      category: row.category
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

// ===== NOTIFICATION FILTER OPERATIONS =====

const NOTIFICATION_FILTERS_TABLE = 'notification_filters';

export const saveNotificationFilter = async (filter: NotificationFilter): Promise<void> => {
  try {
    const { error } = await supabase
      .from(NOTIFICATION_FILTERS_TABLE)
      .upsert({
        id: filter.id,
        company_id: getCurrentCompanyId(),
        filter_type: filter.type,
        filter_value: filter.value,
        description: filter.description,
        created_at: filter.createdAt
      });

    if (error) throw error;
  } catch (error) {
    // Silently fail - filters are non-critical for gameplay
  }
};

export const loadNotificationFilters = async (): Promise<NotificationFilter[]> => {
  try {
    const { data, error } = await supabase
      .from(NOTIFICATION_FILTERS_TABLE)
      .select('*')
      .eq('company_id', getCurrentCompanyId())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      type: row.filter_type as 'origin' | 'category',
      value: row.filter_value,
      description: row.description,
      createdAt: row.created_at
    }));
  } catch (error) {
    return [];
  }
};

export const deleteNotificationFilter = async (filterId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from(NOTIFICATION_FILTERS_TABLE)
      .delete()
      .eq('id', filterId)
      .eq('company_id', getCurrentCompanyId());

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};

export const clearNotificationFilters = async (): Promise<void> => {
  try {
    const { error } = await supabase
      .from(NOTIFICATION_FILTERS_TABLE)
      .delete()
      .eq('company_id', getCurrentCompanyId());

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};
