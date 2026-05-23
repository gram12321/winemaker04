import { useEffect, useState } from 'react';
import { FlaskConical, Leaf, ShieldCheck, Sparkles } from 'lucide-react';
import { ResearchPanel } from '@/components/finance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/shadCN/card';
import { useGameUpdates } from '@/hooks/useGameUpdates';
import { getResearchPermanentEffects, getResearchViewSummary, type ResearchPermanentEffectsSummary } from '@/lib/services';
import { Badge } from '@/components/ui';

const RESEARCH_HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?w=1400&h=500&fit=crop';

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

  const { hasEffects, healthDecayReductionPercent } = getResearchViewSummary(activeBonuses);

  return (
    <div className="space-y-6">
      <div
        className="relative h-32 overflow-hidden rounded-xl bg-cover bg-center"
        style={{
          backgroundImage: `url('${RESEARCH_HERO_IMAGE_URL}')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/85 via-emerald-900/55 to-emerald-900/25" />
        <div className="relative flex h-full flex-col justify-between p-4 text-white">
          <div>
            <h2 className="text-lg font-semibold">Research & Innovation</h2>
            <p className="text-xs text-white/85">Develop permanent improvements that shape vineyard resilience and long-term winery growth.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className="border-white/40 bg-white/15 text-white">{hasEffects ? `${activeBonuses.activeEffects.length} Active Effects` : 'No Active Effects'}</Badge>
            <Badge className="border-white/40 bg-white/15 text-white">Health Decay x{activeBonuses.vineyardHealthDecayMultiplier.toFixed(2)}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Effects</p>
                <p className="text-lg font-semibold text-slate-900">{activeBonuses.activeEffects.length}</p>
              </div>
              <div className="rounded-lg bg-violet-50 p-2 text-violet-700">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Health Decay Multiplier</p>
                <p className="text-lg font-semibold text-emerald-700">x{activeBonuses.vineyardHealthDecayMultiplier.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <Leaf className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Health Decay Reduction</p>
                <p className="text-lg font-semibold text-slate-900">{healthDecayReductionPercent.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-2 text-sky-700">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Research Track</p>
                <p className="text-lg font-semibold text-slate-900">Operational</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
                <FlaskConical className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                <Badge variant="outline">Reduction {healthDecayReductionPercent.toFixed(1)}%</Badge>
              </div>
              <div className="grid gap-2">
                {activeBonuses.activeEffects.map((effect) => (
                  <div key={`${effect.projectId}-${effect.kind}`} className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="font-semibold">{effect.projectTitle}</div>
                      <Badge variant="outline" className="border-emerald-300 text-emerald-800">Permanent</Badge>
                    </div>
                    <div className="text-xs text-emerald-900/90">{effect.description}</div>
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
