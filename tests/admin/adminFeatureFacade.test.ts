import { describe, expect, it, vi } from 'vitest';
import { createAdminFeature } from '@/lib/features/admin/createAdminFeature';

describe('Admin feature facade', () => {
  it('constructs a fork adapter with host dependencies behind the rendering seam', () => {
    const dashboard = {
      database: {} as never,
      cheats: {} as never,
      testLab: {} as never,
      renderResearchInspector: vi.fn()
    };
    const isAvailable = vi.fn(() => true);
    const feature = createAdminFeature({ isAvailable, dashboard });
    const props = { onBack: vi.fn(), onNavigateToLogin: vi.fn() };

    expect(feature.isAvailable()).toBe(true);
    const page = feature.renderPage(props);
    expect(page).not.toBeNull();
    expect(page?.props).toEqual(expect.objectContaining({ ...props, ...dashboard }));

    isAvailable.mockReturnValue(false);
    expect(feature.renderPage(props)).toBeNull();
  });

  it('assembles the Winemaker adapter with each internal collaborator group', async () => {
    const { createWinemakerAdminDashboardDependencies } = await import('@/lib/features/admin/feature');

    const dependencies = createWinemakerAdminDashboardDependencies();

    expect(Object.keys(dependencies).sort()).toEqual([
      'cheats',
      'database',
      'renderResearchInspector',
      'testLab'
    ]);
    expect(dependencies.database.clearAllCompanies).toEqual(expect.any(Function));
    expect(dependencies.cheats.setGoldToCompany).toEqual(expect.any(Function));
    expect(dependencies.testLab.loadDynamicOptions).toEqual(expect.any(Function));
    expect(dependencies.testLab.runScenario).toEqual(expect.any(Function));
    expect(dependencies.renderResearchInspector).toEqual(expect.any(Function));
  });

});
