/**
 * Derives flavor families and descriptor notes for UI from structure channels,
 * compact anchors, grape identity, and active wine features.
 */
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import {
  FLAVOR_FAMILY_IDS,
  FlavorFamilyId,
  WineBatch,
  WineFlavorFamilyProfile,
  WineTasteDescriptorId,
  WineTasteDescriptorProfile,
  WineTasteProfileBundle
} from '@/lib/types/types';
import { resolveWineAnchors } from '@/lib/services/wine/anchors/wineAnchorService';
import { applyStructureToFlavorCrossDomain } from '@/lib/services/wine/taste/tasteCrossDomain';
import { normalizeTasteScalar } from '@/lib/services/wine/taste/tasteNormalization';
import { clamp01 } from '@/lib/utils/utils';

const FLOOR = 0.02;

function featureSeverity(batch: WineBatch, id: string): number {
  const f = batch.features?.find((x) => x.id === id);
  if (!f?.isPresent || f.severity <= 0) return 0;
  return clamp01(f.severity);
}

function normDesc(raw: number): number {
  return normalizeTasteScalar(clamp01(raw));
}

const DESCRIPTOR_FAMILY_MAP: Record<FlavorFamilyId, WineTasteDescriptorId[]> = {
  flower: ['floralLift', 'whiteFloral'],
  citrus: ['citrusZest', 'grapefruit', 'orangeZest'],
  treeFruit: ['orchardFruit', 'greenApple', 'yellowApple', 'pearNotes', 'whitePeach', 'stoneMelon'],
  tropicalFruit: ['tropicalNotes', 'tropicalIsland'],
  redFruit: ['redBerry'],
  blackFruit: ['darkFruit'],
  driedFruit: ['driedConcentrated', 'honeyed'],
  spiceFlavor: ['pepperBakingSpice'],
  vegetable: ['herbalGreen'],
  earth: ['earthMineral', 'graphiteMineral'],
  microbial: ['yeastLees'],
  oakAging: ['oakToastVanilla'],
  generalAging: ['bottleEvolved', 'leatheryTobacco'],
  faults: ['faultEdge']
};

export function computeWineTasteProfile(batch: WineBatch): WineTasteProfileBundle {
  const grape = GRAPE_CONST[batch.grape];
  const c = batch.characteristics;
  const a = resolveWineAnchors(batch.wineAnchors);
  const isRed = grape.grapeColor === 'red';

  const green = featureSeverity(batch, 'green_flavor');
  const oxidation = featureSeverity(batch, 'oxidation');
  const stuck = featureSeverity(batch, 'stuck_fermentation');
  const greyRot = featureSeverity(batch, 'grey_rot');
  const nobleRot = featureSeverity(batch, 'noble_rot');
  const lateHarvest = featureSeverity(batch, 'late_harvest');
  const bottleAging = featureSeverity(batch, 'bottle_aging');
  const terroirFeat = featureSeverity(batch, 'terroir');

  let flower = FLOOR + c.aroma * 0.38 + a.aromaticPotential * 0.34 + a.terroirExpression * 0.12 + (isRed ? 0.03 : 0.09);

  let citrus =
    FLOOR +
    c.acidity * 0.46 +
    a.acidPotential * 0.26 +
    (1 - a.sugarPotential) * 0.1 +
    a.terroirExpression * 0.06 * (isRed ? 0.6 : 1);

  let treeFruit = FLOOR + c.aroma * 0.24 + c.sweetness * 0.16 + a.bodyPotential * 0.14 + (isRed ? c.body * 0.1 : c.body * 0.18);

  let tropicalFruit = FLOOR + c.sweetness * 0.35 + a.sugarPotential * 0.28 + a.bodyPotential * 0.15;

  let redFruit = FLOOR;
  let blackFruit = FLOOR;
  if (isRed) {
    redFruit +=
      0.1 +
      c.tannins * 0.2 +
      (1 - c.body) * 0.08 +
      a.phenolicPotential * 0.22 +
      (1 - a.maturationState) * 0.06;
    blackFruit +=
      0.08 +
      c.body * 0.26 +
      c.tannins * 0.2 +
      a.phenolicPotential * 0.26 +
      a.extractionState * 0.12;
  } else {
    redFruit += 0.02 + c.sweetness * 0.04;
    blackFruit += 0.02 + c.body * 0.05;
  }

  let driedFruit = FLOOR + c.sweetness * 0.28 + a.sugarPotential * 0.26 + a.maturationState * 0.2 + a.bodyPotential * 0.1;

  let spiceFlavor = FLOOR + c.spice * 0.42 + a.fermentationState * 0.26 + a.maturationState * 0.16 + a.extractionState * 0.08;

  let vegetable = FLOOR + c.acidity * 0.12 + (1 - a.terroirExpression) * 0.1 + (1 - a.acidPotential) * 0.06 + green * 0.42;

  let earth = FLOOR + a.terroirExpression * 0.48 + c.spice * 0.1 + terroirFeat * 0.26 + a.maturationState * 0.08;

  let microbial = FLOOR + a.leesState * 0.42 + a.fermentationState * 0.24 + stuck * 0.15 + c.aroma * 0.1;

  let oakAging = FLOOR + a.maturationState * 0.42 + bottleAging * 0.26 + a.oxidationPressure * 0.12;

  let generalAging = FLOOR + a.maturationState * 0.46 + bottleAging * 0.35 + a.oxidationPressure * 0.16;

  let faults = FLOOR + oxidation * 0.45 + stuck * 0.35 + greyRot * 0.3 + green * 0.25 + a.processFootprint * 0.12;

  tropicalFruit += nobleRot * 0.18 + lateHarvest * 0.12;
  driedFruit += nobleRot * 0.22 + lateHarvest * 0.2;

  const rawMap = {
    flower,
    citrus,
    treeFruit,
    tropicalFruit,
    redFruit,
    blackFruit,
    driedFruit,
    spiceFlavor,
    vegetable,
    earth,
    microbial,
    oakAging,
    generalAging,
    faults
  } as WineFlavorFamilyProfile;

  applyStructureToFlavorCrossDomain(c, rawMap);

  const profile = {} as WineFlavorFamilyProfile;
  for (const id of FLAVOR_FAMILY_IDS) {
    profile[id] = normalizeTasteScalar(clamp01(rawMap[id]));
  }

  const d: WineTasteDescriptorProfile = {
    citrusZest: normDesc(profile.citrus * 0.82 + c.acidity * 0.14),
    orchardFruit: normDesc(profile.treeFruit * 0.72 + c.aroma * 0.18),
    stoneMelon: normDesc(profile.treeFruit * 0.55 + c.sweetness * 0.28 + a.bodyPotential * 0.1),
    tropicalNotes: normDesc(profile.tropicalFruit * 0.9 + nobleRot * 0.08),
    redBerry: normDesc(profile.redFruit * 0.88 + c.tannins * 0.08),
    darkFruit: normDesc(profile.blackFruit * 0.9 + a.phenolicPotential * 0.08),
    driedConcentrated: normDesc(profile.driedFruit * 0.85 + lateHarvest * 0.12),
    floralLift: normDesc(profile.flower * 0.92),
    herbalGreen: normDesc(profile.vegetable * 0.75 + green * 0.22),
    pepperBakingSpice: normDesc(profile.spiceFlavor * 0.65 + c.spice * 0.3),
    earthMineral: normDesc(profile.earth * 0.88 + a.terroirExpression * 0.1),
    yeastLees: normDesc(profile.microbial * 0.78 + a.leesState * 0.18),
    oakToastVanilla: normDesc(profile.oakAging * 0.85 + a.maturationState * 0.12),
    bottleEvolved: normDesc(profile.generalAging * 0.8 + bottleAging * 0.18),
    faultEdge: normDesc(profile.faults * 0.85 + oxidation * 0.12 + stuck * 0.08),
    whiteFloral: normDesc(profile.flower * 0.78 + (!isRed ? c.aroma * 0.15 : c.aroma * 0.06)),
    greenApple: normDesc(profile.treeFruit * 0.42 + c.acidity * 0.38 + (!isRed ? a.acidPotential * 0.12 : 0.04)),
    yellowApple: normDesc(profile.treeFruit * 0.48 + c.sweetness * 0.22 + a.sugarPotential * 0.08),
    pearNotes: normDesc(profile.treeFruit * 0.52 + c.aroma * 0.18 + a.bodyPotential * 0.08),
    whitePeach: normDesc(profile.treeFruit * 0.38 + c.sweetness * 0.28 + a.aromaticPotential * 0.14 + (!isRed ? 0.06 : 0.02)),
    grapefruit: normDesc(profile.citrus * 0.58 + c.acidity * 0.28 + a.acidPotential * 0.08),
    orangeZest: normDesc(profile.citrus * 0.52 + a.sugarPotential * 0.18 + c.sweetness * 0.12),
    tropicalIsland: normDesc(profile.tropicalFruit * 0.92 + a.terroirExpression * 0.06),
    honeyed: normDesc(profile.driedFruit * 0.32 + c.sweetness * 0.38 + nobleRot * 0.22 + a.sugarPotential * 0.12),
    leatheryTobacco: normDesc(profile.generalAging * 0.48 + profile.earth * 0.22 + profile.oakAging * 0.22 + oxidation * 0.06),
    graphiteMineral: normDesc(profile.earth * 0.52 + c.acidity * 0.22 + a.terroirExpression * 0.2)
  };

  return {
    flavorFamilies: profile,
    descriptors: d,
    descriptorFamilies: DESCRIPTOR_FAMILY_MAP
  };
}
