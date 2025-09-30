import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter, Button, Badge, ScrollArea } from "../ui";
import { InfoIcon, AlertTriangleIcon, XCircleIcon, CheckCircleIcon } from 'lucide-react';
import { toast } from "@/lib/utils/toast";
import { formatTime } from "@/lib/utils/utils";
import { saveNotification, loadNotifications, clearNotifications as clearNotificationsFromDb, DbNotificationType } from "@/lib/database/core/notificationsDB";

type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface PlayerNotification {
  id: string;
  timestamp: Date;
  text: string;
  type: NotificationType;
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

  return (
    <>
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24">
          <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
          <Card className="z-50 w-[95%] max-w-lg max-h-[90vh] sm:max-h-[80vh] overflow-hidden">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl">Notifications</CardTitle>
              <CardDescription>Recent game updates and messages</CardDescription>
            </CardHeader>
            <ScrollArea className="h-[40vh] md:h-[50vh]">
              <CardContent className="p-3 md:p-4">
                {messages.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No notifications</p>
                ) : (
                  <div className="space-y-3">
                    {messages.slice().reverse().map((message) => (
                      <div
                        key={message.id}
                        className={`p-2 md:p-3 rounded-md border flex items-start gap-2 text-sm md:text-base ${
                          message.type === 'error'
                            ? 'bg-red-50 border-red-200'
                            : message.type === 'warning'
                              ? 'bg-yellow-50 border-yellow-200'
                              : message.type === 'success'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="mt-0.5">{getIconForType(message.type)}</div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <Badge variant="outline" className="mb-1 text-xs md:text-sm">
                              {formatTime(message.timestamp)}
                            </Badge>
                          </div>
                          <p className="break-words">{message.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </ScrollArea>
            <CardFooter className="border-t p-3 md:px-6 md:py-4">
              <div className="w-full flex justify-end">
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
    info: notificationService.info.bind(notificationService),
    warning: notificationService.warning.bind(notificationService),
    error: notificationService.error.bind(notificationService),
    success: notificationService.success.bind(notificationService)
  };
}


