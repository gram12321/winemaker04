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
 * Includes request deduplication so refreshes are coalesced, not dropped.
 */
export function useGameStateWithData<T>(
  loadData: () => Promise<T>,
  initialValue: T,
  options?: { topic?: string }
): T {
  const [data, setData] = useState<T>(initialValue);
  const { subscribe, subscribeTopic } = useGameUpdates();
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  // Request deduplication - prevent overlapping requests without dropping refreshes.
  const isLoadingRef = useRef(false);
  const pendingRefreshRef = useRef(false);

  const refreshData = useCallback(async () => {
    if (isLoadingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }

    do {
      pendingRefreshRef.current = false;
      isLoadingRef.current = true;

      try {
        // Check if we have an active company before loading data
        const currentCompany = getCurrentCompany();
        if (!currentCompany?.id) {
          return;
        }

        const newData = await loadDataRef.current();
        setData(newData);
      } catch (error) {
        console.error('Error loading async data:', error);
        // Keep existing data on error
      } finally {
        isLoadingRef.current = false;
      }
    } while (pendingRefreshRef.current);
  }, []);

  useEffect(() => {
    // Initial load
    refreshData();

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
