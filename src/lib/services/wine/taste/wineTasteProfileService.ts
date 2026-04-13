/**
 * Derives **flavor families**, **descriptor notes**, and **taste metrics** for UI from:
 * structure channels, wine anchors, grape identity, and active wine features.
 * Aligns with `docs/TasteSystem_WineFolly_Research.md` (normalization, cross-domain, matrix harmony).
 */
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { computeFlavorHarmonyFromMatrix } from '@/lib/constants/taste/tasteCompatibilityMatrix';
import {
  FLAVOR_FAMILY_IDS,
  WineBatch,
  WineFlavorFamilyProfile,
  WineTasteComputedMetrics,
  WineTasteDescriptorProfile,
  WineTasteProfileBundle
} from '@/lib/types/types';
import { resolveWineAnchors } from '@/lib/services/wine/anchors/wineAnchorService';
import { applyStructureToFlavorCrossDomain } from '@/lib/services/wine/taste/tasteCrossDomain';
import { normalizeTasteScalar } from '@/lib/services/wine/taste/tasteNormalization';
import { clamp01 } from '@/lib/utils/utils';

const FLOOR = 0.02;

function mean(...xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(...xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length);
}

function featureSeverity(batch: WineBatch, id: string): number {
  const f = batch.features?.find((x) => x.id === id);
  if (!f?.isPresent || f.severity <= 0) return 0;
  return clamp01(f.severity);
}

function normDesc(raw: number): number {
  return normalizeTasteScalar(clamp01(raw));
}

/**
 * Full taste bundle for modals, tooltips, and future contracts UI.
 */
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

  // --- Raw flavor families (pre-normalization) ---
  let flower = FLOOR + c.aroma * 0.38 + a.aromaticIntensity * 0.28 + a.varietyCharacter * 0.12 + (isRed ? 0.03 : 0.09);

  let citrus =
    FLOOR +
    c.acidity * 0.42 +
    a.juiceAcidity * 0.22 +
    (1 - a.harvestTiming) * 0.08 +
    a.microclimateBlend * 0.06 * (isRed ? 0.5 : 1);

  let treeFruit =
    FLOOR +
    c.aroma * 0.22 +
    c.sweetness * 0.18 +
    a.textureRichness * 0.14 +
    (isRed ? c.body * 0.12 : c.body * 0.2);

  let tropicalFruit =
    FLOOR +
    c.sweetness * 0.35 +
    a.harvestTiming * 0.22 +
    a.residualSugar * 0.2 +
    a.aspectWarmth * 0.1;

  let redFruit = FLOOR;
  let blackFruit = FLOOR;
  if (isRed) {
    redFruit +=
      0.1 +
      c.tannins * 0.22 +
      (1 - c.body) * 0.08 +
      a.phenolicExtract * 0.18 +
      (1 - a.harvestTiming) * 0.06;
    blackFruit +=
      0.08 +
      c.body * 0.26 +
      c.tannins * 0.2 +
      a.phenolicExtract * 0.24 +
      a.skinContactEvolution * 0.12 +
      a.colorIntensity * 0.08;
  } else {
    redFruit += 0.02 + c.sweetness * 0.04;
    blackFruit += 0.02 + c.body * 0.05;
  }

  let driedFruit =
    FLOOR +
    c.sweetness * 0.28 +
    a.harvestTiming * 0.26 +
    a.residualSugar * 0.18 +
    a.textureRichness * 0.12;

  let spiceFlavor =
    FLOOR +
    c.spice * 0.42 +
    a.varietyCharacter * 0.18 +
    a.fermentationProfile * 0.16 +
    a.crushingExtraction * 0.08;

  let vegetable =
    FLOOR +
    c.acidity * 0.12 +
    a.siteWildness * 0.22 +
    (1 - a.vineyardHealth) * 0.08 +
    green * 0.42;

  let earth =
    FLOOR +
    a.soilAffinity * 0.32 +
    a.regionalTypicity * 0.22 +
    c.spice * 0.12 +
    terroirFeat * 0.28 +
    a.siteWildness * 0.08;

  let microbial =
    FLOOR +
    a.leesContact * 0.38 +
    a.fermentationProfile * 0.22 +
    stuck * 0.15 +
    c.aroma * 0.12;

  let oakAging = FLOOR + a.cellarEvolution * 0.35 + bottleAging * 0.28 + a.oxidativeCharacter * 0.12;

  let generalAging =
    FLOOR + a.cellarEvolution * 0.42 + bottleAging * 0.35 + batch.tasteIndex * 0.08 + oxidation * 0.1;

  let faults =
    FLOOR +
    oxidation * 0.45 +
    stuck * 0.35 +
    greyRot * 0.3 +
    green * 0.25 +
    a.featureFootprint * 0.12;

  tropicalFruit += nobleRot * 0.18 + lateHarvest * 0.12;
  driedFruit += nobleRot * 0.22 + lateHarvest * 0.2;
  {
    const nobleLateBump = nobleRot * 0.06 + lateHarvest * 0.04;
    tropicalFruit += nobleLateBump;
    driedFruit += nobleLateBump;
  }

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

  const harmony = computeFlavorHarmonyFromMatrix(profile);

  // --- Descriptors (sigmoid-normalized; finer UI layer) ---
  const d: WineTasteDescriptorProfile = {
    citrusZest: normDesc(profile.citrus * 0.82 + c.acidity * 0.14),
    orchardFruit: normDesc(profile.treeFruit * 0.72 + c.aroma * 0.18),
    stoneMelon: normDesc(profile.treeFruit * 0.55 + c.sweetness * 0.28 + a.textureRichness * 0.1),
    tropicalNotes: normDesc(profile.tropicalFruit * 0.9 + nobleRot * 0.08),
    redBerry: normDesc(profile.redFruit * 0.88 + c.tannins * 0.08),
    darkFruit: normDesc(profile.blackFruit * 0.9 + a.phenolicExtract * 0.08),
    driedConcentrated: normDesc(profile.driedFruit * 0.85 + lateHarvest * 0.12),
    floralLift: normDesc(profile.flower * 0.92),
    herbalGreen: normDesc(profile.vegetable * 0.75 + green * 0.22),
    pepperBakingSpice: normDesc(profile.spiceFlavor * 0.65 + c.spice * 0.3),
    earthMineral: normDesc(profile.earth * 0.88 + a.soilAffinity * 0.1),
    yeastLees: normDesc(profile.microbial * 0.78 + a.leesContact * 0.18),
    oakToastVanilla: normDesc(profile.oakAging * 0.85 + a.cellarEvolution * 0.12),
    bottleEvolved: normDesc(profile.generalAging * 0.8 + bottleAging * 0.18),
    faultEdge: normDesc(profile.faults * 0.85 + oxidation * 0.12 + stuck * 0.08),
    whiteFloral: normDesc(profile.flower * 0.78 + (!isRed ? c.aroma * 0.15 : c.aroma * 0.06)),
    greenApple: normDesc(
      profile.treeFruit * 0.42 + c.acidity * 0.38 + (!isRed ? a.juiceAcidity * 0.12 : 0.04)
    ),
    yellowApple: normDesc(profile.treeFruit * 0.48 + c.sweetness * 0.22 + a.harvestTiming * 0.08),
    pearNotes: normDesc(profile.treeFruit * 0.52 + c.aroma * 0.18 + a.textureRichness * 0.08),
    whitePeach: normDesc(
      profile.treeFruit * 0.38 + c.sweetness * 0.28 + a.aromaticIntensity * 0.14 + (!isRed ? 0.06 : 0.02)
    ),
    grapefruit: normDesc(profile.citrus * 0.58 + c.acidity * 0.28 + a.juiceAcidity * 0.08),
    orangeZest: normDesc(profile.citrus * 0.52 + a.harvestTiming * 0.18 + c.sweetness * 0.12),
    tropicalIsland: normDesc(profile.tropicalFruit * 0.92 + a.aspectWarmth * 0.06),
    honeyed: normDesc(
      profile.driedFruit * 0.32 + c.sweetness * 0.38 + nobleRot * 0.22 + a.residualSugar * 0.12
    ),
    leatheryTobacco: normDesc(
      profile.generalAging * 0.48 + profile.earth * 0.22 + profile.oakAging * 0.22 + oxidation * 0.06
    ),
    graphiteMineral: normDesc(profile.earth * 0.52 + c.acidity * 0.22 + a.soilAffinity * 0.2)
  };

  const metrics = computeMetrics(profile, batch, a, harmony);

  return { flavorFamilies: profile, descriptors: d, metrics };
}

function computeMetrics(
  profile: WineFlavorFamilyProfile,
  batch: WineBatch,
  a: ReturnType<typeof resolveWineAnchors>,
  matrixHarmony: number
): WineTasteComputedMetrics {
  const vals = FLAVOR_FAMILY_IDS.map((id) => profile[id]);
  const sorted = [...vals].sort((x, y) => y - x);
  const intensity = clamp01(mean(sorted[0], sorted[1], sorted[2], sorted[3]));

  const prominent = vals.filter((v) => v > 0.2).length;
  const complexity = clamp01(prominent / 12 + stdev(vals) * 0.85);

  const harmony = matrixHarmony;

  const typicity = clamp01(
    mean(a.regionalTypicity, a.solarClimateFit, a.varietyCharacter) * 0.55 + batch.tasteIndex * 0.28 + 0.12
  );

  const primary = mean(
    profile.flower,
    profile.citrus,
    profile.treeFruit,
    profile.tropicalFruit,
    profile.redFruit,
    profile.blackFruit,
    profile.driedFruit
  );
  const secondary = mean(profile.spiceFlavor, profile.microbial, profile.vegetable * 0.85);
  const tertiary = mean(profile.oakAging, profile.generalAging, profile.earth * 0.6, profile.faults * 0.45);
  const layerBalance = clamp01(
    1 -
      (Math.abs(primary - secondary) + Math.abs(secondary - tertiary) + Math.abs(tertiary - primary)) / 3
  );

  const flavorQualityIndex = clamp01(
    0.45 * harmony + 0.25 * complexity + 0.2 * intensity + 0.1 * typicity
  );

  return { intensity, complexity, harmony, typicity, layerBalance, flavorQualityIndex };
}
