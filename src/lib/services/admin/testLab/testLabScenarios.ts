import type { TestLabParamField, TestLabScenarioDefinition } from './types';
import { COUNTRY_REGION_MAP } from '@/lib/constants/vineyardConstants';

// Exported so TestLabPage can conditionally hide these when an existing vineyard is selected.
export const VINEYARD_CONFIG_PARAM_KEYS = new Set([
  'country', 'region', 'grape', 'hectares', 'density', 'vineAge',
  'vineyardHealth', 'ripeness', 'landValue', 'altitude', 'aspect', 'soil'
]);

const grapeOptions = [
  'Barbera',
  'Chardonnay',
  'Pinot Noir',
  'Primitivo',
  'Sauvignon Blanc',
  'Tempranillo',
  'Sangiovese'
].map(value => ({ label: value, value }));

const countryOptions = Object.keys(COUNTRY_REGION_MAP)
  .map(value => ({ label: value, value }));

// All regions across all countries; the UI dropdowns filter by selected country at render time.
const regionOptions = Object.values(COUNTRY_REGION_MAP)
  .flatMap(regions => [...regions])
  .map(value => ({ label: value, value }));

const aspectOptions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest']
  .map(value => ({ label: value, value }));

const crushingMethodOptions = ['Hand Press', 'Mechanical Press', 'Pneumatic Press']
  .map(value => ({ label: value, value }));

const fermentationMethodOptions = ['Basic', 'Temperature Controlled', 'Extended Maceration']
  .map(value => ({ label: value, value }));

const fermentationTemperatureOptions = ['Ambient', 'Cool', 'Warm']
  .map(value => ({ label: value, value }));

const staffXpCategoryOptions = [
  { label: 'Skill: Field', value: 'skill:field' },
  { label: 'Skill: Winery', value: 'skill:winery' },
  { label: 'Skill: Finance & Staff', value: 'skill:financeAndStaff' },
  { label: 'Skill: Sales', value: 'skill:sales' },
  { label: 'Skill: Admin & Research', value: 'skill:administrationAndResearch' },
  { label: 'Grape: Chardonnay', value: 'grape:Chardonnay' },
  { label: 'Grape: Pinot Noir', value: 'grape:Pinot Noir' },
  { label: 'Grape: Sauvignon Blanc', value: 'grape:Sauvignon Blanc' },
  { label: 'Grape: Sangiovese', value: 'grape:Sangiovese' },
  { label: 'Grape: Tempranillo', value: 'grape:Tempranillo' },
  { label: 'Grape: Barbera', value: 'grape:Barbera' },
  { label: 'Grape: Primitivo', value: 'grape:Primitivo' }
];

// Vineyard configuration params used when creating a new test vineyard.
const vineyardConfigParams: TestLabParamField[] = [
  { key: 'country', label: 'Country', type: 'select', defaultValue: 'France', options: countryOptions },
  { key: 'region', label: 'Region', type: 'select', defaultValue: 'Bourgogne', options: regionOptions },
  { key: 'grape', label: 'Grape', type: 'select', defaultValue: 'Pinot Noir', options: grapeOptions },
  { key: 'hectares', label: 'Hectares', type: 'number', defaultValue: 1, min: 0.05, max: 50, step: 0.05 },
  { key: 'density', label: 'Density', type: 'number', defaultValue: 5000, min: 1000, max: 12000, step: 100 },
  { key: 'vineAge', label: 'Vine age', type: 'number', defaultValue: 12, min: 1, max: 80, step: 1 },
  { key: 'vineyardHealth', label: 'Health', type: 'number', defaultValue: 0.9, min: 0, max: 1, step: 0.05 },
  { key: 'ripeness', label: 'Ripeness', type: 'number', defaultValue: 0.92, min: 0, max: 1, step: 0.01 },
  { key: 'landValue', label: 'Land value per ha', type: 'number', defaultValue: 250000, min: 1000, max: 10000000, step: 1000 },
  { key: 'altitude', label: 'Altitude', type: 'number', defaultValue: 320, min: 0, max: 1200, step: 10 },
  { key: 'aspect', label: 'Aspect', type: 'select', defaultValue: 'Southeast', options: aspectOptions },
  { key: 'soil', label: 'Soil', type: 'string', defaultValue: 'Clay,Limestone' }
];

// Used for vineyard.harvest-ready — sets the actual game clock.
const gameDateParams: TestLabParamField[] = [
  { key: 'week', label: 'Game week', type: 'number', defaultValue: 2, min: 1, max: 12, step: 1 },
  { key: 'season', label: 'Game season', type: 'select', defaultValue: 'Fall', options: ['Spring', 'Summer', 'Fall', 'Winter'].map(value => ({ label: value, value })) },
  { key: 'year', label: 'Game year', type: 'number', defaultValue: 2024, min: 2024, max: 2100, step: 1 }
];

// Used for winery batch scenarios — stored as the harvest date on the batch, game clock is not changed.
const harvestDateParams: TestLabParamField[] = [
  { key: 'week', label: 'Harvest week', type: 'number', defaultValue: 2, min: 1, max: 12, step: 1 },
  { key: 'season', label: 'Harvest season', type: 'select', defaultValue: 'Fall', options: ['Spring', 'Summer', 'Fall', 'Winter'].map(value => ({ label: value, value })) },
  { key: 'year', label: 'Harvest year', type: 'number', defaultValue: 2024, min: 2024, max: 2100, step: 1 }
];

// harvest-ready scenario always creates a new vineyard; no picker needed.
const baseVineyardParams: TestLabParamField[] = [
  ...vineyardConfigParams,
  ...gameDateParams
];

// Winery scenarios let you pick an existing vineyard or create a new test one.
// The UI hides vineyardConfigParams when an existing vineyard is selected.
// Options are built entirely at runtime in TestLabPage (from loadVineyards + 'new').
// The static options list is intentionally empty so the param validator accepts any
// vineyard UUID without knowing them ahead of time.
const vineyardPickerParam: TestLabParamField = {
  key: 'vineyardId',
  label: 'Vineyard',
  type: 'select',
  defaultValue: 'new',
  options: []
};

// Only params relevant to creating a grapes-stage batch (harvest quantity).
const grapesStageParams: TestLabParamField[] = [
  vineyardPickerParam,
  ...vineyardConfigParams,
  ...harvestDateParams,
  { key: 'quantityKg', label: 'Grape quantity kg', type: 'number', defaultValue: 1200, min: 1, max: 100000, step: 50 }
];

// Crushing params only shown when crushing is actually performed.
const crushingStageParams: TestLabParamField[] = [
  ...grapesStageParams,
  { key: 'crushingMethod', label: 'Crushing method', type: 'select', defaultValue: 'Mechanical Press', options: crushingMethodOptions },
  { key: 'destemming', label: 'Destemming', type: 'boolean', defaultValue: true },
  { key: 'coldSoak', label: 'Cold soak', type: 'boolean', defaultValue: false },
  { key: 'pressingIntensity', label: 'Pressing intensity', type: 'number', defaultValue: 0.5, min: 0, max: 1, step: 0.05 }
];

// Fermentation setup params added when fermentation is started.
const fermentingStageParams: TestLabParamField[] = [
  ...crushingStageParams,
  { key: 'fermentationMethod', label: 'Fermentation method', type: 'select', defaultValue: 'Basic', options: fermentationMethodOptions },
  { key: 'fermentationTemperature', label: 'Fermentation temperature', type: 'select', defaultValue: 'Ambient', options: fermentationTemperatureOptions }
];

// Bottling adds weeks-aged and optional asking price on top of the full fermentation set.
const bottledStageParams: TestLabParamField[] = [
  ...fermentingStageParams,
  { key: 'fermentationWeeks', label: 'Fermentation weeks', type: 'number', defaultValue: 4, min: 0, max: 52, step: 1 },
  { key: 'askingPrice', label: 'Asking price', type: 'number', defaultValue: 0, min: 0, max: 99999999, step: 1 }
];

const moneyParams: TestLabParamField[] = [
  { key: 'amount', label: 'Amount', type: 'number', defaultValue: 10000, min: 0, max: 999999999, step: 100 }
];

const prestigeParams: TestLabParamField[] = [
  { key: 'amount', label: 'Prestige', type: 'number', defaultValue: 100, min: 0, max: 1000000, step: 10 }
];

const staffXpParams: TestLabParamField[] = [
  { key: 'staffId', label: 'Staff member', type: 'select', defaultValue: 'none', options: [] },
  { key: 'xpCategory', label: 'XP category', type: 'select', defaultValue: 'skill:field', options: staffXpCategoryOptions },
  { key: 'xpAmount', label: 'XP amount', type: 'number', defaultValue: 1000, min: 0, max: 1000000, step: 100 }
];

const makeDefaults = (params: TestLabParamField[]): Record<string, string | number | boolean> =>
  Object.fromEntries(params.map(field => [field.key, field.defaultValue]));

export const TEST_LAB_SCENARIOS: TestLabScenarioDefinition[] = [
  {
    id: 'regression.full-suite',
    title: 'Run Full Regression Suite',
    group: 'Regression Tests',
    description: 'Runs the current Vitest suite through the structured dev endpoint.',
    mutatesData: false,
    params: [
      { key: 'target', label: 'Target test file', type: 'string', defaultValue: '' }
    ],
    defaultParams: { target: '' }
  },
  {
    id: 'company.create-isolated',
    title: 'Create Isolated Test Company',
    group: 'Company Setup',
    description: 'Creates and activates a dedicated company tagged with a durable Test Lab run id.',
    mutatesData: true,
    params: [
      { key: 'companyName', label: 'Company name', type: 'string', defaultValue: 'Admin Test Lab Company' }
    ],
    defaultParams: { companyName: 'Admin Test Lab Company' }
  },
  {
    id: 'finance.set-company-money',
    title: 'Set Company Money',
    group: 'Finance Flow',
    description: 'Sets the active company money through the normal admin transaction path.',
    mutatesData: true,
    params: moneyParams,
    defaultParams: makeDefaults(moneyParams)
  },
  {
    id: 'finance.set-player-balance',
    title: 'Set Player Balance',
    group: 'Finance Flow',
    description: 'Sets the player cash balance associated with the active company user.',
    mutatesData: true,
    params: moneyParams,
    defaultParams: makeDefaults(moneyParams)
  },
  {
    id: 'finance.add-prestige',
    title: 'Add Company Prestige',
    group: 'Finance Flow',
    description: 'Adds a non-decaying admin prestige event to the active company.',
    mutatesData: true,
    params: prestigeParams,
    defaultParams: makeDefaults(prestigeParams)
  },
  {
    id: 'company.set-game-date',
    title: 'Set Game Date',
    group: 'Company Setup',
    description: 'Sets the active company game date without advancing weekly systems.',
    mutatesData: true,
    params: gameDateParams,
    defaultParams: makeDefaults(gameDateParams)
  },
  {
    id: 'vineyard.harvest-ready',
    title: 'Create Harvest-Ready Vineyard',
    group: 'Vineyard Lifecycle',
    description: 'Creates a planted Autumn vineyard with selectable site, grape, health, and ripeness values.',
    mutatesData: true,
    params: baseVineyardParams,
    defaultParams: makeDefaults(baseVineyardParams)
  },
  {
    id: 'winery.grapes-batch',
    title: 'Create Grapes-Stage Batch',
    group: 'Winery Flow',
    description: 'Creates a harvest-ready vineyard and uses harvest services to create a grapes-stage wine batch.',
    mutatesData: true,
    params: grapesStageParams,
    defaultParams: makeDefaults(grapesStageParams)
  },
  {
    id: 'winery.must-ready-batch',
    title: 'Create Must-Ready Batch',
    group: 'Winery Flow',
    description: 'Creates grapes, starts crushing with selected parameters, and completes the activity immediately.',
    mutatesData: true,
    params: crushingStageParams,
    defaultParams: makeDefaults(crushingStageParams)
  },
  {
    id: 'winery.fermenting-batch',
    title: 'Create Fermenting Batch',
    group: 'Winery Flow',
    description: 'Creates must, starts fermentation setup, and completes the setup activity immediately.',
    mutatesData: true,
    params: fermentingStageParams,
    defaultParams: makeDefaults(fermentingStageParams)
  },
  {
    id: 'winery.bottled-wine',
    title: 'Create Bottled Wine',
    group: 'Winery Flow',
    description: 'Creates fermenting wine, applies selected fermentation weeks, bottles it, and records wine log output.',
    mutatesData: true,
    params: bottledStageParams,
    defaultParams: makeDefaults(bottledStageParams)
  },
  {
    id: 'sales.generate-orders',
    title: 'Generate Test Orders',
    group: 'Sales Flow',
    description: 'Uses the real order generation logic against active company bottled wines, bypassing normal waiting.',
    mutatesData: true,
    params: [],
    defaultParams: {}
  },
  {
    id: 'sales.generate-contract',
    title: 'Generate Test Contract',
    group: 'Sales Flow',
    description: 'Uses the real contract generation logic for the active company while bypassing normal chance gates.',
    mutatesData: true,
    params: [],
    defaultParams: {}
  },
  {
    id: 'research.grant-all',
    title: 'Grant All Research',
    group: 'Research and Staff',
    description: 'Unlocks all research projects for the active company.',
    mutatesData: true,
    params: [],
    defaultParams: {}
  },
  {
    id: 'research.remove-all',
    title: 'Remove All Research',
    group: 'Research and Staff',
    description: 'Removes all research unlocks from the active company.',
    mutatesData: true,
    params: [],
    defaultParams: {}
  },
  {
    id: 'staff.set-xp',
    title: 'Set Staff XP',
    group: 'Research and Staff',
    description: 'Sets one staff member XP in a selected skill or grape category for the active company.',
    mutatesData: true,
    params: staffXpParams,
    defaultParams: makeDefaults(staffXpParams)
  },
  {
    id: 'cleanup.by-run-id',
    title: 'Cleanup Test Run',
    group: 'Company Setup',
    description: 'Deletes Test Lab records associated with a durable run id.',
    mutatesData: true,
    params: [
      { key: 'runId', label: 'Run id', type: 'string', defaultValue: '' }
    ],
    defaultParams: { runId: '' }
  }
];

export function getTestLabScenarios(): TestLabScenarioDefinition[] {
  return TEST_LAB_SCENARIOS;
}

export function getTestLabScenario(id: string): TestLabScenarioDefinition | undefined {
  return TEST_LAB_SCENARIOS.find(scenario => scenario.id === id);
}
