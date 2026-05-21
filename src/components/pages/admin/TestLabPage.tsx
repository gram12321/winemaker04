import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eraser, Play, ShieldCheck, TestTube2, XCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui';
import { useLoadingState } from '@/hooks';
import { isDevAdminSurfaceAvailable } from '@/lib/services/admin/testLab/devAdminGate';
import { getTestLabScenarios, VINEYARD_CONFIG_PARAM_KEYS } from '@/lib/services/admin/testLab/testLabScenarios';
import { runTestLabScenario } from '@/lib/services/admin/testLab/testLabRunner';
import type { TestLabParamField, TestLabRunMode, TestLabScenarioDefinition, TestLabScenarioResult } from '@/lib/services/admin/testLab/types';
import { COUNTRY_REGION_MAP, REGION_ALTITUDE_RANGES } from '@/lib/constants/vineyardConstants';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';
import type { Vineyard } from '@/lib/types/types';

interface RecentRun {
  runId: string;
  scenarioId: string;
  status: string;
  summary: string;
  timestamp: string;
}

const RECENT_RUNS_KEY = 'adminTestLabRecentRuns';

const statusIcon = (status: string) => {
  if (status === 'passed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-600" />;
  return <AlertTriangle className="h-4 w-4 text-amber-600" />;
};

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'passed') return 'default';
  if (status === 'failed') return 'destructive';
  return 'outline';
};

const readRecentRuns = (): RecentRun[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_RUNS_KEY) || '[]') as RecentRun[];
  } catch {
    return [];
  }
};

const writeRecentRuns = (runs: RecentRun[]): void => {
  try {
    localStorage.setItem(RECENT_RUNS_KEY, JSON.stringify(runs.slice(0, 12)));
  } catch {
    // localStorage is best-effort for this dev tool.
  }
};

const buildInitialParams = (scenario: TestLabScenarioDefinition): Record<string, string | number | boolean> => ({
  ...scenario.defaultParams
});

const getRegionOptionsForCountry = (country: string): string[] => {
  const knownRegions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
  return knownRegions ? [...knownRegions] : [];
};

const getAltitudeRangeForRegion = (country: string, region: string): [number, number] => {
  const countryRanges = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
  if (!countryRanges) return [0, 1200];
  const range = (countryRanges as Record<string, readonly [number, number]>)[region];
  return range ? [range[0], range[1]] : [0, 1200];
};

const clampAltitudeToRegion = (altitude: number, country: string, region: string): number => {
  const [min, max] = getAltitudeRangeForRegion(country, region);
  if (altitude >= min && altitude <= max) return altitude;
  return Math.round((min + max) / 2 / 10) * 10;
};

export default function TestLabPage() {
  const scenarios = useMemo(() => getTestLabScenarios(), []);
  const groupedScenarios = useMemo(() => {
    return scenarios.reduce<Record<string, TestLabScenarioDefinition[]>>((groups, scenario) => {
      groups[scenario.group] = [...(groups[scenario.group] || []), scenario];
      return groups;
    }, {});
  }, [scenarios]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id || '');
  const selectedScenario = scenarios.find(scenario => scenario.id === selectedScenarioId) || scenarios[0];
  const [params, setParams] = useState<Record<string, string | number | boolean>>(
    selectedScenario ? buildInitialParams(selectedScenario) : {}
  );
  const [result, setResult] = useState<TestLabScenarioResult | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [existingVineyards, setExistingVineyards] = useState<Vineyard[]>([]);
  const { isLoading, withLoading } = useLoadingState();
  const devAvailable = isDevAdminSurfaceAvailable();

  useEffect(() => {
    setRecentRuns(readRecentRuns());
    loadVineyards().then(setExistingVineyards).catch(() => {});
  }, []);

  const selectScenario = (scenario: TestLabScenarioDefinition) => {
    setSelectedScenarioId(scenario.id);
    setParams(buildInitialParams(scenario));
  };

  const rememberRun = (scenarioResult: TestLabScenarioResult) => {
    const nextRuns = [
      {
        runId: scenarioResult.runId,
        scenarioId: scenarioResult.scenarioId,
        status: scenarioResult.status,
        summary: scenarioResult.summary,
        timestamp: new Date().toISOString()
      },
      ...recentRuns.filter(run => run.runId !== scenarioResult.runId)
    ].slice(0, 12);

    setRecentRuns(nextRuns);
    writeRecentRuns(nextRuns);
  };

  const runScenario = (mode: TestLabRunMode = 'run') => withLoading(async () => {
    if (!selectedScenario) return;

    const scenarioResult = await runTestLabScenario({
      scenarioId: selectedScenario.id,
      params,
      mode
    });
    setResult(scenarioResult);
    rememberRun(scenarioResult);
  });

  const runFullRegression = () => withLoading(async () => {
    const scenarioResult = await runTestLabScenario({
      scenarioId: 'regression.full-suite',
      mode: 'run',
      params: { target: '' }
    });
    setResult(scenarioResult);
    rememberRun(scenarioResult);
  });

  const cleanupRun = (runId: string) => withLoading(async () => {
    const cleanupResult = await runTestLabScenario({
      scenarioId: 'cleanup.by-run-id',
      mode: 'run',
      params: { runId }
    });
    setResult(cleanupResult);
    rememberRun(cleanupResult);
  });

  const renderParamControl = (field: TestLabParamField) => {
    // Hide vineyard config fields when an existing vineyard is selected.
    const scenarioHasVineyardPicker = selectedScenario?.params.some(p => p.key === 'vineyardId');
    const selectedVineyardId = String(params.vineyardId ?? 'new');
    if (scenarioHasVineyardPicker && VINEYARD_CONFIG_PARAM_KEYS.has(field.key) && selectedVineyardId !== 'new') {
      return null;
    }

    const value = params[field.key] ?? field.defaultValue;

    if (field.type === 'boolean') {
      return (
        <div key={field.key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <Label htmlFor={`test-lab-${field.key}`} className="text-sm">{field.label}</Label>
          <Switch
            id={`test-lab-${field.key}`}
            checked={Boolean(value)}
            onCheckedChange={(checked) => setParams(current => ({ ...current, [field.key]: checked }))}
          />
        </div>
      );
    }

    if (field.type === 'select') {
      const isCountryField = field.key === 'country';
      const isRegionField = field.key === 'region';
      const isVineyardPickerField = field.key === 'vineyardId';

      const rawOptions = field.options || [];
      const selectedCountry = String(params.country ?? '');
      const allowedRegions = isRegionField ? getRegionOptionsForCountry(selectedCountry) : [];

      // vineyardId: prepend static 'new' option with all current company vineyards from DB.
      const vineyardPickerOptions = isVineyardPickerField
        ? [
            { label: 'Create test vineyard', value: 'new' },
            ...existingVineyards.map(v => ({ label: v.name, value: v.id }))
          ]
        : null;

      const selectOptions = vineyardPickerOptions
        ?? (isRegionField ? rawOptions.filter(option => allowedRegions.includes(String(option.value))) : rawOptions);

      return (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={`test-lab-${field.key}`} className="text-xs">{field.label}</Label>
          <Select
            value={String(value)}
            onValueChange={(nextValue) => {
              setParams(current => {
                if (!isCountryField && !isRegionField) {
                  return { ...current, [field.key]: nextValue };
                }

                if (isRegionField) {
                  const country = String(current.country ?? '');
                  const newAlt = clampAltitudeToRegion(Number(current.altitude ?? 0), country, nextValue);
                  return { ...current, region: nextValue, altitude: newAlt };
                }

                // Country change: auto-correct region and altitude
                const nextRegions = getRegionOptionsForCountry(nextValue);
                const currentRegion = String(current.region ?? '');
                const fallbackRegion = nextRegions[0] ?? '';
                const resolvedRegion = nextRegions.includes(currentRegion) ? currentRegion : fallbackRegion;
                const newAlt = clampAltitudeToRegion(Number(current.altitude ?? 0), nextValue, resolvedRegion);

                return {
                  ...current,
                  country: nextValue,
                  region: resolvedRegion,
                  altitude: newAlt
                };
              });
            }}
          >
            <SelectTrigger id={`test-lab-${field.key}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map(option => (
                <SelectItem key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    const resolvedMin = field.key === 'altitude'
      ? getAltitudeRangeForRegion(String(params.country ?? ''), String(params.region ?? ''))[0]
      : field.min;
    const resolvedMax = field.key === 'altitude'
      ? getAltitudeRangeForRegion(String(params.country ?? ''), String(params.region ?? ''))[1]
      : field.max;

    return (
      <div key={field.key} className="space-y-1.5">
        <Label htmlFor={`test-lab-${field.key}`} className="text-xs">{field.label}</Label>
        <Input
          id={`test-lab-${field.key}`}
          type={field.type === 'number' ? 'number' : 'text'}
          value={String(value)}
          min={resolvedMin}
          max={resolvedMax}
          step={field.step}
          onChange={(event) => {
            const nextValue = field.type === 'number'
              ? Number(event.target.value)
              : event.target.value;
            setParams(current => ({ ...current, [field.key]: nextValue }));
          }}
        />
      </div>
    );
  };

  if (!devAvailable) {
    return (
      <Card className="border-amber-300 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <ShieldCheck className="h-5 w-5" />
            Admin Test Lab Unavailable
          </CardTitle>
          <CardDescription className="text-amber-800">
            The Test Lab only renders during development on localhost or loopback hosts.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-green-200 bg-green-50 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-green-700" />
          <div>
            <p className="text-sm font-semibold text-green-900">Development localhost mode</p>
            <p className="text-xs text-green-800">Scenario writes are tagged with durable run ids and can be cleaned up after reload.</p>
          </div>
        </div>
        <Button onClick={runFullRegression} disabled={isLoading} size="sm" className="gap-2">
          <TestTube2 className="h-4 w-4" />
          Run Regression Suite
        </Button>
      </div>

      <Tabs defaultValue="scenarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="recent">Recent Runs</TabsTrigger>
          <TabsTrigger value="result">Result</TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className="space-y-3">
            {Object.entries(groupedScenarios).map(([group, groupScenarios]) => (
              <Card key={group}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{group}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {groupScenarios.map(scenario => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => selectScenario(scenario)}
                      className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${
                        selectedScenarioId === scenario.id
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{scenario.title}</span>
                        {scenario.mutatesData && <Badge variant="outline">writes</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{scenario.description}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedScenario && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{selectedScenario.title}</CardTitle>
                    <CardDescription>{selectedScenario.description}</CardDescription>
                  </div>
                  <Badge variant={selectedScenario.mutatesData ? 'outline' : 'secondary'}>
                    {selectedScenario.mutatesData ? 'mutating' : 'read-only'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {selectedScenario.params.map(renderParamControl)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => runScenario('run')} disabled={isLoading} className="gap-2">
                    <Play className="h-4 w-4" />
                    Run
                  </Button>
                  <Button onClick={() => runScenario('dryRun')} disabled={isLoading} variant="outline">
                    Dry Run
                  </Button>
                  {result?.runId && (
                    <Button onClick={() => cleanupRun(result.runId)} disabled={isLoading} variant="destructive" className="gap-2">
                      <Eraser className="h-4 w-4" />
                      Cleanup Last Run
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Runs</CardTitle>
              <CardDescription>Stored locally so cleanup can be triggered after navigation.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Run</TableHead>
                    <TableHead>Scenario</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="w-28">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRuns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">No runs yet.</TableCell>
                    </TableRow>
                  )}
                  {recentRuns.map(run => (
                    <TableRow key={`${run.runId}-${run.timestamp}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {statusIcon(run.status)}
                          <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{run.runId}</TableCell>
                      <TableCell className="text-sm">{run.scenarioId}</TableCell>
                      <TableCell className="text-sm">{run.summary}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => cleanupRun(run.runId)} disabled={isLoading}>
                          Cleanup
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="result">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result ? statusIcon(result.status) : <TestTube2 className="h-4 w-4" />}
                Result
              </CardTitle>
              <CardDescription>{result?.summary || 'No scenario has run in this session.'}</CardDescription>
            </CardHeader>
            {result && (
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(result.status)}>{result.status}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{result.runId}</span>
                  <Button size="sm" variant="outline" onClick={() => cleanupRun(result.runId)} disabled={isLoading}>
                    Cleanup Run
                  </Button>
                </div>

                {result.assertions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Assertions</h4>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {result.assertions.map(assertion => (
                        <div key={assertion.name} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                          {assertion.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" /> : <XCircle className="mt-0.5 h-4 w-4 text-red-600" />}
                          <div>
                            <p className="font-medium">{assertion.name}</p>
                            {assertion.details && <p className="text-xs text-muted-foreground">{assertion.details}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.createdEntities.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Created Entities</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Label</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.createdEntities.map(entity => (
                          <TableRow key={`${entity.type}-${entity.id}`}>
                            <TableCell>{entity.type}</TableCell>
                            <TableCell className="font-mono text-xs">{entity.id}</TableCell>
                            <TableCell>{entity.label}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {result.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {result.warnings.map(warning => <p key={warning}>{warning}</p>)}
                  </div>
                )}

                <pre className="max-h-[360px] overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                  {JSON.stringify(result.data ?? result.after ?? result.cleanup ?? result.error, null, 2)}
                </pre>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
