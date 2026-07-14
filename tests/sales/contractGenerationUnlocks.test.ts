import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer } from '@/lib/types/types';
import { getContractGenerationChance } from '@/lib/services/sales/contractGenerationService';

const mocks = vi.hoisted(() => ({
  getAllCustomers: vi.fn(async (): Promise<Customer[]> => []),
  getPendingContracts: vi.fn(async () => []),
  getCurrentPrestige: vi.fn(async () => 10000),
  getUnlockedItems: vi.fn(async () => [] as string[]),
}));

vi.mock('@/lib/services/sales/createCustomer', () => ({
  getAllCustomers: mocks.getAllCustomers,
}));

vi.mock('@/lib/database/sales/contractDB', () => ({
  getPendingContracts: mocks.getPendingContracts,
  saveWineContract: vi.fn(async () => true),
}));

vi.mock('@/lib/services/core/gameState', () => {
  return {
    getCurrentPrestige: mocks.getCurrentPrestige,
    getGameState: vi.fn(() => ({
      week: 1,
      season: 'Spring',
      currentYear: 2026,
    })),
  };
});

vi.mock('@/lib/features/researchUpgrade/services/research/researchEnforcer', () => ({
  researchEnforcer: {
    getUnlockedItems: mocks.getUnlockedItems,
  },
}));

vi.mock('@/lib/features/researchUpgrade', () => ({
  researchUpgradeFeature: {
    unlocks: {
      getUnlockedItems: mocks.getUnlockedItems
    }
  }
}));

function customer(type: Customer['customerType'], id: string): Customer {
  return {
    id,
    name: `${type} ${id}`,
    country: 'France',
    customerType: type,
    purchasingPower: 0.9,
    wineTradition: 0.9,
    marketShare: 0.7,
    priceMultiplier: 1.2,
    relationship: 100,
    activeCustomer: true,
  };
}

describe('contract generation unlock filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentPrestige.mockResolvedValue(10000);
    mocks.getPendingContracts.mockResolvedValue([]);
    mocks.getAllCustomers.mockResolvedValue([
      customer('Wine Shop', 'w1'),
      customer('Restaurant', 'r1'),
      customer('Private Collector', 'p1'),
      customer('Chain Store', 'c1'),
    ]);
    mocks.getUnlockedItems.mockResolvedValue([]);
  });

  it('keeps Wine Shop baseline unlocked and filters locked contract customer types', async () => {
    const chance = await getContractGenerationChance();

    expect(chance.customerTypeBreakdown['Wine Shop'].total).toBe(1);
    expect(chance.customerTypeBreakdown['Restaurant'].total).toBe(0);
    expect(chance.customerTypeBreakdown['Private Collector'].total).toBe(0);
    expect(chance.customerTypeBreakdown['Chain Store'].total).toBe(0);
  });

  it('includes newly unlocked customer contract channels from research', async () => {
    mocks.getUnlockedItems.mockResolvedValue(['restaurant', 'chain_store']);

    const chance = await getContractGenerationChance();

    expect(chance.customerTypeBreakdown['Wine Shop'].total).toBe(1);
    expect(chance.customerTypeBreakdown['Restaurant'].total).toBe(1);
    expect(chance.customerTypeBreakdown['Chain Store'].total).toBe(1);
    expect(chance.customerTypeBreakdown['Private Collector'].total).toBe(0);
  });
});
