import { NAMES, GRAPE_MERCHANT_SUFFIXES } from '../../constants/namesConstants';
import { calculateCompanyValue } from '../finance/financeService';
import { getGameState } from '../core/gameState';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import {
  BASE_SEASONAL_SUPPLIER_COUNT,
  BULK_BASE_SEASON_SUPPLY_KG,
  BULK_SUPPLIER_ID,
  COUNTRY_SUPPLIER_CONFIG,
  MAX_SEASONAL_SUPPLIER_COUNT,
  SUPPLIER_MARKET_COUNTRY_KEYS,
  type SupplierMarketCountryKey
} from '@/lib/constants';
import { getRandomFromArray, randomInRange, randomInt } from '@/lib/utils';
import { researchEnforcer } from '../../features/researchUpgrade/services/research/researchEnforcer';
import {
  createSupplierRow,
  getKnownSupplierRowsForCountries,
  getSeasonSupplierRowsForCountries,
  getSupplierRow,
  getSupplierSeasonStateRow,
  updateSupplierRow,
} from '../../database/sales/grapeSupplierMarketDB';
import { getSupplierPriorityProfiles, type SupplierLoyaltyLevel } from './grapeSupplierLoyaltyService';
type CountryKey = SupplierMarketCountryKey;
type SupplierOriginTag = 'trusted_carryover' | 'seasonal_rotation' | 'country_special';

interface SupplierMarketRow {
  supplier_id: string;
  display_name: string;
  country: string;
  description: string | null;
  is_bulk_supplier: boolean;
  base_price_multiplier: number;
  multiplier_min: number;
  multiplier_max: number;
  base_season_supply_kg: number;
  supplied_this_season_kg: number;
  last_active_year: number | null;
  last_active_season: string | null;
}

export interface BuyMarketSupplierProfile {
  supplierId: string;
  supplierName: string;
  country: CountryKey;
  originTag: SupplierOriginTag;
  basePriceMultiplier: number;
  baseSeasonSupplyKg: number;
  effectiveSeasonSupplyKg: number;
  suppliedThisSeasonKg: number;
  remainingSeasonSupplyKg: number;
  loyaltyLevel: SupplierLoyaltyLevel;
  isBulkSupplier: boolean;
}

function isCountryKey(country?: string): country is CountryKey {
  return !!country && SUPPLIER_MARKET_COUNTRY_KEYS.includes(country as CountryKey);
}

function toCountryKey(country?: string): CountryKey {
  if (isCountryKey(country)) return country;
  return 'France';
}

function parseCountryKey(country?: string): CountryKey | null {
  if (isCountryKey(country)) return country;
  return null;
}

function generateSupplierId(country: CountryKey, year: number, season: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `supplier_${country.toLowerCase().replace(/\s+/g, '_')}_${year}_${season.toLowerCase()}_${random}`;
}

function generateSupplierName(country: CountryKey): string {
  const pool = NAMES[country];
  const male = pool.firstNames.male;
  const female = pool.firstNames.female;
  const firstName = Math.random() < 0.5 ? getRandomFromArray(male) : getRandomFromArray(female);
  const lastName = getRandomFromArray(pool.lastNames);
  const suffix = getRandomFromArray(GRAPE_MERCHANT_SUFFIXES[country]);
  return `${firstName} ${lastName} ${suffix}`;
}

function computeScaledSeasonSupply(baseSeasonSupplyKg: number, companyValue: number): number {
  const normalized = Math.max(0, Math.log10(Math.max(10000, companyValue)) - 4);
  const factor = Math.min(3, 1 + normalized * 0.45);
  return Math.max(300, Math.round(baseSeasonSupplyKg * factor));
}

async function getSeasonalSupplierCountFromResearch(): Promise<number> {
  // Intentionally shared with buyer market progression.
  const unlocked = await researchEnforcer.getUnlockedItems('grape_buyer_slots');
  const additional = unlocked.reduce((sum, value) => {
    const parsed = Number(value);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);

  const total = BASE_SEASONAL_SUPPLIER_COUNT + Math.max(0, Math.floor(additional));
  return Math.max(BASE_SEASONAL_SUPPLIER_COUNT, Math.min(MAX_SEASONAL_SUPPLIER_COUNT, total));
}

async function getUnlockedSupplierCountriesFromResearch(homeCountry: CountryKey): Promise<CountryKey[]> {
  // Intentionally shared with buyer market progression.
  const unlocked = await researchEnforcer.getUnlockedItems('grape_buyer_country_access');
  const allowed = new Set<CountryKey>([homeCountry]);

  for (const value of unlocked) {
    const parsed = parseCountryKey(String(value));
    if (parsed) {
      allowed.add(parsed);
    }
  }

  return Array.from(allowed);
}

function chooseMarketSupplierCountry(homeCountry: CountryKey, eligibleCountries: CountryKey[]): CountryKey {
  const pool = eligibleCountries.length > 0 ? eligibleCountries : [homeCountry];
  const foreignPool = pool.filter((country) => country !== homeCountry);

  if (foreignPool.length > 0 && Math.random() < 0.35) {
    return getRandomFromArray(foreignPool);
  }

  return homeCountry;
}

async function createMarketSupplier(
  companyId: string,
  country: CountryKey,
  currentYear: number,
  currentSeason: string
): Promise<SupplierMarketRow | null> {
  const config = COUNTRY_SUPPLIER_CONFIG[country];
  const supplierId = generateSupplierId(country, currentYear, currentSeason);
  const multiplierMin = Number(config.min.toFixed(2));
  const multiplierMax = Number(config.max.toFixed(2));
  const basePriceMultiplier = Number(randomInRange(multiplierMin, multiplierMax).toFixed(2));
  const baseSeasonSupplyKg = randomInt(config.baseSupplyMin, config.baseSupplyMax);

  const { data, error } = await createSupplierRow({
    company_id: companyId,
    supplier_id: supplierId,
    display_name: generateSupplierName(country),
    country,
    description: `${config.title} active for ${currentSeason}.`,
    is_bulk_supplier: false,
    base_price_multiplier: basePriceMultiplier,
    multiplier_min: multiplierMin,
    multiplier_max: multiplierMax,
    base_season_supply_kg: baseSeasonSupplyKg,
    supplied_this_season_kg: 0,
    last_active_year: currentYear,
    last_active_season: currentSeason,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to create market supplier:', error);
    return null;
  }

  return data as SupplierMarketRow;
}

async function ensureBulkSupplier(
  companyId: string,
  country: CountryKey,
  currentYear: number,
  currentSeason: string
): Promise<SupplierMarketRow | null> {
  const { data: existing } = await getSupplierRow(companyId, BULK_SUPPLIER_ID);

  if (existing) {
    const changedSeason = existing.last_active_year !== currentYear || existing.last_active_season !== currentSeason;
    await updateSupplierRow(companyId, BULK_SUPPLIER_ID, {
      country,
      last_active_year: currentYear,
      last_active_season: currentSeason,
      supplied_this_season_kg: changedSeason ? 0 : existing.supplied_this_season_kg,
      updated_at: new Date().toISOString(),
    });

    return {
      ...(existing as SupplierMarketRow),
      country,
      supplied_this_season_kg: changedSeason ? 0 : (existing.supplied_this_season_kg || 0),
      last_active_year: currentYear,
      last_active_season: currentSeason,
    };
  }

  const { data, error } = await createSupplierRow({
    company_id: companyId,
    supplier_id: BULK_SUPPLIER_ID,
    display_name: 'Bulk Supply Syndicate',
    country,
    description: 'Large-volume baseline supplier channel. Reliable inventory at structurally lower pricing.',
    is_bulk_supplier: true,
    base_price_multiplier: 0.88,
    multiplier_min: 0.88,
    multiplier_max: 0.88,
    base_season_supply_kg: BULK_BASE_SEASON_SUPPLY_KG,
    supplied_this_season_kg: 0,
    last_active_year: currentYear,
    last_active_season: currentSeason,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to create bulk supplier:', error);
    return null;
  }

  return data as SupplierMarketRow;
}

function rowToSupplierProfile(
  row: SupplierMarketRow,
  loyaltyLevel: SupplierLoyaltyLevel,
  companyValue: number,
  originTag: SupplierOriginTag
): BuyMarketSupplierProfile {
  const country = toCountryKey(row.country);
  const effectiveSeasonSupplyKg = computeScaledSeasonSupply(row.base_season_supply_kg, companyValue);
  const suppliedThisSeasonKg = Math.max(0, row.supplied_this_season_kg || 0);

  return {
    supplierId: row.supplier_id,
    supplierName: row.display_name,
    country,
    originTag,
    basePriceMultiplier: Number(row.base_price_multiplier),
    baseSeasonSupplyKg: row.base_season_supply_kg,
    effectiveSeasonSupplyKg,
    suppliedThisSeasonKg,
    remainingSeasonSupplyKg: Math.max(0, effectiveSeasonSupplyKg - suppliedThisSeasonKg),
    loyaltyLevel,
    isBulkSupplier: row.is_bulk_supplier,
  };
}

export async function getSeasonalSuppliers(startingCountry?: string): Promise<BuyMarketSupplierProfile[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId || !startingCountry) return [];

  const country = toCountryKey(startingCountry);
  const gameState = getGameState();
  const currentYear = gameState.currentYear ?? 2024;
  const currentSeason = gameState.season ?? 'Spring';
  const seasonalSupplierCount = await getSeasonalSupplierCountFromResearch();
  const eligibleCountries = await getUnlockedSupplierCountriesFromResearch(country);

  const { data: currentSeasonRowsRaw } = await getSeasonSupplierRowsForCountries(
    companyId,
    eligibleCountries,
    currentYear,
    currentSeason,
    BULK_SUPPLIER_ID,
    20
  );

  let seasonRows = (currentSeasonRowsRaw || []) as SupplierMarketRow[];
  const supplierOrigins = new Map<string, SupplierOriginTag>();

  for (const row of seasonRows) {
    supplierOrigins.set(row.supplier_id, 'seasonal_rotation');
  }

  if (seasonRows.length < seasonalSupplierCount) {
    const priorityProfiles = await getSupplierPriorityProfiles(16);
    const selectedRows: SupplierMarketRow[] = [];

    const { data: knownRowsRaw } = await getKnownSupplierRowsForCountries(companyId, eligibleCountries, BULK_SUPPLIER_ID, 50);
    const knownRows = (knownRowsRaw || []) as SupplierMarketRow[];

    for (const priority of priorityProfiles) {
      if (selectedRows.length >= seasonalSupplierCount) break;
      if (selectedRows.some((r) => r.supplier_id === priority.supplierId)) continue;
      const row = knownRows.find((r) => r.supplier_id === priority.supplierId);
      if (!row) continue;
      selectedRows.push(row);
      supplierOrigins.set(row.supplier_id, 'trusted_carryover');
    }

    while (selectedRows.length < seasonalSupplierCount) {
      const marketCountry = chooseMarketSupplierCountry(country, eligibleCountries);
      const created = await createMarketSupplier(companyId, marketCountry, currentYear, currentSeason);
      if (!created) break;
      selectedRows.push(created);
      supplierOrigins.set(created.supplier_id, 'seasonal_rotation');
    }

    for (const row of selectedRows) {
      await updateSupplierRow(companyId, row.supplier_id, {
        last_active_year: currentYear,
        last_active_season: currentSeason,
        supplied_this_season_kg: 0,
        updated_at: new Date().toISOString(),
      });
    }

    seasonRows = selectedRows;
  }

  const companyValue = await calculateCompanyValue().catch(() => 0);
  const priorityProfiles = await getSupplierPriorityProfiles(100);
  const loyaltyById = new Map(priorityProfiles.map((profile) => [profile.supplierId, profile.level]));

  return seasonRows.slice(0, seasonalSupplierCount).map((row) => rowToSupplierProfile(
    row,
    (loyaltyById.get(row.supplier_id) ?? 0) as SupplierLoyaltyLevel,
    companyValue,
    supplierOrigins.get(row.supplier_id) ?? 'seasonal_rotation'
  ));
}

export async function getBulkSupplier(startingCountry?: string): Promise<BuyMarketSupplierProfile | null> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return null;

  const country = toCountryKey(startingCountry);
  const gameState = getGameState();
  const currentYear = gameState.currentYear ?? 2024;
  const currentSeason = gameState.season ?? 'Spring';

  const row = await ensureBulkSupplier(companyId, country, currentYear, currentSeason);
  if (!row) return null;

  const companyValue = await calculateCompanyValue().catch(() => 0);
  const priorityProfiles = await getSupplierPriorityProfiles(100);
  const loyaltyById = new Map(priorityProfiles.map((profile) => [profile.supplierId, profile.level]));

  return rowToSupplierProfile(
    row,
    (loyaltyById.get(BULK_SUPPLIER_ID) ?? 0) as SupplierLoyaltyLevel,
    companyValue,
    'country_special'
  );
}

export async function recordMarketSupplierPurchase(
  supplierId: string,
  kgPurchased: number,
  currentYear: number,
  currentSeason: string
): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return;

  const { data } = await getSupplierSeasonStateRow(companyId, supplierId);
  if (!data) return;

  const sameSeason = data.last_active_year === currentYear && data.last_active_season === currentSeason;
  const suppliedThisSeasonKg = sameSeason ? (data.supplied_this_season_kg || 0) + kgPurchased : kgPurchased;

  await updateSupplierRow(companyId, supplierId, {
    supplied_this_season_kg: suppliedThisSeasonKg,
    last_active_year: currentYear,
    last_active_season: currentSeason,
    updated_at: new Date().toISOString(),
  });
}
