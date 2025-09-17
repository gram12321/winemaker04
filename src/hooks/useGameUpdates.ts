// Custom hook for triggering game state updates across components
import { useCallback } from 'react';

// Simple global state for triggering updates
const listeners = new Set<() => void>();

// Debouncing state
let debounceTimeout: NodeJS.Timeout | null = null;
let pendingUpdate = false;

export const useGameUpdates = () => {
  const subscribe = useCallback((callback: () => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }, []);

  return { subscribe };
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
