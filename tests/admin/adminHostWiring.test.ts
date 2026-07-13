import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminFeature } from '@/lib/features/admin';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  getCurrentCompany: vi.fn(() => ({ id: 'company-1', name: 'Host Winery' })),
  initializeCustomers: vi.fn(async () => undefined),
  initializeActivitySystem: vi.fn(async () => undefined),
  preloadAllCustomerRelationships: vi.fn(async () => undefined),
  headerProps: [] as Array<{ adminAvailable: boolean }>
}));

vi.mock('@/components/layout/Header', () => ({
  default: ({ adminAvailable, onNavigate }: { adminAvailable: boolean; onNavigate: (page: string) => void }) => {
    mocks.headerProps.push({ adminAvailable });
    return createElement(
      'header',
      null,
      createElement('button', { onClick: () => onNavigate('admin') }, 'Force Admin Route'),
      adminAvailable && createElement('button', { onClick: () => onNavigate('admin') }, 'Admin Dashboard')
    );
  }
}));

vi.mock('@/components/pages/CompanyOverview', () => ({ default: () => createElement('div', null, 'Company Overview') }));
vi.mock('@/components/pages/Login', () => ({ Login: () => createElement('div', null, 'Login') }));
vi.mock('@/components/pages/Vineyard', () => ({ default: () => createElement('div', null, 'Vineyard') }));
vi.mock('@/components/pages/Winery', () => ({ default: () => createElement('div', null, 'Winery') }));
vi.mock('@/components/pages/Sales', () => ({ default: () => createElement('div', null, 'Sales') }));
vi.mock('@/components/pages/Finance', () => ({ default: () => createElement('div', null, 'Finance') }));
vi.mock('@/components/pages/Research', () => ({ ResearchPage: () => createElement('div', null, 'Research') }));
vi.mock('@/components/pages/Staff', () => ({ StaffPage: () => createElement('div', null, 'Staff') }));
vi.mock('@/components/pages/Profile', () => ({ Profile: () => createElement('div', null, 'Profile') }));
vi.mock('@/components/pages/Settings', () => ({ Settings: () => createElement('div', null, 'Settings') }));
vi.mock('@/components/pages/Achievements', () => ({ Achievements: () => createElement('div', null, 'Achievements') }));
vi.mock('@/components/pages/WineLog', () => ({ WineLog: () => createElement('div', null, 'Wine Log') }));
vi.mock('@/components/pages/Winepedia.tsx', () => ({ default: () => createElement('div', null, 'Winepedia') }));
vi.mock('@/components/pages/WeatherCenter', () => ({ WeatherCenterPage: () => createElement('div', null, 'Weather') }));
vi.mock('@/components/pages/Highscores', () => ({ Highscores: () => createElement('div', null, 'Highscores') }));
vi.mock('@/components/ui/shadCN/toaster', () => ({ Toaster: () => null }));
vi.mock('@/components/layout/ActivityPanel', () => ({ ActivityPanel: () => null }));
vi.mock('@/components/layout/GlobalSearchResultsDisplay', () => ({ GlobalSearchResultsDisplay: () => null }));
vi.mock('@/hooks/useCustomerRelationshipUpdates', () => ({ useCustomerRelationshipUpdates: () => undefined }));
vi.mock('@/hooks/usePrestigeAndVineyardValueUpdates', () => ({ usePrestigeUpdates: () => undefined }));
vi.mock('@/lib/services/core/gameState', () => ({
  getCurrentCompany: mocks.getCurrentCompany,
  getCurrentPrestige: vi.fn(async () => 0),
  resetGameState: vi.fn(),
  setActiveCompany: vi.fn(async () => undefined)
}));
vi.mock('@/lib/services', () => ({
  initializeCustomers: mocks.initializeCustomers,
  initializeActivitySystem: mocks.initializeActivitySystem,
  preloadAllCustomerRelationships: mocks.preloadAllCustomerRelationships
}));
vi.mock('@/lib/features/loanLender', () => ({ loanLenderFeature: { ui: { getAppOverlays: () => [] } } }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderApp(adminFeature: AdminFeature | null): Promise<void> {
  const App = (await import('@/App')).default;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(App, { adminFeature }));
  });
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  mocks.headerProps.length = 0;
});

describe('Admin host wiring', () => {
  it('shows Admin navigation and renders the supplied available feature', async () => {
    const renderPage = vi.fn(() => createElement('div', null, 'Admin Page'));
    await renderApp({ isAvailable: () => true, renderPage });

    expect(mocks.headerProps[mocks.headerProps.length - 1]).toEqual({ adminAvailable: true });
    expect(container?.textContent).toContain('Admin Dashboard');

    await act(async () => {
      container?.querySelector('button')?.click();
    });

    expect(renderPage).toHaveBeenCalledOnce();
    expect(container?.textContent).toContain('Admin Page');
  });

  it('hides Admin navigation and falls back to the normal page when Admin is absent', async () => {
    await renderApp(null);

    expect(mocks.headerProps[mocks.headerProps.length - 1]).toEqual({ adminAvailable: false });
    expect(container?.textContent).not.toContain('Admin Dashboard');

    await act(async () => {
      container?.querySelector('button')?.click();
    });

    expect(container?.textContent).toContain('Company Overview');
  });
});
