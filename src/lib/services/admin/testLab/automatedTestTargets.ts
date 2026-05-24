export interface AutomatedTestTargetPreset {
  id: string;
  label: string;
  description: string;
  target: string;
}

export const PRESTIGE_SCENARIO_ARCHETYPE_TEST_TARGET = 'tests/prestige/prestigeEventScenarioArchetypes.test.ts';

export const PRESTIGE_BALANCE_TEST_TARGETS = [
  'tests/prestige/prestigeCalculator.test.ts',
  'tests/prestige/prestigeService.test.ts',
  PRESTIGE_SCENARIO_ARCHETYPE_TEST_TARGET,
  'tests/sales/salesOrderLifecycle.test.ts',
  'tests/sales/contractLifecycle.test.ts',
  'tests/finance/loanLifecycle.test.ts',
  'tests/user/achievementPrestigeBalance.test.ts'
];

export const AUTOMATED_TEST_TARGET_PRESETS: AutomatedTestTargetPreset[] = [
  {
    id: 'all',
    label: 'Full automated suite',
    description: 'Run every Vitest file discovered under tests/**/*.test.ts.',
    target: ''
  },
  {
    id: 'prestige.balance-suite',
    label: 'Prestige balance suite',
    description: 'Run the prestige calculators, event services, sales wiring, loan penalty, achievement, and scenario archetype checks.',
    target: PRESTIGE_BALANCE_TEST_TARGETS.join(' ')
  },
  {
    id: 'prestige.scenario-archetypes',
    label: 'Prestige scenario archetypes',
    description: 'Run the realistic young, regional, and iconic-brand prestige event archetype scenarios.',
    target: PRESTIGE_SCENARIO_ARCHETYPE_TEST_TARGET
  }
];

export function getAutomatedTestTargetPreset(id: string): AutomatedTestTargetPreset | undefined {
  return AUTOMATED_TEST_TARGET_PRESETS.find(preset => preset.id === id);
}
