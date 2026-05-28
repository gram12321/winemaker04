import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  rows: [] as any[],
  summary: {
    avgRipenessDelta: 0,
    avgHealthDelta: 0,
    highStressCount: 0,
    avgSiteResponse: 1,
  },
  gameState: {
    week: 5,
    season: 'Summer',
    weatherState: 'Clear',
    weatherIntensity: 'Mild',
    nextWeekForecastState: 'Heat',
    nextWeekForecastIntensity: 'Moderate',
    weatherForecastPattern: 'Volatile',
    weatherForecastConfidence: 'High',
  },
  vineyards: [] as any[],
  company: { id: 'company-1' as string | null },
}));

vi.mock('@/hooks', () => ({
  useGameState: () => mocks.gameState,
  useGameStateWithData: () => mocks.vineyards,
}));

vi.mock('@/lib/services', () => ({
  buildWeatherContext: vi.fn(() => ({ companyId: 'company-1', year: 2026, season: 'Summer', week: 5 })),
  buildVineyardWeatherRows: vi.fn(() => mocks.rows),
  calculateWeatherImpactSummary: vi.fn(() => mocks.summary),
  getAllVineyards: vi.fn(() => []),
  getCurrentCompany: vi.fn(() => (mocks.company.id ? { id: mocks.company.id } : null)),
  getSoilResponseLabel: vi.fn((source: string) => source),
  getWeatherIcon: vi.fn(() => ''),
}));

vi.mock('@/lib/utils', () => ({
  formatNumber: (value: number) => String(value),
  formatSigned: (value: number) => (value > 0 ? `+${value}` : String(value)),
}));

vi.mock('@/components/ui', () => {
  const h = React.createElement;
  const Wrap = ({ children }: any) => h('div', null, children);
  const TableWrap = ({ children }: any) => h('table', null, children);
  const TableRowWrap = ({ children }: any) => h('tr', null, children);
  const TableCellWrap = ({ children, colSpan }: any) => h('td', { colSpan }, children);
  const TableHeadWrap = ({ children }: any) => h('th', null, children);

  return {
    Badge: Wrap,
    Card: Wrap,
    CardContent: Wrap,
    CardDescription: Wrap,
    CardHeader: Wrap,
    CardTitle: Wrap,
    Table: TableWrap,
    TableBody: ({ children }: any) => h('tbody', null, children),
    TableCell: TableCellWrap,
    TableHead: TableHeadWrap,
    TableHeader: ({ children }: any) => h('thead', null, children),
    TableRow: TableRowWrap,
    TooltipRow: Wrap,
    TooltipSection: Wrap,
    UnifiedTooltip: ({ children }: any) => children,
    VineyardStatusBadge: ({ status }: any) => h('span', null, status),
  };
});

import { WeatherCenterPage } from '@/components/pages/WeatherCenter';

describe('WeatherCenterPage', () => {
  beforeEach(() => {
    mocks.rows = [];
    mocks.summary = {
      avgRipenessDelta: 0,
      avgHealthDelta: 0,
      highStressCount: 0,
      avgSiteResponse: 1,
    };
    mocks.company.id = 'company-1';
  });

  it('renders key metric cards and empty-state row when no planted vineyards exist', () => {
    const html = renderToStaticMarkup(React.createElement(WeatherCenterPage));

    expect(html).toContain('Weather Center');
    expect(html).toContain('Avg Ripeness Net Δ');
    expect(html).toContain('Avg Health Net Δ');
    expect(html).toContain('High Stress Vineyards');
    expect(html).toContain('No planted vineyards available for weather preview.');
  });

  it('renders weather rows and summary values when data is available', () => {
    mocks.rows = [
      {
        id: 'v-1',
        name: 'Cote South Block',
        state: 'Growing',
        ripenessCurrent: 0.66,
        ripenessProjected: 0.67,
        ripenessDelta: 0.01,
        healthCurrent: 0.83,
        healthProjected: 0.82,
        healthDelta: -0.01,
        siteResponse: 1.08,
        reason: 'Heat (Moderate) with site amplified impact',
        breakdown: {
          weatherState: 'Heat',
          weatherIntensity: 'Moderate',
          baseRipenessDeviation: 0.001,
          baseHealthDeviation: -0.001,
          adjustedBaseHealthDeviation: -0.001,
          seasonAdjustmentMultiplier: 1,
          aspectResponse: 1,
          altitudeResponse: 1,
          terroirResponse: 1,
          soilResponse: 1,
          soilResponseSource: 'neutral',
          siteResponseRaw: 1.08,
          siteResponseClamped: false,
          ripenessRawDelta: 0.01,
          ripenessClamped: false,
          healthRawDelta: -0.01,
          healthClamped: false,
        },
      },
    ];
    mocks.summary = {
      avgRipenessDelta: 0.01,
      avgHealthDelta: -0.01,
      highStressCount: 1,
      avgSiteResponse: 1.08,
    };

    const html = renderToStaticMarkup(React.createElement(WeatherCenterPage));

    expect(html).toContain('Cote South Block');
    expect(html).toContain('Heat (Moderate) with site amplified impact');
    expect(html).toContain('1');
  });
});
