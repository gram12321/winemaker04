export type BuyGoodsSupplierRelationshipLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface BuyGoodsSupplierLevelConfig {
  name: string;
  minLoyaltyScore: number;
  priceMultiplier: number;
  persistenceBonus: number;
  benefits: string[];
}

export const BUY_GOODS_SUPPLIER_LEVELS: Record<BuyGoodsSupplierRelationshipLevel, BuyGoodsSupplierLevelConfig> = {
  0: { name: 'Unknown Seller', minLoyaltyScore: 0, priceMultiplier: 1, persistenceBonus: 0, benefits: [] },
  1: { name: 'Familiar Seller', minLoyaltyScore: 700, priceMultiplier: .99, persistenceBonus: .05, benefits: ['0.99x supplier relationship factor'] },
  2: { name: 'Known Seller', minLoyaltyScore: 2000, priceMultiplier: .98, persistenceBonus: .1, benefits: ['0.98x supplier relationship factor'] },
  3: { name: 'Trusted Supplier', minLoyaltyScore: 4600, priceMultiplier: .97, persistenceBonus: .15, benefits: ['0.97x supplier relationship factor'] },
  4: { name: 'Preferred Supplier', minLoyaltyScore: 8500, priceMultiplier: .95, persistenceBonus: .22, benefits: ['0.95x supplier relationship factor'] },
  5: { name: 'Strategic Supplier', minLoyaltyScore: 14000, priceMultiplier: .93, persistenceBonus: .3, benefits: ['0.93x supplier relationship factor'] },
};
