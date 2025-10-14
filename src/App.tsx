import { useState, useEffect, useRef } from 'react';
import Header from './components/layout/Header';
import CompanyOverview from './components/pages/CompanyOverview';
import Vineyard from './components/pages/Vineyard';
import Winery from './components/pages/Winery';
import Sales from './components/pages/Sales';
import Finance from './components/pages/Finance';
import { StaffPage } from './components/pages/Staff';
import { Profile } from './components/pages/Profile';
import { Settings } from './components/pages/Settings';
import { AdminDashboard } from './components/pages/AdminDashboard';
import { Achievements } from './components/pages/Achievements';
import { WineLog } from './components/pages/WineLog';
import Winepedia from './components/pages/Winepedia';
import { Login } from './components/pages/Login';
import { Highscores } from './components/pages/Highscores';
import { Toaster } from './components/ui/shadCN/toaster';
import { ActivityPanel } from './components/layout/ActivityPanel';
import { useCustomerRelationshipUpdates } from './hooks/useCustomerRelationshipUpdates';
import { usePrestigeUpdates } from './hooks/usePrestigeUpdates';
import { Company } from '@/lib/database';
import { setActiveCompany, resetGameState, getCurrentCompany, getCurrentPrestige } from './lib/services/core/gameState';
import { initializeCustomers, initializeActivitySystem } from './lib/services';

function App() {
  const [currentPage, setCurrentPage] = useState('login');
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
      
      // Initialize activity system
      await initializeActivitySystem();
      
      console.log('Game systems initialized for company');
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
      case 'admin':
        return (
          <AdminDashboard 
            onBack={() => setCurrentPage('company-overview')}
            onNavigateToLogin={handleBackToLogin}
          />
        );
      case 'achievements':
        return (
          <Achievements
            currentCompany={currentCompany}
            onBack={() => setCurrentPage('company-overview')}
          />
        );
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
      />
      
      <main className="flex-1 px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6 mx-auto w-full max-w-7xl">
        {renderCurrentPage()}
      </main>
      
      {/* Activity Panel - only show when logged in */}
      {isGameInitialized && currentCompany && (
        <ActivityPanel />
      )}
      
      <Toaster />
    </div>
  );
}

export default App;
