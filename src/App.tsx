import { useState } from 'react';
import Header from './components/layout/Header';
import Dashboard from './components/pages/Dashboard';
import Vineyard from './components/pages/Vineyard';
import Winery from './components/pages/Winery';
import Sales from './components/pages/Sales';
import Finance from './components/pages/Finance';
import Profile from './components/pages/Profile';
import Settings from './components/pages/Settings';
import AdminDashboard from './components/pages/AdminDashboard';
import Achievements from './components/pages/Achievements';
import Winepedia from './components/pages/Winepedia';
import { Toaster } from './components/ui/toaster';
import { useGameInit } from './hooks/useGameInit';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { isLoading, error } = useGameInit();

  const handlePageChange = (page: string) => {
    setCurrentPage(page);
  };

  const handleTimeAdvance = () => {
    // Time changes are now handled by the reactive state system
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'vineyard':
        return <Vineyard />;
      case 'winery':
        return <Winery />;
      case 'sales':
        return <Sales />;
      case 'finance':
        return <Finance />;
      case 'profile':
        return <Profile />;
      case 'settings':
        return <Settings />;
      case 'admin':
        return <AdminDashboard />;
      case 'achievements':
        return <Achievements />;
      case 'winepedia':
        return <Winepedia />;
      default:
        return <Dashboard />;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <Header 
        currentPage={currentPage} 
        onPageChange={handlePageChange}
        onTimeAdvance={handleTimeAdvance}
      />
      
      <main className="container mx-auto px-4 py-8">
        {renderCurrentPage()}
      </main>
      
      <Toaster />
    </div>
  );
}

export default App;
