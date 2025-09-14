// Custom hook for reactive game state management
import { useState, useEffect } from 'react';
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
