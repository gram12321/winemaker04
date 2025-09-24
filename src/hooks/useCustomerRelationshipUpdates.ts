// Hook to detect prestige changes and update customer relationships
import { useEffect, useRef } from 'react';
import { getCurrentPrestige, getCurrentCompany } from '../lib/services/core/gameState';
import { updateCustomerRelationshipsForPrestige } from '../lib/services/sales/createCustomer';
import { useGameUpdates } from './useGameUpdates';

/**
 * Hook that monitors prestige changes and updates customer relationships accordingly
 * Only updates relationships when prestige changes significantly (>5% or >1 point)
 * Now event-driven instead of polling - subscribes to game updates
 */
export function useCustomerRelationshipUpdates() {
  const lastPrestigeRef = useRef<number | null>(null);
  const isUpdatingRef = useRef(false);
  const { subscribe } = useGameUpdates();

  useEffect(() => {
    const checkPrestigeChanges = async () => {
      // Prevent multiple simultaneous updates
      if (isUpdatingRef.current) return;

      // Check if a company is active before checking prestige
      const currentCompany = getCurrentCompany();
      if (!currentCompany) {
        return; // No company active, skip prestige updates
      }

      try {
        const currentPrestige = await getCurrentPrestige();
        const lastPrestige = lastPrestigeRef.current;

        // Initialize on first run
        if (lastPrestige === null) {
          lastPrestigeRef.current = currentPrestige;
          return;
        }

        // Check if prestige changed significantly
        const prestigeDifference = Math.abs(currentPrestige - lastPrestige);
        const prestigeChangePercent = prestigeDifference / Math.max(lastPrestige, 1);

        // Update relationships if change is significant (>5% or >1 point)
        if (prestigeDifference > 1 || prestigeChangePercent > 0.05) {
          isUpdatingRef.current = true;
          
          console.log(`[Prestige] Significant change detected: ${lastPrestige.toFixed(2)} → ${currentPrestige.toFixed(2)}`);
          
          // Update customer relationships
          await updateCustomerRelationshipsForPrestige(currentPrestige);
          
          // Update reference
          lastPrestigeRef.current = currentPrestige;
          
          isUpdatingRef.current = false;
        }
      } catch (error) {
        console.error('Failed to check prestige changes:', error);
        isUpdatingRef.current = false;
      }
    };

    // Subscribe to game updates instead of polling
    const unsubscribe = subscribe(() => {
      checkPrestigeChanges();
    });

    // Initial check on mount
    checkPrestigeChanges();

    return () => {
      unsubscribe();
    };
  }, [subscribe]);
}
