# Database Setup Instructions

This document describes the database tables needed for the Winery Management Game.

## Required Tables

### 1. game_states

This table stores the complete game state for each player.

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

## Setup Instructions

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run the SQL commands above to create the required tables
4. Ensure your environment variables are set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Notes

- The game_state column stores the complete GameState object as JSON
- The id field is used as the player identifier (default: 'default')
- Auto-save functionality will persist game state changes automatically
