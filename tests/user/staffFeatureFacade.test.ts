import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/features/activities', () => {
  throw new Error('Staff facade must not initialize Activities.');
});

vi.mock('@/lib/services/core/gameState', () => {
  throw new Error('Staff facade must not initialize core game state.');
});

describe('staffFeature facade', () => {
  it('keeps candidate creation and wage previews synchronous without loading runtime features', async () => {
    const { staffFeature } = await import('@/lib/features/staff');
    const candidate = staffFeature.records.create({
      firstName: 'Ada', lastName: 'Cellar', skillLevel: 0.5, nationality: 'France',
      hireDate: { week: 3, season: 'Summer', year: 2026 }, specializedRoles: ['winery'],
    });

    expect(candidate.hireDate).toEqual({ week: 3, season: 'Summer', year: 2026 });
    expect(candidate.wage).toBe(staffFeature.wages.calculate(candidate.skills, candidate.specializedRoles));
  });
});
