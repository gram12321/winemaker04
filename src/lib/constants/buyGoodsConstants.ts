export type BuyMarketCounterpartyRelationshipLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface BuyMarketCounterpartyLevelConfig {
  name: string;
  minLoyaltyScore: number;
  priceMultiplier: number;
  persistenceBonus: number;
  benefits: string[];
}

export const BUY_MARKET_COUNTERPARTY_LEVELS: Record<BuyMarketCounterpartyRelationshipLevel, BuyMarketCounterpartyLevelConfig> = {
  0: { name: 'Unknown Seller', minLoyaltyScore: 0, priceMultiplier: 1, persistenceBonus: 0, benefits: [] },
  1: { name: 'Familiar Seller', minLoyaltyScore: 700, priceMultiplier: .99, persistenceBonus: .05, benefits: ['0.99x market relationship factor'] },
  2: { name: 'Known Seller', minLoyaltyScore: 2000, priceMultiplier: .98, persistenceBonus: .1, benefits: ['0.98x market relationship factor'] },
  3: { name: 'Trusted Seller', minLoyaltyScore: 4600, priceMultiplier: .97, persistenceBonus: .15, benefits: ['0.97x market relationship factor'] },
  4: { name: 'Preferred Seller', minLoyaltyScore: 8500, priceMultiplier: .95, persistenceBonus: .22, benefits: ['0.95x market relationship factor'] },
  5: { name: 'Strategic Partner', minLoyaltyScore: 14000, priceMultiplier: .93, persistenceBonus: .3, benefits: ['0.93x market relationship factor'] },
};

export const BUY_MARKET_RELATIONSHIP_POINTS_PER_CURRENCY = 0.25;
export const BUY_MARKET_RELATIONSHIP_YEARLY_CAP_BASE = 2_600;
export const BUY_MARKET_RELATIONSHIP_YEARLY_CAP_MAX_MULTIPLIER = 1.7;
export const BUY_MARKET_RELATIONSHIP_YEARLY_CAP_VALUE_FLOOR = 50_000;
export const BUY_MARKET_RELATIONSHIP_YEARLY_CAP_VALUE_LOG_OFFSET = 4.7;
export const BUY_MARKET_RELATIONSHIP_YEARLY_CAP_VALUE_SCALE = 0.22;
