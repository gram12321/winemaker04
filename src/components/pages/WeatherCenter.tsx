import { useMemo, useState } from 'react';
import { AlertTriangle, Compass, HeartPulse, Info, Mountain, Droplets, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, Wind, ThermometerSun, Grape, Leaf } from 'lucide-react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TooltipRow, TooltipSection, UnifiedTooltip, VineyardStatusBadge } from '@/components/ui';
import { useGameState, useGameStateWithData } from '@/hooks';
import { buildVineyardWeatherRows, buildWeatherContext, calculateWeatherImpactSummary, getAllVineyards, getCurrentCompany, getSoilResponseLabel, getWeatherIcon, type VineyardWeatherRow } from '@/lib/services';
import { formatNumber, formatSigned } from '@/lib/utils';

const WEATHER_CENTER_HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1400&h=500&fit=crop';
const WEATHER_CENTER_RIPENESS_CLAMP_LABEL = '[-0.0100, +0.0100]';
const WEATHER_CENTER_HEALTH_CLAMP_LABEL = '[-0.0120, +0.0040]';
const WEATHER_CENTER_SITE_RESPONSE_MIN = 0.8;
const WEATHER_CENTER_SITE_RESPONSE_MAX = 1.2;
const WEATHER_CENTER_SITE_RESPONSE_NEUTRAL = 1.0;

function getDeltaTextClass(value: number): string {
  if (value > 0) return 'text-emerald-700';
  if (value < 0) return 'text-red-700';
  return 'text-slate-600';
}

function getSortIcon(active: boolean, direction: 'asc' | 'desc') {
  if (!active) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
  }
  return direction === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 text-slate-700" />
    : <ArrowDown className="h-3.5 w-3.5 text-slate-700" />;
}

function getSiteResponseLabel(value: number): string {
  if (value > 1.05) return 'Amplified';
  if (value < 0.95) return 'Buffered';
  return 'Neutral';
}

function getSiteResponseColorClass(value: number): string {
  if (value > 1.05) return 'text-emerald-700';
  if (value < 0.95) return 'text-sky-700';
  return 'text-amber-700';
}

function getSiteResponseFillWidth(value: number): number {
  const normalized = (value - WEATHER_CENTER_SITE_RESPONSE_MIN) / (WEATHER_CENTER_SITE_RESPONSE_MAX - WEATHER_CENTER_SITE_RESPONSE_MIN);
  return Math.max(0, Math.min(100, normalized * 100));
}

function getWeatherBadgeClass(state?: string): string {
  if (state === 'Frost') return 'border-cyan-700/70 bg-cyan-900/30 text-cyan-200';
  if (state === 'Rain') return 'border-blue-700/70 bg-blue-900/30 text-blue-200';
  if (state === 'Storm') return 'border-indigo-700/70 bg-indigo-900/30 text-indigo-200';
  if (state === 'Heat') return 'border-amber-700/70 bg-amber-900/30 text-amber-200';
  if (state === 'Snow') return 'border-slate-700/70 bg-slate-800/50 text-slate-200';
  return 'border-sky-700/70 bg-sky-900/30 text-sky-200';
}

function getIntensityBadgeClass(intensity?: string): string {
  if (intensity === 'Severe') return 'border-red-700/70 bg-red-900/30 text-red-200';
  if (intensity === 'Moderate') return 'border-amber-700/70 bg-amber-900/30 text-amber-200';
  return 'border-emerald-700/70 bg-emerald-900/30 text-emerald-200';
}

type SortKey = 'name' | 'state' | 'ripenessDelta' | 'healthDelta' | 'siteResponse' | 'reason';

const SORTABLE_COLUMNS: Array<{ key: SortKey; label: string; description: string }> = [
  { key: 'state', label: 'Status', description: 'Sort by vineyard lifecycle state: Growing, Dormant, Harvested, and so on.' },
  { key: 'ripenessDelta', label: 'Ripeness', description: 'Sort by weather-driven ripeness movement for the current forecast window. Also shows current-to-projected movement.' },
  { key: 'healthDelta', label: 'Health', description: 'Sort by how strongly weather is improving or stressing vine health. Also shows current-to-projected movement.' },
  { key: 'siteResponse', label: 'Site Response', description: 'Sort by site multiplier from aspect, altitude, terroir, and soil. 1.0 is neutral, above amplifies weather impact, below buffers it.' },
  { key: 'reason', label: 'Reason', description: 'Sort by the summary sentence explaining the weather pressure on this vineyard.' },
];

function getSortValue(row: VineyardWeatherRow, key: SortKey): string | number {
  switch (key) {
    case 'name': return row.name.toLowerCase();
    case 'state': return row.state.toLowerCase();
    case 'ripenessDelta': return row.ripenessDelta;
    case 'healthDelta': return row.healthDelta;
    case 'siteResponse': return row.siteResponse;
    case 'reason': return row.reason.toLowerCase();
  }
}

function compareSortValues(left: string | number, right: string | number): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

function getModifierAverage(rows: VineyardWeatherRow[], key: 'aspectResponse' | 'altitudeResponse' | 'terroirResponse' | 'soilResponse'): number {
  if (rows.length === 0) return 1;
  return rows.reduce((total, row) => total + row.breakdown[key], 0) / rows.length;
}

export function WeatherCenterPage() {
  const gameState = useGameState();
  const vineyards = useGameStateWithData(getAllVineyards, [], { topic: 'vineyard' });
  const currentCompany = getCurrentCompany();
  const [sortKey, setSortKey] = useState<SortKey>('siteResponse');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const weatherContext = useMemo(() => {
    if (!currentCompany?.id) {
      return null;
    }
    return buildWeatherContext(gameState, currentCompany.id);
  }, [gameState, currentCompany?.id]);

  const vineyardRows = useMemo<VineyardWeatherRow[]>(() => {
    if (!weatherContext) {
      return [];
    }
    return buildVineyardWeatherRows(vineyards, weatherContext);
  }, [vineyards, weatherContext]);

  const impactSummary = useMemo(() => calculateWeatherImpactSummary(vineyardRows), [vineyardRows]);

  const sortedRows = useMemo(() => {
    const rows = [...vineyardRows];
    rows.sort((left, right) => {
      const leftValue = getSortValue(left, sortKey);
      const rightValue = getSortValue(right, sortKey);
      const comparison = compareSortValues(leftValue, rightValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [vineyardRows, sortDirection, sortKey]);

  const modifierSummary = useMemo(() => ({
    aspect: getModifierAverage(vineyardRows, 'aspectResponse'),
    altitude: getModifierAverage(vineyardRows, 'altitudeResponse'),
    terroir: getModifierAverage(vineyardRows, 'terroirResponse'),
    soil: getModifierAverage(vineyardRows, 'soilResponse'),
  }), [vineyardRows]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'reason' ? 'asc' : 'desc');
  }

  return (
    <div className="mx-auto max-w-[1120px] py-4 text-sm space-y-4">
      <div
        className="relative h-36 overflow-hidden rounded-xl bg-cover bg-center"
        style={{
          backgroundImage: `url('${WEATHER_CENTER_HERO_IMAGE_URL}')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/55 to-slate-900/25" />
        <div className="relative flex h-full flex-col justify-between p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Weather Center</h2>
              <p className="text-xs text-white/85">Forecast intelligence for ripeness velocity, vine stress, and site-adjusted vineyard response.</p>
            </div>
            <Badge className="bg-white/15 text-white border-white/40">{gameState.season || 'Spring'} • Week {gameState.week || 1}</Badge>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md bg-white/10 p-2.5 backdrop-blur-sm">
              <p className="text-[11px] text-white/80">Current</p>
              <p className="text-sm font-semibold">{getWeatherIcon(gameState.weatherState)} {gameState.weatherState || 'Clear'} ({gameState.weatherIntensity || 'Mild'})</p>
            </div>
            <div className="rounded-md bg-white/10 p-2.5 backdrop-blur-sm">
              <p className="text-[11px] text-white/80">Next Week</p>
              <p className="text-sm font-semibold">{getWeatherIcon(gameState.nextWeekForecastState)} {gameState.nextWeekForecastState || 'Clear'} ({gameState.nextWeekForecastIntensity || 'Mild'})</p>
            </div>
            <div className="rounded-md bg-white/10 p-2.5 backdrop-blur-sm">
              <p className="text-[11px] text-white/80">Seasonal Pattern</p>
              <p className="text-sm font-semibold">{gameState.weatherForecastPattern || 'Stable'} / {gameState.weatherForecastConfidence || 'Medium'} confidence</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Ripeness Delta</p>
                <p className={`text-lg font-semibold ${getDeltaTextClass(impactSummary.avgRipenessDelta)}`}>{formatSigned(impactSummary.avgRipenessDelta)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Health Delta</p>
                <p className={`text-lg font-semibold ${getDeltaTextClass(impactSummary.avgHealthDelta)}`}>{formatSigned(impactSummary.avgHealthDelta)}</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-2 text-rose-700">
                <HeartPulse className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Site Response</p>
                <p className="text-lg font-semibold text-slate-800">x{formatNumber(impactSummary.avgSiteResponse, { smartDecimals: true })}</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-2 text-sky-700">
                <Wind className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">High Stress Vineyards</p>
                <p className="text-lg font-semibold text-amber-700">{impactSummary.highStressCount}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white/90 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Site Modifier Forecast</CardTitle>
          <CardDescription>These are the actual site multipliers shaping each vineyard forecast. They are surfaced here so the table reads like a weather page, not a math sheet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-4">
          {[
            { label: 'Aspect', value: modifierSummary.aspect, icon: <Compass className="h-4 w-4" />, detail: 'Slope orientation and sun exposure' },
            { label: 'Altitude', value: modifierSummary.altitude, icon: <Mountain className="h-4 w-4" />, detail: 'Elevation pressure on heat and frost' },
            { label: 'Terroir', value: modifierSummary.terroir, icon: <Wind className="h-4 w-4" />, detail: 'Grape + region suitability response' },
            { label: 'Soil', value: modifierSummary.soil, icon: <Droplets className="h-4 w-4" />, detail: 'Water retention / thermal swing response' },
          ].map((modifier) => (
            <div key={modifier.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{modifier.label}</p>
                  <p className={`text-base font-semibold ${getSiteResponseColorClass(modifier.value)}`}>x{formatNumber(modifier.value, { smartDecimals: true })}</p>
                </div>
                <div className="rounded-full bg-white p-2 text-slate-700 shadow-sm">{modifier.icon}</div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{modifier.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vineyard Weather Impact Preview</CardTitle>
            <CardDescription>Net weather deltas from the current week context. Site factors (aspect, altitude, terroir, soil) are included as bounded response modifiers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium text-slate-700" onClick={() => handleSort('name')}>
                      Vineyard
                      {getSortIcon(sortKey === 'name', sortDirection)}
                    </button>
                  </TableHead>
                  {SORTABLE_COLUMNS.map((column) => (
                    <TableHead key={column.key} className={column.key === 'ripenessDelta' || column.key === 'healthDelta' || column.key === 'siteResponse' ? 'text-right' : undefined}>
                      <UnifiedTooltip
                        title={column.label}
                        content={<p className="text-xs text-slate-200">{column.description}</p>}
                        side="top"
                        variant="panel"
                        density="compact"
                      >
                        <button type="button" className={`flex items-center gap-1 font-medium text-slate-700 ${column.key === 'ripenessDelta' || column.key === 'healthDelta' || column.key === 'siteResponse' ? 'ml-auto' : ''}`} onClick={() => handleSort(column.key)}>
                          {column.label}
                          {getSortIcon(sortKey === column.key, sortDirection)}
                        </button>
                      </UnifiedTooltip>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No planted vineyards available for weather preview.</TableCell>
                  </TableRow>
                )}
                {sortedRows.map((row) => {
                  return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium align-top">
                      <div className="space-y-1">
                        <UnifiedTooltip
                          title="Vineyard"
                          content={<p className="text-xs text-slate-200">{row.name}</p>}
                          side="top"
                          variant="panel"
                          density="compact"
                        >
                          <p className="truncate max-w-[220px]">{row.name}</p>
                        </UnifiedTooltip>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${getWeatherBadgeClass(row.breakdown.weatherState)}`}>
                            <span>{getWeatherIcon(row.breakdown.weatherState as any)}</span>
                            {row.breakdown.weatherState}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${getIntensityBadgeClass(row.breakdown.weatherIntensity)}`}>
                            <ThermometerSun className="h-3 w-3" />
                            {row.breakdown.weatherIntensity}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <UnifiedTooltip
                        title="Vineyard Status"
                        content={<p className="text-xs text-slate-200">Lifecycle state of the vineyard. This is a display label, but also helps the forecast read like a real operations board.</p>}
                        side="top"
                        variant="panel"
                        density="compact"
                      >
                        <VineyardStatusBadge status={row.state} />
                      </UnifiedTooltip>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <UnifiedTooltip
                        title="Ripeness Delta Breakdown"
                        content={(
                          <div className="space-y-2">
                            <TooltipSection title="Base Weather Value">
                              <TooltipRow label="State" value={`${row.breakdown.weatherState} (${row.breakdown.weatherIntensity})`} />
                              <TooltipRow label="Base ripeness delta" value={formatSigned(row.breakdown.baseRipenessDeviation)} monospaced />
                            </TooltipSection>
                            <TooltipSection title="Site Modifiers">
                              <TooltipRow label="Aspect" value={`x${formatNumber(row.breakdown.aspectResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Altitude" value={`x${formatNumber(row.breakdown.altitudeResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Terroir" value={`x${formatNumber(row.breakdown.terroirResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label={`Soil (${getSoilResponseLabel(row.breakdown.soilResponseSource)})`} value={`x${formatNumber(row.breakdown.soilResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Combined site response" value={`x${formatNumber(row.siteResponse, { smartDecimals: true })}`} monospaced />
                            </TooltipSection>
                            <TooltipSection title="Result">
                              <TooltipRow label="Current" value={`${formatNumber(row.ripenessCurrent * 100, { smartDecimals: true })}%`} monospaced />
                              <TooltipRow label="Raw delta" value={formatSigned(row.breakdown.ripenessRawDelta)} monospaced />
                              <TooltipRow label="Final delta" value={formatSigned(row.ripenessDelta)} monospaced valueRating={row.ripenessDelta >= 0 ? 1 : 0} />
                              <TooltipRow label="Projected" value={`${formatNumber(row.ripenessProjected * 100, { smartDecimals: true })}%`} monospaced />
                              <TooltipRow label="Clamp range" value={WEATHER_CENTER_RIPENESS_CLAMP_LABEL} monospaced />
                              {row.breakdown.ripenessClamped && <p className="text-[11px] text-amber-400">Value was clamped to keep simulation stable.</p>}
                            </TooltipSection>
                          </div>
                        )}
                        triggerClassName="inline-flex justify-end"
                      >
                        <button type="button" className="inline-flex flex-col items-end gap-0.5 rounded border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 min-w-[116px]">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                            <Grape className="h-3.5 w-3.5 text-violet-600" />
                            Ripeness
                          </span>
                          <span>{formatNumber(row.ripenessCurrent * 100, { smartDecimals: true })}% → {formatNumber(row.ripenessProjected * 100, { smartDecimals: true })}%</span>
                          <span className={`inline-flex items-center gap-1 ${getDeltaTextClass(row.ripenessDelta)}`}>
                            {formatSigned(row.ripenessDelta)}
                            <Info className="h-3 w-3 text-slate-500" />
                          </span>
                        </button>
                      </UnifiedTooltip>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <UnifiedTooltip
                        title="Health Delta Breakdown"
                        content={(
                          <div className="space-y-2">
                            <TooltipSection title="Base Weather Value">
                              <TooltipRow label="State" value={`${row.breakdown.weatherState} (${row.breakdown.weatherIntensity})`} />
                              <TooltipRow label="Base health delta" value={formatSigned(row.breakdown.baseHealthDeviation)} monospaced />
                              <TooltipRow label="Seasonal adjustment" value={`x${formatNumber(row.breakdown.seasonAdjustmentMultiplier, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Adjusted health base" value={formatSigned(row.breakdown.adjustedBaseHealthDeviation)} monospaced />
                            </TooltipSection>
                            <TooltipSection title="Site Modifiers">
                              <TooltipRow label="Combined site response" value={`x${formatNumber(row.siteResponse, { smartDecimals: true })}`} monospaced />
                              {row.breakdown.siteResponseClamped && <p className="text-[11px] text-amber-400">Raw site response was clamped to [0.8, 1.2].</p>}
                            </TooltipSection>
                            <TooltipSection title="Result">
                              <TooltipRow label="Current" value={`${formatNumber(row.healthCurrent * 100, { smartDecimals: true })}%`} monospaced />
                              <TooltipRow label="Raw delta" value={formatSigned(row.breakdown.healthRawDelta)} monospaced />
                              <TooltipRow label="Final delta" value={formatSigned(row.healthDelta)} monospaced valueRating={row.healthDelta >= 0 ? 1 : 0} />
                              <TooltipRow label="Projected" value={`${formatNumber(row.healthProjected * 100, { smartDecimals: true })}%`} monospaced />
                              <TooltipRow label="Clamp range" value={WEATHER_CENTER_HEALTH_CLAMP_LABEL} monospaced />
                              {row.breakdown.healthClamped && <p className="text-[11px] text-amber-400">Value was clamped to keep simulation stable.</p>}
                            </TooltipSection>
                          </div>
                        )}
                        triggerClassName="inline-flex justify-end"
                      >
                        <button type="button" className="inline-flex flex-col items-end gap-0.5 rounded border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 min-w-[116px]">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                            <Leaf className="h-3.5 w-3.5 text-emerald-700" />
                            Health
                          </span>
                          <span>{formatNumber(row.healthCurrent * 100, { smartDecimals: true })}% → {formatNumber(row.healthProjected * 100, { smartDecimals: true })}%</span>
                          <span className={`inline-flex items-center gap-1 ${getDeltaTextClass(row.healthDelta)}`}>
                            {formatSigned(row.healthDelta)}
                            <Info className="h-3 w-3 text-slate-500" />
                          </span>
                        </button>
                      </UnifiedTooltip>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <UnifiedTooltip
                        title="Site Response"
                        content={(
                          <div className="space-y-2">
                            <TooltipSection>
                              <p className="text-xs text-slate-200">Site Response is a multiplier on weather impact built from aspect, altitude, terroir, and soil response.</p>
                              <TooltipRow label="Meaning" value="1.0 neutral, >1 amplifies, <1 buffers" />
                            </TooltipSection>
                            <TooltipSection title="How It Is Built">
                              <TooltipRow label="Aspect" value={`x${formatNumber(row.breakdown.aspectResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Altitude" value={`x${formatNumber(row.breakdown.altitudeResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Terroir" value={`x${formatNumber(row.breakdown.terroirResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label={`Soil (${getSoilResponseLabel(row.breakdown.soilResponseSource)})`} value={`x${formatNumber(row.breakdown.soilResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Raw" value={`x${formatNumber(row.breakdown.siteResponseRaw, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Final" value={`x${formatNumber(row.siteResponse, { smartDecimals: true })}`} monospaced />
                            </TooltipSection>
                          </div>
                        )}
                      >
                        <div className="space-y-1">
                          <p className={`inline-flex items-center gap-1 text-sm font-semibold ${getSiteResponseColorClass(row.siteResponse)}`}><Compass className="h-3.5 w-3.5" />x{formatNumber(row.siteResponse, { smartDecimals: true })}</p>
                          <div className="relative h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${row.siteResponse >= WEATHER_CENTER_SITE_RESPONSE_NEUTRAL ? 'bg-emerald-500' : 'bg-sky-500'}`}
                              style={{ width: `${getSiteResponseFillWidth(row.siteResponse)}%` }}
                            />
                            <div className="absolute left-1/2 top-0 h-full w-px bg-slate-500/60" />
                          </div>
                          <p className="text-[11px] text-muted-foreground">{getSiteResponseLabel(row.siteResponse)}</p>
                        </div>
                      </UnifiedTooltip>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="max-w-[230px]">
                        <p className="text-xs text-slate-700 leading-snug break-words">{row.reason}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <UnifiedTooltip title="Aspect" content={<p className="text-xs text-slate-200">Slope orientation effect on sun exposure.</p>} side="top" variant="panel" density="compact">
                            <span className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-700"><Compass className="h-3 w-3" />x{formatNumber(row.breakdown.aspectResponse, { smartDecimals: true })}</span>
                          </UnifiedTooltip>
                          <UnifiedTooltip title="Altitude" content={<p className="text-xs text-slate-200">Elevation modifies heat/frost pressure.</p>} side="top" variant="panel" density="compact">
                            <span className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700"><Mountain className="h-3 w-3" />x{formatNumber(row.breakdown.altitudeResponse, { smartDecimals: true })}</span>
                          </UnifiedTooltip>
                          <UnifiedTooltip title="Terroir" content={<p className="text-xs text-slate-200">Region + grape suitability response.</p>} side="top" variant="panel" density="compact">
                            <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700"><Wind className="h-3 w-3" />x{formatNumber(row.breakdown.terroirResponse, { smartDecimals: true })}</span>
                          </UnifiedTooltip>
                          <UnifiedTooltip title="Soil" content={<p className="text-xs text-slate-200">Thermal swing and water-retention response.</p>} side="top" variant="panel" density="compact">
                            <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700"><Droplets className="h-3 w-3" />x{formatNumber(row.breakdown.soilResponse, { smartDecimals: true })}</span>
                          </UnifiedTooltip>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>

      <Card>
          <CardHeader>
            <CardTitle className="text-base">Alerts</CardTitle>
            <CardDescription>Prepared UI shell. Event damage and recommended actions are planned for later phases.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded border border-dashed p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="font-medium">Severe Weather Events</p>
                <Badge variant="outline">Planned</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Hail and other explicit damage events are not active yet in this phase.</p>
            </div>
            <div className="rounded border border-dashed p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="font-medium">Recommended Actions</p>
                <Badge variant="outline">Planned</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Action guidance will unlock when protection operations and related research hooks are implemented.</p>
            </div>
            <div className="rounded border border-dashed p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="font-medium">Research + Achievements Link</p>
                <Badge variant="outline">Phase 3/4</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Weather-driven achievements and mitigation research triggers are prepared, but not active yet.</p>
            </div>
          </CardContent>
      </Card>
    </div>
  );
}

export default WeatherCenterPage;
