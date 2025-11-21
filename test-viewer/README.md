# Test Viewer - React Component

A React-based test viewer integrated into the Admin Dashboard. Displays test data using actual game components (like Vineyard cards and modals) to visualize test scenarios.

## Usage

### Access via Admin Dashboard

1. Log into the game
2. Navigate to **Admin Dashboard** (from company overview)
3. Click the **Tests** tab

### Features

- **Real Component Rendering**: Test vineyards are displayed using the same React components as the actual game (Vineyard cards, modals)
- **Interactive**: Click on any test vineyard to see detailed information in the Vineyard Modal
- **Compact Display**: Less meta text, more focus on actual test data
- **Run Tests Button**: Click "Run Tests" to see instructions for running tests in terminal

## What You Can See

### Test Vineyards

The viewer displays test vineyards extracted from test files:

- **Base Test Vineyard**: Standard well-maintained vineyard (1 ha, 80% ripeness, 100% health)
- **Optimal 5-hectare Vineyard**: Large-scale vineyard in perfect condition
- **Damaged Vineyard**: Neglected vineyard showing reduced yields (50% health)
- **Unripe Vineyard**: Early harvest scenario (40% ripeness)
- **Young Vineyard**: Newly planted vineyard with young vines (50% vine yield)

Each vineyard card shows:
- Size, density, health, ripeness, vine yield
- Expected yield calculation
- Location and grape variety

Click any vineyard to see full details in the Vineyard Modal (same as in-game).

## Running Tests

The viewer includes a "Run Tests" button. Currently it shows instructions to run tests in terminal:

```bash
npm test          # Single run
npm run test:watch # Watch mode
```

Future enhancement: API endpoint to run tests programmatically and display results in the viewer.

## Files

- `TestViewer.tsx` - Main React component for test viewer
- `TestViewerPage.tsx` - Page wrapper (if needed as standalone page)
- `index.html` / `viewer.js` - Legacy standalone HTML viewer (kept for reference)


