import CompanyOverview from '@/components/pages/CompanyOverview';
import Vineyard from '@/components/pages/Vineyard';
import Winery from '@/components/pages/Winery';
import Sales from '@/components/pages/Sales';
import Finance from '@/components/pages/Finance';
import { StaffPage } from '@/components/pages/Staff';
import { Profile } from '@/components/pages/Profile';
import { Settings } from '@/components/pages/Settings';
import { AdminDashboard } from '@/components/pages/AdminDashboard';
import { Achievements } from '@/components/pages/Achievements';
import { WineLog } from '@/components/pages/WineLog';
import Winepedia from '@/components/pages/Winepedia';
import { Login } from '@/components/pages/Login';
import { Highscores } from '@/components/pages/Highscores';
import type { AppPageId, Company } from '@/lib/services';
import type { ReactElement } from 'react';

export interface PageRenderContext {
  currentCompany: Company | null;
  onCompanySelected: (company: Company) => void;
  onBackToLogin: () => void;
  onNavigate: (page: string) => void;
}

type PageRenderer = (context: PageRenderContext) => ReactElement;

const pageRenderers: Record<AppPageId, PageRenderer> = {
  login: ({ onCompanySelected }) => <Login onCompanySelected={onCompanySelected} />,
  'company-overview': ({ currentCompany, onCompanySelected, onNavigate }) =>
    currentCompany ? (
      <CompanyOverview onNavigate={onNavigate} />
    ) : (
      <Login onCompanySelected={onCompanySelected} />
    ),
  dashboard: ({ onNavigate }) => <CompanyOverview onNavigate={onNavigate} />,
  vineyard: () => <Vineyard />,
  winery: () => <Winery />,
  sales: ({ onNavigate }) => (
    <Sales onNavigateToWinepedia={() => onNavigate('winepedia-customers')} />
  ),
  finance: () => <Finance />,
  staff: () => <StaffPage title="Staff Management" />,
  profile: ({ currentCompany, onCompanySelected, onBackToLogin }) => (
    <Profile
      currentCompany={currentCompany}
      onCompanySelected={onCompanySelected}
      onBackToLogin={onBackToLogin}
    />
  ),
  settings: ({ currentCompany, onBackToLogin, onNavigate }) => (
    <Settings
      currentCompany={currentCompany}
      onBack={() => onNavigate('company-overview')}
      onSignOut={onBackToLogin}
    />
  ),
  admin: ({ onBackToLogin, onNavigate }) => (
    <AdminDashboard
      onBack={() => onNavigate('company-overview')}
      onNavigateToLogin={onBackToLogin}
    />
  ),
  achievements: ({ currentCompany, onNavigate }) => (
    <Achievements
      currentCompany={currentCompany}
      onBack={() => onNavigate('company-overview')}
    />
  ),
  'wine-log': ({ currentCompany }) => <WineLog currentCompany={currentCompany} />,
  highscores: ({ currentCompany, onNavigate }) => (
    <Highscores
      currentCompanyId={currentCompany?.id}
      onBack={() => onNavigate(currentCompany ? 'company-overview' : 'login')}
    />
  ),
  winepedia: () => <Winepedia />,
  'winepedia-customers': () => <Winepedia view="customers" />
};

export function renderAppPage(
  pageId: AppPageId,
  context: PageRenderContext
): ReactElement {
  const renderer = pageRenderers[pageId];
  return renderer(context);
}

export function isPublicAppPage(pageId: AppPageId): boolean {
  return pageId === 'login' || pageId === 'highscores';
}
