import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Separator, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { Beaker, Compass, FlaskConical, Grape, Landmark, Network } from 'lucide-react';
import { WorkCategory } from '@/lib/types/types';
import { RESEARCH_PROJECTS, type ResearchProject, type ResearchUnlock } from '@/lib/constants/researchConstants';
import { getAllActivities } from '@/lib/services';
import { useGameUpdates } from '@/hooks/useGameUpdates';
import { calculateResearchCost, calculateResearchWork } from '@/lib/services';
import { getResearchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { getUnlockedResearchIds } from '@/lib/database';
import {
  type ResearchEligibilityContext,
  getResearchPermanentEffects,
  getResearchRequirementReasons,
  isResearchProjectEligible,
  loadResearchEligibilityContext,
} from '@/lib/services';
import { formatNumber } from '@/lib/utils/utils';
import {
  CHAINED_VINEYARD_CAP_UNLOCK_TYPES,
  getChainedVineyardResearchUnlockType,
} from '@/lib/services/vineyard/vineyardCapacityService';
import { getCurrentPrestige } from '@/lib/services';

const CHAINED_RESEARCH_UNLOCK_TYPES = new Set<string>(['staff_limit', ...CHAINED_VINEYARD_CAP_UNLOCK_TYPES]);

type ResearchStatus = 'available' | 'in-progress' | 'completed' | 'locked';
type ViewMode = 'focus' | 'full';
type SortMode = 'recommended' | 'cost' | 'work' | 'complexity';
type GroupId = 'governance' | 'capacity' | 'technology' | 'commercial' | 'varietal';
type GroupTab = 'all' | GroupId;

interface GroupDefinition {
  id: GroupId;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  theme: {
    border: string;
    background: string;
    accent: string;
    soft: string;
  };
}

interface ResearchPanelProps {
  bypassGates?: boolean;
  view?: 'catalog' | 'footprint' | 'both';
}

interface ResearchCardModel {
  project: ResearchProject;
  status: ResearchStatus;
  lockReason: string;
  totalWork: number;
  totalCost: number;
  chainType: string | null;
  impactSummary: {
    primary: string;
    additionalCount: number;
  };
}

const GROUPS: GroupDefinition[] = [
  {
    id: 'governance',
    title: 'Governance Foundations',
    description: 'Administrative baseline, grants, and foundational operating projects.',
    icon: Landmark,
    theme: {
      border: 'border-sky-200',
      background: 'bg-sky-50/60',
      accent: 'text-sky-800',
      soft: 'text-sky-700',
    },
  },
  {
    id: 'capacity',
    title: 'Capacity Progression',
    description: 'Staff and vineyard scaling ladders with chained progression frontiers.',
    icon: Compass,
    theme: {
      border: 'border-emerald-200',
      background: 'bg-emerald-50/60',
      accent: 'text-emerald-800',
      soft: 'text-emerald-700',
    },
  },
  {
    id: 'technology',
    title: 'Technology Systems',
    description: 'Process and vineyard technology unlocks that alter long-term capability.',
    icon: FlaskConical,
    theme: {
      border: 'border-violet-200',
      background: 'bg-violet-50/60',
      accent: 'text-violet-800',
      soft: 'text-violet-700',
    },
  },
  {
    id: 'commercial',
    title: 'Commercial Channels',
    description: 'Market access, contract channels, and buyer progression pipelines.',
    icon: Network,
    theme: {
      border: 'border-amber-200',
      background: 'bg-amber-50/70',
      accent: 'text-amber-800',
      soft: 'text-amber-700',
    },
  },
  {
    id: 'varietal',
    title: 'Varietal Catalog',
    description: 'Grape variety research with complexity-driven progression pacing.',
    icon: Grape,
    theme: {
      border: 'border-rose-200',
      background: 'bg-rose-50/70',
      accent: 'text-rose-800',
      soft: 'text-rose-700',
    },
  },
];

function getChainedResearchUnlockType(project: ResearchProject): string | null {
  const vineyardChainType = getChainedVineyardResearchUnlockType(project);
  if (vineyardChainType) {
    return vineyardChainType;
  }

  const chainedUnlock = project.unlocks?.find((unlock) => CHAINED_RESEARCH_UNLOCK_TYPES.has(unlock.type));
  return chainedUnlock?.type ?? null;
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

  return projects.filter((project) => {
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

function hasMissingPrerequisites(project: ResearchProject, completedResearch: Set<string>): boolean {
  return Boolean(project.prerequisites?.some((id) => !completedResearch.has(id)));
}

function getStatusBadgeVariant(status: ResearchStatus): 'secondary' | 'outline' | 'default' {
  if (status === 'completed') return 'default';
  if (status === 'locked') return 'outline';
  return 'secondary';
}

function toUnlockLabel(unlock: ResearchUnlock): string {
  if (unlock.displayName) {
    return unlock.displayName;
  }

  switch (unlock.type) {
    case 'staff_limit':
      return `Staff cap ${unlock.value}`;
    case 'vineyard_size':
      return `Vineyard size ${unlock.value} ha`;
    case 'total_vineyard_hectares':
      return `Total vineyard area ${unlock.value} ha`;
    case 'vineyard_count':
      return `Vineyard count ${unlock.value}`;
    case 'contract_type':
      return `Contract type ${unlock.value}`;
    case 'grape':
      return `Grape ${unlock.value}`;
    case 'fermentation_technology':
      return `Fermentation ${unlock.value}`;
    case 'grape_buyer_slots':
      return `Buyer slots ${unlock.value}`;
    case 'grape_buyer_limit_multiplier':
      return `Buyer hard limit x${unlock.value}`;
    case 'grape_buyer_multiplier_bonus':
      return `Buyer multiplier +${unlock.value}`;
    case 'grape_buyer_country_access':
      return `Buyer access ${unlock.value}`;
    case 'wine_feature':
      return `Wine feature ${unlock.value}`;
    default:
      return `${unlock.type} ${String(unlock.value)}`;
  }
}

function toReadableToken(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readableChainType(chainType: string | null): string {
  if (!chainType) return '';
  return toReadableToken(chainType);
}

function toReadableProjectReference(projectId: string): string {
  return toReadableToken(projectId);
}

function buildImpactSummary(project: ResearchProject): { primary: string; additionalCount: number } {
  const unlockLabels = (project.unlocks || []).map((unlock) => toUnlockLabel(unlock));
  const effectLabels = (project.permanentEffects || []).map((effect) => effect.description || effect.kind);
  const allLabels = [...unlockLabels, ...effectLabels];

  if (allLabels.length > 0) {
    return {
      primary: allLabels[0],
      additionalCount: Math.max(0, allLabels.length - 1),
    };
  }

  return {
    primary: project.benefits[0] || 'Research capability upgrade',
    additionalCount: Math.max(0, project.benefits.length - 1),
  };
}

function projectGroup(project: ResearchProject): GroupId {
  const unlockTypes = new Set((project.unlocks || []).map((unlock) => unlock.type));

  if (unlockTypes.has('grape')) {
    return 'varietal';
  }

  if (
    unlockTypes.has('contract_type') ||
    unlockTypes.has('grape_buyer_slots') ||
    unlockTypes.has('grape_buyer_limit_multiplier') ||
    unlockTypes.has('grape_buyer_multiplier_bonus') ||
    unlockTypes.has('grape_buyer_country_access') ||
    project.category === 'marketing'
  ) {
    return 'commercial';
  }

  if (
    unlockTypes.has('staff_limit') ||
    unlockTypes.has('vineyard_size') ||
    unlockTypes.has('total_vineyard_hectares') ||
    unlockTypes.has('vineyard_count') ||
    project.category === 'staff' ||
    project.category === 'efficiency'
  ) {
    return 'capacity';
  }

  if (project.category === 'technology' || project.category === 'agriculture') {
    return 'technology';
  }

  return 'governance';
}

export function ResearchPanel({ bypassGates = false, view = 'both' }: ResearchPanelProps) {
  const [activeResearch, setActiveResearch] = useState<Set<string>>(new Set());
  const [completedResearch, setCompletedResearch] = useState<Set<string>>(new Set());
  const [completedResearchOrder, setCompletedResearchOrder] = useState<string[]>([]);
  const [currentPrestige, setCurrentPrestige] = useState<number>(0);
  const [eligibilityContext, setEligibilityContext] = useState<ResearchEligibilityContext | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [expandedProjectId, setExpandedProjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<GroupTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('focus');
  const [sortMode, setSortMode] = useState<SortMode>('recommended');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ResearchStatus>('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [permanentEffectsSummary, setPermanentEffectsSummary] = useState<{
    vineyardHealthDecayMultiplier: number;
    administrationAndResearchWorkMultiplier: number;
    activeEffects: Array<{ projectId: string; projectTitle: string; description: string; kind: string }>;
  }>({
    vineyardHealthDecayMultiplier: 1,
    administrationAndResearchWorkMultiplier: 1,
    activeEffects: [],
  });

  const { subscribe } = useGameUpdates();

  const groupById = useMemo(() => {
    const map = new Map<GroupId, GroupDefinition>();
    for (const group of GROUPS) {
      map.set(group.id, group);
    }
    return map;
  }, []);

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
    // Subscribe identity is stable from hook and needed for real-time updates.
  }, [subscribe]);

  const loadResearchStatus = async () => {
    const [activities, completedIds, prestige, effects] = await Promise.all([
      getAllActivities(),
      getUnlockedResearchIds(),
      getCurrentPrestige(),
      getResearchPermanentEffects(),
    ]);

    const researchActivities = activities.filter((activity) => activity.category === WorkCategory.ADMINISTRATION_AND_RESEARCH);

    const active = new Set<string>();
    researchActivities.forEach((activity) => {
      const researchId = activity.params?.researchId;
      if (researchId && activity.status === 'active') {
        active.add(researchId as string);
      }
    });

    const completedSet = new Set(completedIds);
    const context = await loadResearchEligibilityContext(prestige, completedSet);

    setActiveResearch(active);
    setCompletedResearch(completedSet);
    setCompletedResearchOrder(completedIds);
    setCurrentPrestige(prestige);
    setEligibilityContext(context);
    setPermanentEffectsSummary(effects);
  };

  const handleStartResearch = async (project: ResearchProject) => {
    if (activeResearch.has(project.id) || completedResearch.has(project.id)) {
      return;
    }

    await getResearchUpgradeFeature().workflow.startResearch(project.id);
    await loadResearchStatus();
  };

  const getResearchStatus = (project: ResearchProject): ResearchStatus => {
    if (completedResearch.has(project.id)) return 'completed';
    if (activeResearch.has(project.id)) return 'in-progress';

    if (!bypassGates) {
      const context =
        eligibilityContext || {
          currentPrestige,
          completedResearch,
          companyValue: Number.MAX_SAFE_INTEGER,
          companyAgeWeeks: Number.MAX_SAFE_INTEGER,
          maxBuyerLoyaltyLevel: 3 as const,
          unlockedAchievementIds: new Set((project.requiredAchievementIds || []).map((id) => id)),
        };

      if (!isResearchProjectEligible(project, context)) {
        return 'locked';
      }
    }

    return 'available';
  };

  const getLockReason = (project: ResearchProject): string => {
    const context =
      eligibilityContext || {
        currentPrestige,
        completedResearch,
        companyValue: Number.MAX_SAFE_INTEGER,
        companyAgeWeeks: Number.MAX_SAFE_INTEGER,
        maxBuyerLoyaltyLevel: 3 as const,
        unlockedAchievementIds: new Set((project.requiredAchievementIds || []).map((id) => id)),
      };

    const reasons = getResearchRequirementReasons(project, context).map((reason) => {
      if (reason.startsWith('Complete prerequisite research: ')) {
        const rawIds = reason.replace('Complete prerequisite research: ', '').split(', ').filter(Boolean);
        const missingTitles = rawIds.map((id) => RESEARCH_PROJECTS.find((candidate) => candidate.id === id)?.title ?? id);
        return `Complete first: ${missingTitles.join(', ')}`;
      }
      return reason;
    });

    return reasons.join(' | ');
  };

  const projectModels = useMemo(() => {
    const models = RESEARCH_PROJECTS.map((project) => {
      const status = getResearchStatus(project);
      const lockReason = status === 'locked' ? getLockReason(project) : '';
      const { totalWork } = calculateResearchWork(project.id, {
        workMultiplier: permanentEffectsSummary.administrationAndResearchWorkMultiplier,
      });
      const totalCost = calculateResearchCost(project.id);

      return {
        project,
        status,
        lockReason,
        totalWork,
        totalCost,
        chainType: getChainedResearchUnlockType(project),
        impactSummary: buildImpactSummary(project),
      } as ResearchCardModel;
    });

    return models;
    // Computed each render from current state; safe due moderate catalog size.
  }, [activeResearch, completedResearch, currentPrestige, eligibilityContext, bypassGates, permanentEffectsSummary.administrationAndResearchWorkMultiplier]);

  const unlockFootprint = useMemo(() => {
    const counts = new Map<string, number>();

    for (const model of projectModels) {
      if (model.status !== 'completed') continue;
      for (const unlock of model.project.unlocks || []) {
        const label = toReadableToken(unlock.type);
        counts.set(label, (counts.get(label) || 0) + 1);
      }
    }

    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [projectModels]);

  const groupedModels = useMemo(() => {
    const byGroup = new Map<GroupId, ResearchCardModel[]>();
    for (const group of GROUPS) {
      byGroup.set(group.id, []);
    }

    for (const model of projectModels) {
      byGroup.get(projectGroup(model.project))?.push(model);
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const applySort = (models: ResearchCardModel[]): ResearchCardModel[] => {
      if (sortMode === 'recommended') {
        return models;
      }

      const sorted = [...models];
      sorted.sort((a, b) => {
        if (sortMode === 'cost') return a.totalCost - b.totalCost;
        if (sortMode === 'work') return a.totalWork - b.totalWork;
        return a.project.complexity - b.project.complexity;
      });
      return sorted;
    };

    const filtered = new Map<GroupId, ResearchCardModel[]>();

    for (const group of GROUPS) {
      const groupModels = byGroup.get(group.id) || [];
      const visibleBase =
        viewMode === 'focus'
          ? getVisibleResearchProjects(
              groupModels.map((model) => model.project),
              completedResearch,
              activeResearch,
              bypassGates
            )
          : groupModels.map((model) => model.project);

      const visibleIds = new Set(visibleBase.map((project) => project.id));

      const next = groupModels.filter((model) => {
        if (!visibleIds.has(model.project.id)) return false;

        if (hideCompleted && model.status === 'completed') {
          return false;
        }

        if (statusFilter !== 'all' && model.status !== statusFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchable = [
          model.project.title,
          model.project.id,
          model.project.description,
          model.impactSummary.primary,
          ...(model.project.benefits || []),
        ]
          .join(' ')
          .toLowerCase();

        return searchable.includes(normalizedSearch);
      });

      filtered.set(group.id, applySort(next));
    }

    return filtered;
  }, [
    projectModels,
    viewMode,
    completedResearch,
    activeResearch,
    bypassGates,
    hideCompleted,
    statusFilter,
    searchTerm,
    sortMode,
  ]);

  const allVisibleModels = useMemo(() => {
    const list: ResearchCardModel[] = [];
    const targetGroups = activeTab === 'all' ? GROUPS.map((group) => group.id) : [activeTab];
    for (const groupId of targetGroups) {
      list.push(...(groupedModels.get(groupId) || []));
    }
    return list;
  }, [groupedModels, activeTab]);

  useEffect(() => {
    if (!allVisibleModels.length) {
      setSelectedProjectId('');
      return;
    }

    const exists = allVisibleModels.some((model) => model.project.id === selectedProjectId);
    if (!exists) {
      setSelectedProjectId(allVisibleModels[0].project.id);
    }
  }, [allVisibleModels, selectedProjectId]);

  const selectedModel = useMemo(
    () => allVisibleModels.find((model) => model.project.id === selectedProjectId) || null,
    [allVisibleModels, selectedProjectId]
  );

  const selectedDependents = useMemo(() => {
    if (!selectedModel) return [];

    return RESEARCH_PROJECTS.filter((project) => (project.prerequisites || []).includes(selectedModel.project.id));
  }, [selectedModel]);

  const selectedPrerequisites = useMemo(() => {
    if (!selectedModel) return [];

    const prerequisiteIds = selectedModel.project.prerequisites || [];
    return prerequisiteIds
      .map((id) => RESEARCH_PROJECTS.find((project) => project.id === id))
      .filter((project): project is ResearchProject => Boolean(project));
  }, [selectedModel]);

  const selectedChainContext = useMemo(() => {
    if (!selectedModel?.chainType) return null;

    const chainProjects = RESEARCH_PROJECTS.filter((project) => getChainedResearchUnlockType(project) === selectedModel.chainType)
      .map((project) => {
        const unlock = project.unlocks?.find((candidate) => candidate.type === selectedModel.chainType && typeof candidate.value === 'number');
        return {
          project,
          value: unlock && typeof unlock.value === 'number' ? unlock.value : Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((a, b) => a.value - b.value)
      .map((entry) => entry.project);

    const currentIndex = chainProjects.findIndex((project) => project.id === selectedModel.project.id);
    const previous = currentIndex > 0 ? chainProjects[currentIndex - 1] : null;
    const next = currentIndex >= 0 && currentIndex < chainProjects.length - 1 ? chainProjects[currentIndex + 1] : null;

    return {
      chainType: selectedModel.chainType,
      previous,
      next,
      size: chainProjects.length,
    };
  }, [selectedModel]);

  const recentImpactModels = useMemo(() => {
    const ordered = completedResearchOrder.length ? completedResearchOrder : Array.from(completedResearch);
    const recentIds = [...ordered].slice(-5).reverse();

    return recentIds
      .map((id) => projectModels.find((model) => model.project.id === id))
      .filter((model): model is ResearchCardModel => Boolean(model));
  }, [completedResearchOrder, completedResearch, projectModels]);

  const groupStats = useMemo(() => {
    const map = new Map<GroupId, { total: number; completed: number; frontier: number }>();

    for (const group of GROUPS) {
      const models = groupedModels.get(group.id) || [];
      map.set(group.id, {
        total: models.length,
        completed: models.filter((model) => model.status === 'completed').length,
        frontier: models.filter((model) => model.status === 'available' || model.status === 'in-progress').length,
      });
    }

    return map;
  }, [groupedModels]);

  const renderRow = (model: ResearchCardModel) => {
    const isSelected = selectedProjectId === model.project.id;
    const isExpanded = expandedProjectId === model.project.id;
    const isDisabled = model.status === 'completed' || model.status === 'in-progress' || model.status === 'locked';
    const group = groupById.get(projectGroup(model.project));
    const GroupIcon = group?.icon || Beaker;

    return (
      <div
        key={model.project.id}
        className={`rounded-md border px-3 py-2 transition-colors ${
          isSelected ? `${group?.theme.border || 'border-slate-900'} ${group?.theme.background || 'bg-slate-50'}` : 'border-slate-200 bg-white'
        } ${model.status === 'completed' ? 'opacity-80' : ''}`}
        onClick={() => setSelectedProjectId(model.project.id)}
      >
        <div className="grid gap-2 md:grid-cols-[minmax(0,1.7fr)_minmax(0,2.3fr)_auto_auto] md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <GroupIcon className={`h-3.5 w-3.5 ${group?.theme.soft || 'text-slate-600'}`} />
              <Badge variant={getStatusBadgeVariant(model.status)} className="text-[10px] uppercase tracking-wide">
                {model.status === 'in-progress' ? 'In Progress' : model.status}
              </Badge>
              <p className="text-xs font-semibold leading-snug text-slate-900 break-words">{model.project.title}</p>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-600 break-words">{model.project.description}</p>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] leading-snug text-slate-700 break-words">
              {model.impactSummary.primary}
              {model.impactSummary.additionalCount > 0 ? ` (+${model.impactSummary.additionalCount})` : ''}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {typeof model.project.requiredPrestige === 'number' ? (
                <Badge variant="outline" className="text-[10px]">P{model.project.requiredPrestige}</Badge>
              ) : null}
              {model.project.prerequisites?.length ? (
                <Badge variant="outline" className="text-[10px]">Prereq {model.project.prerequisites.length}</Badge>
              ) : null}
              {typeof model.project.requiredCompanyValue === 'number' ? (
                <Badge variant="outline" className="text-[10px]">Value gate</Badge>
              ) : null}
              {typeof model.project.requiredCompanyAgeWeeks === 'number' ? (
                <Badge variant="outline" className="text-[10px]">Age gate</Badge>
              ) : null}
              {typeof model.project.requiredBuyerLoyaltyLevel === 'number' ? (
                <Badge variant="outline" className="text-[10px]">Loyalty gate</Badge>
              ) : null}
              {model.chainType ? (
                <Badge variant="secondary" className="text-[10px]">{readableChainType(model.chainType)}</Badge>
              ) : null}
            </div>
          </div>

          <div className="text-[11px] text-slate-700 md:text-right">
            <div>{formatNumber(model.totalCost, { currency: true, decimals: 0 })}</div>
            <div>{model.totalWork.toLocaleString()} work</div>
            <div>C{model.project.complexity}/10</div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                handleStartResearch(model.project);
              }}
              disabled={isDisabled}
              className="h-7 px-2 text-[11px]"
            >
              {model.status === 'completed'
                ? 'Completed'
                : model.status === 'in-progress'
                ? 'Running'
                : model.status === 'locked'
                ? 'Locked'
                : 'Start'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={(event) => {
                event.stopPropagation();
                setExpandedProjectId(isExpanded ? '' : model.project.id);
              }}
            >
              {isExpanded ? 'Less' : 'More'}
            </Button>
          </div>
        </div>

        {isExpanded ? (
          <div className="mt-2 space-y-2 border-t border-slate-200 pt-2 text-[11px] text-slate-700">
            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
              Project Label: {toReadableProjectReference(model.project.id)}
            </div>
            {model.status === 'locked' && model.lockReason ? (
              <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">{model.lockReason}</div>
            ) : null}
            {model.project.benefits.length ? (
              <div>
                <p className="font-semibold text-slate-800">Benefits</p>
                <ul className="mt-1 space-y-0.5">
                  {model.project.benefits.map((benefit, index) => (
                    <li key={`${model.project.id}-benefit-${index}`}>- {benefit}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const showFootprintCard = view !== 'catalog';
  const showProgressionCard = view !== 'footprint';

  return (
    <div className="space-y-4">
      {showFootprintCard ? (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Research Effects and Unlock Footprint</CardTitle>
          <CardDescription className="text-xs">
            Mechanical overview of active research effects and completed unlock distribution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Health decay x{permanentEffectsSummary.vineyardHealthDecayMultiplier.toFixed(2)}</Badge>
            <Badge variant="outline">Completed {completedResearch.size}</Badge>
            <Badge variant="outline">Active {activeResearch.size}</Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1 font-semibold text-slate-800">Active Permanent Effects</p>
              {permanentEffectsSummary.activeEffects.length ? (
                <div className="space-y-1">
                  {permanentEffectsSummary.activeEffects.map((effect) => (
                    <div key={`${effect.projectId}-${effect.kind}`} className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-900">
                      {effect.projectTitle}: {effect.description}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded border border-dashed border-slate-300 px-2 py-1 text-slate-500">No permanent effects active.</div>
              )}
            </div>

            <div>
              <p className="mb-1 font-semibold text-slate-800">Unlock Footprint</p>
              {unlockFootprint.length ? (
                <div className="flex flex-wrap gap-1">
                  {unlockFootprint.map(([label, count]) => (
                    <Badge key={label} variant="outline" className="text-[10px]">
                      {label}: {count}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="rounded border border-dashed border-slate-300 px-2 py-1 text-slate-500">No unlocks completed yet.</div>
              )}

              <p className="mb-1 mt-3 font-semibold text-slate-800">Recent Impact Feed</p>
              {recentImpactModels.length ? (
                <div className="space-y-1">
                  {recentImpactModels.map((model) => (
                    <div key={`recent-${model.project.id}`} className="rounded border border-slate-200 px-2 py-1">
                      {model.project.title}: {model.impactSummary.primary}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded border border-dashed border-slate-300 px-2 py-1 text-slate-500">No recent research completions.</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {showProgressionCard ? (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Research Progression</CardTitle>
          <CardDescription className="text-xs">
            Tabbed compact progression with dependency path map, readable labels, and chain flow context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GroupTab)}>
            <TabsList className="mb-3 grid h-auto grid-cols-3 gap-1 p-1 lg:grid-cols-6">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              {GROUPS.map((group) => {
                const Icon = group.icon;
                return (
                  <TabsTrigger key={`tab-${group.id}`} value={group.id} className="flex items-center gap-1 text-xs">
                    <Icon className="h-3.5 w-3.5" />
                    {group.title.split(' ')[0]}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={activeTab} className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-6">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search project or effect"
              className="h-8 text-xs lg:col-span-2"
            />

            <select
              value={viewMode}
              onChange={(event) => setViewMode(event.target.value as ViewMode)}
              className="h-8 rounded border border-slate-300 px-2 text-xs"
            >
              <option value="focus">Focus</option>
              <option value="full">Full tree</option>
            </select>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-8 rounded border border-slate-300 px-2 text-xs"
            >
              <option value="recommended">Recommended sort</option>
              <option value="cost">Cost asc</option>
              <option value="work">Work asc</option>
              <option value="complexity">Complexity asc</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | ResearchStatus)}
              className="h-8 rounded border border-slate-300 px-2 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="available">Available</option>
              <option value="in-progress">In progress</option>
              <option value="locked">Locked</option>
              <option value="completed">Completed</option>
            </select>

            <label className="flex h-8 items-center gap-2 rounded border border-slate-300 px-2 text-xs">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(event) => setHideCompleted(event.target.checked)}
              />
              Hide completed
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2.3fr_1fr]">
            <div className="space-y-3">
              {(activeTab === 'all' ? GROUPS : GROUPS.filter((group) => group.id === activeTab)).map((group) => {
                const models = groupedModels.get(group.id) || [];
                const stats = groupStats.get(group.id) || { total: 0, completed: 0, frontier: 0 };
                const Icon = group.icon;

                return (
                  <div key={group.id} className={`rounded-lg border p-3 ${group.theme.border} ${group.theme.background}`}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className={`flex items-center gap-1 text-sm font-semibold ${group.theme.accent}`}>
                          <Icon className="h-4 w-4" />
                          {group.title}
                        </p>
                        <p className={`text-[11px] ${group.theme.soft}`}>{group.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <Badge variant="outline">Visible {stats.total}</Badge>
                        <Badge variant="outline">Completed {stats.completed}</Badge>
                        <Badge variant="outline">Frontier {stats.frontier}</Badge>
                      </div>
                    </div>

                    {models.length ? (
                      <div className="space-y-1.5">{models.map((model) => renderRow(model))}</div>
                    ) : (
                      <div className="rounded border border-dashed border-slate-300 bg-white/80 px-2 py-3 text-[11px] text-slate-500">
                        No projects match the current filters.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Card className="h-fit lg:sticky lg:top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Dependency Side Map</CardTitle>
                <CardDescription className="text-xs">Selected project dependency context and chain neighbors.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {selectedModel ? (
                  <>
                    <div>
                      <p className="font-semibold text-slate-900">{selectedModel.project.title}</p>
                      <p className="text-slate-600">{selectedModel.project.description}</p>
                    </div>

                    <Separator />

                    <div>
                      <p className="mb-1 font-semibold text-slate-800">Dependency Path</p>
                      {selectedPrerequisites.length ? (
                        <div className="mb-2 rounded border border-slate-200 bg-slate-50 px-2 py-1">
                          {selectedPrerequisites.map((project) => project.title).join(' -> ')}{' -> '}{selectedModel.project.title}
                        </div>
                      ) : (
                        <div className="mb-2 rounded border border-slate-200 bg-slate-50 px-2 py-1">
                          Start Node{' -> '}{selectedModel.project.title}
                        </div>
                      )}

                      <p className="mb-1 font-semibold text-slate-800">Prerequisites</p>
                      {selectedPrerequisites.length ? (
                        <div className="space-y-1">
                          {selectedPrerequisites.map((project) => {
                            const status = completedResearch.has(project.id) ? 'completed' : 'missing';
                            return (
                              <div key={`prereq-${project.id}`} className="rounded border border-slate-200 px-2 py-1">
                                {project.title} ({status})
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-slate-500">No prerequisites.</p>
                      )}
                    </div>

                    <div>
                      <p className="mb-1 font-semibold text-slate-800">Unlocks Next</p>
                      {selectedDependents.length ? (
                        <div className="mb-2 rounded border border-slate-200 bg-slate-50 px-2 py-1">
                          {selectedModel.project.title}{' -> '}{selectedDependents.slice(0, 3).map((project) => project.title).join(' -> ')}
                        </div>
                      ) : null}
                      {selectedDependents.length ? (
                        <div className="space-y-1">
                          {selectedDependents.slice(0, 6).map((project) => (
                            <div key={`dependent-${project.id}`} className="rounded border border-slate-200 px-2 py-1">
                              {project.title}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500">No direct dependents.</p>
                      )}
                    </div>

                    <div>
                      <p className="mb-1 font-semibold text-slate-800">Chain Context</p>
                      {selectedChainContext ? (
                        <div className="space-y-1">
                          <div className="rounded border border-slate-200 px-2 py-1">Chain: {readableChainType(selectedChainContext.chainType)}</div>
                          <div className="rounded border border-slate-200 px-2 py-1">Steps in chain: {selectedChainContext.size}</div>
                          <div className="rounded border border-slate-200 px-2 py-1">
                            Previous: {selectedChainContext.previous ? selectedChainContext.previous.title : 'none'}
                          </div>
                          <div className="rounded border border-slate-200 px-2 py-1">
                            Next: {selectedChainContext.next ? selectedChainContext.next.title : 'none'}
                          </div>
                          <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                            {(selectedChainContext.previous ? `${selectedChainContext.previous.title} -> ` : '') +
                              selectedModel.project.title +
                              (selectedChainContext.next ? ` -> ${selectedChainContext.next.title}` : '')}
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500">Not part of a numeric ladder chain.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500">Select a project to inspect dependencies.</p>
                )}
              </CardContent>
            </Card>
          </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
