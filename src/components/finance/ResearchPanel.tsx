import { useState, useEffect } from 'react';
import {
      Card,
      CardHeader,
      CardTitle,
      CardDescription,
      CardContent,
      CardFooter
} from '@/components/ui/shadCN/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Button } from '@/components/ui';
import { WorkCategory } from '@/lib/types/types';
import { RESEARCH_PROJECTS, ResearchProject } from '@/lib/constants/researchConstants';
import { getAllActivities } from '@/lib/services/activity/activitymanagers/activityManager';
import { useGameUpdates } from '@/hooks/useGameUpdates';
import { calculateResearchWork, calculateResearchCost } from '@/lib/services/activity/workcalculators/researchWorkCalculator';
import { getResearchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { getUnlockedResearchIds } from '@/lib/database/core/researchUnlocksDB';
import { getCurrentPrestige } from '@/lib/services/core/gameState';
import { type ResearchEligibilityContext, getResearchRequirementReasons, isResearchProjectEligible, loadResearchEligibilityContext } from '@/lib/services';
import { CHAINED_VINEYARD_CAP_UNLOCK_TYPES, getBaseVineyardCapacityValue, getChainedVineyardResearchUnlockType, type VineyardCapUnlockType } from '@/lib/services/vineyard/vineyardCapacityService';

const CHAINED_RESEARCH_UNLOCK_TYPES = new Set(['staff_limit', ...CHAINED_VINEYARD_CAP_UNLOCK_TYPES]);
const BASE_STAFF_LIMIT = 2;

function getChainedResearchUnlockType(project: ResearchProject): string | null {
      const vineyardChainType = getChainedVineyardResearchUnlockType(project);
      if (vineyardChainType) {
            return vineyardChainType;
      }

      const chainedUnlock = project.unlocks?.find(unlock => CHAINED_RESEARCH_UNLOCK_TYPES.has(unlock.type));
      return chainedUnlock?.type ?? null;
}

function getCurrentChainLimit(chainType: string, projects: ResearchProject[], completedResearch: Set<string>): number | null {
      if (chainType === 'staff_limit') {
            let currentLimit = BASE_STAFF_LIMIT;
            for (const project of projects) {
                  if (!completedResearch.has(project.id)) {
                        continue;
                  }

                  const unlock = project.unlocks?.find((candidate) => candidate.type === 'staff_limit' && typeof candidate.value === 'number');
                  if (unlock && typeof unlock.value === 'number') {
                        currentLimit = Math.max(currentLimit, unlock.value);
                  }
            }
            return currentLimit;
      }

      if (CHAINED_VINEYARD_CAP_UNLOCK_TYPES.has(chainType as VineyardCapUnlockType)) {
            let currentLimit = getBaseVineyardCapacityValue(chainType as VineyardCapUnlockType);
            for (const project of projects) {
                  if (!completedResearch.has(project.id)) {
                        continue;
                  }

                  const unlock = project.unlocks?.find((candidate) => candidate.type === chainType && typeof candidate.value === 'number');
                  if (unlock && typeof unlock.value === 'number') {
                        currentLimit = Math.max(currentLimit, unlock.value);
                  }
            }
            return currentLimit;
      }

      return null;
}

export function getVisibleResearchProjects(
      projects: ResearchProject[],
      completedResearch: Set<string>,
      activeResearch: Set<string>,
      bypassGates = false
): ResearchProject[] {
      if (bypassGates) {
            return projects;
      }

      const chainFrontierByType = new Map<string, string>();
      const currentChainLimitByType = new Map<string, number | null>();

      for (const project of projects) {
            const chainType = getChainedResearchUnlockType(project);
            if (!chainType || currentChainLimitByType.has(chainType)) {
                  continue;
            }

            currentChainLimitByType.set(chainType, getCurrentChainLimit(chainType, projects, completedResearch));
      }

      for (const project of projects) {
            const chainType = getChainedResearchUnlockType(project);
            if (!chainType || chainFrontierByType.has(chainType) || completedResearch.has(project.id)) {
                  continue;
            }

            if (activeResearch.has(project.id)) {
                  chainFrontierByType.set(chainType, project.id);
                  continue;
            }

            const currentLimit = currentChainLimitByType.get(chainType);
            const unlock = project.unlocks?.find((candidate) => candidate.type === chainType && typeof candidate.value === 'number');
            if (currentLimit !== undefined && currentLimit !== null && unlock && typeof unlock.value === 'number' && unlock.value <= currentLimit) {
                  continue;
            }

            chainFrontierByType.set(chainType, project.id);
      }

      return projects.filter(project => {
            const chainType = getChainedResearchUnlockType(project);
            if (!chainType) {
                  return true;
            }

            if (completedResearch.has(project.id) || activeResearch.has(project.id)) {
                  return true;
            }

            return chainFrontierByType.get(chainType) === project.id;
      });
}

interface ResearchPanelProps {
      bypassGates?: boolean;
}

export function ResearchPanel({ bypassGates = false }: ResearchPanelProps) {
      const [activeResearch, setActiveResearch] = useState<Set<string>>(new Set());
      const [completedResearch, setCompletedResearch] = useState<Set<string>>(new Set());
      const [currentPrestige, setCurrentPrestige] = useState<number>(0);
      const [eligibilityContext, setEligibilityContext] = useState<ResearchEligibilityContext | null>(null);

      // Subscribe to game updates to refresh when activities change
      const { subscribe } = useGameUpdates();

      // Load active and completed research
      useEffect(() => {
            let isMounted = true;

            const load = async () => {
                  if (!isMounted) return;
                  await loadResearchStatus();
            };

            load();
            const unsubscribe = subscribe(() => {
                  load();
            });

            return () => {
                  isMounted = false;
                  unsubscribe();
            };
      }, [subscribe]);

      const loadResearchStatus = async () => {
            const [activities, completedIds, prestige] = await Promise.all([
                  getAllActivities(),
                  getUnlockedResearchIds(),
                  getCurrentPrestige()
            ]);

            const researchActivities = activities.filter(
                  activity => activity.category === WorkCategory.ADMINISTRATION_AND_RESEARCH
            );

            const active = new Set<string>();
            researchActivities.forEach(activity => {
                  const researchId = activity.params?.researchId;
                  if (researchId && activity.status === 'active') {
                        active.add(researchId as string);
                  }
            });

            setActiveResearch(active);
            const completedSet = new Set(completedIds);
            setCompletedResearch(completedSet);
            setCurrentPrestige(prestige);

            const context = await loadResearchEligibilityContext(prestige, completedSet);
            setEligibilityContext(context);
      };

      const handleStartResearch = async (project: ResearchProject) => {
            // Check if already active or completed
            if (activeResearch.has(project.id) || completedResearch.has(project.id)) {
                  return;
            }

            await getResearchUpgradeFeature().workflow.startResearch(project.id);

            // Refresh status
            await loadResearchStatus();
      };

      type ResearchStatus = 'available' | 'in-progress' | 'completed' | 'locked';

      const getResearchStatus = (project: ResearchProject): ResearchStatus => {
            if (completedResearch.has(project.id)) return 'completed';
            if (activeResearch.has(project.id)) return 'in-progress';
            if (!bypassGates) {
                  const context = eligibilityContext || {
                        currentPrestige,
                        completedResearch,
                        companyValue: Number.MAX_SAFE_INTEGER,
                        maxBuyerLoyaltyLevel: 3 as const,
                        unlockedAchievementIds: new Set((project.requiredAchievementIds || []).map(id => id)),
                  };
                  if (!isResearchProjectEligible(project, context)) return 'locked';
            }
            return 'available';
      };

      const getLockReason = (project: ResearchProject): string => {
            const context = eligibilityContext || {
                  currentPrestige,
                  completedResearch,
                  companyValue: Number.MAX_SAFE_INTEGER,
                  maxBuyerLoyaltyLevel: 3 as const,
                  unlockedAchievementIds: new Set((project.requiredAchievementIds || []).map(id => id)),
            };

            const reasons = getResearchRequirementReasons(project, context).map(reason => {
                  if (reason.startsWith('Complete prerequisite research: ')) {
                        const rawIds = reason.replace('Complete prerequisite research: ', '').split(', ').filter(Boolean);
                        const missingTitles = rawIds.map(id => RESEARCH_PROJECTS.find(p => p.id === id)?.title ?? id);
                        return `Complete first: ${missingTitles.join(', ')}`;
                  }
                  return reason;
            });

            return reasons.join(' | ');
      };

      const renderResearchCard = (project: ResearchProject) => {
            const status = getResearchStatus(project);
            const isDisabled = status === 'in-progress' || status === 'completed' || status === 'locked';
            const lockReason = status === 'locked' ? getLockReason(project) : '';

            // Calculate work and cost dynamically
            const { totalWork } = calculateResearchWork(project.id);
            const totalCost = calculateResearchCost(project.id);

            return (
                  <Card
                        key={project.id}
                        className={`transition-all ${
                                    status === 'in-progress'
                                          ? 'opacity-60 bg-gray-50 border-gray-300'
                                          : status === 'completed'
                                                ? 'bg-green-50 border-green-300'
                                                : status === 'locked'
                                                      ? 'opacity-60 bg-gray-50 border-gray-200'
                                                      : 'hover:shadow-lg'
                              }`}
                  >
                        <CardHeader>
                              <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                          {project.icon && (
                                                project.icon.startsWith('/') || project.icon.startsWith('http') ? (
                                                      <img 
                                                            src={project.icon} 
                                                            alt={project.title}
                                                            className="w-12 h-12 object-contain"
                                                            onError={(e) => {
                                                                  e.currentTarget.style.display = 'none';
                                                            }}
                                                      />
                                                ) : (
                                                      <div className="text-3xl">{project.icon}</div>
                                                )
                                          )}
                                          <div>
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                      {project.title}
                                                      {status === 'completed' && (
                                                            <span className="text-green-600 text-xl">✓</span>
                                                      )}
                                                      {status === 'in-progress' && (
                                                            <span className="text-gray-500 text-sm font-normal">(In Progress)</span>
                                                      )}
                                                      {status === 'locked' && (
                                                            <span className="text-amber-600 text-sm font-normal">🔒 Locked</span>
                                                      )}
                                                </CardTitle>
                                                <CardDescription className="mt-1">
                                                      {project.description}
                                                </CardDescription>
                                          </div>
                                    </div>
                              </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                              {/* Research Details */}
                              <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
                                    <div>
                                          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Work Amount</div>
                                          <div className="text-lg font-bold text-gray-800">{totalWork}</div>
                                          <div className="text-xs text-gray-500">work units</div>
                                    </div>
                                    <div>
                                          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Cost</div>
                                          <div className="text-lg font-bold text-gray-800">€{totalCost.toLocaleString()}</div>
                                          <div className="text-xs text-gray-500">investment</div>
                                    </div>
                                    <div>
                                          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Complexity</div>
                                          <div className="text-sm font-semibold text-gray-800">{project.complexity}/10</div>
                                          <div className="text-xs text-gray-500 capitalize">{project.category}</div>
                                    </div>
                              </div>

                              {/* Lock reason */}
                              {status === 'locked' && lockReason && (
                                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                                          🔒 {lockReason}
                                    </div>
                              )}

                              {/* Benefits */}
                              <div>
                                    <div className="text-sm font-semibold text-gray-700 mb-2">Benefits:</div>
                                    <ul className="space-y-1">
                                          {project.benefits.map((benefit, index) => (
                                                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                                                      <span className="text-green-600 mt-0.5">•</span>
                                                      <span>{benefit}</span>
                                                </li>
                                          ))}
                                    </ul>
                              </div>
                        </CardContent>

                        <CardFooter>
                              <Button
                                    onClick={() => handleStartResearch(project)}
                                    disabled={isDisabled}
                                    className={`w-full ${
                                                status === 'completed'
                                                      ? 'bg-green-600 hover:bg-green-700'
                                                      : status === 'in-progress'
                                                            ? 'bg-gray-400 cursor-not-allowed'
                                                            : status === 'locked'
                                                                  ? 'bg-gray-300 cursor-not-allowed'
                                                                  : ''
                                          }`}
                              >
                                    {status === 'completed'
                                          ? 'Completed ✓'
                                          : status === 'in-progress'
                                                ? 'Research In Progress...'
                                                : status === 'locked'
                                                      ? '🔒 Locked'
                                                      : 'Start Research'
                                    }
                              </Button>
                        </CardFooter>
                  </Card>
            );
      };

      // Group projects by category
      const categoryGroups: Record<ResearchProject['category'], ResearchProject[]> = {
            administration: RESEARCH_PROJECTS.filter(p => p.category === 'administration'),
            projects: RESEARCH_PROJECTS.filter(p => p.category === 'projects'),
            technology: RESEARCH_PROJECTS.filter(p => p.category === 'technology'),
            agriculture: RESEARCH_PROJECTS.filter(p => p.category === 'agriculture'),
            efficiency: RESEARCH_PROJECTS.filter(p => p.category === 'efficiency'),
            marketing: RESEARCH_PROJECTS.filter(p => p.category === 'marketing'),
            staff: RESEARCH_PROJECTS.filter(p => p.category === 'staff')
      };

      // Category display info
      const categoryInfo: Record<ResearchProject['category'], { title: string; description: string; icon: string }> = {
            administration: {
                  title: 'Administration',
                  description: 'Improve administrative processes and documentation systems.',
                  icon: '📋'
            },
            projects: {
                  title: 'Projects',
                  description: 'Apply for research grants and funding opportunities.',
                  icon: '💰'
            },
            technology: {
                  title: 'Technology',
                  description: 'Research advanced technologies for winemaking and vineyard management.',
                  icon: '🔬'
            },
            agriculture: {
                  title: 'Agriculture',
                  description: 'Research grape varieties and agricultural techniques.',
                  icon: '🌾'
            },
            efficiency: {
                  title: 'Efficiency',
                  description: 'Improve operational efficiency and productivity.',
                  icon: '⚡'
            },
            marketing: {
                  title: 'Marketing',
                  description: 'Study market trends and customer preferences.',
                  icon: '📊'
            },
            staff: {
                  title: 'Staff',
                  description: 'Develop staff training and management programs.',
                  icon: '👥'
            }
      };

      const renderCategoryContent = (category: ResearchProject['category']) => {
            const projects = getVisibleResearchProjects(
                  categoryGroups[category],
                  completedResearch,
                  activeResearch,
                  bypassGates
            );
            const info = categoryInfo[category];

            if (projects.length === 0) {
                  return (
                        <div className="text-center py-12 text-gray-500">
                              <p>No research projects available in this category yet.</p>
                        </div>
                  );
            }

            return (
                  <div className="space-y-6">
                        <div>
                              <h3 className="text-xl font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                    <span className="text-2xl">{info.icon}</span>
                                    {info.title}
                              </h3>
                              <p className="text-gray-600 mb-6">{info.description}</p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {projects.map(renderResearchCard)}
                        </div>
                  </div>
            );
      };

      return (
            <Tabs defaultValue="administration" className="w-full">
                  <TabsList className="grid w-full grid-cols-7 mb-6">
                        <TabsTrigger value="administration" className="text-xs">Admin</TabsTrigger>
                        <TabsTrigger value="projects" className="text-xs">Projects</TabsTrigger>
                        <TabsTrigger value="technology" className="text-xs">Technology</TabsTrigger>
                        <TabsTrigger value="agriculture" className="text-xs">Agriculture</TabsTrigger>
                        <TabsTrigger value="efficiency" className="text-xs">Efficiency</TabsTrigger>
                        <TabsTrigger value="marketing" className="text-xs">Marketing</TabsTrigger>
                        <TabsTrigger value="staff" className="text-xs">Staff</TabsTrigger>
                  </TabsList>

                  <TabsContent value="administration">
                        {renderCategoryContent('administration')}
                  </TabsContent>
                  <TabsContent value="projects">
                        {renderCategoryContent('projects')}
                  </TabsContent>
                  <TabsContent value="technology">
                        {renderCategoryContent('technology')}
                  </TabsContent>
                  <TabsContent value="agriculture">
                        {renderCategoryContent('agriculture')}
                  </TabsContent>
                  <TabsContent value="efficiency">
                        {renderCategoryContent('efficiency')}
                  </TabsContent>
                  <TabsContent value="marketing">
                        {renderCategoryContent('marketing')}
                  </TabsContent>
                  <TabsContent value="staff">
                        {renderCategoryContent('staff')}
                  </TabsContent>
            </Tabs>
      );
}
