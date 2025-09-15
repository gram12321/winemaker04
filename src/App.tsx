import { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import CompanyOverview from './components/pages/CompanyOverview';
import Vineyard from './components/pages/Vineyard';
import Winery from './components/pages/Winery';
import Sales from './components/pages/Sales';
import Finance from './components/pages/Finance';
import { Profile } from './components/pages/Profile';
import { Settings } from './components/pages/Settings';
import { AdminDashboard } from './components/pages/AdminDashboard';
import { Achievements } from './components/pages/Achievements';
import Winepedia from './components/pages/Winepedia';
import { Login } from './components/pages/Login';
import { Highscores } from './components/pages/Highscores';
import { Toaster } from './components/ui/toaster';
import { useGameInit } from './hooks/useGameInit';
import { usePrestigeUpdates } from './hooks/usePrestigeUpdates';
import { Company } from './lib/services/user/companyService';
import { setActiveCompany, resetGameState, getCurrentCompany } from './lib/services/gameState';

function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [isGameInitialized, setIsGameInitialized] = useState(false);
  const { isLoading, error } = useGameInit();
  
  // Monitor prestige changes and update customer relationships
  usePrestigeUpdates();

  useEffect(() => {
    // Check for existing company on app start
    const existingCompany = getCurrentCompany();
    if (existingCompany) {
      setCurrentCompany(existingCompany);
      setCurrentPage('company-overview');
      setIsGameInitialized(true);
      
      // Initialize game systems for the existing company
      initializeGameForCompany();
    }
  }, []);

  const handleCompanySelected = async (company: Company) => {
    try {
      await setActiveCompany(company);
      setCurrentCompany(company);
      setCurrentPage('company-overview');
      setIsGameInitialized(true);
      
      // Initialize game systems for the selected company
      await initializeGameForCompany();
    } catch (error) {
      console.error('Error setting active company:', error);
    }
  };

  const initializeGameForCompany = async () => {
    try {
      // Initialize customers system for the active company
      const { getCurrentPrestige } = await import('@/lib/services/gameState');
      const { initializeCustomers } = await import('@/lib/services/sales/createCustomer');
      
      const currentPrestige = await getCurrentPrestige();
      await initializeCustomers(currentPrestige);
    } catch (error) {
      console.error('Error initializing game for company:', error);
      // Don't throw - allow game to continue even if customer initialization fails
    }
  };

  const handleBackToLogin = () => {
    resetGameState();
    setCurrentCompany(null);
    setCurrentPage('login');
    setIsGameInitialized(false);
  };

  const handlePageChange = (page: string) => {
    setCurrentPage(page);
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  const handleTimeAdvance = () => {
    // Time changes are now handled by the reactive state system
  };

  const renderCurrentPage = () => {
    // If no company is selected, show login
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

  // Show loading screen while initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-amber-800 mb-4">🍷 Loading Winery...</h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-800 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show error if initialization failed
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Game</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
        onPageChange={handlePageChange}
        onTimeAdvance={handleTimeAdvance}
        onBackToLogin={handleBackToLogin}
      />
      
      <main className="container mx-auto px-4 py-8">
        {renderCurrentPage()}
      </main>
      
      <Toaster />
    </div>
  );
}

export default App;
