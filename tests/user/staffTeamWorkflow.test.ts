import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkCategory, type Staff, type StaffTeam } from '@/lib/types/types';

const mocks = vi.hoisted(() => {
  let state: any = {};
  let dbStaff: Staff[] = [];

  return {
    setState: (nextState: any) => {
      state = nextState;
    },
    getState: () => state,
    setDbStaff: (nextStaff: Staff[]) => {
      dbStaff = nextStaff;
    },
    getGameState: vi.fn(() => state),
    updateGameState: vi.fn(updates => {
      state = { ...state, ...updates };
    }),
    saveTeamToDb: vi.fn(async () => true),
    loadTeamsFromDb: vi.fn(async () => []),
    deleteTeamFromDb: vi.fn(async () => true),
    saveTeamsToDb: vi.fn(async () => true),
    saveStaffToDb: vi.fn(async (staff: Staff) => {
      dbStaff = dbStaff.map(candidate => candidate.id === staff.id ? staff : candidate);
      if (!dbStaff.some(candidate => candidate.id === staff.id)) {
        dbStaff = [...dbStaff, staff];
      }
      return true;
    }),
    loadStaffFromDb: vi.fn(async () => dbStaff),
    deleteStaffFromDb: vi.fn(async () => true),
    notificationAddMessage: vi.fn(async () => undefined)
  };
});

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState,
  updateGameState: mocks.updateGameState
}));

vi.mock('@/lib/database/core/teamDB', () => ({
  saveTeamToDb: mocks.saveTeamToDb,
  loadTeamsFromDb: mocks.loadTeamsFromDb,
  deleteTeamFromDb: mocks.deleteTeamFromDb,
  saveTeamsToDb: mocks.saveTeamsToDb
}));

vi.mock('@/lib/database/core/staffDB', () => ({
  saveStaffToDb: mocks.saveStaffToDb,
  loadStaffFromDb: mocks.loadStaffFromDb,
  deleteStaffFromDb: mocks.deleteStaffFromDb
}));

vi.mock('@/lib/services', () => ({
  notificationService: { addMessage: mocks.notificationAddMessage }
}));

function staff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: 'staff-1',
    name: 'Ada Cellar',
    nationality: 'France',
    skillLevel: 0.5,
    specializations: ['winery'],
    skills: {
      field: 0.4,
      winery: 0.8,
      financeAndStaff: 0.4,
      sales: 0.3,
      administrationAndResearch: 0.4
    },
    wage: 1200,
    workforce: 50,
    hireDate: { week: 1, season: 'Spring', year: 2026 },
    teamIds: [],
    experience: {},
    ...overrides
  };
}

function team(overrides: Partial<StaffTeam> = {}): StaffTeam {
  return {
    id: 'team-1',
    name: 'Winery Team',
    description: 'Winery work',
    memberIds: [],
    icon: 'wine',
    defaultTaskTypes: ['fermentation'],
    ...overrides
  };
}

describe('staff and team workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const initialStaff = staff();
    const initialTeam = team();
    mocks.setDbStaff([initialStaff]);
    mocks.setState({
      week: 1,
      season: 'Spring',
      currentYear: 2026,
      staff: [initialStaff],
      teams: [initialTeam]
    });
  });

  it('maps default task categories to the configured team', async () => {
    const { getTeamForCategory } = await import('@/lib/services/user/teamService');

    expect(getTeamForCategory(WorkCategory.FERMENTATION)).toEqual(expect.objectContaining({
      id: 'team-1',
      name: 'Winery Team'
    }));
  });

  it('adds Maintenance to the default Winery Team task classes', async () => {
    const { getDefaultTeams } = await import('@/lib/services/user/teamService');

    expect(getDefaultTeams().find((candidate) => candidate.name === 'Winery Team')).toMatchObject({
      defaultTaskTypes: expect.arrayContaining(['crushing', 'fermentation', 'maintenance']),
    });
  });

  it('assigns and removes staff from a team in both game state and persistence', async () => {
    const { assignStaffToTeam, removeStaffFromTeam } = await import('@/lib/services/user/teamService');

    await expect(assignStaffToTeam('staff-1', 'team-1')).resolves.toBe(true);
    expect(mocks.getState().staff[0].teamIds).toEqual(['team-1']);
    expect(mocks.getState().teams[0].memberIds).toEqual(['staff-1']);
    expect(mocks.saveStaffToDb).toHaveBeenCalledWith(expect.objectContaining({
      id: 'staff-1',
      teamIds: ['team-1']
    }));
    expect(mocks.saveTeamToDb).toHaveBeenCalledWith(expect.objectContaining({
      id: 'team-1',
      memberIds: ['staff-1']
    }));

    await expect(removeStaffFromTeam('staff-1', 'team-1')).resolves.toBe(true);
    expect(mocks.getState().staff[0].teamIds).toEqual([]);
    expect(mocks.getState().teams[0].memberIds).toEqual([]);
  });

  it('awards experience by category and increases effective skill toward the cap', async () => {
    const { awardExperience, calculateEffectiveSkill } = await import('@/lib/services/user/staffService');

    expect(calculateEffectiveSkill(0.5, 0)).toBe(0.5);
    expect(calculateEffectiveSkill(0.5, 100000)).toBeGreaterThan(0.5);
    expect(calculateEffectiveSkill(0.5, 100000)).toBeLessThanOrEqual(1);

    await awardExperience('staff-1', 12, ['skill:winery', 'grape:Pinot Noir']);

    expect(mocks.getState().staff[0].experience).toEqual({
      'skill:winery': 12,
      'grape:Pinot Noir': 12
    });
    expect(mocks.saveStaffToDb).toHaveBeenCalledWith(expect.objectContaining({
      id: 'staff-1',
      experience: {
        'skill:winery': 12,
        'grape:Pinot Noir': 12
      }
    }));
  });
});
