# Database Migrations

This folder contains SQL migration files for managing database schema changes.

## Files

### `sync_vercel_schema.sql`
**Purpose**: Sync Vercel database schema with current dev database structure.

**When to use**: 
- After making schema changes in dev database
- To reset Vercel database to match dev
- When setting up Vercel database for the first time

**How to use**:
1. Go to Vercel Supabase SQL Editor: https://supabase.com/dashboard/project/uuzoeoukixvunbnkrowi/editor
2. Copy entire contents of `sync_vercel_schema.sql`
3. Paste in SQL Editor
4. Click **Run**
5. Verify all tables created successfully

**⚠️ WARNING**: This migration **drops all existing tables** and recreates them. All data will be lost!

## Schema Change Workflow

When you make database schema changes:

1. **Update Dev Database**: Make changes in your dev database
2. **Test Locally**: Ensure everything works with `npm run dev`
3. **Generate Migration**: Update `sync_vercel_schema.sql` with new schema
4. **Apply to Vercel**: Run migration in Vercel Supabase
5. **Deploy Code**: Push code changes to GitHub (triggers Vercel deployment)
6. **Test Vercel**: Verify everything works on Vercel deployment

## Database Environments

- **Dev** (localhost): Your local development database
  - URL: `https://uuribntaigecwtkdxeyw.supabase.co`
  - Reset frequently
  - Fast iteration

- **Vercel** (staging): Persistent testing database
  - URL: `https://uuzoeoukixvunbnkrowi.supabase.co`
  - Stable for test users
  - Apply migrations carefully

## Tips

- Always backup Vercel data before running migrations
- Test migrations on dev database first
- Keep migration files in sync with actual schema
- Document significant schema changes in version log

