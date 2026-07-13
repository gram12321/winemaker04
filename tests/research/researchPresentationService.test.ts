import { describe, expect, it } from 'vitest';
import { RESEARCH_PROJECTS } from '@/lib/constants/researchConstants';
import {
  buildResearchFootprintSummary,
  getPrimaryResearchImpact,
  getResearchDependencyMetadata,
  getResearchDisplayGroup,
  getResearchGateChips,
  getResearchRequirementDetails,
  getResearchRewardDetails,
} from '@/lib/features/researchUpgrade/services/research/researchPresentationService';

function projectById(id: string) {
  const project = RESEARCH_PROJECTS.find(candidate => candidate.id === id);
  if (!project) {
    throw new Error(`Missing research project ${id}`);
  }
  return project;
}

describe('research presentation service', () => {
  it('maps catalog projects into progression-first display groups', () => {
    expect(getResearchDisplayGroup(projectById('foundation_admin_baseline')).id).toBe('foundation_governance');
    expect(getResearchDisplayGroup(projectById('foundation_staff_training')).id).toBe('vineyard_capacity');
    expect(getResearchDisplayGroup(projectById('tech_fermentation')).id).toBe('winemaking_technology');
    expect(getResearchDisplayGroup(projectById('mkt_restaurant_program')).id).toBe('market_commercial');

    const grapeResearch = RESEARCH_PROJECTS.find(project =>
      project.unlocks?.some(unlock => unlock.type === 'grape')
    );

    expect(grapeResearch).toBeDefined();
    expect(getResearchDisplayGroup(grapeResearch!).id).toBe('varietal_research');
  });

  it('builds gate and dependency metadata for compact rows', () => {
    const project = projectById('tech_fermentation_extended');
    const gateTypes = getResearchGateChips(project).map(chip => chip.type);
    const dependencyMetadata = getResearchDependencyMetadata(project, RESEARCH_PROJECTS);

    expect(gateTypes).toEqual(expect.arrayContaining(['prestige', 'prerequisite']));
    expect(dependencyMetadata.prerequisiteLinks).toEqual([
      { id: 'tech_fermentation', title: 'Fermentation Technology Basics' },
    ]);
    expect(dependencyMetadata.prerequisiteTitles).toEqual(['Fermentation Technology Basics']);
    expect(getPrimaryResearchImpact(project)).toBe('Unlocks Extended Maceration fermentation method');

    const foundationGateTypes = getResearchGateChips(projectById('foundation_admin_methodology')).map(chip => chip.type);
    expect(foundationGateTypes).toEqual(expect.arrayContaining(['company', 'age']));
  });

  it('builds player-facing reward details for unlocks and effects', () => {
    expect(getResearchRewardDetails(projectById('tech_fermentation'))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Fermentation method',
          value: 'Unlock Temperature Controlled fermentation',
        }),
        expect.objectContaining({
          label: 'Prestige',
          value: expect.stringContaining('prestige'),
        }),
      ])
    );

    expect(getResearchRewardDetails(projectById('foundation_admin_baseline'))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Admin & research work',
        }),
        expect.objectContaining({
          label: 'Prestige',
        }),
      ])
    );
  });

  it('shows the authoritative tier-specific achievement title in requirements', () => {
    const details = getResearchRequirementDetails(
      projectById('foundation_staff_training'),
      RESEARCH_PROJECTS,
      (achievementId) => achievementId === 'sales_count_tier_2'
        ? 'Sales Professional - 10 Sales'
        : undefined
    );

    expect(details).toContainEqual({
      label: 'Required Achievement',
      value: 'Sales Professional - 10 Sales',
    });
  });

  it('derives unlock-next titles and ladder footprint summaries', () => {
    const dependencyMetadata = getResearchDependencyMetadata(projectById('tech_fermentation'), RESEARCH_PROJECTS);
    const footprint = buildResearchFootprintSummary({
      projects: RESEARCH_PROJECTS,
      completedResearch: new Set(['foundation_staff_onboarding', 'foundation_staff_training', 'tech_fermentation']),
      activeResearch: new Set(['tech_fermentation_extended']),
    });

    expect(dependencyMetadata.unlocksNextTitles).toContain('Extended Maceration Protocols');
    expect(footprint.statusCounts.completed).toBe(3);
    expect(footprint.statusCounts.inProgress).toBe(1);
    expect(footprint.unlockTypeSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'staff_limit', completedCount: 2 }),
        expect.objectContaining({ type: 'fermentation_technology', completedCount: 1 }),
      ])
    );
    expect(footprint.ladderSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ chainType: 'staff_limit', currentValue: 5, completedSteps: 2 }),
      ])
    );
    expect(footprint.chainSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Basic Admin Program',
          projectIds: expect.arrayContaining([
            'foundation_admin_baseline',
            'foundation_admin_methodology',
            'foundation_admin_office',
          ]),
        }),
      ])
    );
  });
});
