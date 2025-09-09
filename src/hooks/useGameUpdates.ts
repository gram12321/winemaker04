// Custom hook for triggering game state updates across components
import { useState, useCallback } from 'react';

// Simple global state for triggering updates
let updateCounter = 0;
const listeners = new Set<() => void>();

export const useGameUpdates = () => {
  const [, forceUpdate] = useState(0);

  const triggerUpdate = useCallback(() => {
    updateCounter++;
    forceUpdate(updateCounter);
    // Notify all listeners
    listeners.forEach(listener => listener());
  }, []);

  const subscribe = useCallback((callback: () => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }, []);

  return { triggerUpdate, subscribe };
};

// Global function to trigger updates from anywhere
export const triggerGameUpdate = () => {
  updateCounter++;
  listeners.forEach(listener => listener());
};
