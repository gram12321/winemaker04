export interface GlobalMarketSupplierDate {
  year: number;
  season: string;
  week: number;
}

/**
 * Domain adapters generate their own deterministic global inventory. The shared
 * seam coordinates generation and persistence without knowing goods-specific
 * names, prices, or state.
 */
export interface GlobalMarketSupplierAdapter<TListingInput> {
  generateListings(date: GlobalMarketSupplierDate): TListingInput[];
  persistListings(date: GlobalMarketSupplierDate, listings: TListingInput[]): Promise<void>;
}

export async function ensureGlobalMarketSupplierListings<TListingInput>(
  adapter: GlobalMarketSupplierAdapter<TListingInput>,
  date: GlobalMarketSupplierDate,
): Promise<void> {
  await adapter.persistListings(date, adapter.generateListings(date));
}
