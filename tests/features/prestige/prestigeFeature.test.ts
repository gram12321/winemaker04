import { describe, expect, it } from 'vitest';
import { prestigeFeature } from '@/lib/features/prestige';

describe('prestigeFeature public seam', () => {
  it('exposes intent-level Prestige operations without a ledger adapter', () => {
    expect(prestigeFeature).toEqual(expect.objectContaining({
      lifecycle: expect.objectContaining({ initialize: expect.any(Function) }),
      reads: expect.objectContaining({ calculateCurrent: expect.any(Function) }),
      events: expect.objectContaining({
        addSale: expect.any(Function),
        addResearch: expect.any(Function),
        recordFinancePenalty: expect.any(Function),
        recordAchievement: expect.any(Function),
        recordStartingCondition: expect.any(Function),
      }),
      calculations: expect.objectContaining({ boundedVineyardFactor: expect.any(Function) }),
      ui: expect.objectContaining({ renderModal: expect.any(Function) }),
    }));

    expect(prestigeFeature).not.toHaveProperty('ledger');
    expect(prestigeFeature).not.toHaveProperty('decay');
  });
});
