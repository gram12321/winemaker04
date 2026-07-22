import { Activity, WorkCategory, NotificationCategory, GameDate } from '@/lib/types/types';
import { getGameState, getCurrentPrestige } from '@/lib/services/core/gameState';
import { notificationService, addTransaction } from '@/lib/services';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { activitiesFeature } from '@/lib/features/activities';
import { RESEARCH_PROJECTS } from '@/lib/features/researchUpgrade/constants/researchCatalog';
import { getResearchProject } from '@/lib/features/researchUpgrade/services/research/researchCatalogService';
import { prestigeFeature } from '@/lib/features/prestige';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { calculateAbsoluteWeeks } from '@/lib/utils';
import { researchUpgradeFeature } from '../../..';
import { getUnlockedResearchIds } from '@/lib/database/core/researchUnlocksDB';
import { getResearchRequirementReasons, loadResearchEligibilityContext } from '@/lib/features/researchUpgrade/services/research/researchEligibilityService';
import { getResearchPermanentEffects } from '@/lib/features/researchUpgrade/services/research/researchPermanentEffectsService';
import { formatNumber } from '@/lib/utils/utils';

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
            const researchCost = activitiesFeature.work.calculateResearchCost(projectId);
            const companyId = getCurrentCompanyId();

            // Research activities use the project as their logical target. Keep
            // this guard even when the UI has stale state, because the activity
            // read goes back to the company database.
            const existingResearchActivity = (await activitiesFeature.reads.getAll()).find(activity =>
                  (activity.status === 'active' || activity.status === 'paused') &&
                  activity.category === WorkCategory.ADMINISTRATION_AND_RESEARCH &&
                  activity.params?.type === 'research' &&
                  activity.params?.researchId === projectId
            );
            if (existingResearchActivity) {
                  await notificationService.addMessage(
                        `Research project "${project.title}" is already in progress.`,
                        'researchManager.startResearch',
                        'Research Already Started',
                        NotificationCategory.FINANCE_AND_STAFF
                  );
                  return null;
            }

            const permanentEffects = await getResearchPermanentEffects(companyId || undefined);
            const { totalWork } = activitiesFeature.work.calculateResearch(projectId, {
                  workMultiplier: permanentEffects.administrationAndResearchWorkMultiplier
            });

            const prestige = await getCurrentPrestige();
            const unlockedIds = new Set(await getUnlockedResearchIds(companyId || undefined));
            const eligibilityContext = await loadResearchEligibilityContext(prestige, unlockedIds);
            const rawLockReasons = getResearchRequirementReasons(project, eligibilityContext);

            if (rawLockReasons.length > 0) {
                  const lockReasons = rawLockReasons.map(reason => {
                        if (reason.startsWith('Complete prerequisite research: ')) {
                              const rawIds = reason.replace('Complete prerequisite research: ', '').split(', ').filter(Boolean);
                              const missingTitles = rawIds.map(id => RESEARCH_PROJECTS.find(p => p.id === id)?.title ?? id);
                              return `Complete first: ${missingTitles.join(', ')}`;
                        }
                        return reason;
                  });

                  await notificationService.addMessage(
                        `Cannot start "${project.title}". ${lockReasons.join(' | ')}.`,
                        'researchManager.startResearch',
                        'Research Requirements Not Met',
                        NotificationCategory.FINANCE_AND_STAFF
                  );
                  return null;
            }

            // Check if we have enough money
            const currentMoney = gameState.money || 0;
            if (currentMoney < researchCost) {
                  await notificationService.addMessage(
                        `Insufficient funds for research. Need ${formatNumber(researchCost, { currency: true, decimals: 0 })}, have ${formatNumber(currentMoney, { currency: true, decimals: 0 })}`,
                        'researchManager.startResearch',
                        'Insufficient Funds',
                        NotificationCategory.FINANCE_AND_STAFF
                  );
                  return null;
            }

            // Deduct research cost immediately. If the database uniqueness
            // guard rejects a concurrent start, the amount is refunded below.
            await addTransaction(
                  -researchCost,
                  `Research: ${project.title}`,
                  TRANSACTION_CATEGORIES.RESEARCH,
                  false
            );

            // Create the research activity
            const result = await activitiesFeature.lifecycle.createWithResult({
                  category: WorkCategory.ADMINISTRATION_AND_RESEARCH,
                  title: project.title,
                  totalWork,
                  targetId: projectId,
                  activityDetails: `Cost: ${formatNumber(researchCost, { currency: true, decimals: 0 })}`,
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

            if (!result.activityId) {
                  await addTransaction(
                        researchCost,
                        `Research start refund: ${project.title}`,
                        TRANSACTION_CATEGORIES.RESEARCH,
                        false
                  );
            }

            return result.activityId;
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
            const projectId = activity.params?.researchId as string | undefined;
            const activityType = typeof activity.params?.type === 'string' ? activity.params.type.toLowerCase() : '';

            // Ignore non-research activities that share category routes.
            if (!projectId && activityType && activityType !== 'research') {
                  return;
            }

            const project = projectId ? getResearchProject(projectId) : undefined;

            if (!project) {
                  console.error('No research project found in activity params');
                  return;
            }
            const resolvedProjectId = project.id;

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
                  await prestigeFeature.events.addResearch(project.title, resolvedProjectId, project.prestigeReward);
            }

            // Build completion message
            const rewards: string[] = [];
            if (project.rewardAmount && project.rewardAmount > 0) {
                  rewards.push(`${formatNumber(project.rewardAmount, { currency: true, decimals: 0 })} grant funding`);
            }
            if (project.prestigeReward && project.prestigeReward > 0) {
                  rewards.push(`+${project.prestigeReward} prestige`);
            }

            const rewardText = rewards.length > 0 ? ` Received: ${rewards.join(', ')}.` : '';

            // researchManager is the write path for completed research.
            // The shared eligibility helper only decides whether a project can start.
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
                  
                  // Record the research completion in database (always, even if no unlocks)
                  await researchUpgradeFeature.setup.grantResearchUnlock({
                        researchId: resolvedProjectId,
                        companyId,
                        gameDate,
                        absoluteWeeks,
                        metadata: {
                              unlocks: project.unlocks || []
                        }
                  });
            }

            // Process unlock messages if this research has any
            const unlockMessages: string[] = [];
            if (project.unlocks && project.unlocks.length > 0) {
                  // Build unlock messages for notification
                  for (const unlock of project.unlocks) {
                        const displayName = unlock.displayName || String(unlock.value);
                        switch (unlock.type) {
                              case 'grape':
                                    unlockMessages.push(`${displayName} grape variety`);
                                    break;
                              case 'vineyard_size':
                                    unlockMessages.push(`Max size per vineyard: ${unlock.value} hectares`);
                                    break;
                              case 'total_vineyard_hectares':
                                    unlockMessages.push(`Max total vineyard area: ${unlock.value} hectares`);
                                    break;
                              case 'vineyard_count':
                                    unlockMessages.push(`Max vineyard count: ${unlock.value}`);
                                    break;
                              case 'fermentation_technology':
                                    unlockMessages.push(`${displayName} fermentation technology`);
                                    break;
                              case 'staff_limit':
                                    unlockMessages.push(`Staff limit: ${unlock.value} staff members`);
                                    break;
                              case 'wine_feature':
                                    unlockMessages.push(`${displayName} wine feature`);
                                    break;
                              case 'contract_type':
                                    unlockMessages.push(`${displayName} contract type`);
                                    break;
                              case 'grape_buyer_slots':
                                    unlockMessages.push(`${displayName} seasonal grape buyer capacity`);
                                    break;
                              case 'grape_buyer_limit_multiplier':
                                    unlockMessages.push(`${displayName} grape buyer hard limit upgrade`);
                                    break;
                              case 'grape_buyer_multiplier_bonus':
                                    unlockMessages.push(`${displayName} grape buyer multiplier upgrade`);
                                    break;
                              case 'grape_buyer_country_access':
                                    unlockMessages.push(`${displayName} grape buyer market access`);
                                    break;
                              default:
                                    unlockMessages.push(`${displayName}`);
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

            // Permanent effects are applied at runtime by domain services that read
            // completed research unlocks (minimum slice implemented for vineyard health decay).
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
