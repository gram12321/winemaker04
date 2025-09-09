# Manual Database Setup Instructions

Since the MCP server doesn't have the necessary permissions to create tables automatically, you'll need to set up the database manually.

## Step 1: Access Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `winemaker` (project ID: `uuribntaigecwtkdxeyw`)
3. Navigate to the **SQL Editor** in the left sidebar

## Step 2: Create the Table

Copy and paste the following SQL into the SQL Editor and run it:

```sql
-- Create game_states table for storing player game data
CREATE TABLE IF NOT EXISTS game_states (
  id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  game_state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on player_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_game_states_player_name ON game_states(player_name);

-- Create an index on updated_at for sorting
CREATE INDEX IF NOT EXISTS idx_game_states_updated_at ON game_states(updated_at);
```

## Step 3: Verify the Table

After running the SQL, you can verify the table was created by:

1. Going to **Table Editor** in the left sidebar
2. You should see the `game_states` table listed
3. The table should have the following columns:
   - `id` (text, primary key)
   - `player_name` (text, not null)
   - `game_state` (jsonb, not null)
   - `created_at` (timestamptz, default now())
   - `updated_at` (timestamptz, default now())

## Step 4: Test the Connection

Once the table is created, the game should automatically be able to save and load game state. The auto-save functionality will work when you:

1. Start the development server (`npm run dev`)
2. Navigate through the game
3. Use the "Increment Week" button
4. The game state should be automatically saved to the database

## Troubleshooting

If you encounter any issues:

1. **Check environment variables**: Make sure your `.env` file contains:
   ```
   VITE_SUPABASE_URL=https://uuribntaigecwtkdxeyw.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cmlibnRhaWdlY3d0a2R4ZXl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MDgwMzMsImV4cCI6MjA3Mjk4NDAzM30.5ED7ygE78Bj1bRA4rzIoOtYexb7ywVQfuvPryfwAlVw
   ```

2. **Check RLS policies**: The table should be accessible with the anon key. If not, you may need to create RLS policies.

3. **Check console**: Open browser developer tools to see any error messages when the game tries to save/load data.
