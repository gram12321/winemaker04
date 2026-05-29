import { useGameState } from '@/hooks';
import {
  BUYER_WEATHER_VOLATILITY_PRESSURE,
  WEATHER_INTENSITY_MULTIPLIER,
} from '@/lib/services/sales/grapeBuyerMarketService';
import {
  WEATHER_HEALTH_DEVIATION_BY_STATE_INTENSITY,
  WEATHER_RIPENESS_DEVIATION_BY_STATE_INTENSITY,
} from '@/lib/services/vineyard/weatherImpactService';
import {
  type WeatherForecastConfidence,
  type WeatherIntensity,
  type WeatherState,
} from '@/lib/types/types';
import { getWeatherIcon } from '@/lib/services';
import { formatSigned } from '@/lib/utils';

const FORECAST_HIT_RATE_BY_CONFIDENCE: Record<WeatherForecastConfidence, string> = {
  High: '88%',
  Medium: '78%',
  Low: '66%',
};

const WEATHER_STATES: WeatherState[] = ['Clear', 'Rain', 'Heat', 'Frost', 'Storm', 'Snow'];
const WEATHER_INTENSITIES: WeatherIntensity[] = ['Mild', 'Moderate', 'Severe'];

function getAspectAltitudeTrigger(state: WeatherState): string {
  if (state === 'Heat' || state === 'Frost' || state === 'Snow') {
    return 'Active';
  }
  return 'Neutral (x1)';
}

function getSoilResponseMode(state: WeatherState): string {
  if (state === 'Rain' || state === 'Snow') return 'Water retention';
  if (state === 'Heat' || state === 'Frost') return 'Thermal swing';
  return 'Neutral (x1)';
}

function getSeasonNote(state: WeatherState): string {
  if (state === 'Snow') return 'Winter applies special health softening (0.6x).';
  return 'No season-only weather override.';
}

export function WeatherTab() {
  const gameState = useGameState();

  return (
    <div className="space-y-3 text-sm">
      <p>
        Weather is a global top-level mechanic that runs in parallel with economy phases.
        It provides a seasonal forecast, weekly realized weather, and a week-ahead forecast.
      </p>

      <div className="space-y-1 rounded border border-sky-800/40 bg-sky-950/20 p-3">
        <p className="font-medium">Current Weather Snapshot</p>
        <p>
          Now: <strong>{getWeatherIcon(gameState.weatherState as WeatherState)} {gameState.weatherState || 'Clear'}</strong>
          {' '}({gameState.weatherIntensity || 'Mild'})
        </p>
        <p>
          Week-ahead: <strong>{getWeatherIcon(gameState.nextWeekForecastState as WeatherState)} {gameState.nextWeekForecastState || 'Clear'}</strong>
          {' '}({gameState.nextWeekForecastIntensity || 'Mild'})
        </p>
        <p>
          Seasonal forecast: <strong>{gameState.weatherForecastPattern || 'Stable'}</strong>
          {' '}with <strong>{gameState.weatherForecastConfidence || 'Medium'}</strong> confidence
        </p>
      </div>

      <div>
        <p className="font-medium mb-1">Forecast Reliability (Week-ahead)</p>
        <div className="overflow-x-auto max-w-2xl mx-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">Confidence</th>
                <th className="py-1 pr-2">Typical Hit Rate</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(FORECAST_HIT_RATE_BY_CONFIDENCE) as WeatherForecastConfidence[]).map((confidence) => (
                <tr key={confidence} className="border-b">
                  <td className="py-1 pr-2 font-medium">{confidence}</td>
                  <td className="py-1 pr-2">{FORECAST_HIT_RATE_BY_CONFIDENCE[confidence]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Site Modifier Trigger Matrix</p>
        <p className="text-xs text-gray-400 mb-2">
          Why Aspect/Altitude/Soil can show x1 in Weather Center: only some weather states activate those responses.
        </p>
        <div className="overflow-x-auto max-w-5xl mx-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">Weather State</th>
                <th className="py-1 pr-2">Aspect Response</th>
                <th className="py-1 pr-2">Altitude Response</th>
                <th className="py-1 pr-2">Soil Mode</th>
                <th className="py-1 pr-2">Season Interaction</th>
              </tr>
            </thead>
            <tbody>
              {WEATHER_STATES.map((state) => (
                <tr key={state} className="border-b">
                  <td className="py-1 pr-2 font-medium">{getWeatherIcon(state)} {state}</td>
                  <td className="py-1 pr-2">{getAspectAltitudeTrigger(state)}</td>
                  <td className="py-1 pr-2">{getAspectAltitudeTrigger(state)}</td>
                  <td className="py-1 pr-2">{getSoilResponseMode(state)}</td>
                  <td className="py-1 pr-2">{getSeasonNote(state)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Base Vineyard Delta Matrix (State + Intensity)</p>
        <p className="text-xs text-gray-400 mb-2">
          Each cell is base Ripeness Î” / base Health Î” before site modifiers and progression scaling.
        </p>
        <div className="overflow-x-auto max-w-5xl mx-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">State</th>
                {WEATHER_INTENSITIES.map((intensity) => (
                  <th key={intensity} className="py-1 pr-2">{intensity}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEATHER_STATES.map((state) => (
                <tr key={state} className="border-b">
                  <td className="py-1 pr-2 font-medium">{getWeatherIcon(state)} {state}</td>
                  {WEATHER_INTENSITIES.map((intensity) => {
                    const ripenessDelta = WEATHER_RIPENESS_DEVIATION_BY_STATE_INTENSITY[state][intensity];
                    const healthDelta = WEATHER_HEALTH_DEVIATION_BY_STATE_INTENSITY[state][intensity];
                    return (
                      <td key={`${state}-${intensity}`} className="py-1 pr-2">
                        {formatSigned(ripenessDelta)} / {formatSigned(healthDelta)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Weather State Market Pressure</p>
        <p className="text-xs text-gray-400 mb-2">
          Current implementation: grape buyer market volatility uses these weather pressure multipliers.
        </p>
        <div className="overflow-x-auto max-w-3xl mx-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">State</th>
                <th className="py-1 pr-2">Price Pressure</th>
                <th className="py-1 pr-2">Demand Pressure</th>
              </tr>
            </thead>
            <tbody>
              {WEATHER_STATES.map((state) => (
                <tr key={state} className="border-b">
                  <td className="py-1 pr-2 font-medium">{getWeatherIcon(state)} {state}</td>
                  <td className="py-1 pr-2">x{BUYER_WEATHER_VOLATILITY_PRESSURE[state].price.toFixed(2)}</td>
                  <td className="py-1 pr-2">x{BUYER_WEATHER_VOLATILITY_PRESSURE[state].limit.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="font-medium mb-1">Intensity Scaling</p>
        <div className="overflow-x-auto max-w-2xl mx-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-2">Intensity</th>
                <th className="py-1 pr-2">Volatility Scale</th>
              </tr>
            </thead>
            <tbody>
              {WEATHER_INTENSITIES.map((intensity) => (
                <tr key={intensity} className="border-b">
                  <td className="py-1 pr-2 font-medium">{intensity}</td>
                  <td className="py-1 pr-2">x{WEATHER_INTENSITY_MULTIPLIER[intensity].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-1">
        <p className="font-medium">Weather Impact Scope</p>
        <p>
          Shipped now: weather feeds grape buyer market volatility (price and demand pressure),
          and applies deterministic vineyard ripeness/health deltas through the weekly tick.
          Planned next slices: severe event damage, recommended actions, and weather-linked achievement/research hooks.
        </p>
      </div>
    </div>
  );
}
