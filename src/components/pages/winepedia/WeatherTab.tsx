import { useGameState } from '@/hooks';
import { buildWeatherReference, createWeatherWeekContext, getWeatherIcon } from '@/lib/features/weather';

const reference = buildWeatherReference();

export function WeatherTab() {
  const weather = createWeatherWeekContext(useGameState());

  return (
    <div className="space-y-5 text-sm">
      <section className="rounded border border-sky-800/40 bg-sky-950/20 p-3">
        <p className="font-medium">Weather reference</p>
        <p className="mt-1">Current: <strong>{getWeatherIcon(weather.state)} {weather.state} ({weather.intensity})</strong></p>
        <p>Next-week forecast: <strong>{getWeatherIcon(weather.forecast.state)} {weather.forecast.state} ({weather.forecast.intensity})</strong> · {weather.forecast.confidence} confidence</p>
        <p>Seasonal outlook: <strong>{weather.seasonalPattern}</strong></p>
      </section>

      <section><p className="font-medium">Vineyard calculation</p><p className="text-slate-500">{reference.formula}</p><p className="mt-1 text-slate-500">{reference.siteRules}</p></section>

      <section>
        <p className="mb-1 font-medium">Vineyard weather multipliers</p>
        <p className="mb-2 text-xs text-slate-500">Each cell is ripeness / health multiplier applied to the normal weekly seasonal change.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-1">State</th>{reference.vineyardMatrix[0].intensities.map((cell) => <th className="p-1" key={cell.intensity}>{cell.intensity}</th>)}</tr></thead><tbody>{reference.vineyardMatrix.map((row) => <tr className="border-b" key={row.state}><td className="p-1 font-medium">{getWeatherIcon(row.state)} {row.state}</td>{row.intensities.map((cell) => <td className="p-1" key={cell.intensity}>×{cell.ripenessMultiplier.toFixed(2)} / ×{cell.healthMultiplier.toFixed(2)}</td>)}</tr>)}</tbody></table></div>
      </section>

      <section>
        <p className="mb-1 font-medium">Grape-market derivation</p>
        <p className="mb-2 text-xs text-slate-500">Each cell is the final price / supply multiplier after state pressure and intensity scaling, before the market clamps it.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-1">State</th>{reference.marketMatrix[0].intensities.map((cell) => <th className="p-1" key={cell.intensity}>{cell.intensity}</th>)}</tr></thead><tbody>{reference.marketMatrix.map((row) => <tr className="border-b" key={row.state}><td className="p-1 font-medium">{getWeatherIcon(row.state)} {row.state}</td>{row.intensities.map((cell) => <td className="p-1" key={cell.intensity}>×{cell.priceMultiplier.toFixed(2)} / ×{cell.supplyMultiplier.toFixed(2)}</td>)}</tr>)}</tbody></table></div>
      </section>

      <section><p className="font-medium">Forecast behavior</p><p className="text-slate-500">{reference.forecastBehavior}</p></section>
      <section><p className="font-medium">Current scope</p><p className="text-slate-500">{reference.scope}</p></section>
    </div>
  );
}
