// Hook for initializing game state on app startup
import { useEffect, useState } from 'react';
import { loadGameState, getGameState } from '@/lib/gameState';
import { initializeStartingCapital } from '@/lib/services/financeService';
import { initializeCustomers } from '@/lib/services/sales/createCustomer';

export const useGameInit = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeGame = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Load game state (time/season data)
        await loadGameState();
        
        // Initialize starting capital in finance system (if new game)
        await initializeStartingCapital();
        
        // Initialize customers system (load existing or generate new)
        const gameState = getGameState();
        await initializeCustomers(gameState.prestige || 1);
        
        // Note: Vineyards and inventory are loaded separately by their components
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
