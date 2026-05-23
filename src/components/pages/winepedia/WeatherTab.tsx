import { useGameState } from '@/hooks';
import {
  BUYER_WEATHER_VOLATILITY_PRESSURE,
  WEATHER_INTENSITY_MULTIPLIER,
} from '@/lib/services/sales/grapeBuyerMarketService';
import {
  type WeatherForecastConfidence,
  type WeatherIntensity,
  type WeatherState,
} from '@/lib/types/types';
import { getWeatherIcon } from '@/lib/services';

const FORECAST_HIT_RATE_BY_CONFIDENCE: Record<WeatherForecastConfidence, string> = {
  High: '88%',
  Medium: '78%',
  Low: '66%',
};

const WEATHER_STATES: WeatherState[] = ['Clear', 'Rain', 'Heat', 'Frost', 'Storm', 'Snow'];
const WEATHER_INTENSITIES: WeatherIntensity[] = ['Mild', 'Moderate', 'Severe'];

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
                  <td className="py-1 pr-2">×{BUYER_WEATHER_VOLATILITY_PRESSURE[state].price.toFixed(2)}</td>
                  <td className="py-1 pr-2">×{BUYER_WEATHER_VOLATILITY_PRESSURE[state].limit.toFixed(2)}</td>
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
                  <td className="py-1 pr-2">×{WEATHER_INTENSITY_MULTIPLIER[intensity].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-1">
        <p className="font-medium">Weather Impact Scope</p>
        <p>
          Shipped now: weather feeds grape buyer market volatility (price and demand pressure).
          Planned next slices: vineyard health, ripeness growth, and taste/anchor channels.
        </p>
      </div>
    </div>
  );
}
