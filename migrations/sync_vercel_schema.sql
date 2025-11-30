-- ============================================================
-- AI AGENT INSTRUCTIONS: Vercel Database Full Reset Migration
-- ============================================================
-- PURPOSE: Complete schema reset - DROPS ALL DATA
-- USE: Major breaking changes, corrupted data, or clean slate needed
-- DATA LOSS: ✅ All data is lost
-- WHEN TO USE: When vercel_migration_preserve_data.sql fails or major schema changes
-- HOW TO REGENERATE: Run mcp_supabase-dev_list_tables, then generate complete schema
-- ============================================================
-- Winemaker Game - Vercel Database Schema Sync
-- Generated: 2025-01-27 (Updated with years_since_last_clearing field)
-- Dev Database: uuribntaigecwtkdxeyw
-- Vercel Database: uuzoeoukixvunbnkrowi
-- ============================================================
-- This migration syncs the Vercel database schema with the current dev database
-- Run this in Vercel Supabase SQL Editor: 
-- https://supabase.com/dashboard/project/uuzoeoukixvunbnkrowi/editor
--
-- CRITICAL UNIQUE CONSTRAINTS (from dev database):
-- ✅ highscores: Partial unique index on (company_id, score_type) for aggregate types only
-- ✅ achievements: UNIQUE (company_id, achievement_key)
-- ✅ user_settings: UNIQUE (user_id, company_id)
-- ✅ companies: UNIQUE (name)
--
-- CRITICAL RLS SETUP (from dev database):
-- ✅ ALL tables: RLS DISABLED (except staff)
-- ✅ staff table: RLS ENABLED with 4 permissive policies for public role
--
-- FOREIGN KEY DELETE RULES (from dev database):
-- ✅ company_customers: NO ACTION (not CASCADE) on both foreign keys
-- ✅ All others: CASCADE or SET NULL as specified
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CLEANUP EXISTING SCHEMA
-- ============================================================

-- Drop existing tables if they exist (safe cleanup)
-- Run each statement individually to avoid transaction issues
DROP TABLE IF EXISTS notification_filters CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS wine_log CASCADE;
DROP TABLE IF EXISTS company_customers CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS highscores CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS relationship_boosts CASCADE;
DROP TABLE IF EXISTS prestige_events CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS wine_orders CASCADE;
DROP TABLE IF EXISTS wine_contracts CASCADE;
DROP TABLE IF EXISTS wine_batches CASCADE;
DROP TABLE IF EXISTS vineyards CASCADE;
DROP TABLE IF EXISTS game_state CASCADE;
DROP TABLE IF EXISTS company_metrics_history CASCADE;
DROP TABLE IF EXISTS company_shares CASCADE;
DROP TABLE IF EXISTS loan_warnings CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS lenders CASCADE;

-- ============================================================
-- CREATE TABLES (in dependency order)
-- ============================================================
-- Game state table (company-scoped snapshot)
CREATE TABLE game_state (
    id uuid PRIMARY KEY, -- company id
    player_name text DEFAULT 'Player',
    week integer DEFAULT 1,
    season text DEFAULT 'Spring' CHECK (season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    current_year integer DEFAULT 2024,
    money numeric DEFAULT 0,
    prestige numeric DEFAULT 0,
    economy_phase text DEFAULT 'Stable' CHECK (economy_phase IN ('Crash', 'Recession', 'Stable', 'Expansion', 'Boom')),
    updated_at timestamptz DEFAULT now()
);


-- Users table
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text,
    name text NOT NULL,
    avatar text DEFAULT 'default',
    avatar_color text DEFAULT 'blue',
    cash_balance numeric DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN users.cash_balance IS 'Player personal cash balance in euros, used for company investments';

-- Companies table
CREATE TABLE companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    founded_year integer DEFAULT 2024,
    current_week integer DEFAULT 1,
    current_season text DEFAULT 'Spring',
    current_year integer DEFAULT 2024,
    money numeric DEFAULT 0,
    prestige numeric DEFAULT 0,
    credit_rating integer DEFAULT 50 CHECK (credit_rating >= 0 AND credit_rating <= 100),
    economy_phase text DEFAULT 'Stable' CHECK (economy_phase IN ('Crash', 'Recession', 'Stable', 'Expansion', 'Boom')),
    starting_country text,
    -- Public company system fields
    total_shares bigint DEFAULT 1000000,
    outstanding_shares bigint DEFAULT 0,
    player_shares bigint DEFAULT 1000000,
    initial_ownership_pct numeric DEFAULT 100.0,
    dividend_rate numeric DEFAULT 0,
    last_dividend_paid_week integer,
    last_dividend_paid_season text,
    last_dividend_paid_year integer,
    market_cap numeric DEFAULT 0,
    share_price numeric DEFAULT 0,
    initial_vineyard_value numeric DEFAULT 0,
    -- Growth trend tracking for share valuation
    growth_trend_multiplier numeric DEFAULT 1.0,
    last_growth_trend_update_week integer,
    last_growth_trend_update_season text,
    last_growth_trend_update_year integer,
    -- Incremental share price tracking
    last_share_price_update_week integer,
    last_share_price_update_season text,
    last_share_price_update_year integer,
    -- Base values for expected value calculations (future: NPC/Board room controlled)
    base_revenue_growth numeric,
    base_profit_margin numeric,
    base_expected_return_on_book_value numeric,
    last_played timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN companies.starting_country IS 'Starting country selected during company creation (France, Italy, Germany, Spain, United States)';
COMMENT ON COLUMN companies.total_shares IS 'Total authorized shares for the company';
COMMENT ON COLUMN companies.outstanding_shares IS 'Shares held by outside investors';
COMMENT ON COLUMN companies.player_shares IS 'Shares held by the player';
COMMENT ON COLUMN companies.initial_ownership_pct IS 'Player initial ownership percentage (0-100)';
COMMENT ON COLUMN companies.dividend_rate IS 'Current dividend rate (fixed per share in euros)';
COMMENT ON COLUMN companies.last_dividend_paid_week IS 'Week when last dividend was paid';
COMMENT ON COLUMN companies.last_dividend_paid_season IS 'Season when last dividend was paid';
COMMENT ON COLUMN companies.last_dividend_paid_year IS 'Year when last dividend was paid';
COMMENT ON COLUMN companies.market_cap IS 'Current market capitalization';
COMMENT ON COLUMN companies.share_price IS 'Current share price';
COMMENT ON COLUMN companies.initial_vineyard_value IS 'Initial vineyard value at company creation (family contribution for equity calculation)';
COMMENT ON COLUMN companies.growth_trend_multiplier IS 'Multiplier adjusting expected values based on historical performance (default: 1.0)';
COMMENT ON COLUMN companies.last_growth_trend_update_week IS 'Week when growth trend was last updated';
COMMENT ON COLUMN companies.last_growth_trend_update_season IS 'Season when growth trend was last updated';
COMMENT ON COLUMN companies.last_growth_trend_update_year IS 'Year when growth trend was last updated';
COMMENT ON COLUMN companies.last_share_price_update_week IS 'Week when share price was last adjusted incrementally';
COMMENT ON COLUMN companies.last_share_price_update_season IS 'Season when share price was last adjusted incrementally';
COMMENT ON COLUMN companies.last_share_price_update_year IS 'Year when share price was last adjusted incrementally';

-- Company shares table (normalized share-related data)
CREATE TABLE company_shares (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Share structure
  total_shares bigint DEFAULT 1000000 NOT NULL,
  outstanding_shares bigint DEFAULT 0 NOT NULL,
  player_shares bigint DEFAULT 1000000 NOT NULL,
  initial_ownership_pct numeric DEFAULT 100.0,
  
  -- Dividends
  dividend_rate numeric DEFAULT 0 NOT NULL,
  last_dividend_paid_week integer,
  last_dividend_paid_season text CHECK (last_dividend_paid_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
  last_dividend_paid_year integer,
  
  -- Pricing
  market_cap numeric DEFAULT 0 NOT NULL,
  share_price numeric DEFAULT 0 NOT NULL,
  
  -- Growth trend tracking
  growth_trend_multiplier numeric DEFAULT 1.0 NOT NULL,
  last_growth_trend_update_week integer,
  last_growth_trend_update_season text CHECK (last_growth_trend_update_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
  last_growth_trend_update_year integer,
  
  -- Incremental share price tracking
  last_share_price_update_week integer,
  last_share_price_update_season text CHECK (last_share_price_update_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
  last_share_price_update_year integer,
  
  -- Base values for expected value calculations (future: NPC/Board room controlled)
  base_revenue_growth numeric,
  base_profit_margin numeric,
  base_expected_return_on_book_value numeric,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE company_shares IS 'Share-related data for public companies, normalized from companies table';
COMMENT ON COLUMN company_shares.total_shares IS 'Total authorized shares for the company';
COMMENT ON COLUMN company_shares.outstanding_shares IS 'Shares held by outside investors';
COMMENT ON COLUMN company_shares.player_shares IS 'Shares held by the player';
COMMENT ON COLUMN company_shares.initial_ownership_pct IS 'Player initial ownership percentage (0-100)';
COMMENT ON COLUMN company_shares.dividend_rate IS 'Current dividend rate (fixed per share in euros)';
COMMENT ON COLUMN company_shares.last_dividend_paid_week IS 'Week when last dividend was paid';
COMMENT ON COLUMN company_shares.last_dividend_paid_season IS 'Season when last dividend was paid';
COMMENT ON COLUMN company_shares.last_dividend_paid_year IS 'Year when last dividend was paid';
COMMENT ON COLUMN company_shares.market_cap IS 'Current market capitalization';
COMMENT ON COLUMN company_shares.share_price IS 'Current share price';
COMMENT ON COLUMN company_shares.growth_trend_multiplier IS 'Multiplier adjusting expected values based on historical performance (default: 1.0)';
COMMENT ON COLUMN company_shares.last_growth_trend_update_week IS 'Week when growth trend was last updated';
COMMENT ON COLUMN company_shares.last_growth_trend_update_season IS 'Season when growth trend was last updated';
COMMENT ON COLUMN company_shares.last_growth_trend_update_year IS 'Year when growth trend was last updated';
COMMENT ON COLUMN company_shares.last_share_price_update_week IS 'Week when share price was last adjusted incrementally';
COMMENT ON COLUMN company_shares.last_share_price_update_season IS 'Season when share price was last adjusted incrementally';
COMMENT ON COLUMN company_shares.last_share_price_update_year IS 'Year when share price was last adjusted incrementally';
COMMENT ON COLUMN company_shares.base_revenue_growth IS 'Base revenue growth expectation (default: 0.10 = 10%). Future: NPC/Board room controlled.';
COMMENT ON COLUMN company_shares.base_profit_margin IS 'Base profit margin expectation (default: 0.15 = 15%). Future: NPC/Board room controlled.';
COMMENT ON COLUMN company_shares.base_expected_return_on_book_value IS 'Base expected return on book value (default: 0.10 = 10%). Future: NPC/Board room controlled.';

-- User settings table
CREATE TABLE user_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    show_toast_notifications boolean DEFAULT true,
    allow_resource_substitution boolean DEFAULT true,
    show_detailed_input_section boolean DEFAULT true,
    notification_categories jsonb DEFAULT '{}'::jsonb,
    notification_specific_messages jsonb DEFAULT '{}'::jsonb,
    view_preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (user_id, company_id)
);

-- Vineyards table
CREATE TABLE vineyards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text NOT NULL,
    country text DEFAULT 'France',
    region text DEFAULT 'Bordeaux',
    acres integer DEFAULT 1,
    grape_variety text,
    is_planted boolean DEFAULT false,
    status text DEFAULT 'Barren' CHECK (status IN ('Barren', 'Planting', 'Planted', 'Growing', 'Harvested', 'Dormant')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_week integer DEFAULT 1,
    created_season text DEFAULT 'Spring',
    created_year integer DEFAULT 2024,
    field_prestige numeric DEFAULT 1,
    land_value numeric DEFAULT 0.5,
    hectares numeric DEFAULT 1,
    vine_age integer DEFAULT 0,
    soil jsonb DEFAULT '["Clay"]'::jsonb,
    altitude integer DEFAULT 200,
    aspect text DEFAULT 'South',
    vineyard_prestige numeric DEFAULT 0.1,
    vineyard_total_value numeric DEFAULT 0,
    density integer DEFAULT 0,
    vineyard_health numeric DEFAULT 1.0,
    ripeness numeric DEFAULT 0.0,
    vine_yield numeric DEFAULT 0.02,
    overgrowth jsonb DEFAULT '{"vegetation": 0, "debris": 0, "uproot": 0, "replant": 0}'::jsonb,
    planting_health_bonus numeric DEFAULT 0,
    health_trend jsonb,
    pending_features jsonb,
    years_since_last_clearing integer DEFAULT 0,
    last_clearing_year integer DEFAULT 0,
    last_clear_vegetation_year integer DEFAULT 0,
    last_remove_debris_year integer DEFAULT 0
);

COMMENT ON COLUMN vineyards.overgrowth IS 'Years since last clearing activity for each task type (vegetation, debris, uproot, replant)';
COMMENT ON COLUMN vineyards.planting_health_bonus IS 'Gradual health improvement from planting/replanting (0-0.2, increases over 5 years)';
COMMENT ON COLUMN vineyards.health_trend IS 'Health trend tracking (seasonal decay, planting improvements, net change)';
COMMENT ON COLUMN vineyards.years_since_last_clearing IS 'Years since last clearing activity (affects overgrowth modifier for clearing work)';

-- Wine batches table
CREATE TABLE wine_batches (
    id text PRIMARY KEY,
    company_id uuid NOT NULL,
    vineyard_id text NOT NULL,
    vineyard_name text NOT NULL,
    grape_variety text NOT NULL,
    quantity integer NOT NULL,
    fermentation_progress integer DEFAULT 0 CHECK (fermentation_progress >= 0 AND fermentation_progress <= 100),
    grape_quality numeric DEFAULT 0.7 CHECK (grape_quality >= 0 AND grape_quality <= 1),
    born_grape_quality numeric CHECK (born_grape_quality BETWEEN 0 AND 1),
    balance numeric DEFAULT 0.6 CHECK (balance >= 0 AND balance <= 1),
    born_balance numeric CHECK (born_balance BETWEEN 0 AND 1),
    asking_price numeric,
    characteristics jsonb DEFAULT '{"body": 0.5, "aroma": 0.5, "spice": 0.5, "acidity": 0.5, "tannins": 0.5, "sweetness": 0.5}'::jsonb,
    breakdown jsonb DEFAULT '{}'::jsonb,
    state text DEFAULT 'grapes' CHECK (state IN ('grapes', 'must_ready', 'must_fermenting', 'bottled')),
    fermentation_options jsonb,
    grape_color text DEFAULT 'red' CHECK (grape_color IN ('red', 'white')),
    natural_yield numeric DEFAULT 1.0 CHECK (natural_yield >= 0 AND natural_yield <= 1),
    fragile numeric DEFAULT 0.5 CHECK (fragile >= 0 AND fragile <= 1),
    prone_to_oxidation numeric DEFAULT 0.5 CHECK (prone_to_oxidation >= 0 AND prone_to_oxidation <= 1),
    harvest_start_week integer NOT NULL,
    harvest_start_season text NOT NULL,
    harvest_start_year integer NOT NULL,
    harvest_end_week integer NOT NULL,
    harvest_end_season text NOT NULL,
    harvest_end_year integer NOT NULL,
    estimated_price numeric,
    bottled_week integer,
    bottled_season text,
    bottled_year integer,
    features jsonb DEFAULT '[]'::jsonb,
    aging_progress integer DEFAULT 0,
    batch_number integer,
    batch_group_size integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN wine_batches.features IS 'JSONB array of wine features and faults (oxidation, green flavor, terroir, etc). Each feature has id, risk, isPresent, severity, name, type, and icon fields.';
COMMENT ON COLUMN wine_batches.grape_quality IS 'Overall grape quality (0-1 scale)';

-- Wine orders table
CREATE TABLE wine_orders (
    id text PRIMARY KEY,
    company_id uuid NOT NULL,
    wine_batch_id text NOT NULL,
    wine_name text NOT NULL,
    order_type text NOT NULL,
    requested_quantity integer NOT NULL,
    offered_price numeric NOT NULL,
    total_value numeric NOT NULL,
    status varchar DEFAULT 'pending',
    ordered_week integer NOT NULL,
    ordered_season text NOT NULL,
    ordered_year integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    fulfillable_quantity integer,
    fulfillable_value numeric,
    asking_price_at_order_time numeric,
    customer_id text,
    customer_name text,
    customer_country text,
    expires_at integer NOT NULL DEFAULT 100,
    expires_week integer NOT NULL DEFAULT 1 CHECK (expires_week >= 1 AND expires_week <= 12),
    expires_season text NOT NULL DEFAULT 'Spring' CHECK (expires_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    expires_year integer NOT NULL DEFAULT 2024,
    calculation_data jsonb
);

-- Wine contracts table
CREATE TABLE wine_contracts (
    id text PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_id text NOT NULL,
    customer_name text NOT NULL,
    customer_country text NOT NULL,
    customer_type text NOT NULL CHECK (customer_type IN ('Restaurant', 'Wine Shop', 'Private Collector', 'Chain Store')),
    requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
    requested_quantity integer NOT NULL CHECK (requested_quantity > 0),
    offered_price numeric NOT NULL CHECK (offered_price >= 0),
    total_value numeric NOT NULL CHECK (total_value >= 0),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'rejected', 'expired')),
    terms jsonb,
    created_week integer NOT NULL CHECK (created_week IS NULL OR (created_week >= 1 AND created_week <= 12)),
    created_season text NOT NULL CHECK (created_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    created_year integer NOT NULL,
    expires_week integer NOT NULL CHECK (expires_week IS NULL OR (expires_week >= 1 AND expires_week <= 12)),
    expires_season text NOT NULL CHECK (expires_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    expires_year integer NOT NULL,
    fulfilled_week integer CHECK (fulfilled_week IS NULL OR (fulfilled_week >= 1 AND fulfilled_week <= 12)),
    fulfilled_season text CHECK (fulfilled_season IS NULL OR fulfilled_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    fulfilled_year integer,
    rejected_week integer CHECK (rejected_week IS NULL OR (rejected_week >= 1 AND rejected_week <= 12)),
    rejected_season text CHECK (rejected_season IS NULL OR rejected_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    rejected_year integer,
    fulfilled_wine_batch_ids text[],
    relationship_at_creation numeric NOT NULL DEFAULT 0 CHECK (relationship_at_creation >= 0 AND relationship_at_creation <= 100),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Transactions table
CREATE TABLE transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id text NOT NULL DEFAULT 'default',
    amount numeric NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    recurring boolean DEFAULT false,
    money numeric NOT NULL,
    week integer DEFAULT 1,
    season text DEFAULT 'Spring' CHECK (season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    year integer DEFAULT 2024,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Customers table
CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    country text NOT NULL,
    customer_type text NOT NULL,
    market_share double precision NOT NULL,
    purchasing_power double precision NOT NULL,
    wine_tradition double precision NOT NULL,
    price_multiplier double precision NOT NULL,
    relationship double precision DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    active_customer boolean DEFAULT false,
    company_id uuid NOT NULL
);

-- Company customers junction table
CREATE TABLE company_customers (
    company_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    relationship numeric NOT NULL DEFAULT 0,
    active_customer boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (company_id, customer_id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Prestige events table
CREATE TABLE prestige_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('sale', 'vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land', 'vineyard_region', 'company_finance', 'wine_feature', 'cellar_collection', 'achievement', 'penalty', 'company_story')),
    amount_base numeric NOT NULL,
    decay_rate numeric DEFAULT 0,
    description text,
    source_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    company_id uuid DEFAULT '00000000-0000-0000-0000-000000000000',
    created_game_week integer,
    calc_text text,
    display_info text,
    metadata jsonb DEFAULT '{}'::jsonb,
    payload jsonb DEFAULT '{}'::jsonb
);

-- Relationship boosts table
CREATE TABLE relationship_boosts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id text NOT NULL,
    amount numeric NOT NULL,
    timestamp bigint,
    decay_rate numeric DEFAULT 0.95,
    description text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    company_id uuid DEFAULT '00000000-0000-0000-0000-000000000000',
    created_game_week integer
);

-- Highscores table
CREATE TABLE highscores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    company_name text NOT NULL,
    score_type text NOT NULL,
    score_value numeric NOT NULL,
    game_week integer,
    game_season text,
    game_year integer,
    achieved_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    vineyard_id text,
    vineyard_name text,
    wine_vintage integer,
    grape_variety text
);

-- Achievements table
CREATE TABLE achievements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    achievement_key text NOT NULL,
    achievement_name text NOT NULL,
    description text,
    achieved_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    unlocked_game_week integer,
    unlocked_game_season varchar,
    unlocked_game_year integer,
    progress jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    UNIQUE (company_id, achievement_key)
);

COMMENT ON TABLE achievements IS 'Tracks unlocked achievements for each company with prestige integration and progress tracking';
COMMENT ON COLUMN achievements.achievement_key IS 'Identifier matching achievement definition in code';
COMMENT ON COLUMN achievements.progress IS 'Optional progress data for tracking partial completion';
COMMENT ON COLUMN achievements.metadata IS 'Additional data about the achievement unlock (e.g., prestige amount spawned)';

-- Research unlocks table
CREATE TABLE research_unlocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    research_id text NOT NULL,
    unlocked_game_week integer,
    unlocked_game_season varchar,
    unlocked_game_year integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE (company_id, research_id)
);

CREATE INDEX idx_research_unlocks_company ON research_unlocks(company_id);
CREATE INDEX idx_research_unlocks_research ON research_unlocks(research_id);

COMMENT ON TABLE research_unlocks IS 'Tracks completed research projects that unlock game features (e.g., grape varieties)';
COMMENT ON COLUMN research_unlocks.research_id IS 'Identifier matching research project ID in code';
COMMENT ON COLUMN research_unlocks.metadata IS 'Additional data about the research unlock (e.g., unlocked grape variety)';

-- Wine log table
CREATE TABLE wine_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id text NOT NULL DEFAULT 'default',
    vineyard_id text NOT NULL,
    vineyard_name text NOT NULL,
    grape_variety text NOT NULL,
    vintage integer NOT NULL,
    quantity integer NOT NULL,
    grape_quality numeric NOT NULL CHECK (grape_quality >= 0 AND grape_quality <= 1),
    balance numeric NOT NULL CHECK (balance >= 0 AND balance <= 1),
    wine_score numeric NOT NULL CHECK (wine_score >= 0 AND wine_score <= 1),
    characteristics jsonb DEFAULT '{"body": 0.5, "aroma": 0.5, "spice": 0.5, "acidity": 0.5, "tannins": 0.5, "sweetness": 0.5}'::jsonb,
    harvest_week integer NOT NULL,
    harvest_season text NOT NULL CHECK (harvest_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    harvest_year integer NOT NULL,
    bottled_week integer NOT NULL,
    bottled_season text NOT NULL CHECK (bottled_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    bottled_year integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    estimated_price numeric
);

-- Notifications table
CREATE TABLE notifications (
    id text PRIMARY KEY,
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    timestamp timestamptz DEFAULT now(),
    text text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    game_week integer,
    game_season text,
    game_year integer,
    origin text,
    userfriendlyorigin text,
    category text
);

-- Activities table
CREATE TABLE activities (
    id text PRIMARY KEY,
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('PLANTING', 'HARVESTING', 'CRUSHING', 'FERMENTATION', 'CLEARING', 'UPROOTING', 'BUILDING', 'UPGRADING', 'ADMINISTRATION_AND_RESEARCH', 'STAFF_SEARCH', 'STAFF_HIRING', 'LAND_SEARCH', 'LENDER_SEARCH', 'TAKE_LOAN', 'FINANCE_AND_STAFF')),
    title text NOT NULL,
    total_work numeric NOT NULL CHECK (total_work > 0),
    completed_work numeric DEFAULT 0 CHECK (completed_work >= 0),
    target_id text,
    params jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
    game_week integer NOT NULL,
    game_season text NOT NULL CHECK (game_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    game_year integer NOT NULL,
    is_cancellable boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Staff table
CREATE TABLE staff (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    nationality text NOT NULL,
    skill_level numeric NOT NULL CHECK (skill_level >= 0 AND skill_level <= 1),
    specializations text[] DEFAULT '{}',
    wage integer NOT NULL CHECK (wage >= 0),
    skill_field numeric NOT NULL CHECK (skill_field >= 0 AND skill_field <= 1),
    skill_winery numeric NOT NULL CHECK (skill_winery >= 0 AND skill_winery <= 1),
    skill_administration numeric NOT NULL CHECK (skill_administration >= 0 AND skill_administration <= 1),
    skill_sales numeric NOT NULL CHECK (skill_sales >= 0 AND skill_sales <= 1),
    skill_maintenance numeric NOT NULL CHECK (skill_maintenance >= 0 AND skill_maintenance <= 1),
    workforce integer DEFAULT 50 CHECK (workforce > 0),
    hire_date_week integer NOT NULL CHECK (hire_date_week >= 1 AND hire_date_week <= 13),
    hire_date_season text NOT NULL,
    hire_date_year integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    team_ids jsonb DEFAULT '[]'::jsonb
);

COMMENT ON TABLE staff IS 'Staff members employed by companies, with skills and wage tracking';


-- Teams table
CREATE TABLE teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text DEFAULT '',
    icon text DEFAULT '👥',
    default_task_types text[] DEFAULT '{}',
    member_ids text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Notification filters table
CREATE TABLE notification_filters (
    id text PRIMARY KEY,
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    filter_type text NOT NULL CHECK (filter_type IN ('origin', 'category')),
    filter_value text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now(),
    block_from_history boolean DEFAULT false
);

-- Lenders table (company-scoped)
CREATE TABLE lenders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('Bank', 'Investment Fund', 'Private Lender', 'QuickLoan')),
    risk_tolerance decimal(3,2) NOT NULL,
    flexibility decimal(3,2) NOT NULL,
    market_presence decimal(3,2) NOT NULL,
    base_interest_rate decimal(5,4) NOT NULL,
    min_loan_amount integer NOT NULL,
    max_loan_amount integer NOT NULL,
    min_duration_seasons integer NOT NULL,
    max_duration_seasons integer NOT NULL,
    origination_fee jsonb NOT NULL DEFAULT '{
        "basePercent": 0.02,
        "minFee": 1000,
        "maxFee": 15000,
        "creditRatingModifier": 0.8,
        "durationModifier": 1.1
    }'::jsonb,
    blacklisted boolean DEFAULT FALSE,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- Loans table (company-scoped)
CREATE TABLE loans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    lender_id uuid NOT NULL REFERENCES lenders(id) ON DELETE RESTRICT,
    lender_name text NOT NULL,
    lender_type text NOT NULL,
    principal_amount integer NOT NULL,
    base_interest_rate decimal(5,4) NOT NULL,
    economy_phase_at_creation text NOT NULL,
    effective_interest_rate decimal(5,4) NOT NULL,
    origination_fee integer NOT NULL DEFAULT 0,
    remaining_balance decimal(10,2) NOT NULL,
    seasonal_payment decimal(10,2) NOT NULL,
    seasons_remaining integer NOT NULL,
    total_seasons integer NOT NULL,
    start_week integer NOT NULL,
    start_season text NOT NULL,
    start_year integer NOT NULL,
    next_payment_week integer NOT NULL,
    next_payment_season text NOT NULL,
    next_payment_year integer NOT NULL,
    missed_payments integer DEFAULT 0,
    status text NOT NULL CHECK (status IN ('active', 'paid_off', 'defaulted')),
    is_forced boolean DEFAULT false,
    loan_category text NOT NULL DEFAULT 'standard',
    pending_warning_id uuid,
    warning_severity varchar CHECK (warning_severity IN ('warning', 'error', 'critical')),
    warning_title text,
    warning_message text,
    warning_details text,
    warning_penalties jsonb DEFAULT '{}'::jsonb,
    warning_decision jsonb,
    warning_acknowledged boolean DEFAULT false,
    warning_created_at timestamptz,
    warning_acknowledged_at timestamptz,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- Loan warnings table
CREATE TABLE loan_warnings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    loan_id uuid REFERENCES loans(id) ON DELETE CASCADE,
    lender_name text NOT NULL,
    missed_payments integer DEFAULT 0,
    severity varchar NOT NULL CHECK (severity IN ('warning', 'error', 'critical')),
    title text NOT NULL,
    message text NOT NULL,
    details text,
    penalties jsonb DEFAULT '{}'::jsonb,
    acknowledged boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    acknowledged_at timestamptz,
    created_game_week integer,
    created_game_season varchar,
    created_game_year integer
);

-- Company metrics history table (for 48-week rolling comparisons and historical diagrams)
CREATE TABLE company_metrics_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    snapshot_week integer NOT NULL CHECK (snapshot_week >= 1 AND snapshot_week <= 12),
    snapshot_season text NOT NULL CHECK (snapshot_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    snapshot_year integer NOT NULL,
    credit_rating numeric NOT NULL,
    prestige numeric NOT NULL,
    fixed_asset_ratio numeric NOT NULL,
    share_price numeric NOT NULL,
    book_value_per_share numeric NOT NULL,
    earnings_per_share_48w numeric NOT NULL,
    revenue_per_share_48w numeric NOT NULL,
    dividend_per_share_48w numeric NOT NULL,
    profit_margin_48w numeric,
    revenue_growth_48w numeric,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE company_metrics_history IS 'Weekly snapshots of company metrics for 48-week rolling comparisons and historical trend diagrams';
COMMENT ON COLUMN company_metrics_history.credit_rating IS 'Credit rating value at snapshot time';
COMMENT ON COLUMN company_metrics_history.prestige IS 'Prestige value at snapshot time';
COMMENT ON COLUMN company_metrics_history.fixed_asset_ratio IS 'Fixed asset ratio (fixed assets / total assets) at snapshot time';
COMMENT ON COLUMN company_metrics_history.share_price IS 'Share price at snapshot time';
COMMENT ON COLUMN company_metrics_history.book_value_per_share IS 'Book value per share at snapshot time';
COMMENT ON COLUMN company_metrics_history.earnings_per_share_48w IS 'Earnings per share (48-week rolling) at snapshot time';
COMMENT ON COLUMN company_metrics_history.revenue_per_share_48w IS 'Revenue per share (48-week rolling) at snapshot time';
COMMENT ON COLUMN company_metrics_history.dividend_per_share_48w IS 'Dividend per share (48-week rolling) at snapshot time';
COMMENT ON COLUMN company_metrics_history.profit_margin_48w IS 'Profit margin (48-week rolling) at snapshot time';
COMMENT ON COLUMN company_metrics_history.revenue_growth_48w IS 'Revenue growth (48-week rolling) at snapshot time';

-- Board satisfaction history table
CREATE TABLE board_satisfaction_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    snapshot_week integer NOT NULL CHECK (snapshot_week >= 1 AND snapshot_week <= 12),
    snapshot_season text NOT NULL CHECK (snapshot_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    snapshot_year integer NOT NULL,
    satisfaction_score numeric NOT NULL CHECK (satisfaction_score >= 0 AND satisfaction_score <= 1),
    performance_score numeric NOT NULL CHECK (performance_score >= 0 AND performance_score <= 1),
    stability_score numeric NOT NULL CHECK (stability_score >= 0 AND stability_score <= 1),
    consistency_score numeric NOT NULL CHECK (consistency_score >= 0 AND consistency_score <= 1),
    ownership_pressure numeric NOT NULL CHECK (ownership_pressure >= 0 AND ownership_pressure <= 1),
    player_ownership_pct numeric NOT NULL CHECK (player_ownership_pct >= 0 AND player_ownership_pct <= 100),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_board_satisfaction_history_company ON board_satisfaction_history(company_id);
CREATE INDEX idx_board_satisfaction_history_date ON board_satisfaction_history(company_id, snapshot_year DESC, snapshot_season DESC, snapshot_week DESC);

COMMENT ON TABLE board_satisfaction_history IS 'Weekly snapshots of board satisfaction for historical tracking and consistency calculations';
COMMENT ON COLUMN board_satisfaction_history.satisfaction_score IS 'Overall board satisfaction score (0-1)';
COMMENT ON COLUMN board_satisfaction_history.performance_score IS 'Performance component score (0-1)';
COMMENT ON COLUMN board_satisfaction_history.stability_score IS 'Financial stability component score (0-1)';
COMMENT ON COLUMN board_satisfaction_history.consistency_score IS 'Consistency/volatility component score (0-1)';
COMMENT ON COLUMN board_satisfaction_history.ownership_pressure IS 'Ownership pressure from outside shareholders (0-1)';
COMMENT ON COLUMN board_satisfaction_history.player_ownership_pct IS 'Player ownership percentage (0-100)';

-- ============================================================
-- SECURITY HELPERS & ROW LEVEL SECURITY
-- ============================================================

-- Helper to detect service-role callers
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

REVOKE ALL ON FUNCTION public.is_service_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO anon, authenticated, service_role;

-- Helper to determine company membership (owner or via user_settings)
CREATE OR REPLACE FUNCTION public.is_company_member(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN target_company_id IS NULL THEN FALSE
    WHEN public.is_service_role() THEN TRUE
    WHEN auth.uid() IS NULL THEN EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = target_company_id
        AND c.user_id IS NULL
    )
    ELSE EXISTS (
      SELECT 1
      FROM public.user_settings us
      WHERE us.company_id = target_company_id
        AND us.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = target_company_id
        AND c.user_id = auth.uid()
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO anon, authenticated, service_role;

-- Helper for legacy tables storing company_id as text
CREATE OR REPLACE FUNCTION public.is_company_member_text(target_company_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  company_uuid uuid;
BEGIN
  IF target_company_id IS NULL THEN
    RETURN FALSE;
  END IF;

  BEGIN
    company_uuid := target_company_id::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN FALSE;
  END;

  RETURN public.is_company_member(company_uuid);
END;
$$;

REVOKE ALL ON FUNCTION public.is_company_member_text(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_company_member_text(text) TO anon, authenticated, service_role;

-- Harden helper functions flagged by Supabase advisor
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_table(table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  EXECUTE format('DELETE FROM %I', table_name);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_clear_all_tables()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    table_name text;
    result text := '';
BEGIN
    FOR table_name IN
        SELECT unnest(ARRAY[
            'relationship_boosts',
            'wine_orders',
            'wine_batches',
            'vineyards',
            'achievements',
            'user_settings',
            'highscores',
            'prestige_events',
            'transactions',
            'companies',
            'users',
            'customers',
            'game_state'
        ])
    LOOP
        BEGIN
            EXECUTE format('DELETE FROM %I', table_name);
            result := result || table_name || ': cleared; ';
        EXCEPTION WHEN OTHERS THEN
            result := result || table_name || ': error - ' || SQLERRM || '; ';
        END;
    END LOOP;

    RETURN result;
END;
$function$;

-- Drop legacy permissive policies
DROP POLICY IF EXISTS "Anyone can view achievements" ON achievements;
DROP POLICY IF EXISTS "Anyone can insert achievements" ON achievements;
DROP POLICY IF EXISTS "Anyone can update achievements" ON achievements;
DROP POLICY IF EXISTS "Allow company access to activities" ON activities;
DROP POLICY IF EXISTS "Anyone can create companies" ON companies;
DROP POLICY IF EXISTS "Anyone can delete companies" ON companies;
DROP POLICY IF EXISTS "Anyone can view companies" ON companies;
DROP POLICY IF EXISTS "Users can update own companies" ON companies;
DROP POLICY IF EXISTS "Anyone can delete highscores" ON highscores;
DROP POLICY IF EXISTS "Anyone can insert highscores" ON highscores;
DROP POLICY IF EXISTS "Anyone can update highscores" ON highscores;
DROP POLICY IF EXISTS "Anyone can view highscores" ON highscores;
DROP POLICY IF EXISTS "Allow company access to notifications" ON notifications;
DROP POLICY IF EXISTS "Allow all operations on prestige_events" ON prestige_events;
DROP POLICY IF EXISTS "Allow all operations on relationship_boosts" ON relationship_boosts;
DROP POLICY IF EXISTS "teams_policy" ON teams;
DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;
DROP POLICY IF EXISTS "Anyone can create users" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can manage their own wine batches" ON wine_batches;
DROP POLICY IF EXISTS "Allow read access to all users" ON staff;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON staff;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON staff;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON staff;
DROP POLICY IF EXISTS "Allow read access to all users" ON loan_warnings;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON loan_warnings;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON loan_warnings;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON loan_warnings;
DROP POLICY IF EXISTS "Allow read access to all users" ON wine_contracts;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON wine_contracts;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON wine_contracts;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON wine_contracts;
DROP POLICY IF EXISTS "Users can access their own company loan warnings" ON loan_warnings;

-- Companies table (owners + members)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_companies" ON companies;
DROP POLICY IF EXISTS "company_members_update_companies" ON companies;
DROP POLICY IF EXISTS "owners_delete_companies" ON companies;
DROP POLICY IF EXISTS "owners_create_companies" ON companies;

CREATE POLICY "company_members_manage_companies"
ON companies
FOR SELECT
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(id));

CREATE POLICY "company_members_update_companies"
ON companies
FOR UPDATE
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(id));

CREATE POLICY "owners_delete_companies"
ON companies
FOR DELETE
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR (select auth.uid()) = user_id);

CREATE POLICY "owners_create_companies"
ON companies
FOR INSERT
WITH CHECK (
  public.is_service_role()
  OR (select auth.uid()) = user_id
  OR (select auth.uid()) IS NULL
);

-- Users manage their own profile
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_manage_self" ON users;
CREATE POLICY "users_manage_self"
ON users
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR (select auth.uid()) = id)
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR (select auth.uid()) = id);

-- User settings scoped to current user
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_settings_self_access" ON user_settings;
CREATE POLICY "user_settings_self_access"
ON user_settings
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) = user_id)
WITH CHECK (public.is_service_role() OR (select auth.uid()) = user_id);

-- Game state scoped by company id (stored in id column)
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_game_state" ON game_state;
CREATE POLICY "company_members_manage_game_state"
ON game_state
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(id));

-- UUID-based company scoped tables
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_achievements" ON achievements;
CREATE POLICY "company_members_manage_achievements"
ON achievements
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE research_unlocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_research_unlocks" ON research_unlocks;
CREATE POLICY "company_members_manage_research_unlocks"
ON research_unlocks
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_activities" ON activities;
CREATE POLICY "company_members_manage_activities"
ON activities
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE company_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_company_customers" ON company_customers;
CREATE POLICY "company_members_manage_company_customers"
ON company_customers
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_customers" ON customers;
CREATE POLICY "company_members_manage_customers"
ON customers
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE highscores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_highscores" ON highscores;
CREATE POLICY "company_members_manage_highscores"
ON highscores
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE lenders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_lenders" ON lenders;
CREATE POLICY "company_members_manage_lenders"
ON lenders
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_loans" ON loans;
CREATE POLICY "company_members_manage_loans"
ON loans
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_notifications" ON notifications;
CREATE POLICY "company_members_manage_notifications"
ON notifications
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE notification_filters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_notification_filters" ON notification_filters;
CREATE POLICY "company_members_manage_notification_filters"
ON notification_filters
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE prestige_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_prestige_events" ON prestige_events;
CREATE POLICY "company_members_manage_prestige_events"
ON prestige_events
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE relationship_boosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_relationship_boosts" ON relationship_boosts;
CREATE POLICY "company_members_manage_relationship_boosts"
ON relationship_boosts
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_teams" ON teams;
CREATE POLICY "company_members_manage_teams"
ON teams
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE vineyards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_vineyards" ON vineyards;
CREATE POLICY "company_members_manage_vineyards"
ON vineyards
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE wine_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_wine_batches" ON wine_batches;
CREATE POLICY "company_members_manage_wine_batches"
ON wine_batches
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE wine_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_wine_orders" ON wine_orders;
CREATE POLICY "company_members_manage_wine_orders"
ON wine_orders
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_staff" ON staff;
CREATE POLICY "company_members_manage_staff"
ON staff
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE loan_warnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_loan_warnings" ON loan_warnings;
CREATE POLICY "company_members_manage_loan_warnings"
ON loan_warnings
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

ALTER TABLE wine_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_wine_contracts" ON wine_contracts;
CREATE POLICY "company_members_manage_wine_contracts"
ON wine_contracts
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

-- Tables storing company_id as text
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_transactions" ON transactions;
CREATE POLICY "company_members_manage_transactions"
ON transactions
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member_text(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member_text(company_id));

ALTER TABLE wine_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_wine_log" ON wine_log;
CREATE POLICY "company_members_manage_wine_log"
ON wine_log
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member_text(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member_text(company_id));

-- Company shares table (company-scoped)
ALTER TABLE company_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_company_shares" ON company_shares;
CREATE POLICY "company_members_manage_company_shares"
ON company_shares
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

-- Company metrics history table (company-scoped)
ALTER TABLE company_metrics_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_company_metrics_history" ON company_metrics_history;
CREATE POLICY "company_members_manage_company_metrics_history"
ON company_metrics_history
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

-- Board satisfaction history table (company-scoped)
ALTER TABLE board_satisfaction_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_members_manage_board_satisfaction_history" ON board_satisfaction_history;
CREATE POLICY "company_members_manage_board_satisfaction_history"
ON board_satisfaction_history
FOR ALL
USING (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id))
WITH CHECK (public.is_service_role() OR (select auth.uid()) IS NULL OR public.is_company_member(company_id));

-- ============================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_last_played ON companies(last_played DESC);

-- Vineyards indexes
CREATE INDEX IF NOT EXISTS idx_vineyards_company_id ON vineyards(company_id);
CREATE INDEX IF NOT EXISTS idx_vineyards_status ON vineyards(status);

-- Wine batches indexes
CREATE INDEX IF NOT EXISTS idx_wine_batches_company_id ON wine_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_wine_batches_state ON wine_batches(state);

-- Wine orders indexes
CREATE INDEX IF NOT EXISTS idx_wine_orders_company_id ON wine_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_wine_orders_status ON wine_orders(status);

-- Wine contracts indexes
CREATE INDEX IF NOT EXISTS idx_wine_contracts_company_id ON wine_contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_wine_contracts_customer_id ON wine_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_wine_contracts_status ON wine_contracts(status);
CREATE INDEX IF NOT EXISTS idx_wine_contracts_created_date ON wine_contracts(created_year DESC, created_season DESC, created_week DESC);
CREATE INDEX IF NOT EXISTS idx_wine_contracts_company_status ON wine_contracts(company_id, status);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(active_customer);

-- Activities indexes
CREATE INDEX IF NOT EXISTS idx_activities_company_id ON activities(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);

-- Staff indexes
CREATE INDEX IF NOT EXISTS idx_staff_company_id ON staff(company_id);

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_company_id ON teams(company_id);

-- Prestige events indexes
CREATE INDEX IF NOT EXISTS idx_prestige_events_company_id ON prestige_events(company_id);
CREATE INDEX IF NOT EXISTS idx_prestige_events_type ON prestige_events(type);

-- Highscores indexes
CREATE INDEX IF NOT EXISTS idx_highscores_company_id ON highscores(company_id);
CREATE INDEX IF NOT EXISTS idx_highscores_score_type ON highscores(score_type);
CREATE INDEX IF NOT EXISTS idx_highscores_score_value ON highscores(score_value DESC);
-- Partial unique index for aggregate score types (company_value, company_value_per_week)
-- Only one record per company for these aggregate types
CREATE UNIQUE INDEX IF NOT EXISTS highscores_unique_company_aggregate 
    ON highscores(company_id, score_type) 
    WHERE (score_type = ANY (ARRAY['company_value'::text, 'company_value_per_week'::text]));

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp DESC);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

-- Lenders indexes
CREATE INDEX IF NOT EXISTS idx_lenders_company ON lenders(company_id);
CREATE INDEX IF NOT EXISTS idx_lenders_type ON lenders(company_id, type);

-- Loans indexes
CREATE INDEX IF NOT EXISTS idx_loans_company ON loans(company_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(company_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_lender ON loans(lender_id);

-- Loan warnings indexes
CREATE INDEX IF NOT EXISTS idx_loan_warnings_company ON loan_warnings(company_id);
CREATE INDEX IF NOT EXISTS idx_loan_warnings_loan ON loan_warnings(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_warnings_severity ON loan_warnings(severity);

-- Company metrics history indexes
CREATE INDEX IF NOT EXISTS idx_company_metrics_history_company ON company_metrics_history(company_id);
CREATE INDEX IF NOT EXISTS idx_company_metrics_history_date ON company_metrics_history(company_id, snapshot_year DESC, snapshot_season DESC, snapshot_week DESC);

-- ============================================================
-- SCHEMA SYNC COMPLETE
-- ============================================================
-- Your Vercel database schema is now synchronized with dev!
-- Next steps:
-- 1. Verify all tables were created successfully
-- 2. Test your Vercel deployment
-- 3. Use this file for future schema updates
-- ============================================================

