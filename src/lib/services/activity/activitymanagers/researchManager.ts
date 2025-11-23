import { Activity, WorkCategory, NotificationCategory, GameDate } from '@/lib/types/types';
import { getGameState } from '../../core/gameState';
import { createActivity } from './activityManager';
import { notificationService, addTransaction } from '@/lib/services';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { calculateResearchWork, calculateResearchCost } from '../workcalculators/researchWorkCalculator';
import { getResearchProject } from '@/lib/constants/researchConstants';
import { addResearchPrestigeEvent } from '../../prestige/prestigeService';
import { unlockResearch } from '@/lib/database';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { calculateAbsoluteWeeks } from '@/lib/utils';

/**
 * Start a research activity
 */
export async function startResearch(projectId: string): Promise<string | null> {
      try {
            const project = getResearchProject(projectId);

            if (!project) {
                  console.error(`Research project not found: ${projectId}`);
                  return null;
            }

            const gameState = getGameState();
            const researchCost = calculateResearchCost(projectId);
            const { totalWork } = calculateResearchWork(projectId);

            // Check if we have enough money
            const currentMoney = gameState.money || 0;
            if (currentMoney < researchCost) {
                  await notificationService.addMessage(
                        `Insufficient funds for research. Need €${researchCost.toLocaleString()}, have €${currentMoney.toLocaleString()}`,
                        'researchManager.startResearch',
                        'Insufficient Funds',
                        NotificationCategory.FINANCE_AND_STAFF
                  );
                  return null;
            }

            // Deduct research cost immediately
            await addTransaction(
                  -researchCost,
                  `Research: ${project.title}`,
                  TRANSACTION_CATEGORIES.RESEARCH,
                  false
            );

            // Create the research activity
            const activityId = await createActivity({
                  category: WorkCategory.ADMINISTRATION_AND_RESEARCH,
                  title: project.title,
                  totalWork,
                  activityDetails: `Cost: €${researchCost.toLocaleString()}`,
                  params: {
                        type: 'research',
                        researchId: projectId,
                        cost: researchCost,
                        benefits: project.benefits,
                        rewardAmount: project.rewardAmount,
                        prestigeReward: project.prestigeReward
                  },
                  isCancellable: true
            });

            return activityId;
      } catch (error) {
            console.error('Error starting research:', error);
            return null;
      }
}

/**
 * Complete a research activity
 * Grants rewards based on research type
 */
export async function completeResearch(activity: Activity): Promise<void> {
      try {
            const projectId = activity.params.researchId as string;
            const project = getResearchProject(projectId);

            if (!project) {
                  console.error('No research project found in activity params');
                  return;
            }

            // Grant monetary reward (for grants)
            if (project.rewardAmount && project.rewardAmount > 0) {
                  await addTransaction(
                        project.rewardAmount,
                        `Research Grant: ${project.title}`,
                        TRANSACTION_CATEGORIES.RESEARCH,
                        false
                  );
            }

            // Grant prestige reward
            if (project.prestigeReward && project.prestigeReward > 0) {
                  await addResearchPrestigeEvent(project.title, projectId, project.prestigeReward);
            }

            // Build completion message
            const rewards: string[] = [];
            if (project.rewardAmount && project.rewardAmount > 0) {
                  rewards.push(`€${project.rewardAmount.toLocaleString()} grant funding`);
            }
            if (project.prestigeReward && project.prestigeReward > 0) {
                  rewards.push(`+${project.prestigeReward} prestige`);
            }

            const rewardText = rewards.length > 0 ? ` Received: ${rewards.join(', ')}.` : '';

            // Process unlocks if this research has any
            const unlockMessages: string[] = [];
            if (project.unlocks && project.unlocks.length > 0) {
                  const gameState = getGameState();
                  const companyId = getCurrentCompanyId();
                  
                  if (companyId) {
                        const gameDate: GameDate = {
                              week: gameState.week || 1,
                              season: (gameState.season || 'Spring') as any,
                              year: gameState.currentYear || 2024
                        };
                        
                        const absoluteWeeks = calculateAbsoluteWeeks(
                              gameDate.week,
                              gameDate.season,
                              gameDate.year
                        );
                        
                        // Record the research unlock in database
                        await unlockResearch({
                              researchId: projectId,
                              companyId,
                              unlockedAt: gameDate,
                              unlockedAtTimestamp: absoluteWeeks,
                              metadata: {
                                    unlocks: project.unlocks
                              }
                        });
                        
                        // Build unlock messages for notification
                        for (const unlock of project.unlocks) {
                              const displayName = unlock.displayName || String(unlock.value);
                              switch (unlock.type) {
                                    case 'grape':
                                          unlockMessages.push(`${displayName} grape variety`);
                                          break;
                                    case 'vineyard_size':
                                          unlockMessages.push(`Vineyard size limit: ${unlock.value} hectares`);
                                          break;
                                    case 'fermentation_technology':
                                          unlockMessages.push(`${displayName} fermentation technology`);
                                          break;
                                    case 'staff_limit':
                                          unlockMessages.push(`Staff limit: ${unlock.value} staff members`);
                                          break;
                                    case 'building_type':
                                          unlockMessages.push(`${displayName} building type`);
                                          break;
                                    case 'wine_feature':
                                          unlockMessages.push(`${displayName} wine feature`);
                                          break;
                                    case 'contract_type':
                                          unlockMessages.push(`${displayName} contract type`);
                                          break;
                                    default:
                                          unlockMessages.push(`${displayName}`);
                              }
                        }
                  }
            }

            const unlockText = unlockMessages.length > 0 
                  ? ` Unlocked: ${unlockMessages.join(', ')}!` 
                  : '';

            await notificationService.addMessage(
                  `Research completed: ${project.title}.${rewardText}${unlockText}`,
                  'researchManager.completeResearch',
                  'Research Complete',
                  NotificationCategory.ADMINISTRATION_AND_RESEARCH
            );

            // TODO: Apply permanent benefits for technology/upgrade research
            // This would require a separate system to track unlocked technologies
      } catch (error) {
            console.error('Error completing research:', error);
            await notificationService.addMessage(
                  `Research completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  'researchManager.completeResearch',
                  'Research Failed',
                  NotificationCategory.ADMINISTRATION_AND_RESEARCH
            );
      }
}
