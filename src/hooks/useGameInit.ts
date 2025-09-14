// Hook for initializing game state on app startup
import { useEffect, useState } from 'react';
import { getCurrentPrestige } from '@/lib/services/gameState';
import { initializeCustomers } from '@/lib/services/sales/createCustomer';

export const useGameInit = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeGame = async () => {
      try {
        setError(null);
        
        // Game state is now loaded automatically when companies are set
        
        // Initialize starting capital in finance system (if new game and company is active)
        // This will be called when a company is selected, not here
        
        // Initialize customers system (load existing or generate new)
        const currentPrestige = await getCurrentPrestige();
        await initializeCustomers(currentPrestige);
        
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
    error
  };
};
