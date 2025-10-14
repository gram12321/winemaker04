-- ============================================================
-- Winemaker Game - Vercel Database Schema Sync
-- Generated: 2025-10-14
-- ============================================================
-- This migration syncs the Vercel database schema with the current dev database
-- Run this in Vercel Supabase SQL Editor: 
-- https://supabase.com/dashboard/project/uuzoeoukixvunbnkrowi/editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DROP EXISTING TABLES (in reverse dependency order)
-- ============================================================

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
DROP TABLE IF EXISTS wine_batches CASCADE;
DROP TABLE IF EXISTS vineyards CASCADE;

-- ============================================================
-- CREATE TABLES (in dependency order)
-- ============================================================

-- Users table
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text,
    name text NOT NULL,
    avatar text DEFAULT 'default',
    avatar_color text DEFAULT 'blue',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

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
    last_played timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

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
    updated_at timestamptz DEFAULT now()
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
    status text DEFAULT 'Barren' CHECK (status IN ('Barren', 'Planted', 'Growing', 'Harvested', 'Dormant')),
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
    vine_yield numeric DEFAULT 0.02
);

-- Wine batches table
CREATE TABLE wine_batches (
    id text PRIMARY KEY,
    company_id uuid NOT NULL,
    vineyard_id text NOT NULL,
    vineyard_name text NOT NULL,
    grape_variety text NOT NULL,
    quantity integer NOT NULL,
    fermentation_progress integer DEFAULT 0 CHECK (fermentation_progress >= 0 AND fermentation_progress <= 100),
    quality numeric DEFAULT 0.7 CHECK (quality >= 0 AND quality <= 1),
    balance numeric DEFAULT 0.6 CHECK (balance >= 0 AND balance <= 1),
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
    aging_progress integer DEFAULT 0
);

COMMENT ON COLUMN wine_batches.features IS 'JSONB array of wine features and faults (oxidation, green flavor, terroir, etc). Each feature has id, risk, isPresent, severity, name, type, and icon fields.';

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
    calculation_data jsonb
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
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
    relationship numeric DEFAULT 0,
    active_customer boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (company_id, customer_id)
);

-- Prestige events table
CREATE TABLE prestige_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('sale', 'vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land', 'vineyard_region', 'company_value', 'wine_feature', 'cellar_collection', 'achievement')),
    amount_base numeric NOT NULL,
    decay_rate numeric DEFAULT 0,
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
    metadata jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE achievements IS 'Tracks unlocked achievements for each company with prestige integration and progress tracking';
COMMENT ON COLUMN achievements.achievement_key IS 'Identifier matching achievement definition in code';
COMMENT ON COLUMN achievements.progress IS 'Optional progress data for tracking partial completion';
COMMENT ON COLUMN achievements.metadata IS 'Additional data about the achievement unlock (e.g., prestige amount spawned)';

-- Wine log table
CREATE TABLE wine_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id text NOT NULL DEFAULT 'default',
    vineyard_id text NOT NULL,
    vineyard_name text NOT NULL,
    grape_variety text NOT NULL,
    vintage integer NOT NULL,
    quantity integer NOT NULL,
    quality numeric NOT NULL CHECK (quality >= 0 AND quality <= 1),
    balance numeric NOT NULL CHECK (balance >= 0 AND balance <= 1),
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
    category text NOT NULL CHECK (category IN ('PLANTING', 'HARVESTING', 'CRUSHING', 'FERMENTATION', 'CLEARING', 'UPROOTING', 'BUILDING', 'UPGRADING', 'MAINTENANCE', 'STAFF_SEARCH', 'ADMINISTRATION')),
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

-- Enable RLS on staff table
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

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

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp DESC);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

-- ============================================================
-- SCHEMA SYNC COMPLETE
-- ============================================================
-- Your Vercel database schema is now synchronized with dev!
-- Next steps:
-- 1. Verify all tables were created successfully
-- 2. Test your Vercel deployment
-- 3. Use this file for future schema updates
-- ============================================================

