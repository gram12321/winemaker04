import { getGameState, updateGameState } from '@/lib/gameState';
import { formatGameDate } from '@/lib/types';
import { formatMoney } from '@/lib/formatUtils';

const Dashboard: React.FC = () => {
  const gameState = getGameState();
  
  const gameDate = {
    week: gameState.week,
    season: gameState.season,
    year: gameState.currentYear
  };

  const handleAddMoney = () => {
    updateGameState({ money: gameState.money + 1000000 });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome to the Game!</h2>
        <p className="text-gray-600">Start playing now.</p>
        
        <div className="mt-6 flex space-x-4">
          <button 
            onClick={handleAddMoney}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold"
          >
            Add €1,000,000 €
          </button>
        </div>
      </div>

      {/* Game Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Time</h3>
          <p className="text-2xl font-bold text-amber-600">{formatGameDate(gameDate)}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Treasury</h3>
          <p className="text-2xl font-bold text-green-600">{formatMoney(gameState.money)}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Prestige</h3>
          <p className="text-2xl font-bold text-purple-600">{gameState.prestige.toFixed(1)}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
