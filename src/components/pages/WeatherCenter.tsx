import { useMemo, useState } from 'react';
import { AlertTriangle, Compass, HeartPulse, Info, Mountain, Droplets, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, Wind, ThermometerSun, Grape, Leaf } from 'lucide-react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TooltipRow, TooltipSection, UnifiedTooltip, VineyardStatusBadge } from '@/components/ui';
import { useGameState, useGameStateWithData } from '@/hooks';
import { buildVineyardWeatherRows, buildWeatherContext, calculateWeatherImpactSummary, getAllVineyards, getCurrentCompany, getSoilResponseLabel, getWeatherIcon, type VineyardWeatherRow } from '@/lib/services';
import { formatNumber, formatSigned } from '@/lib/utils';

const WEATHER_CENTER_HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1400&h=500&fit=crop';
const WEATHER_CENTER_RIPENESS_CLAMP_LABEL = '[-0.0100, +0.0100]';
const WEATHER_CENTER_HEALTH_CLAMP_LABEL = '[-0.0120, +0.0040]';
const WEATHER_CENTER_SITE_RESPONSE_MIN = 0.7;
const WEATHER_CENTER_SITE_RESPONSE_MAX = 1.3;
const WEATHER_CENTER_SITE_RESPONSE_NEUTRAL = 1.0;
const formatPercentValue = (value: number): string => `${formatNumber(value * 100, { decimals: 2, forceDecimals: true })}%`;
const formatPercentPoints = (value: number): string => `${formatSigned(value * 100)} pp`;

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
  if (intensity === 'Extreme') return 'border-fuchsia-700/70 bg-fuchsia-900/30 text-fuchsia-200';
  if (intensity === 'Severe') return 'border-red-700/70 bg-red-900/30 text-red-200';
  if (intensity === 'Moderate') return 'border-amber-700/70 bg-amber-900/30 text-amber-200';
  if (intensity === 'VeryMild') return 'border-teal-700/70 bg-teal-900/30 text-teal-200';
  return 'border-emerald-700/70 bg-emerald-900/30 text-emerald-200';
}

function getWeatherSignalClass(signal: 'Supportive' | 'Mixed' | 'Stressful'): string {
  if (signal === 'Supportive') return 'text-emerald-700';
  if (signal === 'Stressful') return 'text-red-700';
  return 'text-amber-700';
}

function isHeatColdResponseWeather(state?: string): boolean {
  return state === 'Heat' || state === 'Frost' || state === 'Snow';
}

function getSoilWeatherMode(state?: string): 'Water Retention' | 'Thermal Swing' | 'Neutral' {
  if (state === 'Rain' || state === 'Snow') return 'Water Retention';
  if (state === 'Heat' || state === 'Frost') return 'Thermal Swing';
  return 'Neutral';
}

function getModifierInterpretation(value: number): string {
  if (value > 1.01) return 'amplifies weather impact';
  if (value < 0.99) return 'buffers weather impact';
  return 'is effectively neutral';
}

function getProgressionMultiplier(normalDelta: number, totalDelta: number): number {
  if (Math.abs(normalDelta) < 0.000001) return 1;
  return totalDelta / normalDelta;
}

function formatPressure(value: number): string {
  return formatSigned(value);
}

function formatPercentFromMultiplier(multiplier: number): string {
  return `${formatSigned((multiplier - 1) * 100)}%`;
}

function getWeatherChainText(
  state: string,
  intensity: string,
  stateFactor: number,
  intensityFactor: number,
  siteResponse: number
): string {
  return `${state} ${intensity}: ${formatSigned(stateFactor)} × ${formatNumber(intensityFactor, { smartDecimals: true })} × ${formatNumber(siteResponse, { smartDecimals: true })}`;
}

type SiteFactorKey = 'aspect' | 'altitude' | 'terroir' | 'soil';

interface SiteFactorStep {
  key: SiteFactorKey;
  label: string;
  value: number;
}

interface SitePressureStep extends SiteFactorStep {
  pressure: number;
  delta: number;
}

function getSiteFactorSteps(row: VineyardWeatherRow): SiteFactorStep[] {
  return [
    { key: 'aspect', label: 'Aspect', value: row.breakdown.aspectResponse },
    { key: 'altitude', label: 'Altitude', value: row.breakdown.altitudeResponse },
    { key: 'terroir', label: 'Terroir', value: row.breakdown.terroirResponse },
    { key: 'soil', label: 'Soil', value: row.breakdown.soilResponse },
  ];
}

function buildSitePressureSteps(basePressure: number, factors: SiteFactorStep[]): SitePressureStep[] {
  let running = basePressure;
  return factors.map((factor) => {
    const nextPressure = running * factor.value;
    const delta = nextPressure - running;
    running = nextPressure;
    return {
      ...factor,
      pressure: nextPressure,
      delta,
    };
  });
}

function formatPressureShift(baseValue: number, finalValue: number): string {
  const delta = finalValue - baseValue;
  if (Math.abs(baseValue) < 0.000001) {
    return `${formatSigned(delta)} (n/a)`;
  }
  const relativePct = (delta / baseValue) * 100;
  return `${formatSigned(delta)} (${formatSigned(relativePct)}%)`;
}

function getModifierImpactText(multiplier: number): string {
  const impactPct = (multiplier - 1) * 100;
  if (Math.abs(impactPct) < 0.1) {
    return 'Neutral in current formula (~0% pressure shift).';
  }
  return impactPct > 0
    ? `Amplifies weather pressure by ${formatNumber(impactPct, { decimals: 1, forceDecimals: true })}% in this step.`
    : `Buffers weather pressure by ${formatNumber(Math.abs(impactPct), { decimals: 1, forceDecimals: true })}% in this step.`;
}

type SortKey = 'name' | 'state' | 'ripenessDelta' | 'healthDelta' | 'siteResponse' | 'reason';

const SORTABLE_COLUMNS: Array<{ key: SortKey; label: string; description: string }> = [
  { key: 'state', label: 'Status', description: 'Sort by vineyard lifecycle state: Growing, Dormant, Harvested, and so on.' },
  { key: 'ripenessDelta', label: 'Ripeness', description: 'Sort by net next-week ripeness movement (normal progression scaled by weather multiplier) and current-to-projected movement.' },
  { key: 'healthDelta', label: 'Health', description: 'Sort by net next-week health movement (normal progression scaled by weather multiplier) and current-to-projected movement.' },
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
  const vineyards = useGameStateWithData(getAllVineyards, []);
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

  const formulaExampleRow = sortedRows.length > 0 ? sortedRows[0] : null;

  const formulaSiteFactors = useMemo<SiteFactorStep[]>(() => (
    formulaExampleRow ? getSiteFactorSteps(formulaExampleRow) : []
  ), [formulaExampleRow]);

  const formulaPressureBreakdown = useMemo(() => {
    if (!formulaExampleRow) {
      return null;
    }

    const ripenessNoSitePressure = formulaExampleRow.breakdown.weatherStateFactorRipeness
      * formulaExampleRow.breakdown.weatherIntensityFactor;
    const healthNoSitePressure = formulaExampleRow.breakdown.weatherStateFactorHealth
      * formulaExampleRow.breakdown.weatherIntensityFactor
      * formulaExampleRow.breakdown.seasonAdjustmentMultiplier;

    return {
      ripenessNoSitePressure,
      healthNoSitePressure,
      ripenessSiteSteps: buildSitePressureSteps(ripenessNoSitePressure, formulaSiteFactors),
      healthSiteSteps: buildSitePressureSteps(healthNoSitePressure, formulaSiteFactors),
      ripenessWithSitePressureRaw: formulaExampleRow.breakdown.ripenessWeatherPressureRaw,
      healthWithSitePressureRaw: formulaExampleRow.breakdown.healthWeatherPressureRaw,
      ripenessWithSitePressureFinal: formulaExampleRow.breakdown.ripenessWeatherPressure,
      healthWithSitePressureFinal: formulaExampleRow.breakdown.healthWeatherPressure,
    };
  }, [formulaExampleRow, formulaSiteFactors]);

  const formulaSiteStackText = useMemo(() => {
    if (formulaSiteFactors.length === 0) {
      return 'n/a';
    }
    return formulaSiteFactors
      .map((factor) => `${factor.label} x${formatNumber(factor.value, { smartDecimals: true })}`)
      .join(' x ');
  }, [formulaSiteFactors]);

  const modifierSummary = useMemo(() => ({
    aspect: getModifierAverage(vineyardRows, 'aspectResponse'),
    altitude: getModifierAverage(vineyardRows, 'altitudeResponse'),
    terroir: getModifierAverage(vineyardRows, 'terroirResponse'),
    soil: getModifierAverage(vineyardRows, 'soilResponse'),
  }), [vineyardRows]);

  const compareRows = useMemo(() => {
    if (sortedRows.length < 2) {
      return null;
    }
    const bySite = [...sortedRows].sort((a, b) => b.siteResponse - a.siteResponse);
    const amplified = bySite[0];
    const buffered = bySite[bySite.length - 1];
    if (!amplified || !buffered || amplified.id === buffered.id) {
      return null;
    }
    return { amplified, buffered };
  }, [sortedRows]);

  const weatherDriverContext = useMemo(() => {
    const activeState = weatherContext?.weatherState || gameState.nextWeekForecastState || gameState.weatherState;
    const activeIntensity = weatherContext?.weatherIntensity || gameState.nextWeekForecastIntensity || gameState.weatherIntensity;
    const activeSeason = weatherContext?.season || gameState.season;
    const heatColdActive = isHeatColdResponseWeather(activeState);
    const soilMode = getSoilWeatherMode(activeState);

    return {
      activeState,
      activeIntensity,
      activeSeason,
      heatColdActive,
      soilMode,
      seasonNote: activeState === 'Snow' && activeSeason === 'Winter'
        ? 'Winter reduces snow health pressure after site response.'
        : 'Season drives baseline progression; site multipliers are weather-type driven.',
      intensityNote: 'Intensity scales base weather pressure before site multipliers are applied.',
    };
  }, [weatherContext, gameState.nextWeekForecastState, gameState.nextWeekForecastIntensity, gameState.weatherState, gameState.weatherIntensity, gameState.season]);

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
              <UnifiedTooltip
                title="Current Weather"
                content={<p className="text-xs text-slate-200">Current weather state and intensity set base weather pressure before site response is applied.</p>}
                side="top"
                variant="panel"
                density="compact"
              >
                <p className="text-sm font-semibold">{getWeatherIcon(gameState.weatherState)} {gameState.weatherState || 'Clear'} ({gameState.weatherIntensity || 'Mild'})</p>
              </UnifiedTooltip>
            </div>
            <div className="rounded-md bg-white/10 p-2.5 backdrop-blur-sm">
              <p className="text-[11px] text-white/80">Next Week</p>
              <UnifiedTooltip
                title="Next Week Forecast"
                content={<p className="text-xs text-slate-200">Forecasted weather used for planning; realized weather can differ by confidence level.</p>}
                side="top"
                variant="panel"
                density="compact"
              >
                <p className="text-sm font-semibold">{getWeatherIcon(gameState.nextWeekForecastState)} {gameState.nextWeekForecastState || 'Clear'} ({gameState.nextWeekForecastIntensity || 'Mild'})</p>
              </UnifiedTooltip>
            </div>
            <div className="rounded-md bg-white/10 p-2.5 backdrop-blur-sm">
              <p className="text-[11px] text-white/80">Seasonal Pattern</p>
              <UnifiedTooltip
                title="Seasonal Pattern"
                content={<p className="text-xs text-slate-200">Pattern biases weather type odds this season. Confidence controls forecast hit-rate.</p>}
                side="top"
                variant="panel"
                density="compact"
              >
                <p className="text-sm font-semibold">{gameState.weatherForecastPattern || 'Stable'} / {gameState.weatherForecastConfidence || 'Medium'} confidence</p>
              </UnifiedTooltip>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Ripeness Net Δ</p>
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
                <p className="text-xs text-muted-foreground">Avg Health Net Δ</p>
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
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Weather Signal</p>
                <UnifiedTooltip
                  title="Weather Signal"
                  content={<p className="text-xs text-slate-200">{impactSummary.weatherSignalDetail}</p>}
                  side="top"
                  variant="panel"
                  density="compact"
                >
                  <p className={`text-lg font-semibold ${getWeatherSignalClass(impactSummary.weatherSignalLabel)}`}>{impactSummary.weatherSignalLabel}</p>
                </UnifiedTooltip>
                <p className="text-[11px] text-muted-foreground">
                  Weather Delta: Ripeness {formatPercentPoints(impactSummary.avgWeatherRipenessDelta)} / Health {formatPercentPoints(impactSummary.avgWeatherHealthDelta)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <ThermometerSun className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white/90 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Model Legend</CardTitle>
          <CardDescription>Definitions and units used in the weather model so every number has context.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 text-xs">
          <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
            <p><span className="font-semibold text-slate-700">Weather pressure:</span> Unitless weather force index. + means supports baseline direction, - means opposes baseline direction.</p>
            <p className="mt-1"><span className="font-semibold text-slate-700">No-site pressure:</span> `stateFactor x intensityFactor` (health also multiplies `seasonAdjustment`).</p>
            <p className="mt-1"><span className="font-semibold text-slate-700">Site response:</span> `aspect x altitude x terroir x soil`, clamped to [0.7, 1.3].</p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
            <p><span className="font-semibold text-slate-700">Weather multiplier:</span> `1 + sign(normalDelta) x weatherPressure`.</p>
            <p className="mt-1"><span className="font-semibold text-slate-700">Projected delta:</span> `normalDelta x weatherMultiplier` (shown in `pp`).</p>
            <p className="mt-1"><span className="font-semibold text-slate-700">Quick scale:</span> pressure `+0.10` is about `+10%` multiplier shift, pressure `-0.20` is about `-20%` shift (before clamps).</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white/90 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Trigger Matrix</CardTitle>
          <CardDescription>Which weather states activate each site modifier family.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modifier</TableHead>
                <TableHead>Activated By</TableHead>
                <TableHead>Current Driver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Aspect</TableCell>
                <TableCell>Heat, Frost, Snow</TableCell>
                <TableCell>{weatherDriverContext.heatColdActive ? 'Active now' : 'Neutral now (x1)'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Altitude</TableCell>
                <TableCell>Heat, Frost, Snow</TableCell>
                <TableCell>{weatherDriverContext.heatColdActive ? 'Active now' : 'Neutral now (x1)'}</TableCell>
              </TableRow>
                <TableRow>
                  <TableCell>Soil</TableCell>
                  <TableCell>Rain/Snow {'->'} Water Retention, Heat/Frost {'->'} Thermal Swing</TableCell>
                  <TableCell>{weatherDriverContext.soilMode}</TableCell>
                </TableRow>
              <TableRow>
                <TableCell>Terroir</TableCell>
                <TableCell>Always (grape-region suitability response)</TableCell>
                <TableCell>Always active</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white/90 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Site Modifier Forecast</CardTitle>
          <CardDescription>These are the actual site multipliers shaping each vineyard forecast. They are surfaced here so the table reads like a weather page, not a math sheet.</CardDescription>
          <div className="pt-1 text-xs text-muted-foreground space-y-1">
            <p>
              Driver now: <span className="font-medium text-slate-700">{weatherDriverContext.activeState || 'Clear'} ({weatherDriverContext.activeIntensity || 'Mild'})</span> in <span className="font-medium text-slate-700">{weatherDriverContext.activeSeason || gameState.season || 'Spring'}</span>.
            </p>
            <p>{weatherDriverContext.intensityNote} {weatherDriverContext.seasonNote}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            {[
            {
              label: 'Aspect',
              value: modifierSummary.aspect,
              icon: <Compass className="h-4 w-4" />,
              detail: weatherDriverContext.heatColdActive
                ? `Active for ${weatherDriverContext.activeState} weather.`
                : `x1 because ${weatherDriverContext.activeState || 'current weather'} does not trigger heat/cold aspect response.`,
              tooltip: 'Aspect applies on Heat, Frost, and Snow. Other weather states keep aspect near neutral for weather response.',
            },
            {
              label: 'Altitude',
              value: modifierSummary.altitude,
              icon: <Mountain className="h-4 w-4" />,
              detail: weatherDriverContext.heatColdActive
                ? `Active for ${weatherDriverContext.activeState} weather.`
                : `x1 because ${weatherDriverContext.activeState || 'current weather'} does not trigger heat/cold altitude response.`,
              tooltip: 'Altitude modifies Heat/Frost/Snow weather pressure. On non-thermal states it usually remains neutral.',
            },
            {
              label: 'Terroir',
              value: modifierSummary.terroir,
              icon: <Wind className="h-4 w-4" />,
              detail: `${getModifierInterpretation(modifierSummary.terroir)} from grape-region suitability.`,
              tooltip: 'Terroir is derived from grape suitability. Lower suitability usually increases weather sensitivity; higher suitability buffers it.',
            },
            {
              label: 'Soil',
              value: modifierSummary.soil,
              icon: <Droplets className="h-4 w-4" />,
              detail: `${weatherDriverContext.soilMode} mode for ${weatherDriverContext.activeState || 'current weather'}.`,
              tooltip: 'Soil mode switches by weather: Rain/Snow use water retention, Heat/Frost use thermal swing, Clear/Storm stay neutral.',
            },
            ].map((modifier) => (
              <div key={modifier.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{modifier.label}</p>
                    <UnifiedTooltip
                      title={`${modifier.label} Multiplier`}
                      content={<p className="text-xs text-slate-200">{modifier.tooltip}</p>}
                      side="top"
                      variant="panel"
                      density="compact"
                    >
                      <p className={`text-base font-semibold ${getSiteResponseColorClass(modifier.value)}`}>x{formatNumber(modifier.value, { smartDecimals: true })}</p>
                    </UnifiedTooltip>
                  </div>
                  <div className="rounded-full bg-white p-2 text-slate-700 shadow-sm">{modifier.icon}</div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{modifier.detail}</p>
                <p className="mt-1 text-[11px] text-slate-600">{getModifierImpactText(modifier.value)}</p>
              </div>
            ))}
          </div>

          {formulaExampleRow && formulaPressureBreakdown && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-700">How Site Modifiers Change Weather Pressure</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Example vineyard: <span className="font-medium text-slate-700">{formulaExampleRow.name}</span>. Start from weather-only pressure, then multiply aspect, altitude, terroir, and soil to get the final site-adjusted pressure used by the formula.
              </p>
              <div className="mt-2 grid gap-3 md:grid-cols-2 text-[11px]">
                <div className="rounded border border-violet-200 bg-violet-50/30 p-2.5">
                  <p className="font-semibold text-violet-700">Ripeness Pressure Walkthrough</p>
                  <p className="mt-1">Equation: `noSite = stateFactor x intensityFactor`</p>
                  <p className="mt-1">No-site pressure: <span className="font-medium">{formatPressure(formulaPressureBreakdown.ripenessNoSitePressure)}</span> (state x intensity)</p>
                  <div className="mt-1 space-y-0.5">
                    {formulaPressureBreakdown.ripenessSiteSteps.map((step) => (
                      <p key={step.key}>
                        x{step.label} x{formatNumber(step.value, { smartDecimals: true })}{' -> '}{formatPressure(step.pressure)} ({formatSigned(step.delta)})
                      </p>
                    ))}
                  </div>
                  <p className="mt-1">Site-adjusted (raw): <span className="font-medium">{formatPressure(formulaPressureBreakdown.ripenessWithSitePressureRaw)}</span></p>
                  <p>Net site impact: <span className="font-medium">{formatPressureShift(formulaPressureBreakdown.ripenessNoSitePressure, formulaPressureBreakdown.ripenessWithSitePressureRaw)}</span></p>
                  <p>Formula pressure used: <span className="font-medium">{formatPressure(formulaPressureBreakdown.ripenessWithSitePressureFinal)}</span></p>
                </div>
                <div className="rounded border border-emerald-200 bg-emerald-50/30 p-2.5">
                  <p className="font-semibold text-emerald-700">Health Pressure Walkthrough</p>
                  <p className="mt-1">Equation: `noSite = stateFactor x intensityFactor x seasonAdj`</p>
                  <p className="mt-1">No-site pressure: <span className="font-medium">{formatPressure(formulaPressureBreakdown.healthNoSitePressure)}</span> (state x intensity x season adj)</p>
                  <div className="mt-1 space-y-0.5">
                    {formulaPressureBreakdown.healthSiteSteps.map((step) => (
                      <p key={step.key}>
                        x{step.label} x{formatNumber(step.value, { smartDecimals: true })}{' -> '}{formatPressure(step.pressure)} ({formatSigned(step.delta)})
                      </p>
                    ))}
                  </div>
                  <p className="mt-1">Site-adjusted (raw): <span className="font-medium">{formatPressure(formulaPressureBreakdown.healthWithSitePressureRaw)}</span></p>
                  <p>Net site impact: <span className="font-medium">{formatPressureShift(formulaPressureBreakdown.healthNoSitePressure, formulaPressureBreakdown.healthWithSitePressureRaw)}</span></p>
                  <p>Formula pressure used: <span className="font-medium">{formatPressure(formulaPressureBreakdown.healthWithSitePressureFinal)}</span></p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {formulaExampleRow && formulaPressureBreakdown && (
        <Card className="border-slate-200 bg-slate-50/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weather Effect Formula (Visible Model)</CardTitle>
            <CardDescription>
              Example using <span className="font-medium text-slate-700">{formulaExampleRow.name}</span>. This is the exact chain from season progression to projected effect.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 text-xs">
            <div className="rounded border border-violet-200 bg-white p-3 space-y-1.5">
              <p className="font-semibold text-violet-700">Ripeness Chain</p>
              <p>Season progression: <span className="font-medium">{formatPercentPoints(formulaExampleRow.ripenessNormalDelta)}</span></p>
              <p>
                Weather chain: <span className="font-medium">{getWeatherChainText(
                  formulaExampleRow.weatherState,
                  formulaExampleRow.weatherIntensity,
                  formulaExampleRow.breakdown.weatherStateFactorRipeness,
                  formulaExampleRow.breakdown.weatherIntensityFactor,
                  formulaExampleRow.siteResponse
                )}</span>
              </p>
              <p>Site stack: <span className="font-medium">{formulaSiteStackText} = x{formatNumber(formulaExampleRow.siteResponse, { smartDecimals: true })}</span></p>
              <p>No-site pressure: <span className="font-medium">{formatPressure(formulaPressureBreakdown.ripenessNoSitePressure)}</span></p>
              <p>Site impact on pressure: <span className="font-medium">{formatPressureShift(formulaPressureBreakdown.ripenessNoSitePressure, formulaPressureBreakdown.ripenessWithSitePressureRaw)}</span></p>
              <p>Weather pressure: <span className="font-medium">{formatPressure(formulaExampleRow.breakdown.ripenessWeatherPressure)}</span></p>
              <p>Equation: <span className="font-medium">`multiplier = 1 + sign(normalDelta) x weatherPressure`</span></p>
              <p>Projected multiplier: <span className="font-medium">x{formatNumber(getProgressionMultiplier(formulaExampleRow.ripenessNormalDelta, formulaExampleRow.ripenessDelta), { smartDecimals: true })}</span></p>
              <p>Multiplier shift: <span className="font-medium">{formatPercentFromMultiplier(getProgressionMultiplier(formulaExampleRow.ripenessNormalDelta, formulaExampleRow.ripenessDelta))}</span></p>
              <p>Weather contribution: <span className={`font-medium ${getDeltaTextClass(formulaExampleRow.ripenessWeatherDelta)}`}>{formatPercentPoints(formulaExampleRow.ripenessWeatherDelta)}</span></p>
              <p>Projected effect: <span className={`font-semibold ${getDeltaTextClass(formulaExampleRow.ripenessDelta)}`}>{formatPercentPoints(formulaExampleRow.ripenessDelta)}</span> ({formatPercentValue(formulaExampleRow.ripenessCurrent)}{' -> '}{formatPercentValue(formulaExampleRow.ripenessProjected)})</p>
            </div>
            <div className="rounded border border-emerald-200 bg-white p-3 space-y-1.5">
              <p className="font-semibold text-emerald-700">Health Chain</p>
              <p>Season progression: <span className="font-medium">{formatPercentPoints(formulaExampleRow.healthNormalDelta)}</span></p>
              <p>
                Weather chain: <span className="font-medium">{getWeatherChainText(
                  formulaExampleRow.weatherState,
                  formulaExampleRow.weatherIntensity,
                  formulaExampleRow.breakdown.weatherStateFactorHealth,
                  formulaExampleRow.breakdown.weatherIntensityFactor,
                  formulaExampleRow.siteResponse
                )}</span>
              </p>
              <p>Season adjustment: <span className="font-medium">x{formatNumber(formulaExampleRow.breakdown.seasonAdjustmentMultiplier, { smartDecimals: true })}</span></p>
              <p>Site stack: <span className="font-medium">{formulaSiteStackText} = x{formatNumber(formulaExampleRow.siteResponse, { smartDecimals: true })}</span></p>
              <p>No-site pressure: <span className="font-medium">{formatPressure(formulaPressureBreakdown.healthNoSitePressure)}</span></p>
              <p>Site impact on pressure: <span className="font-medium">{formatPressureShift(formulaPressureBreakdown.healthNoSitePressure, formulaPressureBreakdown.healthWithSitePressureRaw)}</span></p>
              <p>Weather pressure: <span className="font-medium">{formatPressure(formulaExampleRow.breakdown.healthWeatherPressure)}</span></p>
              <p>Equation: <span className="font-medium">`multiplier = 1 + sign(normalDelta) x weatherPressure`</span></p>
              <p>Projected multiplier: <span className="font-medium">x{formatNumber(getProgressionMultiplier(formulaExampleRow.healthNormalDelta, formulaExampleRow.healthDelta), { smartDecimals: true })}</span></p>
              <p>Multiplier shift: <span className="font-medium">{formatPercentFromMultiplier(getProgressionMultiplier(formulaExampleRow.healthNormalDelta, formulaExampleRow.healthDelta))}</span></p>
              <p>Weather contribution: <span className={`font-medium ${getDeltaTextClass(formulaExampleRow.healthWeatherDelta)}`}>{formatPercentPoints(formulaExampleRow.healthWeatherDelta)}</span></p>
              <p>Projected effect: <span className={`font-semibold ${getDeltaTextClass(formulaExampleRow.healthDelta)}`}>{formatPercentPoints(formulaExampleRow.healthDelta)}</span> ({formatPercentValue(formulaExampleRow.healthCurrent)}{' -> '}{formatPercentValue(formulaExampleRow.healthProjected)})</p>
            </div>
          </CardContent>
        </Card>
      )}

      {compareRows && (
        <Card className="border-slate-200 bg-white/90 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Why Vineyards Differ</CardTitle>
            <CardDescription>Same weather driver, different site stack leads to different pressure and projected effect.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 text-xs">
            {[
              { title: 'Higher Site Response', row: compareRows.amplified, tone: 'emerald' },
              { title: 'Lower Site Response', row: compareRows.buffered, tone: 'sky' },
            ].map((entry) => (
              <div key={entry.row.id} className={`rounded border ${entry.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/30' : 'border-sky-200 bg-sky-50/30'} p-3 space-y-1`}>
                <p className={`font-semibold ${entry.tone === 'emerald' ? 'text-emerald-700' : 'text-sky-700'}`}>{entry.title}</p>
                <p className="font-medium text-slate-700">{entry.row.name}</p>
                <p>Site response: <span className="font-medium">x{formatNumber(entry.row.siteResponse, { smartDecimals: true })}</span></p>
                <p>Weather pressure (ripeness/health): <span className="font-medium">{formatPressure(entry.row.breakdown.ripenessWeatherPressure)} / {formatPressure(entry.row.breakdown.healthWeatherPressure)}</span></p>
                <p>Projected multiplier (ripeness/health): <span className="font-medium">x{formatNumber(getProgressionMultiplier(entry.row.ripenessNormalDelta, entry.row.ripenessDelta), { smartDecimals: true })} / x{formatNumber(getProgressionMultiplier(entry.row.healthNormalDelta, entry.row.healthDelta), { smartDecimals: true })}</span></p>
                <p>Projected delta (ripeness/health): <span className="font-medium">{formatPercentPoints(entry.row.ripenessDelta)} / {formatPercentPoints(entry.row.healthDelta)}</span></p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vineyard Weather Impact Preview</CardTitle>
            <CardDescription>Net next-week deltas from baseline progression scaled by weather multipliers. Site factors (aspect, altitude, terroir, soil) are included as bounded response modifiers.</CardDescription>
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
                          <UnifiedTooltip
                            title={`${row.weatherState} Weather`}
                            content={<p className="text-xs text-slate-200">{row.weatherStateImpact}</p>}
                            side="top"
                            variant="panel"
                            density="compact"
                          >
                            <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${getWeatherBadgeClass(row.weatherState)}`}>
                              <span>{getWeatherIcon(row.weatherState as any)}</span>
                              {row.weatherState}
                            </span>
                          </UnifiedTooltip>
                          <UnifiedTooltip
                            title={`${row.weatherIntensity} Intensity`}
                            content={<p className="text-xs text-slate-200">{row.weatherIntensityImpact}</p>}
                            side="top"
                            variant="panel"
                            density="compact"
                          >
                            <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${getIntensityBadgeClass(row.weatherIntensity)}`}>
                              <ThermometerSun className="h-3 w-3" />
                              {row.weatherIntensity}
                            </span>
                          </UnifiedTooltip>
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
                              <TooltipRow label="State factor" value={formatSigned(row.breakdown.weatherStateFactorRipeness)} monospaced />
                              <TooltipRow label="Intensity factor" value={`x${formatNumber(row.breakdown.weatherIntensityFactor, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Weather pressure" value={formatSigned(row.breakdown.ripenessWeatherPressure)} monospaced />
                              <TooltipRow label="Reference base delta" value={formatSigned(row.breakdown.baseRipenessDeviation)} monospaced />
                            </TooltipSection>
                            <TooltipSection title="Site Modifiers">
                              <TooltipRow label="Aspect" value={`x${formatNumber(row.breakdown.aspectResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Altitude" value={`x${formatNumber(row.breakdown.altitudeResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Terroir" value={`x${formatNumber(row.breakdown.terroirResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label={`Soil (${getSoilResponseLabel(row.breakdown.soilResponseSource)})`} value={`x${formatNumber(row.breakdown.soilResponse, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Combined site response" value={`x${formatNumber(row.siteResponse, { smartDecimals: true })}`} monospaced />
                            </TooltipSection>
                            <TooltipSection title="Result">
                              <TooltipRow label="Current" value={formatPercentValue(row.ripenessCurrent)} monospaced />
                              <TooltipRow label="Weather raw delta" value={formatSigned(row.breakdown.ripenessRawDelta)} monospaced />
                              <TooltipRow label="Weather final delta" value={formatSigned(row.ripenessWeatherDelta)} monospaced valueRating={row.ripenessWeatherDelta >= 0 ? 1 : 0} />
                              <TooltipRow label="Normal progression" value={formatSigned(row.ripenessNormalDelta)} monospaced valueRating={row.ripenessNormalDelta >= 0 ? 1 : 0} />
                              <TooltipRow label="Projected multiplier" value={`x${formatNumber(getProgressionMultiplier(row.ripenessNormalDelta, row.ripenessDelta), { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Net delta" value={formatSigned(row.ripenessDelta)} monospaced valueRating={row.ripenessDelta >= 0 ? 1 : 0} />
                              <TooltipRow label="Projected" value={formatPercentValue(row.ripenessProjected)} monospaced />
                              <TooltipRow label="Clamp range" value={WEATHER_CENTER_RIPENESS_CLAMP_LABEL} monospaced />
                              {row.breakdown.ripenessClamped && <p className="text-[11px] text-amber-400">Value was clamped to keep simulation stable.</p>}
                            </TooltipSection>
                          </div>
                        )}
                        triggerClassName="inline-flex justify-end"
                      >
                        <button type="button" className="inline-flex flex-col items-end gap-0.5 rounded border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 min-w-[188px]">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                            <Grape className="h-3.5 w-3.5 text-violet-600" />
                            Ripeness
                          </span>
                          <span className="text-[11px] text-slate-600">Season progression {formatPercentPoints(row.ripenessNormalDelta)}</span>
                          <span className="text-[11px] text-slate-600">{row.weatherState} {row.weatherIntensity}{' -> '}x{formatNumber(getProgressionMultiplier(row.ripenessNormalDelta, row.ripenessDelta), { smartDecimals: true })}</span>
                          <span className={`text-[11px] ${getDeltaTextClass(row.ripenessWeatherDelta)}`}>Weather contribution {formatPercentPoints(row.ripenessWeatherDelta)}</span>
                          <span>{formatPercentValue(row.ripenessCurrent)}{' -> '}{formatPercentValue(row.ripenessProjected)}</span>
                          <span className={`inline-flex items-center gap-1 ${getDeltaTextClass(row.ripenessDelta)}`}>
                            Projected {formatPercentPoints(row.ripenessDelta)}
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
                              <TooltipRow label="State factor" value={formatSigned(row.breakdown.weatherStateFactorHealth)} monospaced />
                              <TooltipRow label="Intensity factor" value={`x${formatNumber(row.breakdown.weatherIntensityFactor, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Weather pressure" value={formatSigned(row.breakdown.healthWeatherPressure)} monospaced />
                              <TooltipRow label="Reference base delta" value={formatSigned(row.breakdown.baseHealthDeviation)} monospaced />
                              <TooltipRow label="Seasonal adjustment" value={`x${formatNumber(row.breakdown.seasonAdjustmentMultiplier, { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Adjusted health base" value={formatSigned(row.breakdown.adjustedBaseHealthDeviation)} monospaced />
                            </TooltipSection>
                            <TooltipSection title="Site Modifiers">
                              <TooltipRow label="Combined site response" value={`x${formatNumber(row.siteResponse, { smartDecimals: true })}`} monospaced />
                              {row.breakdown.siteResponseClamped && <p className="text-[11px] text-amber-400">Raw site response was clamped to [0.7, 1.3].</p>}
                            </TooltipSection>
                            <TooltipSection title="Result">
                              <TooltipRow label="Current" value={formatPercentValue(row.healthCurrent)} monospaced />
                              <TooltipRow label="Weather raw delta" value={formatSigned(row.breakdown.healthRawDelta)} monospaced />
                              <TooltipRow label="Weather final delta" value={formatSigned(row.healthWeatherDelta)} monospaced valueRating={row.healthWeatherDelta >= 0 ? 1 : 0} />
                              <TooltipRow label="Normal progression" value={formatSigned(row.healthNormalDelta)} monospaced valueRating={row.healthNormalDelta >= 0 ? 1 : 0} />
                              <TooltipRow label="Projected multiplier" value={`x${formatNumber(getProgressionMultiplier(row.healthNormalDelta, row.healthDelta), { smartDecimals: true })}`} monospaced />
                              <TooltipRow label="Net delta" value={formatSigned(row.healthDelta)} monospaced valueRating={row.healthDelta >= 0 ? 1 : 0} />
                              <TooltipRow label="Projected" value={formatPercentValue(row.healthProjected)} monospaced />
                              <TooltipRow label="Clamp range" value={WEATHER_CENTER_HEALTH_CLAMP_LABEL} monospaced />
                              {row.breakdown.healthClamped && <p className="text-[11px] text-amber-400">Value was clamped to keep simulation stable.</p>}
                            </TooltipSection>
                          </div>
                        )}
                        triggerClassName="inline-flex justify-end"
                      >
                        <button type="button" className="inline-flex flex-col items-end gap-0.5 rounded border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 min-w-[188px]">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                            <Leaf className="h-3.5 w-3.5 text-emerald-700" />
                            Health
                          </span>
                          <span className="text-[11px] text-slate-600">Season progression {formatPercentPoints(row.healthNormalDelta)}</span>
                          <span className="text-[11px] text-slate-600">{row.weatherState} {row.weatherIntensity}{' -> '}x{formatNumber(getProgressionMultiplier(row.healthNormalDelta, row.healthDelta), { smartDecimals: true })}</span>
                          <span className={`text-[11px] ${getDeltaTextClass(row.healthWeatherDelta)}`}>Weather contribution {formatPercentPoints(row.healthWeatherDelta)}</span>
                          <span>{formatPercentValue(row.healthCurrent)}{' -> '}{formatPercentValue(row.healthProjected)}</span>
                          <span className={`inline-flex items-center gap-1 ${getDeltaTextClass(row.healthDelta)}`}>
                            Projected {formatPercentPoints(row.healthDelta)}
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
