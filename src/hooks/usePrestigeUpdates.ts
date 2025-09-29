// Unified hook to handle all prestige updates (company and vineyard)
import { useEffect, useRef } from 'react';
import { getGameState, getCurrentCompany } from '../lib/services/core/gameState';
import { updateBasePrestigeEvent } from '../lib/services/prestige/prestigeService';
import { decayPrestigeEventsOneWeek, decayRelationshipBoostsOneWeek } from '../lib/services/prestige/prestigeDecayService';
import { useGameUpdates } from './useGameUpdates';

/**
 * Unified hook that monitors all prestige-affecting changes and updates prestige events accordingly
 * 
 * Company Prestige Updates:
 * - Company value changes (currently watches money; can be extended to total assets/net worth)
 * - Weekly decay (monitors time changes and applies decay to all decaying events)
 *
 * Vineyard base prestige is updated directly by domain logic
 * (planting/harvest in services and aging in newYear()), so no
 * vineyard monitoring is needed here.
 */
export function usePrestigeUpdates() {
  const lastCompanyMoneyRef = useRef<number | null>(null);
  const lastWeekRef = useRef<number | null>(null);
  const lastSeasonRef = useRef<string | null>(null);
  const lastYearRef = useRef<number | null>(null);
  const isUpdatingRef = useRef(false);
  const { subscribe } = useGameUpdates();

  useEffect(() => {
    const checkPrestigeChanges = async () => {
      // Prevent multiple simultaneous updates
      if (isUpdatingRef.current) return;

      // Check if a company is active
      const currentCompany = getCurrentCompany();
      if (!currentCompany) {
        return; // No company active, skip prestige updates
      }

      try {
        isUpdatingRef.current = true;

        // === COMPANY PRESTIGE UPDATES ===
        const gameState = getGameState();
        const currentMoney = gameState.money || 0;
        const currentWeek = gameState.week || 1;
        const currentSeason = gameState.season || 'Spring';
        const currentYear = gameState.currentYear || 2023;

        // Check if company money changed (affects company value prestige)
        if (lastCompanyMoneyRef.current === null) {
          // Initialize on first run
          lastCompanyMoneyRef.current = currentMoney;
        } else if (currentMoney !== lastCompanyMoneyRef.current) {
          
          // Update company value prestige with logarithmic scaling
          const companyValuePrestige = Math.log(currentMoney / 1000000 + 1) * 2;
          await updateBasePrestigeEvent(
            'company_value',
            'company_money',
            companyValuePrestige,
            `Company value: €${currentMoney.toLocaleString()}`
          );
          
          lastCompanyMoneyRef.current = currentMoney;
        }

        // Check for week changes (triggers weekly decay)
        if (lastWeekRef.current === null || lastSeasonRef.current === null || lastYearRef.current === null) {
          // Initialize on first run
          lastWeekRef.current = currentWeek;
          lastSeasonRef.current = currentSeason;
          lastYearRef.current = currentYear;
        } else if (currentWeek !== lastWeekRef.current || currentSeason !== lastSeasonRef.current || currentYear !== lastYearRef.current) {
          
          // Apply weekly decay to prestige events and relationship boosts
          try {
            await decayPrestigeEventsOneWeek();
            await decayRelationshipBoostsOneWeek();
          } catch (error) {
            console.error('Failed to apply weekly decay:', error);
          }
          
          lastWeekRef.current = currentWeek;
          lastSeasonRef.current = currentSeason;
          lastYearRef.current = currentYear;
        }

        // Sales prestige events are handled by direct calls in salesService.ts
        // No need to monitor sales here to avoid duplicates

        // Vineyard base prestige updates are handled by domain actions
        // (planting/harvest/newYear). Nothing for the hook to do here.

        isUpdatingRef.current = false;
      } catch (error) {
        console.error('Failed to check prestige changes:', error);
        isUpdatingRef.current = false;
      }
    };

    // Subscribe to game updates
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
