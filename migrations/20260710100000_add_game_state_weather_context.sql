alter table public.game_state
  add column if not exists weather_forecast_pattern text,
  add column if not exists weather_forecast_confidence text,
  add column if not exists weather_state text,
  add column if not exists weather_intensity text,
  add column if not exists next_week_forecast_state text,
  add column if not exists next_week_forecast_intensity text;
