-- ============================================================
-- Fix Vercel Database Issues
-- ============================================================
-- Run this after sync_vercel_schema.sql to fix RLS and constraints
-- Run in: https://supabase.com/dashboard/project/uuzoeoukixvunbnkrowi/editor
-- ============================================================

-- ============================================================
-- FIX 1: Add unique constraint to highscores
-- ============================================================
-- This allows upsert operations on conflict with company_id + score_type

ALTER TABLE highscores 
ADD CONSTRAINT highscores_company_score_type_unique 
UNIQUE (company_id, score_type);

-- ============================================================
-- FIX 2: Disable RLS on staff table (or add permissive policy)
-- ============================================================
-- Option A: Disable RLS entirely (simplest for now)
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;

-- Option B: If you want to keep RLS enabled, create a permissive policy
-- (Comment out the above line and uncomment these if you want RLS)
-- CREATE POLICY "Allow all operations on staff" 
-- ON staff 
-- FOR ALL 
-- TO authenticated, anon
-- USING (true) 
-- WITH CHECK (true);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these to verify the fixes:

-- Check highscores constraint exists
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'highscores'::regclass;

-- Check staff RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'staff';

-- ============================================================
-- COMPLETE!
-- ============================================================

