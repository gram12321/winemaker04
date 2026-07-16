import { describe, expect, it } from 'vitest';
import type { Staff } from '@/lib/types/types';
import { getStaffExperiencePresentation } from '@/lib/services/user/staffPresentationService';

const staff = (experience: Record<string, number>): Staff => ({
  id: 'staff-1',
  name: 'Ada Cellar',
  nationality: 'France',
  skillLevel: 0.5,
  specializedRoles: [],
  wage: 1000,
  teamIds: [],
  skills: {
    field: 0.5,
    winery: 0.5,
    maintenance: 0.5,
    financeAndStaff: 0.5,
    sales: 0.5,
    administrationAndResearch: 0.5,
  },
  experience,
  workforce: 50,
  hireDate: { week: 1, season: 'Spring', year: 2026 },
});

describe('staff experience presentation', () => {
  it('uses activity display names for learned task mastery', () => {
    expect(getStaffExperiencePresentation(staff({
      'task:HARVESTING': 20,
      'task:STAFF_SEARCH': 7,
    })).taskMastery.map(item => item.label)).toEqual(['Harvesting', 'Staff Search']);
  });
});
