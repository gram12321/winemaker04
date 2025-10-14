-- =====================================================
-- WINEMAKER DATABASE SCHEMA SNAPSHOT
-- Generated from dev database: uuribntaigecwtkdxeyw
-- Target: Vercel database (uuzoeoukixvunbnkrowi)
-- 
-- This file contains the complete schema structure.
-- Run this in the Vercel Supabase SQL Editor to sync schema.
-- =====================================================

-- Drop all tables (in reverse dependency order)
DROP TABLE IF EXISTS wine_orders CASCADE;
DROP TABLE IF EXISTS wine_log CASCADE;
DROP TABLE IF EXISTS wine_batches CASCADE;
DROP TABLE IF EXISTS vineyards CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS relationship_boosts CASCADE;
DROP TABLE IF EXISTS prestige_events CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_filters CASCADE;
DROP TABLE IF EXISTS highscores CASCADE;
DROP TABLE IF EXISTS company_customers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- CREATE TABLES
-- =====================================================

-- Table: users
CREATE TABLE users (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email TEXT,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT 'default'::text,
  avatar_color TEXT DEFAULT 'blue'::text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Table: companies
CREATE TABLE companies (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID,
  founded_year INTEGER DEFAULT 2024,
  current_week INTEGER DEFAULT 1,
  current_season TEXT DEFAULT 'Spring'::text,
  current_year INTEGER DEFAULT 2024,
  money NUMERIC(15,2) DEFAULT 0,
  prestige NUMERIC(10,2) DEFAULT 0,
  last_played TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT companies_pkey PRIMARY KEY (id),
  CONSTRAINT companies_name_key UNIQUE (name),
  CONSTRAINT companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table: achievements
CREATE TABLE achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  company_id UUID,
  achievement_key TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  description TEXT,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  unlocked_game_week INTEGER,
  unlocked_game_season VARCHAR(20),
  unlocked_game_year INTEGER,
  progress JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT achievements_pkey PRIMARY KEY (id),
  CONSTRAINT achievements_company_id_achievement_key_key UNIQUE (company_id, achievement_key),
  CONSTRAINT achievements_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Table: activities
CREATE TABLE activities (
  id TEXT NOT NULL,
  company_id UUID NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  target_id TEXT,
  params JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'::text,
  game_week INTEGER NOT NULL,
  game_season TEXT NOT NULL,
  game_year INTEGER NOT NULL,
  is_cancellable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT activities_pkey PRIMARY KEY (id),
  CONSTRAINT activities_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT activities_category_check CHECK (category = ANY (ARRAY['PLANTING'::text, 'HARVESTING'::text, 'CRUSHING'::text, 'FERMENTATION'::text, 'BOTTLING'::text, 'AGING'::text, 'SALES'::text, 'RESEARCH'::text, 'MAINTENANCE'::text, 'BUILDING'::text, 'HIRING'::text, 'BOOKKEEPING'::text, 'UPROOTING'::text, 'CLEARING'::text, 'PRESSING'::text, 'ENGROSSORDER'::text, 'PRIVATEORDER'::text, 'ADMINISTRATION'::text])),
  CONSTRAINT activities_game_season_check CHECK (game_season = ANY (ARRAY['Spring'::text, 'Summer'::text, 'Fall'::text, 'Winter'::text])),
  CONSTRAINT activities_status_check CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text]))
);

-- Table: customers
CREATE TABLE customers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  customer_type TEXT NOT NULL,
  market_share DOUBLE PRECISION NOT NULL,
  purchasing_power DOUBLE PRECISION NOT NULL,
  wine_tradition DOUBLE PRECISION NOT NULL,
  price_multiplier DOUBLE PRECISION NOT NULL,
  relationship DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  active_customer BOOLEAN DEFAULT false,
  company_id UUID NOT NULL,
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);

-- Table: company_customers
CREATE TABLE company_customers (
  company_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  relationship NUMERIC(10,2) NOT NULL DEFAULT 0,
  active_customer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT company_customers_pkey PRIMARY KEY (company_id, customer_id),
  CONSTRAINT company_customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION,
  CONSTRAINT company_customers_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE NO ACTION
);

-- Table: highscores
CREATE TABLE highscores (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  company_id UUID,
  company_name TEXT NOT NULL,
  score_type TEXT NOT NULL,
  game_week INTEGER,
  game_season TEXT,
  game_year INTEGER,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  vineyard_id TEXT,
  vineyard_name TEXT,
  wine_vintage INTEGER,
  grape_variety TEXT,
  CONSTRAINT highscores_pkey PRIMARY KEY (id),
  CONSTRAINT highscores_company_id_score_type_key UNIQUE (company_id, score_type),
  CONSTRAINT highscores_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Table: notification_filters
CREATE TABLE notification_filters (
  id TEXT NOT NULL,
  company_id UUID NOT NULL,
  filter_type TEXT NOT NULL,
  filter_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  block_from_history BOOLEAN DEFAULT false,
  CONSTRAINT notification_filters_pkey PRIMARY KEY (id),
  CONSTRAINT notification_filters_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT notification_filters_filter_type_check CHECK (filter_type = ANY (ARRAY['category'::text, 'origin'::text, 'keyword'::text]))
);

-- Table: notifications
CREATE TABLE notifications (
  id TEXT NOT NULL,
  company_id UUID NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  game_week INTEGER,
  game_season TEXT,
  game_year INTEGER,
  origin TEXT,
  userfriendlyorigin TEXT,
  category TEXT,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Table: prestige_events
CREATE TABLE prestige_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  source_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  company_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  created_game_week INTEGER,
  calc_text TEXT,
  display_info TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT prestige_events_pkey PRIMARY KEY (id),
  CONSTRAINT prestige_events_type_check CHECK (type = ANY (ARRAY['wine_quality'::text, 'wine_sale'::text, 'achievement'::text, 'vineyard_excellence'::text, 'customer_relationship'::text]))
);

-- Table: relationship_boosts
CREATE TABLE relationship_boosts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  timestamp BIGINT,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  company_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  created_game_week INTEGER,
  CONSTRAINT relationship_boosts_pkey PRIMARY KEY (id)
);

-- Table: staff
CREATE TABLE staff (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  nationality TEXT NOT NULL,
  skill_level NUMERIC(3,2) NOT NULL,
  specializations TEXT[] DEFAULT '{}'::text[],
  wage INTEGER NOT NULL,
  skill_field NUMERIC(3,2) NOT NULL,
  skill_winery NUMERIC(3,2) NOT NULL,
  skill_administration NUMERIC(3,2) NOT NULL,
  skill_sales NUMERIC(3,2) NOT NULL,
  skill_maintenance NUMERIC(3,2) NOT NULL,
  workforce INTEGER DEFAULT 50,
  hire_date_week INTEGER NOT NULL,
  hire_date_season TEXT NOT NULL,
  hire_date_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  team_ids JSONB DEFAULT '[]'::jsonb,
  CONSTRAINT staff_pkey PRIMARY KEY (id),
  CONSTRAINT staff_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT staff_hire_date_week_check CHECK ((hire_date_week >= 1) AND (hire_date_week <= 4)),
  CONSTRAINT staff_skill_administration_check CHECK ((skill_administration >= (0)::numeric) AND (skill_administration <= (1)::numeric)),
  CONSTRAINT staff_skill_field_check CHECK ((skill_field >= (0)::numeric) AND (skill_field <= (1)::numeric)),
  CONSTRAINT staff_skill_level_check CHECK ((skill_level >= (0)::numeric) AND (skill_level <= (1)::numeric)),
  CONSTRAINT staff_skill_maintenance_check CHECK ((skill_maintenance >= (0)::numeric) AND (skill_maintenance <= (1)::numeric)),
  CONSTRAINT staff_skill_sales_check CHECK ((skill_sales >= (0)::numeric) AND (skill_sales <= (1)::numeric)),
  CONSTRAINT staff_skill_winery_check CHECK ((skill_winery >= (0)::numeric) AND (skill_winery <= (1)::numeric)),
  CONSTRAINT staff_wage_check CHECK (wage >= 0),
  CONSTRAINT staff_workforce_check CHECK ((workforce >= 0) AND (workforce <= 100))
);

-- Table: teams
CREATE TABLE teams (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT ''::text,
  icon TEXT DEFAULT '👥'::text,
  default_task_types TEXT[] DEFAULT '{}'::text[],
  member_ids TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Table: transactions
CREATE TABLE transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL DEFAULT 'default'::text,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  recurring BOOLEAN DEFAULT false,
  week INTEGER DEFAULT 1,
  season TEXT DEFAULT 'Spring'::text,
  year INTEGER DEFAULT 2024,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_season_check CHECK (season = ANY (ARRAY['Spring'::text, 'Summer'::text, 'Fall'::text, 'Winter'::text]))
);

-- Table: user_settings
CREATE TABLE user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID,
  company_id UUID,
  show_toast_notifications BOOLEAN DEFAULT true,
  allow_resource_substitution BOOLEAN DEFAULT true,
  show_detailed_input_section BOOLEAN DEFAULT true,
  notification_categories JSONB DEFAULT '{}'::jsonb,
  notification_specific_messages JSONB DEFAULT '{}'::jsonb,
  view_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT user_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_settings_user_id_company_id_key UNIQUE (user_id, company_id),
  CONSTRAINT user_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table: vineyards
CREATE TABLE vineyards (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  country TEXT DEFAULT 'France'::text,
  region TEXT DEFAULT 'Bordeaux'::text,
  acres INTEGER DEFAULT 1,
  grape_variety TEXT,
  is_planted BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Barren'::text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_week INTEGER DEFAULT 1,
  created_season TEXT DEFAULT 'Spring'::text,
  created_year INTEGER DEFAULT 2024,
  vine_age INTEGER DEFAULT 0,
  soil JSONB DEFAULT '["Clay"]'::jsonb,
  altitude INTEGER DEFAULT 200,
  aspect TEXT DEFAULT 'South'::text,
  density INTEGER DEFAULT 0,
  vineyard_health NUMERIC(3,2) DEFAULT 1.0,
  ripeness NUMERIC(3,2) DEFAULT 0.0,
  vine_yield NUMERIC(5,3) DEFAULT 0.02,
  CONSTRAINT vineyards_pkey PRIMARY KEY (id),
  CONSTRAINT vineyards_status_check CHECK (status = ANY (ARRAY['Barren'::text, 'Planted'::text, 'Cleared'::text]))
);

-- Table: wine_batches
CREATE TABLE wine_batches (
  id TEXT NOT NULL,
  company_id UUID NOT NULL,
  vineyard_id TEXT NOT NULL,
  vineyard_name TEXT NOT NULL,
  grape_variety TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  fermentation_progress INTEGER DEFAULT 0,
  quality NUMERIC(3,2) DEFAULT 0.7,
  balance NUMERIC(3,2) DEFAULT 0.6,
  asking_price NUMERIC(10,2),
  characteristics JSONB DEFAULT '{"body": 0.5, "aroma": 0.5, "spice": 0.5, "acidity": 0.5, "tannins": 0.5, "sweetness": 0.5}'::jsonb,
  breakdown JSONB DEFAULT '{}'::jsonb,
  state TEXT NOT NULL DEFAULT 'grapes'::text,
  fermentation_options JSONB,
  grape_color TEXT DEFAULT 'red'::text,
  harvest_start_week INTEGER NOT NULL,
  harvest_start_season TEXT NOT NULL,
  harvest_start_year INTEGER NOT NULL,
  harvest_end_week INTEGER NOT NULL,
  harvest_end_season TEXT NOT NULL,
  harvest_end_year INTEGER NOT NULL,
  bottled_week INTEGER,
  bottled_season TEXT,
  bottled_year INTEGER,
  features JSONB DEFAULT '[]'::jsonb,
  aging_progress INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT wine_batches_pkey PRIMARY KEY (id),
  CONSTRAINT check_balance_range CHECK ((balance >= (0)::numeric) AND (balance <= (1)::numeric)),
  CONSTRAINT check_quality_range CHECK ((quality >= (0)::numeric) AND (quality <= (1)::numeric)),
  CONSTRAINT wine_batches_fermentation_progress_check CHECK ((fermentation_progress >= 0) AND (fermentation_progress <= 100)),
  CONSTRAINT wine_batches_grape_color_check CHECK (grape_color = ANY (ARRAY['red'::text, 'white'::text, 'rosé'::text])),
  CONSTRAINT wine_batches_state_check CHECK (state = ANY (ARRAY['grapes'::text, 'crushed'::text, 'fermenting'::text, 'aging'::text, 'wine'::text]))
);

-- Table: wine_log
CREATE TABLE wine_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL DEFAULT 'default'::text,
  vineyard_id TEXT NOT NULL,
  vineyard_name TEXT NOT NULL,
  grape_variety TEXT NOT NULL,
  vintage INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  characteristics JSONB NOT NULL DEFAULT '{"body": 0.5, "aroma": 0.5, "spice": 0.5, "acidity": 0.5, "tannins": 0.5, "sweetness": 0.5}'::jsonb,
  harvest_week INTEGER NOT NULL,
  harvest_season TEXT NOT NULL,
  harvest_year INTEGER NOT NULL,
  bottled_week INTEGER NOT NULL,
  bottled_season TEXT NOT NULL,
  bottled_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT wine_log_pkey PRIMARY KEY (id),
  CONSTRAINT wine_log_bottled_season_check CHECK (bottled_season = ANY (ARRAY['Spring'::text, 'Summer'::text, 'Fall'::text, 'Winter'::text])),
  CONSTRAINT wine_log_harvest_season_check CHECK (harvest_season = ANY (ARRAY['Spring'::text, 'Summer'::text, 'Fall'::text, 'Winter'::text]))
);

-- Table: wine_orders
CREATE TABLE wine_orders (
  id TEXT NOT NULL,
  company_id UUID NOT NULL,
  wine_batch_id TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  order_type TEXT NOT NULL,
  requested_quantity INTEGER NOT NULL,
  offered_price NUMERIC(10,2) NOT NULL,
  total_value NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'::text,
  ordered_week INTEGER NOT NULL,
  ordered_season TEXT NOT NULL,
  ordered_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  fulfillable_quantity INTEGER,
  fulfillable_value NUMERIC(10,2),
  customer_id TEXT,
  customer_name TEXT,
  customer_country TEXT,
  calculation_data JSONB,
  CONSTRAINT wine_orders_pkey PRIMARY KEY (id)
);

-- =====================================================
-- CREATE INDEXES
-- =====================================================

-- Achievements indexes
CREATE INDEX idx_achievements_company_id ON achievements(company_id);
CREATE INDEX idx_achievements_game_date ON achievements(unlocked_game_year DESC, unlocked_game_season, unlocked_game_week DESC);

-- Activities indexes
CREATE INDEX idx_activities_category ON activities(category);
CREATE INDEX idx_activities_company_id ON activities(company_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_target_id ON activities(target_id);

-- Companies indexes
CREATE INDEX idx_companies_last_played ON companies(last_played DESC);
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_user_id ON companies(user_id);

-- Customers indexes
CREATE INDEX idx_customers_company_id ON customers(company_id);

-- Highscores indexes
CREATE INDEX idx_highscores_company_id ON highscores(company_id);
CREATE INDEX idx_highscores_score_type ON highscores(score_type);

-- Notification filters indexes
CREATE INDEX idx_notification_filters_company ON notification_filters(company_id);
CREATE INDEX idx_notification_filters_type ON notification_filters(company_id, filter_type);

-- Notifications indexes
CREATE INDEX idx_notifications_category ON notifications(company_id, category);
CREATE INDEX idx_notifications_company_id ON notifications(company_id);
CREATE INDEX idx_notifications_game_time ON notifications(company_id, game_year DESC, game_season DESC, game_week DESC);
CREATE INDEX idx_notifications_origin ON notifications(company_id, origin);
CREATE INDEX idx_notifications_timestamp ON notifications(timestamp DESC);

-- Prestige events indexes
CREATE INDEX idx_prestige_events_company_id ON prestige_events(company_id);
CREATE INDEX idx_prestige_events_type ON prestige_events(type);

-- Relationship boosts indexes
CREATE INDEX idx_relationship_boosts_company_id ON relationship_boosts(company_id);
CREATE INDEX idx_relationship_boosts_customer ON relationship_boosts(customer_id);
CREATE INDEX idx_relationship_boosts_timestamp ON relationship_boosts(timestamp DESC);

-- Staff indexes
CREATE INDEX idx_staff_company ON staff(company_id);
CREATE INDEX idx_staff_team_ids ON staff USING gin(team_ids);

-- Teams indexes
CREATE INDEX idx_teams_company_id ON teams(company_id);
CREATE INDEX idx_teams_member_ids_gin ON teams USING gin(member_ids);

-- User settings indexes
CREATE INDEX idx_user_settings_company_id ON user_settings(company_id);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Vineyards indexes
CREATE INDEX idx_vineyards_player_id ON vineyards(company_id);
CREATE INDEX idx_vineyards_status ON vineyards(status);

-- Wine batches indexes
CREATE INDEX idx_wine_batches_features ON wine_batches USING gin(features);
CREATE INDEX idx_wine_batches_player_id ON wine_batches(company_id);
CREATE INDEX idx_wine_batches_vineyard_id ON wine_batches(vineyard_id);

-- Wine orders indexes
CREATE INDEX idx_wine_orders_batch_id ON wine_orders(wine_batch_id);
CREATE INDEX idx_wine_orders_player_id ON wine_orders(company_id);
CREATE INDEX idx_wine_orders_status ON wine_orders(company_id, status);

-- =====================================================
-- SCHEMA SYNC COMPLETE
-- =====================================================

