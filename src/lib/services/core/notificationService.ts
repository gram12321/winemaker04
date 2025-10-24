import { toast } from "@/lib/utils/toast";
import { getGameState } from "@/lib/services/core/gameState";
import {
  saveNotification,
  loadNotifications,
  clearNotifications as clearNotificationsFromDb,
  type NotificationFilter,
  saveNotificationFilter,
  loadNotificationFilters,
  deleteNotificationFilter,
  clearNotificationFilters
} from "@/lib/database/core/notificationsDB";
import { NotificationCategory } from "@/lib/types/types";

export interface PlayerNotification {
  id: string;
  gameWeek: number;
  gameSeason: string;
  gameYear: number;
  text: string;
  origin: string;
  userFriendlyOrigin: string;
  category: NotificationCategory;
  isRead?: boolean;
  isDismissed?: boolean;
}

let notifications: PlayerNotification[] = [];
let notificationFilters: NotificationFilter[] = [];
let listeners: ((messages: PlayerNotification[]) => void)[] = [];
let hasLoadedFromDb = false;
let hasLoadedFiltersFromDb = false;

function notifyListeners() {
  listeners.forEach(listener => listener([...notifications]));
}

async function loadFromDbIfNeeded() {
  if (hasLoadedFromDb) return;
  try {
    const records = await loadNotifications();
    notifications = records.map(r => ({
      id: r.id,
      gameWeek: r.game_week,
      gameSeason: r.game_season,
      gameYear: r.game_year,
      text: r.text,
      origin: r.origin,
      userFriendlyOrigin: r.userFriendlyOrigin,
      category: r.category
    }));
    hasLoadedFromDb = true;
    notifyListeners();
  } catch {
    // Non-critical
  }
}

async function loadFiltersFromDbIfNeeded() {
  if (hasLoadedFiltersFromDb) return;
  try {
    notificationFilters = await loadNotificationFilters();
    hasLoadedFiltersFromDb = true;
  } catch {
    // Non-critical
  }
}

function isNotificationBlocked(origin: string, category: NotificationCategory): boolean | 'history' {
  let shouldBlock = false;
  let blockFromHistory = false;

  notificationFilters.forEach(filter => {
    let matches = false;
    switch (filter.type) {
      case 'origin':
        matches = filter.value === origin;
        break;
      case 'category':
        matches = filter.value === category;
        break;
    }
    if (matches) {
      shouldBlock = true;
      if (filter.blockFromHistory) {
        blockFromHistory = true;
      }
    }
  });

  if (!shouldBlock) return false;
  return blockFromHistory ? true : 'history';
}

export const notificationService = {
  async ensureInitialized() {
    await Promise.all([loadFromDbIfNeeded(), loadFiltersFromDbIfNeeded()]);
  },

  addListener(listener: (messages: PlayerNotification[]) => void) {
    listeners.push(listener);
  },

  removeListener(listener: (messages: PlayerNotification[]) => void) {
    listeners = listeners.filter(l => l !== listener);
  },

  getMessages() {
    return [...notifications];
  },

  async addMessage(text: string, origin: string, userFriendlyOrigin: string, category: NotificationCategory) {
    await loadFiltersFromDbIfNeeded();

    const blockStatus = isNotificationBlocked(origin, category);
    if (blockStatus === true) {
      return null;
    }

    const id = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const gameState = getGameState();
    const gameWeek = gameState.week || 1;
    const gameSeason = gameState.season || 'Spring';
    const gameYear = gameState.currentYear || 2024;

    const message: PlayerNotification = {
      id,
      gameWeek,
      gameSeason,
      gameYear,
      text,
      origin,
      userFriendlyOrigin,
      category
    };

    notifications = [message, ...notifications];
    notifyListeners();

    saveNotification({
      id,
      game_week: gameWeek,
      game_season: gameSeason,
      game_year: gameYear,
      text,
      origin,
      userFriendlyOrigin,
      category
    });

    const showToasts = localStorage.getItem('showNotifications') !== 'false';
    const shouldShowToast = showToasts && blockStatus === false;
    if (shouldShowToast) {
      toast({
        title: userFriendlyOrigin,
        description: text,
        variant: 'default',
        origin,
        userFriendlyOrigin,
        category,
      });
    }

    return message;
  },

  clearMessages() {
    notifications = [];
    notifyListeners();
    clearNotificationsFromDb();
  },

  dismissMessage(id: string) {
    notifications = notifications.filter(n => n.id !== id);
    notifyListeners();
  },

  markAsRead(id: string) {
    notifications = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
    notifyListeners();
  },

  markAllAsRead() {
    notifications = notifications.map(n => ({ ...n, isRead: true }));
    notifyListeners();
  },

  getFilters() {
    return [...notificationFilters];
  },

  addFilter(type: 'origin' | 'category', value: string, description?: string, blockFromHistory?: boolean) {
    const id = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const filter: NotificationFilter = {
      id,
      type,
      value,
      description,
      blockFromHistory: blockFromHistory ?? false,
      createdAt: new Date().toISOString()
    };

    notificationFilters = [filter, ...notificationFilters];
    saveNotificationFilter(filter);
    return filter;
  },

  removeFilter(filterId: string) {
    notificationFilters = notificationFilters.filter(f => f.id !== filterId);
    deleteNotificationFilter(filterId);
  },

  clearFilters() {
    notificationFilters = [];
    clearNotificationFilters();
  },

  updateFilter(filterId: string, updates: Partial<Omit<NotificationFilter, 'id'>>) {
    const filterIndex = notificationFilters.findIndex(f => f.id === filterId);
    if (filterIndex === -1) return null;
    const updatedFilter = { ...notificationFilters[filterIndex], ...updates };
    notificationFilters[filterIndex] = updatedFilter;
    saveNotificationFilter(updatedFilter);
    return updatedFilter;
  },

  blockNotificationOrigin(origin: string, blockFromHistory?: boolean) {
    return this.addFilter('origin', origin, `Blocked origin: ${origin}`, blockFromHistory);
  },

  blockNotificationCategory(category: string, blockFromHistory?: boolean) {
    const capitalizedCategory = category.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return this.addFilter('category', category, `Blocked category: ${capitalizedCategory}`, blockFromHistory);
  }
};


