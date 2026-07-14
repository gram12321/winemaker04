// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadGameState: vi.fn(),
  saveGameState: vi.fn(async () => undefined),
  resolveWeatherWeek: vi.fn(() => ({
    date: { year: 2026, season: 'Summer' as const, week: 3 },
    state: 'Heat' as const,
    intensity: 'Severe' as const,
    seasonalPattern: 'Dry' as const,
    forecast: { state: 'Clear' as const, intensity: 'Mild' as const, confidence: 'High' as const },
  })),
  rollSeasonalWeatherForecast: vi.fn(() => ({ pattern: 'Dry' as const, confidence: 'High' as const })),
}));

vi.mock('@/lib/database', () => ({
  loadGameState: mocks.loadGameState,
  saveGameState: mocks.saveGameState,
}));
vi.mock('@/lib/features/weather', () => ({
  resolveWeatherWeek: mocks.resolveWeatherWeek,
  resolveSeasonalWeatherForecast: mocks.rollSeasonalWeatherForecast,
}));
vi.mock('@/lib/services/prestige/prestigeService', () => ({
  calculateCurrentPrestige: vi.fn(async () => ({ totalPrestige: 0 })),
  initializeBasePrestigeEvents: vi.fn(async () => undefined),
  updateCompanyValuePrestige: vi.fn(async () => undefined),
}));
vi.mock('@/lib/services/user/companyService', () => ({ companyService: { updateCompany: vi.fn(async () => undefined) } }));
vi.mock('@/lib/services/user/staffService', () => ({ initializeStaffSystem: vi.fn(async () => undefined) }));
vi.mock('@/lib/services/user/teamService', () => ({ initializeTeamsSystem: vi.fn(async () => undefined) }));
vi.mock('@/lib/services/finance/economyService', () => ({ initializeEconomyPhase: vi.fn(() => 'Stable') }));
vi.mock('@/hooks/useGameUpdates', () => ({ triggerGameUpdate: vi.fn() }));

const company = {
  id: 'weather-company', name: 'Weather Winery', currentWeek: 3, currentSeason: 'Summer' as const,
  currentYear: 2026, foundedYear: 2024, money: 100, prestige: 0,
};

describe('weather tick integration seams', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    const { resetGameState } = await import('@/lib/services/core/gameState');
    resetGameState();
  });

  it('uses persisted weather on company initialization instead of resolving it again', async () => {
    mocks.loadGameState.mockResolvedValue({
      economyPhase: 'Stable', weatherForecastPattern: 'Dry', weatherForecastConfidence: 'High',
      weatherState: 'Heat', weatherIntensity: 'Severe',
      nextWeekForecastState: 'Clear', nextWeekForecastIntensity: 'Mild',
    });
    const { setActiveCompany } = await import('@/lib/services/core/gameState');

    await setActiveCompany(company as any);

    expect(mocks.resolveWeatherWeek).not.toHaveBeenCalled();
    expect(mocks.saveGameState).not.toHaveBeenCalled();
  });

  it('initializes and persists weather only when the persisted context is absent', async () => {
    mocks.loadGameState.mockResolvedValue({ economyPhase: 'Stable' });
    const { setActiveCompany } = await import('@/lib/services/core/gameState');

    await setActiveCompany(company as any);

    expect(mocks.resolveWeatherWeek).toHaveBeenCalledWith(expect.objectContaining({
      companyId: company.id,
      date: { year: 2026, season: 'Summer', week: 3 },
    }));
    expect(mocks.saveGameState).toHaveBeenCalledWith(expect.objectContaining({
      weatherForecastPattern: 'Dry', weatherForecastConfidence: 'High',
      weatherState: 'Heat', weatherIntensity: 'Severe',
      nextWeekForecastState: 'Clear', nextWeekForecastIntensity: 'Mild',
    }));
  });

  it('persists the resolved weather fields whenever a weekly state update is applied', async () => {
    mocks.loadGameState.mockResolvedValue({
      economyPhase: 'Stable', weatherForecastPattern: 'Dry', weatherForecastConfidence: 'High',
      weatherState: 'Heat', weatherIntensity: 'Severe',
      nextWeekForecastState: 'Clear', nextWeekForecastIntensity: 'Mild',
    });
    const { setActiveCompany, updateGameState } = await import('@/lib/services/core/gameState');
    await setActiveCompany(company as any);
    mocks.saveGameState.mockClear();

    await updateGameState({ weatherState: 'Rain', weatherIntensity: 'Moderate' });

    expect(mocks.saveGameState).toHaveBeenCalledWith(expect.objectContaining({
      weatherState: 'Rain', weatherIntensity: 'Moderate',
      weatherForecastPattern: 'Dry', weatherForecastConfidence: 'High',
    }));
  });
});
