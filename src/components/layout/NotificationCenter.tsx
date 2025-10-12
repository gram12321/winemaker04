import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter, Button, Badge, ScrollArea } from "../ui";
import { InfoIcon, X, Trash2, Eye, Filter, Shield } from 'lucide-react';
import { toast } from "@/lib/utils/toast";
import { formatGameDate } from "@/lib/utils/utils";
import { getGameState } from "@/lib/services/core/gameState";
import { saveNotification, loadNotifications, clearNotifications as clearNotificationsFromDb, type NotificationFilter, saveNotificationFilter, loadNotificationFilters, deleteNotificationFilter, clearNotificationFilters } from "@/lib/database/core/notificationsDB";
import { NotificationCategory } from "@/lib/types/types";
import { getTailwindClasses } from "@/lib/utils/colorMapping";
import { cn } from "@/lib/utils/utils";

// Removed NotificationType - using category as the meaningful identifier

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

interface NotificationCenterProps {
  onClose?: () => void;
  isOpen?: boolean;
}

let notifications: PlayerNotification[] = [];
let notificationFilters: NotificationFilter[] = [];
let listeners: ((messages: PlayerNotification[]) => void)[] = [];
let hasLoadedFromDb = false;
let hasLoadedFiltersFromDb = false;

function notifyListeners() {
  listeners.forEach(listener => listener(notifications));
}

try {
  if (localStorage.getItem('showNotifications') === null) {
    localStorage.setItem('showNotifications', 'true');
  }
} catch {}

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
  // Check if notification should be blocked
  // Returns true if blocked from history, 'history' if only blocked from toast
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
  getMessages() {
    return [...notifications];
  },

  async addMessage(text: string, origin: string, userFriendlyOrigin: string, category: NotificationCategory) {
    // Load filters if not already loaded (await to ensure they're loaded before checking)
    await loadFiltersFromDbIfNeeded();
    
    // Check if notification is blocked by filters
    const blockStatus = isNotificationBlocked(origin, category);
    
    // If completely blocked (true), don't add to history at all
    if (blockStatus === true) {
      return null;
    }
    
    const id = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Get current game state for timestamp
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

    // Add to history (even if toast is blocked)
    notifications = [message, ...notifications];
    notifyListeners();

    // Persist to DB (best-effort)
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

    // Show toast only if not blocked and user has toasts enabled
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
    notifications = notifications.map(n => 
      n.id === id ? { ...n, isRead: true } : n
    );
    notifyListeners();
  },

  markAllAsRead() {
    notifications = notifications.map(n => ({ ...n, isRead: true }));
    notifyListeners();
  },

  // Simplified - just use addMessage directly
  // For developer errors/warnings, use console.error() and console.warn() instead

  // ===== NOTIFICATION FILTER MANAGEMENT =====
  
  getFilters() {
    return [...notificationFilters];
  },

  addFilter(type: 'origin' | 'category', value: string, description?: string) {
    const id = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    const filter: NotificationFilter = {
      id,
      type,
      value,
      description,
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
    
    const updatedFilter = {
      ...notificationFilters[filterIndex],
      ...updates
    };
    
    notificationFilters[filterIndex] = updatedFilter;
    saveNotificationFilter(updatedFilter);
    
    return updatedFilter;
  },

  // Helper method to block notifications from specific origin
  blockNotificationOrigin(origin: string) {
    return this.addFilter('origin', origin, `Blocked origin: ${origin}`);
  },

  // Helper method to block notifications from specific category
  blockNotificationCategory(category: string) {
    const capitalizedCategory = category.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return this.addFilter('category', category, `Blocked category: ${capitalizedCategory}`);
  }
};

export function NotificationCenter({ onClose, isOpen = false }: NotificationCenterProps) {
  const [messages, setMessages] = useState<PlayerNotification[]>(notifications);
  const [isHistoryOpen, setIsHistoryOpen] = useState(isOpen);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadFromDbIfNeeded();
    const listener = (updated: PlayerNotification[]) => {
      setMessages([...updated]);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  useEffect(() => {
    setIsHistoryOpen(isOpen);
  }, [isOpen]);

  // Get notification icon with category-based coloring
  const getNotificationIcon = (category: NotificationCategory) => {
    const classes = getTailwindClasses(category);
    return <InfoIcon className={cn("h-4 w-4", classes.icon)} />;
  };

  const handleClose = () => {
    setIsHistoryOpen(false);
    if (onClose) onClose();
  };

  const handleDismiss = (id: string) => {
    notificationService.dismissMessage(id);
  };

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
  };

  const handleClearAll = () => {
    notificationService.clearMessages();
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead();
  };

  const handleToggleShowAll = () => {
    setShowAll(!showAll);
  };

  const handleBlockThisOrigin = (origin?: string, userFriendlyOrigin?: string) => {
    if (origin) {
      notificationService.blockNotificationOrigin(origin);
      toast({
        title: "Filter Added",
        description: `Notifications from ${userFriendlyOrigin || origin} will be blocked`,
        variant: "default"
      });
    } else {
      toast({
        title: "No Origin",
        description: "This notification has no origin information to block",
        variant: "destructive"
      });
    }
  };

  const handleBlockThisCategory = (category?: string) => {
    if (category) {
      notificationService.blockNotificationCategory(category);
      const capitalizedCategory = category.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      toast({
        title: "Filter Added",
        description: `All ${capitalizedCategory} notifications will be blocked`,
        variant: "default"
      });
    } else {
      toast({
        title: "No Category",
        description: "This notification has no category information to block",
        variant: "destructive"
      });
    }
  };

  // Filter and sort notifications by game time (most recent first)
  const filteredMessages = messages
    .filter(msg => !msg.isDismissed)
    .sort((a, b) => {
      // Sort by year, then season, then week (descending)
      if (a.gameYear !== b.gameYear) return b.gameYear - a.gameYear;
      const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
      const aSeasonIndex = seasons.indexOf(a.gameSeason);
      const bSeasonIndex = seasons.indexOf(b.gameSeason);
      if (aSeasonIndex !== bSeasonIndex) return bSeasonIndex - aSeasonIndex;
      return b.gameWeek - a.gameWeek;
    });

  const recentMessages = showAll ? filteredMessages : filteredMessages.slice(0, 5);
  const unreadCount = filteredMessages.filter(msg => !msg.isRead).length;

  // Check if notification is old (more than 1 game year ago)
  const isOldNotification = (_gameWeek: number, gameSeason: string, gameYear: number) => {
    const currentGameState = getGameState();
    const currentSeason = currentGameState.season || 'Spring';
    const currentYear = currentGameState.currentYear || 2024;
    
    // Consider old if more than 1 year behind
    if (currentYear - gameYear > 1) return true;
    if (currentYear - gameYear === 1) {
      // If exactly 1 year behind, check if it's significantly behind
      const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
      const currentSeasonIndex = seasons.indexOf(currentSeason);
      const notificationSeasonIndex = seasons.indexOf(gameSeason);
      
      // If we're in a much later season, it's old
      if (currentSeasonIndex - notificationSeasonIndex > 2) return true;
    }
    return false;
  };

  return (
    <>
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-4 sm:items-start sm:pt-16 sm:pb-0">
          {/* Mobile: bottom positioning */}
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[95%] max-w-lg z-50 sm:hidden">
            <Card className="max-h-[90vh] overflow-hidden">
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Notifications</CardTitle>
                    <CardDescription>
                      {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {unreadCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAllAsRead}
                        className="text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Mark all read
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearAll}
                      className="text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear all
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <ScrollArea className="h-[40vh]">
                <CardContent className="p-3">
                  {filteredMessages.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No notifications</p>
                  ) : (
                    <div className="space-y-3">
                      {recentMessages.map((message) => {
                        const isOld = isOldNotification(message.gameWeek, message.gameSeason, message.gameYear);
                        const isUnread = !message.isRead;
                        
                        // Get colors using new system
                        const classes = getTailwindClasses(message.category);
                        
                        return (
                          <div
                            key={message.id}
                            className={cn(
                              "p-2 rounded-md border flex items-start gap-2 text-sm transition-all",
                              classes.background,
                              classes.border,
                              classes.text,
                              isOld ? 'opacity-60' : '',
                              isUnread ? `ring-2 ${classes.ring}` : ''
                            )}
                          >
                            <div className="mt-0.5">{getNotificationIcon(message.category)}</div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <Badge 
                                  variant="outline" 
                                  className={cn("mb-1 text-xs", classes.badge)}
                                >
                                  {formatGameDate(message.gameWeek, message.gameSeason, message.gameYear)}
                                </Badge>
                                <div className="flex gap-1">
                                  {isUnread && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleMarkAsRead(message.id)}
                                      className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                                      title="Mark as read"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {message.origin && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleBlockThisOrigin(message.origin, message.userFriendlyOrigin)}
                                      className="h-6 w-6 p-0 text-gray-500 hover:text-orange-600"
                                      title={`Block notifications from ${message.origin}`}
                                    >
                                      <Shield className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {message.category && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleBlockThisCategory(message.category)}
                                      className="h-6 w-6 p-0 text-gray-500 hover:text-purple-600"
                                      title={`Block all ${message.category} notifications`}
                                    >
                                      <Filter className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDismiss(message.id)}
                                    className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                                    title="Dismiss"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className={`break-words ${isOld ? 'text-gray-600' : ''}`}>
                                {message.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      
                      {filteredMessages.length > 5 && (
                        <div className="text-center pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToggleShowAll}
                            className="text-xs"
                          >
                            {showAll 
                              ? `Show less (${filteredMessages.length - 5} hidden)` 
                              : `View all notifications (${filteredMessages.length - 5} more)`
                            }
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </ScrollArea>
              <CardFooter className="border-t p-3">
                <div className="w-full flex justify-between">
                  <div className="text-xs text-gray-500">
                    {filteredMessages.length} total notifications
                  </div>
                  <Button variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
          
          {/* Desktop: top positioning */}
          <div className="hidden sm:block">
            <Card className="z-50 w-[95%] max-w-lg max-h-[80vh] overflow-hidden">
              <CardHeader className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg md:text-xl">Notifications</CardTitle>
                    <CardDescription>
                      {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {unreadCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAllAsRead}
                        className="text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Mark all read
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearAll}
                      className="text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear all
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <ScrollArea className="h-[40vh] md:h-[50vh]">
                <CardContent className="p-3 md:p-4">
                  {filteredMessages.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No notifications</p>
                  ) : (
                    <div className="space-y-3">
                      {recentMessages.map((message) => {
                        const isOld = isOldNotification(message.gameWeek, message.gameSeason, message.gameYear);
                        const isUnread = !message.isRead;
                        
                        // Get colors using new system
                        const classes = getTailwindClasses(message.category);
                        
                        return (
                          <div
                            key={message.id}
                            className={cn(
                              "p-2 md:p-3 rounded-md border flex items-start gap-2 text-sm md:text-base transition-all",
                              classes.background,
                              classes.border,
                              classes.text,
                              isOld ? 'opacity-60' : '',
                              isUnread ? `ring-2 ${classes.ring}` : ''
                            )}
                          >
                            <div className="mt-0.5">{getNotificationIcon(message.category)}</div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <Badge 
                                  variant="outline" 
                                  className={cn("mb-1 text-xs md:text-sm", classes.badge)}
                                >
                                  {formatGameDate(message.gameWeek, message.gameSeason, message.gameYear)}
                                </Badge>
                                <div className="flex gap-1">
                                  {isUnread && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleMarkAsRead(message.id)}
                                      className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                                      title="Mark as read"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {message.origin && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleBlockThisOrigin(message.origin, message.userFriendlyOrigin)}
                                      className="h-6 w-6 p-0 text-gray-500 hover:text-orange-600"
                                      title={`Block notifications from ${message.origin}`}
                                    >
                                      <Shield className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {message.category && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleBlockThisCategory(message.category)}
                                      className="h-6 w-6 p-0 text-gray-500 hover:text-purple-600"
                                      title={`Block all ${message.category} notifications`}
                                    >
                                      <Filter className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDismiss(message.id)}
                                    className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                                    title="Dismiss"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className={`break-words ${isOld ? 'text-gray-600' : ''}`}>
                                {message.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      
                      {filteredMessages.length > 5 && (
                        <div className="text-center pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToggleShowAll}
                            className="text-xs"
                          >
                            {showAll 
                              ? `Show less (${filteredMessages.length - 5} hidden)` 
                              : `View all notifications (${filteredMessages.length - 5} more)`
                            }
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </ScrollArea>
              <CardFooter className="border-t p-3 md:px-6 md:py-4">
                <div className="w-full flex justify-between">
                  <div className="text-xs text-gray-500">
                    {filteredMessages.length} total notifications
                  </div>
                  <Button variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

export function useNotifications() {
  const [messages, setMessages] = useState<PlayerNotification[]>(notifications);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    loadFromDbIfNeeded();
    const listener = (updated: PlayerNotification[]) => {
      setMessages([...updated]);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  const openHistory = () => setIsHistoryOpen(true);
  const closeHistory = () => setIsHistoryOpen(false);

  return {
    messages,
    isHistoryOpen,
    openHistory,
    closeHistory,
    addMessage: notificationService.addMessage.bind(notificationService),
    clearMessages: notificationService.clearMessages.bind(notificationService),
    dismissMessage: notificationService.dismissMessage.bind(notificationService),
    markAsRead: notificationService.markAsRead.bind(notificationService),
    markAllAsRead: notificationService.markAllAsRead.bind(notificationService),
    // Removed info/warning/error/success methods - use addMessage directly
    // Filter management
    getFilters: notificationService.getFilters.bind(notificationService),
    addFilter: notificationService.addFilter.bind(notificationService),
    removeFilter: notificationService.removeFilter.bind(notificationService),
    updateFilter: notificationService.updateFilter.bind(notificationService),
    blockNotificationOrigin: notificationService.blockNotificationOrigin.bind(notificationService),
    blockNotificationCategory: notificationService.blockNotificationCategory.bind(notificationService)
  };
}


