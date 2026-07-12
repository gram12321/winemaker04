import { describe, expect, it } from 'vitest';
import {
  resolveWeatherOperationImpact,
  type ResolveWeatherOperationImpactInput,
} from '@/lib/features/weather';

function buildInput(overrides: Partial<ResolveWeatherOperationImpactInput> = {}): ResolveWeatherOperationImpactInput {
  return {
    weather: {
      date: { year: 2026, season: 'Spring', week: 2 },
      state: 'Clear',
      intensity: 'Mild',
      seasonalPattern: 'Stable',
      forecast: { state: 'Clear', intensity: 'Mild', confidence: 'High' },
    },
    operation: 'planting',
    season: 'Spring',
    ...overrides,
  };
}

describe('resolveWeatherOperationImpact', () => {
  it('disallows planting in Winter', () => {
    const impact = resolveWeatherOperationImpact(buildInput({ season: 'Winter' }));

    expect(impact).toMatchObject({
      allowed: false,
      workMultiplier: 0,
      paused: false,
      severity: 'blocked',
    });
    expect(impact.reason).toBe('Planting is unavailable in Winter.');
  });

  it('allows planting and harvesting at normal speed in ordinary conditions', () => {
    const planting = resolveWeatherOperationImpact(buildInput());
    const harvesting = resolveWeatherOperationImpact(buildInput({ operation: 'harvesting' }));

    expect(planting).toMatchObject({ allowed: true, workMultiplier: 1, paused: false, severity: 'normal' });
    expect(harvesting).toMatchObject({ allowed: true, workMultiplier: 1, paused: false, severity: 'normal' });
  });

  it('slows outdoor work during severe weather', () => {
    const impact = resolveWeatherOperationImpact(buildInput({
      weather: { ...buildInput().weather, state: 'Rain', intensity: 'Severe' },
    }));

    expect(impact).toMatchObject({ allowed: true, workMultiplier: 0.6, paused: false, severity: 'slowed' });
    expect(impact.reason).toBe('Severe Rain slows outdoor work.');
  });

  it('pauses work for extreme storm conditions without disallowing the operation', () => {
    const impact = resolveWeatherOperationImpact(buildInput({
      weather: { ...buildInput().weather, state: 'Storm', intensity: 'Extreme' },
    }));

    expect(impact).toMatchObject({ allowed: true, workMultiplier: 0, paused: true, severity: 'paused' });
    expect(impact.reason).toBe('Extreme Storm pauses outdoor work this week.');
  });

  it('keeps harvesting soft-limited during extreme heat', () => {
    const impact = resolveWeatherOperationImpact(buildInput({
      operation: 'harvesting',
      weather: { ...buildInput().weather, state: 'Heat', intensity: 'Extreme' },
    }));

    expect(impact).toMatchObject({ allowed: true, workMultiplier: 0.35, paused: false, severity: 'slowed' });
    expect(impact.reason).toBe('Extreme Heat slows outdoor work.');
  });
});
