import { useState, useEffect, useMemo, useRef } from 'react';
import Header from './components/layout/Header';
import CompanyOverview from './components/pages/CompanyOverview';
import Vineyard from './components/pages/Vineyard';
import Winery from './components/pages/Winery';
import Sales from './components/pages/Sales';
import Finance from './components/pages/Finance';
import { ResearchPage } from './components/pages/Research';
import { StaffPage } from './components/pages/Staff';
import type { AdminFeature } from '@/lib/features/admin';
import { WineLog } from './components/pages/WineLog';
import Winepedia from './components/pages/Winepedia.tsx';
import { WeatherCenterPage } from './components/pages/WeatherCenter';
import { Login } from './components/pages/Login';
import { leaderboardsFeature } from '@/lib/features/leaderboards';
import Equipment from './components/pages/Equipment';
import { Toaster } from './components/ui/shadCN/toaster';
import { GlobalSearchResultsDisplay } from './components/layout/GlobalSearchResultsDisplay';
import { useCustomerRelationshipUpdates } from './hooks/useCustomerRelationshipUpdates';
import { usePrestigeUpdates } from './hooks/usePrestigeAndVineyardValueUpdates';
import type { CompanyRecord } from '@/lib/features/company';
import { setActiveCompany, resetGameState, getCurrentCompany, getCurrentPrestige } from './lib/services/core/gameState';
import { initializeCustomers, notificationService, preloadAllCustomerRelationships } from './lib/services';
import { activitiesFeature } from '@/lib/features/activities';
import { companyFeature, type CompanyCreateResult } from '@/lib/features/company';
import { loanLenderFeature } from '@/lib/features/loanLender';
import { achievementsFeature } from '@/lib/features/achievements';
import { userFeature } from '@/lib/features/user';
import { Analytics } from '@vercel/analytics/react';

interface AppProps {
  adminFeature: AdminFeature | null;
}

function App({ adminFeature }: AppProps) {
  const [currentPage, setCurrentPage] = useState('login');
  const [currentCompany, setCurrentCompany] = useState<CompanyRecord | null>(null);
  const [isGameInitialized, setIsGameInitialized] = useState(false);
  const [forcePlayerSelection, setForcePlayerSelection] = useState(false);
  const loanLenderAppOverlays = useMemo(() => loanLenderFeature.ui.getAppOverlays(), []);
  const playerPortfolio = useMemo(() => ({
    getCompaniesForPlayer: (playerId: string) => companyFeature.records.listForOwner(playerId),
    getStatsForPlayer: (playerId: string) => companyFeature.records.getStatsForOwner(playerId),
    getStatsForCompany: (company: CompanyRecord) => companyFeature.records.getStatsForCompany(company),
  }), []);
  const playerNotificationFilters = useMemo(() => ({
    getAll: () => notificationService.getFilters(),
    remove: (filterId: string) => notificationService.removeFilter(filterId),
    clear: () => notificationService.clearFilters(),
    setHistoryBlocked: (filterId: string, blocked: boolean) => {
      notificationService.updateFilter(filterId, { blockFromHistory: blocked });
    },
  }), []);
  
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

  useEffect(() => {
    let isActive = true;
    let unsubscribe: () => void = () => undefined;

    void userFeature.account.observeCurrentPlayer((player) => {
      if (!isActive) return;
      const activeCompany = getCurrentCompany();
      if (activeCompany?.userId && activeCompany.userId !== player?.id) {
        // Player identity is the authority for every owned company session,
        // including auth changes that happen outside the explicit Logout UI.
        resetGameState();
        setCurrentCompany(null);
        setCurrentPage('login');
        setIsGameInitialized(false);
        setForcePlayerSelection(true);
      }
    }).then((cleanup) => {
      if (isActive) unsubscribe = cleanup;
      else cleanup();
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const handleCompanySelected = async (company: CompanyRecord) => {
    try {
      const [player, persistedCompany] = await Promise.all([
        userFeature.account.getCurrentPlayer(),
        companyFeature.records.get(company.id),
      ]);
      if (!persistedCompany) {
        console.warn('Blocked attempt to activate a company that no longer exists');
        resetGameState();
        setCurrentCompany(null);
        setCurrentPage('login');
        setIsGameInitialized(false);
        return;
      }
      if (persistedCompany.ownerId && persistedCompany.ownerId !== player?.id) {
        console.warn('Blocked attempt to activate a company owned by another player');
        resetGameState();
        setCurrentCompany(null);
        setCurrentPage('login');
        setIsGameInitialized(false);
        return;
      }

      await setActiveCompany(persistedCompany);
      setCurrentCompany(persistedCompany);
      setCurrentPage('company-overview');
      setIsGameInitialized(true);
      setForcePlayerSelection(false);
      
      if (lastInitializedCompanyIdRef.current !== company.id) {
        lastInitializedCompanyIdRef.current = company.id;
        await initializeGameForCompany();
      }
    } catch (error) {
      console.error('Error setting active company:', error);
    }
  };

  const handleCompanyCreated = async (input: { name: string; ownerId?: string }): Promise<CompanyCreateResult> => {
    const player = await userFeature.account.getCurrentPlayer();
    if (input.ownerId !== player?.id) {
      return { success: false, error: 'A company can only be created for the selected player' };
    }

    const result = await companyFeature.records.create(input);
    if (!result.success || !result.company) return { success: false, error: result.error || 'Failed to create company' };

    try {
      await loanLenderFeature.setup.initializeLenders(result.company.id);
    } catch (error) {
      console.warn('Failed to initialize lenders for new company:', error);
    }
    // Starting conditions create company-scoped staff, loans, and vineyards.
    // Establish that session context before Login opens the setup modal.
    await setActiveCompany(result.company);
    return { success: true, company: result.company };
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
      await activitiesFeature.setup.initialize();
      
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

  const handleLogout = async () => {
    const result = await userFeature.account.endSession();
    if (!result.success) console.error('Unable to complete authenticated sign-out:', result.error);

    resetGameState();
    setCurrentCompany(null);
    setCurrentPage('login');
    setIsGameInitialized(false);
    setForcePlayerSelection(true);
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  const handleTimeAdvance = () => {
  };

  const renderCurrentPage = () => {
    if (!currentCompany && currentPage !== 'login' && currentPage !== 'highscores') {
      return <Login onCompanySelected={handleCompanySelected} onCompanyCreated={handleCompanyCreated} forcePlayerSelection={forcePlayerSelection} />;
    }

    switch (currentPage) {
      case 'login':
        return <Login onCompanySelected={handleCompanySelected} onCompanyCreated={handleCompanyCreated} forcePlayerSelection={forcePlayerSelection} />;
      case 'company-overview':
        return currentCompany ? (
          <CompanyOverview 
            onNavigate={handleNavigate}
          />
        ) : (
          <Login onCompanySelected={handleCompanySelected} onCompanyCreated={handleCompanyCreated} forcePlayerSelection={forcePlayerSelection} />
        );
      case 'dashboard':
        return <CompanyOverview onNavigate={setCurrentPage} />;
      case 'vineyard':
        return <Vineyard />;
      case 'winery':
        return <Winery />;
      case 'equipment':
        return <Equipment onNavigate={handleNavigate} />;
      case 'sales':
        return <Sales onNavigateToWinepedia={() => setCurrentPage('winepedia-customers')} />;
      case 'finance':
        return <Finance />;
      case 'research':
        return <ResearchPage />;
      case 'staff':
        return <StaffPage title="Staff Management" />;
      case 'profile':
        return userFeature.ui.renderProfilePage({
          currentCompany,
          portfolio: playerPortfolio,
          onCompanySelected: handleCompanySelected,
          onBackToLogin: handleBackToLogin,
        });
      case 'settings':
        return userFeature.ui.renderSettingsPage({
          currentCompany,
          notificationFilters: playerNotificationFilters,
          onBack: () => setCurrentPage('company-overview'),
          onSignOut: handleLogout,
        });
      case 'admin': {
        const adminPage = adminFeature?.renderPage({
          onBack: () => setCurrentPage('company-overview'),
          onNavigateToLogin: handleBackToLogin
        });
        if (!adminPage) {
          return currentCompany ? <CompanyOverview onNavigate={handleNavigate} /> : <Login onCompanySelected={handleCompanySelected} onCompanyCreated={handleCompanyCreated} forcePlayerSelection={forcePlayerSelection} />;
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
        return leaderboardsFeature.ui.renderPage({
          currentCompanyId: currentCompany?.id,
          onBack: () => setCurrentPage(currentCompany ? 'company-overview' : 'login'),
        });
      case 'winepedia':
        return <Winepedia />;
      case 'winepedia-customers':
        return <Winepedia view="customers" />;
      case 'weather-center':
        return <WeatherCenterPage />;
      default:
        return currentCompany ? <CompanyOverview onNavigate={handleNavigate} /> : <Login onCompanySelected={handleCompanySelected} onCompanyCreated={handleCompanyCreated} forcePlayerSelection={forcePlayerSelection} />;
    }
  };

  // Show login page if no company is selected
  if (!isGameInitialized && currentPage === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
        <Login onCompanySelected={handleCompanySelected} onCompanyCreated={handleCompanyCreated} forcePlayerSelection={forcePlayerSelection} />
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
        onLogout={handleLogout}
        adminAvailable={Boolean(adminFeature?.isAvailable())}
      />

      <main className="flex-1 px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6 mx-auto w-full max-w-7xl">
        {renderCurrentPage()}
      </main>

      {/* Activity Panel - only show when logged in */}
      {isGameInitialized && currentCompany && (
        activitiesFeature.ui.renderActivityPanel()
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
