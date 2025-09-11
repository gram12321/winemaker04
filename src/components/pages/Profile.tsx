import { getGameState } from '@/lib/gameState';
import { formatGameDate } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface ProfileProps {
  view?: string;
}

export default function Profile({ view }: ProfileProps) {
  const gameState = getGameState();

  if (view && view !== 'profile') return null;

  const currentDate = {
    week: gameState.week || 1,
    season: gameState.season || 'Spring',
    year: gameState.currentYear || 2024
  };

  const yearsInBusiness = (gameState.currentYear || 2024) - (gameState.foundedYear || 2024);

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Winery Profile</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle>{gameState.companyName || 'My Winery'}</CardTitle>
            <CardDescription>Company information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Founded</p>
              <p className="text-lg">{gameState.foundedYear || 2024}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Years in Business</p>
              <p className="text-lg">{yearsInBusiness} {yearsInBusiness === 1 ? 'year' : 'years'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Current Date</p>
              <p className="text-lg">{formatGameDate(currentDate)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Financial & Reputation */}
        <Card>
          <CardHeader>
            <CardTitle>Financial & Reputation</CardTitle>
            <CardDescription>Company performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Available Funds</p>
              <p className="text-lg font-semibold text-green-600">€{(gameState.money || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Company Prestige</p>
              <p className="text-lg font-semibold text-blue-600">{(gameState.prestige || 0).toFixed(1)}</p>
              <p className="text-xs text-gray-400">Affects order generation frequency</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
