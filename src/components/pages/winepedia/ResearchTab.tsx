import { useEffect, useMemo, useState } from 'react';
import { RESEARCH_PROJECTS, RESEARCH_PROJECT_COMPLEXITY_COST_MULTIPLIER, RESEARCH_PROJECT_COMPLEXITY_WORK_MULTIPLIER, type UnlockType } from '@/lib/constants/researchConstants';
import { calculateResearchCost, calculateResearchWork } from '@/lib/services/activity/workcalculators/researchWorkCalculator';
import { formatNumber } from '@/lib/utils/utils';

interface CostWorkRow {
  id: string;
  title: string;
  category: string;
  complexity: number;
  cost: number;
  work: number;
  hasPrestigeGate: boolean;
  hasPrerequisites: boolean;
  hasContractTypeUnlock: boolean;
}

function unlockTypeLabel(type: UnlockType): string {
  switch (type) {
    case 'grape':
      return 'grape';
    case 'fermentation_technology':
      return 'fermentation technology';
    case 'staff_limit':
      return 'staff limit';
    case 'vineyard_size':
      return 'max size per vineyard';
    case 'total_vineyard_hectares':
      return 'max total vineyard area';
    case 'vineyard_count':
      return 'max vineyard count';
    case 'contract_type':
      return 'contract type';
    case 'wine_feature':
      return 'wine feature';
    case 'grape_buyer_slots':
      return 'grape buyer slots';
    case 'grape_buyer_limit_multiplier':
      return 'buyer limit multiplier';
    case 'grape_buyer_multiplier_bonus':
      return 'buyer multiplier bonus';
    case 'grape_buyer_country_access':
      return 'buyer country access';
    default:
      return type;
  }
}

export function ResearchTab() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [gateFilter, setGateFilter] = useState<'all' | 'gated' | 'ungated' | 'contract'>('all');
  const [sortBy, setSortBy] = useState<'cost' | 'work' | 'complexity' | 'title'>('cost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewLimit, setViewLimit] = useState<'15' | '30' | '60' | 'all'>('30');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const data = useMemo(() => {
    const rows: CostWorkRow[] = RESEARCH_PROJECTS.map((project) => {
      const { totalWork } = calculateResearchWork(project.id);
      return {
        id: project.id,
        title: project.title,
        category: project.category,
        complexity: project.complexity,
        cost: calculateResearchCost(project.id),
        work: totalWork,
        hasPrestigeGate: typeof project.requiredPrestige === 'number',
        hasPrerequisites: Boolean(project.prerequisites?.length),
        hasContractTypeUnlock: (project.unlocks || []).some((unlock) => unlock.type === 'contract_type')
      };
    });

    const unlockTypeCounts = new Map<string, number>();
    const staffLimits: number[] = [];
    const vineyardLimits: number[] = [];
    const totalVineyardLimits: number[] = [];
    const vineyardCountLimits: number[] = [];

    for (const project of RESEARCH_PROJECTS) {
      for (const unlock of project.unlocks || []) {
        const key = unlockTypeLabel(unlock.type);
        unlockTypeCounts.set(key, (unlockTypeCounts.get(key) || 0) + 1);

        if (unlock.type === 'staff_limit' && typeof unlock.value === 'number') {
          staffLimits.push(unlock.value);
        }
        if (unlock.type === 'vineyard_size' && typeof unlock.value === 'number') {
          vineyardLimits.push(unlock.value);
        }
        if (unlock.type === 'total_vineyard_hectares' && typeof unlock.value === 'number') {
          totalVineyardLimits.push(unlock.value);
        }
        if (unlock.type === 'vineyard_count' && typeof unlock.value === 'number') {
          vineyardCountLimits.push(unlock.value);
        }
      }
    }

    const byCategory = new Map<string, number>();
    for (const project of RESEARCH_PROJECTS) {
      byCategory.set(project.category, (byCategory.get(project.category) || 0) + 1);
    }

    const contractTypeProjects = RESEARCH_PROJECTS.filter((project) =>
      (project.unlocks || []).some((unlock) => unlock.type === 'contract_type')
    );

    const gatedProjects = rows.filter((row) => row.hasPrestigeGate || row.hasPrerequisites).length;

    return {
      rows,
      categoryCounts: Array.from(byCategory.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      unlockTypeCounts: Array.from(unlockTypeCounts.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      avgCost: rows.reduce((sum, row) => sum + row.cost, 0) / Math.max(rows.length, 1),
      avgWork: rows.reduce((sum, row) => sum + row.work, 0) / Math.max(rows.length, 1),
      minCost: Math.min(...rows.map((row) => row.cost)),
      maxCost: Math.max(...rows.map((row) => row.cost)),
      minWork: Math.min(...rows.map((row) => row.work)),
      maxWork: Math.max(...rows.map((row) => row.work)),
      gatedProjects,
      staffLimits: Array.from(new Set(staffLimits)).sort((a, b) => a - b),
      vineyardLimits: Array.from(new Set(vineyardLimits)).sort((a, b) => a - b),
      totalVineyardLimits: Array.from(new Set(totalVineyardLimits)).sort((a, b) => a - b),
      vineyardCountLimits: Array.from(new Set(vineyardCountLimits)).sort((a, b) => a - b),
      contractTypeProjects
    };
  }, []);

  const projectById = useMemo(() => {
    const entries = RESEARCH_PROJECTS.map((project) => [project.id, project] as const);
    return new Map(entries);
  }, []);

  const filteredSortedRows = useMemo(() => {
    const filtered = data.rows.filter((row) => {
      if (categoryFilter !== 'all' && row.category !== categoryFilter) {
        return false;
      }

      if (gateFilter === 'gated' && !(row.hasPrestigeGate || row.hasPrerequisites)) {
        return false;
      }
      if (gateFilter === 'ungated' && (row.hasPrestigeGate || row.hasPrerequisites)) {
        return false;
      }
      if (gateFilter === 'contract' && !row.hasContractTypeUnlock) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      let result = 0;
      if (sortBy === 'title') {
        result = a.title.localeCompare(b.title);
      } else if (sortBy === 'complexity') {
        result = a.complexity - b.complexity;
      } else if (sortBy === 'cost') {
        result = a.cost - b.cost;
      } else if (sortBy === 'work') {
        result = a.work - b.work;
      }
      return sortDir === 'asc' ? result : -result;
    });

    return filtered;
  }, [categoryFilter, data.rows, gateFilter, sortBy, sortDir]);

  const visibleRows = useMemo(() => {
    if (viewLimit === 'all') {
      return filteredSortedRows;
    }
    return filteredSortedRows.slice(0, Number(viewLimit));
  }, [filteredSortedRows, viewLimit]);

  useEffect(() => {
    if (!filteredSortedRows.length) {
      setSelectedProjectId('');
      return;
    }

    const exists = filteredSortedRows.some((row) => row.id === selectedProjectId);
    if (!exists) {
      setSelectedProjectId(filteredSortedRows[0].id);
    }
  }, [filteredSortedRows, selectedProjectId]);

  const selectedRow = filteredSortedRows.find((row) => row.id === selectedProjectId) || null;
  const selectedProject = selectedRow ? (projectById.get(selectedRow.id) || null) : null;
  const selectedRank = selectedRow ? (filteredSortedRows.findIndex((row) => row.id === selectedRow.id) + 1) : 0;

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium mb-1">Core Formulas</p>
        <ul className="text-xs space-y-1">
          <li>Cost formula: base category cost x (1 + (complexity - 1) x {RESEARCH_PROJECT_COMPLEXITY_COST_MULTIPLIER.toFixed(2)})</li>
          <li>Default work complexity curve: (complexity - 1) x {RESEARCH_PROJECT_COMPLEXITY_WORK_MULTIPLIER.toFixed(2)}</li>
          <li>Project-specific work profiles can override complexity curve and add scope/setup work.</li>
          <li>Contract gating uses unlock type contract_type in contract generation.</li>
        </ul>
      </div>

      <div>
        <p className="font-medium mb-1">Portfolio Summary</p>
        <div className="overflow-x-auto max-w-4xl">
          <table className="w-full text-left text-xs border-collapse">
            <tbody>
              <tr className="border-b"><td className="py-1 pr-2">Total projects</td><td className="py-1 pr-2">{data.rows.length}</td></tr>
              <tr className="border-b"><td className="py-1 pr-2">Projects with gates (prestige or prerequisites)</td><td className="py-1 pr-2">{data.gatedProjects}</td></tr>
              <tr className="border-b"><td className="py-1 pr-2">Average cost</td><td className="py-1 pr-2">{formatNumber(Math.round(data.avgCost), { currency: true, decimals: 0 })}</td></tr>
              <tr className="border-b"><td className="py-1 pr-2">Average total work</td><td className="py-1 pr-2">{Math.round(data.avgWork).toLocaleString()} units</td></tr>
              <tr className="border-b"><td className="py-1 pr-2">Cost range</td><td className="py-1 pr-2">{formatNumber(data.minCost, { currency: true, decimals: 0 })} - {formatNumber(data.maxCost, { currency: true, decimals: 0 })}</td></tr>
              <tr className="border-b"><td className="py-1 pr-2">Work range</td><td className="py-1 pr-2">{data.minWork.toLocaleString()} - {data.maxWork.toLocaleString()} units</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Projects by Category</p>
        <div className="overflow-x-auto max-w-4xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">Category</th>
                <th className="py-1 pr-2">Project Count</th>
              </tr>
            </thead>
            <tbody>
              {data.categoryCounts.map(([category, count]) => (
                <tr key={category} className="border-b">
                  <td className="py-1 pr-2">{category}</td>
                  <td className="py-1 pr-2">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Unlock Types in Catalog</p>
        <div className="overflow-x-auto max-w-4xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">Unlock Type</th>
                <th className="py-1 pr-2">Project Count</th>
              </tr>
            </thead>
            <tbody>
              {data.unlockTypeCounts.map(([type, count]) => (
                <tr key={type} className="border-b">
                  <td className="py-1 pr-2">{type}</td>
                  <td className="py-1 pr-2">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Progression Ladders</p>
        <ul className="text-xs space-y-1">
          <li>Staff cap unlock ladder: {data.staffLimits.length ? data.staffLimits.join(' -> ') : 'none'}</li>
          <li>Vineyard size unlock ladder (ha): {data.vineyardLimits.length ? data.vineyardLimits.join(' -> ') : 'none'}</li>
        </ul>
      </div>

      <div>
        <p className="font-medium mb-1">Contract Type Unlock Projects</p>
        <div className="overflow-x-auto max-w-5xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">Project</th>
                <th className="py-1 pr-2">Complexity</th>
                <th className="py-1 pr-2">Cost</th>
                <th className="py-1 pr-2">Work</th>
              </tr>
            </thead>
            <tbody>
              {data.contractTypeProjects.map((project) => {
                const row = data.rows.find((entry) => entry.id === project.id);
                if (!row) return null;
                return (
                  <tr key={project.id} className="border-b">
                    <td className="py-1 pr-2">{project.title}</td>
                    <td className="py-1 pr-2">{row.complexity}</td>
                    <td className="py-1 pr-2">{formatNumber(row.cost, { currency: true, decimals: 0 })}</td>
                    <td className="py-1 pr-2">{row.work.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Project Selector (Filter/Sort/Rank)</p>
        <div className="flex flex-wrap items-end gap-3 text-xs mb-2">
          <label className="flex flex-col gap-1">
            <span>Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border rounded px-2 py-1 bg-white"
            >
              <option value="all">All</option>
              {data.categoryCounts.map(([category]) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span>Gate Filter</span>
            <select
              value={gateFilter}
              onChange={(e) => setGateFilter(e.target.value as 'all' | 'gated' | 'ungated' | 'contract')}
              className="border rounded px-2 py-1 bg-white"
            >
              <option value="all">All</option>
              <option value="gated">Gated only</option>
              <option value="ungated">Ungated only</option>
              <option value="contract">Contract unlock only</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span>Sort By</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'cost' | 'work' | 'complexity' | 'title')}
              className="border rounded px-2 py-1 bg-white"
            >
              <option value="cost">Cost</option>
              <option value="work">Work</option>
              <option value="complexity">Complexity</option>
              <option value="title">Title</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span>Direction</span>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
              className="border rounded px-2 py-1 bg-white"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span>Visible Rows</span>
            <select
              value={viewLimit}
              onChange={(e) => setViewLimit(e.target.value as '15' | '30' | '60' | 'all')}
              className="border rounded px-2 py-1 bg-white"
            >
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="60">60</option>
              <option value="all">All</option>
            </select>
          </label>

          <div className="text-xs text-gray-600 pb-1">
            Showing {visibleRows.length} / {filteredSortedRows.length} filtered projects
          </div>
        </div>

        <div className="overflow-x-auto max-w-6xl border rounded">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2 pl-2">Rank</th>
                <th className="py-1 pr-2">Project</th>
                <th className="py-1 pr-2">Category</th>
                <th className="py-1 pr-2">Complexity</th>
                <th className="py-1 pr-2">Cost</th>
                <th className="py-1 pr-2">Work</th>
                <th className="py-1 pr-2">Gated</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const rank = filteredSortedRows.findIndex((entry) => entry.id === row.id) + 1;
                const isSelected = row.id === selectedProjectId;
                return (
                <tr
                  key={row.id}
                  className={`border-b cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => setSelectedProjectId(row.id)}
                >
                  <td className="py-1 pr-2 pl-2">{rank}</td>
                  <td className="py-1 pr-2">{row.title}</td>
                  <td className="py-1 pr-2">{row.category}</td>
                  <td className="py-1 pr-2">{row.complexity}</td>
                  <td className="py-1 pr-2">{formatNumber(row.cost, { currency: true, decimals: 0 })}</td>
                  <td className="py-1 pr-2">{row.work.toLocaleString()}</td>
                  <td className="py-1 pr-2">{row.hasPrestigeGate || row.hasPrerequisites ? 'Yes' : 'No'}</td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRow && selectedProject && (
        <div>
          <p className="font-medium mb-1">Selected Project Mechanics</p>
          <div className="text-xs mb-2">#{selectedRank} in current ranking: {selectedProject.title}</div>

          <div className="overflow-x-auto max-w-5xl mb-3">
            <table className="w-full text-left text-xs border-collapse">
              <tbody>
                <tr className="border-b"><td className="py-1 pr-2">Project ID</td><td className="py-1 pr-2">{selectedProject.id}</td></tr>
                <tr className="border-b"><td className="py-1 pr-2">Category</td><td className="py-1 pr-2">{selectedRow.category}</td></tr>
                <tr className="border-b"><td className="py-1 pr-2">Complexity</td><td className="py-1 pr-2">{selectedRow.complexity}</td></tr>
                <tr className="border-b"><td className="py-1 pr-2">Cost</td><td className="py-1 pr-2">{formatNumber(selectedRow.cost, { currency: true, decimals: 0 })}</td></tr>
                <tr className="border-b"><td className="py-1 pr-2">Total Work</td><td className="py-1 pr-2">{selectedRow.work.toLocaleString()} units</td></tr>
                <tr className="border-b"><td className="py-1 pr-2">Prestige reward</td><td className="py-1 pr-2">{selectedProject.prestigeReward ?? 0}</td></tr>
                <tr className="border-b"><td className="py-1 pr-2">Reward amount</td><td className="py-1 pr-2">{typeof selectedProject.rewardAmount === 'number' ? formatNumber(selectedProject.rewardAmount, { currency: true, decimals: 0 }) : 'none'}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto max-w-5xl mb-3">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2">Gate</th>
                  <th className="py-1 pr-2">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b"><td className="py-1 pr-2">Required prestige</td><td className="py-1 pr-2">{selectedProject.requiredPrestige ?? 'none'}</td></tr>
                <tr className="border-b"><td className="py-1 pr-2">Required company value</td><td className="py-1 pr-2">{typeof selectedProject.requiredCompanyValue === 'number' ? formatNumber(selectedProject.requiredCompanyValue, { currency: true, decimals: 0 }) : 'none'}</td></tr>
                <tr className="border-b"><td className="py-1 pr-2">Required buyer loyalty level</td><td className="py-1 pr-2">{selectedProject.requiredBuyerLoyaltyLevel ?? 'none'}</td></tr>
                <tr className="border-b"><td className="py-1 pr-2">Prerequisites</td><td className="py-1 pr-2">{selectedProject.prerequisites?.length ? selectedProject.prerequisites.join(', ') : 'none'}</td></tr>
                <tr className="border-b"><td className="py-1 pr-2">Required achievements</td><td className="py-1 pr-2">{selectedProject.requiredAchievementIds?.length ? selectedProject.requiredAchievementIds.join(', ') : 'none'}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto max-w-5xl mb-3">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2">Unlock Type</th>
                  <th className="py-1 pr-2">Value</th>
                  <th className="py-1 pr-2">Display</th>
                </tr>
              </thead>
              <tbody>
                {(selectedProject.unlocks || []).length ? (
                  (selectedProject.unlocks || []).map((unlock, index) => (
                    <tr key={`${selectedProject.id}-unlock-${index}`} className="border-b">
                      <td className="py-1 pr-2">{unlockTypeLabel(unlock.type)}</td>
                      <td className="py-1 pr-2">{String(unlock.value)}</td>
                      <td className="py-1 pr-2">{unlock.displayName || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b"><td className="py-1 pr-2" colSpan={3}>none</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto max-w-5xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2">Permanent Effect Kind</th>
                  <th className="py-1 pr-2">Multiplier</th>
                  <th className="py-1 pr-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {(selectedProject.permanentEffects || []).length ? (
                  (selectedProject.permanentEffects || []).map((effect, index) => (
                    <tr key={`${selectedProject.id}-effect-${index}`} className="border-b">
                      <td className="py-1 pr-2">{effect.kind}</td>
                      <td className="py-1 pr-2">{'multiplier' in effect ? String(effect.multiplier) : '-'}</td>
                      <td className="py-1 pr-2">{effect.description || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b"><td className="py-1 pr-2" colSpan={3}>none</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
