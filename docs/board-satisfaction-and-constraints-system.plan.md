<!-- 99bc5f80-f74e-41e3-a7ef-9d4a837c25d7 e091e50e-d1e3-4560-9f03-455a288d52d0 -->
# Board Satisfaction and Constraints System

## Overview

Create a Board Satisfaction system that limits player autonomy when the company has outside shareholders. Satisfaction is calculated from financial performance and shareholder breakdown, then used to enforce scaling constraints on various actions. Includes design for future Board Room pressure interactions.

## Phase 1: BoardSatisfaction Calculation Service

### 1.1 Create BoardSatisfaction Service

**File**: `src/lib/services/board/boardSatisfactionService.ts`

**Core Calculation**:

- Reuse existing share price metric calculations from `sharePriceService.ts` and `shareMetricsService.ts`
- Calculate satisfaction from:
  - **Performance Score (40%)**: Average of normalized metric deltas (EPS, revenue/share, profit margin, etc.) vs expected values
  - **Stability Score (25%)**: Cash ratio, debt ratio, fixed asset ratio (normalized to 0-1)
  - **Consistency Score (20%)**: Inverse volatility of metrics over last 48 weeks
  - **Ownership Pressure (15%)**: `(1 - playerOwnershipPct / 100)` - higher outside ownership = more scrutiny

**Formula**:

```typescript
BoardSatisfaction = 
  (performanceScore × 0.40) +
  (stabilityScore × 0.25) +
  (consistencyScore × 0.20) +
  (ownershipPressureFactor × 0.15)

// If 100% player-owned: satisfaction = 1.0 (no constraints)
```

**Key Functions**:

- `calculateBoardSatisfaction(companyId?)` - Main calculation function
- `getBoardSatisfactionBreakdown(companyId?)` - Return detailed breakdown for UI
- Reuse existing functions:
  - `getShareMetrics()` for performance data
  - `calculateMetricDeltas()` from share price adjustment helpers
  - `getShareholderBreakdown()` for ownership data

### 1.2 Constants Configuration

**File**: `src/lib/constants/boardConstants.ts`

Define:

- Weighting factors for satisfaction components
- Default satisfaction values (e.g., new companies, 100% player-owned)

## Phase 2: Board Constraint Configuration

### 2.1 Constraint Type Definitions

**File**: `src/lib/constants/boardConstants.ts`

**Constraint Types**:

```typescript
export type BoardConstraintType =
  | 'share_issuance'
  | 'share_buyback'
  | 'dividend_change'
  | 'vineyard_purchase'
  | 'staff_hiring'
  | 'major_expenditure'; // Future: large purchases
```

### 2.2 Constraint Configuration

**File**: `src/lib/constants/boardConstants.ts`

**Constraint Definitions**:

```typescript
export interface BoardConstraint {
  type: BoardConstraintType;
  startThreshold: number;      // Satisfaction level where constraints start (e.g., 0.8)
  maxThreshold: number;         // Satisfaction level where action is forbidden (e.g., 0.2)
  scalingFormula: (satisfaction: number, value: any) => number; // Dynamic limit calculation
  message: string;              // Error message when blocked
}

export const BOARD_CONSTRAINTS: Record<BoardConstraintType, BoardConstraint> = {
  vineyard_purchase: {
    type: 'vineyard_purchase',
    startThreshold: 0.8,
    maxThreshold: 0.2,
    scalingFormula: (satisfaction, totalBalance) => {
      // Limit = X * (1 - BoardSatisfaction) % of balance
      const allowedPercent = 1 - satisfaction;
      return totalBalance * allowedPercent;
    },
    message: 'Board approval required for vineyard purchases'
  },
  // ... more constraints
};
```

**Scaling Formula Examples**:

- **Vineyard Purchase**: `balance * (1 - satisfaction)` - percentage of balance allowed
- **Share Issuance**: Threshold check only (allowed if satisfaction > threshold)
- **Dividend Change**: Threshold check (prevent cuts if satisfaction < threshold)

## Phase 3: Board Enforcer Service

### 3.1 Create BoardEnforcer

**File**: `src/lib/services/board/boardEnforcer.ts`

**Pattern**: Mirror `researchEnforcer.ts` structure (singleton service)

**Core Functions**:

- `isActionAllowed(constraintType, value?, companyId?)` - Check if action is permitted
- `getActionLimit(constraintType, value, companyId?)` - Get maximum allowed value for scaling constraints
- `getBoardSatisfaction(companyId?)` - Get current satisfaction score

**Logic**:

```typescript
async isActionAllowed(type, value, companyId) {
  // 1. Get player ownership - if 100%, always allow
  const breakdown = await getShareholderBreakdown(companyId);
  if (breakdown.playerPct >= 100) return { allowed: true };
  
  // 2. Calculate BoardSatisfaction
  const satisfaction = await calculateBoardSatisfaction(companyId);
  
  // 3. Get constraint config
  const constraint = BOARD_CONSTRAINTS[type];
  
  // 4. Check threshold
  if (satisfaction <= constraint.maxThreshold) {
    return { allowed: false, satisfaction, message: constraint.message };
  }
  
  // 5. For scaling constraints, check limit
  if (constraint.scalingFormula) {
    const limit = constraint.scalingFormula(satisfaction, value);
    return { allowed: value <= limit, satisfaction, limit };
  }
  
  // 6. For threshold-only constraints
  return { 
    allowed: satisfaction > constraint.startThreshold, 
    satisfaction 
  };
}
```

### 3.2 Helper Functions

- `calculatePerformanceScore()` - Aggregate metric deltas
- `calculateStabilityScore()` - Financial stability metrics
- `calculateConsistencyScore()` - Volatility calculation from historical snapshots

## Phase 4: Integration Points

### 4.1 Share Operations Integration

**Files**:

- `src/lib/services/finance/shares/shareOperationsService.ts`

**Changes**:

- Add board check at start of `issueStock()` - check satisfaction threshold
- Add board check in `buyBackStock()` - check satisfaction threshold  
- Add board check in `updateDividendRate()` - prevent cuts if satisfaction too low

**Pattern**:

```typescript
// At start of function, before validation
const boardCheck = await boardEnforcer.isActionAllowed('share_issuance', shares, companyId);
if (!boardCheck.allowed) {
  return { success: false, error: boardCheck.message };
}
```

### 4.2 Vineyard Purchase Integration

**File**: `src/lib/services/vineyard/vineyardService.ts`

**Changes**:

- In `purchaseVineyard()`, check board limit on purchase price
- Get maximum allowed purchase amount based on satisfaction
- Block purchase if price exceeds limit

**Pattern**:

```typescript
// Get current balance
const financialData = await calculateFinancialData('year');
const totalBalance = financialData.cashMoney;

// Get board limit
const boardCheck = await boardEnforcer.isActionAllowed('vineyard_purchase', totalBalance, companyId);
if (!boardCheck.allowed) {
  return { success: false, error: boardCheck.message };
}

// Check if purchase price is within limit
if (option.totalPrice > boardCheck.limit) {
  return { 
    success: false, 
    error: `Purchase exceeds board-approved limit of ${formatNumber(boardCheck.limit, { currency: true })}` 
  };
}
```

### 4.3 Staff Hiring Integration

**File**: `src/lib/services/activity/activitymanagers/staffSearchManager.ts`

**Changes**:

- Check board constraint in `startHiringProcess()` or before creating hiring activity
- May need max staff count constraint (design TBD)

## Phase 5: Database Persistence

### 5.1 Create Board Satisfaction History Table

**Migration File**: `migrations/add_board_satisfaction_history.sql`

**Table Schema**: `board_satisfaction_history`

```sql
CREATE TABLE board_satisfaction_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  snapshot_week integer NOT NULL,
  snapshot_season text NOT NULL CHECK (snapshot_season IN ('Spring', 'Summer', 'Fall', 'Winter')),
  snapshot_year integer NOT NULL,
  satisfaction_score numeric NOT NULL CHECK (satisfaction_score >= 0 AND satisfaction_score <= 1),
  performance_score numeric NOT NULL,
  stability_score numeric NOT NULL,
  consistency_score numeric NOT NULL,
  ownership_pressure numeric NOT NULL,
  player_ownership_pct numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
```

### 5.2 Create Database Operations

**File**: `src/lib/database/core/boardSatisfactionHistoryDB.ts`

**Functions**:

- `insertBoardSatisfactionSnapshot(data)` - Store weekly satisfaction snapshot
- `getBoardSatisfactionHistory(companyId, weeksBack?)` - Get historical snapshots
- `getBoardSatisfactionSnapshotNWeeksAgo(weeksAgo, companyId)` - Get specific snapshot for consistency calculations
- Reuse pattern from `companyMetricsHistoryDB.ts`

### 5.3 Update Board Satisfaction Service

**File**: `src/lib/services/board/boardSatisfactionService.ts`

**Changes**:

- After calculating satisfaction, automatically store snapshot (weekly)
- Use historical snapshots for consistency score calculation
- Integrate with game tick system (store on weekly update)

### 5.4 Integration with Game Tick

**File**: `src/lib/services/core/gameTick.ts`

**Changes**:

- Add board satisfaction snapshot storage during weekly processing
- Store alongside existing share price adjustments

## Phase 6: Board Room UI Display

### 6.1 Create Board Room Page Component

**File**: `src/components/pages/BoardRoom.tsx`

**Display Elements**:

- **Board Satisfaction Gauge**: Circular or linear gauge showing 0-100% satisfaction
- **Satisfaction Breakdown Card**: Shows detailed scores (performance, stability, consistency, ownership) with percentages
- **Active Constraints Panel**: List of all constraints with:
  - Current limit (if scaling constraint)
  - Threshold status (if threshold constraint)
  - Constraint type description
- **Historical Trend Chart**: Line chart showing satisfaction over time (similar to share price historical chart)
- **Shareholder Breakdown**: Display current ownership percentages

**Layout**:

- Similar structure to ShareManagementPanel.tsx
- Use SimpleCard components from UI library
- Use recharts for historical trend visualization

### 6.2 Add Board Room Navigation

**Files**:

- `src/components/layout/Header.tsx` or navigation component
- Add "Board Room" link/page in Finance section or main navigation

### 6.3 Create Board Room Utilities

**File**: `src/lib/services/board/boardRoomHelpers.ts`

**Helper Functions**:

- `formatSatisfactionBreakdown()` - Format satisfaction data for UI display
- `getActiveConstraints()` - Get list of constraints that are currently active
- `getConstraintStatus()` - Get current status of a specific constraint (allowed/blocked/limited)

### 6.4 Board Room Pressure System Design (Future)

**Concept** (not implemented in this phase):

- Player accumulates "Board Influence Power" over time
- Power generation: base rate + modifiers (prestige, achievements, events)
- Players can spend power to:
  - Request constraint relaxation (e.g., "Ease vineyard purchase restrictions")
  - Request temporary approval for blocked actions
- Power persists over time, similar to old `pressureService.ts`
- Future database table: `board_influence_power` tracking power accumulation and usage
- Placeholder UI components in BoardRoom.tsx (commented out or disabled)

## Implementation Order

1. **Phase 1**: Create BoardSatisfaction calculation service (reuses share metrics)
2. **Phase 2**: Define constraint types and configurations
3. **Phase 3**: Create BoardEnforcer service (deterministic blocking)
4. **Phase 4**: Integrate constraints into existing actions (share operations, vineyard purchase)
5. **Phase 5**: Database persistence (create table, snapshot storage, game tick integration)
6. **Phase 6**: Board Room UI Display (page component, navigation, historical charts)

## Key Design Decisions

- **100% Player Ownership**: Always bypass constraints (satisfaction = 1.0)
- **Deterministic Enforcement**: No warnings, hard blocks like researchEnforcer
- **Scaling Constraints**: Dynamic limits based on satisfaction (not binary allow/deny)
- **Reuse Existing Systems**: Leverage share price metrics, shareholder breakdown, historical snapshots
- **Minimal Implementation**: Start with 3-4 constraint types, expand later
- **Pressure System**: Design only, implementation deferred to future phase

## Files to Create

- `src/lib/services/board/boardSatisfactionService.ts`
- `src/lib/services/board/boardEnforcer.ts`
- `src/lib/constants/boardConstants.ts`

## Files to Modify

- `src/lib/services/finance/shares/shareOperationsService.ts` (add board checks)
- `src/lib/services/vineyard/vineyardService.ts` (add board check in purchaseVineyard)
- `src/lib/services/index.ts` (export board services)