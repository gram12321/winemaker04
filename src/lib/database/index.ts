// Feature-owned database repository barrels
export * as activityDb from './activity';
export * as financeDb from './finance';
export * as prestigeDb from './prestige';
export * as researchDb from './research';
export * as salesDb from './sales';
export * as userDb from './user';
export * as vineyardDb from './vineyard';
export * as wineDb from './wine';

// Legacy broad exports (kept for wildcard ergonomics)
export * from './activities/vineyardDB';
export * from './activities/inventoryDB';
export * from './core/gamestateDB';
export * from './core/staffDB';
export * from './core/highscoresDB';
export * from './core/companiesDB';
export * from './core/usersDB';
export * from './core/transactionsDB';
export * from './core/wineLogDB';
export * from './core/userSettingsDB';
export * from './core/lendersDB';
export * from './core/loansDB';
export * from './customers/customerDB';
export * from './customers/relationshipBoostsDB';
export * from './customers/prestigeEventsDB';
export * from './core/researchUnlocksDB';
export { supabase } from './core/supabase';
