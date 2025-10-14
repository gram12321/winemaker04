# Database Migrations

## sync_vercel_schema.sql

**Purpose**: Complete schema sync from dev to Vercel database.

**How to regenerate (for AI agents):**
1. Run MCP tool: `mcp_supabase-dev_list_tables` with schemas: ["public"]
2. Generate SQL CREATE statements from table metadata
3. **CRITICAL FIXES** (read file header for full checklist):
   - highscores: Add `UNIQUE (company_id, score_type)`
   - staff: Disable RLS or add policies
4. Overwrite this file
5. Test on Vercel

**How to apply:**
1. Go to: https://supabase.com/dashboard/project/uuzoeoukixvunbnkrowi/editor
2. Copy entire `sync_vercel_schema.sql` contents
3. Run in SQL Editor
4. ⚠️ **WARNING**: Drops all tables! All data will be lost!

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

