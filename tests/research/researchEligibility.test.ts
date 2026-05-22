import { describe, expect, it } from 'vitest';
import type { ResearchProject } from '@/lib/constants/researchConstants';
import {
  getResearchRequirementReasons,
  isResearchProjectEligible,
  type ResearchEligibilityContext
} from '@/lib/services/research/researchEligibilityService';

function context(overrides: Partial<ResearchEligibilityContext> = {}): ResearchEligibilityContext {
  return {
    currentPrestige: 50,
    completedResearch: new Set(['starter_project']),
    companyValue: 1000000,
    maxBuyerLoyaltyLevel: 2,
    unlockedAchievementIds: new Set(['bulk_grape_kg_sold_tier_1']),
    ...overrides
  };
}

function project(overrides: Partial<ResearchProject> = {}): ResearchProject {
  return {
    id: 'advanced_market_project',
    title: 'Advanced Market Project',
    description: 'Test project',
    complexity: 5,
    benefits: [],
    category: 'market',
    icon: 'test',
    requiredPrestige: 40,
    prerequisites: ['starter_project'],
    requiredCompanyValue: 750000,
    requiredBuyerLoyaltyLevel: 2,
    requiredAchievementIds: ['bulk_grape_kg_sold_tier_1'],
    ...overrides
  } as ResearchProject;
}

describe('research eligibility', () => {
  it('accepts a project when prestige, prerequisites, value, buyer loyalty, and achievements are satisfied', () => {
    const reasons = getResearchRequirementReasons(project(), context());

    expect(reasons).toEqual([]);
    expect(isResearchProjectEligible(project(), context())).toBe(true);
  });

  it('returns explicit lock reasons for every unmet gate', () => {
    const reasons = getResearchRequirementReasons(
      project({
        requiredPrestige: 75,
        prerequisites: ['starter_project', 'missing_prereq'],
        requiredCompanyValue: 2000000,
        requiredBuyerLoyaltyLevel: 4,
        requiredAchievementIds: ['bulk_grape_kg_sold_tier_1', 'missing_achievement']
      }),
      context({
        currentPrestige: 12.8,
        companyValue: 100000,
        maxBuyerLoyaltyLevel: 1,
        completedResearch: new Set(['starter_project']),
        unlockedAchievementIds: new Set(['bulk_grape_kg_sold_tier_1'])
      })
    );

    expect(reasons).toEqual([
      'Requires 75 prestige (you have 12)',
      'Complete prerequisite research: missing_prereq',
      expect.stringContaining('Requires company value'),
      'Requires buyer loyalty level 4 (your best level is 1)',
      'Requires achievements: missing_achievement'
    ]);
    expect(isResearchProjectEligible(project({ requiredPrestige: 75 }), context({ currentPrestige: 10 }))).toBe(false);
  });
});
