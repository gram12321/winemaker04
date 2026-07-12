import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  TooltipRow,
  TooltipSection,
  UnifiedTooltip,
} from '@/components/ui';
import { Progress } from '@/components/ui/shadCN/progress';
import { RESEARCH_PROJECTS, type ResearchProject, type UnlockType } from '@/lib/constants/researchConstants';
import { getUnlockedResearchIds } from '@/lib/database';
import { getResearchUpgradeFeature } from '@/lib/features/researchUpgrade';
import {
  buildResearchFootprintSummary,
  buildResearchPresentationRows,
  formatResearchChainValue,
  getResearchDisplayGroup,
  getVisibleResearchProjects,
  type ResearchDisplayGroupId,
  type ResearchProjectPresentationRow,
} from '@/lib/features/researchUpgrade/services/research/researchPresentationService';
import { getResearchPermanentEffects, type ResearchPermanentEffectsSummary } from '@/lib/features/researchUpgrade/services/research/researchPermanentEffectsService';
import {
  getResearchRequirementReasons,
  isResearchProjectEligible,
  loadResearchEligibilityContext,
  type ResearchEligibilityContext,
} from '@/lib/features/researchUpgrade/services/research/researchEligibilityService';
import { getResearchViewSummary } from '@/lib/features/researchUpgrade/services/research/researchViewService';
import { calculateResearchCost, calculateResearchWork, getAllActivities, getCurrentPrestige } from '@/lib/services';
import { WorkCategory } from '@/lib/types/types';
import { formatNumber } from '@/lib/utils';
import { useGameUpdates } from '@/hooks/useGameUpdates';
import { ChevronRight, CircleDot, Compass, FlaskConical, Grape, Landmark, Network } from 'lucide-react';

const RESEARCH_HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?w=1600&h=700&fit=crop';

type ResearchStatus = 'available' | 'in-progress' | 'completed' | 'locked';
type ViewMode = 'focus' | 'full';
type ResearchGroupFilter = 'all' | ResearchDisplayGroupId;

interface ResearchWorkspaceProps {
  bypassGates?: boolean;
  readOnly?: boolean;
  variant?: 'player' | 'admin';
}

interface ResearchProjectModel {
  project: ResearchProject;
  presentation: ResearchProjectPresentationRow;
  status: ResearchStatus;
  lockReason: string;
  totalWork: number;
  totalCost: number;
}

interface ResearchMapLane {
  id: string;
  label: string;
  detail: string;
  models: ResearchProjectModel[];
  completedSteps: number;
  totalSteps: number;
  progress: number;
}

type RequirementStatus = 'met' | 'blocked';

const GROUP_ICONS: Record<ResearchDisplayGroupId, typeof Landmark> = {
  foundation_governance: Landmark,
  vineyard_capacity: Compass,
  winemaking_technology: FlaskConical,
  market_commercial: Network,
  varietal_research: Grape,
};

const STATUS_VARIANTS: Record<ResearchStatus, 'default' | 'secondary' | 'outline'> = {
  available: 'secondary',
  'in-progress': 'default',
  completed: 'default',
  locked: 'outline',
};

const STATUS_LABELS: Record<ResearchStatus, string> = {
  available: 'Available',
  'in-progress': 'Running',
  completed: 'Completed',
  locked: 'Locked',
};

const NODE_STATUS_CLASSES: Record<ResearchStatus, string> = {
  available: 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm',
  'in-progress': 'border-sky-500 bg-sky-50 text-sky-950 shadow-sm',
  completed: 'border-slate-300 bg-slate-100 text-slate-700',
  locked: 'border-slate-200 bg-white text-slate-500',
};

const SELECTED_NODE_CLASS = 'ring-2 ring-slate-900 ring-offset-2';

function getProjectStatus(
  project: ResearchProject,
  activeResearch: Set<string>,
  completedResearch: Set<string>,
  currentPrestige: number,
  eligibilityContext: ResearchEligibilityContext | null,
  bypassGates: boolean
): ResearchStatus {
  if (completedResearch.has(project.id)) return 'completed';
  if (activeResearch.has(project.id)) return 'in-progress';

  if (bypassGates) {
    return 'available';
  }

  const context =
    eligibilityContext || {
      currentPrestige,
      completedResearch,
      companyValue: Number.MAX_SAFE_INTEGER,
      companyAgeWeeks: Number.MAX_SAFE_INTEGER,
      maxBuyerLoyaltyLevel: 10,
      unlockedAchievementIds: new Set((project.requiredAchievementIds || []).map((id) => id)),
    };

  return isResearchProjectEligible(project, context) ? 'available' : 'locked';
}

function formatLockReason(project: ResearchProject, context: ResearchEligibilityContext): string {
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

function groupStatSummary(models: ResearchProjectModel[]) {
  return {
    total: models.length,
    completed: models.filter((model) => model.status === 'completed').length,
    running: models.filter((model) => model.status === 'in-progress').length,
    available: models.filter((model) => model.status === 'available').length,
  };
}

function getGateLabel(model: ResearchProjectModel): string {
  return model.presentation.gateChips.length
    ? `${model.presentation.gateChips.length} requirement${model.presentation.gateChips.length === 1 ? '' : 's'}`
    : 'No requirements';
}

function getPrimaryReward(model: ResearchProjectModel): string {
  return model.presentation.rewardDetails[0]?.value || model.presentation.primaryImpact;
}

function getProjectOrderMap(models: ResearchProjectModel[]): Map<string, number> {
  return new Map(models.map((model, index) => [model.project.id, index] as const));
}

function getStandaloneModels(models: ResearchProjectModel[], lanes: ResearchMapLane[]): ResearchProjectModel[] {
  const laneIds = new Set(lanes.flatMap((lane) => lane.models.map((model) => model.project.id)));
  return models.filter((model) => !laneIds.has(model.project.id));
}

function getChainValueLabel(model: ResearchProjectModel): string | null {
  if (!model.presentation.chainType || model.presentation.chainUnlockValue === null) {
    return null;
  }

  return formatResearchChainValue(model.presentation.chainType, model.presentation.chainUnlockValue);
}

function getNodeClass(model: ResearchProjectModel, isSelected: boolean): string {
  return [
    'min-h-[138px] w-[210px] shrink-0 rounded-lg border px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300',
    NODE_STATUS_CLASSES[model.status],
    isSelected ? SELECTED_NODE_CLASS : '',
  ].filter(Boolean).join(' ');
}

function getBranchClass(model: ResearchProjectModel, isSelected: boolean): string {
  return [
    'rounded-lg border px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300',
    NODE_STATUS_CLASSES[model.status],
    isSelected ? SELECTED_NODE_CLASS : '',
  ].filter(Boolean).join(' ');
}

function buildNumericLaneDetail(chainType: UnlockType, models: ResearchProjectModel[]): string {
  const values = models
    .map((model) => model.presentation.chainUnlockValue)
    .filter((value): value is number => typeof value === 'number');
  const lastValue = values[values.length - 1];

  return lastValue === undefined
    ? `${models.length} linked projects`
    : `Builds toward ${formatResearchChainValue(chainType, lastValue)}`;
}

function getRequirementStatus(
  project: ResearchProject,
  requirementLabel: string,
  eligibilityContext: ResearchEligibilityContext | null
): RequirementStatus {
  if (!eligibilityContext) {
    return 'met';
  }

  if (requirementLabel === 'Company Prestige') {
    return project.requiredPrestige !== undefined && eligibilityContext.currentPrestige < project.requiredPrestige
      ? 'blocked'
      : 'met';
  }

  if (requirementLabel === 'Prerequisite Research') {
    return project.prerequisites?.some((id) => !eligibilityContext.completedResearch.has(id))
      ? 'blocked'
      : 'met';
  }

  if (requirementLabel === 'Company Value') {
    return project.requiredCompanyValue !== undefined && eligibilityContext.companyValue < project.requiredCompanyValue
      ? 'blocked'
      : 'met';
  }

  if (requirementLabel === 'Company Age') {
    return project.requiredCompanyAgeWeeks !== undefined && eligibilityContext.companyAgeWeeks < project.requiredCompanyAgeWeeks
      ? 'blocked'
      : 'met';
  }

  if (requirementLabel === 'Best Buyer Loyalty') {
    return project.requiredBuyerLoyaltyLevel !== undefined && eligibilityContext.maxBuyerLoyaltyLevel < project.requiredBuyerLoyaltyLevel
      ? 'blocked'
      : 'met';
  }

  if (requirementLabel === 'Required Achievement' || requirementLabel === 'Required Achievements') {
    return project.requiredAchievementIds?.some((id) => !eligibilityContext.unlockedAchievementIds.has(id))
      ? 'blocked'
      : 'met';
  }

  return 'met';
}

export function ResearchWorkspace({
  bypassGates = false,
  readOnly = false,
  variant = 'player',
}: ResearchWorkspaceProps) {
  const [activeResearch, setActiveResearch] = useState<Set<string>>(new Set());
  const [completedResearch, setCompletedResearch] = useState<Set<string>>(new Set());
  const [currentPrestige, setCurrentPrestige] = useState(0);
  const [eligibilityContext, setEligibilityContext] = useState<ResearchEligibilityContext | null>(null);
  const [permanentEffects, setPermanentEffects] = useState<ResearchPermanentEffectsSummary>({
    vineyardHealthDecayMultiplier: 1,
    researchSkillMultiplier: 1,
    administrationAndResearchWorkMultiplier: 1,
    allStaffWorkMultiplier: 1,
    activeEffects: [],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ResearchStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(readOnly ? 'full' : 'focus');
  const [groupFilter, setGroupFilter] = useState<ResearchGroupFilter>('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);

  const { subscribe } = useGameUpdates();

  useEffect(() => {
    let mounted = true;

    const loadResearchStatus = async () => {
      const [activities, completedIds, prestige, effects] = await Promise.all([
        getAllActivities(),
        getUnlockedResearchIds(),
        getCurrentPrestige(),
        getResearchPermanentEffects(),
      ]);

      if (!mounted) {
        return;
      }

      const nextActiveResearch = new Set(
        activities
          .filter((activity) => activity.category === WorkCategory.ADMINISTRATION_AND_RESEARCH)
          .filter((activity) => activity.status === 'active' && typeof activity.params?.researchId === 'string')
          .map((activity) => activity.params!.researchId as string)
      );

      const completedSet = new Set(completedIds);
      const context = bypassGates ? null : await loadResearchEligibilityContext(prestige, completedSet);

      if (!mounted) {
        return;
      }

      setActiveResearch(nextActiveResearch);
      setCompletedResearch(completedSet);
      setCurrentPrestige(prestige);
      setEligibilityContext(context);
      setPermanentEffects(effects);
    };

    loadResearchStatus();
    const unsubscribe = subscribe(() => {
      void loadResearchStatus();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [bypassGates, refreshVersion, subscribe]);

  const presentationRows = useMemo(() => buildResearchPresentationRows(RESEARCH_PROJECTS), []);

  const projectModels = useMemo<ResearchProjectModel[]>(() => {
    return presentationRows.map((presentation) => {
      const project = presentation.project;
      const status = getProjectStatus(
        project,
        activeResearch,
        completedResearch,
        currentPrestige,
        eligibilityContext,
        bypassGates
      );
      const lockReason =
        status === 'locked' && eligibilityContext
          ? formatLockReason(project, eligibilityContext)
          : '';
      const { totalWork } = calculateResearchWork(project.id, {
        workMultiplier: permanentEffects.administrationAndResearchWorkMultiplier,
      });

      return {
        project,
        presentation,
        status,
        lockReason,
        totalWork,
        totalCost: calculateResearchCost(project.id),
      };
    });
  }, [activeResearch, bypassGates, completedResearch, currentPrestige, eligibilityContext, permanentEffects.administrationAndResearchWorkMultiplier, presentationRows]);

  const footprintSummary = useMemo(
    () =>
      buildResearchFootprintSummary({
        projects: RESEARCH_PROJECTS,
        completedResearch,
        activeResearch,
      }),
    [activeResearch, completedResearch]
  );

  const projectOrder = useMemo(() => getProjectOrderMap(projectModels), [projectModels]);

  const filteredModels = useMemo(() => {
    const byGroup = new Map<ResearchDisplayGroupId, ResearchProjectModel[]>();
    for (const model of projectModels) {
      const groupId = getResearchDisplayGroup(model.project).id;
      byGroup.set(groupId, [...(byGroup.get(groupId) || []), model]);
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const selectedGroupIds =
      groupFilter === 'all' ? Array.from(byGroup.keys()) : [groupFilter];

    const next = new Map<ResearchDisplayGroupId, ResearchProjectModel[]>();

    for (const groupId of selectedGroupIds) {
      const groupModels = byGroup.get(groupId) || [];
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
        models = models.filter((model) => {
          const searchableText = [
            model.project.title,
            model.project.id,
            model.project.description,
            model.presentation.primaryImpact,
            model.presentation.prerequisiteTitles.join(' '),
            model.presentation.unlockTypeLabels.join(' '),
            model.presentation.rewardDetails.map((detail) => `${detail.label} ${detail.value}`).join(' '),
            ...(model.project.benefits || []),
          ]
            .join(' ')
            .toLowerCase();

          return searchableText.includes(normalizedSearch);
        });
      }

      next.set(groupId, models);
    }

    return next;
  }, [activeResearch, bypassGates, completedResearch, groupFilter, hideCompleted, projectModels, searchTerm, statusFilter, viewMode]);

  const visibleModels = useMemo(() => {
    const next: ResearchProjectModel[] = [];
    for (const models of filteredModels.values()) {
      next.push(...models);
    }
    return next;
  }, [filteredModels]);

  useEffect(() => {
    if (visibleModels.length === 0) {
      setSelectedProjectId('');
      return;
    }

    if (!visibleModels.some((model) => model.project.id === selectedProjectId)) {
      setSelectedProjectId(visibleModels[0].project.id);
    }
  }, [selectedProjectId, visibleModels]);

  const selectedModel = useMemo(
    () => visibleModels.find((model) => model.project.id === selectedProjectId) || null,
    [selectedProjectId, visibleModels]
  );

  const projectById = useMemo(
    () => new Map(projectModels.map((model) => [model.project.id, model] as const)),
    [projectModels]
  );

  const directChainByProjectId = useMemo(() => {
    const next = new Map<string, string[]>();
    for (const chain of footprintSummary.chainSummaries) {
      for (const projectId of chain.projectIds) {
        next.set(projectId, chain.projectIds);
      }
    }
    return next;
  }, [footprintSummary.chainSummaries]);

  const mapLanesByGroup = useMemo(() => {
    const next = new Map<ResearchDisplayGroupId, ResearchMapLane[]>();

    for (const [groupId, models] of filteredModels.entries()) {
      const modelIds = new Set(models.map((model) => model.project.id));
      const lanes: ResearchMapLane[] = [];
      const handledIds = new Set<string>();

      for (const chain of footprintSummary.chainSummaries) {
        const chainModels = chain.projectIds
          .map((projectId) => projectById.get(projectId))
          .filter((model): model is ResearchProjectModel => Boolean(model))
          .filter((model) => model.presentation.group.id === groupId && modelIds.has(model.project.id))
          .sort((left, right) => (projectOrder.get(left.project.id) ?? 0) - (projectOrder.get(right.project.id) ?? 0));

        if (chainModels.length < 2) {
          continue;
        }

        chainModels.forEach((model) => handledIds.add(model.project.id));
        lanes.push({
          id: `chain-${chain.chainId}`,
          label: chain.label,
          detail: `${chain.completedSteps}/${chain.totalSteps} completed`,
          models: chainModels,
          completedSteps: chain.completedSteps,
          totalSteps: chain.totalSteps,
          progress: chain.totalSteps > 0 ? (chain.completedSteps / chain.totalSteps) * 100 : 0,
        });
      }

      const ladderModelsByType = new Map<UnlockType, ResearchProjectModel[]>();
      for (const model of models) {
        if (!model.presentation.chainType || handledIds.has(model.project.id)) {
          continue;
        }

        ladderModelsByType.set(model.presentation.chainType, [
          ...(ladderModelsByType.get(model.presentation.chainType) || []),
          model,
        ]);
      }

      for (const [chainType, laneModels] of ladderModelsByType.entries()) {
        if (laneModels.length < 2) {
          continue;
        }

        const orderedModels = [...laneModels].sort((left, right) => {
          const leftValue = left.presentation.chainUnlockValue ?? Number.MAX_SAFE_INTEGER;
          const rightValue = right.presentation.chainUnlockValue ?? Number.MAX_SAFE_INTEGER;
          return leftValue - rightValue;
        });
        const allLadderModels = projectModels.filter((model) => model.presentation.chainType === chainType);
        const completedSteps = allLadderModels.filter((model) => model.status === 'completed').length;
        const totalSteps = allLadderModels.length;

        orderedModels.forEach((model) => handledIds.add(model.project.id));
        lanes.push({
          id: `ladder-${chainType}`,
          label: orderedModels[0].presentation.chainLabel || orderedModels[0].presentation.group.title,
          detail: buildNumericLaneDetail(chainType, allLadderModels),
          models: orderedModels,
          completedSteps,
          totalSteps,
          progress: totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0,
        });
      }

      next.set(groupId, lanes);
    }

    return next;
  }, [filteredModels, footprintSummary.chainSummaries, projectById, projectModels, projectOrder]);

  const selectedChainModels = useMemo(() => {
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
  }, [directChainByProjectId, projectModels, selectedModel]);

  const handleStartResearch = async (projectId: string) => {
    if (readOnly) {
      return;
    }

    await getResearchUpgradeFeature().workflow.startResearch(projectId);
    setRefreshVersion((current) => current + 1);
  };

  const navigateToProject = (projectId: string) => {
    const targetModel = projectById.get(projectId);
    if (!targetModel) {
      return;
    }

    setSearchTerm('');
    setHideCompleted(false);
    setStatusFilter('all');
    setViewMode('full');
    setGroupFilter(targetModel.presentation.group.id);
    setSelectedProjectId(projectId);
  };

  const { hasEffects, healthDecayReductionPercent, researchSkillBoostPercent } = getResearchViewSummary(permanentEffects);
  const runningModels = projectModels.filter((model) => model.status === 'in-progress');

  return (
    <div className="flex flex-col gap-6">
      {variant === 'player' ? (
        <section
          className="relative overflow-hidden rounded-xl border border-emerald-950/10 bg-emerald-950 text-white"
          style={{
            backgroundImage: `linear-gradient(110deg, rgba(6, 44, 33, 0.94), rgba(9, 61, 45, 0.8)), url('${RESEARCH_HERO_IMAGE_URL}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="flex flex-col gap-5 px-5 py-6 md:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-100/80">Research Map</p>
              <h2 className="mt-2 text-2xl font-semibold">Build the winery's long-range capability</h2>
              <p className="mt-2 text-sm text-emerald-50/85">
                Follow unlock chains, branch into specialist projects, and inspect each research brief before committing budget and work.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-emerald-100/70">Completed</div>
                <div className="mt-1 text-2xl font-semibold">{completedResearch.size}</div>
                <div className="text-xs text-emerald-100/75">{footprintSummary.statusCounts.remaining} projects remaining</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-emerald-100/70">Running</div>
                <div className="mt-1 text-2xl font-semibold">{runningModels.length}</div>
                <div className="truncate text-xs text-emerald-100/75">{runningModels[0]?.project.title || 'No active research'}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-emerald-100/70">Active Effects</div>
                <div className="mt-1 text-2xl font-semibold">{permanentEffects.activeEffects.length}</div>
                <div className="text-xs text-emerald-100/75">{hasEffects ? `${researchSkillBoostPercent.toFixed(1)}% research speed boost` : 'No permanent effects yet'}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-emerald-100/70">Admin Load</div>
                <div className="mt-1 text-2xl font-semibold">x{permanentEffects.administrationAndResearchWorkMultiplier.toFixed(2)}</div>
                <div className="text-xs text-emerald-100/75">Health resilience {healthDecayReductionPercent.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border bg-slate-50/70 px-5 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Research Map Inspector</h3>
              <p className="text-sm text-slate-600">Read-only debug view with gate bypass enabled for catalog inspection.</p>
            </div>
            <Badge variant="outline" className="w-fit">
              Bypass gates active
            </Badge>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-emerald-700" />
                <h3 className="text-base font-semibold text-slate-900">Progression Map</h3>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Chains show ordered capability growth. Branches collect standalone unlocks and specialist projects.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <Badge variant="secondary">{visibleModels.filter((model) => model.status === 'available').length} available</Badge>
              <Badge variant="outline">{visibleModels.filter((model) => model.status === 'locked').length} locked</Badge>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(2,minmax(0,0.75fr))_auto]">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search project, reward, prerequisite, or unlock"
            />
            <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
              <SelectTrigger>
                <SelectValue placeholder="Map view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="focus">Focus map</SelectItem>
                <SelectItem value="full">Full map</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | ResearchStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="in-progress">In progress</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-end gap-2 rounded-md border px-3">
              <Switch id={`${variant}-hide-completed`} checked={hideCompleted} onCheckedChange={setHideCompleted} />
              <Label htmlFor={`${variant}-hide-completed`} className="text-sm">Hide completed</Label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={groupFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupFilter('all')}
            >
              All research
            </Button>
            {Array.from(new Set(projectModels.map((model) => model.presentation.group.id))).map((groupId) => {
              const group = projectModels.find((model) => model.presentation.group.id === groupId)?.presentation.group;
              if (!group) {
                return null;
              }
              const Icon = GROUP_ICONS[group.id];
              return (
                <Button
                  key={group.id}
                  variant={groupFilter === group.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGroupFilter(group.id)}
                >
                  <Icon data-icon="inline-start" />
                  {group.title}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-5">
            {Array.from(filteredModels.entries()).map(([groupId, models]) => {
              const group = projectModels.find((model) => model.presentation.group.id === groupId)?.presentation.group;
              if (!group) {
                return null;
              }
              const stats = groupStatSummary(models);
              const Icon = GROUP_ICONS[groupId];
              const lanes = mapLanesByGroup.get(groupId) || [];
              const standaloneModels = getStandaloneModels(models, lanes);
              const groupProgress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

              return (
                <section key={groupId} className="rounded-lg border bg-white/80 px-4 py-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <Icon className="h-4 w-4 text-slate-700" />
                        {group.title}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{group.description}</p>
                    </div>
                    <div className="min-w-[180px] text-xs text-slate-600">
                      <div className="flex justify-between gap-3">
                        <span>{stats.completed}/{stats.total} complete</span>
                        <span>{stats.available} available</span>
                      </div>
                      <Progress value={groupProgress} className="mt-2 h-1.5" />
                    </div>
                  </div>

                  {models.length ? (
                    <div className="mt-4 flex flex-col gap-4">
                      {lanes.map((lane) => (
                        <div key={lane.id} className="rounded-lg border bg-slate-50/80 px-3 py-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <CircleDot className="h-4 w-4 text-emerald-700" />
                                {lane.label}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500">{lane.detail}</div>
                            </div>
                            <div className="min-w-[160px] text-xs text-slate-500">
                              <div className="text-right">{lane.completedSteps}/{lane.totalSteps}</div>
                              <Progress value={lane.progress} className="mt-1.5 h-1.5" />
                            </div>
                          </div>

                          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                            {lane.models.map((model, index) => {
                              const isSelected = model.project.id === selectedProjectId;
                              const isDisabled = readOnly || model.status !== 'available';
                              const chainValue = getChainValueLabel(model);

                              return (
                                <div key={model.project.id} className="flex items-center gap-2">
                                  <div
                                    id={`research-project-${model.project.id}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedProjectId(model.project.id)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setSelectedProjectId(model.project.id);
                                      }
                                    }}
                                    className={getNodeClass(model, isSelected)}
                                  >
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <Badge variant={STATUS_VARIANTS[model.status]}>{STATUS_LABELS[model.status]}</Badge>
                                      {chainValue ? <span className="text-xs font-medium text-slate-500">{chainValue}</span> : null}
                                    </div>
                                    <div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950">{model.project.title}</div>
                                    <div className="mt-1 line-clamp-2 text-xs text-slate-600">{getPrimaryReward(model)}</div>
                                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                      <span>{formatNumber(model.totalCost, { currency: true, decimals: 0 })}</span>
                                      <span>{model.totalWork.toLocaleString()} work</span>
                                      <span>Difficulty {model.project.complexity}/10</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                      <UnifiedTooltip
                                        side="top"
                                        title={model.project.title}
                                        content={
                                          <TooltipSection title="Requirements">
                                            {model.presentation.requirementDetails.length ? (
                                              model.presentation.requirementDetails.map((requirement) => {
                                                const requirementStatus = getRequirementStatus(
                                                  model.project,
                                                  requirement.label,
                                                  eligibilityContext
                                                );

                                                return (
                                                  <TooltipRow
                                                    key={`${model.project.id}-${requirement.label}`}
                                                    label={requirement.label}
                                                    value={requirement.value}
                                                    tone={requirementStatus === 'blocked' ? 'danger' : 'default'}
                                                  />
                                                );
                                              })
                                            ) : (
                                              <TooltipRow label="Requirements" value="No special requirements" />
                                            )}
                                          </TooltipSection>
                                        }
                                      >
                                        <span className="cursor-help text-xs underline decoration-dotted underline-offset-2">{getGateLabel(model)}</span>
                                      </UnifiedTooltip>
                                      {!readOnly ? (
                                        <Button
                                          size="sm"
                                          disabled={isDisabled}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleStartResearch(model.project.id);
                                          }}
                                        >
                                          {model.status === 'available'
                                            ? 'Start'
                                            : model.status === 'in-progress'
                                            ? 'Running'
                                            : model.status === 'completed'
                                            ? 'Done'
                                            : 'Locked'}
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                  {index < lane.models.length - 1 ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" /> : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {standaloneModels.length ? (
                        <div>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Branches</div>
                          <div className={`grid gap-2 ${groupId === 'varietal_research' ? 'sm:grid-cols-2 2xl:grid-cols-3' : 'md:grid-cols-2'}`}>
                            {standaloneModels.map((model) => {
                              const isSelected = model.project.id === selectedProjectId;
                              const isDisabled = readOnly || model.status !== 'available';

                              return (
                                <div
                                  key={model.project.id}
                                  id={`research-project-${model.project.id}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setSelectedProjectId(model.project.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      setSelectedProjectId(model.project.id);
                                    }
                                  }}
                                  className={getBranchClass(model, isSelected)}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Badge variant={STATUS_VARIANTS[model.status]}>{STATUS_LABELS[model.status]}</Badge>
                                    {!readOnly ? (
                                      <Button
                                        size="sm"
                                        disabled={isDisabled}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleStartResearch(model.project.id);
                                        }}
                                      >
                                        {model.status === 'available'
                                          ? 'Start'
                                          : model.status === 'in-progress'
                                          ? 'Running'
                                          : model.status === 'completed'
                                          ? 'Done'
                                          : 'Locked'}
                                      </Button>
                                    ) : null}
                                  </div>
                                  <div className="mt-2 text-sm font-semibold text-slate-950">{model.project.title}</div>
                                  <div className="mt-1 line-clamp-2 text-xs text-slate-600">{getPrimaryReward(model)}</div>
                                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                    <span>{formatNumber(model.totalCost, { currency: true, decimals: 0 })}</span>
                                    <span>{model.totalWork.toLocaleString()} work</span>
                                    <span>Difficulty {model.project.complexity}/10</span>
                                    <span>{getGateLabel(model)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed px-4 py-6 text-sm text-slate-500">
                      No projects match the current filters.
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <aside className="xl:sticky xl:top-4 xl:h-fit">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Project Brief</CardTitle>
                <CardDescription>Rewards, requirements, cost, work, and what the selected project connects to.</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedModel ? (
                  <div className="flex flex-col gap-4 text-sm">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANTS[selectedModel.status]}>{STATUS_LABELS[selectedModel.status]}</Badge>
                        <div className="font-semibold text-slate-900">{selectedModel.project.title}</div>
                      </div>
                      <p className="mt-2 text-slate-600">{selectedModel.project.description}</p>
                    </div>

                    {selectedModel.status === 'locked' && selectedModel.lockReason ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        {selectedModel.lockReason}
                      </div>
                    ) : null}

                    <Separator />

                    <div className="grid gap-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-4">
                        <span>Cost</span>
                        <span>{formatNumber(selectedModel.totalCost, { currency: true, decimals: 0 })}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Total work</span>
                        <span>{selectedModel.totalWork.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Difficulty</span>
                        <span>{selectedModel.project.complexity}/10</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Group</span>
                        <span>{selectedModel.presentation.group.title}</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rewards</div>
                      {selectedModel.presentation.rewardDetails.length ? (
                        selectedModel.presentation.rewardDetails.map((reward, index) => (
                          <div key={`${reward.label}-${index}`} className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{reward.label}</div>
                            <div className="mt-1 text-slate-700">{reward.value}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-slate-500">No direct rewards listed.</div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requirements</div>
                      {selectedModel.presentation.requirementDetails.length ? (
                        selectedModel.presentation.requirementDetails.map((requirement) => {
                          const requirementStatus = getRequirementStatus(
                            selectedModel.project,
                            requirement.label,
                            eligibilityContext
                          );

                          return (
                            <div
                              key={requirement.label}
                              className={`rounded-lg border px-3 py-2 text-sm ${
                                requirementStatus === 'blocked'
                                  ? 'border-red-200 bg-red-50'
                                  : 'bg-slate-50'
                              }`}
                            >
                              <div
                                className={`text-xs font-semibold uppercase tracking-wide ${
                                  requirementStatus === 'blocked'
                                    ? 'text-red-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {requirement.label}
                              </div>
                              <div
                                className={`mt-1 ${
                                  requirementStatus === 'blocked'
                                    ? 'font-medium text-red-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                {requirement.value}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-slate-500">No special requirements.</div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prerequisites</div>
                      {selectedModel.presentation.prerequisiteLinks.length ? (
                        selectedModel.presentation.prerequisiteLinks.map((link) => (
                          <button
                            key={link.id}
                            type="button"
                            onClick={() => navigateToProject(link.id)}
                            className="rounded-lg border bg-slate-50 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            {link.title}
                          </button>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-slate-500">No prerequisites.</div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unlocks Next</div>
                      {selectedModel.presentation.unlocksNextLinks.length ? (
                        selectedModel.presentation.unlocksNextLinks.map((link) => (
                          <button
                            key={link.id}
                            type="button"
                            onClick={() => navigateToProject(link.id)}
                            className="rounded-lg border bg-slate-50 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            {link.title}
                          </button>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-slate-500">No direct follow-up projects.</div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chain Context</div>
                      {selectedChainModels.length ? (
                        <ScrollArea className="max-h-64">
                          <div className="flex flex-col gap-2 pr-3">
                            {selectedChainModels.map((model) => {
                              const chainValue = getChainValueLabel(model);

                              return (
                                <button
                                  key={model.project.id}
                                  type="button"
                                  onClick={() => navigateToProject(model.project.id)}
                                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 ${model.project.id === selectedModel.project.id ? 'border-slate-900 bg-slate-50' : 'bg-background hover:bg-slate-50'}`}
                                >
                                  <div className="font-medium text-slate-900">{model.project.title}</div>
                                  <div className="text-xs text-slate-500">
                                    {chainValue || model.presentation.chainLabel || 'Linked project'}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-slate-500">This project is not part of a visible chain.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No project matches the current filters.</div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </div>
  );
}
