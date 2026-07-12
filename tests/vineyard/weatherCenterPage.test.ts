import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WeatherOperation, WeatherOperationImpact } from '@/lib/features/weather';

const mocks = vi.hoisted(() => ({
  gameState: { currentYear: 2026, week: 5, season: 'Summer' },
  rows: [] as any[],
}));

vi.mock('@/hooks', () => ({ useGameState: () => mocks.gameState, useGameStateWithData: () => [] }));
vi.mock('@/lib/services', () => ({ getAllVineyards: vi.fn(() => []), getCurrentCompany: vi.fn(() => ({ id: 'company-1' })) }));
vi.mock('@/lib/features/weather', () => ({
  createWeatherWeekContext: vi.fn(() => ({})),
  buildWeatherOperationPresentation: vi.fn((operation: WeatherOperation, impact: WeatherOperationImpact) => ({
    label: `${operation === 'planting' ? 'Planting' : 'Harvesting'}: ${impact.severity}`,
    consequence: `${impact.severity} consequence.`,
    estimateNote: 'Completion estimates can change as weather changes.',
  })),
  buildWeatherCenterPresentation: vi.fn(() => ({
    currentWeather: { label: 'Current weather', icon: '☀️', description: 'Clear (Mild)' },
    forecast: { label: 'Next-week forecast', icon: '🌡️', description: 'Heat (Severe)', confidence: 'High' },
    seasonalOutlook: 'Heat seasonal outlook',
    outlooks: [
      { label: 'Ripening outlook', detail: 'Next week accelerates ripening.' },
      { label: 'Vine-health outlook', detail: 'Next week adds vine stress.' },
      { label: 'Grape-market outlook', detail: 'Heat pressure increases handling risk.' },
    ],
    rows: mocks.rows,
  })),
}));
vi.mock('@/components/ui', () => {
  const h = React.createElement;
  const Wrap = ({ children }: any) => h('div', null, children);
  return { Badge: Wrap, Card: Wrap, CardContent: Wrap, CardDescription: Wrap, CardHeader: Wrap, CardTitle: Wrap, Table: ({ children }: any) => h('table', null, children), TableBody: ({ children }: any) => h('tbody', null, children), TableCell: ({ children, colSpan }: any) => h('td', { colSpan }, children), TableHead: ({ children }: any) => h('th', null, children), TableHeader: ({ children }: any) => h('thead', null, children), TableRow: ({ children }: any) => h('tr', null, children), VineyardStatusBadge: ({ status }: any) => h('span', null, status) };
});

import { WeatherCenterPage } from '@/components/pages/WeatherCenter';
import { WeatherOperationStatusNotice } from '@/components/ui/components/WeatherOperationStatusNotice';

describe('WeatherCenterPage', () => {
  beforeEach(() => { mocks.rows = []; });

  it('renders only decision surfaces and correctly distinguishes current weather from the forecast', () => {
    const html = renderToStaticMarkup(React.createElement(WeatherCenterPage));

    expect(html).toContain('Weather Center');
    expect(html).toContain('Current weather');
    expect(html).toContain('Next-week forecast');
    expect(html).toContain('High');
    expect(html).toContain('Vineyard Weather Impact Preview');
    expect(html).not.toContain('Trigger Matrix');
    expect(html).not.toContain('Formula');
  });

  it('renders concise vineyard outcomes and an empty state', () => {
    mocks.rows = [{ id: 'v-1', name: 'North Field', status: 'Growing', siteSummary: 'North-facing • 300m elevation • Limestone', siteNote: 'Site buffers this weather.', explanation: 'Normal progression is adjusted by the forecast.', ripeness: { current: 0.6, normalChange: 0.01, weatherContribution: 0.002, projected: 0.612 }, health: { current: 0.8, normalChange: -0.01, weatherContribution: -0.003, projected: 0.787 } }];
    const html = renderToStaticMarkup(React.createElement(WeatherCenterPage));

    expect(html).toContain('North Field');
    expect(html).toContain('Site buffers this weather.');
    expect(html).toContain('Why this forecast?');
  });

  it.each(['normal', 'slowed', 'paused', 'blocked'] as const)('renders the %s operation reason and consequence', (severity) => {
    const html = renderToStaticMarkup(React.createElement(WeatherOperationStatusNotice, {
      operation: 'harvesting',
      compact: true,
      impact: {
        allowed: severity !== 'blocked',
        paused: severity === 'paused',
        workMultiplier: severity === 'paused' || severity === 'blocked' ? 0 : 1,
        severity,
        reason: `${severity} weather reason.`,
      },
    }));

    expect(html).toContain(`Harvesting: ${severity}`);
    expect(html).toContain(`${severity} weather reason.`);
    expect(html).toContain(`${severity} consequence.`);
  });
});
