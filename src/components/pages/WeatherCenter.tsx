import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, VineyardStatusBadge } from '@/components/ui';
import { useGameState, useGameStateWithData } from '@/hooks';
import { getAllVineyards, getCurrentCompany } from '@/lib/services';
import { buildWeatherCenterPresentation, createWeatherWeekContext } from '@/lib/features/weather';
import { formatNumber, formatSigned } from '@/lib/utils';

const WEATHER_CENTER_HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1400&h=500&fit=crop';

function percent(value: number): string {
  return `${formatNumber(value * 100, { decimals: 2, forceDecimals: true })}%`;
}

function signedPercent(value: number): string {
  return `${formatSigned(value * 100)} pp`;
}

function deltaClass(value: number): string {
  if (value > 0) return 'text-emerald-700';
  if (value < 0) return 'text-red-700';
  return 'text-slate-600';
}

export function WeatherCenterPage() {
  const gameState = useGameState();
  const vineyards = useGameStateWithData(getAllVineyards, []);
  const company = getCurrentCompany();
  const [expandedVineyardId, setExpandedVineyardId] = useState<string | null>(null);
  const presentation = useMemo(() => company?.id
    ? buildWeatherCenterPresentation({ companyId: company.id, weather: createWeatherWeekContext(gameState), vineyards })
    : null, [company?.id, gameState, vineyards]);

  if (!presentation) {
    return <div className="p-6 text-sm text-slate-500">Choose a company to view weather.</div>;
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <section className="overflow-hidden rounded-lg border bg-slate-950 text-white">
        <div className="relative min-h-40 bg-cover bg-center p-5" style={{ backgroundImage: `linear-gradient(90deg, rgba(2,6,23,.92), rgba(2,6,23,.42)), url(${WEATHER_CENTER_HERO_IMAGE_URL})` }}>
          <h1 className="text-2xl font-bold">Weather Center</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-200">A clear view of this week’s conditions and what next week is likely to mean for your vineyards and grape market.</p>
          <p className="mt-3 text-sm font-medium text-sky-200">{presentation.seasonalOutlook}</p>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{presentation.currentWeather.label}</CardTitle><CardDescription>Conditions resolved for the current week.</CardDescription></CardHeader>
          <CardContent className="text-lg font-semibold">{presentation.currentWeather.icon} {presentation.currentWeather.description}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{presentation.forecast.label}</CardTitle><CardDescription>Confidence: {presentation.forecast.confidence}</CardDescription></CardHeader>
          <CardContent className="text-lg font-semibold">{presentation.forecast.icon} {presentation.forecast.description}</CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {presentation.outlooks.map((outlook) => (
          <Card key={outlook.label}><CardHeader className="pb-1"><CardTitle className="text-sm">{outlook.label}</CardTitle></CardHeader><CardContent className="text-sm text-slate-600">{outlook.detail}</CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vineyard Weather Impact Preview</CardTitle>
          <CardDescription>Next-week forecast outcomes. Weather changes normal vineyard progression; it does not replace it.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Vineyard</TableHead><TableHead>Status</TableHead><TableHead>Ripeness</TableHead><TableHead>Health</TableHead><TableHead>Site note</TableHead></TableRow></TableHeader>
            <TableBody>
              {presentation.rows.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-slate-500">No planted vineyards available for weather preview.</TableCell></TableRow> : presentation.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell><VineyardStatusBadge status={row.status as any} /></TableCell>
                  <TableCell><div>{percent(row.ripeness.current)} → {percent(row.ripeness.projected)}</div><div className={`text-xs ${deltaClass(row.ripeness.weatherContribution)}`}>Weather {signedPercent(row.ripeness.weatherContribution)}</div></TableCell>
                  <TableCell><div>{percent(row.health.current)} → {percent(row.health.projected)}</div><div className={`text-xs ${deltaClass(row.health.weatherContribution)}`}>Weather {signedPercent(row.health.weatherContribution)}</div></TableCell>
                  <TableCell className="text-sm text-slate-600"><p className="font-medium text-slate-700">{row.siteSummary}</p><p className="mt-1">{row.siteNote}</p><button type="button" className="mt-1 text-left underline decoration-dotted underline-offset-2" onClick={() => setExpandedVineyardId(expandedVineyardId === row.id ? null : row.id)}>{expandedVineyardId === row.id ? 'Hide explanation' : 'Why this forecast?'}</button>{expandedVineyardId === row.id && <p className="mt-1">{row.explanation}</p>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default WeatherCenterPage;
