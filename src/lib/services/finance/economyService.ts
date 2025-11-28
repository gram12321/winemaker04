import { EconomyPhase } from '../../types/types';
import { ECONOMY_TRANSITION, ECONOMY_PHASES } from '../../constants/economyConstants';
import { updateGameState } from '../core/gameState';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { updateMarketValue } from './shareValuationService';

/**
 * Calculate the next economy phase based on semi-random transitions
 * Edge phases (Crash, Boom) have 33% chance to shift, 67% to stay
 * Middle phases (Recession, Stable, Expansion) have 25% chance each direction, 50% to stay
 */
export function calculateNextEconomyPhase(currentPhase: EconomyPhase): EconomyPhase {
  const currentIndex = ECONOMY_PHASES.indexOf(currentPhase);
  const isEdge = currentIndex === 0 || currentIndex === 4; // Crash or Boom

  const prob = isEdge ? ECONOMY_TRANSITION.EDGE_PHASES : ECONOMY_TRANSITION.MIDDLE_PHASES;
  const roll = Math.random();

  if (roll < prob.SHIFT_PROBABILITY) {
    // Shift left (toward Crash)
    return ECONOMY_PHASES[Math.max(0, currentIndex - 1)];
  } else if (roll < prob.SHIFT_PROBABILITY * 2) {
    // Shift right (toward Boom)
    return ECONOMY_PHASES[Math.min(4, currentIndex + 1)];
  } else {
    // Stay in current phase
    return currentPhase;
  }
}

/**
 * Initialize economy phase to 'Stable' for new companies
 */
export function initializeEconomyPhase(): EconomyPhase {
  return 'Stable';
}

/**
 * Process economy phase transition and update game state
 * Called during season changes
 * @param skipNotification If true, returns notification text instead of sending it
 * @returns Notification message text if phase changed (and skipNotification is true), null otherwise
 */
export async function processEconomyPhaseTransition(skipNotification: boolean = false): Promise<string | null> {
  try {
    const { getGameState } = await import('../core/gameState');
    const currentState = getGameState();
    const currentPhase = currentState.economyPhase;
    if (!currentPhase) {
      // No economy phase present; nothing to transition yet
      return null;
    }

    const newPhase = calculateNextEconomyPhase(currentPhase);

    if (newPhase !== currentPhase) {
      await updateGameState({ economyPhase: newPhase });

      // Economy phase changes affect expected values, which naturally adjust deltas
      // Share price adjusts incrementally on next tick - no jump needed

      // Prepare notification for phase change
      const phaseDescriptions = {
        'Crash': 'Economic crisis with high interest rates',
        'Recession': 'Economic downturn with elevated rates',
        'Stable': 'Stable economic conditions',
        'Expansion': 'Growing economy with favorable rates',
        'Boom': 'Economic boom with low interest rates'
      };

      const message = `Economy phase changed to ${newPhase}: ${phaseDescriptions[newPhase]}`;

      if (skipNotification) {
        return message;
      } else {
        await notificationService.addMessage(
          message,
          'economy.phaseChange',
          'Economy Update',
          NotificationCategory.FINANCE_AND_STAFF
        );
      }
    }
    return null;
  } catch (error) {
    console.error('Error processing economy phase transition:', error);
    return null;
  }
}
