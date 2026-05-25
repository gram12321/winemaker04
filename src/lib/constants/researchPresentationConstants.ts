import { type UnlockType } from '@/lib/constants/researchConstants';

export const CHAINED_VINEYARD_CAP_UNLOCK_TYPES: ReadonlySet<UnlockType> = new Set([
  'vineyard_size',
  'total_vineyard_hectares',
  'vineyard_count',
]);

export const MARKET_UNLOCK_TYPES: ReadonlySet<UnlockType> = new Set([
  'contract_type',
  'grape_buyer_slots',
  'grape_buyer_limit_multiplier',
  'grape_buyer_multiplier_bonus',
  'grape_buyer_country_access',
]);

export const CHAINED_RESEARCH_UNLOCK_TYPES: ReadonlySet<UnlockType> = new Set([
  'staff_limit',
  ...Array.from(CHAINED_VINEYARD_CAP_UNLOCK_TYPES),
]);

export const LADDER_TYPES: UnlockType[] = [
  'staff_limit',
  ...Array.from(CHAINED_VINEYARD_CAP_UNLOCK_TYPES),
];
