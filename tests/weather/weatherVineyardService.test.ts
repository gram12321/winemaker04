import { describe, expect, it } from 'vitest';
import { projectVineyardWeek, type VineyardWeekProjectionInput } from '@/lib/features/weather';
import type { Vineyard } from '@/lib/types/types';

const vineyard: Vineyard = {
  id: 'weather-vineyard',
  name: 'Weather Vineyard',
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

function buildInput(overrides: Partial<VineyardWeekProjectionInput> = {}): VineyardWeekProjectionInput {
  return {
    companyId: 'weather-company',
    vineyard,
    weather: {
      date: { year: 2026, season: 'Summer', week: 2 },
      state: 'Heat',
      intensity: 'Moderate',
      seasonalPattern: 'Heat',
      forecast: { state: 'Heat', intensity: 'Moderate', confidence: 'High' },
    },
    ...overrides,
  };
}

describe('projectVineyardWeek', () => {
  it('amplifies a normal ripeness-growth baseline with the current weather multiplier', () => {
    const projection = projectVineyardWeek(buildInput());

    expect(projection.ripeness.normalDelta).toBeGreaterThan(0);
    expect(projection.ripeness.finalDelta).toBeGreaterThan(projection.ripeness.normalDelta);
    expect(projection.ripeness.weatherContribution).toBeCloseTo(
      projection.ripeness.finalDelta - projection.ripeness.normalDelta,
      10,
    );
  });

  it('applies weather to the normal winter ripeness decline', () => {
    const projection = projectVineyardWeek(buildInput({
      vineyard: { ...vineyard, ripeness: 0.6, status: 'Dormant' },
      weather: {
        ...buildInput().weather,
        date: { year: 2026, season: 'Winter', week: 2 },
        state: 'Frost',
        intensity: 'Severe',
      },
    }));

    expect(projection.ripeness.normalDelta).toBeLessThan(0);
    expect(projection.ripeness.weatherContribution).not.toBe(0);
    expect(projection.ripeness.finalDelta).toBeCloseTo(
      projection.ripeness.normalDelta + projection.ripeness.weatherContribution,
      10,
    );
  });

  it('applies weather to normal health decline', () => {
    const projection = projectVineyardWeek(buildInput());

    expect(projection.health.normalDelta).toBeLessThan(0);
    expect(projection.health.weatherContribution).toBeLessThan(0);
    expect(projection.health.finalDelta).toBeLessThan(projection.health.normalDelta);
  });

  it('does not create movement when the seasonal baseline is zero', () => {
    const projection = projectVineyardWeek(buildInput({
      vineyard: { ...vineyard, ripeness: 0, vineyardHealth: 0.1, status: 'Dormant' },
      weather: {
        ...buildInput().weather,
        date: { year: 2026, season: 'Winter', week: 1 },
        state: 'Heat',
      },
    }));

    expect(projection.ripeness.normalDelta).toBe(0);
    expect(projection.ripeness.finalDelta).toBe(0);
    expect(projection.health.normalDelta).toBe(0);
    expect(projection.health.finalDelta).toBe(0);
  });

  it('bounds site exposure before applying weather', () => {
    const projection = projectVineyardWeek(buildInput({
      vineyard: {
        ...vineyard,
        aspect: 'South',
        altitude: 0,
        soil: ['Sand', 'Gravel', 'Slate', 'Schist', 'Sandy Loam'],
      },
    }));

    expect(projection.siteExposure).toBeGreaterThanOrEqual(0.7);
    expect(projection.siteExposure).toBeLessThanOrEqual(1.3);
  });

  it('returns concise amplified and buffered site notes', () => {
    const amplified = projectVineyardWeek(buildInput({
      vineyard: { ...vineyard, aspect: 'South', altitude: 0 },
    }));
    const buffered = projectVineyardWeek(buildInput({
      vineyard: { ...vineyard, aspect: 'North', altitude: 1000, soil: ['Clay', 'Limestone', 'Marl'] },
    }));

    expect(amplified.siteNote).toBe('Site amplifies this weather.');
    expect(buffered.siteNote).toBe('Site buffers this weather.');
  });

  it('scales normal ripeness growth by active planting progress before weather', () => {
    const fullPlanting = projectVineyardWeek(buildInput());
    const partialPlanting = projectVineyardWeek(buildInput({ plantingProgressRatio: 0.5 }));

    expect(partialPlanting.ripeness.normalDelta).toBeCloseTo(fullPlanting.ripeness.normalDelta * 0.5, 10);
    expect(partialPlanting.ripeness.finalDelta).toBeCloseTo(fullPlanting.ripeness.finalDelta * 0.5, 10);
  });

  it('applies the research health decay multiplier to the normal health baseline before weather', () => {
    const standard = projectVineyardWeek(buildInput());
    const researched = projectVineyardWeek(buildInput({ healthDecayMultiplier: 0.5 }));

    expect(researched.health.normalDelta).toBeCloseTo(standard.health.normalDelta * 0.5, 10);
    expect(researched.health.finalDelta).toBeCloseTo(standard.health.finalDelta * 0.5, 10);
  });
});
