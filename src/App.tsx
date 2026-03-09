import { useState, useEffect, useRef } from 'react';
import Header from './components/layout/Header';
import { Toaster } from './components/ui/shadCN/toaster';
import { ActivityPanel } from './components/layout/ActivityPanel';
import { LoanWarningModalDisplay } from './components/layout/LoanWarningModalDisplay';
import { GlobalSearchResultsDisplay } from './components/layout/GlobalSearchResultsDisplay';
import { useCustomerRelationshipUpdates } from './hooks/useCustomerRelationshipUpdates';
import { usePrestigeUpdates } from './hooks/usePrestigeAndVineyardValueUpdates';
import {
  type AppPageId,
  type Company,
  setActiveCompany,
  resetGameState,
  getCurrentCompany,
  getCurrentPrestige,
  runFeatureStartupHooks,
  registerAppFeatureEventListeners
} from './lib/services';
import { Analytics } from '@vercel/analytics/react';
import { renderAppPage, isPublicAppPage } from './app/pageRegistry';

function App() {
  const [currentPage, setCurrentPage] = useState<AppPageId>('login');
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [isGameInitialized, setIsGameInitialized] = useState(false);
  
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
        void initializeGameForCompany(existingCompany.id);
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
        await initializeGameForCompany(company.id);
      }
    } catch (error) {
      console.error('Error setting active company:', error);
    }
  };

  const initializeGameForCompany = async (companyId: string) => {
    try {
      const currentPrestige = await getCurrentPrestige();

      await runFeatureStartupHooks({
        companyId,
        currentPrestige
      });
    } catch (error) {
      console.error('Error initializing game for company:', error);
    }
  };

  const handleBackToLogin = () => {
    resetGameState();
    setCurrentCompany(null);
    setCurrentPage('login');
    setIsGameInitialized(false);
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page as AppPageId);
  };

  const handleTimeAdvance = () => {
  };

  useEffect(() => {
    const unregister = registerAppFeatureEventListeners({
      navigateToWinepedia: () => setCurrentPage('winepedia')
    });

    return () => {
      unregister?.();
    };
  }, []);

  const renderCurrentPage = () => {
    if (!currentCompany && !isPublicAppPage(currentPage)) {
      return renderAppPage('login', {
        currentCompany,
        onCompanySelected: handleCompanySelected,
        onBackToLogin: handleBackToLogin,
        onNavigate: handleNavigate
      });
    }

    return renderAppPage(currentPage, {
      currentCompany,
      onCompanySelected: handleCompanySelected,
      onBackToLogin: handleBackToLogin,
      onNavigate: handleNavigate
    });
  };

  // Show login page if no company is selected
  if (!isGameInitialized && currentPage === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
        {renderAppPage('login', {
          currentCompany,
          onCompanySelected: handleCompanySelected,
          onBackToLogin: handleBackToLogin,
          onNavigate: handleNavigate
        })}
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
      />

      <main className="flex-1 px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6 mx-auto w-full max-w-7xl">
        {renderCurrentPage()}
      </main>

      {/* Activity Panel - only show when logged in */}
      {isGameInitialized && currentCompany && (
        <ActivityPanel />
      )}

      {/* Loan Warning Modal - displays critical loan warnings */}
      {isGameInitialized && currentCompany && (
        <LoanWarningModalDisplay />
      )}

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
