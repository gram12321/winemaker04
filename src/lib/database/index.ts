// Database barrel exports - CRUD only (no business logic)
export * from './activities/vineyardDB';
export * from './activities/inventoryDB';
export * from './core/gamestateDB';
export * from './core/staffDB';
export * from './core/highscoresDB';
export * from './core/companiesDB';
export * from './core/companySharesDB';
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
