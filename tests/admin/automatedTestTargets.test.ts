import { describe, expect, it } from 'vitest';
import {
  AUTOMATED_TEST_TARGET_PRESETS,
  getAutomatedTestTargetPreset,
  PRESTIGE_BALANCE_TEST_TARGETS
} from '@/lib/features/admin/services/testLab/automatedTestTargets';

describe('Automated Test target presets', () => {
  it('exposes the prestige scenario archetype test as a direct UI target', () => {
    expect(getAutomatedTestTargetPreset('prestige.scenario-archetypes')).toEqual(expect.objectContaining({
      label: 'Prestige scenario archetypes',
      target: 'tests/prestige/prestigeEventScenarioArchetypes.test.ts'
    }));
  });

  it('groups all prestige balance regression files into one UI preset', () => {
    const preset = getAutomatedTestTargetPreset('prestige.balance-suite');

    expect(preset).toEqual(expect.objectContaining({
      label: 'Prestige balance suite',
      target: PRESTIGE_BALANCE_TEST_TARGETS.join(' ')
    }));
    expect(PRESTIGE_BALANCE_TEST_TARGETS).toEqual([
      'tests/prestige/prestigeCalculator.test.ts',
      'tests/prestige/prestigeService.test.ts',
      'tests/prestige/prestigeEventScenarioArchetypes.test.ts',
      'tests/sales/salesOrderLifecycle.test.ts',
      'tests/sales/contractLifecycle.test.ts',
      'tests/finance/loanLifecycle.test.ts',
      'tests/user/achievementPrestigeBalance.test.ts'
    ]);
  });

  it('keeps preset ids unique for the Admin Dashboard select control', () => {
    const ids = AUTOMATED_TEST_TARGET_PRESETS.map((preset: { id: string }) => preset.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
