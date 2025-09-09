// Hook for initializing game state on app startup
import { useEffect, useState } from 'react';
import { loadGameState } from '@/lib/database';
import { setGameState, getGameState } from '@/lib/gameState';

export const useGameInit = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeGame = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Try to load saved game state
        const savedState = await loadGameState();
        
        if (savedState) {
          setGameState(savedState);
        }
        // Game state is already initialized with default values
      } catch (err) {
        setError('Failed to load game state');
        // Continue with default state even if loading fails
      } finally {
        setIsLoading(false);
      }
    };

    initializeGame();
  }, []);

  return {
    isLoading,
    error,
    gameState: getGameState()
  };
};
