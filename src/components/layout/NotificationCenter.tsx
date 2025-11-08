import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter, Button, Badge, ScrollArea } from "../ui";
import { InfoIcon, X, Trash2, Eye, Filter, Shield, VolumeX } from 'lucide-react';
import { formatGameDate } from "@/lib/utils/utils";
import { NotificationCategory } from "@/lib/types/types";
import { getTailwindClasses } from "@/lib/utils/colorMapping";
import { cn } from "@/lib/utils/utils";
import { notificationService } from "@/lib/services/core/notificationService";
import { getGameState } from "@/lib/services/core/gameState";
import { SEASON_ORDER } from "@/lib/constants";

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

try {
  if (localStorage.getItem('showNotifications') === null) {
    localStorage.setItem('showNotifications', 'true');
  }
} catch {}

export function NotificationCenter({ onClose, isOpen = false }: NotificationCenterProps) {
  const [messages, setMessages] = useState<PlayerNotification[]>(notificationService.getMessages());
  const [isHistoryOpen, setIsHistoryOpen] = useState(isOpen);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    notificationService.ensureInitialized();
    const listener = (updated: PlayerNotification[]) => {
      setMessages([...updated]);
    };
    notificationService.addListener(listener);
    return () => {
      notificationService.removeListener(listener);
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

  const handleBlockThisOrigin = (origin?: string) => {
    if (origin) {
      notificationService.blockNotificationOrigin(origin);
      // UI feedback handled by global toast inside service when messages are added
    } else {
      // No-op: insufficient data
    }
  };

  const handleBlockThisCategory = (category?: string) => {
    if (category) {
      notificationService.blockNotificationCategory(category);
      // UI feedback optional here
    } else {
      // No-op
    }
  };

  const handleBlockThisOriginFromHistory = (origin?: string) => {
    if (origin) {
      notificationService.blockNotificationOrigin(origin, true);
      // UI feedback handled by global toast inside service when messages are added
    } else {
      // No-op: insufficient data
    }
  };

  const handleBlockThisCategoryFromHistory = (category?: string) => {
    if (category) {
      notificationService.blockNotificationCategory(category, true);
      // UI feedback optional here
    } else {
      // No-op
    }
  };

  // Filter and sort notifications by game time (most recent first)
  const filteredMessages = messages
    .filter(msg => !msg.isDismissed)
    .sort((a, b) => {
      // Sort by year, then season, then week (descending)
      if (a.gameYear !== b.gameYear) return b.gameYear - a.gameYear;
      const aSeasonIndex = SEASON_ORDER.indexOf(a.gameSeason as typeof SEASON_ORDER[number]);
      const bSeasonIndex = SEASON_ORDER.indexOf(b.gameSeason as typeof SEASON_ORDER[number]);
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
      const currentSeasonIndex = SEASON_ORDER.indexOf(currentSeason as typeof SEASON_ORDER[number]);
      const notificationSeasonIndex = SEASON_ORDER.indexOf(gameSeason as typeof SEASON_ORDER[number]);
      
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
                                      onClick={() => handleBlockThisOrigin(message.origin)}
                                      className="h-6 w-6 p-0 text-gray-500 hover:text-orange-600"
                                      title={`Block notifications from ${message.origin} (save to history)`}
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
                                      title={`Block all ${message.category} notifications (save to history)`}
                                    >
                                      <Filter className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {message.origin && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleBlockThisOriginFromHistory(message.origin)}
                                      className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                                      title={`Completely silence notifications from ${message.origin} (no history)`}
                                    >
                                      <VolumeX className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {message.category && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleBlockThisCategoryFromHistory(message.category)}
                                      className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                                      title={`Completely silence all ${message.category} notifications (no history)`}
                                    >
                                      <VolumeX className="h-3 w-3" />
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
                              <p className={`break-words whitespace-pre-line ${isOld ? 'text-gray-600' : ''}`}>
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
                                      onClick={() => handleBlockThisOrigin(message.origin)}
                                      className="h-6 w-6 p-0 text-gray-500 hover:text-orange-600"
                                      title={`Block notifications from ${message.origin} (save to history)`}
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
                                      title={`Block all ${message.category} notifications (save to history)`}
                                    >
                                      <Filter className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {message.origin && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleBlockThisOriginFromHistory(message.origin)}
                                      className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                                      title={`Completely silence notifications from ${message.origin} (no history)`}
                                    >
                                      <VolumeX className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {message.category && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleBlockThisCategoryFromHistory(message.category)}
                                      className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                                      title={`Completely silence all ${message.category} notifications (no history)`}
                                    >
                                      <VolumeX className="h-3 w-3" />
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
                              <p className={`break-words whitespace-pre-line ${isOld ? 'text-gray-600' : ''}`}>
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
  const [messages, setMessages] = useState<PlayerNotification[]>(notificationService.getMessages());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    notificationService.ensureInitialized();
    const listener = (updated: PlayerNotification[]) => {
      setMessages([...updated]);
    };
    notificationService.addListener(listener);
    return () => {
      notificationService.removeListener(listener);
    };
  }, []);

  const openHistory = () => setIsHistoryOpen(true);
  const closeHistory = () => setIsHistoryOpen(false);

  // Calculate unread count
  const unreadCount = messages.filter(msg => !msg.isRead && !msg.isDismissed).length;

  return {
    messages,
    unreadCount,
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


