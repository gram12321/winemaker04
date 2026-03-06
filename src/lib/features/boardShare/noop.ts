import { calculateInitialShareCount } from '@/lib/constants/financeConstants';
import { getGameState } from '@/lib/services/core/gameState';
import type { BoardShareFeature } from './contracts';

export const noBoardShareFeature: BoardShareFeature = {
  ticks: {
    async onWeekAdvanced() {},
    async onSeasonStart() {},
    async onYearStart() {}
  },

  constraints: {
    async checkVineyardPurchase(input) {
      if (input.purchaseAmount > input.currentMoney) {
        return {
          allowed: false,
          errorMessage: 'Insufficient funds for this vineyard purchase.'
        };
      }

      return { allowed: true };
    },

    async checkStaffHiring() {
      return { allowed: true };
    },

    async getVineyardPurchaseConstraintInfo() {
      const currentBalance = getGameState().money || 0;
      const isBlocked = currentBalance <= 0;

      return {
        isBlocked,
        isLimited: false,
        limitingConstraint: isBlocked ? 'hard' : 'none',
        constraintReason: isBlocked ? 'Insufficient funds' : 'No constraints',
        maxAmount: Math.max(0, currentBalance),
        hardLimit: Math.max(0, currentBalance),
        boardLimit: null,
        currentBalance
      };
    }
  },

  starting: {
    getCompanyCreationOwnership(input) {
      const totalCapital = Math.max(1, input.fixedPlayerInvestment);
      const totalShares = calculateInitialShareCount(totalCapital);

      return {
        totalShares,
        outstandingShares: 0,
        playerShares: totalShares,
        initialOwnershipPct: 100
      };
    },

    getStartingOwnership(input) {
      const totalContributions = Math.max(1, input.playerCashContribution);
      const totalShares = calculateInitialShareCount(totalContributions);

      return {
        totalContributions,
        playerOwnershipPct: 100,
        totalShares,
        outstandingShares: 0,
        playerShares: totalShares,
        familyShares: 0,
        outsideShares: 0
      };
    }
  },

  ui: {
    getFinanceTabs: () => [],
    getWinepediaTabs: () => []
  }
};
