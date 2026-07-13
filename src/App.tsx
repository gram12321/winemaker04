import { useState, useEffect, useMemo, useRef } from 'react';
import Header from './components/layout/Header';
import CompanyOverview from './components/pages/CompanyOverview';
import Vineyard from './components/pages/Vineyard';
import Winery from './components/pages/Winery';
import Sales from './components/pages/Sales';
import Finance from './components/pages/Finance';
import { ResearchPage } from './components/pages/Research';
import { StaffPage } from './components/pages/Staff';
import { Profile } from './components/pages/Profile';
import { Settings } from './components/pages/Settings';
import type { AdminFeature } from '@/lib/features/admin';
import { WineLog } from './components/pages/WineLog';
import Winepedia from './components/pages/Winepedia.tsx';
import { WeatherCenterPage } from './components/pages/WeatherCenter';
import { Login } from './components/pages/Login';
import { Highscores } from './components/pages/Highscores';
import { Toaster } from './components/ui/shadCN/toaster';
import { ActivityPanel } from './components/layout/ActivityPanel';
import { GlobalSearchResultsDisplay } from './components/layout/GlobalSearchResultsDisplay';
import { useCustomerRelationshipUpdates } from './hooks/useCustomerRelationshipUpdates';
import { usePrestigeUpdates } from './hooks/usePrestigeAndVineyardValueUpdates';
import { Company } from '@/lib/database';
import { setActiveCompany, resetGameState, getCurrentCompany, getCurrentPrestige } from './lib/services/core/gameState';
import { initializeCustomers, initializeActivitySystem, preloadAllCustomerRelationships } from './lib/services';
import { loanLenderFeature } from '@/lib/features/loanLender';
import { achievementsFeature } from '@/lib/features/achievements';
import { Analytics } from '@vercel/analytics/react';

interface AppProps {
  adminFeature: AdminFeature | null;
}

function App({ adminFeature }: AppProps) {
  const [currentPage, setCurrentPage] = useState('login');
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [isGameInitialized, setIsGameInitialized] = useState(false);
  const loanLenderAppOverlays = useMemo(() => loanLenderFeature.ui.getAppOverlays(), []);
  
  const lastInitializedCompanyIdRef = useRef<string | null>(null);
  useCustomerRelationshipUpdates();
  usePrestigeUpdates();
  useEffect(() => {
    const existingCompany = getCurrentCompany();
    if (existingCompany) {
      setCurrentCompany(existingCompany);
      setCurrentPage('company-overview');
      setIsGameInitialized(true);
      
      if (lastInitializedCompanyIdRef.current !== existingCompany.id) {
        lastInitializedCompanyIdRef.current = existingCompany.id;
        initializeGameForCompany();
      }
      return;
    }

    setCurrentPage('login');
  }, []);

  const handleCompanySelected = async (company: Company) => {
    try {
      await setActiveCompany(company);
      setCurrentCompany(company);
      setCurrentPage('company-overview');
      setIsGameInitialized(true);
      
      if (lastInitializedCompanyIdRef.current !== company.id) {
        lastInitializedCompanyIdRef.current = company.id;
        await initializeGameForCompany();
      }
    } catch (error) {
      console.error('Error setting active company:', error);
    }
  };

  const initializeGameForCompany = async () => {
    try {
      // Ensure customers are initialized when a company becomes active
      const currentPrestige = await getCurrentPrestige();
      await initializeCustomers(currentPrestige);
      
      // Pre-load all customer relationships in the background (non-blocking)
      // This makes "Show All Customers" load instantly
      preloadAllCustomerRelationships().catch(error => {
        console.error('Error preloading customer relationships:', error);
      });
      
      // Initialize activity system
      await initializeActivitySystem();
      
    } catch (error) {
      console.error('Error initializing game for company:', error);

    } finally {

    }
  };

  const handleBackToLogin = () => {
    resetGameState();
    setCurrentCompany(null);
    setCurrentPage('login');
    setIsGameInitialized(false);
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  const handleTimeAdvance = () => {
  };

  const renderCurrentPage = () => {
    if (!currentCompany && currentPage !== 'login' && currentPage !== 'highscores') {
      return <Login onCompanySelected={handleCompanySelected} />;
    }

    switch (currentPage) {
      case 'login':
        return <Login onCompanySelected={handleCompanySelected} />;
      case 'company-overview':
        return currentCompany ? (
          <CompanyOverview 
            onNavigate={handleNavigate}
          />
        ) : (
          <Login onCompanySelected={handleCompanySelected} />
        );
      case 'dashboard':
        return <CompanyOverview onNavigate={setCurrentPage} />;
      case 'vineyard':
        return <Vineyard />;
      case 'winery':
        return <Winery />;
      case 'sales':
        return <Sales onNavigateToWinepedia={() => setCurrentPage('winepedia-customers')} />;
      case 'finance':
        return <Finance />;
      case 'research':
        return <ResearchPage />;
      case 'staff':
        return <StaffPage title="Staff Management" />;
      case 'profile':
        return (
          <Profile 
            currentCompany={currentCompany}
            onCompanySelected={handleCompanySelected}
            onBackToLogin={handleBackToLogin}
          />
        );
      case 'settings':
        return (
          <Settings 
            currentCompany={currentCompany}
            onBack={() => setCurrentPage('company-overview')}
            onSignOut={handleBackToLogin}
          />
        );
      case 'admin': {
        const adminPage = adminFeature?.renderPage({
          onBack: () => setCurrentPage('company-overview'),
          onNavigateToLogin: handleBackToLogin
        });
        if (!adminPage) {
          return currentCompany ? <CompanyOverview onNavigate={handleNavigate} /> : <Login onCompanySelected={handleCompanySelected} />;
        }
        return adminPage;
      }
      case 'achievements':
        return achievementsFeature.ui.renderAchievementsPage({
          currentCompany,
          onBack: () => setCurrentPage('company-overview')
        });
      case 'wine-log':
        return (
          <WineLog
            currentCompany={currentCompany}
          />
        );
      case 'highscores':
        return (
          <Highscores 
            currentCompanyId={currentCompany?.id}
            onBack={() => setCurrentPage(currentCompany ? 'company-overview' : 'login')}
          />
        );
      case 'winepedia':
        return <Winepedia />;
      case 'winepedia-customers':
        return <Winepedia view="customers" />;
      case 'weather-center':
        return <WeatherCenterPage />;
      default:
        return currentCompany ? <CompanyOverview onNavigate={handleNavigate} /> : <Login onCompanySelected={handleCompanySelected} />;
    }
  };

  // Show login page if no company is selected
  if (!isGameInitialized && currentPage === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
        <Login onCompanySelected={handleCompanySelected} />
        <Toaster />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onTimeAdvance={handleTimeAdvance}
        onBackToLogin={handleBackToLogin}
        adminAvailable={Boolean(adminFeature?.isAvailable())}
      />

      <main className="flex-1 px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6 mx-auto w-full max-w-7xl">
        {renderCurrentPage()}
      </main>

      {/* Activity Panel - only show when logged in */}
      {isGameInitialized && currentCompany && (
        <ActivityPanel />
      )}

      {isGameInitialized && currentCompany && loanLenderAppOverlays.map((overlay) => (
        <div key={overlay.id}>{overlay.render()}</div>
      ))}

      {/* Global Search Results Modals - displays search results regardless of current page */}
      {isGameInitialized && currentCompany && (
        <GlobalSearchResultsDisplay />
      )}

      <Toaster />

      {/* Vercel Analytics */}
      <Analytics />
    </div>
  );
}

export default App;
