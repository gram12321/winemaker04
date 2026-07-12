import { describe, expect, it } from 'vitest';
import {
  buildWeatherCenterPresentation,
  buildVineyardWeatherTooltip,
  buildWeatherReference,
  createWeatherWeekContext,
} from '@/lib/features/weather';
import type { Vineyard } from '@/lib/types/types';

function vineyard(overrides: Partial<Vineyard> = {}): Vineyard {
  return {
    id: 'v-1', name: 'North Field', country: 'France', region: 'Bourgogne', hectares: 2,
    grape: 'Pinot Noir', vineAge: 8, soil: ['Limestone'], altitude: 300, aspect: 'South',
    density: 4500, vineyardHealth: 0.8, landValue: 100000, vineyardTotalValue: 100000,
    status: 'Growing', ripeness: 0.6, vineyardPrestige: 1, vineYield: 1, ...overrides,
  };
}

const weather = createWeatherWeekContext({
  currentYear: 2026, season: 'Summer', week: 5,
  weatherState: 'Clear', weatherIntensity: 'Mild', weatherForecastPattern: 'Heat',
  weatherForecastConfidence: 'High', nextWeekForecastState: 'Heat', nextWeekForecastIntensity: 'Severe',
});

describe('weather presentation service', () => {
  it('builds a compact center model with actual weather, correctly named forecast, outlooks, and vineyard rows', () => {
    const model = buildWeatherCenterPresentation({ companyId: 'company-1', weather, vineyards: [vineyard()] });

    expect(model.currentWeather.label).toBe('Current weather');
    expect(model.currentWeather.description).toContain('Clear');
    expect(model.forecast.label).toBe('Next-week forecast');
    expect(model.forecast.description).toContain('Heat');
    expect(model.forecast.confidence).toBe('High');
    expect(model.seasonalOutlook).toContain('Heat');
    expect(model.outlooks).toHaveLength(3);
    expect(model.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'North Field', siteNote: expect.any(String), explanation: expect.any(String) }),
    ]));
  });

  it('builds a concise vineyard tooltip with normal change, weather contribution, projection, and site note', () => {
    const model = buildVineyardWeatherTooltip({ companyId: 'company-1', vineyard: vineyard(), weather });

    expect(model.label).toBe('Next-week forecast');
    expect(model.weather).toContain('Heat');
    expect(model.ripeness).toEqual(expect.objectContaining({
      normalChange: expect.any(Number), weatherContribution: expect.any(Number), projected: expect.any(Number),
    }));
    expect(model.health).toEqual(expect.objectContaining({
      normalChange: expect.any(Number), weatherContribution: expect.any(Number), projected: expect.any(Number),
    }));
    expect(model.siteNote).toBeTruthy();
  });

  it('builds a complete Winepedia reference with all state and intensity matrices', () => {
    const reference = buildWeatherReference();

    expect(reference.formula).toContain('normal seasonal change');
    expect(reference.vineyardMatrix).toHaveLength(6);
    expect(reference.vineyardMatrix[0].intensities).toHaveLength(5);
    expect(reference.marketMatrix).toHaveLength(6);
    expect(reference.marketMatrix[0].intensities).toHaveLength(5);
    expect(reference.marketMatrix[0].intensities[0]).toEqual(expect.objectContaining({
      priceMultiplier: expect.any(Number), supplyMultiplier: expect.any(Number),
    }));
    expect(reference.siteRules).toBeTruthy();
    expect(reference.forecastBehavior).toBeTruthy();
    expect(reference.scope).toBeTruthy();
  });
});
