import { describe, expect, it, vi } from 'vitest';
import type { Vineyard } from '@/lib/types/types';

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
    expect(context.week).toBe(1);
    expect(context.weatherState).toBeUndefined();
    expect(context.weatherIntensity).toBeUndefined();
  });

  it('builds rows only for planted vineyards, applies clamping, and sorts by combined delta', () => {
    const rows = buildVineyardWeatherRows(
      [
        vineyard({ id: 'v1', name: 'Top Row' }),
        vineyard({ id: 'v2', name: 'Bottom Row', ripeness: 0.01, vineyardHealth: 0.01 }),
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
    expect(rows[0].ripenessProjected).toBe(1);
    expect(rows[1].ripenessProjected).toBe(0);
    expect(rows[1].healthProjected).toBe(0);
  });

  it('summarizes weather impact and counts high-stress vineyards', () => {
    const summary = calculateWeatherImpactSummary([
      {
        id: 'v1',
        name: 'A',
        state: 'Growing',
        ripenessCurrent: 0.5,
        ripenessProjected: 0.51,
        ripenessDelta: 0.01,
        healthCurrent: 0.8,
        healthProjected: 0.797,
        healthDelta: -0.003,
        siteResponse: 1.1,
        reason: 'A',
        breakdown: {} as any,
      },
      {
        id: 'v2',
        name: 'B',
        state: 'Growing',
        ripenessCurrent: 0.5,
        ripenessProjected: 0.49,
        ripenessDelta: -0.01,
        healthCurrent: 0.8,
        healthProjected: 0.799,
        healthDelta: -0.001,
        siteResponse: 0.9,
        reason: 'B',
        breakdown: {} as any,
      },
    ]);

    expect(summary.avgRipenessDelta).toBeCloseTo(0, 6);
    expect(summary.avgHealthDelta).toBeCloseTo(-0.002, 6);
    expect(summary.highStressCount).toBe(1);
    expect(summary.avgSiteResponse).toBeCloseTo(1, 6);
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
