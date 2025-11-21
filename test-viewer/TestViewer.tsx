import React, { useState, useMemo } from 'react';
import { Vineyard as VineyardType } from '@/lib/types/types';
import { calculateVineyardExpectedYield } from '@/lib/services';
import { formatNumber } from '@/lib/utils/utils';
import { VineyardModal, Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/shadCN/card';
import { Button } from '@/components/ui/shadCN/button';
import { Badge } from '@/components/ui/shadCN/badge';
import { Play, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { useLoadingState } from '@/hooks';

// Test scenarios extracted from yieldCalculator.test.ts
const testScenarios = {
  yieldCalculator: {
    title: 'Vineyard Yield Calculator Tests',
    description: 'Tests the core vineyard yield formula that determines grape production when harvesting',
    formula: 'yield = (hectares × density × 1.5 kg/vine) × (suitability × naturalYield × ripeness × vineYield × health)',
    groups: [
      {
        name: 'Edge Cases - Prevents Game-Breaking Bugs',
        tests: [
          {
            name: 'returns 0 kg when vineyard has no grape variety planted (cannot harvest barren land)',
            scenario: 'Player hasn\'t planted grapes yet',
            expected: 'No yield possible',
            whyItMatters: 'Prevents harvesting from empty vineyards'
          },
          {
            name: 'returns 0 kg when grapes are unripe (harvesting too early produces nothing)',
            scenario: 'Player tries to harvest at 0% ripeness',
            expected: 'Zero yield (grapes not ready)',
            whyItMatters: 'Forces players to wait for proper harvest timing'
          },
          {
            name: 'handles missing optional fields gracefully (prevents crashes from incomplete data)',
            scenario: 'Database returns incomplete vineyard data',
            expected: 'Function doesn\'t crash, returns 0 safely',
            whyItMatters: 'Prevents save file corruption or migration issues from breaking the game'
          }
        ]
      },
      {
        name: 'Scale Factors - Ensures Realistic Vineyard Economics',
        tests: [
          {
            name: 'yield scales proportionally with vineyard size (2 hectares = 2x grapes)',
            scenario: 'Player buys a larger vineyard',
            expected: 'Double the size = double the grapes (all else equal)',
            whyItMatters: 'Makes vineyard purchases economically sensible',
            example: '1 hectare → ~12,000 kg | 2 hectares → ~24,000 kg'
          },
          {
            name: 'yield scales proportionally with vine density (more vines = more grapes)',
            scenario: 'High-density planting vs standard density',
            expected: 'More vines per hectare = more grapes',
            whyItMatters: 'Dense planting is a valid strategy (though requires more work)',
            example: '2,500 vines/ha → ~6,000 kg | 5,000 vines/ha → ~12,000 kg'
          }
        ]
      },
      {
        name: 'Quality Multipliers - Rewards Good Vineyard Management',
        tests: [
          {
            name: 'damaged vineyards (50% health) produce roughly half the yield of healthy ones',
            scenario: 'Neglected vineyard vs well-maintained vineyard',
            expected: 'Poor health = lower yields',
            whyItMatters: 'Incentivizes players to maintain vineyards (clearing activities)',
            example: 'Health 100% → ~12,000 kg | Health 50% → ~6,000 kg'
          },
          {
            name: 'riper grapes (80%) produce roughly double the yield of unripe grapes (40%)',
            scenario: 'Early harvest vs optimal harvest timing',
            expected: 'Waiting for ripeness = significantly more grapes',
            whyItMatters: 'Creates strategic timing decisions (harvest early or wait?)',
            example: 'Ripeness 40% → ~6,000 kg | Ripeness 80% → ~12,000 kg'
          },
          {
            name: 'mature vines (100% yield) produce double the yield of young vines (50% yield)',
            scenario: 'Newly planted vineyard vs established vineyard',
            expected: 'Vine age affects yield potential',
            whyItMatters: 'Rewards long-term vineyard investments',
            example: 'Young vines (50%) → ~6,000 kg | Mature vines (100%) → ~12,000 kg'
          }
        ]
      },
      {
        name: 'Realistic Scenarios - Validates Game Balance',
        tests: [
          {
            name: 'produces realistic yields for an optimal 5-hectare vineyard',
            scenario: 'Perfect vineyard setup (5 hectares, optimal conditions)',
            expected: 'Substantial but realistic yield (10,000-100,000 kg)',
            whyItMatters: 'Ensures the economy scales correctly for larger operations'
          },
          {
            name: 'minimum health vineyards (10%) still produce some yield (prevents total crop failure)',
            scenario: 'Severely neglected vineyard at minimum health threshold',
            expected: 'Still produces some grapes (10% of normal)',
            whyItMatters: 'Prevents players from losing everything, allows recovery'
          }
        ]
      }
    ]
  }
};

// Test vineyards extracted directly from tests/vineyard/yieldCalculator.test.ts
// These match the exact vineyard configurations used in the test file
const testData = {
  vineyard: {
    // Base vineyard from yieldCalculator.test.ts line 26-45
    baseVineyard: {
      id: 'test-vineyard-base',
      name: 'Base Test Vineyard',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 1,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 5000, // 5,000 vines per hectare (standard)
      vineyardHealth: 1.0, // Perfect health (100%)
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      ripeness: 0.8, // 80% ripe (good but not perfect)
      vineyardPrestige: 0,
      vineYield: 1.0, // Mature vines (100% yield potential)
      company_id: 'test-company'
    } as VineyardType,
    // vineyard1 from size comparison test (line 108-111)
    smallVineyard: {
      id: 'test-vineyard-small',
      name: 'Small Vineyard (1 ha)',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 1,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 5000,
      vineyardHealth: 1.0,
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      ripeness: 0.8,
      vineyardPrestige: 0,
      vineYield: 1.0,
      company_id: 'test-company'
    } as VineyardType,
    // vineyard2 from size comparison test (line 113-116)
    largeVineyard: {
      id: 'test-vineyard-large',
      name: 'Large Vineyard (2 ha)',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 2,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 5000,
      vineyardHealth: 1.0,
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      ripeness: 0.8,
      vineyardPrestige: 0,
      vineYield: 1.0,
      company_id: 'test-company'
    } as VineyardType,
    // vineyard1 from density comparison test (line 135-138)
    lowDensityVineyard: {
      id: 'test-vineyard-low-density',
      name: 'Low Density Vineyard (2,500 vines/ha)',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 1,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 2500, // Lower density
      vineyardHealth: 1.0,
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      ripeness: 0.8,
      vineyardPrestige: 0,
      vineYield: 1.0,
      company_id: 'test-company'
    } as VineyardType,
    // healthyVineyard from health comparison test (line 163-166)
    healthyVineyard: {
      id: 'test-vineyard-healthy',
      name: 'Healthy Vineyard (100% health)',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 1,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 5000,
      vineyardHealth: 1.0, // Perfect health
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      ripeness: 0.8,
      vineyardPrestige: 0,
      vineYield: 1.0,
      company_id: 'test-company'
    } as VineyardType,
    // damagedVineyard from health comparison test (line 168-171)
    damagedVineyard: {
      id: 'test-vineyard-damaged',
      name: 'Damaged Vineyard (50% health)',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 1,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 5000,
      vineyardHealth: 0.5, // Poor health (from neglect)
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      ripeness: 0.8,
      vineyardPrestige: 0,
      vineYield: 1.0,
      company_id: 'test-company'
    } as VineyardType,
    // unripeVineyard from ripeness comparison test (line 189-192)
    unripeVineyard: {
      id: 'test-vineyard-unripe',
      name: 'Unripe Vineyard (40% ripeness)',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 1,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 5000,
      vineyardHealth: 1.0,
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      ripeness: 0.4, // Early harvest
      vineyardPrestige: 0,
      vineYield: 1.0,
      company_id: 'test-company'
    } as VineyardType,
    // ripeVineyard from ripeness comparison test (line 194-197)
    ripeVineyard: {
      id: 'test-vineyard-ripe',
      name: 'Ripe Vineyard (80% ripeness)',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 1,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 5000,
      vineyardHealth: 1.0,
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      ripeness: 0.8, // Optimal harvest time
      vineyardPrestige: 0,
      vineYield: 1.0,
      company_id: 'test-company'
    } as VineyardType,
    // youngVineyard from age comparison test (line 215-218)
    youngVineyard: {
      id: 'test-vineyard-young',
      name: 'Young Vineyard (50% yield)',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 1,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 5000,
      vineyardHealth: 1.0,
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      ripeness: 0.8,
      vineyardPrestige: 0,
      vineYield: 0.5, // Young vines (just planted)
      company_id: 'test-company'
    } as VineyardType,
    // matureVineyard from age comparison test (line 220-223)
    matureVineyard: {
      id: 'test-vineyard-mature',
      name: 'Mature Vineyard (100% yield)',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 1,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 5000,
      vineyardHealth: 1.0,
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      ripeness: 0.8,
      vineyardPrestige: 0,
      vineYield: 1.0, // Mature vines (5+ years old)
      company_id: 'test-company'
    } as VineyardType,
    // optimalVineyard from realistic scenario test (line 244-252)
    optimalVineyard: {
      id: 'test-vineyard-optimal',
      name: 'Optimal 5-hectare Vineyard',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 5,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 5000,
      ripeness: 0.9, // Very ripe
      vineyardHealth: 0.95, // Excellent health
      vineYield: 1.0, // Mature vines
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      vineyardPrestige: 0,
      company_id: 'test-company'
    } as VineyardType,
    // minHealthVineyard from minimum health test (line 266-269)
    minHealthVineyard: {
      id: 'test-vineyard-min-health',
      name: 'Minimum Health Vineyard (10% health)',
      country: 'Italy',
      region: 'Tuscany',
      hectares: 1,
      grape: 'Sangiovese',
      vineAge: 5,
      soil: ['Clay', 'Limestone'],
      altitude: 300,
      aspect: 'South',
      density: 5000,
      vineyardHealth: 0.1, // Minimum health (10%)
      landValue: 50000,
      vineyardTotalValue: 50000,
      status: 'Planted',
      ripeness: 0.8,
      vineyardPrestige: 0,
      vineYield: 1.0,
      company_id: 'test-company'
    } as VineyardType
  }
};

interface TestFileResult {
  file: string;
  tests: number;
  duration: number;
  passed: boolean;
}

interface TestResult {
  passed: number;
  failed: number;
  total: number;
  status: 'idle' | 'running' | 'passed' | 'failed';
  output?: string;
  testFiles?: TestFileResult[];
}

const TestViewer: React.FC = () => {
  const [selectedVineyard, setSelectedVineyard] = useState<VineyardType | null>(null);
  const [showVineyardModal, setShowVineyardModal] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>({
    passed: 0,
    failed: 0,
    total: 0,
    status: 'idle'
  });
  const { withLoading } = useLoadingState();

  const vineyards = useMemo(() => Object.values(testData.vineyard), []);

  const handleVineyardClick = (vineyard: VineyardType) => {
    setSelectedVineyard(vineyard);
    setShowVineyardModal(true);
  };

  const runTests = async () => {
    await withLoading(async () => {
      setTestResult(prev => ({ ...prev, status: 'running' }));
      
      try {
        // Try to call API endpoint (may not exist yet)
        const response = await fetch('/api/test-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          setTestResult({
            passed: result.passed || 0,
            failed: result.failed || 0,
            total: result.total || 0,
            status: result.status || (result.failed > 0 ? 'failed' : 'passed'),
            output: result.output || result.message || 'No output',
            testFiles: result.testFiles || []
          });
        } else {
          const errorData = await response.json().catch(() => ({ message: 'API error' }));
          throw new Error(errorData.message || 'API not available');
        }
      } catch (error: any) {
        // Show error from API
        setTestResult({
          passed: 0,
          failed: 0,
          total: 0,
          status: 'failed',
          output: `Failed to run tests: ${error.message}\n\nMake sure the dev server is running and npm test works in terminal.`
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Test Suite Viewer</h3>
          <p className="text-gray-600 text-xs mt-1">
            View test data <span className="text-gray-500">(static visualization)</span> and run test suites <span className="text-green-600 font-semibold">(live execution)</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              // Open Vitest UI in a new window (requires test server to be running)
              // User should run: npm run test:watch -- --ui
              window.open('http://localhost:51204/__vitest__/', '_blank');
            }}
            variant="default"
            size="sm"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            title="Open Vitest UI (requires 'npm run test:watch -- --ui' in terminal)"
          >
            <ExternalLink className="h-4 w-4" />
            Open Vitest UI
          </Button>
          <Button
            onClick={runTests}
            disabled={testResult.status === 'running'}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            title="Try to run tests via API (API endpoint not implemented yet)"
          >
            {testResult.status === 'running' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Tests (API)
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => window.open('/tests/README.md', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Test Docs
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
        <p className="font-semibold text-blue-900 mb-1">📋 Current Status:</p>
        <ul className="list-disc list-inside text-blue-800 space-y-1">
          <li><strong>Test Vineyards:</strong> Static data extracted from test files (for visualization)</li>
          <li><strong>Test Scenarios:</strong> Static data extracted from <code>yieldCalculator.test.ts</code></li>
          <li><strong>Real Test Results:</strong> Click "Run Tests (API)" button above to execute tests and see live results</li>
          <li><strong>Alternative:</strong> Use "Open Vitest UI" button (requires <code>npm run test:watch -- --ui</code> in terminal)</li>
        </ul>
      </div>

      {/* Test Results Summary */}
      {testResult.status !== 'idle' && testResult.output && (
        <div className={`p-3 rounded-lg border text-sm ${
          testResult.status === 'passed' ? 'bg-green-50 border-green-200' :
          testResult.status === 'failed' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {testResult.status === 'passed' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {testResult.status === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
              {testResult.status === 'running' && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
              <span className="font-medium text-xs">
                {testResult.status === 'passed' && `✓ ${testResult.passed} tests passed`}
                {testResult.status === 'failed' && `✗ ${testResult.failed}/${testResult.total} tests failed`}
                {testResult.status === 'running' && 'Running tests...'}
              </span>
            </div>
            {testResult.testFiles && testResult.testFiles.length > 0 && testResult.status === 'passed' && (
              <span className="text-xs text-gray-600">
                {testResult.testFiles.length} test files • See details below
              </span>
            )}
          </div>
          {/* Show raw output only if there are no structured test files, or for errors */}
          {(!testResult.testFiles || testResult.testFiles.length === 0 || testResult.status === 'failed') && (
            <details className="mt-2">
              <summary className="text-xs font-medium text-gray-600 cursor-pointer hover:text-gray-800 mb-2">
                Show raw output
              </summary>
              <pre className="text-xs bg-black/5 p-2 rounded whitespace-pre-wrap font-mono max-h-96 overflow-auto">
                {testResult.output}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Test Vineyards */}
      <div>
        <h4 className="text-base font-semibold text-gray-800 mb-3">
          Test Vineyards <span className="text-xs font-normal text-gray-500">(Static Test Data)</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vineyards.map((vineyard) => {
              const yieldData = calculateVineyardExpectedYield(vineyard);
              return (
                <Card
                  key={vineyard.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleVineyardClick(vineyard)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{vineyard.name}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {vineyard.grape || 'Unplanted'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {vineyard.region}, {vineyard.country}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Size:</span>
                        <span className="ml-1 font-medium">{vineyard.hectares} ha</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Density:</span>
                        <span className="ml-1 font-medium">{vineyard.density?.toLocaleString() || 0} vines/ha</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Health:</span>
                        <span className="ml-1 font-medium">
                          {formatNumber((vineyard.vineyardHealth || 1.0) * 100, { smartDecimals: true })}%
                        </span>
                      </div>
                      {vineyard.grape && (
                        <>
                          <div>
                            <span className="text-gray-500">Ripeness:</span>
                            <span className="ml-1 font-medium">
                              {formatNumber((vineyard.ripeness || 0) * 100, { smartDecimals: true })}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Vine Yield:</span>
                            <span className="ml-1 font-medium">
                              {formatNumber((vineyard.vineYield || 0.02) * 100, { smartDecimals: true })}%
                            </span>
                          </div>
                          {yieldData && (
                            <div className="col-span-2 pt-1 border-t">
                              <span className="text-gray-500">Expected Yield:</span>
                              <span className="ml-1 font-semibold text-green-600">
                                {formatNumber(yieldData.totalYield, { smartDecimals: true })} kg
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      </div>

      {/* Test Scenarios */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-semibold text-gray-800">
            Test Scenarios <span className="text-xs font-normal text-gray-500">(From yieldCalculator.test.ts)</span>
          </h4>
          {testResult.testFiles && testResult.testFiles.length > 0 && (
            <Badge variant={testResult.status === 'passed' ? 'default' : 'destructive'} className="text-xs">
              {testResult.status === 'passed' ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" /> {testResult.total} tests passed</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> {testResult.failed} failed</>
              )}
            </Badge>
          )}
        </div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{testScenarios.yieldCalculator.title}</CardTitle>
            <p className="text-xs text-gray-600 mt-1">{testScenarios.yieldCalculator.description}</p>
            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs font-semibold text-blue-900 mb-1">Formula:</p>
              <code className="text-xs text-blue-800">
                {testScenarios.yieldCalculator.formula}
              </code>
            </div>
            {/* Test Results Summary */}
            {testResult.testFiles && testResult.testFiles.length > 0 && (() => {
              const yieldTestFile = testResult.testFiles.find(tf => 
                tf.file.includes('yieldCalculator.test.ts') || tf.file.includes('yield')
              );
              return yieldTestFile ? (
                <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-green-900">Test Results:</span>
                    <div className="flex items-center gap-2">
                      {yieldTestFile.passed ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-600" />
                      )}
                      <span className="text-green-800 font-medium">
                        {yieldTestFile.tests} tests passed in {yieldTestFile.duration}ms
                      </span>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {testScenarios.yieldCalculator.groups.map((group, groupIndex) => (
                <AccordionItem key={groupIndex} value={`group-${groupIndex}`}>
                  <AccordionTrigger className="text-sm font-medium py-3">
                    <div className="flex items-center justify-between w-full pr-4">
                      <span>{group.name}</span>
                      <span className="text-xs text-gray-500">
                        {group.tests.length} tests
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {group.tests.map((test, testIndex) => (
                        <div
                          key={testIndex}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="text-sm font-semibold text-gray-800">
                              {test.name}
                            </h5>
                            {testResult.testFiles && testResult.testFiles.length > 0 && (
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 ml-2" />
                            )}
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <div>
                              <span className="font-medium">Scenario:</span>{' '}
                              <span>{test.scenario}</span>
                            </div>
                            <div>
                              <span className="font-medium">Expected:</span>{' '}
                              <span>{test.expected}</span>
                            </div>
                            <div>
                              <span className="font-medium">Why it matters:</span>{' '}
                              <span>{test.whyItMatters}</span>
                            </div>
                            {'example' in test && test.example && (
                              <div className="mt-2 p-2 bg-white rounded border border-gray-300">
                                <span className="font-medium text-gray-700">Example:</span>{' '}
                                <code className="text-gray-800">{test.example}</code>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            
            {/* All Test Files Results */}
            {testResult.testFiles && testResult.testFiles.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h5 className="text-sm font-semibold text-gray-800 mb-3">All Test Files</h5>
                <div className="space-y-2">
                  {testResult.testFiles.map((testFile, index) => {
                    const fileName = testFile.file.split('/').pop() || testFile.file;
                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border text-xs ${
                          testFile.passed
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {testFile.passed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-medium">{fileName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-600">
                            <span>{testFile.tests} {testFile.tests === 1 ? 'test' : 'tests'}</span>
                            <span>•</span>
                            <span>{testFile.duration}ms</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">Total:</span>
                    <div className="flex items-center gap-4">
                      <span className="text-green-600">
                        ✓ {testResult.passed} passed
                      </span>
                      {testResult.failed > 0 && (
                        <span className="text-red-600">
                          ✗ {testResult.failed} failed
                        </span>
                      )}
                      <span className="text-gray-600">
                        {testResult.total} total
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Test Information */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg border text-xs text-gray-600">
        <p className="mb-1">
          <strong>Yield Formula:</strong>{' '}
          <code className="px-1 bg-white rounded">
            yield = (hectares × density × 1.5) × (suitability × naturalYield × ripeness × vineYield × health)
          </code>
        </p>
        <p className="text-gray-500">
          {testScenarios.yieldCalculator.groups.length} test groups, {testScenarios.yieldCalculator.groups.reduce((sum, g) => sum + g.tests.length, 0)} total tests. Click vineyards above to see test data rendered as game components.
        </p>
      </div>

      {/* Vineyard Modal */}
      {showVineyardModal && selectedVineyard && (
        <VineyardModal
          isOpen={showVineyardModal}
          onClose={() => {
            setShowVineyardModal(false);
            setSelectedVineyard(null);
          }}
          vineyard={selectedVineyard}
        />
      )}
    </div>
  );
};

export default TestViewer;
