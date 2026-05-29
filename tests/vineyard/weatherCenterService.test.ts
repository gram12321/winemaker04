import { describe, expect, it, vi } from 'vitest';
import type { Vineyard } from '@/lib/types/types';

vi.mock('@/lib/utils', () => ({
  clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
  clamp01: (value: number) => Math.max(0, Math.min(1, value)),
  deterministicSeasonalVariation: vi.fn((_seed: string, min: number, _max: number) => (min < 0 ? 0 : 1)),
}));

vi.mock('@/lib/services/vineyard/weatherImpactService', () => ({
  calculateVineyardWeatherImpact: vi.fn((vineyard: Vineyard) => {
    if (vineyard.id === 'v2') {
      return {
        ripenessDelta: -0.02,
        healthDelta: -0.02,
        siteResponse: 0.9,
        reason: 'Storm (Severe) with site buffered impact',
        breakdown: {
          weatherState: 'Storm',
          weatherIntensity: 'Severe',
          baseRipenessDeviation: -0.001,
          baseHealthDeviation: -0.001,
          adjustedBaseHealthDeviation: -0.001,
          seasonAdjustmentMultiplier: 1,
          aspectResponse: 1,
          altitudeResponse: 1,
          terroirResponse: 1,
          soilResponse: 1,
          soilResponseSource: 'neutral',
          siteResponseRaw: 0.9,
          siteResponseClamped: false,
          ripenessRawDelta: -0.02,
          ripenessClamped: true,
          healthRawDelta: -0.02,
          healthClamped: true,
        },
      };
    }

    return {
      ripenessDelta: 0.01,
      healthDelta: -0.003,
      siteResponse: 1.1,
      reason: 'Heat (Moderate) with site amplified impact',
      breakdown: {
        weatherState: 'Heat',
        weatherIntensity: 'Moderate',
        baseRipenessDeviation: 0.001,
        baseHealthDeviation: -0.001,
        adjustedBaseHealthDeviation: -0.001,
        seasonAdjustmentMultiplier: 1,
        aspectResponse: 1,
        altitudeResponse: 1,
        terroirResponse: 1,
        soilResponse: 1,
        soilResponseSource: 'neutral',
        siteResponseRaw: 1.1,
        siteResponseClamped: false,
        ripenessRawDelta: 0.01,
        ripenessClamped: false,
        healthRawDelta: -0.003,
        healthClamped: false,
      },
    };
  }),
}));

import {
  buildWeatherContext,
  buildVineyardWeatherRows,
  calculateWeatherImpactSummary,
  getImpactMeterWidth,
  getSoilResponseLabel,
} from '@/lib/services/vineyard/weatherCenterService';

function vineyard(overrides: Partial<Vineyard> = {}): Vineyard {
  return {
    id: 'v1',
    name: 'Alpha Vineyard',
    country: 'France',
    region: 'Bourgogne',
    hectares: 1,
    grape: 'Pinot Noir',
    vineAge: 10,
    soil: ['Limestone'],
    altitude: 250,
    aspect: 'East',
    density: 4500,
    vineyardHealth: 0.99,
    landValue: 100000,
    vineyardTotalValue: 100000,
    status: 'Growing',
    ripeness: 0.99,
    vineyardPrestige: 3,
    vineYield: 1,
    ...overrides,
  };
}

describe('weather center service', () => {
  it('builds weather context with defaults when game state fields are missing', () => {
    const context = buildWeatherContext({}, 'company-1');

    expect(context.companyId).toBe('company-1');
    expect(context.year).toBe(2024);
    expect(context.season).toBe('Spring');
    expect(context.week).toBe(2);
    expect(context.weatherState).toBeUndefined();
    expect(context.weatherIntensity).toBeUndefined();
  });

  it('builds rows with multiplier-scaled progression, applies clamping, and sorts by combined delta', () => {
    const rows = buildVineyardWeatherRows(
      [
        vineyard({ id: 'v1', name: 'Top Row' }),
        vineyard({ id: 'v2', name: 'Bottom Row', ripeness: 0.01, vineyardHealth: 0.2 }),
        vineyard({ id: 'v3', name: 'No Grapes', grape: null }),
      ],
      {
        companyId: 'company-1',
        year: 2026,
        season: 'Summer',
        week: 3,
        weatherState: 'Heat',
        weatherIntensity: 'Moderate',
      }
    );

    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.id)).toEqual(['v1', 'v2']);
    expect(rows[0].weatherState).toBe('Heat');
    expect(rows[0].weatherIntensity).toBe('Moderate');
    expect(rows[0].weatherStateImpact).toContain('supports ripening');
    expect(rows[0].weatherIntensityImpact).toContain('meaningful weather pressure');
    expect(rows[0].ripenessDelta).toBeCloseTo(0.02, 6);
    expect(rows[0].healthDelta).toBeCloseTo(-0.0078, 6);
    expect(rows[1].ripenessDelta).toBeCloseTo(0.005, 6);
    expect(rows[1].healthDelta).toBeCloseTo(-0.015, 6);
    expect(rows[0].ripenessProjected).toBe(1);
    expect(rows[1].ripenessProjected).toBeCloseTo(0.015, 6);
    expect(rows[1].healthProjected).toBeCloseTo(0.185, 6);
  });

  it('does not project ripeness growth for inactive vineyard statuses outside winter', () => {
    const rows = buildVineyardWeatherRows(
      [vineyard({ id: 'v-inactive', status: 'Dormant', ripeness: 0.06, vineyardHealth: 0.6 })],
      {
        companyId: 'company-1',
        year: 2026,
        season: 'Summer',
        week: 4,
        weatherState: 'Heat',
        weatherIntensity: 'Moderate',
      }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].ripenessNormalDelta).toBeCloseTo(0, 6);
    expect(rows[0].ripenessWeatherDelta).toBeCloseTo(0, 6);
    expect(rows[0].ripenessDelta).toBeCloseTo(0, 6);
    expect(rows[0].ripenessProjected).toBeCloseTo(0.06, 6);
  });

  it('summarizes weather impact and counts high-stress vineyards', () => {
    const summary = calculateWeatherImpactSummary([
      {
        id: 'v1',
        name: 'A',
        state: 'Growing',
        weatherState: 'Heat',
        weatherIntensity: 'Moderate',
        weatherStateImpact: 'Heat supports ripening and adds vine stress before site modifiers.',
        weatherIntensityImpact: 'Moderate intensity applies a meaningful weather pressure this week.',
        ripenessCurrent: 0.5,
        ripenessProjected: 0.51,
        ripenessNormalDelta: 0.01,
        ripenessWeatherDelta: 0,
        ripenessDelta: 0.01,
        healthCurrent: 0.8,
        healthProjected: 0.797,
        healthNormalDelta: -0.002,
        healthWeatherDelta: -0.001,
        healthDelta: -0.003,
        siteResponse: 1.1,
        reason: 'A',
        breakdown: {} as any,
      },
      {
        id: 'v2',
        name: 'B',
        state: 'Growing',
        weatherState: 'Storm',
        weatherIntensity: 'Severe',
        weatherStateImpact: 'Storm slows ripening and adds vine stress before site modifiers.',
        weatherIntensityImpact: 'Severe intensity applies the strongest weather pressure this week.',
        ripenessCurrent: 0.5,
        ripenessProjected: 0.49,
        ripenessNormalDelta: -0.005,
        ripenessWeatherDelta: -0.005,
        ripenessDelta: -0.01,
        healthCurrent: 0.8,
        healthProjected: 0.799,
        healthNormalDelta: -0.0005,
        healthWeatherDelta: -0.0005,
        healthDelta: -0.001,
        siteResponse: 0.9,
        reason: 'B',
        breakdown: {} as any,
      },
    ]);

    expect(summary.avgRipenessDelta).toBeCloseTo(0, 6);
    expect(summary.avgHealthDelta).toBeCloseTo(-0.002, 6);
    expect(summary.avgWeatherRipenessDelta).toBeCloseTo(-0.0025, 6);
    expect(summary.avgWeatherHealthDelta).toBeCloseTo(-0.00075, 6);
    expect(summary.highStressCount).toBe(1);
    expect(summary.avgSiteResponse).toBeCloseTo(1, 6);
    expect(summary.weatherSignalLabel).toBe('Stressful');
  });

  it('exposes helper labels and impact meter scaling boundaries', () => {
    expect(getImpactMeterWidth(0)).toBe(0);
    expect(getImpactMeterWidth(0.01)).toBe(100);
    expect(getImpactMeterWidth(-0.003)).toBe(36);

    expect(getSoilResponseLabel('waterRetention')).toBe('Water Retention');
    expect(getSoilResponseLabel('thermalSwing')).toBe('Thermal Swing');
    expect(getSoilResponseLabel('neutral')).toBe('Neutral');
  });
});
