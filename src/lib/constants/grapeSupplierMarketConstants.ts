import type { Nationality } from '@/lib/types/types';

export const BASE_SEASONAL_SUPPLIER_COUNT = 3;
export const MAX_SEASONAL_SUPPLIER_COUNT = 7;
export const BULK_SUPPLIER_ID = 'bulk_supplier';
export const BULK_BASE_SEASON_SUPPLY_KG = 22000;

export type SupplierMarketCountryKey = Nationality;

export const SUPPLIER_MARKET_COUNTRY_KEYS: readonly SupplierMarketCountryKey[] = ['France', 'Germany', 'Italy', 'Spain', 'United States'];

export const COUNTRY_SUPPLIER_CONFIG: Record<SupplierMarketCountryKey, { min: number; max: number; baseSupplyMin: number; baseSupplyMax: number; title: string }> = {
  France: { min: 0.94, max: 1.16, baseSupplyMin: 1800, baseSupplyMax: 4600, title: 'Negoce Seller' },
  Germany: { min: 0.92, max: 1.14, baseSupplyMin: 1700, baseSupplyMax: 4400, title: 'Regional Traubenanbieter' },
  Italy: { min: 0.93, max: 1.15, baseSupplyMin: 1750, baseSupplyMax: 4500, title: 'Cantina Seller' },
  Spain: { min: 0.92, max: 1.14, baseSupplyMin: 1700, baseSupplyMax: 4300, title: 'Bodega Seller' },
  'United States': { min: 0.95, max: 1.17, baseSupplyMin: 1900, baseSupplyMax: 4700, title: 'Valley Grower Seller' },
};
