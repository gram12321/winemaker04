import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGameState: vi.fn(() => ({ economyPhase: 'Stable' })),
  updateGameState: vi.fn(async () => undefined),
  notificationAddMessage: vi.fn(async () => undefined)
}));

let randomSpy: any = null;

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState,
  updateGameState: mocks.updateGameState
}));

vi.mock('@/lib/services/core/notificationService', () => ({
  notificationService: { addMessage: mocks.notificationAddMessage }
}));

describe('economy service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  it('moves a middle economy phase left, right, or stays based on the transition roll', async () => {
    const { calculateNextEconomyPhase } = await import('@/lib/services/finance/economyService');

    randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.1);
    expect(calculateNextEconomyPhase('Stable')).toBe('Recession');

    randomSpy.mockReturnValueOnce(0.3);
    expect(calculateNextEconomyPhase('Stable')).toBe('Expansion');

    randomSpy.mockReturnValueOnce(0.9);
    expect(calculateNextEconomyPhase('Stable')).toBe('Stable');
  });

  it('updates game state and returns a combined notification message when a season transition changes phase', async () => {
    mocks.getGameState.mockReturnValue({ economyPhase: 'Stable' });
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const { processEconomyPhaseTransition } = await import('@/lib/services/finance/economyService');

    const message = await processEconomyPhaseTransition(true);

    expect(mocks.updateGameState).toHaveBeenCalledWith({ economyPhase: 'Recession' });
    expect(message).toContain('Economy phase changed to Recession');
    expect(mocks.notificationAddMessage).not.toHaveBeenCalled();
  });

  it('sends its own notification when not suppressed by the game tick', async () => {
    mocks.getGameState.mockReturnValue({ economyPhase: 'Stable' });
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const { processEconomyPhaseTransition } = await import('@/lib/services/finance/economyService');

    await expect(processEconomyPhaseTransition(false)).resolves.toBeNull();

    expect(mocks.notificationAddMessage).toHaveBeenCalledWith(
      expect.stringContaining('Economy phase changed to Recession'),
      'economy.phaseChange',
      'Economy Update',
      expect.anything()
    );
  });
});
