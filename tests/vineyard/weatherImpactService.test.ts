import { describe, expect, it } from 'vitest';
import { calculateVineyardWeatherImpact, type VineyardWeatherContext } from '@/lib/services/vineyard/weatherImpactService';
import { type Vineyard } from '@/lib/types/types';

const baseVineyard: Vineyard = {
  id: 'weather-test-vineyard',
  name: 'Weather Test Vineyard',
  country: 'Italy',
  region: 'Tuscany',
  hectares: 2,
  grape: null,
  vineAge: 6,
  soil: [],
  altitude: 300,
  aspect: 'East',
  density: 4500,
  vineyardHealth: 0.9,
  landValue: 70000,
  vineyardTotalValue: 140000,
  status: 'Growing',
  ripeness: 0.6,
  vineyardPrestige: 20,
  vineYield: 0.95,
};

function buildContext(overrides: Partial<VineyardWeatherContext> = {}): VineyardWeatherContext {
  return {
    companyId: 'company-1',
    year: 2026,
    season: 'Spring',
    week: 1,
    ...overrides,
  };
}

describe('weatherImpactService', () => {
  it('uses clear/mild defaults when weather fields are missing', () => {
    const impact = calculateVineyardWeatherImpact(baseVineyard, buildContext());

    expect(impact.breakdown.weatherState).toBe('Clear');
    expect(impact.breakdown.weatherIntensity).toBe('Mild');
    expect(impact.siteResponse).toBeCloseTo(1, 6);
    expect(impact.ripenessDelta).toBeCloseTo(0.001, 6);
    expect(impact.healthDelta).toBeCloseTo(0.0003, 6);
    expect(impact.reason).toContain('site-neutral impact');
  });

  it('reduces snow health pressure during winter dormancy', () => {
    const winterImpact = calculateVineyardWeatherImpact(
      baseVineyard,
      buildContext({ season: 'Winter', weatherState: 'Snow', weatherIntensity: 'Severe' })
    );

    const springImpact = calculateVineyardWeatherImpact(
      baseVineyard,
      buildContext({ season: 'Spring', weatherState: 'Snow', weatherIntensity: 'Severe' })
    );

    expect(winterImpact.breakdown.seasonAdjustmentMultiplier).toBe(0.6);
    expect(springImpact.breakdown.seasonAdjustmentMultiplier).toBe(1);
    expect(Math.abs(winterImpact.healthDelta)).toBeLessThan(Math.abs(springImpact.healthDelta));
  });

  it('switches soil response source by weather state family', () => {
    const soilVineyard: Vineyard = {
      ...baseVineyard,
      soil: ['Clay', 'Limestone'],
    };

    const rainImpact = calculateVineyardWeatherImpact(
      soilVineyard,
      buildContext({ weatherState: 'Rain', weatherIntensity: 'Moderate' })
    );

    const heatImpact = calculateVineyardWeatherImpact(
      soilVineyard,
      buildContext({ weatherState: 'Heat', weatherIntensity: 'Moderate' })
    );

    expect(rainImpact.breakdown.soilResponseSource).toBe('waterRetention');
    expect(heatImpact.breakdown.soilResponseSource).toBe('thermalSwing');
  });

  it('labels amplified and buffered site pressure correctly', () => {
    const amplifiedVineyard: Vineyard = {
      ...baseVineyard,
      aspect: 'South',
      altitude: 0,
      soil: ['Sand', 'Gravel', 'Slate', 'Schist', 'Sandy Loam'],
    };

    const bufferedVineyard: Vineyard = {
      ...baseVineyard,
      aspect: 'North',
      altitude: 1000,
      soil: ['Clay', 'Limestone', 'Marl'],
    };

    const amplified = calculateVineyardWeatherImpact(
      amplifiedVineyard,
      buildContext({ weatherState: 'Heat', weatherIntensity: 'Severe' })
    );

    const buffered = calculateVineyardWeatherImpact(
      bufferedVineyard,
      buildContext({ weatherState: 'Heat', weatherIntensity: 'Severe' })
    );

    expect(amplified.siteResponse).toBeGreaterThan(1.03);
    expect(amplified.reason).toContain('site amplified impact');
    expect(buffered.siteResponse).toBeLessThan(0.97);
    expect(buffered.reason).toContain('site buffered impact');
  });
});
