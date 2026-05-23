import { useMemo } from 'react';
import { AlertTriangle, Gauge, HeartPulse, Info, TrendingUp } from 'lucide-react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TooltipRow, TooltipSection, UnifiedTooltip } from '@/components/ui';
import { useGameState, useGameStateWithData } from '@/hooks';
import { buildVineyardWeatherRows, buildWeatherContext, calculateWeatherImpactSummary, getAllVineyards, getCurrentCompany, getImpactMeterWidth, getSoilResponseLabel, getWeatherIcon } from '@/lib/services';
import { formatNumber, formatSigned, formatSignedPercent } from '@/lib/utils';

const WEATHER_CENTER_HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1400&h=500&fit=crop';
const WEATHER_CENTER_RIPENESS_CLAMP_LABEL = '[-0.0100, +0.0100]';
const WEATHER_CENTER_HEALTH_CLAMP_LABEL = '[-0.0120, +0.0040]';

function getDeltaTextClass(value: number): string {
  if (value > 0) return 'text-emerald-700';
  if (value < 0) return 'text-red-700';
  return 'text-slate-600';
}

export function WeatherCenterPage() {
  const gameState = useGameState();
  const vineyards = useGameStateWithData(getAllVineyards, [], { topic: 'vineyard' });
  const currentCompany = getCurrentCompany();

  const weatherContext = useMemo(() => {
    if (!currentCompany?.id) {
      return null;
    }
    return buildWeatherContext(gameState, currentCompany.id);
  }, [gameState, currentCompany?.id]);

  const vineyardRows = useMemo(() => {
    if (!weatherContext) {
      return [];
    }
    return buildVineyardWeatherRows(vineyards, weatherContext);
  }, [vineyards, weatherContext]);

  const impactSummary = useMemo(() => calculateWeatherImpactSummary(vineyardRows), [vineyardRows]);

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
                <Gauge className="h-4 w-4" />
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Vineyard Weather Impact Preview</CardTitle>
            <CardDescription>Net weather deltas from the current week context. Site factors (aspect, altitude, terroir, soil) are included as bounded response modifiers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
              Tip: hover or tap each delta value for a full modifier breakdown (weather base value, seasonal adjustment, site multipliers, and clamp boundaries).
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vineyard</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ripeness Delta</TableHead>
                  <TableHead className="text-right">Health Delta</TableHead>
                  <TableHead className="text-right">Site Response</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vineyardRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No planted vineyards available for weather preview.</TableCell>
                  </TableRow>
                )}
                {vineyardRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.state}</TableCell>
                    <TableCell className="text-right">
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
                              <TooltipRow label="Raw delta" value={formatSigned(row.breakdown.ripenessRawDelta)} monospaced />
                              <TooltipRow label="Final delta" value={formatSigned(row.ripenessDelta)} monospaced valueRating={row.ripenessDelta >= 0 ? 1 : 0} />
                              <TooltipRow label="Clamp range" value={WEATHER_CENTER_RIPENESS_CLAMP_LABEL} monospaced />
                              {row.breakdown.ripenessClamped && <p className="text-[11px] text-amber-400">Value was clamped to keep simulation stable.</p>}
                            </TooltipSection>
                          </div>
                        )}
                        triggerClassName="inline-flex justify-end"
                      >
                        <button type="button" className={`inline-flex items-center gap-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs font-medium ${getDeltaTextClass(row.ripenessDelta)}`}>
                          <span>{formatSigned(row.ripenessDelta)}</span>
                          <Info className="h-3 w-3 text-slate-500" />
                        </button>
                      </UnifiedTooltip>
                    </TableCell>
                    <TableCell className="text-right">
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
                              <TooltipRow label="Raw delta" value={formatSigned(row.breakdown.healthRawDelta)} monospaced />
                              <TooltipRow label="Final delta" value={formatSigned(row.healthDelta)} monospaced valueRating={row.healthDelta >= 0 ? 1 : 0} />
                              <TooltipRow label="Clamp range" value={WEATHER_CENTER_HEALTH_CLAMP_LABEL} monospaced />
                              {row.breakdown.healthClamped && <p className="text-[11px] text-amber-400">Value was clamped to keep simulation stable.</p>}
                            </TooltipSection>
                          </div>
                        )}
                        triggerClassName="inline-flex justify-end"
                      >
                        <button type="button" className={`inline-flex items-center gap-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs font-medium ${getDeltaTextClass(row.healthDelta)}`}>
                          <span>{formatSigned(row.healthDelta)}</span>
                          <Info className="h-3 w-3 text-slate-500" />
                        </button>
                      </UnifiedTooltip>
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-700">x{formatNumber(row.siteResponse, { smartDecimals: true })}</TableCell>
                    <TableCell>{row.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="grid gap-2 sm:grid-cols-2">
              {vineyardRows.slice(0, 4).map((row) => (
                <div key={`${row.id}-meter`} className="rounded-md border bg-slate-50 p-2.5">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{row.name}</span>
                    <span className={getDeltaTextClass(row.healthDelta)}>{formatSignedPercent(row.healthDelta)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${row.healthDelta >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${getImpactMeterWidth(row.healthDelta)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
    </div>
  );
}

export default WeatherCenterPage;
