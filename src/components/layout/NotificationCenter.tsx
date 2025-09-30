import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter, Button, Badge, ScrollArea } from "../ui";
import { InfoIcon, AlertTriangleIcon, XCircleIcon, CheckCircleIcon, X, Trash2, Eye } from 'lucide-react';
import { toast } from "@/lib/utils/toast";
import { formatTime } from "@/lib/utils/utils";
import { saveNotification, loadNotifications, clearNotifications as clearNotificationsFromDb, DbNotificationType } from "@/lib/database/core/notificationsDB";

type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface PlayerNotification {
  id: string;
  timestamp: Date;
  text: string;
  type: NotificationType;
  isRead?: boolean;
  isDismissed?: boolean;
}

interface NotificationCenterProps {
  onClose?: () => void;
  isOpen?: boolean;
}

let notifications: PlayerNotification[] = [];
let listeners: ((messages: PlayerNotification[]) => void)[] = [];
let hasLoadedFromDb = false;

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
      timestamp: new Date(r.timestamp),
      text: r.text,
      type: r.type as NotificationType
    }));
    hasLoadedFromDb = true;
    notifyListeners();
  } catch {
    // Non-critical
  }
}

export const notificationService = {
  getMessages() {
    return [...notifications];
  },

  addMessage(text: string, type: NotificationType = 'info') {
    const id = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date();
    const message: PlayerNotification = {
      id,
      timestamp: now,
      text,
      type
    };

    notifications = [message, ...notifications];
    notifyListeners();

    // Persist to DB (best-effort)
    saveNotification({
      id,
      timestamp: now.toISOString(),
      text,
      type: type as DbNotificationType
    });

    const showToasts = localStorage.getItem('showNotifications') !== 'false';
    if (showToasts) {
      toast({
        title: type.charAt(0).toUpperCase() + type.slice(1),
        description: text,
        variant: type === 'error' ? 'destructive' : 'default',
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

  info(text: string) {
    return this.addMessage(text, 'info');
  },
  warning(text: string) {
    return this.addMessage(text, 'warning');
  },
  error(text: string) {
    return this.addMessage(text, 'error');
  },
  success(text: string) {
    return this.addMessage(text, 'success');
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

  const getIconForType = (type: NotificationType) => {
    switch (type) {
      case 'info':
        return <InfoIcon className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangleIcon className="h-4 w-4" />;
      case 'error':
        return <XCircleIcon className="h-4 w-4" />;
      case 'success':
        return <CheckCircleIcon className="h-4 w-4" />;
      default:
        return <InfoIcon className="h-4 w-4" />;
    }
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

  // Filter and sort notifications
  const filteredMessages = messages
    .filter(msg => !msg.isDismissed)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const recentMessages = showAll ? filteredMessages : filteredMessages.slice(0, 5);
  const unreadCount = filteredMessages.filter(msg => !msg.isRead).length;

  // Check if notification is old (more than 1 hour)
  const isOldNotification = (timestamp: Date) => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return timestamp < oneHourAgo;
  };

  return (
    <>
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-4 sm:items-start sm:pt-16 sm:pb-0">
          <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
          <Card className="z-50 w-[95%] max-w-lg max-h-[90vh] sm:max-h-[80vh] overflow-hidden">
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
                      const isOld = isOldNotification(message.timestamp);
                      const isUnread = !message.isRead;
                      
                      return (
                        <div
                          key={message.id}
                          className={`p-2 md:p-3 rounded-md border flex items-start gap-2 text-sm md:text-base transition-all ${
                            message.type === 'error'
                              ? 'bg-red-50 border-red-200'
                              : message.type === 'warning'
                                ? 'bg-yellow-50 border-yellow-200'
                                : message.type === 'success'
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-blue-50 border-blue-200'
                          } ${isOld ? 'opacity-60' : ''} ${isUnread ? 'ring-2 ring-blue-200' : ''}`}
                        >
                          <div className="mt-0.5">{getIconForType(message.type)}</div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <Badge 
                                variant="outline" 
                                className={`mb-1 text-xs md:text-sm ${isUnread ? 'bg-blue-100' : ''}`}
                              >
                                {formatTime(message.timestamp)}
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
    info: notificationService.info.bind(notificationService),
    warning: notificationService.warning.bind(notificationService),
    error: notificationService.error.bind(notificationService),
    success: notificationService.success.bind(notificationService)
  };
}


