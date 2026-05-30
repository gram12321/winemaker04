import { type GameState, type Vineyard } from '@/lib/types/types';
import { getNextTickDate } from '../core/gameState';
import { type VineyardWeatherContext, type VineyardWeatherImpactBreakdown } from './weatherImpactService';
import { calculateVineyardWeeklyProjection } from './vineyardProgressionService';

const WEATHER_CENTER_HEALTH_STRESS_THRESHOLD = -0.0025;
const WEATHER_CENTER_IMPACT_METER_SCALE = 12000;

export interface VineyardWeatherRow {
  id: string;
  name: string;
  state: string;
  weatherState: VineyardWeatherImpactBreakdown['weatherState'];
  weatherIntensity: VineyardWeatherImpactBreakdown['weatherIntensity'];
  weatherStateImpact: string;
  weatherIntensityImpact: string;
  ripenessCurrent: number;
  ripenessProjected: number;
  ripenessNormalDelta: number;
  ripenessWeatherDelta: number;
  ripenessDelta: number;
  healthCurrent: number;
  healthProjected: number;
  healthNormalDelta: number;
  healthWeatherDelta: number;
  healthDelta: number;
  siteResponse: number;
  reason: string;
  breakdown: VineyardWeatherImpactBreakdown;
}

export interface WeatherImpactSummary {
  avgRipenessDelta: number;
  avgHealthDelta: number;
  avgWeatherRipenessDelta: number;
  avgWeatherHealthDelta: number;
  highStressCount: number;
  avgSiteResponse: number;
  weatherSignalLabel: 'Supportive' | 'Mixed' | 'Stressful';
  weatherSignalDetail: string;
}

function describeWeatherStateImpact(
  weatherState: VineyardWeatherImpactBreakdown['weatherState'],
  weatherStateFactorRipeness: number,
  weatherStateFactorHealth: number
): string {
  const ripenessDirection = weatherStateFactorRipeness > 0 ? 'supports ripening' : weatherStateFactorRipeness < 0 ? 'slows ripening' : 'neutral for ripening';
  const healthDirection = weatherStateFactorHealth > 0 ? 'supports vine health' : weatherStateFactorHealth < 0 ? 'adds vine stress' : 'neutral for vine health';
  return `${weatherState} ${ripenessDirection} and ${healthDirection} before site modifiers.`;
}

function describeWeatherIntensityImpact(
  weatherIntensity: VineyardWeatherImpactBreakdown['weatherIntensity'],
  weatherIntensityFactor: number
): string {
  if (weatherIntensity === 'Extreme') {
    return `Extreme intensity applies the highest weather pressure (${weatherIntensityFactor.toFixed(2)}x).`;
  }
  if (weatherIntensity === 'Severe') {
    return `Severe intensity applies the strongest weather pressure (${weatherIntensityFactor.toFixed(2)}x).`;
  }
  if (weatherIntensity === 'Moderate') {
    return `Moderate intensity is the baseline weather pressure (${weatherIntensityFactor.toFixed(2)}x).`;
  }
  if (weatherIntensity === 'Mild') {
    return `Mild intensity applies lighter weather pressure (${weatherIntensityFactor.toFixed(2)}x).`;
  }
  if (weatherIntensity === 'VeryMild') {
    return `Very mild intensity applies the lightest weather pressure (${weatherIntensityFactor.toFixed(2)}x).`;
  }
  return `Mild intensity applies a lighter weather pressure (${weatherIntensityFactor.toFixed(2)}x).`;
}

function getWeatherSignal(
  avgWeatherRipenessDelta: number,
  avgWeatherHealthDelta: number
): Pick<WeatherImpactSummary, 'weatherSignalLabel' | 'weatherSignalDetail'> {
  const ripenessPositive = avgWeatherRipenessDelta > 0.0002;
  const ripenessNegative = avgWeatherRipenessDelta < -0.0002;
  const healthSupportive = avgWeatherHealthDelta > 0.0002;
  const healthStress = avgWeatherHealthDelta < -0.0002;

  if ((ripenessPositive || avgWeatherRipenessDelta >= 0) && (healthSupportive || avgWeatherHealthDelta >= 0)) {
    return {
      weatherSignalLabel: 'Supportive',
      weatherSignalDetail: 'Weather is helping baseline progression overall.',
    };
  }

  if (ripenessNegative && healthStress) {
    return {
      weatherSignalLabel: 'Stressful',
      weatherSignalDetail: 'Weather is pushing both slower ripening and higher vine stress.',
    };
  }

  return {
    weatherSignalLabel: 'Mixed',
    weatherSignalDetail: 'Weather helps one side of progression while pressuring the other.',
  };
}

export function buildWeatherContext(gameState: Partial<GameState>, companyId: string): VineyardWeatherContext {
  const nextTickDate = getNextTickDate(gameState);

  return {
    companyId,
    year: nextTickDate.year,
    season: nextTickDate.season,
    week: nextTickDate.week,
    weatherState: gameState.nextWeekForecastState || gameState.weatherState,
    weatherIntensity: gameState.nextWeekForecastIntensity || gameState.weatherIntensity,
  };
}

export function buildVineyardWeatherRows(vineyards: Vineyard[], weatherContext: VineyardWeatherContext): VineyardWeatherRow[] {
  return vineyards
    .filter((vineyard) => vineyard.grape)
    .map((vineyard) => {
      const projection = calculateVineyardWeeklyProjection(vineyard, weatherContext);

      return {
        id: vineyard.id,
        name: vineyard.name,
        state: vineyard.status,
        weatherState: projection.breakdown.weatherState,
        weatherIntensity: projection.breakdown.weatherIntensity,
        weatherStateImpact: describeWeatherStateImpact(
          projection.breakdown.weatherState,
          projection.breakdown.weatherStateFactorRipeness,
          projection.breakdown.weatherStateFactorHealth
        ),
        weatherIntensityImpact: describeWeatherIntensityImpact(
          projection.breakdown.weatherIntensity,
          projection.breakdown.weatherIntensityFactor
        ),
        ripenessCurrent: projection.ripeness.current,
        ripenessProjected: projection.ripeness.projected,
        ripenessNormalDelta: projection.ripeness.normalDelta,
        ripenessWeatherDelta: projection.ripeness.weatherDelta,
        ripenessDelta: projection.ripeness.totalDelta,
        healthCurrent: projection.health.current,
        healthProjected: projection.health.projected,
        healthNormalDelta: projection.health.normalDelta,
        healthWeatherDelta: projection.health.weatherDelta,
        healthDelta: projection.health.totalDelta,
        siteResponse: projection.siteResponse,
        reason: projection.reason,
        breakdown: projection.breakdown,
      };
    })
    .sort((left, right) => (right.ripenessDelta + right.healthDelta) - (left.ripenessDelta + left.healthDelta));
}

export function calculateWeatherImpactSummary(vineyardRows: VineyardWeatherRow[]): WeatherImpactSummary {
  if (vineyardRows.length === 0) {
    return {
      avgRipenessDelta: 0,
      avgHealthDelta: 0,
      avgWeatherRipenessDelta: 0,
      avgWeatherHealthDelta: 0,
      highStressCount: 0,
      avgSiteResponse: 1,
      weatherSignalLabel: 'Mixed',
      weatherSignalDetail: 'No planted vineyards available for weather signal.',
    };
  }

  const totals = vineyardRows.reduce((acc, row) => {
    acc.ripeness += row.ripenessDelta;
    acc.health += row.healthDelta;
    acc.ripenessWeather += row.ripenessWeatherDelta;
    acc.healthWeather += row.healthWeatherDelta;
    acc.site += row.siteResponse;
    if (row.healthDelta < WEATHER_CENTER_HEALTH_STRESS_THRESHOLD) {
      acc.highStress += 1;
    }
    return acc;
  }, { ripeness: 0, health: 0, ripenessWeather: 0, healthWeather: 0, site: 0, highStress: 0 });

  const avgWeatherRipenessDelta = totals.ripenessWeather / vineyardRows.length;
  const avgWeatherHealthDelta = totals.healthWeather / vineyardRows.length;
  const weatherSignal = getWeatherSignal(avgWeatherRipenessDelta, avgWeatherHealthDelta);

  return {
    avgRipenessDelta: totals.ripeness / vineyardRows.length,
    avgHealthDelta: totals.health / vineyardRows.length,
    avgWeatherRipenessDelta,
    avgWeatherHealthDelta,
    highStressCount: totals.highStress,
    avgSiteResponse: totals.site / vineyardRows.length,
    weatherSignalLabel: weatherSignal.weatherSignalLabel,
    weatherSignalDetail: weatherSignal.weatherSignalDetail,
  };
}

export function getImpactMeterWidth(value: number): number {
  return Math.min(100, Math.abs(value) * WEATHER_CENTER_IMPACT_METER_SCALE);
}

export function getSoilResponseLabel(source: 'waterRetention' | 'thermalSwing' | 'neutral'): string {
  if (source === 'waterRetention') return 'Water Retention';
  if (source === 'thermalSwing') return 'Thermal Swing';
  return 'Neutral';
}
