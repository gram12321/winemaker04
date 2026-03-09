import { getBoardShareFeature } from '@/lib/features/boardShare';

export type FeatureId =
  | 'core'
  | 'finance'
  | 'staff'
  | 'sales'
  | 'orders'
  | 'contracts'
  | 'vineyard'
  | 'winery'
  | 'wineFeatures'
  | 'wineAging'
  | 'winepedia'
  | 'loans'
  | 'boardShare';

export type AppPageId =
  | 'login'
  | 'company-overview'
  | 'dashboard'
  | 'vineyard'
  | 'winery'
  | 'sales'
  | 'finance'
  | 'staff'
  | 'profile'
  | 'settings'
  | 'admin'
  | 'achievements'
  | 'wine-log'
  | 'highscores'
  | 'winepedia'
  | 'winepedia-customers';

export type NavigationIconKey =
  | 'dashboard'
  | 'finance'
  | 'staff'
  | 'vineyard'
  | 'winery'
  | 'sales';

export interface FeatureMainNavigationItem {
  pageId: AppPageId;
  label: string;
  iconKey: NavigationIconKey;
  order: number;
}

export interface FeatureAccountNavigationItem {
  pageId: AppPageId;
  label: string;
  order: number;
}

export interface FeatureStartupContext {
  companyId: string;
  currentPrestige: number;
}

export interface FeatureTickContext {
  week: number;
  season: string;
  year: number;
}

export interface FeatureAppEventHandlers {
  navigateToWinepedia: () => void;
}

export interface FeatureConstraintResult {
  allowed: boolean;
  errorMessage?: string;
}

export interface FeatureModule {
  id: FeatureId;
  ownedPages: AppPageId[];
  mainNavigation?: FeatureMainNavigationItem[];
  accountNavigation?: FeatureAccountNavigationItem[];
  startup?: {
    onCompanyInitialized?: (context: FeatureStartupContext) => Promise<void> | void;
  };
  ticks?: {
    onWeekAdvanced?: (context: FeatureTickContext) => Promise<void> | void;
    onSeasonStart?: (context: FeatureTickContext) => Promise<void> | void;
    onYearStart?: (context: FeatureTickContext) => Promise<void> | void;
  };
  app?: {
    registerAppEventListeners?: (
      handlers: FeatureAppEventHandlers
    ) => void | (() => void);
  };
}

const featureRegistry: FeatureModule[] = [
  {
    id: 'core',
    ownedPages: [
      'login',
      'company-overview',
      'dashboard',
      'profile',
      'settings',
      'admin',
      'achievements',
      'wine-log',
      'highscores'
    ],
    mainNavigation: [
      {
        pageId: 'dashboard',
        label: 'Company',
        iconKey: 'dashboard',
        order: 10
      }
    ],
    accountNavigation: [
      { pageId: 'profile', label: 'Profile', order: 10 },
      { pageId: 'settings', label: 'Settings', order: 20 },
      { pageId: 'admin', label: 'Admin Dashboard', order: 30 },
      { pageId: 'highscores', label: 'Global Leaderboards', order: 40 },
      { pageId: 'achievements', label: 'Achievements', order: 50 },
      { pageId: 'wine-log', label: 'Wine Production Log', order: 60 }
    ],
    startup: {
      onCompanyInitialized: async ({ currentPrestige }) => {
        const [{ initializeCustomers, preloadAllCustomerRelationships }, { initializeActivitySystem }] = await Promise.all([
          import('../sales/createCustomer'),
          import('../activity/activitymanagers/activityManager')
        ]);

        await initializeCustomers(currentPrestige);

        preloadAllCustomerRelationships().catch((error: unknown) => {
          console.error('Error preloading customer relationships:', error);
        });

        await initializeActivitySystem();
      }
    }
  },
  {
    id: 'finance',
    ownedPages: ['finance'],
    mainNavigation: [
      {
        pageId: 'finance',
        label: 'Finance',
        iconKey: 'finance',
        order: 20
      }
    ]
  },
  {
    id: 'staff',
    ownedPages: ['staff'],
    mainNavigation: [
      {
        pageId: 'staff',
        label: 'Staff',
        iconKey: 'staff',
        order: 30
      }
    ]
  },
  {
    id: 'vineyard',
    ownedPages: ['vineyard'],
    mainNavigation: [
      {
        pageId: 'vineyard',
        label: 'Vineyard',
        iconKey: 'vineyard',
        order: 40
      }
    ]
  },
  {
    id: 'winery',
    ownedPages: ['winery'],
    mainNavigation: [
      {
        pageId: 'winery',
        label: 'Winery',
        iconKey: 'winery',
        order: 50
      }
    ]
  },
  {
    id: 'sales',
    ownedPages: ['sales'],
    mainNavigation: [
      {
        pageId: 'sales',
        label: 'Sales',
        iconKey: 'sales',
        order: 60
      }
    ]
  },
  {
    id: 'orders',
    ownedPages: []
  },
  {
    id: 'contracts',
    ownedPages: []
  },
  {
    id: 'loans',
    ownedPages: []
  },
  {
    id: 'wineFeatures',
    ownedPages: []
  },
  {
    id: 'wineAging',
    ownedPages: []
  },
  {
    id: 'winepedia',
    ownedPages: ['winepedia', 'winepedia-customers'],
    accountNavigation: [
      { pageId: 'winepedia', label: 'Wine-Pedia', order: 70 }
    ]
  },
  {
    id: 'boardShare',
    ownedPages: [],
    app: {
      registerAppEventListeners: ({ navigateToWinepedia }) =>
        getBoardShareFeature().ui.registerAppEventListeners?.({
          navigateToWinepedia
        })
    },
    ticks: {
      onWeekAdvanced: (context) =>
        getBoardShareFeature().ticks.onWeekAdvanced(context),
      onSeasonStart: (context) =>
        getBoardShareFeature().ticks.onSeasonStart(context),
      onYearStart: (context) =>
        getBoardShareFeature().ticks.onYearStart(context)
    }
  }
];

const getEnabledFeatureSet = (enabledFeatureIds?: FeatureId[]): Set<FeatureId> =>
  new Set(enabledFeatureIds ?? featureRegistry.map((feature) => feature.id));

const getActiveFeatureModules = (enabledFeatureIds?: FeatureId[]): FeatureModule[] => {
  const enabled = getEnabledFeatureSet(enabledFeatureIds);
  return featureRegistry.filter((feature) => enabled.has(feature.id));
};

function dedupeAndSortByPageId<T extends { pageId: AppPageId; order: number }>(items: T[]): T[] {
  const deduped = new Map<AppPageId, T>();
  for (const item of items) {
    if (!deduped.has(item.pageId)) {
      deduped.set(item.pageId, item);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.order - b.order);
}

export function getFeatureRegistry(): readonly FeatureModule[] {
  return featureRegistry;
}

export function getMainNavigationItems(enabledFeatureIds?: FeatureId[]): FeatureMainNavigationItem[] {
  const items = getActiveFeatureModules(enabledFeatureIds).flatMap(
    (feature) => feature.mainNavigation ?? []
  );
  return dedupeAndSortByPageId(items);
}

export function getAccountNavigationItems(
  enabledFeatureIds?: FeatureId[]
): FeatureAccountNavigationItem[] {
  const items = getActiveFeatureModules(enabledFeatureIds).flatMap(
    (feature) => feature.accountNavigation ?? []
  );
  return dedupeAndSortByPageId(items);
}

export async function runFeatureStartupHooks(
  context: FeatureStartupContext,
  enabledFeatureIds?: FeatureId[]
): Promise<void> {
  for (const feature of getActiveFeatureModules(enabledFeatureIds)) {
    const hook = feature.startup?.onCompanyInitialized;
    if (!hook) continue;

    try {
      await hook(context);
    } catch (error) {
      console.error(`Error running startup hook for feature "${feature.id}":`, error);
    }
  }
}

export function registerAppFeatureEventListeners(
  handlers: FeatureAppEventHandlers,
  enabledFeatureIds?: FeatureId[]
): () => void {
  const cleanups: Array<() => void> = [];

  for (const feature of getActiveFeatureModules(enabledFeatureIds)) {
    const register = feature.app?.registerAppEventListeners;
    if (!register) continue;

    try {
      const cleanup = register(handlers);
      if (typeof cleanup === 'function') {
        cleanups.push(cleanup);
      }
    } catch (error) {
      console.error(`Error registering app listeners for feature "${feature.id}":`, error);
    }
  }

  return () => {
    for (const cleanup of cleanups.reverse()) {
      cleanup();
    }
  };
}

export async function runFeatureWeekAdvancedHooks(
  context: FeatureTickContext,
  enabledFeatureIds?: FeatureId[]
): Promise<void> {
  for (const feature of getActiveFeatureModules(enabledFeatureIds)) {
    const hook = feature.ticks?.onWeekAdvanced;
    if (!hook) continue;

    try {
      await hook(context);
    } catch (error) {
      console.warn(`Error running week hook for feature "${feature.id}":`, error);
    }
  }
}

export async function runFeatureSeasonStartHooks(
  context: FeatureTickContext,
  enabledFeatureIds?: FeatureId[]
): Promise<void> {
  for (const feature of getActiveFeatureModules(enabledFeatureIds)) {
    const hook = feature.ticks?.onSeasonStart;
    if (!hook) continue;

    try {
      await hook(context);
    } catch (error) {
      console.warn(`Error running season hook for feature "${feature.id}":`, error);
    }
  }
}

export async function runFeatureYearStartHooks(
  context: FeatureTickContext,
  enabledFeatureIds?: FeatureId[]
): Promise<void> {
  for (const feature of getActiveFeatureModules(enabledFeatureIds)) {
    const hook = feature.ticks?.onYearStart;
    if (!hook) continue;

    try {
      await hook(context);
    } catch (error) {
      console.warn(`Error running year hook for feature "${feature.id}":`, error);
    }
  }
}

export async function checkStaffHiringConstraint(params: {
  candidateName: string;
}): Promise<FeatureConstraintResult> {
  try {
    return await getBoardShareFeature().constraints.checkStaffHiring(params);
  } catch (error) {
    console.error('Error checking staff hiring constraint:', error);
    return {
      allowed: false,
      errorMessage: 'Unable to validate board hiring constraint right now.'
    };
  }
}

export async function checkVineyardPurchaseConstraint(params: {
  currentMoney: number;
  purchaseAmount: number;
  totalAssets: number;
  fixedAssets: number;
  currentAssets: number;
  expensesPerSeason: number;
  profitMargin: number;
}): Promise<FeatureConstraintResult> {
  try {
    return await getBoardShareFeature().constraints.checkVineyardPurchase(params);
  } catch (error) {
    console.error('Error checking vineyard purchase constraint:', error);
    return {
      allowed: false,
      errorMessage: 'Unable to validate board purchase constraint right now.'
    };
  }
}
