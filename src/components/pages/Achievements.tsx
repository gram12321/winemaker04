import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface AchievementsProps {
  view?: string;
}

export default function Achievements({ view }: AchievementsProps) {
  if (view && view !== 'achievements') return null;

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Winery Achievements</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
          <CardDescription>Track your progress and accomplishments</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Achievements feature coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
