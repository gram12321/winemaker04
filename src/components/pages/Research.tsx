import { useEffect, useState } from 'react';
import { ResearchPanel } from '@/components/finance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/shadCN/card';
import { useGameUpdates } from '@/hooks/useGameUpdates';
import { getResearchPermanentEffects, type ResearchPermanentEffectsSummary } from '@/lib/services';
import { Badge } from '@/components/ui';

export function ResearchPage() {
  const [activeBonuses, setActiveBonuses] = useState<ResearchPermanentEffectsSummary>({
    vineyardHealthDecayMultiplier: 1,
    activeEffects: []
  });

  const { subscribe } = useGameUpdates();

  useEffect(() => {
    const loadActiveBonuses = async () => {
      const effects = await getResearchPermanentEffects();
      setActiveBonuses(effects);
    };

    loadActiveBonuses();
    const unsubscribe = subscribe(() => {
      loadActiveBonuses();
    });

    return unsubscribe;
  }, [subscribe]);

  const hasEffects = activeBonuses.activeEffects.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Active Research Bonuses</CardTitle>
          <CardDescription>
            Permanent effects currently applied from completed research.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasEffects ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Vineyard health decay x{activeBonuses.vineyardHealthDecayMultiplier.toFixed(2)}</Badge>
              </div>
              <div className="space-y-2">
                {activeBonuses.activeEffects.map((effect) => (
                  <div key={`${effect.projectId}-${effect.kind}`} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <div className="font-semibold">{effect.projectTitle}</div>
                    <div>{effect.description}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-600">
              No permanent research bonuses are active yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Research</CardTitle>
          <CardDescription>
            Develop capabilities, unlock technologies, and scale your winery progression.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResearchPanel />
        </CardContent>
      </Card>
    </div>
  );
}
