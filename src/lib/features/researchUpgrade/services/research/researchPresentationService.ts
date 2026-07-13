import {
  BASE_STAFF_LIMIT,
  type ResearchPermanentEffect,
  type ResearchProject,
  type ResearchUnlock,
  type UnlockType,
} from '@/lib/constants/researchConstants';
import { achievementsFeature } from '@/lib/features/achievements';
import {
  CHAINED_RESEARCH_UNLOCK_TYPES,
  CHAINED_VINEYARD_CAP_UNLOCK_TYPES,
  LADDER_TYPES,
  MARKET_UNLOCK_TYPES,
} from '@/lib/constants/researchPresentationConstants';
import { calculateResearchCost, calculateResearchWork } from '@/lib/services/activity/workcalculators/researchWorkCalculator';
import {
  formatVineyardCapacityValue,
  getBaseVineyardCapacityValue,
  getChainedVineyardResearchUnlockType,
  getVineyardCapacityLabel,
  type VineyardCapUnlockType,
} from '@/lib/services/vineyard/vineyardCapacityService';
import { formatNumber } from '@/lib/utils/utils';

export const RESEARCH_DISPLAY_GROUPS = [
  {
    id: 'foundation_governance',
    title: 'Foundation & Governance',
    description: 'Administration, grants, and baseline operating systems.',
  },
  {
    id: 'vineyard_capacity',
    title: 'Vineyard & Capacity Growth',
    description: 'Staffing, vineyard count, per-site scale, and total estate limits.',
  },
  {
    id: 'winemaking_technology',
    title: 'Winemaking Technology',
    description: 'Fermentation, diagnostics, process control, and permanent technical effects.',
  },
  {
    id: 'market_commercial',
    title: 'Market & Commercial Expansion',
    description: 'Buyer access, contract channels, commercial reach, and pricing leverage.',
  },
  {
    id: 'varietal_research',
    title: 'Varietal Research',
    description: 'Grape unlocks and cultivar-specific growing expertise.',
  },
] as const;

export type ResearchDisplayGroup = typeof RESEARCH_DISPLAY_GROUPS[number];
export type ResearchDisplayGroupId = ResearchDisplayGroup['id'];

export type ResearchStatus = 'available' | 'in-progress' | 'completed' | 'locked';

export type ResearchGateType =
  | 'prestige'
  | 'prerequisite'
  | 'company'
  | 'age'
  | 'loyalty'
  | 'achievement';

export interface ResearchGateChip {
  type: ResearchGateType;
  label: string;
}

export interface ResearchRequirementDetail {
  label: string;
  value: string;
}

export interface ResearchRewardDetail {
  label: string;
  value: string;
}

export interface ResearchDependencyLink {
  id: string;
  title: string;
}

export interface ResearchDependencyMetadata {
  prerequisiteLinks: ResearchDependencyLink[];
  prerequisiteTitles: string[];
  unlocksNextLinks: ResearchDependencyLink[];
  unlocksNextTitles: string[];
  chainType: UnlockType | null;
  chainLabel: string | null;
  chainUnlockValue: number | null;
}

export interface ResearchProjectPresentationRow {
  project: ResearchProject;
  group: ResearchDisplayGroup;
  primaryImpact: string;
  gateChips: ResearchGateChip[];
  rewardDetails: ResearchRewardDetail[];
  requirementDetails: ResearchRequirementDetail[];
  prerequisiteLinks: ResearchDependencyLink[];
  prerequisiteTitles: string[];
  unlocksNextLinks: ResearchDependencyLink[];
  unlocksNextTitles: string[];
  unlockTypeLabels: string[];
  chainType: UnlockType | null;
  chainLabel: string | null;
  chainUnlockValue: number | null;
  totalWork: number;
  totalCost: number;
}

export interface ResearchUnlockTypeSummary {
  type: UnlockType;
  label: string;
  totalCount: number;
  completedCount: number;
  activeCount: number;
}

export interface ResearchLadderSummary {
  chainType: UnlockType;
  label: string;
  completedSteps: number;
  totalSteps: number;
  currentValue: number;
  currentLabel: string;
  nextProjectTitle: string | null;
  activeProjectTitle: string | null;
}

export interface ResearchChainSummary {
  chainId: string;
  label: string;
  projectIds: string[];
  completedSteps: number;
  totalSteps: number;
  currentProjectTitle: string | null;
  nextProjectTitle: string | null;
  activeProjectTitle: string | null;
}

export interface ResearchFootprintSummary {
  statusCounts: {
    total: number;
    completed: number;
    inProgress: number;
    remaining: number;
  };
  unlockTypeSummaries: ResearchUnlockTypeSummary[];
  ladderSummaries: ResearchLadderSummary[];
  chainSummaries: ResearchChainSummary[];
  completedImpactLines: string[];
}

const RESEARCH_DISPLAY_GROUP_BY_ID: Record<ResearchDisplayGroupId, ResearchDisplayGroup> =
  RESEARCH_DISPLAY_GROUPS.reduce((acc, group) => {
    acc[group.id] = group;
    return acc;
  }, {} as Record<ResearchDisplayGroupId, ResearchDisplayGroup>);

export function getUnlockTypeLabel(type: UnlockType): string {
  switch (type) {
    case 'grape':
      return 'Grape unlock';
    case 'fermentation_technology':
      return 'Fermentation technology';
    case 'staff_limit':
      return 'Staff capacity';
    case 'vineyard_size':
      return 'Per-vineyard size';
    case 'total_vineyard_hectares':
      return 'Total vineyard area';
    case 'vineyard_count':
      return 'Vineyard count';
    case 'contract_type':
      return 'Contract channel';
    case 'wine_feature':
      return 'Wine feature';
    case 'grape_buyer_slots':
      return 'Buyer slots';
    case 'grape_buyer_limit_multiplier':
      return 'Buyer volume limit';
    case 'grape_buyer_multiplier_bonus':
      return 'Buyer price bonus';
    case 'grape_buyer_country_access':
      return 'Buyer country access';
    default:
      return type;
  }
}

export function getResearchDisplayGroup(project: ResearchProject): ResearchDisplayGroup {
  const unlockTypes = new Set((project.unlocks || []).map(unlock => unlock.type));
  const permanentEffectKinds = new Set((project.permanentEffects || []).map(effect => effect.kind));

  if (
    project.category === 'administration' ||
    permanentEffectKinds.has('research_skill_multiplier') ||
    permanentEffectKinds.has('administration_and_research_work_multiplier')
  ) {
    return RESEARCH_DISPLAY_GROUP_BY_ID.foundation_governance;
  }

  if (unlockTypes.has('grape')) {
    return RESEARCH_DISPLAY_GROUP_BY_ID.varietal_research;
  }

  if (Array.from(unlockTypes).some(type => MARKET_UNLOCK_TYPES.has(type)) || project.category === 'marketing') {
    return RESEARCH_DISPLAY_GROUP_BY_ID.market_commercial;
  }

  if (
    project.category === 'staff' ||
    permanentEffectKinds.has('all_staff_work_multiplier') ||
    Array.from(unlockTypes).some(type => CHAINED_RESEARCH_UNLOCK_TYPES.has(type))
  ) {
    return RESEARCH_DISPLAY_GROUP_BY_ID.vineyard_capacity;
  }

  if (project.category === 'technology' || unlockTypes.has('fermentation_technology') || Boolean(project.permanentEffects?.length)) {
    return RESEARCH_DISPLAY_GROUP_BY_ID.winemaking_technology;
  }

  return RESEARCH_DISPLAY_GROUP_BY_ID.foundation_governance;
}

export function getResearchGateChips(project: ResearchProject): ResearchGateChip[] {
  const chips: ResearchGateChip[] = [];

  if (typeof project.requiredPrestige === 'number' && project.requiredPrestige > 0) {
    chips.push({ type: 'prestige', label: `Prestige ${project.requiredPrestige}+` });
  }

  if (project.prerequisites?.length) {
    chips.push({
      type: 'prerequisite',
      label: project.prerequisites.length === 1 ? '1 prerequisite' : `${project.prerequisites.length} prerequisites`,
    });
  }

  if (typeof project.requiredCompanyValue === 'number' && project.requiredCompanyValue > 0) {
    chips.push({
      type: 'company',
      label: `Value ${formatNumber(project.requiredCompanyValue, { currency: true, compact: true })}+`,
    });
  }

  if (typeof project.requiredCompanyAgeWeeks === 'number' && project.requiredCompanyAgeWeeks > 0) {
    chips.push({ type: 'age', label: `Age ${project.requiredCompanyAgeWeeks}w+` });
  }

  if (typeof project.requiredBuyerLoyaltyLevel === 'number' && project.requiredBuyerLoyaltyLevel > 0) {
    chips.push({ type: 'loyalty', label: `Buyer loyalty L${project.requiredBuyerLoyaltyLevel}+` });
  }

  if (project.requiredAchievementIds?.length) {
    chips.push({
      type: 'achievement',
      label: project.requiredAchievementIds.length === 1 ? '1 achievement' : `${project.requiredAchievementIds.length} achievements`,
    });
  }

  return chips;
}

export function getResearchRequirementDetails(
  project: ResearchProject,
  allProjects: ResearchProject[]
): ResearchRequirementDetail[] {
  const details: ResearchRequirementDetail[] = [];
  const projectTitleById = new Map(allProjects.map((candidate) => [candidate.id, candidate.title]));

  if (typeof project.requiredPrestige === 'number' && project.requiredPrestige > 0) {
    details.push({
      label: 'Company Prestige',
      value: `At least ${formatNumber(project.requiredPrestige, { decimals: 0 })}`,
    });
  }

  if (project.prerequisites?.length) {
    const prerequisiteTitles = project.prerequisites.map((id) => projectTitleById.get(id) || id);
    details.push({
      label: 'Prerequisite Research',
      value: prerequisiteTitles.join(', '),
    });
  }

  if (typeof project.requiredCompanyValue === 'number' && project.requiredCompanyValue > 0) {
    details.push({
      label: 'Company Value',
      value: `At least ${formatNumber(project.requiredCompanyValue, { currency: true, decimals: 0 })}`,
    });
  }

  if (typeof project.requiredCompanyAgeWeeks === 'number' && project.requiredCompanyAgeWeeks > 0) {
    details.push({
      label: 'Company Age',
      value: `At least ${project.requiredCompanyAgeWeeks} weeks`,
    });
  }

  if (typeof project.requiredBuyerLoyaltyLevel === 'number' && project.requiredBuyerLoyaltyLevel > 0) {
    details.push({
      label: 'Best Buyer Loyalty',
      value: `Level ${project.requiredBuyerLoyaltyLevel} or higher`,
    });
  }

  if (project.requiredAchievementIds?.length) {
    details.push({
      label: project.requiredAchievementIds.length === 1 ? 'Required Achievement' : 'Required Achievements',
      value: project.requiredAchievementIds
        .map((id) => achievementsFeature.catalog.getTitle(id) || id)
        .join(', '),
    });
  }

  return details;
}

export function getResearchRewardDetails(project: ResearchProject): ResearchRewardDetail[] {
  const details: ResearchRewardDetail[] = [];

  for (const unlock of project.unlocks || []) {
    const detail = formatResearchUnlockDetail(unlock);
    if (detail) {
      details.push(detail);
    }
  }

  for (const effect of project.permanentEffects || []) {
    details.push({
      label: getPermanentEffectLabel(effect.kind),
      value: effect.description || getPermanentEffectFallback(effect.kind, effect.multiplier),
    });
  }

  if (typeof project.rewardAmount === 'number' && project.rewardAmount > 0) {
    details.push({
      label: 'Funding',
      value: `Receive ${formatNumber(project.rewardAmount, { currency: true, decimals: 0 })} on completion`,
    });
  }

  if (typeof project.prestigeReward === 'number' && project.prestigeReward > 0) {
    details.push({
      label: 'Prestige',
      value: `Gain ${formatNumber(project.prestigeReward, { decimals: 1 })} prestige`,
    });
  }

  return details;
}

export function getPrimaryResearchImpact(project: ResearchProject): string {
  return project.benefits[0] || project.description;
}

export function getChainedResearchUnlockType(project: ResearchProject): UnlockType | null {
  const vineyardChainType = getChainedVineyardResearchUnlockType(project);
  if (vineyardChainType) {
    return vineyardChainType;
  }

  const chainedUnlock = project.unlocks?.find(unlock => CHAINED_RESEARCH_UNLOCK_TYPES.has(unlock.type));
  return chainedUnlock?.type ?? null;
}

export function getCurrentChainLimit(
  chainType: UnlockType,
  projects: ResearchProject[],
  completedResearch: Set<string>
): number | null {
  if (chainType === 'staff_limit') {
    let currentLimit = BASE_STAFF_LIMIT;
    for (const project of projects) {
      if (!completedResearch.has(project.id)) {
        continue;
      }

      const unlock = findNumericUnlock(project, chainType);
      if (unlock) {
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

      const unlock = findNumericUnlock(project, chainType);
      if (unlock) {
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

  const chainFrontierByType = new Map<UnlockType, string>();

  for (const project of projects) {
    const chainType = getChainedResearchUnlockType(project);
    if (!chainType || chainFrontierByType.has(chainType) || completedResearch.has(project.id)) {
      continue;
    }

    if (activeResearch.has(project.id)) {
      chainFrontierByType.set(chainType, project.id);
      continue;
    }

    if (hasMissingPrerequisites(project, completedResearch)) {
      continue;
    }

    chainFrontierByType.set(chainType, project.id);
  }

  return projects.filter(project => {
    const chainType = getChainedResearchUnlockType(project);
    if (completedResearch.has(project.id) || activeResearch.has(project.id)) {
      return true;
    }

    if (hasMissingPrerequisites(project, completedResearch)) {
      return false;
    }

    if (!chainType) {
      return true;
    }

    return chainFrontierByType.get(chainType) === project.id;
  });
}

export function getResearchDependencyMetadata(
  project: ResearchProject,
  allProjects: ResearchProject[]
): ResearchDependencyMetadata {
  const projectTitleById = new Map(allProjects.map(candidate => [candidate.id, candidate.title]));
  const prerequisiteLinks = (project.prerequisites || []).map(id => ({
    id,
    title: projectTitleById.get(id) || id,
  }));
  const unlocksNextLinks = allProjects
    .filter(candidate => candidate.prerequisites?.includes(project.id))
    .map(candidate => ({ id: candidate.id, title: candidate.title }));
  const chainType = getChainedResearchUnlockType(project);
  const chainUnlock = chainType ? findNumericUnlock(project, chainType) : null;

  return {
    prerequisiteLinks,
    prerequisiteTitles: prerequisiteLinks.map(link => link.title),
    unlocksNextLinks,
    unlocksNextTitles: unlocksNextLinks.map(link => link.title),
    chainType,
    chainLabel: chainType ? getChainLabel(chainType) : null,
    chainUnlockValue: chainUnlock?.value ?? null,
  };
}

export function buildResearchPresentationRows(
  projects: ResearchProject[],
  allProjects: ResearchProject[] = projects
): ResearchProjectPresentationRow[] {
  return projects.map(project => {
    const dependencyMetadata = getResearchDependencyMetadata(project, allProjects);
    const unlockTypeLabels = Array.from(new Set((project.unlocks || []).map(unlock => getUnlockTypeLabel(unlock.type))));
    const { totalWork } = calculateResearchWork(project.id);

    return {
      project,
      group: getResearchDisplayGroup(project),
      primaryImpact: getPrimaryResearchImpact(project),
      gateChips: getResearchGateChips(project),
      rewardDetails: getResearchRewardDetails(project),
      requirementDetails: getResearchRequirementDetails(project, allProjects),
      prerequisiteLinks: dependencyMetadata.prerequisiteLinks,
      prerequisiteTitles: dependencyMetadata.prerequisiteTitles,
      unlocksNextLinks: dependencyMetadata.unlocksNextLinks,
      unlocksNextTitles: dependencyMetadata.unlocksNextTitles,
      unlockTypeLabels,
      chainType: dependencyMetadata.chainType,
      chainLabel: dependencyMetadata.chainLabel,
      chainUnlockValue: dependencyMetadata.chainUnlockValue,
      totalWork,
      totalCost: calculateResearchCost(project.id),
    };
  });
}

export function buildResearchFootprintSummary(input: {
  projects: ResearchProject[];
  completedResearch: Set<string>;
  activeResearch: Set<string>;
}): ResearchFootprintSummary {
  const completedProjects = input.projects.filter(project => input.completedResearch.has(project.id));
  const activeProjects = input.projects.filter(project =>
    input.activeResearch.has(project.id) && !input.completedResearch.has(project.id)
  );

  return {
    statusCounts: {
      total: input.projects.length,
      completed: completedProjects.length,
      inProgress: activeProjects.length,
      remaining: Math.max(0, input.projects.length - completedProjects.length - activeProjects.length),
    },
    unlockTypeSummaries: buildUnlockTypeSummaries(input.projects, input.completedResearch, input.activeResearch),
    ladderSummaries: buildLadderSummaries(input.projects, input.completedResearch, input.activeResearch),
    chainSummaries: buildResearchChainSummaries(input.projects, input.completedResearch, input.activeResearch),
    completedImpactLines: completedProjects.slice(-6).map(project => `${project.title}: ${getPrimaryResearchImpact(project)}`),
  };
}

export function formatResearchChainValue(chainType: UnlockType, value: number): string {
  return formatChainValue(chainType, value);
}

function hasMissingPrerequisites(project: ResearchProject, completedResearch: Set<string>): boolean {
  return Boolean(project.prerequisites?.some(id => !completedResearch.has(id)));
}

function buildUnlockTypeSummaries(
  projects: ResearchProject[],
  completedResearch: Set<string>,
  activeResearch: Set<string>
): ResearchUnlockTypeSummary[] {
  const summaries = new Map<UnlockType, ResearchUnlockTypeSummary>();

  for (const project of projects) {
    for (const unlock of project.unlocks || []) {
      const existing = summaries.get(unlock.type) || {
        type: unlock.type,
        label: getUnlockTypeLabel(unlock.type),
        totalCount: 0,
        completedCount: 0,
        activeCount: 0,
      };

      existing.totalCount += 1;
      if (completedResearch.has(project.id)) {
        existing.completedCount += 1;
      } else if (activeResearch.has(project.id)) {
        existing.activeCount += 1;
      }

      summaries.set(unlock.type, existing);
    }
  }

  return Array.from(summaries.values()).sort((left, right) => left.label.localeCompare(right.label));
}

function buildLadderSummaries(
  projects: ResearchProject[],
  completedResearch: Set<string>,
  activeResearch: Set<string>
): ResearchLadderSummary[] {
  return LADDER_TYPES.map(chainType => {
    const ladderProjects = projects
      .filter(project => Boolean(findNumericUnlock(project, chainType)))
      .sort((left, right) => {
        const leftValue = findNumericUnlock(left, chainType)?.value ?? Number.MAX_SAFE_INTEGER;
        const rightValue = findNumericUnlock(right, chainType)?.value ?? Number.MAX_SAFE_INTEGER;
        return leftValue - rightValue;
      });

    if (!ladderProjects.length) {
      return null;
    }

    const currentValue = getCurrentChainLimit(chainType, projects, completedResearch);
    if (currentValue === null) {
      return null;
    }

    const nextProject = ladderProjects.find(project => {
      const unlock = findNumericUnlock(project, chainType);
      return !completedResearch.has(project.id) && Boolean(unlock && unlock.value > currentValue);
    }) || null;
    const activeProject = ladderProjects.find(project => activeResearch.has(project.id)) || null;

    return {
      chainType,
      label: getChainLabel(chainType),
      completedSteps: ladderProjects.filter(project => completedResearch.has(project.id)).length,
      totalSteps: ladderProjects.length,
      currentValue,
      currentLabel: formatChainValue(chainType, currentValue),
      nextProjectTitle: nextProject?.title ?? null,
      activeProjectTitle: activeProject?.title ?? null,
    };
  }).filter((summary): summary is ResearchLadderSummary => Boolean(summary));
}

function buildResearchChainSummaries(
  projects: ResearchProject[],
  completedResearch: Set<string>,
  activeResearch: Set<string>
): ResearchChainSummary[] {
  const projectById = new Map(projects.map(project => [project.id, project] as const));
  const childIdsByPrimaryParent = new Map<string, string[]>();
  const hasPrimaryParent = new Set<string>();

  for (const project of projects) {
    const primaryPrerequisiteId = project.prerequisites?.find(prerequisiteId => projectById.has(prerequisiteId));
    if (!primaryPrerequisiteId) {
      continue;
    }

    hasPrimaryParent.add(project.id);
    childIdsByPrimaryParent.set(primaryPrerequisiteId, [
      ...(childIdsByPrimaryParent.get(primaryPrerequisiteId) || []),
      project.id,
    ]);
  }

  for (const [parentId, childIds] of childIdsByPrimaryParent.entries()) {
    childIdsByPrimaryParent.set(parentId, childIds.sort((left, right) => {
      return projects.findIndex(project => project.id === left) - projects.findIndex(project => project.id === right);
    }));
  }

  const paths: string[][] = [];

  function collectPaths(path: string[]): void {
    const currentId = path[path.length - 1];
    const children = childIdsByPrimaryParent.get(currentId) || [];

    if (children.length === 0) {
      paths.push(path);
      return;
    }

    for (const childId of children) {
      if (path.includes(childId)) {
        continue;
      }

      collectPaths([...path, childId]);
    }
  }

  for (const project of projects) {
    if (!childIdsByPrimaryParent.has(project.id) || hasPrimaryParent.has(project.id)) {
      continue;
    }

    collectPaths([project.id]);
  }

  const seenPathIds = new Set<string>();

  return paths
    .map(pathIds => {
      if (pathIds.length < 2) {
        return null;
      }

      const pathKey = pathIds.join('>');
      if (seenPathIds.has(pathKey)) {
        return null;
      }
      seenPathIds.add(pathKey);

      const orderedProjects = pathIds
        .map(id => projectById.get(id))
        .filter((project): project is ResearchProject => Boolean(project));

      if (orderedProjects.length < 2 || orderedProjects.every(project => Boolean(findNumericUnlock(project, getChainedResearchUnlockType(project) as UnlockType)))) {
        return null;
      }

      const completedProjectTitles = orderedProjects.filter(project => completedResearch.has(project.id)).map(project => project.title);
      const activeProject = orderedProjects.find(project => activeResearch.has(project.id)) || null;
      const nextProject = orderedProjects.find(project => !completedResearch.has(project.id)) || null;
      const completedOrderedProjects = orderedProjects.filter(project => completedResearch.has(project.id));
      const lastCompletedProject = completedOrderedProjects.length > 0
        ? completedOrderedProjects[completedOrderedProjects.length - 1]
        : null;

      return {
        chainId: orderedProjects.map(project => project.id).join('__'),
        label: orderedProjects[0]!.title,
        projectIds: orderedProjects.map(project => project.id),
        completedSteps: completedProjectTitles.length,
        totalSteps: orderedProjects.length,
        currentProjectTitle: activeProject?.title ?? lastCompletedProject?.title ?? nextProject?.title ?? null,
        nextProjectTitle: nextProject?.title ?? null,
        activeProjectTitle: activeProject?.title ?? null,
      } satisfies ResearchChainSummary;
    })
    .filter((summary): summary is ResearchChainSummary => Boolean(summary));
}

function findNumericUnlock(project: ResearchProject, type: UnlockType): (ResearchUnlock & { value: number }) | null {
  const unlock = project.unlocks?.find(candidate => candidate.type === type && typeof candidate.value === 'number');
  return unlock && typeof unlock.value === 'number'
    ? { ...unlock, value: unlock.value }
    : null;
}

function getChainLabel(chainType: UnlockType): string {
  if (chainType === 'staff_limit') {
    return 'Staff capacity';
  }

  if (CHAINED_VINEYARD_CAP_UNLOCK_TYPES.has(chainType as VineyardCapUnlockType)) {
    return getVineyardCapacityLabel(chainType as VineyardCapUnlockType);
  }

  return getUnlockTypeLabel(chainType);
}

function formatChainValue(chainType: UnlockType, value: number): string {
  if (chainType === 'staff_limit') {
    return `${value} staff`;
  }

  if (CHAINED_VINEYARD_CAP_UNLOCK_TYPES.has(chainType as VineyardCapUnlockType)) {
    return formatVineyardCapacityValue(chainType as VineyardCapUnlockType, value);
  }

  return String(value);
}

function formatResearchUnlockDetail(unlock: ResearchUnlock): ResearchRewardDetail | null {
  if (unlock.type === 'grape') {
    return {
      label: 'Planting',
      value: `Unlock ${unlock.displayName || unlock.value} for planting`,
    };
  }

  if (unlock.type === 'fermentation_technology') {
    return {
      label: 'Fermentation method',
      value: `Unlock ${unlock.displayName || unlock.value}`,
    };
  }

  if (unlock.type === 'staff_limit') {
    return typeof unlock.value === 'number'
      ? {
          label: 'Staff capacity',
          value: `Increase max to ${formatChainValue(unlock.type, unlock.value)}`,
        }
      : null;
  }

  if (CHAINED_VINEYARD_CAP_UNLOCK_TYPES.has(unlock.type as VineyardCapUnlockType)) {
    return typeof unlock.value === 'number'
      ? {
          label: getChainLabel(unlock.type),
          value: `Increase max to ${formatChainValue(unlock.type, unlock.value)}`,
        }
      : null;
  }

  return {
    label: getUnlockTypeLabel(unlock.type),
    value: String(unlock.displayName || unlock.value),
  };
}

function getPermanentEffectLabel(kind: ResearchPermanentEffect['kind']): string {
  switch (kind) {
    case 'research_skill_multiplier':
      return 'Research speed';
    case 'administration_and_research_work_multiplier':
      return 'Admin & research work';
    case 'all_staff_work_multiplier':
      return 'All staff work';
    case 'vineyard_health_decay_multiplier':
      return 'Vineyard resilience';
    default:
      return 'Permanent effect';
  }
}

function getPermanentEffectFallback(
  kind: ResearchPermanentEffect['kind'],
  multiplier: number
): string {
  switch (kind) {
    case 'research_skill_multiplier':
      return `Research tasks run at x${formatNumber(multiplier, { decimals: 2 })} speed`;
    case 'administration_and_research_work_multiplier':
      return `Administration and research tasks use x${formatNumber(multiplier, { decimals: 2 })} work`;
    case 'all_staff_work_multiplier':
      return `All staff work runs at x${formatNumber(multiplier, { decimals: 2 })} speed`;
    case 'vineyard_health_decay_multiplier':
      return `Vineyard health decay changes to x${formatNumber(multiplier, { decimals: 2 })}`;
    default:
      return `Multiplier x${formatNumber(multiplier, { decimals: 2 })}`;
  }
}
