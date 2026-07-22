import {
  BASE_MAX_HECTARES_PER_VINEYARD,
  BASE_TOTAL_VINEYARD_HECTARES_LIMIT,
  BASE_VINEYARD_COUNT_LIMIT,
  RESEARCH_PROJECTS,
  type ResearchProject,
} from '@/lib/features/researchUpgrade/constants/researchCatalog';

export type VineyardCapUnlockType = 'vineyard_size' | 'total_vineyard_hectares' | 'vineyard_count';


export const CHAINED_VINEYARD_CAP_UNLOCK_TYPES: ReadonlySet<VineyardCapUnlockType> = new Set([
  'vineyard_size',
  'total_vineyard_hectares',
  'vineyard_count'
]);

export interface VineyardCapacityState {
  maxHectaresPerVineyard: number;
  maxTotalHectares: number;
  maxVineyardCount: number;
  currentTotalHectares: number;
  currentVineyardCount: number;
}

export const MIN_SEARCHABLE_HECTARES = 0.05;

export function getHighestUnlockedNumericLimit(unlockedValues: string[], baseValue: number): number {
  const numericValues = unlockedValues
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  return numericValues.length > 0 ? Math.max(baseValue, ...numericValues) : baseValue;
}

export function buildVineyardCapacityState(input: {
  currentTotalHectares: number;
  currentVineyardCount: number;
  unlockedPerVineyardValues: string[];
  unlockedTotalHectareValues: string[];
  unlockedVineyardCountValues: string[];
}): VineyardCapacityState {
  return {
    maxHectaresPerVineyard: getHighestUnlockedNumericLimit(input.unlockedPerVineyardValues, BASE_MAX_HECTARES_PER_VINEYARD),
    maxTotalHectares: getHighestUnlockedNumericLimit(input.unlockedTotalHectareValues, BASE_TOTAL_VINEYARD_HECTARES_LIMIT),
    maxVineyardCount: getHighestUnlockedNumericLimit(input.unlockedVineyardCountValues, BASE_VINEYARD_COUNT_LIMIT),
    currentTotalHectares: input.currentTotalHectares,
    currentVineyardCount: input.currentVineyardCount
  };
}

export function getRemainingTotalHectares(capacity: VineyardCapacityState): number {
  return Math.max(0, capacity.maxTotalHectares - capacity.currentTotalHectares);
}

export function getRemainingVineyardSlots(capacity: VineyardCapacityState): number {
  return Math.max(0, capacity.maxVineyardCount - capacity.currentVineyardCount);
}

export function getMaxSearchableHectares(capacity: VineyardCapacityState): number {
  return Math.max(
    MIN_SEARCHABLE_HECTARES,
    Math.min(capacity.maxHectaresPerVineyard, Math.max(getRemainingTotalHectares(capacity), 0))
  );
}

export function getLandSearchPenaltyReferenceRangeFromCapacity(capacity: VineyardCapacityState): [number, number] {
  return [MIN_SEARCHABLE_HECTARES, getMaxSearchableHectares(capacity)];
}

export function getChainedVineyardResearchUnlockType(project: ResearchProject): VineyardCapUnlockType | null {
  const chainedUnlock = project.unlocks?.find((unlock) => CHAINED_VINEYARD_CAP_UNLOCK_TYPES.has(unlock.type as VineyardCapUnlockType));
  return (chainedUnlock?.type as VineyardCapUnlockType | undefined) ?? null;
}

export function getNextVineyardCapacityResearch(type: VineyardCapUnlockType, currentLimit: number): ResearchProject | null {
  const nextProject = RESEARCH_PROJECTS
    .filter((project) => project.unlocks?.some((unlock) =>
      unlock.type === type && typeof unlock.value === 'number' && unlock.value > currentLimit
    ))
    .sort((left, right) => {
      const leftValue = Number(left.unlocks?.find((unlock) => unlock.type === type)?.value ?? Number.MAX_SAFE_INTEGER);
      const rightValue = Number(right.unlocks?.find((unlock) => unlock.type === type)?.value ?? Number.MAX_SAFE_INTEGER);
      return leftValue - rightValue;
    })[0];

  return nextProject ?? null;
}

export function getVineyardCapacityLabel(type: VineyardCapUnlockType): string {
  switch (type) {
    case 'vineyard_size':
      return 'max size per vineyard';
    case 'total_vineyard_hectares':
      return 'max total vineyard area';
    case 'vineyard_count':
      return 'max vineyard count';
    default:
      {
        const unreachable: never = type;
        return unreachable;
      }
  }
}

export function getBaseVineyardCapacityValue(type: VineyardCapUnlockType): number {
  switch (type) {
    case 'vineyard_size':
      return BASE_MAX_HECTARES_PER_VINEYARD;
    case 'total_vineyard_hectares':
      return BASE_TOTAL_VINEYARD_HECTARES_LIMIT;
    case 'vineyard_count':
      return BASE_VINEYARD_COUNT_LIMIT;
    default:
      {
        const unreachable: never = type;
        return unreachable;
      }
  }
}

export function formatVineyardCapacityValue(type: VineyardCapUnlockType, value: number): string {
  if (type === 'vineyard_count') {
    return `${value}`;
  }

  return `${value} ha`;
}

export function getNextVineyardCapacityHint(type: VineyardCapUnlockType, currentLimit: number): string | null {
  const nextResearch = getNextVineyardCapacityResearch(type, currentLimit);
  const nextUnlock = nextResearch?.unlocks?.find((unlock) => unlock.type === type);

  if (!nextResearch || typeof nextUnlock?.value !== 'number') {
    return null;
  }

  return `${nextResearch.title} in the ${nextResearch.category} tab raises ${getVineyardCapacityLabel(type)} to ${formatVineyardCapacityValue(type, nextUnlock.value)}.`;
}

export function getCapacityConstraintReason(input: {
  propertyHectares: number;
  capacity: VineyardCapacityState;
}): string | null {
  if (input.propertyHectares > input.capacity.maxHectaresPerVineyard) {
    return `This property is ${input.propertyHectares} ha, above your per-vineyard cap of ${input.capacity.maxHectaresPerVineyard} ha.`;
  }

  if ((input.capacity.currentTotalHectares + input.propertyHectares) > input.capacity.maxTotalHectares) {
    return `Buying this would exceed your total vineyard area cap of ${input.capacity.maxTotalHectares} ha.`;
  }

  if ((input.capacity.currentVineyardCount + 1) > input.capacity.maxVineyardCount) {
    return `Buying this would exceed your vineyard count cap of ${input.capacity.maxVineyardCount}.`;
  }

  return null;
}
