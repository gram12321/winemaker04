export type FeatureNamespace =
  | 'activity'
  | 'admin'
  | 'board'
  | 'core'
  | 'finance'
  | 'prestige'
  | 'research'
  | 'sales'
  | 'user'
  | 'vineyard'
  | 'wine';

export interface FeatureOwnershipContract {
  feature: FeatureNamespace;
  serviceRoot: `src/lib/services/${FeatureNamespace}`;
  dbNamespace: `@/lib/database/${FeatureNamespace}` | null;
  typeNamespace: `@/lib/types/features/${string}` | `@/lib/types/shared/${string}`;
}

export const FEATURE_OWNERSHIP_MATRIX: ReadonlyArray<FeatureOwnershipContract> = [
  {
    feature: 'activity',
    serviceRoot: 'src/lib/services/activity',
    dbNamespace: '@/lib/database/activity',
    typeNamespace: '@/lib/types/features/activityTypes'
  },
  {
    feature: 'admin',
    serviceRoot: 'src/lib/services/admin',
    dbNamespace: null,
    typeNamespace: '@/lib/types/shared/coreTypes'
  },
  {
    feature: 'board',
    serviceRoot: 'src/lib/services/board',
    dbNamespace: null,
    typeNamespace: '@/lib/types/shared/coreTypes'
  },
  {
    feature: 'core',
    serviceRoot: 'src/lib/services/core',
    dbNamespace: null,
    typeNamespace: '@/lib/types/shared/gameStateTypes'
  },
  {
    feature: 'finance',
    serviceRoot: 'src/lib/services/finance',
    dbNamespace: '@/lib/database/finance',
    typeNamespace: '@/lib/types/features/financeTypes'
  },
  {
    feature: 'prestige',
    serviceRoot: 'src/lib/services/prestige',
    dbNamespace: '@/lib/database/prestige',
    typeNamespace: '@/lib/types/features/prestigeTypes'
  },
  {
    feature: 'research',
    serviceRoot: 'src/lib/services/research',
    dbNamespace: '@/lib/database/research',
    typeNamespace: '@/lib/types/shared/coreTypes'
  },
  {
    feature: 'sales',
    serviceRoot: 'src/lib/services/sales',
    dbNamespace: '@/lib/database/sales',
    typeNamespace: '@/lib/types/features/salesTypes'
  },
  {
    feature: 'user',
    serviceRoot: 'src/lib/services/user',
    dbNamespace: '@/lib/database/user',
    typeNamespace: '@/lib/types/features/staffTypes'
  },
  {
    feature: 'vineyard',
    serviceRoot: 'src/lib/services/vineyard',
    dbNamespace: '@/lib/database/vineyard',
    typeNamespace: '@/lib/types/features/vineyardTypes'
  },
  {
    feature: 'wine',
    serviceRoot: 'src/lib/services/wine',
    dbNamespace: '@/lib/database/wine',
    typeNamespace: '@/lib/types/features/wineTypes'
  }
] as const;
