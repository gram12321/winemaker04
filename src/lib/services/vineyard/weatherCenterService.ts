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
  highStressCount: number;
  avgSiteResponse: number;
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
      highStressCount: 0,
      avgSiteResponse: 1,
    };
  }

  const totals = vineyardRows.reduce((acc, row) => {
    acc.ripeness += row.ripenessDelta;
    acc.health += row.healthDelta;
    acc.site += row.siteResponse;
    if (row.healthDelta < WEATHER_CENTER_HEALTH_STRESS_THRESHOLD) {
      acc.highStress += 1;
    }
    return acc;
  }, { ripeness: 0, health: 0, site: 0, highStress: 0 });

  return {
    avgRipenessDelta: totals.ripeness / vineyardRows.length,
    avgHealthDelta: totals.health / vineyardRows.length,
    highStressCount: totals.highStress,
    avgSiteResponse: totals.site / vineyardRows.length,
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
