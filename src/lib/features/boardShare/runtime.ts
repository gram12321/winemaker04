import { getCompanyShares } from '@/lib/database/core/companySharesDB';
import { calculateInitialShareCount } from '@/lib/constants/financeConstants';
import { boardEnforcer, getVineyardPurchaseConstraintInfo } from '@/lib/services/board/boardEnforcer';
import { getBoardSatisfactionBreakdown } from '@/lib/services/board/boardSatisfactionService';
import { updateGrowthTrend } from '@/lib/services/finance/shares/growthTrendService';
import { payDividends } from '@/lib/services/finance/shares/shareOperationsService';
import { adjustSharePriceIncrementally } from '@/lib/services/finance/shares/sharePriceService';
import { getCurrentCompany } from '@/lib/services/core/gameState';
import { formatNumber } from '@/lib/utils';
import type { BoardShareRuntimeFeature } from './contracts';

export const activeBoardShareRuntimeFeature: BoardShareRuntimeFeature = {
  ticks: {
    async onWeekAdvanced() {
      try {
        await adjustSharePriceIncrementally();
      } catch (error) {
        console.warn('Error during incremental share price adjustment:', error);
      }

      try {
        const company = await getCurrentCompany();
        if (!company) return;

        const shares = await getCompanyShares(company.id);
        if (shares && shares.outstandingShares > 0) {
          void getBoardSatisfactionBreakdown(true).catch((err) =>
            console.warn('Error storing board satisfaction snapshot:', err)
          );
        }
      } catch (error) {
        console.warn('Error checking company shares for board satisfaction:', error);
      }
    },

    async onSeasonStart() {
      try {
        const result = await payDividends();
        if (result.success) return;

        if (result.error === 'Insufficient funds to pay dividends') return;
        if (result.error === 'Dividend rate is not set or is zero') return;
      } catch (error) {
        console.warn('Error automatically paying dividends:', error);
      }
    },

    async onYearStart() {
      try {
        await updateGrowthTrend();
      } catch (error) {
        console.error('Error updating growth trend on new year:', error);
      }
    }
  },

  constraints: {
    async checkVineyardPurchase(input) {
      const financialContext = {
        cashMoney: input.currentMoney,
        totalAssets: input.totalAssets,
        fixedAssets: input.fixedAssets,
        currentAssets: input.currentAssets,
        expensesPerSeason: input.expensesPerSeason,
        profitMargin: input.profitMargin
      };

      const boardLimit = await boardEnforcer.getActionLimit(
        'vineyard_purchase',
        input.currentMoney,
        financialContext
      );

      if (boardLimit && boardLimit.limit !== null) {
        if (input.purchaseAmount > boardLimit.limit) {
          return {
            allowed: false,
            errorMessage: `Purchase amount (${formatNumber(input.purchaseAmount, { currency: true })}) exceeds board-approved limit (${formatNumber(boardLimit.limit, { currency: true })}). Board satisfaction: ${(boardLimit.satisfaction * 100).toFixed(1)}%`
          };
        }
      } else {
        const boardCheck = await boardEnforcer.isActionAllowed(
          'vineyard_purchase',
          input.purchaseAmount,
          financialContext
        );
        if (!boardCheck.allowed) {
          return {
            allowed: false,
            errorMessage:
              boardCheck.message ||
              'Board approval required for vineyard purchases. Your purchase exceeds the approved budget limit.'
          };
        }
      }

      return { allowed: true };
    },

    async checkStaffHiring(input) {
      const boardCheck = await boardEnforcer.isActionAllowed('staff_hiring', undefined);
      if (!boardCheck.allowed) {
        return {
          allowed: false,
          errorMessage:
            boardCheck.message ||
            `Board approval required to hire ${input.candidateName}. Board satisfaction is too low to approve new staff hires.`
        };
      }

      return { allowed: true };
    },

    async getVineyardPurchaseConstraintInfo() {
      return getVineyardPurchaseConstraintInfo();
    }
  },

  starting: {
    getCompanyCreationOwnership(input) {
      const totalCapital = input.fixedPlayerInvestment + input.outsideInvestment;
      const initialOwnershipPct =
        totalCapital > 0 ? (input.fixedPlayerInvestment / totalCapital) * 100 : 100;
      const totalShares = calculateInitialShareCount(totalCapital);
      const playerShares = Math.round(totalShares * (initialOwnershipPct / 100));
      const outstandingShares = totalShares - playerShares;

      return {
        totalShares,
        outstandingShares,
        playerShares,
        initialOwnershipPct
      };
    },

    getStartingOwnership(input) {
      const totalContributions =
        input.playerCashContribution + input.familyContribution + input.outsideInvestment;
      const playerOwnershipPct =
        totalContributions > 0 ? (input.playerCashContribution / totalContributions) * 100 : 100;
      const totalShares = calculateInitialShareCount(totalContributions);
      const playerShares = Math.round(totalShares * (playerOwnershipPct / 100));
      const outstandingShares = totalShares - playerShares;

      const totalNonPlayerEquity = input.familyContribution + input.outsideInvestment;
      let familyShares = 0;
      let outsideShares = outstandingShares;
      if (totalNonPlayerEquity > 0 && outstandingShares > 0) {
        familyShares = Math.round(outstandingShares * (input.familyContribution / totalNonPlayerEquity));
        outsideShares = outstandingShares - familyShares;
      }

      return {
        totalContributions,
        playerOwnershipPct,
        totalShares,
        outstandingShares,
        playerShares,
        familyShares,
        outsideShares
      };
    }
  }
};
