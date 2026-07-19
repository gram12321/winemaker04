import { describe, expect, it } from 'vitest';
import { activitiesFeature } from '@/lib/features/activities';

describe('activitiesFeature', () => {
  it('exposes the stable lifecycle, read, work, tick, setup, and UI seams', () => {
    expect(activitiesFeature.lifecycle.create).toBeTypeOf('function');
    expect(activitiesFeature.lifecycle.completeNow).toBeTypeOf('function');
    expect(activitiesFeature.reads.getAll).toBeTypeOf('function');
    expect(activitiesFeature.reads.getProgress).toBeTypeOf('function');
    expect(activitiesFeature.work.getPreview).toBeTypeOf('function');
    expect(activitiesFeature.ticks.progress).toBeTypeOf('function');
    expect(activitiesFeature.setup.initialize).toBeTypeOf('function');
    expect(activitiesFeature.ui.renderActivityPanel).toBeTypeOf('function');
  });
});
