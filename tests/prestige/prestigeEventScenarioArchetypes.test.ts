import { describe, expect, it } from 'vitest';
import { achievementsFeature } from '@/lib/features/achievements';
import { getResearchProject } from '@/lib/features/researchUpgrade/services/research/researchCatalogService';
import { calculatePrestigePenaltyWithFame } from '@/lib/features/loanLender/services/finance/loanService';
import {
  calculateFeatureSalePrestigeWithReputation,
  calculateSalePrestigeWithAssets,
  calculateVineyardSalePrestige
} from '@/lib/features/prestige/services/prestigeCalculator';

const MAX_LAND_VALUE_BENCHMARK = 1_000_000;

type Archetype = {
  companyValue: number;
  currentPrestige: number;
  saleValue: number;
  saleVolume: number;
  baseVineyardPrestige: number;
  featureSeverity: number;
  researchProjectId: string;
  achievementTier: 1 | 2 | 3 | 4 | 5;
};

const archetypes = {
  youngLocalEstate: {
    companyValue: 250_000,
    currentPrestige: 8,
    saleValue: 2_000,
    saleVolume: 100,
    baseVineyardPrestige: 0.5,
    featureSeverity: 0.25,
    researchProjectId: 'foundation_grant_basic',
    achievementTier: 2
  },
  establishedRegionalEstate: {
    companyValue: 2_000_000,
    currentPrestige: 80,
    saleValue: 25_000,
    saleVolume: 1_000,
    baseVineyardPrestige: 5,
    featureSeverity: 0.6,
    researchProjectId: 'tech_fermentation',
    achievementTier: 3
  },
  iconicLateGameBrand: {
    companyValue: 100_000_000,
    currentPrestige: 1_000,
    saleValue: 250_000,
    saleVolume: 10_000,
    baseVineyardPrestige: 50,
    featureSeverity: 1,
    researchProjectId: 'mkt_old_world_exchange',
    achievementTier: 5
  }
} satisfies Record<string, Archetype>;

function companyValuePrestige(companyValue: number): number {
  return Math.log(companyValue / MAX_LAND_VALUE_BENCHMARK + 1);
}

function researchReward(projectId: string): number {
  const project = getResearchProject(projectId);
  if (!project?.prestigeReward) {
    throw new Error(`Scenario research project ${projectId} must have a prestige reward`);
  }

  return project.prestigeReward;
}

function calculateScenarioImpact(archetype: Archetype) {
  const saleBaseAmount = archetype.saleValue / 10_000;

  return {
    companyValueRow: companyValuePrestige(archetype.companyValue),
    regularVineyardSale: calculateVineyardSalePrestige(
      saleBaseAmount,
      archetype.baseVineyardPrestige,
      archetype.saleValue,
      archetype.saleVolume
    ),
    companySaleFallback: calculateSalePrestigeWithAssets(
      saleBaseAmount,
      archetype.saleValue,
      archetype.saleVolume,
      archetype.companyValue
    ),
    terroirCompanySale: calculateFeatureSalePrestigeWithReputation(
      0.05,
      archetype.saleValue,
      archetype.saleVolume,
      archetype.currentPrestige,
      undefined,
      8,
      archetype.featureSeverity
    ),
    terroirVineyardSale: calculateFeatureSalePrestigeWithReputation(
      0.08,
      archetype.saleValue,
      archetype.saleVolume,
      archetype.baseVineyardPrestige,
      undefined,
      12,
      archetype.featureSeverity
    ),
    oxidationCompanySale: calculateFeatureSalePrestigeWithReputation(
      -0.1,
      archetype.saleValue,
      archetype.saleVolume,
      archetype.currentPrestige,
      undefined,
      -10,
      archetype.featureSeverity
    ),
    oxidationVineyardSale: calculateFeatureSalePrestigeWithReputation(
      -0.2,
      archetype.saleValue,
      archetype.saleVolume,
      archetype.baseVineyardPrestige,
      undefined,
      -8,
      archetype.featureSeverity
    ),
    researchReward: researchReward(archetype.researchProjectId),
    achievementReward: achievementsFeature.catalog.getLevelInfo(archetype.achievementTier).prestige,
    warning2LoanPenalty: calculatePrestigePenaltyWithFame(-25, archetype.currentPrestige, { rate: 0.02, cap: 25 }),
    loanDefaultPenalty: calculatePrestigePenaltyWithFame(-75, archetype.currentPrestige, { rate: 0.08, cap: 175 })
  };
}

function expectBetween(value: number, min: number, max: number): void {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

function expectIncreasingByMagnitude(values: number[]): void {
  for (let index = 1; index < values.length; index += 1) {
    expect(Math.abs(values[index])).toBeGreaterThan(Math.abs(values[index - 1]));
  }
}

describe('prestige event scenario archetypes', () => {
  it('keeps realistic sale and feature events in their intended early, mid, and late-game ranges', () => {
    const young = calculateScenarioImpact(archetypes.youngLocalEstate);
    const regional = calculateScenarioImpact(archetypes.establishedRegionalEstate);
    const iconic = calculateScenarioImpact(archetypes.iconicLateGameBrand);

    expectBetween(young.companyValueRow, 0.2, 0.3);
    expectBetween(young.regularVineyardSale, 0.3, 0.6);
    expectBetween(young.companySaleFallback, 1, 1.3);
    expectBetween(young.terroirCompanySale, 0, 0.02);
    expectBetween(young.terroirVineyardSale, 0, 0.01);
    expectBetween(young.oxidationCompanySale, -0.05, 0);
    expectBetween(young.oxidationVineyardSale, -0.02, 0);

    expectBetween(regional.companyValueRow, 1, 1.2);
    expectBetween(regional.regularVineyardSale, 8, 10);
    expect(regional.companySaleFallback).toBe(10);
    expectBetween(regional.terroirCompanySale, 0.05, 0.15);
    expectBetween(regional.terroirVineyardSale, 0.02, 0.06);
    expectBetween(regional.oxidationCompanySale, -0.3, -0.1);
    expectBetween(regional.oxidationVineyardSale, -0.2, -0.05);

    expectBetween(iconic.companyValueRow, 4.5, 4.7);
    expectBetween(iconic.regularVineyardSale, 14.9, 15);
    expect(iconic.companySaleFallback).toBe(10);
    expectBetween(iconic.terroirCompanySale, 0.4, 0.6);
    expectBetween(iconic.terroirVineyardSale, 0.25, 0.45);
    expectBetween(iconic.oxidationCompanySale, -1.2, -0.7);
    expectBetween(iconic.oxidationVineyardSale, -1, -0.6);
  });

  it('keeps research and achievement rewards meaningful at the company scale that can realistically unlock them', () => {
    const young = calculateScenarioImpact(archetypes.youngLocalEstate);
    const regional = calculateScenarioImpact(archetypes.establishedRegionalEstate);
    const iconic = calculateScenarioImpact(archetypes.iconicLateGameBrand);
    const youngProject = getResearchProject(archetypes.youngLocalEstate.researchProjectId);
    const regionalProject = getResearchProject(archetypes.establishedRegionalEstate.researchProjectId);
    const iconicProject = getResearchProject(archetypes.iconicLateGameBrand.researchProjectId);

    expect(youngProject?.requiredPrestige).toBe(0);
    expect(youngProject?.prestigeReward).toBeCloseTo(0.6);
    expect(youngProject?.requiredPrestige ?? 0).toBeLessThanOrEqual(archetypes.youngLocalEstate.currentPrestige);
    expect(youngProject?.requiredCompanyValue ?? 0).toBeLessThanOrEqual(archetypes.youngLocalEstate.companyValue);
    expect(regionalProject?.requiredPrestige).toBe(0);
    expect(regionalProject?.prestigeReward).toBeCloseTo(1.2);
    expect(regionalProject?.requiredPrestige ?? 0).toBeLessThanOrEqual(archetypes.establishedRegionalEstate.currentPrestige);
    expect(regionalProject?.requiredCompanyValue ?? 0).toBeLessThanOrEqual(archetypes.establishedRegionalEstate.companyValue);
    expect(iconicProject?.requiredPrestige).toBe(6);
    expect(iconicProject?.requiredCompanyValue).toBe(4_500_000);
    expect(iconicProject?.prestigeReward).toBe(2);
    expect(iconicProject?.requiredPrestige ?? 0).toBeLessThanOrEqual(archetypes.iconicLateGameBrand.currentPrestige);
    expect(iconicProject?.requiredCompanyValue ?? 0).toBeLessThanOrEqual(archetypes.iconicLateGameBrand.companyValue);

    expect(young.researchReward).toBeGreaterThan(young.companyValueRow);
    expect(regional.researchReward).toBeGreaterThan(regional.companyValueRow);
    expect(iconic.researchReward).toBeLessThan(iconic.regularVineyardSale);

    expect(young.achievementReward).toBe(3);
    expect(regional.achievementReward).toBe(20);
    expect(iconic.achievementReward).toBe(300);
    expect(achievementsFeature.catalog.getLevelInfo(1).prestige).toBe(0.1);
    expect(achievementsFeature.catalog.getLevelInfo(4).prestige).toBe(100);

    expect(regional.achievementReward).toBeLessThan(young.achievementReward * 10);
    expect(iconic.achievementReward).toBeLessThan(regional.achievementReward * 20);
    expect(iconic.companyValueRow).toBeGreaterThan(iconic.researchReward);
  });

  it('scales public faults and loan events from small-house learning mistakes to famous-house scandals', () => {
    const young = calculateScenarioImpact(archetypes.youngLocalEstate);
    const regional = calculateScenarioImpact(archetypes.establishedRegionalEstate);
    const iconic = calculateScenarioImpact(archetypes.iconicLateGameBrand);

    expectIncreasingByMagnitude([
      young.oxidationCompanySale,
      regional.oxidationCompanySale,
      iconic.oxidationCompanySale
    ]);
    expectIncreasingByMagnitude([
      young.oxidationVineyardSale,
      regional.oxidationVineyardSale,
      iconic.oxidationVineyardSale
    ]);
    expectIncreasingByMagnitude([
      young.warning2LoanPenalty,
      regional.warning2LoanPenalty,
      iconic.warning2LoanPenalty
    ]);
    expectIncreasingByMagnitude([
      young.loanDefaultPenalty,
      regional.loanDefaultPenalty,
      iconic.loanDefaultPenalty
    ]);

    expectBetween(young.warning2LoanPenalty, -26, -25);
    expectBetween(regional.warning2LoanPenalty, -27, -26);
    expect(iconic.warning2LoanPenalty).toBe(-45);
    expect(iconic.loanDefaultPenalty).toBe(-155);
    expect(Math.abs(iconic.loanDefaultPenalty)).toBeGreaterThan(iconic.achievementReward * 0.5);
    expect(Math.abs(iconic.loanDefaultPenalty)).toBeLessThan(iconic.achievementReward);
  });
});
