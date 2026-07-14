import { v4 as uuidv4 } from 'uuid';
import { loadWineBatches } from '../../database/activities/inventoryDB';
import {
  deliverForwardContractInventory,
  getForwardContractById,
  getOpenForwardContracts,
  loadForwardContracts,
  saveForwardContract,
  updateForwardContract,
} from '../../database/sales/forwardContractDB';
import { FORWARD_CONTRACT_CONFIG, CONTRACT_PRESTIGE_CONFIG } from '../../constants/contractConstants';
import { TRANSACTION_CATEGORIES } from '../../constants/financeConstants';
import { getGameState, getCurrentPrestige } from '../core/gameState';
import { NormalizeScrewed1000To01WithTail } from '../../utils/calculator';
import { addTransaction, syncPersistedTransaction } from '../finance/financeService';
import { calculateCompanyValue } from '../finance/financeService';
import { notificationService } from '../core/notificationService';
import { NotificationCategory, getNextSeasonDate, getRandomFromArray, randomInt } from '../../utils';
import { getAvailableBuyers } from './sellGrapesService';
import { addContractOutcomePrestigeEvent } from '../prestige/prestigeService';
import { recordBuyerSale } from './grapeBuyerLoyaltyService';
import { triggerGameUpdate, triggerTopicUpdate } from '@/hooks/useGameUpdates';
import { GrapeForwardContract, ForwardTargetState, Season } from '../../types/types';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

function getCurrentDate() {
  const gameState = getGameState();
  return {
    week: gameState.week || 1,
    season: (gameState.season || 'Spring') as Season,
    year: gameState.currentYear || 2024,
  };
}

function isDateAfter(
  current: { week: number; season: Season; year: number },
  due: { week: number; season: Season; year: number }
): boolean {
  if (current.year !== due.year) return current.year > due.year;
  const seasonOrder: Season[] = ['Spring', 'Summer', 'Fall', 'Winter'];
  const currentSeasonIdx = seasonOrder.indexOf(current.season);
  const dueSeasonIdx = seasonOrder.indexOf(due.season);
  if (currentSeasonIdx !== dueSeasonIdx) return currentSeasonIdx > dueSeasonIdx;
  return current.week > due.week;
}

function computeForwardContractQuantity(prestigeNormalized: number): number {
  const base = randomInt(FORWARD_CONTRACT_CONFIG.minQuantityKg, 900);
  const multiplier = Math.min(
    1 + prestigeNormalized,
    FORWARD_CONTRACT_CONFIG.prestigeSizeMultiplierCap
  );
  return Math.max(
    FORWARD_CONTRACT_CONFIG.minQuantityKg,
    Math.min(FORWARD_CONTRACT_CONFIG.maxQuantityKg, Math.round(base * multiplier))
  );
}

function computeForwardCompanyValueSizeMultiplier(companyValue: number): number {
  if (companyValue <= 0) return 1;
  // Mirror bulk market company value scaling curve for offer size pressure.
  const normalized = Math.max(0, Math.log10(Math.max(10000, companyValue)) - 4);
  return Math.min(2.1, 1 + normalized * 0.45);
}

function computeForwardQuantityForBuyer(
  prestigeNormalized: number,
  companyValue: number,
  buyerSeasonLimitKg?: number
): number {
  const baseQuantity = computeForwardContractQuantity(prestigeNormalized);
  const companyValueMultiplier = computeForwardCompanyValueSizeMultiplier(companyValue);
  const buyerLimit = Math.max(FORWARD_CONTRACT_CONFIG.minQuantityKg, buyerSeasonLimitKg || FORWARD_CONTRACT_CONFIG.maxQuantityKg);
  const buyerLimitMultiplier = Math.max(0.6, Math.min(1.8, buyerLimit / 1800));

  return Math.max(
    FORWARD_CONTRACT_CONFIG.minQuantityKg,
    Math.min(
      FORWARD_CONTRACT_CONFIG.maxQuantityKg,
      Math.round(baseQuantity * companyValueMultiplier * buyerLimitMultiplier)
    )
  );
}

function computeForwardPricePerUnit(input: {
  targetState: ForwardTargetState;
  prestigeNormalized: number;
  buyerMultiplier: number;
  marketContextMultiplier?: number;
  marketSensitivityMultiplier?: number;
  relationshipMultiplier?: number;
}): number {
  const base = input.targetState === 'bottled'
    ? 4.6 + Math.random() * 4.4
    : 2.2 + Math.random() * 2.3;
  const prestigeBonus = 1 + input.prestigeNormalized * 0.3;

  const final = base
    * Math.max(0.8, input.buyerMultiplier)
    * (input.marketContextMultiplier ?? 1)
    * (input.marketSensitivityMultiplier ?? 1)
    * (input.relationshipMultiplier ?? 1)
    * prestigeBonus;

  return Math.round(final * 100) / 100;
}

export async function generateForwardContracts(): Promise<number> {
  try {
    const openContracts = await getOpenForwardContracts();
    if (openContracts.length >= FORWARD_CONTRACT_CONFIG.maxActiveOpenContracts) {
      return 0;
    }

    const prestige = await getCurrentPrestige();
    const prestigeNormalized = NormalizeScrewed1000To01WithTail(prestige);
    const generationChance = Math.min(
      FORWARD_CONTRACT_CONFIG.baseGenerationChance * (1 + prestigeNormalized),
      FORWARD_CONTRACT_CONFIG.baseGenerationChance * FORWARD_CONTRACT_CONFIG.prestigeOfferCountMultiplierCap
    );

    if (Math.random() > generationChance) {
      return 0;
    }

    const buyers = await getAvailableBuyers();
    if (buyers.length === 0) return 0;
    const buyer = getRandomFromArray(buyers);
    const companyValue = await calculateCompanyValue().catch(() => 0);

    const createdAt = getCurrentDate();
    const due = getNextSeasonDate(createdAt.season, createdAt.year);

    const targetStates: ForwardTargetState[] = ['grapes', 'must_ready', 'must_fermenting', 'bottled', 'any'];
    const targetState = getRandomFromArray(targetStates);

    const quantityKg = computeForwardQuantityForBuyer(
      prestigeNormalized,
      companyValue,
      buyer.remainingSeasonLimitKg
    );
    const unitPricePerKg = computeForwardPricePerUnit({
      targetState,
      prestigeNormalized,
      buyerMultiplier: buyer.priceMultiplier || 1,
      marketContextMultiplier: buyer.marketContextMultiplier,
      marketSensitivityMultiplier: buyer.marketSensitivityMultiplier,
      relationshipMultiplier: buyer.relationshipMultiplier,
    });
    const totalValue = Math.round(quantityKg * unitPricePerKg * 100) / 100;
    const upfrontPaidAmount = Math.round(totalValue * FORWARD_CONTRACT_CONFIG.upfrontPercent * 100) / 100;
    const finalPaymentAmount = Math.round((totalValue - upfrontPaidAmount) * 100) / 100;
    const defaultPenaltyAmount = Math.round(upfrontPaidAmount * FORWARD_CONTRACT_CONFIG.defaultPenaltyPercentOnAdvance * 100) / 100;

    const unitLabel = targetState === 'bottled' ? 'bottle' : 'kg';

    const contract: GrapeForwardContract = {
      id: uuidv4(),
      companyId: '',
      buyerId: buyer.id,
      buyerName: buyer.name,
      targetState,
      targetGrape: Math.random() < 0.6 ? undefined : getRandomFromArray(['Chardonnay', 'Pinot Noir', 'Sauvignon Blanc', 'Sangiovese', 'Tempranillo', 'Barbera', 'Primitivo']),
      quantityKg,
      deliveredKg: 0,
      unitPricePerKg,
      totalValue,
      upfrontPercent: FORWARD_CONTRACT_CONFIG.upfrontPercent,
      upfrontPaidAmount,
      finalPaymentAmount,
      defaultPenaltyAmount,
      status: 'offered',
      createdWeek: createdAt.week,
      createdSeason: createdAt.season,
      createdYear: createdAt.year,
      dueWeek: 1,
      dueSeason: due.season,
      dueYear: due.year,
    };

    await saveForwardContract(contract);

    await notificationService.addMessage(
      `New harvest forward offer: ${buyer.name} proposes ${quantityKg.toLocaleString()} ${unitLabel}${quantityKg === 1 ? '' : 's'} at €${unitPricePerKg.toFixed(2)}/${unitLabel} with upfront payment.`,
      'forwardContractService.generateForwardContracts',
      'Forward Contract Offer',
      NotificationCategory.SALES_ORDERS
    );

    triggerTopicUpdate('contracts');
    triggerGameUpdate();
    return 1;
  } catch (error) {
    console.error('Error generating forward contracts:', error);
    return 0;
  }
}

export async function acceptForwardContract(contractId: string): Promise<{ success: boolean; message: string }> {
  try {
    const contract = await getForwardContractById(contractId);
    if (!contract) return { success: false, message: 'Forward contract not found' };
    if (contract.status !== 'offered') return { success: false, message: 'Forward contract is not offered' };

    const current = getCurrentDate();

    await addTransaction(
      contract.upfrontPaidAmount,
      `Forward contract advance accepted: ${contract.buyerName}`,
      TRANSACTION_CATEGORIES.FORWARD_ADVANCE_IN,
      false
    );

    await updateForwardContract(contractId, {
      status: 'accepted',
      accepted_week: current.week,
      accepted_season: current.season,
      accepted_year: current.year,
    });

    await notificationService.addMessage(
      `Accepted forward contract with ${contract.buyerName}. Received €${contract.upfrontPaidAmount.toFixed(2)} upfront.`,
      'forwardContractService.acceptForwardContract',
      'Forward Contract Accepted',
      NotificationCategory.SALES_ORDERS
    );

    triggerTopicUpdate('contracts');
    triggerGameUpdate();
    return { success: true, message: 'Forward contract accepted' };
  } catch (error) {
    console.error('Error accepting forward contract:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function rejectForwardContract(contractId: string): Promise<{ success: boolean; message: string }> {
  try {
    const contract = await getForwardContractById(contractId);
    if (!contract) return { success: false, message: 'Forward contract not found' };
    if (!['offered', 'accepted'].includes(contract.status)) {
      return { success: false, message: 'Forward contract cannot be rejected now' };
    }

    await updateForwardContract(contractId, { status: 'rejected' });

    triggerTopicUpdate('contracts');
    triggerGameUpdate();
    return { success: true, message: 'Forward contract rejected' };
  } catch (error) {
    console.error('Error rejecting forward contract:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function isBatchEligible(contract: GrapeForwardContract, batch: any): boolean {
  const sellableStates = ['grapes', 'must_ready', 'must_fermenting', 'bottled'];
  if (!sellableStates.includes(batch.state)) return false;
  if (batch.quantity <= 0) return false;
  if (contract.targetState !== 'any' && batch.state !== contract.targetState) return false;
  if (contract.targetGrape && batch.grape !== contract.targetGrape) return false;
  return true;
}

export async function autoDeliverForwardContract(contractId: string): Promise<{ success: boolean; message: string }> {
  try {
    const contract = await getForwardContractById(contractId);
    if (!contract) return { success: false, message: 'Forward contract not found' };
    if (contract.status !== 'accepted') return { success: false, message: 'Forward contract is not accepted' };

    const remaining = Math.max(0, contract.quantityKg - contract.deliveredKg);
    if (remaining <= 0) return { success: false, message: 'Contract already fully delivered' };

    const allBatches = await loadWineBatches();
    const eligible = allBatches
      .filter(batch => isBatchEligible(contract, batch))
      .sort((a, b) => b.quantity - a.quantity);

    if (eligible.length === 0) {
      return { success: false, message: 'No eligible grapes/must batches available for delivery' };
    }

    let deliverRemaining = remaining;
    let deliveredNow = 0;
    const consumptions: Array<{ batchId: string; quantity: number }> = [];

    for (const batch of eligible) {
      if (deliverRemaining <= 0) break;
      const deliveredFromBatch = Math.min(batch.quantity, deliverRemaining);
      deliveredNow += deliveredFromBatch;
      deliverRemaining -= deliveredFromBatch;
      consumptions.push({ batchId: batch.id, quantity: deliveredFromBatch });
    }

    const newDelivered = contract.deliveredKg + deliveredNow;
    const fulfilled = newDelivered >= contract.quantityKg;
    const now = getCurrentDate();
    const companyId = getCurrentCompanyId();
    if (!companyId) return { success: false, message: 'No active company selected' };
    const delivery = await deliverForwardContractInventory({
      companyId,
      contractId,
      consumptions,
      newDelivered,
      fulfilled,
      paymentAmount: fulfilled ? contract.finalPaymentAmount : 0,
      paymentDescription: `Forward contract final settlement: ${contract.buyerName}`,
      paymentCategory: TRANSACTION_CATEGORIES.FORWARD_FINAL_SETTLEMENT_IN,
      week: now.week,
      season: now.season,
      year: now.year,
    });
    if (delivery.error || !delivery.data) throw delivery.error ?? new Error('Could not persist forward delivery.');
    const transaction = delivery.data.transaction;
    if (transaction) await syncPersistedTransaction(transaction);

    if (fulfilled) {
      try {
        await recordBuyerSale(contract.buyerId, contract.quantityKg, now.year);
        await addContractOutcomePrestigeEvent({
          outcome: 'forward_fulfilled',
          baseAmount: CONTRACT_PRESTIGE_CONFIG.forwardFulfillBase,
          description: `Forward contract fulfilled for ${contract.buyerName}`,
          metadata: { contractId: contract.id, quantityKg: contract.quantityKg },
        });
        await notificationService.addMessage(
          `Forward contract fulfilled for ${contract.buyerName}. Final payment €${contract.finalPaymentAmount.toFixed(2)} received.`,
          'forwardContractService.autoDeliverForwardContract',
          'Forward Contract Fulfilled',
          NotificationCategory.SALES_ORDERS
        );
      } catch (error) {
        console.warn('Forward delivery completed without optional follow-up:', error);
      }
    } else {
      try {
        await notificationService.addMessage(
          `Partial forward delivery: ${deliveredNow.toLocaleString()} kg delivered to ${contract.buyerName}. ${Math.max(0, contract.quantityKg - newDelivered).toLocaleString()} kg remaining.`,
          'forwardContractService.autoDeliverForwardContract',
          'Forward Contract Progress',
          NotificationCategory.SALES_ORDERS
        );
      } catch (error) {
        console.warn('Forward delivery completed without notification:', error);
      }
    }

    triggerTopicUpdate('contracts');
    triggerTopicUpdate('wine_batches');
    triggerGameUpdate();

    return { success: true, message: 'Forward contract delivery processed' };
  } catch (error) {
    console.error('Error delivering forward contract:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function expireAndDefaultForwardContracts(): Promise<number> {
  try {
    const contracts = await getOpenForwardContracts();
    const current = getCurrentDate();
    let changed = 0;

    for (const contract of contracts) {
      const isOverdue = isDateAfter(current, {
        week: contract.dueWeek,
        season: contract.dueSeason,
        year: contract.dueYear,
      });

      if (!isOverdue) continue;

      if (contract.status === 'accepted') {
        await updateForwardContract(contract.id, { status: 'defaulted' });

        await addTransaction(
          -contract.defaultPenaltyAmount,
          `Forward contract default penalty: ${contract.buyerName}`,
          TRANSACTION_CATEGORIES.FORWARD_DEFAULT_PENALTY_OUT,
          false
        );

        await addContractOutcomePrestigeEvent({
          outcome: 'forward_defaulted',
          baseAmount: CONTRACT_PRESTIGE_CONFIG.forwardDefaultBase,
          description: `Forward contract defaulted for ${contract.buyerName}`,
          metadata: { contractId: contract.id, penalty: contract.defaultPenaltyAmount },
        });
      } else {
        await updateForwardContract(contract.id, { status: 'expired' });
      }

      changed += 1;
    }

    if (changed > 0) {
      triggerTopicUpdate('contracts');
      triggerGameUpdate();
    }

    return changed;
  } catch (error) {
    console.error('Error expiring/defaulting forward contracts:', error);
    return 0;
  }
}

export async function getForwardContracts() {
  return loadForwardContracts();
}
