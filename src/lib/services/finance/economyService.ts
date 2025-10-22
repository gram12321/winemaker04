import { EconomyPhase } from '../../types/types';
import { ECONOMY_TRANSITION, ECONOMY_PHASES } from '../../constants/economyConstants';
import { updateGameState } from '../core/gameState';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';

/**
 * Calculate the next economy phase based on semi-random transitions
 * Edge phases (Crash, Boom) have 33% chance to shift, 67% to stay
 * Middle phases (Recovery, Expansion) have 25% chance each direction, 50% to stay
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
 * Initialize economy phase to 'Recovery' for new companies
 */
export function initializeEconomyPhase(): EconomyPhase {
  return 'Recovery';
}

/**
 * Process economy phase transition and update game state
 * Called during season changes
 */
export async function processEconomyPhaseTransition(): Promise<void> {
  try {
    const { getGameState } = await import('../core/gameState');
    const currentState = getGameState();
    const currentPhase = currentState.economyPhase || 'Recovery';
    
    const newPhase = calculateNextEconomyPhase(currentPhase);
    
    if (newPhase !== currentPhase) {
      await updateGameState({ economyPhase: newPhase });
      
      // Add notification for phase change
      const phaseDescriptions = {
        'Crash': 'Economic crisis with high interest rates',
        'Recession': 'Economic downturn with elevated rates',
        'Recovery': 'Stable economic conditions',
        'Expansion': 'Growing economy with favorable rates',
        'Boom': 'Economic boom with low interest rates'
      };
      
      await notificationService.addMessage(
        `Economy phase changed to ${newPhase}: ${phaseDescriptions[newPhase]}`,
        'economy.phaseChange',
        'Economy Update',
        NotificationCategory.FINANCE
      );
    }
  } catch (error) {
    console.error('Error processing economy phase transition:', error);
  }
}
