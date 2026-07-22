import { SimpleCard } from '@/components/ui';
import { FLAVOR_FAMILY_LABELS } from '@/lib/constants/taste/flavorFamilyLabels';
import type { FlavorFamilyId } from '@/lib/types/types';

type TasteEffectDirection = 'up' | 'down';

interface TasteEffect {
  family: FlavorFamilyId;
  direction: TasteEffectDirection;
}

interface AnchorReference {
  name: string;
  summary: string;
  influencedBy: string;
  effects: TasteEffect[];
}

const ANCHOR_REFERENCE: readonly AnchorReference[] = [
  {
    name: 'Sugar Potential',
    summary: "The batch's capacity for ripe sweetness and concentration.",
    influencedBy: 'Harvest baseline: grape sweetness, ripeness, aspect sun exposure, and altitude.',
    effects: [
      { family: 'tropicalFruit', direction: 'up' },
      { family: 'driedFruit', direction: 'up' },
      { family: 'citrus', direction: 'down' }
    ]
  },
  {
    name: 'Acid Potential',
    summary: "The batch's capacity to retain freshness and acidity.",
    influencedBy: 'Harvest baseline: grape acidity, earlier ripeness, altitude, and vineyard sun fit.',
    effects: [
      { family: 'citrus', direction: 'up' },
      { family: 'vegetable', direction: 'down' }
    ]
  },
  {
    name: 'Phenolic Potential',
    summary: 'The capacity for tannin, colour, and skin-derived intensity.',
    influencedBy: 'Harvest baseline: grape colour and tannins, ripeness, row density, and vine health. Crushing can raise it further.',
    effects: [
      { family: 'redFruit', direction: 'up' },
      { family: 'blackFruit', direction: 'up' }
    ]
  },
  {
    name: 'Aromatic Potential',
    summary: 'The capacity for expressive aromatic lift.',
    influencedBy: 'Harvest baseline: grape aroma, site suitability, soil minerality, vineyard condition, and ripeness.',
    effects: [{ family: 'flower', direction: 'up' }]
  },
  {
    name: 'Body Potential',
    summary: 'The capacity for weight, texture, and flavour concentration.',
    influencedBy: 'Harvest baseline: grape body, sugar potential, phenolic potential, and ripeness.',
    effects: [
      { family: 'treeFruit', direction: 'up' },
      { family: 'tropicalFruit', direction: 'up' },
      { family: 'driedFruit', direction: 'up' }
    ]
  },
  {
    name: 'Extraction State',
    summary: 'How much colour, tannin, and flavour has been drawn from the grapes.',
    influencedBy: 'Cellar process: press method and intensity, destemming, cold soak, fermentation method, and time in contact.',
    effects: [
      { family: 'blackFruit', direction: 'up' },
      { family: 'spiceFlavor', direction: 'up' }
    ]
  },
  {
    name: 'Fermentation State',
    summary: 'The aromatic and flavour impact of the chosen fermentation approach.',
    influencedBy: 'Cellar process: fermentation method, temperature, and weekly fermentation contact.',
    effects: [
      { family: 'spiceFlavor', direction: 'up' },
      { family: 'microbial', direction: 'up' }
    ]
  },
  {
    name: 'Lees State',
    summary: 'The level of yeast-lees influence carried by the wine.',
    influencedBy: 'Cellar process: fermentation method and temperature, then increases with ongoing fermentation contact.',
    effects: [{ family: 'microbial', direction: 'up' }]
  },
  {
    name: 'Oxidation Pressure',
    summary: "The batch's exposure and sensitivity to oxidative development.",
    influencedBy: 'Harvest baseline: grape oxidation tendency, lower acid potential, vine health, and ripeness. It can also change with oxidation features and bottle age.',
    effects: [
      { family: 'oakAging', direction: 'up' },
      { family: 'generalAging', direction: 'up' }
    ]
  },
  {
    name: 'Maturation State',
    summary: "The wine's capacity for spice and evolved maturity.",
    influencedBy: 'Harvest baseline: grape spice, vine age, site suitability, and ripeness. Bottle age and bottle-aging features can increase it later.',
    effects: [
      { family: 'driedFruit', direction: 'up' },
      { family: 'spiceFlavor', direction: 'up' },
      { family: 'earth', direction: 'up' },
      { family: 'oakAging', direction: 'up' },
      { family: 'generalAging', direction: 'up' },
      { family: 'redFruit', direction: 'down' }
    ]
  },
  {
    name: 'Terroir Expression',
    summary: 'How clearly the site and vineyard character come through in the wine.',
    influencedBy: 'Harvest baseline: grape-site suitability, soil minerality, altitude, vine age, density, vineyard health, and overgrowth. Terroir features can strengthen it later.',
    effects: [
      { family: 'flower', direction: 'up' },
      { family: 'citrus', direction: 'up' },
      { family: 'earth', direction: 'up' },
      { family: 'vegetable', direction: 'down' }
    ]
  },
  {
    name: 'Process Footprint',
    summary: 'How strongly risks, interventions, and bottle evolution mark the batch.',
    influencedBy: 'Harvest baseline: the density of pending vineyard risks. It grows with pressing, fermentation, present features, bottle age, and oxidation.',
    effects: [{ family: 'faults', direction: 'up' }]
  }
];

function TasteEffectBadge({ effect }: { effect: TasteEffect }) {
  const isIncrease = effect.direction === 'up';

  return (
    <span
      className={
        isIncrease
          ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200'
          : 'inline-flex items-center rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800 ring-1 ring-inset ring-rose-200'
      }
    >
      {isIncrease ? '+' : '-'} {FLAVOR_FAMILY_LABELS[effect.family]}
    </span>
  );
}

export function WineAnchorsTab() {
  return (
    <div className="space-y-6">
      <SimpleCard
        title="Wine Anchors"
        description="The twelve compact values that carry a wine's upstream identity from vineyard and cellar choices into its eventual taste profile."
      >
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            Effects below show the direct direction of a higher anchor value on each taste family. Grape identity,
            structure, features, and aging can also change the final profile, so an anchor guides a wine rather than
            guaranteeing a flavor.
          </p>
          <p className="text-xs text-gray-500">
            Harvest anchors begin as 0-1 values at harvest. Cellar and bottle stages can then update the process-led anchors.
          </p>
        </div>
      </SimpleCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ANCHOR_REFERENCE.map((anchor) => (
          <section key={anchor.name} className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900">{anchor.name}</h3>
            <p className="mt-1 text-sm text-gray-600">{anchor.summary}</p>

            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Taste-family influence</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {anchor.effects.map((effect) => (
                  <TasteEffectBadge key={`${effect.direction}-${effect.family}`} effect={effect} />
                ))}
              </div>
            </div>

            <div className="mt-3 border-t pt-3 text-sm text-gray-600">
              <span className="font-medium text-gray-800">Influenced by: </span>
              {anchor.influencedBy}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
