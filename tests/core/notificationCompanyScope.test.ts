import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationCategory } from '@/lib/types/types';
import { notificationService } from '@/lib/services/core/notificationService';

const mocks = vi.hoisted(() => ({
  getCurrentCompanyId: vi.fn(() => 'company-b'),
  getGameState: vi.fn(() => ({ week: 9, season: 'Winter', currentYear: 2030 })),
  saveNotification: vi.fn(async () => undefined),
  loadNotificationFilters: vi.fn(async () => []),
  toast: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  getCurrentCompanyId: mocks.getCurrentCompanyId,
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState,
}));

vi.mock('@/lib/utils/toast', () => ({ toast: mocks.toast }));

vi.mock('@/lib/database/core/notificationsDB', () => ({
  saveNotification: mocks.saveNotification,
  loadNotifications: vi.fn(async () => []),
  clearNotifications: vi.fn(async () => undefined),
  saveNotificationFilter: vi.fn(async () => undefined),
  loadNotificationFilters: mocks.loadNotificationFilters,
  deleteNotificationFilter: vi.fn(async () => undefined),
  clearNotificationFilters: vi.fn(async () => undefined),
}));

describe('notification company scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists a captured-company notification without consulting the new active company', async () => {
    const result = await notificationService.addMessage(
      'Unlocked',
      'achievements.unlock',
      'Achievements',
      NotificationCategory.SYSTEM,
      {
        companyId: 'company-a',
        gameDate: { week: 2, season: 'Spring', year: 2026 },
      }
    );

    expect(result).toMatchObject({ gameWeek: 2, gameSeason: 'Spring', gameYear: 2026 });
    expect(mocks.saveNotification).toHaveBeenCalledWith(
      expect.objectContaining({ game_week: 2, game_season: 'Spring', game_year: 2026 }),
      'company-a'
    );
    expect(mocks.loadNotificationFilters).not.toHaveBeenCalled();
    expect(mocks.getGameState).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
