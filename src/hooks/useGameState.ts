// Custom hook for reactive game state management with async data loading
import { useState, useEffect, useCallback, useRef } from 'react';
import { getGameState, getCurrentCompany } from '@/lib/services';
import { useGameUpdates } from './useGameUpdates';

export const useGameState = () => {
  const [gameState, setGameState] = useState(() => getGameState());
  const { subscribe } = useGameUpdates();

  useEffect(() => {
    // Subscribe to updates
    const unsubscribe = subscribe(() => {
      // Always get fresh state when updates are triggered
      setGameState(getGameState());
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  return gameState;
};

/**
 * Enhanced useGameState with async data loading capabilities
 * Replaces useAsyncData by combining game state with async data loading
 * Now includes request deduplication and caching to prevent spam
 */
export function useGameStateWithData<T>(
  loadData: () => Promise<T>,
  initialValue: T,
  options?: { topic?: string }
): T {
  const [data, setData] = useState<T>(initialValue);
  const { subscribe, subscribeTopic } = useGameUpdates();

  // Request deduplication - prevent multiple simultaneous requests
  const isLoadingRef = useRef(false);
  const lastLoadTime = useRef(0);
  const CACHE_DURATION = 500; // Fixed 200ms cache to reduce egress

  const refreshData = useCallback(async () => {
    try {
      // Check if we have an active company before loading data
      const currentCompany = getCurrentCompany();
      if (!currentCompany?.id) {
        return;
      }

      // Prevent duplicate requests
      if (isLoadingRef.current) {
        return;
      }

      // Use cache if data was loaded recently
      const now = Date.now();
      if (now - lastLoadTime.current < CACHE_DURATION) {
        return;
      }

      isLoadingRef.current = true;
      lastLoadTime.current = now;

      const newData = await loadData();
      setData(newData);
    } catch (error) {
      console.error('Error loading async data:', error);
      // Keep existing data on error
    } finally {
      isLoadingRef.current = false;
    }
  }, [loadData]);

  useEffect(() => {
    // Initial load
    refreshData();

    // Subscribe either to topic-scoped updates or global updates
    const unsubscribe = options?.topic
      ? subscribeTopic(options.topic, () => {
          refreshData();
        })
      : subscribe(() => {
          refreshData();
        });

    return () => {
      unsubscribe();
    };
  }, [refreshData, subscribe, subscribeTopic, options?.topic]);

  return data;
};
