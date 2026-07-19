import { RESEARCH_PROJECTS, type ResearchProject } from '@/lib/constants/researchConstants';
import { getUnlockedResearchIds } from '@/lib/database';
import { getCurrentPrestige } from '@/lib/services';
import { activitiesFeature } from '@/lib/features/activities';
import { WorkCategory } from '@/lib/types/types';
import {
  getResearchRequirementReasons,
  isResearchProjectEligible,
  loadResearchEligibilityContext,
  type ResearchEligibilityContext,
} from './researchEligibilityService';

import { type ResearchPermanentEffectsSummary, getResearchPermanentEffects } from './researchPermanentEffectsService';
import {
  getResearchDisplayGroup,
  getVisibleResearchProjects,
  type ResearchDisplayGroupId,
  type ResearchProjectPresentationRow,
} from './researchPresentationService';

export type ResearchStatus = 'available' | 'in-progress' | 'completed' | 'locked';
export type ResearchViewMode = 'focus' | 'full';
export type ResearchSortMode = 'recommended' | 'cost' | 'work' | 'complexity';

export interface ResearchViewSummary {
  hasEffects: boolean;
  healthDecayReductionPercent: number;
  researchSkillBoostPercent: number;
}

export interface ResearchProjectModel {
  project: ResearchProject;
  presentation: ResearchProjectPresentationRow;
  status: ResearchStatus;
  lockReason: string;
  totalWork: number;
  totalCost: number;
}

export interface ResearchChainSummary {
  label: string;
  projectIds: string[];
  completedSteps: number;
  totalSteps: number;
}

export interface ResearchWorkspaceSnapshot {
  activeResearch: Set<string>;
  completedResearch: Set<string>;
  currentPrestige: number;
  eligibilityContext: ResearchEligibilityContext | null;
  permanentEffects: ResearchPermanentEffectsSummary;
}

interface BuildResearchProjectModelsOptions {
  activeResearch: Set<string>;
  bypassGates: boolean;
  completedResearch: Set<string>;
  currentPrestige: number;
  eligibilityContext: ResearchEligibilityContext | null;
  permanentEffects: ResearchPermanentEffectsSummary;
  presentationRows: ResearchProjectPresentationRow[];
}

interface BuildFilteredResearchGroupsOptions {
  activeResearch: Set<string>;
  bypassGates: boolean;
  completedResearch: Set<string>;
  groupFilter: 'all' | ResearchDisplayGroupId;
  hideCompleted: boolean;
  projectModels: ResearchProjectModel[];
  searchTerm: string;
  sortMode: ResearchSortMode;
  statusFilter: 'all' | ResearchStatus;
  viewMode: ResearchViewMode;
}

function createFallbackEligibilityContext(
  currentPrestige: number,
  completedResearch: Set<string>,
  project: ResearchProject
): ResearchEligibilityContext {
  return {
    currentPrestige,
    completedResearch,
    companyValue: Number.MAX_SAFE_INTEGER,
    companyAgeWeeks: Number.MAX_SAFE_INTEGER,
    maxBuyerLoyaltyLevel: 10,
    unlockedAchievementIds: new Set((project.requiredAchievementIds || []).map((id) => id)),
  };
}

function getResearchProjectStatus(
  project: ResearchProject,
  activeResearch: Set<string>,
  completedResearch: Set<string>,
  currentPrestige: number,
  eligibilityContext: ResearchEligibilityContext | null,
  bypassGates: boolean
): ResearchStatus {
  if (completedResearch.has(project.id)) {
    return 'completed';
  }

  if (activeResearch.has(project.id)) {
    return 'in-progress';
  }

  if (bypassGates) {
    return 'available';
  }

  const context = eligibilityContext ?? createFallbackEligibilityContext(currentPrestige, completedResearch, project);
  return isResearchProjectEligible(project, context) ? 'available' : 'locked';
}

export function getResearchLockReason(project: ResearchProject, context: ResearchEligibilityContext): string {
  const reasons = getResearchRequirementReasons(project, context).map((reason) => {
    if (!reason.startsWith('Complete prerequisite research: ')) {
      return reason;
    }

    const rawIds = reason.replace('Complete prerequisite research: ', '').split(', ').filter(Boolean);
    const missingTitles = rawIds.map((id) => RESEARCH_PROJECTS.find((candidate) => candidate.id === id)?.title ?? id);
    return `Complete first: ${missingTitles.join(', ')}`;
  });

  return reasons.join(' | ');
}

function buildResearchSearchableText(model: ResearchProjectModel): string {
  return [
    model.project.title,
    model.project.id,
    model.project.description,
    model.presentation.primaryImpact,
    model.presentation.prerequisiteTitles.join(' '),
    model.presentation.unlockTypeLabels.join(' '),
    ...(model.project.benefits || []),
  ]
    .join(' ')
    .toLowerCase();
}

export async function loadResearchWorkspaceSnapshot(bypassGates: boolean): Promise<ResearchWorkspaceSnapshot> {
  const [activities, completedIds, currentPrestige, permanentEffects] = await Promise.all([
    activitiesFeature.reads.getAll(),
    getUnlockedResearchIds(),
    getCurrentPrestige(),
    getResearchPermanentEffects(),
  ]);

  const activeResearch = new Set(
    activities
      .filter((activity) => activity.category === WorkCategory.ADMINISTRATION_AND_RESEARCH)
      .filter((activity) => activity.status === 'active' && typeof activity.params?.researchId === 'string')
      .map((activity) => activity.params!.researchId as string)
  );

  const completedResearch = new Set(completedIds);
  const eligibilityContext = bypassGates
    ? null
    : await loadResearchEligibilityContext(currentPrestige, completedResearch);

  return {
    activeResearch,
    completedResearch,
    currentPrestige,
    eligibilityContext,
    permanentEffects,
  };
}

export function buildResearchProjectModels({
  activeResearch,
  bypassGates,
  completedResearch,
  currentPrestige,
  eligibilityContext,
  permanentEffects,
  presentationRows,
}: BuildResearchProjectModelsOptions): ResearchProjectModel[] {
  return presentationRows.map((presentation) => {
    const project = presentation.project;
    const status = getResearchProjectStatus(
      project,
      activeResearch,
      completedResearch,
      currentPrestige,
      eligibilityContext,
      bypassGates
    );
    const lockReason =
      status === 'locked' && eligibilityContext
        ? getResearchLockReason(project, eligibilityContext)
        : '';
    const { totalWork } = activitiesFeature.work.calculateResearch(project.id, {
      workMultiplier: permanentEffects.administrationAndResearchWorkMultiplier,
    });

    return {
      project,
      presentation,
      status,
      lockReason,
      totalWork,
      totalCost: activitiesFeature.work.calculateResearchCost(project.id),
    };
  });
}

export function buildFilteredResearchGroups({
  activeResearch,
  bypassGates,
  completedResearch,
  groupFilter,
  hideCompleted,
  projectModels,
  searchTerm,
  sortMode,
  statusFilter,
  viewMode,
}: BuildFilteredResearchGroupsOptions): Map<ResearchDisplayGroupId, ResearchProjectModel[]> {
  const groupedModels = new Map<ResearchDisplayGroupId, ResearchProjectModel[]>();
  for (const model of projectModels) {
    const groupId = getResearchDisplayGroup(model.project).id;
    groupedModels.set(groupId, [...(groupedModels.get(groupId) || []), model]);
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const selectedGroupIds =
    groupFilter === 'all' ? Array.from(groupedModels.keys()) : [groupFilter];
  const filteredGroups = new Map<ResearchDisplayGroupId, ResearchProjectModel[]>();

  for (const groupId of selectedGroupIds) {
    const groupModels = groupedModels.get(groupId) || [];
    const visibleProjects =
      viewMode === 'focus'
        ? getVisibleResearchProjects(
            groupModels.map((model) => model.project),
            completedResearch,
            activeResearch,
            bypassGates
          )
        : groupModels.map((model) => model.project);
    const visibleIds = new Set(visibleProjects.map((project) => project.id));

    let models = groupModels.filter((model) => visibleIds.has(model.project.id));

    if (hideCompleted) {
      models = models.filter((model) => model.status !== 'completed');
    }

    if (statusFilter !== 'all') {
      models = models.filter((model) => model.status === statusFilter);
    }

    if (normalizedSearch) {
      models = models.filter((model) => buildResearchSearchableText(model).includes(normalizedSearch));
    }

    if (sortMode !== 'recommended') {
      models = [...models].sort((left, right) => {
        if (sortMode === 'cost') {
          return left.totalCost - right.totalCost;
        }
        if (sortMode === 'work') {
          return left.totalWork - right.totalWork;
        }
        return left.project.complexity - right.project.complexity;
      });
    }

    filteredGroups.set(groupId, models);
  }

  return filteredGroups;
}

export function flattenResearchProjectGroups(
  groups: Map<ResearchDisplayGroupId, ResearchProjectModel[]>
): ResearchProjectModel[] {
  const models: ResearchProjectModel[] = [];
  for (const groupModels of groups.values()) {
    models.push(...groupModels);
  }
  return models;
}

export function getDefaultSelectedResearchProjectId(
  visibleModels: ResearchProjectModel[],
  selectedProjectId: string
): string {
  if (visibleModels.length === 0) {
    return '';
  }

  if (visibleModels.some((model) => model.project.id === selectedProjectId)) {
    return selectedProjectId;
  }

  return visibleModels[0].project.id;
}

export function buildResearchDirectChainLookup(
  chainSummaries: ResearchChainSummary[]
): Map<string, string[]> {
  const chainsByProjectId = new Map<string, string[]>();
  for (const chain of chainSummaries) {
    for (const projectId of chain.projectIds) {
      chainsByProjectId.set(projectId, chain.projectIds);
    }
  }
  return chainsByProjectId;
}

export function getSelectedResearchChainModels(
  directChainByProjectId: Map<string, string[]>,
  projectModels: ResearchProjectModel[],
  selectedModel: ResearchProjectModel | null
): ResearchProjectModel[] {
  if (!selectedModel) {
    return [];
  }

  const directChainIds = directChainByProjectId.get(selectedModel.project.id);
  if (directChainIds) {
    return directChainIds
      .map((projectId) => projectModels.find((model) => model.project.id === projectId))
      .filter((model): model is ResearchProjectModel => Boolean(model));
  }

  if (!selectedModel.presentation.chainType) {
    return [];
  }

  return projectModels
    .filter((model) => model.presentation.chainType === selectedModel.presentation.chainType)
    .sort((left, right) => (left.presentation.chainUnlockValue ?? 0) - (right.presentation.chainUnlockValue ?? 0));
}

export function getResearchChainStepLabel(
  model: ResearchProjectModel,
  allModels: ResearchProjectModel[]
): string | null {
  const chainType = model.presentation.chainType;
  if (!chainType) {
    return null;
  }

  const ladder = allModels
    .filter((candidate) => candidate.presentation.chainType === chainType)
    .sort((left, right) => (left.presentation.chainUnlockValue ?? 0) - (right.presentation.chainUnlockValue ?? 0));
  const index = ladder.findIndex((candidate) => candidate.project.id === model.project.id);

  if (index < 0) {
    return null;
  }

  return `${index + 1}/${ladder.length}`;
}

export function getResearchGroupStats(models: ResearchProjectModel[]) {
  return {
    total: models.length,
    completed: models.filter((model) => model.status === 'completed').length,
    available: models.filter((model) => model.status === 'available').length,
  };
}

export function getCompactResearchChainModels(
  models: ResearchProjectModel[]
): Array<ResearchProjectModel | 'ellipsis'> {
  if (models.length <= 5) {
    return models;
  }

  const activeIndex = models.findIndex((model) => model.status === 'in-progress');
  const nextIndex = models.findIndex((model) => model.status !== 'completed');
  const focusIndex = activeIndex >= 0 ? activeIndex : nextIndex >= 0 ? nextIndex : models.length - 1;
  const startIndex = Math.max(1, focusIndex - 1);
  const endIndex = Math.min(models.length - 2, focusIndex + 1);
  const compact: Array<ResearchProjectModel | 'ellipsis'> = [models[0]];

  if (startIndex > 1) {
    compact.push('ellipsis');
  }

  compact.push(...models.slice(startIndex, endIndex + 1));

  if (endIndex < models.length - 2) {
    compact.push('ellipsis');
  }

  compact.push(models[models.length - 1]);
  return compact;
}

export function getResearchViewSummary(activeBonuses: ResearchPermanentEffectsSummary): ResearchViewSummary {
  const hasEffects = activeBonuses.activeEffects.length > 0;
  const healthDecayReductionPercent = Math.max(0, (1 - activeBonuses.vineyardHealthDecayMultiplier) * 100);
  const researchSkillBoostPercent = Math.max(0, (activeBonuses.researchSkillMultiplier - 1) * 100);

  return {
    hasEffects,
    healthDecayReductionPercent,
    researchSkillBoostPercent,
  };
}
