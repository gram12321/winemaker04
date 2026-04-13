import { useMemo } from 'react';
import { WineBatch } from '@/lib/types/types';
import { resolveWineAnchors } from '@/lib/services/wine/anchors/wineAnchorService';
import { Card, CardContent, CardHeader, CardTitle } from '../shadCN/card';
import { Info } from 'lucide-react';

export type WineAnchorInfluenceContext = 'structure' | 'features' | 'taste' | 'origins';

function mean(...values: number[]): number {
  if (values.length === 0) return 0.5;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function strengthPhrase(v: number): string {
  if (v < 0.38) return 'relatively quiet';
  if (v > 0.62) return 'pronounced';
  return 'moderate';
}

/**
 * Explains **where** the batch wine profile (anchors) shapes gameplay outcomes, without showing raw anchor numbers.
 */
export function WineAnchorInfluenceCallout({
  wineBatch,
  context,
  className = ''
}: {
  wineBatch: WineBatch;
  context: WineAnchorInfluenceContext;
  className?: string;
}) {
  const { title, bullets } = useMemo(() => {
    const a = resolveWineAnchors(wineBatch.wineAnchors);
    const terroirSignal = mean(a.regionalTypicity, a.soilAffinity, a.solarClimateFit);
    const juiceSignal = mean(a.juiceAcidity, a.aromaticIntensity, a.textureRichness, a.residualSugar);
    const processSignal = mean(
      a.crushingExtraction,
      a.fermentationProfile,
      a.skinContactEvolution,
      a.leesContact
    );
    const cellarSignal = mean(a.oxidativeCharacter, a.cellarEvolution, a.featureFootprint);
    const terroirPhrase = strengthPhrase(terroirSignal);
    const juicePhrase = strengthPhrase(juiceSignal);
    const processPhrase = strengthPhrase(processSignal);
    const cellarPhrase = strengthPhrase(cellarSignal);

    switch (context) {
      case 'structure':
        return {
          title: 'Wine profile and structure',
          bullets: [
            'Vineyard, ripeness, and grape chemistry set how strongly harvest effects could move acidity, aroma, body, sweetness, tannins, and spice.',
            'Crushing and fermentation updated the profile as the must evolved; later steps scale how much those processes nudge each structure channel.',
            'The structure index uses ideal ranges that are gently shifted by this profile, so “balance” is judged in context of this wine—not a fixed generic template.',
            `Right now, site/terroir signal in the profile is ${terroirPhrase}; juice and aroma/body signal is ${juicePhrase}.`,
            'The Taste tab lists the same computed flavor families and notes that read off this profile plus your structure channels and features.'
          ]
        };
      case 'features':
        return {
          title: 'Wine profile and features',
          bullets: [
            'When a feature pushes a structure channel up or down, the strength of that push is shaped by this wine’s profile.',
            'Upside (positive shifts) tends to land harder when the profile already supports that dimension; downside is slightly softened when the site and vineyard read healthy and typical.',
            'Oxidation, bottle age, and other cellar features also refresh the profile over time, which feeds back into how strong the next effects feel.',
            `Cellar and feature footprint in the profile is ${cellarPhrase}; winemaking process signal is ${processPhrase}.`,
            'Active and evolving features feed directly into the fault, microbial, aging, and fruit-concentration slices on the Taste tab’s flavor model.'
          ]
        };
      case 'taste':
        return {
          title: 'Wine profile and taste',
          bullets: [
            'Taste index is your market-facing quality read—it moves with land value, events, and especially active features.',
            'The profile does not replace taste index; it steers how strongly harvest, winery steps, and features move the structure channels that sit alongside taste in your overall wine score.',
            'Below: flavor families (wine wheel), finer descriptor notes, and summary metrics—each 0–1—blended from structure, wine profile, grape color, and present features.',
            'Use the Structure tab for rule-based balance; this tab is the player-facing flavor readout built from the same live batch state.',
            `Juice and aromatic/body signal in the profile is ${juicePhrase}; terroir fit is ${terroirPhrase}.`
          ]
        };
      case 'origins':
        return {
          title: 'Wine profile and these origins',
          bullets: [
            'The grid below lists modifiers by source (harvest, crushing, features, etc.). Behind those numbers, the batch profile set how strongly each harvest and process step could apply.',
            'Terroir, vine state, and chemistry are captured in the profile at harvest; crush and fermentation extend it as you work the must.',
            'As features and aging progress, the profile updates so new effects stay physically plausible for this wine.',
            `Site and variety signal: ${terroirPhrase}. Winemaking stage signal: ${processPhrase}.`
          ]
        };
      default:
        return { title: '', bullets: [] };
    }
  }, [wineBatch.wineAnchors, context]);

  return (
    <Card className={`border-amber-200/80 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20 ${className}`}>
      <CardHeader className="py-3 pb-2">
        <CardTitle className="text-xs font-medium flex items-center gap-2 text-amber-950 dark:text-amber-100">
          <Info className="h-4 w-4 shrink-0" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 pt-0 text-xs text-amber-950/90 dark:text-amber-50/90 space-y-2 leading-relaxed">
        {bullets.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </CardContent>
    </Card>
  );
}
