// Custom hook for triggering game state updates across components
import { useCallback } from 'react';

// Simple global state for triggering updates
const listeners = new Set<() => void>();

export const useGameUpdates = () => {
  const subscribe = useCallback((callback: () => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }, []);

  return { subscribe };
};

// Global function to trigger updates from anywhere
export const triggerGameUpdate = () => {
  listeners.forEach(listener => listener());
};
