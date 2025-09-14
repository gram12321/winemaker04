// Custom hook for reactive game state management with async data loading
import { useState, useEffect, useCallback } from 'react';
import { getGameState } from '@/lib/services/gameState';
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
 */
export function useGameStateWithData<T>(
  loadData: () => Promise<T>,
  initialValue: T
): T {
  const [data, setData] = useState<T>(initialValue);
  const { subscribe } = useGameUpdates();

  const refreshData = useCallback(async () => {
    try {
      const newData = await loadData();
      setData(newData);
    } catch (error) {
      console.error('Error loading async data:', error);
      // Keep existing data on error
    }
  }, [loadData]);

  useEffect(() => {
    // Initial load
    refreshData();

    // Subscribe to global updates
    const unsubscribe = subscribe(() => {
      refreshData();
    });

    return () => {
      unsubscribe();
    };
  }, [refreshData, subscribe]);

  return data;
};
