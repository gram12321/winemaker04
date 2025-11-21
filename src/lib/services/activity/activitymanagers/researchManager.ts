import { Activity, WorkCategory, NotificationCategory } from '@/lib/types/types';
import { getGameState } from '../../core/gameState';
import { createActivity } from './activityManager';
import { notificationService, addTransaction } from '@/lib/services';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { calculateResearchWork, calculateResearchCost } from '../workcalculators/researchWorkCalculator';
import { getResearchProject } from '@/lib/constants/researchConstants';
import { addResearchPrestigeEvent } from '../../prestige/prestigeService';

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

            await notificationService.addMessage(
                  `Research completed: ${project.title}.${rewardText}`,
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
