import { GAME_INITIALIZATION } from '@/lib/constants';
import { type GameState, type Vineyard } from '@/lib/types/types';
import { calculateVineyardWeatherImpact, type VineyardWeatherContext, type VineyardWeatherImpactBreakdown } from './weatherImpactService';

const WEATHER_CENTER_HEALTH_STRESS_THRESHOLD = -0.0025;
const WEATHER_CENTER_IMPACT_METER_SCALE = 12000;

export interface VineyardWeatherRow {
  id: string;
  name: string;
  state: string;
  ripenessDelta: number;
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
  return {
    companyId,
    year: gameState.currentYear || GAME_INITIALIZATION.STARTING_YEAR,
    season: gameState.season || GAME_INITIALIZATION.STARTING_SEASON,
    week: gameState.week || GAME_INITIALIZATION.STARTING_WEEK,
    weatherState: gameState.weatherState,
    weatherIntensity: gameState.weatherIntensity,
  };
}

export function buildVineyardWeatherRows(vineyards: Vineyard[], weatherContext: VineyardWeatherContext): VineyardWeatherRow[] {
  return vineyards
    .filter((vineyard) => vineyard.grape)
    .map((vineyard) => {
      const impact = calculateVineyardWeatherImpact(vineyard, weatherContext);
      return {
        id: vineyard.id,
        name: vineyard.name,
        state: vineyard.status,
        ripenessDelta: impact.ripenessDelta,
        healthDelta: impact.healthDelta,
        siteResponse: impact.siteResponse,
        reason: impact.reason,
        breakdown: impact.breakdown,
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
