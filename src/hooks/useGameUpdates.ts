// Custom hook for triggering game state updates across components
import { useCallback } from 'react';

// Simple global state for triggering updates
const listeners = new Set<() => void>();
const topicListeners = new Map<string, Set<() => void>>();

// Debouncing state
let debounceTimeout: NodeJS.Timeout | null = null;
let pendingUpdate = false;

export const useGameUpdates = () => {
  const subscribe = useCallback((callback: () => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }, []);

  const subscribeTopic = useCallback((topic: string, callback: () => void) => {
    if (!topicListeners.has(topic)) {
      topicListeners.set(topic, new Set());
    }
    const set = topicListeners.get(topic)!;
    set.add(callback);
    return () => {
      const s = topicListeners.get(topic);
      if (s) {
        s.delete(callback);
        if (s.size === 0) topicListeners.delete(topic);
      }
    };
  }, []);

  return { subscribe, subscribeTopic };
};

// Global function to trigger updates from anywhere with debouncing
export const triggerGameUpdate = () => {
  pendingUpdate = true;
  
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  
  debounceTimeout = setTimeout(() => {
    if (pendingUpdate) {
      listeners.forEach(listener => listener());
      pendingUpdate = false;
    }
    debounceTimeout = null;
  }, 100); // 100ms debounce delay
};

// Immediate update function for critical operations
export const triggerGameUpdateImmediate = () => {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = null;
  }
  pendingUpdate = false;
  listeners.forEach(listener => listener());
};

// Scoped (topic) update triggers
export const triggerTopicUpdate = (topic: string) => {
  const set = topicListeners.get(topic);
  if (!set || set.size === 0) return;
  // fire immediately; topics are already scoped and cheap
  set.forEach(listener => listener());
};
