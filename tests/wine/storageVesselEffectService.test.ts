import { describe, expect, it } from 'vitest';
import { applyStorageVesselEffects } from '@/lib/services/wine/winery/storageVesselEffectService';
import type { WineBatch } from '@/lib/types/types';

describe('Storage Vessel effect seam', () => {
  it('does not change wine before an explicit vessel-effect policy is approved', () => {
    const batch = { id: 'batch-1', tasteQualityIndex: 0.61, structureIndex: 0.57, estimatedPrice: 31 } as unknown as WineBatch;
    expect(applyStorageVesselEffects(batch)).toBe(batch);
    expect(batch).toMatchObject({ tasteQualityIndex: 0.61, structureIndex: 0.57, estimatedPrice: 31 });
  });
});
