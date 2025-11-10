import { useState, useEffect, useMemo } from 'react';
import { GrapeVariety } from '@/lib/types/types';
import { GRAPE_CONST, REGION_ALTITUDE_RANGES, REGION_HEAT_PROFILE } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Tabs, TabsList, TabsTrigger, TabsContent, WineCharacteristicsDisplay, UnifiedTooltip, tooltipStyles } from '@/components/ui';
import { DialogProps } from '@/lib/types/UItypes';
import { formatNumber, getColorClass, getGrapeDifficultyCategory, getGrapeDifficultyDescription } from '@/lib/utils/utils';
import { GrapeIcon } from '@/lib/utils/icons';
import { calculateGrapeDifficulty } from '@/lib/services';
import { GrapeDifficultyComponents } from '@/lib/services/wine/features/grapeDifficulty';
import { GRAPE_ALTITUDE_SUITABILITY, GRAPE_SUN_PREFERENCES } from '@/lib/constants/grapeConstants';
import { REGION_GRAPE_SUITABILITY as REGION_MATCHES } from '@/lib/constants/grapeConstants';

// Utility function for formatting percentage
const formatPercentage = (value: number): string => `${formatNumber(value * 100, { smartDecimals: true })}%`;

interface GrapeInfoViewProps extends DialogProps {
  grapeName: GrapeVariety;
}

interface AltitudeExample {
  country: string;
  region: string;
  range: readonly [number, number];
  diff: number;
}

interface SunExample {
  country: string;
  region: string;
  heat: number;
  diff: number;
}

const DIFFICULTY_COMPONENT_LABELS: Record<keyof GrapeDifficultyComponents, string> = {
  handling: 'Handling',
  yield: 'Yield',
  balance: 'Balance',
  aging: 'Aging',
  grapeSuitability: 'Grape Suitability',
};

export const GrapeInfoView: React.FC<GrapeInfoViewProps> = ({ grapeName, onClose }) => {
  const grapeMetadata = GRAPE_CONST[grapeName];
  if (!grapeMetadata) {
    return (
      <div className="p-4 text-center text-red-600">
        Error: Grape variety "{grapeName}" not found.
        <Button onClick={onClose} variant="outline" size="sm" className="ml-4">Close</Button>
      </div>
    );
  }

  const difficulty = useMemo(() => calculateGrapeDifficulty(grapeName), [grapeName]);
  const difficultyCategory = getGrapeDifficultyCategory(difficulty.score);
  const difficultyDescription = getGrapeDifficultyDescription(difficulty.score);
  const altitudeProfile = GRAPE_ALTITUDE_SUITABILITY[grapeName];
  const sunProfile = GRAPE_SUN_PREFERENCES[grapeName];

  function getTopRegions(count: number = 3): Array<{ country: string; region: string; score: number }> {
    const entries: Array<{ country: string; region: string; score: number }> = [];
    Object.entries(REGION_MATCHES).forEach(([country, regions]) => {
      Object.entries(regions).forEach(([region, scores]) => {
        const score = scores[grapeName];
        if (typeof score === 'number') {
          entries.push({ country, region, score });
        }
      });
    });
    return entries
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  const topRegions = getTopRegions();
  const colorClass = grapeMetadata.grapeColor === 'red' ? 'text-rose-500' : 'text-sky-500';

  const describeAltitude = (preferred: readonly [number, number]) => {
    const avg = (preferred[0] + preferred[1]) / 2;
    if (avg < 150) return 'lowland valley floors';
    if (avg < 300) return 'gentle rolling hills';
    if (avg < 500) return 'elevated foothills';
    if (avg < 700) return 'cool highland slopes';
    return 'lofty mountain ridgelines';
  };

  const describeSun = (min: number, max: number) => {
    const avg = (min + max) / 2;
    if (avg < 0.35) return 'fog-kissed coastal light';
    if (avg < 0.5) return 'temperate hillside sunshine';
    if (avg < 0.65) return 'warm Mediterranean rays';
    if (avg < 0.8) return 'sun-soaked plateau heat';
    return 'intense sun-baked exposure';
  };

  function findAltitudeExample(): AltitudeExample | null {
    if (!altitudeProfile) return null;
    const preferredMid = (altitudeProfile.preferred[0] + altitudeProfile.preferred[1]) / 2;
    let best: AltitudeExample | null = null;
    Object.entries(REGION_ALTITUDE_RANGES).forEach(([country, regions]) => {
      Object.entries(regions).forEach(([region, range]) => {
        const mid = (range[0] + range[1]) / 2;
        const diff = Math.abs(mid - preferredMid);
        if (!best || diff < best.diff) {
          best = { country, region, range, diff };
        }
      });
    });
    return best;
  }

  function findSunExample(): SunExample | null {
    if (!sunProfile) return null;
    const targetMid = (sunProfile.optimalHeatMin + sunProfile.optimalHeatMax) / 2;
    let best: SunExample | null = null;
    Object.entries(REGION_HEAT_PROFILE).forEach(([country, regions]) => {
      Object.entries(regions).forEach(([region, heat]) => {
        const diff = Math.abs(heat - targetMid);
        if (!best || diff < best.diff) {
          best = { country, region, heat, diff };
        }
      });
    });
    return best;
  }

  const altitudeExample = findAltitudeExample();
  const sunExample = findSunExample();

  const regionSuitabilityDetails = difficulty.details.grapeSuitability?.regions ?? [];
  const regionsBySuitability = useMemo(
    () => [...regionSuitabilityDetails].sort((a, b) => b.regionMatch - a.regionMatch),
    [regionSuitabilityDetails]
  );
  const regionsByAltitude = useMemo(
    () =>
      regionSuitabilityDetails
    .filter(detail => detail.altitudeMatch !== null && detail.altitudeMatch !== undefined)
        .sort((a, b) => (b.altitudeMatch ?? 0) - (a.altitudeMatch ?? 0)),
    [regionSuitabilityDetails]
  );
  const regionsBySun = useMemo(
    () =>
      regionSuitabilityDetails
    .filter(detail => detail.sunMatch !== null && detail.sunMatch !== undefined)
        .sort((a, b) => (b.sunMatch ?? 0) - (a.sunMatch ?? 0)),
    [regionSuitabilityDetails]
  );

  const suitabilityCountries = useMemo(
    () => Array.from(new Set(regionSuitabilityDetails.map(detail => detail.country))),
    [regionSuitabilityDetails]
  );

  const [suitabilityCountry, setSuitabilityCountry] = useState<string>(
    regionSuitabilityDetails[0]?.country ?? suitabilityCountries[0] ?? ''
  );

  useEffect(() => {
    setSuitabilityCountry(prev => {
      if (suitabilityCountries.length === 0) {
        return '';
      }
      if (suitabilityCountries.includes(prev)) {
        return prev;
      }
      return suitabilityCountries[0];
    });
  }, [suitabilityCountries]);

  const filteredRegionsBySuitability = useMemo(
    () =>
      regionsBySuitability.filter(detail =>
        suitabilityCountry ? detail.country === suitabilityCountry : true
      ),
    [regionsBySuitability, suitabilityCountry]
  );
  const filteredRegionsByAltitude = useMemo(
    () =>
      regionsByAltitude.filter(detail =>
        suitabilityCountry ? detail.country === suitabilityCountry : true
      ),
    [regionsByAltitude, suitabilityCountry]
  );
  const filteredRegionsBySun = useMemo(
    () =>
      regionsBySun.filter(detail =>
        suitabilityCountry ? detail.country === suitabilityCountry : true
      ),
    [regionsBySun, suitabilityCountry]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-4xl max-h-[85vh] shadow-lg flex flex-col scrollbar-styled">
        <CardHeader className="flex flex-row justify-between items-center border-b pb-4">
        <div className="flex items-center gap-4">
          <div>
            <GrapeIcon 
              variety={grapeName} 
              size="xl" 
              className="w-12 h-12"
              rounded={true}
            />
          </div>
          <div>
            <div className="flex items-center gap-3">
          <CardTitle className="text-2xl font-bold text-wine">{grapeMetadata.name}</CardTitle>
              <Badge variant={grapeMetadata.grapeColor === 'red' ? 'destructive' : 'secondary'} className="uppercase tracking-wide">
                {grapeMetadata.grapeColor}
              </Badge>
            </div>
            <UnifiedTooltip
              title="Grape Difficulty"
              content={
                <div className={tooltipStyles.text}>
                  <p className="mb-2">{difficultyDescription}</p>
                  <p className="mt-2">
                    Coverage looks only at the grape. It measures how wide the grape’s tolerance band is relative to the full range we model (global altitude span, or 0–1 heat scale). Wider tolerance → higher coverage → easier grape because it can cope with more conditions in theory.
                  </p>
                  <p className="mt-2">
                    Match looks at the world. For each region/aspect, we ask “how much of this region’s actual conditions fall inside the grape’s band?” and average those overlaps. A grape might have huge coverage but low match if vineyards rarely fall inside that band.
                  </p>
                </div>
              }
              side="top"
              sideOffset={8}
              variant="panel"
              density="compact"
            >
              <div
                className="mt-2 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold border border-wine/30 bg-wine/10 text-wine-dark cursor-help"
              >
                Grape Difficulty: {difficultyCategory} ·{' '}
                <span className={`${getColorClass(difficulty.score)} ml-1`}>
                  {formatNumber(difficulty.score, { percent: true, percentIsDecimal: true, decimals: 0 })}
                </span>
              </div>
            </UnifiedTooltip>
          </div>
        </div>
        <Button onClick={onClose} variant="ghost" size="sm">✕</Button>
        </CardHeader>
        
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto scrollbar-styled">
        {/* Overview */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-wine-dark">Grape Overview</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            <span className="font-medium">{grapeMetadata.name}</span> is a <span className={`font-medium ${colorClass}`}>{grapeMetadata.grapeColor}</span> variety with a natural yield of{' '}
            <span className={getColorClass(grapeMetadata.naturalYield)}>{formatPercentage(grapeMetadata.naturalYield)}</span>. It
            {grapeMetadata.fragile > 0.5 ? ' tends to be delicate' : ' is relatively sturdy'} (fragility{' '}
            <span className={getColorClass(1 - grapeMetadata.fragile)}>{formatPercentage(grapeMetadata.fragile)}</span>) and is{' '}
            {grapeMetadata.proneToOxidation > 0.5 ? 'highly sensitive' : 'fairly resistant'} to oxidation (
            <span className={getColorClass(1 - grapeMetadata.proneToOxidation)}>{formatPercentage(grapeMetadata.proneToOxidation)}</span>). These base traits feed directly into the difficulty breakdown.
          </p>
          {topRegions.length > 0 && (
            <p className="text-sm text-gray-700 leading-relaxed">
              Top growing conditions include {topRegions.map(({ region, country, score }, index) => (
                <span key={`${country}-${region}`}>
                  {index > 0 ? (index === topRegions.length - 1 ? ' and ' : ', ') : ' '}
                  <span className="font-medium">{region}</span>, {country} ({formatPercentage(score)} match)
                </span>
              ))}.
            </p>
          )}
          {altitudeProfile && sunProfile && (
            <p className="text-sm text-gray-700 leading-relaxed">
              It thrives in {describeAltitude(altitudeProfile.preferred)} around {altitudeProfile.preferred[0]}–{altitudeProfile.preferred[1]} m, yet stays comfortable anywhere between {altitudeProfile.tolerance[0]} and {altitudeProfile.tolerance[1]} m. Pair it with {describeSun(sunProfile.optimalHeatMin, sunProfile.optimalHeatMax)}—heat index {formatPercentage(sunProfile.optimalHeatMin)}–{formatPercentage(sunProfile.optimalHeatMax)} with ±{formatPercentage(sunProfile.tolerance)} flex—and the grape settles in happily.
              {altitudeExample && (
                <>
                  {' '}Think <span className="font-medium">{altitudeExample.region}</span>, {altitudeExample.country} ({altitudeExample.range[0]}–{altitudeExample.range[1]} m) for altitude,
                </>
              )}
              {sunExample && (
                <>
                  {' '}and <span className="font-medium">{sunExample.region}</span>, {sunExample.country} (heat index ~{formatPercentage(sunExample.heat)}) for sunshine.
                </>
              )}
            </p>
          )}
        </div>

        {/* Grape Characteristics */}
        <div className="space-y-1">
          <h3 className="text-lg font-semibold mb-2 text-wine-dark">Grape Characteristics</h3>
          <WineCharacteristicsDisplay 
            characteristics={grapeMetadata.baseCharacteristics} 
            collapsible={false}
            defaultExpanded={true}
            title=""
          />
        </div>

        {/* Grape Difficulty */}
        <div className="md:col-span-2 space-y-3">
          <h3 className="text-lg font-semibold text-wine-dark">Grape Difficulty</h3>
          <table className="w-full text-sm">
            <tbody>
              {(Object.keys(DIFFICULTY_COMPONENT_LABELS) as Array<keyof GrapeDifficultyComponents>).map(componentKey => {
                const componentScore = difficulty.components[componentKey];
                const suitabilityDetails = componentKey === 'grapeSuitability'
                  ? difficulty.details.grapeSuitability
                  : undefined;
                const componentColor = getColorClass(componentScore);
                return (
                  <tr key={componentKey} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 align-top">
                      {componentKey === 'handling' ? (
                        <UnifiedTooltip
                          title="Handling Difficulty"
                          content={
                            <div className={tooltipStyles.text}>
                              <p>Handling combines the grape&apos;s fragility and oxidation sensitivity.</p>
                              <p className="mt-2">Higher values mean the grape bruises easily or oxidises quickly, so it demands gentler harvesting, pressing, and cellaring.</p>
                              <p className="mt-2">Handling score = average of fragility and oxidation proneness.</p>
                            </div>
                          }
                          side="top"
                          sideOffset={6}
                          variant="panel"
                          density="compact"
                        >
                          <div className="font-medium inline-flex items-center gap-1 cursor-help">
                            {DIFFICULTY_COMPONENT_LABELS[componentKey]}
                          </div>
                        </UnifiedTooltip>
                      ) : componentKey === 'grapeSuitability' ? (
                        <UnifiedTooltip
                          title="Grape Suitability"
                          content={
                            <div className={tooltipStyles.text}>
                              <p>Grape suitability blends regional fit with altitude tolerance and sun exposure requirements to show how forgiving the grape is when scouting sites.</p>
                              <hr className="my-2 border-muted-foreground/40" />
                              <p>
                                <strong>Coverage</strong> looks only at the grape. It measures how wide the grape’s tolerance band is relative to the full range we model (global altitude span, or 0–1 heat scale). Wider tolerance → higher coverage → easier grape because it can cope with more conditions in theory.
                              </p>
                              <p className="mt-2">
                                <strong>Match</strong> looks at the world. For each region/aspect, we ask “how much of this region’s actual conditions fall inside the grape’s band?” and average those overlaps. A grape can have huge coverage but low match if vineyards rarely fall inside that band.
                              </p>
                              <hr className="my-2 border-muted-foreground/40" />
                              <p>
                                Suitability score = weighted average of Region match (50%), Altitude match (25%), and Sun match (25%).
                              </p>
                            </div>
                          }
                          side="top"
                          sideOffset={6}
                          variant="panel"
                          density="compact"
                        >
                          <div className="font-medium inline-flex items-center gap-1 cursor-help">
                            {DIFFICULTY_COMPONENT_LABELS[componentKey]}
                          </div>
                        </UnifiedTooltip>
                      ) : componentKey === 'yield' ? (
                        <UnifiedTooltip
                          title="Yield Difficulty"
                          content={
                            <div className={tooltipStyles.text}>
                              <p>Yield difficulty captures how picky the grape is about hitting production targets.</p>
                              <p className="mt-2">It inverts the grape&apos;s natural yield—varieties with naturally low output are harder to satisfy commercially and need more land or careful canopy management.</p>
                              <p className="mt-2">Yield score = 1 − natural yield factor.</p>
                            </div>
                          }
                          side="top"
                          sideOffset={6}
                          variant="panel"
                          density="compact"
                        >
                          <div className="font-medium inline-flex items-center gap-1 cursor-help">
                            {DIFFICULTY_COMPONENT_LABELS[componentKey]}
                          </div>
                        </UnifiedTooltip>
                      ) : componentKey === 'balance' ? (
                        <UnifiedTooltip
                          title="Balance Difficulty"
                          content={
                            <div className={tooltipStyles.text}>
                              <p>Balance difficulty measures how far the grape&apos;s base characteristics sit from the &quot;balanced&quot; sweet spots.</p>
                              <p className="mt-2">The more extreme the natural profile (acidity, body, tannins, etc.), the more work it takes to craft a harmonious wine.</p>
                              <p className="mt-2">Balance score = average deviation from the balanced characteristic ranges.</p>
                            </div>
                          }
                          side="top"
                          sideOffset={6}
                          variant="panel"
                          density="compact"
                        >
                          <div className="font-medium inline-flex items-center gap-1 cursor-help">
                            {DIFFICULTY_COMPONENT_LABELS[componentKey]}
                          </div>
                        </UnifiedTooltip>
                      ) : componentKey === 'aging' ? (
                        <UnifiedTooltip
                          title="Aging Difficulty"
                          content={
                            <div className={tooltipStyles.text}>
                              <p>Aging difficulty reflects how long the grape takes to reach its peak and how demanding that journey is.</p>
                              <p className="mt-2">It blends the span between early and late peak with the &quot;age worthiness&quot; rating—longer spans and high-worthiness grapes require more cellar time and monitoring.</p>
                              <p className="mt-2">Aging score = average of normalized peak span and age worthiness factor.</p>
                            </div>
                          }
                          side="top"
                          sideOffset={6}
                          variant="panel"
                          density="compact"
                        >
                          <div className="font-medium inline-flex items-center gap-1 cursor-help">
                            {DIFFICULTY_COMPONENT_LABELS[componentKey]}
                          </div>
                        </UnifiedTooltip>
                      ) : (
                        <div className="font-medium">{DIFFICULTY_COMPONENT_LABELS[componentKey]}</div>
                      )}
                    </td>
                    <td className="py-2 text-right align-top">
                      <div className={`font-semibold ${componentColor}`}>
                      {formatNumber(componentScore, { percent: true, percentIsDecimal: true, decimals: 0 })}
                      </div>
                      {componentKey === 'handling' && (
                        <div className="flex justify-end items-center gap-2 mt-1 text-xs">
                          <span className="text-muted-foreground">Fragility · Oxidation</span>
                          <span className="flex items-center gap-1 font-medium">
                            <span className={getColorClass(1 - grapeMetadata.fragile)}>
                              {formatNumber(grapeMetadata.fragile, { percent: true, percentIsDecimal: true, decimals: 0 })}
                            </span>
                            <span className="text-muted-foreground">/</span>
                            <span className={getColorClass(1 - grapeMetadata.proneToOxidation)}>
                              {formatNumber(grapeMetadata.proneToOxidation, { percent: true, percentIsDecimal: true, decimals: 0 })}
                            </span>
                          </span>
                        </div>
                      )}
                      {suitabilityDetails && componentKey === 'grapeSuitability' && (
                        <div className="mt-1 text-xs space-y-1 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <span className="text-muted-foreground">Region match:</span>
                            <span className={`font-medium ${getColorClass(suitabilityDetails.regionAverage)}`}>
                              {formatNumber(suitabilityDetails.regionAverage, { percent: true, percentIsDecimal: true, decimals: 0 })}
                            </span>
                          </div>
                          <div className="flex justify-end items-center gap-2">
                            <span className="text-muted-foreground">Altitude match:</span>
                            <span className={`font-medium ${getColorClass(suitabilityDetails.altitudeAverage)}`}>
                              {formatNumber(suitabilityDetails.altitudeAverage, { percent: true, percentIsDecimal: true, decimals: 0 })}
                            </span>
                            <span className="text-muted-foreground">Coverage:</span>
                            <span className={`font-medium ${getColorClass(suitabilityDetails.altitudeCoverage)}`}>
                              {formatNumber(suitabilityDetails.altitudeCoverage, { percent: true, percentIsDecimal: true, decimals: 0 })}
                            </span>
                          </div>
                          <div className="flex justify-end items-center gap-2">
                            <span className="text-muted-foreground">Sun match:</span>
                            <span className={`font-medium ${getColorClass(suitabilityDetails.sunAverage)}`}>
                              {formatNumber(suitabilityDetails.sunAverage, { percent: true, percentIsDecimal: true, decimals: 0 })}
                            </span>
                            <span className="text-muted-foreground">Coverage:</span>
                            <span className={`font-medium ${getColorClass(suitabilityDetails.sunCoverage)}`}>
                              {formatNumber(suitabilityDetails.sunCoverage, { percent: true, percentIsDecimal: true, decimals: 0 })}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {regionSuitabilityDetails.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-md font-semibold text-wine-dark">Grape Suitability</h4>
              <Tabs defaultValue="region">
              <TabsList className="grid grid-cols-3 w-full md:w-auto">
                <TabsTrigger value="region">Regions</TabsTrigger>
                <TabsTrigger value="altitude">Altitude</TabsTrigger>
                <TabsTrigger value="sun">Sun Exposure</TabsTrigger>
              </TabsList>

              {suitabilityCountries.length > 0 && (
                <div className="flex flex-wrap gap-2 border-b pb-3 mt-3">
                  {suitabilityCountries.map(country => (
                    <Button
                      key={country}
                      variant={suitabilityCountry === country ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSuitabilityCountry(country)}
                      className={suitabilityCountry === country ? 'bg-wine hover:bg-wine-dark' : ''}
                    >
                      {country}
                    </Button>
                  ))}
                </div>
              )}

              <TabsContent value="region">
                {filteredRegionsBySuitability.length > 0 ? (
                  <div className="mt-3 max-h-64 overflow-y-auto pr-1">
                    <table className="w-full text-sm">
                      <tbody>
                        {filteredRegionsBySuitability.map(detail => (
                          <tr key={`${detail.country}-${detail.region}`} className="border-b last:border-b-0">
                            <td className="py-2 pr-4">
                              <span className="font-medium">{detail.region}</span>
                              <span className="text-muted-foreground">, {detail.country}</span>
                            </td>
                            <td className={`py-2 text-right font-semibold ${getColorClass(detail.regionMatch)}`}>
                              {formatNumber(detail.regionMatch, { percent: true, percentIsDecimal: true, decimals: 0 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No regional suitability data available.</p>
                )}
              </TabsContent>

              <TabsContent value="altitude">
                {filteredRegionsByAltitude.length > 0 ? (
                  <div className="mt-3 max-h-64 overflow-y-auto pr-1">
                    <table className="w-full text-sm">
                      <tbody>
                        {filteredRegionsByAltitude.map(detail => (
                          <tr key={`${detail.country}-${detail.region}`} className="border-b last:border-b-0">
                            <td className="py-2 pr-4">
                              <span className="font-medium">{detail.region}</span>
                              <span className="text-muted-foreground">, {detail.country}</span>
                              <div className="text-xs text-muted-foreground">
                                {detail.altitudeRange ? `${detail.altitudeRange[0]}–${detail.altitudeRange[1]} m` : 'No altitude data'}
                              </div>
                            </td>
                            <td className={`py-2 text-right font-semibold ${getColorClass(detail.altitudeMatch ?? 0)}`}>
                              {detail.altitudeMatch !== null
                                ? formatNumber(detail.altitudeMatch ?? 0, { percent: true, percentIsDecimal: true, decimals: 0 })
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No altitude overlap data available.</p>
                )}
              </TabsContent>

              <TabsContent value="sun">
                {filteredRegionsBySun.length > 0 ? (
                  <div className="mt-3 max-h-64 overflow-y-auto pr-1">
                    <table className="w-full text-sm">
                      <tbody>
                        {filteredRegionsBySun.map(detail => (
                          <tr key={`${detail.country}-${detail.region}`} className="border-b last:border-b-0">
                            <td className="py-2 pr-4">
                              <span className="font-medium">{detail.region}</span>
                              <span className="text-muted-foreground">, {detail.country}</span>
                              <div className="text-xs text-muted-foreground">
                                {detail.sunIndex !== undefined
                                  ? `Heat index ≈ ${formatNumber(detail.sunIndex, { percent: true, percentIsDecimal: true, decimals: 0 })}`
                                  : 'No sun index data'}
                              </div>
                            </td>
                            <td className={`py-2 text-right font-semibold ${getColorClass(detail.sunMatch ?? 0)}`}>
                              {detail.sunMatch !== null
                                ? formatNumber(detail.sunMatch ?? 0, { percent: true, percentIsDecimal: true, decimals: 0 })
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No sun exposure data available.</p>
                )}
              </TabsContent>
              </Tabs>
            </div>
          )}

        </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GrapeInfoView;
