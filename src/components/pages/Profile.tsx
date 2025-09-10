import { getGameState } from '@/lib/gameState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface ProfileProps {
  view?: string;
}

export default function Profile({ view }: ProfileProps) {
  const gameState = getGameState();

  if (view && view !== 'profile') return null;

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Winery Profile</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>{(gameState as any).companyName || 'My Winery'}</CardTitle>
          <CardDescription>Company profile and information</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Profile feature coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
