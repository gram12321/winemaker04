import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { InfoIcon, AlertTriangleIcon, XCircleIcon, CheckCircleIcon } from 'lucide-react';
import { toast } from "@/lib/ui/toast";

type MessageType = 'info' | 'warning' | 'error' | 'success';

export interface ConsoleMessage {
  id: string;
  timestamp: Date;
  text: string;
  type: MessageType;
}

interface ConsoleProps {
  showConsole?: boolean;
  onClose?: () => void;
  isOpen?: boolean;
}

// Create a singleton for managing console messages
let consoleMessages: ConsoleMessage[] = [];
let messageListeners: ((messages: ConsoleMessage[]) => void)[] = [];

// Function to notify all listeners of message changes
function notifyListeners() {
  messageListeners.forEach(listener => listener(consoleMessages));
  
  // Also save to localStorage
  localStorage.setItem('consoleMessages', JSON.stringify(consoleMessages));
}

// Load saved messages on initial script execution
try {
  // Initialize showConsole to true by default if not set
  if (localStorage.getItem('showConsole') === null) {
    localStorage.setItem('showConsole', 'true');
  }

  const savedMessages = localStorage.getItem('consoleMessages');
  if (savedMessages) {
    const parsedMessages = JSON.parse(savedMessages);
    // Convert string timestamps back to Date objects
    consoleMessages = parsedMessages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
  }
} catch (error) {
  console.error('Failed to parse saved console messages:', error);
}

// Console service - Global object to manage messages
export const consoleService = {
  // Get all messages
  getMessages() {
    return [...consoleMessages];
  },
  
  // Add a message
  addMessage(text: string, type: MessageType = 'info') {
    const message: ConsoleMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      text,
      type
    };
    
    // Add to messages array
    consoleMessages = [message, ...consoleMessages];
    
    // Notify listeners
    notifyListeners();
    
    // Show toast if enabled (default to true if not set)
    const showConsoleToasts = localStorage.getItem('showConsole') !== 'false';
    if (showConsoleToasts) {
      toast({
        title: type.charAt(0).toUpperCase() + type.slice(1),
        description: text,
        variant: type === 'error' ? 'destructive' : 'default',
      });
    }
    
    return message;
  },
  
  // Clear all messages
  clearMessages() {
    consoleMessages = [];
    localStorage.removeItem('consoleMessages');
    notifyListeners();
  },
  
  // Helper methods for different message types
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

export function Console({ showConsole = true, onClose, isOpen = false }: ConsoleProps) {
  const [messages, setMessages] = useState<ConsoleMessage[]>(consoleMessages);
  const [isHistoryOpen, setIsHistoryOpen] = useState(isOpen);
  
  // Load and subscribe to message changes
  useEffect(() => {
    const messageListener = (updatedMessages: ConsoleMessage[]) => {
      setMessages([...updatedMessages]);
    };
    
    messageListeners.push(messageListener);
    
    // Cleanup
    return () => {
      messageListeners = messageListeners.filter(l => l !== messageListener);
    };
  }, []);
  
  // Update history open state based on prop
  useEffect(() => {
    setIsHistoryOpen(isOpen);
  }, [isOpen]);

  const getIconForType = (type: MessageType) => {
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

  // Format timestamp as HH:MM:SS
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  const handleClose = () => {
    setIsHistoryOpen(false);
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Message History Dialog */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24">
          <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
          <Card className="z-50 w-full max-w-lg max-h-[80vh] overflow-hidden">
            <CardHeader>
              <CardTitle>Message History</CardTitle>
              <CardDescription>Recent game updates and notifications</CardDescription>
            </CardHeader>
            <ScrollArea className="h-[50vh]">
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No messages yet</p>
                ) : (
                  <div className="space-y-3">
                    {messages.slice().reverse().map((message) => (
                      <div 
                        key={message.id} 
                        className={`p-3 rounded-md border flex items-start gap-2 ${
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
                            <Badge variant="outline" className="mb-1">
                              {formatTime(message.timestamp)}
                            </Badge>
                          </div>
                          <p>{message.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </ScrollArea>
            <CardFooter className="border-t px-6 py-4">
              <Button variant="outline" onClick={handleClose} className="w-full">
                Close
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}

// Simpler hook for components that need console access
export function useConsole() {
  const [messages, setMessages] = useState<ConsoleMessage[]>(consoleMessages);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Subscribe to message changes
  useEffect(() => {
    const messageListener = (updatedMessages: ConsoleMessage[]) => {
      setMessages([...updatedMessages]);
    };
    
    messageListeners.push(messageListener);
    
    // Cleanup
    return () => {
      messageListeners = messageListeners.filter(l => l !== messageListener);
    };
  }, []);
  
  const openHistory = () => {
    setIsHistoryOpen(true);
  };
  
  const closeHistory = () => {
    setIsHistoryOpen(false);
  };
  
  return {
    messages,
    isHistoryOpen,
    openHistory,
    closeHistory,
    addMessage: consoleService.addMessage.bind(consoleService),
    clearMessages: consoleService.clearMessages.bind(consoleService),
    info: consoleService.info.bind(consoleService),
    warning: consoleService.warning.bind(consoleService),
    error: consoleService.error.bind(consoleService),
    success: consoleService.success.bind(consoleService)
  };
} 