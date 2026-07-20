import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkCategory, type Staff, type StaffTeam } from '@/lib/types/types';
import { staffFeature } from '@/lib/features/staff';

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
    deleteTeamAndStaffAssignmentsFromDb: vi.fn(async () => true),
    setStaffTeamMembershipInDb: vi.fn(async () => true),
    saveTeamsToDb: vi.fn(async () => true),
    saveStaffToDb: vi.fn(async (staff: Staff) => {
      dbStaff = dbStaff.map(candidate => candidate.id === staff.id ? staff : candidate);
      if (!dbStaff.some(candidate => candidate.id === staff.id)) {
        dbStaff = [...dbStaff, staff];
      }
      return true;
    }),
    loadStaffFromDb: vi.fn(async () => dbStaff),
    getStaffByIdFromDb: vi.fn(async (staffId: string) => dbStaff.find(candidate => candidate.id === staffId) ?? null),
    deleteStaffAndTeamMembershipsFromDb: vi.fn(async () => true),
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
  deleteTeamAndStaffAssignmentsFromDb: mocks.deleteTeamAndStaffAssignmentsFromDb,
  setStaffTeamMembershipInDb: mocks.setStaffTeamMembershipInDb,
  saveTeamsToDb: mocks.saveTeamsToDb
}));

vi.mock('@/lib/database/core/staffDB', () => ({
  saveStaffToDb: mocks.saveStaffToDb,
  loadStaffFromDb: mocks.loadStaffFromDb,
  getStaffByIdFromDb: mocks.getStaffByIdFromDb,
  deleteStaffAndTeamMembershipsFromDb: mocks.deleteStaffAndTeamMembershipsFromDb
}));

vi.mock('@/lib/services/core/notificationService', () => ({
  notificationService: { addMessage: mocks.notificationAddMessage }
}));

function staff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: 'staff-1',
    name: 'Ada Cellar',
    nationality: 'France',
    skillLevel: 0.5,
    specializedRoles: [],
    skills: {
      field: 0.4,
      winery: 0.8,
      maintenance: 0.4,
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
    expect(staffFeature.teams.getForCategory(mocks.getState().teams, WorkCategory.FERMENTATION)).toEqual(expect.objectContaining({
      id: 'team-1',
      name: 'Winery Team'
    }));
  });

  it('creates a dedicated default Maintenance Team task class', async () => {
    await staffFeature.setup.initialize();
    const defaultTeams: StaffTeam[] = mocks.getState().teams;

    expect(defaultTeams.find((candidate) => candidate.name === 'Maintenance Team')).toMatchObject({
      defaultTaskTypes: ['maintenance'],
    });
    mocks.setState({ ...mocks.getState(), teams: defaultTeams });
    expect(staffFeature.teams.getForCategory(mocks.getState().teams, WorkCategory.MAINTENANCE)).toMatchObject({ name: 'Maintenance Team' });
  });

  it('assigns and removes staff from a team in both game state and persistence', async () => {
    await expect(staffFeature.teams.assign('staff-1', 'team-1')).resolves.toBe(true);
    expect(mocks.getState().staff[0].teamIds).toEqual(['team-1']);
    expect(mocks.getState().teams[0].memberIds).toEqual(['staff-1']);
    expect(mocks.setStaffTeamMembershipInDb).toHaveBeenCalledWith('staff-1', 'team-1', true);

    await expect(staffFeature.teams.removeMember('staff-1', 'team-1')).resolves.toBe(true);
    expect(mocks.getState().staff[0].teamIds).toEqual([]);
    expect(mocks.getState().teams[0].memberIds).toEqual([]);
    expect(mocks.setStaffTeamMembershipInDb).toHaveBeenLastCalledWith('staff-1', 'team-1', false);
  });

  it('repairs a one-sided local membership through the atomic operation', async () => {
    mocks.setState({
      ...mocks.getState(),
      teams: [team({ memberIds: ['staff-1'] })],
    });

    await expect(staffFeature.teams.assign('staff-1', 'team-1')).resolves.toBe(true);
    expect(mocks.getState().staff[0].teamIds).toEqual(['team-1']);
    expect(mocks.getState().teams[0].memberIds).toEqual(['staff-1']);
    expect(mocks.setStaffTeamMembershipInDb).toHaveBeenCalledWith('staff-1', 'team-1', true);
  });

  it('removes a team through the atomic persistence operation and clears every local assignment', async () => {
    await staffFeature.teams.assign('staff-1', 'team-1');
    await expect(staffFeature.teams.remove('team-1')).resolves.toBe(true);
    expect(mocks.deleteTeamAndStaffAssignmentsFromDb).toHaveBeenCalledWith('team-1');
    expect(mocks.getState().teams).toEqual([]);
    expect(mocks.getState().staff[0].teamIds).toEqual([]);
  });

  it('removes staff through the atomic persistence operation and clears every local membership', async () => {
    await staffFeature.teams.assign('staff-1', 'team-1');
    await expect(staffFeature.records.remove('staff-1')).resolves.toBe(true);
    expect(mocks.deleteStaffAndTeamMembershipsFromDb).toHaveBeenCalledWith('staff-1');
    expect(mocks.getState().staff).toEqual([]);
    expect(mocks.getState().teams[0].memberIds).toEqual([]);
  });

  it('awards experience by category, increases effective skill, and recalculates only primary-skill wage growth', async () => {
    const { calculateEffectiveSkill } = staffFeature.competency;

    expect(calculateEffectiveSkill(0.5, 0)).toBe(0.5);
    expect(calculateEffectiveSkill(0.5, 100000)).toBeGreaterThan(0.5);
    expect(calculateEffectiveSkill(0.5, 100000)).toBeLessThanOrEqual(1);

    const startingWage = staffFeature.wages.calculate(mocks.getState().staff[0].skills, mocks.getState().staff[0].specializedRoles);
    await staffFeature.competency.awardExperience('staff-1', 100000, ['skill:winery']);
    const primarySkillWage = mocks.getState().staff[0].wage;
    await staffFeature.competency.awardExperience('staff-1', 100000, ['grape:Pinot Noir']);

    expect(mocks.getState().staff[0].experience).toEqual({
      'skill:winery': 100000,
      'grape:Pinot Noir': 100000
    });
    expect(primarySkillWage).toBeGreaterThan(startingWage);
    expect(mocks.getState().staff[0].wage).toBe(primarySkillWage);
    expect(mocks.saveStaffToDb).toHaveBeenCalledWith(expect.objectContaining({
      id: 'staff-1',
      experience: {
        'skill:winery': 100000,
        'grape:Pinot Noir': 100000
      }
    }));
  });
});
