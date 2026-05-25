import { useEffect, useState } from 'react';
import { Leaf, ShieldCheck, Sparkles } from 'lucide-react';
import { ResearchPanel } from '@/components/finance';
import { useGameUpdates } from '@/hooks/useGameUpdates';
import { getResearchPermanentEffects, getResearchViewSummary, type ResearchPermanentEffectsSummary } from '@/lib/services';
import { Badge, Tabs, TabsList, TabsTrigger } from '@/components/ui';

const RESEARCH_HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?w=1400&h=500&fit=crop';
type ResearchViewTab = 'active-effects' | 'footprint' | 'catalog';

export function ResearchPage() {
  const [activeTab, setActiveTab] = useState<ResearchViewTab>('catalog');
  const [activeBonuses, setActiveBonuses] = useState<ResearchPermanentEffectsSummary>({
    vineyardHealthDecayMultiplier: 1,
    researchSkillMultiplier: 1,
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

  const { hasEffects, healthDecayReductionPercent, researchSkillBoostPercent } = getResearchViewSummary(activeBonuses);

  return (
    <div className="flex flex-col gap-6">
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
            <Badge className="border-white/40 bg-white/15 text-white">Research Speed x{activeBonuses.researchSkillMultiplier.toFixed(2)}</Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ResearchViewTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active-effects">Active Research Effects</TabsTrigger>
            <TabsTrigger value="footprint">Research Footprint</TabsTrigger>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'active-effects' && (
          <div className="flex flex-col gap-3 rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4 text-muted-foreground" />
                  Active Research Effects
                </div>
                <p className="text-xs text-muted-foreground">Permanent effects currently applied from completed research.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{activeBonuses.activeEffects.length} active</Badge>
                <Badge variant="outline">
                  <Leaf className="mr-1 size-3" />
                  Health decay x{activeBonuses.vineyardHealthDecayMultiplier.toFixed(2)}
                </Badge>
                <Badge variant="outline">
                  <ShieldCheck className="mr-1 size-3" />
                  Reduction {healthDecayReductionPercent.toFixed(1)}%
                </Badge>
                <Badge variant="outline">
                  <Sparkles className="mr-1 size-3" />
                  Research speed +{researchSkillBoostPercent.toFixed(1)}%
                </Badge>
              </div>
            </div>

            {hasEffects ? (
              <div className="grid gap-2 md:grid-cols-2">
                {activeBonuses.activeEffects.map((effect) => (
                  <div key={`${effect.projectId}-${effect.kind}`} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-foreground">{effect.projectTitle}</div>
                      <Badge variant="outline">Permanent</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{effect.description}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                No permanent research bonuses are active yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'footprint' && <ResearchPanel view="footprint" />}

        {activeTab === 'catalog' && (
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Research Catalog</h3>
              <p className="text-sm text-muted-foreground">Develop capabilities, unlock technologies, and scale your winery progression.</p>
            </div>
            <ResearchPanel view="catalog" />
          </div>
        )}
      </div>
    </div>
  );
}
