// Hook for initializing game state on app startup
import { useEffect, useRef, useState } from 'react';
import { getCurrentPrestige, getCurrentCompany } from '@/lib/services/gameState';
import { initializeCustomers } from '@/lib/services/sales/createCustomer';

export const useGameInit = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const initializeGame = async () => {
      try {
        setError(null);
        
        // Check if a company is active before initializing
        const currentCompany = getCurrentCompany();
        if (!currentCompany) {
          // No company active, skip initialization
          setIsLoading(false);
          return;
        }
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;
        
        // Initialize customers system (load existing or generate new)
        const currentPrestige = await getCurrentPrestige();
        await initializeCustomers(currentPrestige);
        
        // Note: Vineyards and inventory are loaded separately by their components
      } catch (err) {
        console.error('Game initialization error:', err);
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
