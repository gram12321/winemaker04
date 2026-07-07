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
import { RESEARCH_PROJECTS } from '@/lib/constants/researchConstants';
import { getResearchUpgradeFeature } from '@/lib/features/researchUpgrade';
import {
  buildResearchFootprintSummary,
  buildResearchPresentationRows,
  type ResearchDisplayGroupId,
} from '@/lib/features/researchUpgrade/services/research/researchPresentationService';
import { type ResearchEligibilityContext } from '@/lib/features/researchUpgrade/services/research/researchEligibilityService';
import {
  buildFilteredResearchGroups,
  buildResearchDirectChainLookup,
  buildResearchProjectModels,
  flattenResearchProjectGroups,
  getCompactResearchChainModels,
  getDefaultSelectedResearchProjectId,
  getResearchChainStepLabel,
  getResearchGroupStats,
  getResearchViewSummary,
  getSelectedResearchChainModels,
  loadResearchWorkspaceSnapshot,
  type ResearchProjectModel,
  type ResearchSortMode,
  type ResearchStatus,
  type ResearchViewMode,
} from '@/lib/features/researchUpgrade/services/research/researchViewService';
import { type ResearchPermanentEffectsSummary } from '@/lib/features/researchUpgrade/services/research/researchPermanentEffectsService';
import { formatNumber } from '@/lib/utils';
import { useGameUpdates } from '@/hooks/useGameUpdates';
import { ChevronRight, Compass, FlaskConical, Grape, Landmark, Network } from 'lucide-react';

const RESEARCH_HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?w=1600&h=700&fit=crop';

type ResearchGroupFilter = 'all' | ResearchDisplayGroupId;

interface ResearchWorkspaceProps {
  bypassGates?: boolean;
  readOnly?: boolean;
  variant?: 'player' | 'admin';
}

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
  const [sortMode, setSortMode] = useState<ResearchSortMode>('recommended');
  const [viewMode, setViewMode] = useState<ResearchViewMode>(readOnly ? 'full' : 'focus');
  const [groupFilter, setGroupFilter] = useState<ResearchGroupFilter>('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);

  const { subscribe } = useGameUpdates();

  useEffect(() => {
    let mounted = true;

    const loadResearchStatus = async () => {
      const snapshot = await loadResearchWorkspaceSnapshot(bypassGates);

      if (!mounted) {
        return;
      }

      setActiveResearch(snapshot.activeResearch);
      setCompletedResearch(snapshot.completedResearch);
      setCurrentPrestige(snapshot.currentPrestige);
      setEligibilityContext(snapshot.eligibilityContext);
      setPermanentEffects(snapshot.permanentEffects);
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
    return buildResearchProjectModels({
      activeResearch,
      bypassGates,
      completedResearch,
      currentPrestige,
      eligibilityContext,
      permanentEffects,
      presentationRows,
    });
  }, [activeResearch, bypassGates, completedResearch, currentPrestige, eligibilityContext, permanentEffects, presentationRows]);

  const footprintSummary = useMemo(
    () =>
      buildResearchFootprintSummary({
        projects: RESEARCH_PROJECTS,
        completedResearch,
        activeResearch,
      }),
    [activeResearch, completedResearch]
  );

  const filteredModels = useMemo(() => {
    return buildFilteredResearchGroups({
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
    });
  }, [activeResearch, bypassGates, completedResearch, groupFilter, hideCompleted, projectModels, searchTerm, sortMode, statusFilter, viewMode]);

  const visibleModels = useMemo(() => {
    return flattenResearchProjectGroups(filteredModels);
  }, [filteredModels]);

  useEffect(() => {
    const nextSelectedProjectId = getDefaultSelectedResearchProjectId(visibleModels, selectedProjectId);
    if (nextSelectedProjectId !== selectedProjectId) {
      setSelectedProjectId(nextSelectedProjectId);
    }
  }, [selectedProjectId, visibleModels]);

  const selectedModel = useMemo(
    () => visibleModels.find((model) => model.project.id === selectedProjectId) || null,
    [selectedProjectId, visibleModels]
  );

  const directChainByProjectId = useMemo(
    () => buildResearchDirectChainLookup(footprintSummary.chainSummaries),
    [footprintSummary.chainSummaries]
  );

  const selectedChainModels = useMemo(() => {
    return getSelectedResearchChainModels(directChainByProjectId, projectModels, selectedModel);
  }, [directChainByProjectId, projectModels, selectedModel]);

  const handleStartResearch = async (projectId: string) => {
    if (readOnly) {
      return;
    }

    await getResearchUpgradeFeature().workflow.startResearch(projectId);
    setRefreshVersion((current) => current + 1);
  };

  const { hasEffects, healthDecayReductionPercent, researchSkillBoostPercent } = getResearchViewSummary(permanentEffects);

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
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-100/80">Research</p>
              <h2 className="mt-2 text-2xl font-semibold">Long-range winery capability</h2>
              <p className="mt-2 text-sm text-emerald-50/85">
                Progression, unlock ladders, and permanent operational advantages live here now. Research is no longer split across finance-era tabs.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-emerald-100/70">Completed</div>
                <div className="mt-1 text-2xl font-semibold">{completedResearch.size}</div>
                <div className="text-xs text-emerald-100/75">{footprintSummary.statusCounts.remaining} projects remaining</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-emerald-100/70">Active Effects</div>
                <div className="mt-1 text-2xl font-semibold">{permanentEffects.activeEffects.length}</div>
                <div className="text-xs text-emerald-100/75">{hasEffects ? `${researchSkillBoostPercent.toFixed(1)}% research speed boost` : 'No permanent effects yet'}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-emerald-100/70">Vineyard Resilience</div>
                <div className="mt-1 text-2xl font-semibold">{healthDecayReductionPercent.toFixed(1)}%</div>
                <div className="text-xs text-emerald-100/75">Health decay multiplier x{permanentEffects.vineyardHealthDecayMultiplier.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-emerald-100/70">Admin Load</div>
                <div className="mt-1 text-2xl font-semibold">x{permanentEffects.administrationAndResearchWorkMultiplier.toFixed(2)}</div>
                <div className="text-xs text-emerald-100/75">Current research work multiplier</div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border bg-slate-50/70 px-5 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Research Inspector</h3>
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
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-emerald-700" />
            <h3 className="text-base font-semibold text-slate-900">Research Progression</h3>
          </div>
          <p className="text-sm text-slate-600">
            Direct chains, standalone unlocks, and progression cards now live in one surface. Filter by category, then work from the next useful card.
          </p>
          <div className="grid gap-3 lg:grid-cols-[1.3fr_repeat(3,minmax(0,0.7fr))_auto]">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search project, effect, prerequisite, or unlock"
            />
            <Select value={viewMode} onValueChange={(value) => setViewMode(value as ResearchViewMode)}>
              <SelectTrigger>
                <SelectValue placeholder="Tree view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="focus">Focus view</SelectItem>
                <SelectItem value="full">Full tree</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as ResearchSortMode)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="cost">Cost</SelectItem>
                <SelectItem value="work">Work</SelectItem>
                <SelectItem value="complexity">Complexity</SelectItem>
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

        <div className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
          <div className="flex flex-col gap-5">
            {Array.from(filteredModels.entries()).map(([groupId, models]) => {
              const group = projectModels.find((model) => model.presentation.group.id === groupId)?.presentation.group;
              if (!group) {
                return null;
              }
              const stats = getResearchGroupStats(models);
              const Icon = GROUP_ICONS[groupId];

              return (
                <section key={groupId} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Icon className="h-4 w-4 text-slate-700" />
                        {group.title}
                      </div>
                      <p className="text-sm text-slate-600">{group.description}</p>
                    </div>
                    <div className="flex gap-3 text-xs text-slate-600">
                      <span>{stats.total} visible</span>
                      <span>{stats.completed} completed</span>
                      <span>{stats.available} available</span>
                    </div>
                  </div>

                  {models.length ? (
                    <div className="flex flex-col gap-2">
                      {models.map((model) => {
                        const isSelected = model.project.id === selectedProjectId;
                        const stepLabel = getResearchChainStepLabel(model, projectModels);
                        const isDisabled = readOnly || model.status !== 'available';
                        const gateLabel = model.presentation.gateChips.length
                          ? `${model.presentation.gateChips.length} gate${model.presentation.gateChips.length === 1 ? '' : 's'}`
                          : 'No gates';
                        const directChainIds = directChainByProjectId.get(model.project.id);
                        const directChainModels = directChainIds
                          ? directChainIds
                              .map((projectId) => projectModels.find((candidate) => candidate.project.id === projectId))
                              .filter((candidate): candidate is ResearchProjectModel => Boolean(candidate))
                          : [];
                        const compactChainModels = directChainModels.length ? getCompactResearchChainModels(directChainModels) : [];
                        const directChainSummary = footprintSummary.chainSummaries.find((chain) => chain.projectIds.includes(model.project.id)) || null;
                        const directChainProgress = directChainSummary && directChainSummary.totalSteps > 0
                          ? (directChainSummary.completedSteps / directChainSummary.totalSteps) * 100
                          : 0;
                        const isDirectChainCard = directChainModels.length > 1;

                        return (
                          <div
                            key={model.project.id}
                            className={`rounded-xl border px-4 py-3 transition-colors ${isSelected ? 'border-slate-900 bg-slate-50' : 'bg-background hover:bg-slate-50/70'}`}
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setSelectedProjectId(model.project.id)}>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={STATUS_VARIANTS[model.status]}>{STATUS_LABELS[model.status]}</Badge>
                                  <div className="text-sm font-semibold text-slate-900">{model.project.title}</div>
                                </div>
                                <p className="mt-1 text-sm text-slate-600">{model.presentation.primaryImpact}</p>
                                {isDirectChainCard ? (
                                  <div className="mt-3 rounded-lg border bg-slate-50 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                                      <span>{directChainSummary?.label}</span>
                                      <span>{directChainSummary?.completedSteps}/{directChainSummary?.totalSteps}</span>
                                    </div>
                                    <Progress value={directChainProgress} className="mt-2 h-1.5" />
                                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                                      {compactChainModels.map((chainModel, index) => (
                                        <div
                                          key={chainModel === 'ellipsis' ? `${model.project.id}-ellipsis-${index}` : chainModel.project.id}
                                          className="flex items-center gap-2"
                                        >
                                          {index > 0 ? <ChevronRight className="h-3 w-3 text-slate-400" /> : null}
                                          {chainModel === 'ellipsis' ? (
                                            <span className="rounded bg-white px-1.5 py-0.5 text-slate-500">...</span>
                                          ) : (
                                            <span className={chainModel.project.id === model.project.id ? 'font-medium text-slate-900' : ''}>
                                              {chainModel.project.title}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                  <span>{formatNumber(model.totalCost, { currency: true, decimals: 0 })}</span>
                                  <span>{model.totalWork.toLocaleString()} work</span>
                                  <span>Complexity {model.project.complexity}/10</span>
                                  {model.presentation.chainLabel ? <span>{model.presentation.chainLabel}{stepLabel ? ` (${stepLabel})` : ''}</span> : null}
                                  <UnifiedTooltip
                                    side="top"
                                    title={model.project.title}
                                    content={
                                      <TooltipSection title="Requirements">
                                        {model.presentation.gateChips.length ? (
                                          model.presentation.gateChips.map((gate) => (
                                            <TooltipRow key={`${model.project.id}-${gate.type}`} label={gate.type} value={gate.label} />
                                          ))
                                        ) : (
                                          <TooltipRow label="Requirements" value="No special gates" />
                                        )}
                                      </TooltipSection>
                                    }
                                  >
                                    <span className="cursor-help underline decoration-dotted underline-offset-2">{gateLabel}</span>
                                  </UnifiedTooltip>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {!readOnly ? (
                                  <Button
                                    size="sm"
                                    disabled={isDisabled}
                                    onClick={() => void handleStartResearch(model.project.id)}
                                  >
                                    {model.status === 'available'
                                      ? 'Start'
                                      : model.status === 'in-progress'
                                      ? 'Running'
                                      : model.status === 'completed'
                                      ? 'Completed'
                                      : 'Locked'}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-slate-500">
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
                <CardTitle className="text-base">Project Inspector</CardTitle>
                <CardDescription>Dependencies, next unlocks, and chain context for the selected project.</CardDescription>
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
                        <span>Complexity</span>
                        <span>{selectedModel.project.complexity}/10</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Group</span>
                        <span>{selectedModel.presentation.group.title}</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prerequisites</div>
                      {selectedModel.presentation.prerequisiteLinks.length ? (
                        selectedModel.presentation.prerequisiteLinks.map((link) => (
                          <div key={link.id} className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                            {link.title}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-slate-500">No prerequisites.</div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unlocks Next</div>
                      {selectedModel.presentation.unlocksNextLinks.length ? (
                        selectedModel.presentation.unlocksNextLinks.map((link) => (
                          <div key={link.id} className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                            {link.title}
                          </div>
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
                            {selectedChainModels.map((model) => (
                              <div
                                key={model.project.id}
                                className={`rounded-lg border px-3 py-2 text-sm ${model.project.id === selectedModel.project.id ? 'border-slate-900 bg-slate-50' : 'bg-background'}`}
                              >
                                <div className="font-medium text-slate-900">{model.project.title}</div>
                                <div className="text-xs text-slate-500">
                                  {model.presentation.chainUnlockValue !== null ? `Unlock ${model.presentation.chainUnlockValue}` : model.presentation.chainLabel}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-slate-500">This project is not part of a numeric ladder.</div>
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
