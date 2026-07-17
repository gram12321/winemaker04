import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_INITIALIZATION } from '@/lib/constants/constants';

const mocks = vi.hoisted(() => ({
  insertCompany: vi.fn(), getCompanyById: vi.fn(), getCompanyByName: vi.fn(), getUserCompanies: vi.fn(),
  getAllCompanies: vi.fn(), updateCompany: vi.fn(), deleteCompany: vi.fn(), getCompanyStats: vi.fn(), checkCompanyNameExists: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  insertCompany: mocks.insertCompany, getCompanyById: mocks.getCompanyById, getCompanyByName: mocks.getCompanyByName,
  getUserCompanies: mocks.getUserCompanies, getAllCompanies: mocks.getAllCompanies, updateCompany: mocks.updateCompany,
  deleteCompany: mocks.deleteCompany, getCompanyStats: mocks.getCompanyStats, checkCompanyNameExists: mocks.checkCompanyNameExists,
}));

import { companyFeature } from '@/lib/features/company';

const company = {
  id: 'company-1', name: 'Test Estate', userId: 'user-1', foundedYear: 2024, currentWeek: 1,
  currentSeason: 'Spring' as const, currentYear: 2024, money: 0, prestige: GAME_INITIALIZATION.STARTING_PRESTIGE,
  lastPlayed: new Date('2024-01-01'), createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01'),
};

describe('companyFeature.records', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCompanyNameExists.mockResolvedValue(false);
    mocks.insertCompany.mockResolvedValue({ success: true, data: { id: company.id } });
    mocks.getCompanyById.mockResolvedValue(company);
  });

  it('creates an explicitly owned company without inferring or creating a player', async () => {
    await expect(companyFeature.records.create({ name: company.name, ownerId: 'user-1' })).resolves.toEqual({ success: true, company });
    expect(mocks.insertCompany).toHaveBeenCalledWith(expect.objectContaining({ name: company.name, user_id: 'user-1' }));
    expect(mocks.getUserCompanies).not.toHaveBeenCalled();
  });

  it('creates and lists anonymous companies without an owner', async () => {
    await companyFeature.records.create({ name: 'Anonymous Estate' });
    expect(mocks.insertCompany).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }));

    mocks.getUserCompanies.mockResolvedValue([company]);
    await expect(companyFeature.records.listForOwner('user-1')).resolves.toEqual([company]);
  });

  it('rejects a duplicate name before persistence', async () => {
    mocks.checkCompanyNameExists.mockResolvedValue(true);
    await expect(companyFeature.records.create({ name: company.name })).resolves.toEqual({ success: false, error: 'Company name already exists' });
    expect(mocks.insertCompany).not.toHaveBeenCalled();
  });
});
