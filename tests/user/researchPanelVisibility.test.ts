import { describe, expect, it } from 'vitest';
import { RESEARCH_PROJECTS } from '@/lib/constants/researchConstants';
import { getVisibleResearchProjects } from '@/lib/features/researchUpgrade/services/research/researchPresentationService';

describe('getVisibleResearchProjects', () => {
  it('shows only the first incomplete vineyard size prerequisite tier when none are completed', () => {
    const efficiencyProjects = RESEARCH_PROJECTS.filter(project => project.category === 'efficiency');

    const visibleProjectIds = getVisibleResearchProjects(
      efficiencyProjects,
      new Set<string>(['foundation_admin_baseline']),
      new Set<string>()
    ).map(project => project.id);

    expect(visibleProjectIds).toContain('eff_microplot_management');
    expect(visibleProjectIds).not.toContain('eff_smallholding_operations');
    expect(visibleProjectIds).toContain('eff_total_land_budgeting');
    expect(visibleProjectIds).toContain('eff_vineyard_registry');
    expect(visibleProjectIds).not.toContain('eff_estate_foundations');
  });

  it('hides prerequisite-locked project chains until the required project is completed', () => {
    const grantProjects = RESEARCH_PROJECTS.filter(project => project.category === 'projects');

    const initialVisibleProjectIds = getVisibleResearchProjects(
      grantProjects,
      new Set<string>(),
      new Set<string>()
    ).map(project => project.id);

    expect(initialVisibleProjectIds).toContain('foundation_grant_basic');
    expect(initialVisibleProjectIds).not.toContain('foundation_grant_programmatic');
    expect(initialVisibleProjectIds).not.toContain('foundation_grant_advanced');

    const afterBasicGrantVisibleProjectIds = getVisibleResearchProjects(
      grantProjects,
      new Set<string>(['foundation_grant_basic']),
      new Set<string>()
    ).map(project => project.id);

    expect(afterBasicGrantVisibleProjectIds).toContain('foundation_grant_programmatic');
    expect(afterBasicGrantVisibleProjectIds).not.toContain('foundation_grant_advanced');

    const afterProgrammaticVisibleProjectIds = getVisibleResearchProjects(
      grantProjects,
      new Set<string>(['foundation_grant_basic', 'foundation_grant_programmatic']),
      new Set<string>()
    ).map(project => project.id);

    expect(afterProgrammaticVisibleProjectIds).toContain('foundation_grant_advanced');
  });

  it('keeps completed chained research visible and shows the next staff cap research', () => {
    const staffProjects = RESEARCH_PROJECTS.filter(project => project.category === 'staff');
    const completedResearch = new Set<string>(['foundation_staff_onboarding', 'foundation_staff_training']);

    const visibleProjectIds = getVisibleResearchProjects(
      staffProjects,
      completedResearch,
      new Set<string>()
    ).map(project => project.id);

    expect(visibleProjectIds).toContain('foundation_staff_onboarding');
    expect(visibleProjectIds).toContain('foundation_staff_training');
    expect(visibleProjectIds).toContain('foundation_staff_leadership');
    expect(visibleProjectIds).not.toContain('staff_operational_management');
  });

  it('shows an active chained research project but hides later projects in the same chain', () => {
    const staffProjects = RESEARCH_PROJECTS.filter(project => project.category === 'staff');

    const visibleProjectIds = getVisibleResearchProjects(
      staffProjects,
      new Set<string>(['foundation_staff_onboarding']),
      new Set<string>(['foundation_staff_training'])
    ).map(project => project.id);

    expect(visibleProjectIds).toContain('foundation_staff_onboarding');
    expect(visibleProjectIds).toContain('foundation_staff_training');
    expect(visibleProjectIds).not.toContain('foundation_staff_leadership');
  });

  it('leaves admin bypass mode unchanged', () => {
    const staffProjects = RESEARCH_PROJECTS.filter(project => project.category === 'staff');

    const visibleProjectIds = getVisibleResearchProjects(
      staffProjects,
      new Set<string>(),
      new Set<string>(),
      true
    ).map(project => project.id);

    expect(visibleProjectIds).toHaveLength(staffProjects.length);
  });
});
