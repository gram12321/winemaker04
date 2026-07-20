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
  /** Stable registration metadata; generation remains domain-owned. */
  id?: string;
  wareGroup?: import('@/lib/types/market').BuyMarketWareGroup;
  generateListings(date: GlobalMarketSupplierDate): TListingInput[] | Promise<TListingInput[]>;
  persistListings(date: GlobalMarketSupplierDate, listings: TListingInput[]): Promise<void>;
}

const globalMarketSupplierAdapters: GlobalMarketSupplierAdapter<unknown>[] = [];

export function registerGlobalMarketSupplierAdapter<TListingInput>(adapter: GlobalMarketSupplierAdapter<TListingInput>): void {
  if (adapter.id && globalMarketSupplierAdapters.some((registered) => registered.id === adapter.id)) return;
  globalMarketSupplierAdapters.push(adapter as GlobalMarketSupplierAdapter<unknown>);
}

export async function ensureRegisteredGlobalMarketSupplierListings(date: GlobalMarketSupplierDate): Promise<void> {
  await Promise.all(globalMarketSupplierAdapters.map((adapter) => ensureGlobalMarketSupplierListings(adapter, date)));
}

export async function ensureGlobalMarketSupplierListings<TListingInput>(
  adapter: GlobalMarketSupplierAdapter<TListingInput>,
  date: GlobalMarketSupplierDate,
): Promise<void> {
  await adapter.persistListings(date, await adapter.generateListings(date));
}
