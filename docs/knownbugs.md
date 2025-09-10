# Known Bugs

## Finance System - Duplicate Starting Capital Transaction

**Issue**: The `initializeStartingCapital` function creates duplicate "Starting Capital" transactions, showing €20M instead of €10M in finance views.

**Root Cause**: Function may be called multiple times during game initialization without proper duplicate prevention.

**Solution**: Will be fixed when implementing proper player authentication system to ensure single initialization per game.
