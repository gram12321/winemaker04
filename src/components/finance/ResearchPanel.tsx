import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  GitBranch,
  LockKeyhole,
  Play,
  Route,
} from 'lucide-react';
import {
  Badge,
  Button,
} from '@/components/ui';
import { WorkCategory } from '@/lib/types/types';
import { RESEARCH_PROJECTS, type ResearchProject } from '@/lib/constants/researchConstants';
import { getAllActivities } from '@/lib/services/activity/activitymanagers/activityManager';
import { useGameUpdates } from '@/hooks/useGameUpdates';
import { getResearchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { getUnlockedResearchIds } from '@/lib/database/core/researchUnlocksDB';
import { getCurrentPrestige } from '@/lib/services/core/gameState';
import {
  type ResearchEligibilityContext,
  getResearchRequirementReasons,
  isResearchProjectEligible,
  loadResearchEligibilityContext,
} from '@/lib/services';
import {
  RESEARCH_DISPLAY_GROUPS,
  buildResearchFootprintSummary,
  buildResearchPresentationRows,
  formatResearchChainValue,
  getUnlockTypeLabel,
  getVisibleResearchProjects as deriveVisibleResearchProjects,
  type ResearchDisplayGroup,
  type ResearchDisplayGroupId,
  type ResearchProjectPresentationRow,
  type ResearchStatus,
} from '@/lib/services/research/researchPresentationService';
import { cn, formatNumber } from '@/lib/utils/utils';

export { getVisibleResearchProjects } from '@/lib/services/research/researchPresentationService';

interface ResearchPanelProps {
  bypassGates?: boolean;
  view?: 'catalog' | 'footprint' | 'both';
}

interface GroupStats {
  total: number;
  completed: number;
  available: number;
  inProgress: number;
}

const STATUS_ORDER: Record<ResearchStatus, number> = {
  'in-progress': 0,
  available: 1,
  locked: 2,
  completed: 3,
};

const GROUP_ORDER = new Map<ResearchDisplayGroupId, number>(
  RESEARCH_DISPLAY_GROUPS.map((group, index) => [group.id, index])
);

const PROJECT_ORDER = new Map<string, number>(
  RESEARCH_PROJECTS.map((project, index) => [project.id, index])
);

export function ResearchPanel({ bypassGates = false, view = 'both' }: ResearchPanelProps) {
  const [activeResearch, setActiveResearch] = useState<Set<string>>(new Set());
  const [completedResearch, setCompletedResearch] = useState<Set<string>>(new Set());
  const [currentPrestige, setCurrentPrestige] = useState<number>(0);
  const [eligibilityContext, setEligibilityContext] = useState<ResearchEligibilityContext | null>(null);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [scrollTargetProjectId, setScrollTargetProjectId] = useState<string | null>(null);
  const [startingProjectId, setStartingProjectId] = useState<string | null>(null);

  const { subscribe } = useGameUpdates();

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

  useEffect(() => {
    if (!highlightedProjectId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedProjectId(current => current === highlightedProjectId ? null : current);
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedProjectId]);

  useEffect(() => {
    if (!scrollTargetProjectId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      document.getElementById(getResearchRowDomId(scrollTargetProjectId))?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
      setScrollTargetProjectId(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [scrollTargetProjectId]);

  const loadResearchStatus = async () => {
    const [activities, completedIds, prestige] = await Promise.all([
      getAllActivities(),
      getUnlockedResearchIds(),
      getCurrentPrestige(),
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

    const completedSet = new Set(completedIds);
    setActiveResearch(active);
    setCompletedResearch(completedSet);
    setCurrentPrestige(prestige);
    setEligibilityContext(await loadResearchEligibilityContext(prestige, completedSet));
  };

  const allRows = useMemo(
    () => buildResearchPresentationRows(RESEARCH_PROJECTS, RESEARCH_PROJECTS),
    []
  );

  const statusByProjectId = useMemo(() => {
    const context = getEligibilityContextFallback(currentPrestige, completedResearch, eligibilityContext);

    return new Map(
      allRows.map(row => {
        const status = getResearchStatus(row.project, {
          activeResearch,
          bypassGates,
          completedResearch,
          context,
        });
        return [row.project.id, status] as const;
      })
    );
  }, [activeResearch, allRows, bypassGates, completedResearch, currentPrestige, eligibilityContext]);

  const lockReasonByProjectId = useMemo(() => {
    const context = getEligibilityContextFallback(currentPrestige, completedResearch, eligibilityContext);
    const reasons = new Map<string, string>();

    for (const row of allRows) {
      if (statusByProjectId.get(row.project.id) === 'locked') {
        reasons.set(row.project.id, getLockReason(row.project, context));
      }
    }

    return reasons;
  }, [allRows, completedResearch, currentPrestige, eligibilityContext, statusByProjectId]);

  const footprint = useMemo(
    () => buildResearchFootprintSummary({
      projects: RESEARCH_PROJECTS,
      completedResearch,
      activeResearch,
    }),
    [activeResearch, completedResearch]
  );

  const visibleRows = useMemo(() => {
    const visibleIds = new Set(
      deriveVisibleResearchProjects(RESEARCH_PROJECTS, completedResearch, activeResearch, bypassGates)
        .map(project => project.id)
    );

    return allRows
      .filter(row => visibleIds.has(row.project.id))
      .sort((left, right) => compareRecommended(left, right, statusByProjectId));
  }, [activeResearch, allRows, bypassGates, completedResearch, statusByProjectId]);

  const groupedRows = useMemo(() => (
    RESEARCH_DISPLAY_GROUPS
      .map(group => ({
        group,
        rows: visibleRows.filter(row => row.group.id === group.id),
      }))
      .filter(group => group.rows.length > 0)
  ), [visibleRows]);

  const groupStatsById = useMemo(() => {
    const stats = new Map<ResearchDisplayGroupId, GroupStats>();

    for (const group of RESEARCH_DISPLAY_GROUPS) {
      const groupRows = allRows.filter(row => row.group.id === group.id);
      stats.set(group.id, {
        total: groupRows.length,
        completed: groupRows.filter(row => statusByProjectId.get(row.project.id) === 'completed').length,
        available: groupRows.filter(row => statusByProjectId.get(row.project.id) === 'available').length,
        inProgress: groupRows.filter(row => statusByProjectId.get(row.project.id) === 'in-progress').length,
      });
    }

    return stats;
  }, [allRows, statusByProjectId]);

  const handleStartResearch = async (project: ResearchProject) => {
    const status = statusByProjectId.get(project.id);
    if (status === 'in-progress' || status === 'completed' || status === 'locked') {
      return;
    }

    setStartingProjectId(project.id);
    try {
      await getResearchUpgradeFeature().workflow.startResearch(project.id);
      await loadResearchStatus();
    } finally {
      setStartingProjectId(null);
    }
  };

  const toggleExpanded = (projectId: string) => {
    setExpandedProjectIds(previous => {
      const next = new Set(previous);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const jumpToProject = (projectId: string) => {
    setExpandedProjectIds(previous => new Set(previous).add(projectId));
    setHighlightedProjectId(projectId);
    setScrollTargetProjectId(projectId);
  };

  return (
    <div className="flex flex-col gap-5">
      {view !== 'catalog' && <ResearchFootprintOverview footprint={footprint} />}

      {view !== 'footprint' && (groupedRows.length > 0 ? (
        <div className="flex flex-col gap-5">
          {groupedRows.map(({ group, rows }) => (
            <ResearchGroupSection
              key={group.id}
              group={group}
              rows={rows}
              stats={groupStatsById.get(group.id)}
              expandedProjectIds={expandedProjectIds}
              highlightedProjectId={highlightedProjectId}
              lockReasonByProjectId={lockReasonByProjectId}
              statusByProjectId={statusByProjectId}
              startingProjectId={startingProjectId}
              onJumpToProject={jumpToProject}
              onStartResearch={handleStartResearch}
              onToggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No research projects are currently visible.
        </div>
      ))}
    </div>
  );
}

function ResearchFootprintOverview(props: {
  footprint: ReturnType<typeof buildResearchFootprintSummary>;
}) {
  const { footprint } = props;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Route className="size-4 text-muted-foreground" />
            Research Footprint
          </div>
          <p className="text-xs text-muted-foreground">
            Completed unlocks, active work, and current ladder caps from the research catalog.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{footprint.statusCounts.completed} completed</Badge>
          <Badge variant="outline">{footprint.statusCounts.inProgress} in progress</Badge>
          <Badge variant="outline">{footprint.statusCounts.remaining} remaining</Badge>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.1fr_1.2fr_1fr]">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unlock Footprint</div>
          <div className="flex flex-wrap gap-2">
            {footprint.unlockTypeSummaries.length > 0 ? (
              footprint.unlockTypeSummaries.map(summary => (
                <Badge key={summary.type} variant={summary.completedCount > 0 ? 'secondary' : 'outline'}>
                  {summary.label}: {summary.completedCount}/{summary.totalCount}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No unlock payloads in catalog.</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Capacity Ladders</div>
          <div className="grid gap-2">
            {footprint.ladderSummaries.map(summary => {
              const progressPercent = summary.totalSteps > 0
                ? Math.round((summary.completedSteps / summary.totalSteps) * 100)
                : 0;

              return (
                <div key={summary.chainType} className="grid gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{summary.label}</span>
                    <span className="text-muted-foreground">
                      Current {summary.currentLabel}
                      {summary.activeProjectTitle ? ` | active: ${summary.activeProjectTitle}` : ''}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {summary.completedSteps}/{summary.totalSteps} steps
                    {summary.nextProjectTitle ? ` | next: ${summary.nextProjectTitle}` : ' | ladder complete'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chained Research</div>
            <div className="grid gap-2">
              {footprint.chainSummaries.length > 0 ? (
                footprint.chainSummaries.map(summary => {
                  const progressPercent = summary.totalSteps > 0
                    ? Math.round((summary.completedSteps / summary.totalSteps) * 100)
                    : 0;

                  return (
                    <div key={summary.chainId} className="grid gap-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-medium">{summary.label}</span>
                        <span className="text-muted-foreground">
                          Current {summary.currentProjectTitle ?? 'starting up'}
                          {summary.activeProjectTitle ? ` | active: ${summary.activeProjectTitle}` : ''}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {summary.completedSteps}/{summary.totalSteps} steps
                        {summary.nextProjectTitle ? ` | next: ${summary.nextProjectTitle}` : ' | chain complete'}
                      </div>
                    </div>
                  );
                })
              ) : (
                <span className="text-xs text-muted-foreground">No prerequisite chains in catalog yet.</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed Impacts</div>
          {footprint.completedImpactLines.length > 0 ? (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {footprint.completedImpactLines.slice(-4).map(line => (
                <li key={line} className="rounded-md bg-background px-2 py-1">
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-md border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
              Completed research impacts will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResearchGroupSection(props: {
  group: ResearchDisplayGroup;
  rows: ResearchProjectPresentationRow[];
  stats?: GroupStats;
  expandedProjectIds: Set<string>;
  highlightedProjectId: string | null;
  lockReasonByProjectId: Map<string, string>;
  statusByProjectId: Map<string, ResearchStatus>;
  startingProjectId: string | null;
  onJumpToProject: (projectId: string) => void;
  onStartResearch: (project: ResearchProject) => void;
  onToggleExpanded: (projectId: string) => void;
}) {
  const frontierCount = props.rows.filter(row => {
    const status = props.statusByProjectId.get(row.project.id);
    return status === 'available' || status === 'in-progress';
  }).length;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{props.group.title}</h3>
          <p className="text-xs text-muted-foreground">{props.group.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {props.stats?.completed ?? 0}/{props.stats?.total ?? props.rows.length} completed
          </Badge>
          <Badge variant="outline">{frontierCount} frontier</Badge>
          {(props.stats?.inProgress ?? 0) > 0 && (
            <Badge variant="outline">{props.stats?.inProgress} active</Badge>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="hidden border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(7rem,0.45fr)_minmax(7.5rem,0.45fr)] lg:gap-3">
          <div>Project</div>
          <div>Gates</div>
          <div>Impact</div>
          <div>Cost / Work</div>
          <div>Action</div>
        </div>
        <div className="divide-y">
          {props.rows.map(row => (
            <ResearchProjectRow
              key={row.project.id}
              row={row}
              isHighlighted={props.highlightedProjectId === row.project.id}
              isExpanded={props.expandedProjectIds.has(row.project.id)}
              lockReason={props.lockReasonByProjectId.get(row.project.id) || ''}
              status={props.statusByProjectId.get(row.project.id) || 'available'}
              startingProjectId={props.startingProjectId}
              onJumpToProject={props.onJumpToProject}
              onStartResearch={props.onStartResearch}
              onToggleExpanded={props.onToggleExpanded}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ResearchProjectRow(props: {
  row: ResearchProjectPresentationRow;
  status: ResearchStatus;
  isHighlighted: boolean;
  isExpanded: boolean;
  lockReason: string;
  startingProjectId: string | null;
  onJumpToProject: (projectId: string) => void;
  onStartResearch: (project: ResearchProject) => void;
  onToggleExpanded: (projectId: string) => void;
}) {
  const { row, status } = props;
  const isDisabled = status === 'in-progress' || status === 'completed' || status === 'locked' || props.startingProjectId === row.project.id;
  const chainLabel = row.chainType && row.chainUnlockValue !== null
    ? `${row.chainLabel} -> ${formatResearchChainValue(row.chainType, row.chainUnlockValue)}`
    : null;
  const isCompactCompleted = status === 'completed' && !props.isExpanded;
  const rowGridClass = 'lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(7rem,0.45fr)_minmax(7.5rem,0.45fr)]';

  if (isCompactCompleted) {
    return (
      <div
        id={getResearchRowDomId(row.project.id)}
        className={cn(
          'grid gap-2 px-3 py-2 text-xs transition-colors lg:grid lg:items-center',
          rowGridClass,
          props.isHighlighted ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/10'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Button
            aria-expanded={props.isExpanded}
            aria-label={`Expand ${row.project.title}`}
            variant="ghost"
            size="icon"
            onClick={() => props.onToggleExpanded(row.project.id)}
            className="size-7 shrink-0"
          >
            <ChevronDown data-icon="inline-start" />
          </Button>
          <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{row.project.title}</div>
            <div className="truncate text-muted-foreground">{row.primaryImpact}</div>
          </div>
        </div>
        <div className="hidden min-w-0 text-muted-foreground lg:block">
          {row.chainLabel || 'Completed research'}
        </div>
        <div className="hidden min-w-0 truncate text-muted-foreground lg:block">
          {row.unlocksNextLinks.length ? `Unlocks next: ${formatTitleList(row.unlocksNextTitles)}` : 'No direct follow-up'}
        </div>
        <div className="hidden text-muted-foreground lg:block">Done</div>
        <div className="flex lg:justify-end">
          <Badge variant="outline">Done</Badge>
        </div>
      </div>
    );
  }

  return (
    <div
      id={getResearchRowDomId(row.project.id)}
      className={cn(
        'grid gap-3 px-3 py-3 transition-colors lg:grid lg:items-center',
        rowGridClass,
        props.isHighlighted && 'bg-primary/10 ring-1 ring-primary/30',
        status === 'completed' && !props.isHighlighted && 'bg-muted/10 text-muted-foreground',
        status === 'locked' && 'bg-muted/10'
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Button
          aria-expanded={props.isExpanded}
          aria-label={`${props.isExpanded ? 'Collapse' : 'Expand'} ${row.project.title}`}
          variant="ghost"
          size="icon"
          onClick={() => props.onToggleExpanded(row.project.id)}
          className="mt-0.5 shrink-0"
        >
          <ChevronDown
            data-icon="inline-start"
            className={cn('transition-transform', props.isExpanded && 'rotate-180')}
          />
        </Button>

        <div className="mt-1 shrink-0">
          <StatusIcon status={status} />
        </div>

        {renderProjectIcon(row.project)}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="break-words text-sm font-semibold text-foreground">{row.project.title}</h4>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.project.description}</p>
          {chainLabel && (
            <Badge variant="outline" className="mt-2">
              <GitBranch className="mr-1 size-3" />
              {chainLabel}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 text-xs">
        <div className="flex flex-wrap gap-1.5">
          {row.gateChips.length > 0 ? (
            row.gateChips.map(chip => (
              <Badge key={`${row.project.id}-${chip.type}`} variant="outline">
                {chip.label}
              </Badge>
            ))
          ) : (
            <Badge variant="secondary">Open</Badge>
          )}
        </div>
        <div className="flex flex-col gap-1 text-muted-foreground">
          {row.prerequisiteLinks.length ? (
            <span className="min-w-0">
              Depends:{' '}
              <DependencyInlineLinks
                links={row.prerequisiteLinks}
                maxVisible={1}
                onJumpToProject={props.onJumpToProject}
              />
            </span>
          ) : (
            <span>No prerequisites</span>
          )}
          {row.unlocksNextLinks.length ? (
            <span className="min-w-0">
              Unlocks next:{' '}
              <DependencyInlineLinks
                links={row.unlocksNextLinks}
                maxVisible={1}
                onJumpToProject={props.onJumpToProject}
              />
            </span>
          ) : (
            <span>No direct follow-up</span>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 text-xs">
        <div className="font-medium text-foreground">{row.primaryImpact}</div>
        <div className="flex flex-wrap gap-1.5">
          {row.unlockTypeLabels.length > 0 ? (
            row.unlockTypeLabels.map(label => (
              <Badge key={`${row.project.id}-${label}`} variant="secondary">
                {label}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">Permanent / knowledge</Badge>
          )}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-3 gap-2 text-xs lg:grid-cols-1">
        <Metric label="Cost" value={formatNumber(row.totalCost, { currency: true, decimals: 0 })} />
        <Metric label="Work" value={row.totalWork.toLocaleString()} />
        <Metric label="Cx" value={`${row.project.complexity}/10`} />
      </div>

      <div className="flex min-w-0 lg:justify-end">
        <Button
          size="sm"
          variant={status === 'available' ? 'default' : 'outline'}
          disabled={isDisabled}
          onClick={() => props.onStartResearch(row.project)}
          className="w-full min-w-0 px-2"
        >
          {getActionIcon(status, props.startingProjectId === row.project.id)}
          {getActionLabel(status, props.startingProjectId === row.project.id)}
        </Button>
      </div>

      {props.isExpanded && (
        <div className="rounded-md border bg-muted/20 p-3 lg:col-span-5">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Benefits</div>
              <ul className="flex flex-col gap-1 text-sm">
                {row.project.benefits.map(benefit => (
                  <li key={benefit} className="flex gap-2">
                    <span className="mt-1 size-1.5 rounded-full bg-primary" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dependency Path</div>
              <div className="flex flex-col gap-2 text-sm">
                <DependencyLine
                  label="Depends on"
                  links={row.prerequisiteLinks}
                  fallback="No prerequisites"
                  onJumpToProject={props.onJumpToProject}
                />
                <DependencyLine
                  label="Current node"
                  links={[{ id: row.project.id, title: row.project.title }]}
                  onJumpToProject={props.onJumpToProject}
                />
                <DependencyLine
                  label="Unlocks next"
                  links={row.unlocksNextLinks}
                  fallback="No direct follow-up"
                  onJumpToProject={props.onJumpToProject}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payload</div>
              <div className="flex flex-col gap-2 text-sm">
                {(row.project.unlocks || []).length > 0 ? (
                  row.project.unlocks?.map((unlock, index) => (
                    <div key={`${row.project.id}-unlock-${index}`} className="rounded-md bg-background px-2 py-1">
                      <span className="font-medium">{getUnlockTypeLabel(unlock.type)}:</span>{' '}
                      {unlock.displayName || String(unlock.value)}
                    </div>
                  ))
                ) : (
                  <div className="rounded-md bg-background px-2 py-1">No unlock payload.</div>
                )}
                {(row.project.permanentEffects || []).map((effect, index) => (
                  <div key={`${row.project.id}-effect-${index}`} className="rounded-md bg-background px-2 py-1">
                    <span className="font-medium">Permanent effect:</span> {effect.description || effect.kind}
                  </div>
                ))}
                {props.lockReason && (
                  <div className="rounded-md border bg-background px-2 py-1 text-muted-foreground">
                    <span className="font-medium text-foreground">Locked:</span> {props.lockReason}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{props.label}</div>
      <div className="font-semibold text-foreground">{props.value}</div>
    </div>
  );
}

function DependencyInlineLinks(props: {
  links: { id: string; title: string }[];
  maxVisible?: number;
  onJumpToProject: (projectId: string) => void;
}) {
  const visibleLinks = props.maxVisible ? props.links.slice(0, props.maxVisible) : props.links;
  const remainingCount = props.maxVisible ? Math.max(0, props.links.length - props.maxVisible) : 0;

  return (
    <>
      {visibleLinks.map((link, index) => (
        <span key={link.id}>
          {index > 0 ? ', ' : ''}
          <button
            type="button"
            onClick={() => props.onJumpToProject(link.id)}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {link.title}
          </button>
        </span>
      ))}
      {remainingCount > 0 && <span> +{remainingCount}</span>}
    </>
  );
}

function DependencyLine(props: {
  label: string;
  links: { id: string; title: string }[];
  fallback?: string;
  onJumpToProject: (projectId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{props.label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {props.links.length > 0 ? (
          props.links.map(link => (
            <Button
              key={link.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => props.onJumpToProject(link.id)}
              className="h-7 px-2 text-xs"
            >
              {link.title}
            </Button>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">{props.fallback}</span>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ResearchStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-4 text-muted-foreground" />;
    case 'in-progress':
      return <Clock3 className="size-4 animate-pulse text-sky-600" />;
    case 'locked':
      return <LockKeyhole className="size-4 text-amber-600" />;
    case 'available':
      return <CircleDot className="size-4 text-primary" />;
    default:
      return null;
  }
}

function StatusBadge({ status }: { status: ResearchStatus }) {
  switch (status) {
    case 'completed':
      return <Badge variant="secondary">Completed</Badge>;
    case 'in-progress':
      return <Badge variant="secondary">In progress</Badge>;
    case 'locked':
      return <Badge variant="outline">Locked</Badge>;
    case 'available':
      return <Badge>Available</Badge>;
    default:
      return null;
  }
}

function getActionIcon(status: ResearchStatus, isStarting: boolean) {
  if (isStarting || status === 'in-progress') {
    return <Clock3 data-icon="inline-start" />;
  }

  if (status === 'completed') {
    return <CheckCircle2 data-icon="inline-start" />;
  }

  if (status === 'locked') {
    return <LockKeyhole data-icon="inline-start" />;
  }

  return <Play data-icon="inline-start" />;
}

function getActionLabel(status: ResearchStatus, isStarting: boolean): string {
  if (isStarting) {
    return 'Starting...';
  }

  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in-progress':
      return 'In Progress';
    case 'locked':
      return 'Locked';
    case 'available':
      return 'Start';
    default:
      return 'Start';
  }
}

function renderProjectIcon(project: ResearchProject) {
  if (!project.icon) {
    return null;
  }

  if (project.icon.startsWith('/') || project.icon.startsWith('http')) {
    return (
      <img
        src={project.icon}
        alt=""
        className="mt-0.5 size-8 shrink-0 object-contain"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return <div className="mt-1 w-6 shrink-0 text-center text-lg leading-none">{project.icon}</div>;
}

function compareRecommended(
  left: ResearchProjectPresentationRow,
  right: ResearchProjectPresentationRow,
  statusByProjectId: Map<string, ResearchStatus>
): number {
  const leftGroup = GROUP_ORDER.get(left.group.id) ?? Number.MAX_SAFE_INTEGER;
  const rightGroup = GROUP_ORDER.get(right.group.id) ?? Number.MAX_SAFE_INTEGER;
  if (leftGroup !== rightGroup) {
    return leftGroup - rightGroup;
  }

  const leftStatus = STATUS_ORDER[statusByProjectId.get(left.project.id) || 'available'];
  const rightStatus = STATUS_ORDER[statusByProjectId.get(right.project.id) || 'available'];
  if (leftStatus !== rightStatus) {
    return leftStatus - rightStatus;
  }

  return (PROJECT_ORDER.get(left.project.id) ?? 0) - (PROJECT_ORDER.get(right.project.id) ?? 0);
}

function getResearchStatus(project: ResearchProject, input: {
  activeResearch: Set<string>;
  bypassGates: boolean;
  completedResearch: Set<string>;
  context: ResearchEligibilityContext;
}): ResearchStatus {
  if (input.completedResearch.has(project.id)) return 'completed';
  if (input.activeResearch.has(project.id)) return 'in-progress';
  if (!input.bypassGates && !isResearchProjectEligible(project, input.context)) return 'locked';
  return 'available';
}

function getLockReason(project: ResearchProject, context: ResearchEligibilityContext): string {
  const reasons = getResearchRequirementReasons(project, context).map(reason => {
    if (reason.startsWith('Complete prerequisite research: ')) {
      const rawIds = reason.replace('Complete prerequisite research: ', '').split(', ').filter(Boolean);
      const missingTitles = rawIds.map(id => RESEARCH_PROJECTS.find(candidate => candidate.id === id)?.title ?? id);
      return `Complete first: ${missingTitles.join(', ')}`;
    }
    return reason;
  });

  return reasons.join(' | ');
}

function getEligibilityContextFallback(
  currentPrestige: number,
  completedResearch: Set<string>,
  eligibilityContext: ResearchEligibilityContext | null
): ResearchEligibilityContext {
  return eligibilityContext || {
    currentPrestige,
    completedResearch,
    companyValue: Number.MAX_SAFE_INTEGER,
    maxBuyerLoyaltyLevel: 3 as const,
    unlockedAchievementIds: new Set(RESEARCH_PROJECTS.flatMap(project => project.requiredAchievementIds || [])),
  };
}

function getResearchRowDomId(projectId: string): string {
  return `research-row-${projectId}`;
}

function formatTitleList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] || '';
  }

  return `${values[0]} +${values.length - 1}`;
}
