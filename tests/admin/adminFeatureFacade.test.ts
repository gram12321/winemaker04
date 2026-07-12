import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { createAdminFeature } from '@/lib/features/admin/createAdminFeature';

describe('Admin feature facade', () => {
  it('uses the unavailable adapter until a host configures an implementation', async () => {
    vi.resetModules();
    const facade = await import('@/lib/features/admin');
    const { getAdminFeature } = facade;

    expect(Object.keys(facade).sort()).toEqual(['configureAdminFeature', 'getAdminFeature']);
    expect(getAdminFeature().isAvailable()).toBe(false);
    expect(getAdminFeature().renderPage({ onBack: vi.fn(), onNavigateToLogin: vi.fn() })).toBeNull();
  });

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
    const { createWinemakerAdminDashboardDependencies } = await import('@/lib/features/admin/active');

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

  it('exposes only availability and page rendering after configuration', async () => {
    vi.resetModules();
    const { configureAdminFeature, getAdminFeature } = await import('@/lib/features/admin');
    const page = { type: 'admin-page', props: {}, key: null } as unknown as ReactElement;
    const renderPage = vi.fn(() => page);

    configureAdminFeature({ isAvailable: () => true, renderPage });

    const feature = getAdminFeature();
    expect(feature.isAvailable()).toBe(true);
    expect(feature.renderPage({ onBack: vi.fn(), onNavigateToLogin: vi.fn() })).toBe(page);
    expect(renderPage).toHaveBeenCalledOnce();
  });
});
