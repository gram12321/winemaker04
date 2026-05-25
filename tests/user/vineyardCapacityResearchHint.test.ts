import { describe, expect, it } from 'vitest';
import { getNextVineyardCapacityResearch } from '@/lib/services/vineyard/vineyardCapacityService';

describe('getNextVineyardCapacityResearch', () => {
  it('treats 0.5 hectares as the base cap and points to the next research tier', () => {
    const nextProject = getNextVineyardCapacityResearch('vineyard_size', 0.5);

    expect(nextProject?.id).toBe('eff_estate_foundations');
  });

  it('returns the next higher vineyard research tier for later caps', () => {
    const nextProject = getNextVineyardCapacityResearch('vineyard_size', 2);

    expect(nextProject?.id).toBe('eff_site_expansion');
  });

  it('returns the next total-area chain research from the base cap', () => {
    const nextProject = getNextVineyardCapacityResearch('total_vineyard_hectares', 1);

    expect(nextProject?.id).toBe('eff_total_estate_area_2');
  });

  it('returns the next vineyard-count chain research from the base count', () => {
    const nextProject = getNextVineyardCapacityResearch('vineyard_count', 1);

    expect(nextProject?.id).toBe('eff_vineyard_registry');
  });

  it('returns null when no higher vineyard cap research exists', () => {
    const nextProject = getNextVineyardCapacityResearch('vineyard_size', 2000);

    expect(nextProject).toBeNull();
  });
});