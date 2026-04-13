import { useMemo } from 'react';
import {
  FLAVOR_FAMILY_IDS,
  WINE_TASTE_DESCRIPTOR_IDS,
  WineBatch
} from '@/lib/types/types';
import { computeWineTasteProfile } from '@/lib/services/wine/taste/wineTasteProfileService';
import { resolveWineAnchors } from '@/lib/services/wine/anchors/wineAnchorService';
import {
  FLAVOR_FAMILY_LABELS,
  METRIC_LABELS,
  TASTE_DESCRIPTOR_LABELS
} from '@/lib/constants/taste/flavorFamilyLabels';
import { formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../shadCN/card';
import { Progress } from '../shadCN/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '../shadCN/accordion';
import { Radar, Radio } from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import { WineTasteWheel } from './WineTasteWheel';

function mean(...xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function TasteBarRow({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] gap-2">
        <span className="text-muted-foreground truncate" title={label}>
          {label}
        </span>
        <span className="font-mono tabular-nums shrink-0 text-foreground">
          {formatNumber(value, { decimals: 2, forceDecimals: true })}
        </span>
      </div>
      <Progress value={pct} className="h-1.5 bg-muted" />
    </div>
  );
}

/**
 * Computed flavor wheel + descriptors + metrics for the wine modal Taste tab.
 */
export function WineTasteProfilePanel({ batch, className }: { batch: WineBatch; className?: string }) {
  const bundle = useMemo(() => computeWineTasteProfile(batch), [batch]);

  const topDescriptors = useMemo(() => {
    return [...WINE_TASTE_DESCRIPTOR_IDS]
      .map((id) => ({ id, v: bundle.descriptors[id] }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 5);
  }, [bundle.descriptors]);

  const profileSignals = useMemo(() => {
    const a = resolveWineAnchors(batch.wineAnchors);
    return [
      {
        label: 'Site & typicity',
        value: mean(a.regionalTypicity, a.soilAffinity, a.solarClimateFit, a.microclimateBlend)
      },
      {
        label: 'Juice & aromatic lift',
        value: mean(a.juiceAcidity, a.aromaticIntensity, a.residualSugar, a.textureRichness, a.alcoholPotential)
      },
      {
        label: 'Winemaking build',
        value: mean(
          a.crushingExtraction,
          a.fermentationProfile,
          a.skinContactEvolution,
          a.leesContact
        )
      },
      {
        label: 'Cellar & feature footprint',
        value: mean(a.cellarEvolution, a.oxidativeCharacter, a.featureFootprint)
      }
    ];
  }, [batch.wineAnchors]);

  const metrics = bundle.metrics;

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Radar className="h-4 w-4" /> Wine profile signals
          </CardTitle>
          <p className="text-[11px] text-muted-foreground font-normal leading-relaxed pt-1">
            These four bands summarize your batch profile (terroir, chemistry, crush/ferment, cellar). They feed the flavor
            model below together with structure channels and active features—not separate stored stats.
          </p>
        </CardHeader>
        <CardContent className="py-3 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {profileSignals.map((row) => (
            <TasteBarRow key={row.label} label={row.label} value={row.value} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-xs font-medium">Taste metrics (computed)</CardTitle>
        </CardHeader>
        <CardContent className="py-3 pt-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.keys(metrics) as (keyof typeof metrics)[]).map((key) => (
            <div key={key} className="rounded-md border bg-card/50 p-2">
              <div className="text-[10px] text-muted-foreground leading-tight mb-1">{METRIC_LABELS[key]}</div>
              <div className="text-sm font-semibold tabular-nums">
                {formatNumber(metrics[key], { decimals: 2, forceDecimals: true })}
              </div>
              <Progress value={Math.round(metrics[key] * 100)} className="h-1 mt-2 bg-muted" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Radio className="h-4 w-4" /> Taste wheel (14 families)
          </CardTitle>
          <p className="text-[11px] text-muted-foreground font-normal leading-relaxed pt-1">
            Radar uses the same normalized family values as the list below. Radius is relative strength (0 at center, 1 at
            ring).
          </p>
        </CardHeader>
        <CardContent className="py-2 pt-0">
          <WineTasteWheel profile={bundle.flavorFamilies} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-xs font-medium">Flavor families (0–1)</CardTitle>
            <p className="text-[11px] text-muted-foreground font-normal leading-relaxed pt-1">
              Wheel-aligned groups from Wine Folly research. Values blend structure, profile, grape color, and features.
            </p>
          </CardHeader>
          <CardContent className="py-3 pt-0 space-y-2 max-h-[28rem] overflow-y-auto scrollbar-styled pr-1">
            {FLAVOR_FAMILY_IDS.map((id) => (
              <TasteBarRow key={id} label={FLAVOR_FAMILY_LABELS[id]} value={bundle.flavorFamilies[id]} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-xs font-medium">Descriptor notes</CardTitle>
            <p className="text-[11px] text-muted-foreground font-normal leading-relaxed pt-1">
              Finer aromatic and flavor cues derived from the same model—useful for contracts and tasting copy later.
            </p>
          </CardHeader>
          <CardContent className="py-3 pt-0">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="desc" className="border-none">
                <AccordionTrigger className="text-xs py-2 hover:no-underline">
                  Show all {WINE_TASTE_DESCRIPTOR_IDS.length} notes
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-1 max-h-[24rem] overflow-y-auto scrollbar-styled">
                  {WINE_TASTE_DESCRIPTOR_IDS.map((id) => (
                    <TasteBarRow
                      key={id}
                      label={TASTE_DESCRIPTOR_LABELS[id]}
                      value={bundle.descriptors[id]}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <div className="mt-3 space-y-2 border-t pt-3">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Top notes preview (highest descriptors):
              </p>
              {topDescriptors.map(({ id, v }) => (
                <TasteBarRow key={id} label={TASTE_DESCRIPTOR_LABELS[id]} value={v} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed px-0.5">
        Flavor data is computed when you open this panel; it is not a second save of your batch. Changing structure,
        features, or cellar state updates these readouts on the next view.
      </p>
    </div>
  );
}
