import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_INITIALIZATION } from '@/lib/constants/constants';

const mocks = vi.hoisted(() => ({
  insertCompany: vi.fn(),
  insertUser: vi.fn(),
  getCompanyById: vi.fn(),
  getCompanyByName: vi.fn(),
  getUserCompanies: vi.fn(),
  getAllCompanies: vi.fn(),
  updateCompany: vi.fn(),
  deleteCompany: vi.fn(),
  getCompanyStats: vi.fn(),
  checkCompanyNameExists: vi.fn(),
  initializeLenders: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  insertCompany: mocks.insertCompany,
  insertUser: mocks.insertUser,
  getCompanyById: mocks.getCompanyById,
  getCompanyByName: mocks.getCompanyByName,
  getUserCompanies: mocks.getUserCompanies,
  getAllCompanies: mocks.getAllCompanies,
  updateCompany: mocks.updateCompany,
  deleteCompany: mocks.deleteCompany,
  getCompanyStats: mocks.getCompanyStats,
  checkCompanyNameExists: mocks.checkCompanyNameExists,
}));

vi.mock('@/lib/features/loanLender', () => ({
  loanLenderFeature: {
    setup: {
      initializeLenders: mocks.initializeLenders,
    },
  },
}));

vi.mock('@/lib/services/user/authService', () => ({
  authService: {
    getCurrentUser: mocks.getCurrentUser,
  },
}));

import { companyService } from '@/lib/services/user/companyService';

const persistedCompany = {
  id: 'company-1',
  name: 'Test Estate',
  userId: 'user-1',
  foundedYear: 2024,
  currentWeek: 1,
  currentSeason: 'Spring',
  currentYear: 2024,
  money: 0,
  prestige: GAME_INITIALIZATION.STARTING_PRESTIGE,
  lastPlayed: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('companyService.createCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCompanyNameExists.mockResolvedValue(false);
    mocks.insertUser.mockResolvedValue({ success: true, data: { id: 'user-1' } });
    mocks.insertCompany.mockResolvedValue({ success: true, data: { id: 'company-1' } });
    mocks.getCompanyById.mockResolvedValue(persistedCompany);
    mocks.initializeLenders.mockResolvedValue(undefined);
    mocks.getCurrentUser.mockReturnValue(null);
  });

  it('creates a user, persists the company, and initializes lenders', async () => {
    const result = await companyService.createCompany({
      name: 'Test Estate',
      associateWithUser: true,
      userName: 'Test User',
    });

    expect(result).toEqual({ success: true, company: persistedCompany });
    expect(mocks.checkCompanyNameExists).toHaveBeenCalledWith('Test Estate');
    expect(mocks.insertUser).toHaveBeenCalledWith({
      name: 'Test User',
      created_at: expect.any(String),
    });
    expect(mocks.insertCompany).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Test Estate',
      user_id: 'user-1',
      founded_year: 2024,
      current_week: 1,
      current_season: 'Spring',
      current_year: 2024,
      money: 0,
      prestige: GAME_INITIALIZATION.STARTING_PRESTIGE,
    }));
    expect(mocks.initializeLenders).toHaveBeenCalledWith('company-1');
  });

  it('creates an unassociated company without inserting a user', async () => {
    const result = await companyService.createCompany({
      name: 'Solo Estate',
      associateWithUser: false,
    });

    expect(result.success).toBe(true);
    expect(mocks.insertUser).not.toHaveBeenCalled();
    expect(mocks.insertCompany).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Solo Estate',
      user_id: null,
    }));
  });

  it('rejects duplicate names before creating a user or company', async () => {
    mocks.checkCompanyNameExists.mockResolvedValue(true);
    await expect(companyService.createCompany({
      name: 'Existing Estate',
      associateWithUser: true,
      userName: 'Should Not Be Created',
    })).resolves.toEqual({
      success: false,
      error: 'Company name already exists',
    });

    expect(mocks.insertUser).not.toHaveBeenCalled();
    expect(mocks.insertCompany).not.toHaveBeenCalled();
  });

  it('returns persistence failures without claiming success', async () => {
    mocks.insertCompany.mockResolvedValue({ success: false, error: 'database unavailable' });
    await expect(companyService.createCompany({ name: 'Unavailable Estate' })).resolves.toEqual({
      success: false,
      error: 'database unavailable',
    });
    expect(mocks.initializeLenders).not.toHaveBeenCalled();
  });
});
