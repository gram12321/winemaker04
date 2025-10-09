# Oxidation and Vineyard Health System Analysis
## Comparison between v1, v3, and current v4

---

## 🔬 OXIDATION SYSTEM

### Current State in V4 ✅ PARTIALLY IMPLEMENTED

**What Exists:**
- ✅ `proneToOxidation` property in `GRAPE_CONST` (src/lib/constants/grapeConstants.ts)
  - Barbera: 0.4
  - Chardonnay: 0.7
  - Pinot Noir: 0.8 (most prone)
  - Primitivo: 0.3
  - Sauvignon Blanc: 0.9 (most prone)
  
- ✅ `proneToOxidation` stored in `WineBatch` interface (src/lib/types/types.ts line 150)
- ✅ Saved to database (`prone_to_oxidation` column in wine_batches table)

**What's Missing:**
- ❌ No oxidation tracking on wine batches (no `oxidation` field)
- ❌ No oxidation calculations during harvest
- ❌ No oxidation progression over time
- ❌ No effect on wine quality/price/characteristics

---

### V1 Implementation (docs/old_iterations/v1)

**File:** `js/utils/oxidationIndex.js`

```javascript
const HARVEST_OXIDATION_RATE = 0.02; // 2% base oxidation per week during harvest

export function applyHarvestOxidation(inventoryItem) {
    // Calculate oxidation increment based on grape's properties
    const oxidationIncrement = HARVEST_OXIDATION_RATE * inventoryItem.resource.proneToOxidation;
    const previousOxidation = inventoryItem.oxidation || 0;
    
    // Apply oxidation
    inventoryItem.oxidation = Math.min(1, previousOxidation + oxidationIncrement);

    // Add console message if significant oxidation occurs
    if (oxidationIncrement > 0.01) {
        addConsoleMessage(`${inventoryItem.resource.name} from ${inventoryItem.fieldName} oxidized by ${(oxidationIncrement * 100).toFixed(1)}%`);
    }
}
```

**Key Features:**
- **Oxidation Rate:** 2% per week base rate
- **Grape Sensitivity:** Multiplied by grape's `proneToOxidation` value
- **Accumulation:** Oxidation adds up week by week (capped at 1.0/100%)
- **Applied During:** Harvest/storage phases
- **User Feedback:** Console messages for significant oxidation (>1%)

**Used in:** `wineprocessing.js` - oxidation was carried through from grapes → must → wine

---

### V3 Implementation (docs/old_iterations/v3)

**File:** `src/lib/game/resource.ts`

```typescript
export interface Resource {
    name: GrapeVariety;
    naturalYield: number;
    fragile: number;
    proneToOxidation: number; // Susceptibility (0-1), higher is more prone
    grapeColor: 'red' | 'white';
    wineCharacteristics: WineCharacteristics;
}
```

**Key Features:**
- `proneToOxidation` defined per grape variety (same values as v4)
- Stored on Resource interface
- **Note:** Not clear from provided files if oxidation was actively tracked during processing in v3

---

## 🌱 VINEYARD HEALTH SYSTEM

### Current State in V4 ✅ PARTIALLY IMPLEMENTED

**What Exists:**
- ✅ `vineyardHealth` property in Vineyard interface (0-1 scale)
- ✅ `DEFAULT_VINEYARD_HEALTH = 1.0` constant (src/lib/constants/vineyardConstants.ts line 273)
- ✅ Stored in database (`vineyard_health` column)
- ✅ **Used in yield calculations** (src/lib/services/vineyard/vineyardManager.ts line 28):
  ```typescript
  const yieldMultiplier = grapeSuitability * naturalYield * 
                          (vineyard.ripeness || 0) * vineYieldFactor * 
                          (vineyard.vineyardHealth || 1.0);
  ```

**What's Missing (Commented Out):**
- ❌ `completedClearingTasks: string[]` - tracks which clearing tasks were done
- ❌ `farmingMethod: FarmingMethod` - 'Conventional' | 'Non-Conventional' | 'Ecological'
- ❌ `organicYears: number` - counter for organic farming progression
- ❌ No clearing activity system
- ❌ No health improvement mechanisms
- ❌ No organic farming progression
- ❌ No way to change health from default 1.0

---

### V1 Implementation (docs/old_iterations/v1)

**File:** `js/farmland.js`

```javascript
class Farmland {
  constructor(/* ... */) {
    // ...
    this.farmlandHealth = 0.5; // Default health is 50%
    this.canBeCleared = 'Ready to be cleared';
    this.conventional = 'Non-Conventional'; // Can be: 'Conventional', 'Non-Conventional', or 'Ecological'
    this.organicYears = 0; // Counter for years using organic methods
  }
}
```

**Health in Yield Calculation:**
```javascript
const qualityMultiplier = (farmland.ripeness + resource.naturalYield + farmland.farmlandHealth) / 3;
let expectedYield = baseYieldPerAcre * farmland.acres * qualityMultiplier * 
                    farmland.annualYieldFactor * densityModifier;

// Conventional farming bonus
if (farmland.conventional === 'Conventional') {
    expectedYield *= 1.1; // 10% yield bonus
}
```

**Clearing System** (`js/overlays/clearingOverlay.js`):

**Health Improvements:**
- Each clearing task: `DEFAULT_FARMLAND_HEALTH / 3` improvement
- Tasks: remove-vines, clear-vegetation, remove-debris, soil-amendment
- Vine replanting intensity slider (0-100%) affects health improvement
- **Soil amendment:** Can switch between 'Synthetic' (Conventional) and 'Organic' (Non-Conventional)

**Key Features:**
- Default health: **0.5** (50%) - needs improvement
- Health affects yield as part of quality multiplier
- Clearing tasks improve health
- Farming method affects yield (Conventional gets 10% bonus)
- UI: `healthBar.js` component shows current → projected health

---

### V3 Implementation (docs/old_iterations/v3)

**File:** `src/lib/game/vineyard.ts`

```typescript
export interface Vineyard {
  // ...
  vineyardHealth: number;
  completedClearingTasks: string[];
  farmingMethod: FarmingMethod;
  organicYears: number;
  // ...
}
```

**Default Values:**
```typescript
vineyardHealth: options.vineyardHealth || DEFAULT_VINEYARD_HEALTH,
completedClearingTasks: options.completedClearingTasks || [],
farmingMethod: initialFarmingMethod || "Non-Conventional",
organicYears: options.organicYears || (initialFarmingMethod === 'Ecological' ? ORGANIC_CERTIFICATION_YEARS : 0),
```

**Health in Yield Calculation:**
```typescript
const qualityMultiplier = (vineyard.ripeness + resource.naturalYield + vineyard.vineyardHealth) / 3;
let expectedYield = BASE_YIELD_PER_ACRE * vineyard.acres * qualityMultiplier * 
                    vineyard.annualYieldFactor * densityModifier;

// Apply bonus multiplier if conventional
if (vineyard.farmingMethod === 'Conventional') {
  expectedYield *= CONVENTIONAL_YIELD_BONUS; // 1.1 = 10% bonus
}
```

**Clearing System** (`src/components/vineyards/ClearingOptionModal.tsx`):

**Health Improvements (lines 122-133):**
```typescript
let healthImprovement = 0;
if (options.tasks['clear-vegetation']) healthImprovement += 0.10;  // +10%
if (options.tasks['remove-debris']) healthImprovement += 0.05;      // +5%
if (options.tasks['soil-amendment']) healthImprovement += 0.15;     // +15%
if (options.tasks['remove-vines']) {
  healthImprovement += (options.replantingIntensity / 100) * 0.20;  // +20% max
}

const newHealth = Math.min(1.0, vineyard.vineyardHealth + healthImprovement);
```

**Completed Tasks Tracking:**
- Tasks marked as completed to prevent repeating
- Tasks disabled in UI if already completed
- Reset annually (from `gameTick.ts` line 197):
  ```typescript
  completedClearingTasks: [], // Reset completed clearing tasks for the new year
  ```

**Organic Farming Progression** (`gameTick.ts` lines 202-217):
```typescript
if (vineyard.farmingMethod === 'Non-Conventional' || vineyard.farmingMethod === 'Ecological') {
  updatedVineyard.organicYears = (vineyard.organicYears || 0) + 1;
  
  // Convert to ecological after required years (ORGANIC_CERTIFICATION_YEARS = 3)
  if (updatedVineyard.farmingMethod === 'Non-Conventional' && 
      updatedVineyard.organicYears >= ORGANIC_CERTIFICATION_YEARS) {
    updatedVineyard.farmingMethod = 'Ecological';
    consoleService.info(`${vineyard.name} is now certified Ecological after ${updatedVineyard.organicYears} years!`);
  }
  
  // Organic farming improves vineyard health
  updatedVineyard.vineyardHealth = Math.min(1.0, vineyard.vineyardHealth + ORGANIC_HEALTH_IMPROVEMENT);
} else {
  // Reset organic years if conventional
  updatedVineyard.organicYears = 0;
}
```

**UI Components:**
- `HealthBar.tsx` - Reusable health bar showing current → projected health
- `ClearingOptionModal.tsx` - Modal for selecting clearing tasks with health impact preview

**Key Features:**
- Default health: **DEFAULT_VINEYARD_HEALTH** (needs to be defined)
- Clearing tasks give specific health bonuses
- Tasks can only be done once per year
- Organic farming: 3 years → 'Ecological' certification
- Organic farming: annual health improvement
- Conventional farming: 10% yield bonus, resets organic progress
- Health affects yield as part of quality multiplier

---

## 📊 IMPLEMENTATION DEPENDENCIES

### Oxidation System
**Dependencies:**
- ✅ `proneToOxidation` grape property (EXISTS in v4)
- ✅ Time system for weekly progression (EXISTS in v4)
- ✅ WineBatch tracking (EXISTS in v4)
- ❌ Need to add `oxidation` field to WineBatch interface
- ❌ Need oxidation progression logic

**Independent?** ✅ **YES** - Can be implemented first without health system

---

### Health System
**Dependencies:**
- ✅ `vineyardHealth` property (EXISTS in v4)
- ✅ Yield calculation integration (EXISTS in v4)
- ✅ Time system for organic progression (EXISTS in v4)
- ❌ Need clearing activity system
- ❌ Need farming method system
- ❌ Need to uncomment/restore commented fields

**Independent?** ⚠️ **PARTIALLY** - Basic structure exists but needs activity system expansion

---

## 🎯 RECOMMENDATION

**Implement OXIDATION first** because:
1. ✅ Fully independent - no dependencies on other systems
2. ✅ Infrastructure already exists (grape properties, wine batches)
3. ✅ Simpler implementation - just add tracking and weekly progression
4. ✅ Provides immediate gameplay value (time pressure on processing)

**Then implement HEALTH** because:
1. Requires more extensive changes (activity system, UI modals)
2. Needs restoration of commented-out fields
3. Builds on activity system that may need expansion
4. More complex with farming method transitions and clearing tasks

---

## 📝 MISSING CONSTANTS FROM V1/V3

### V1 Constants:
```javascript
DEFAULT_FARMLAND_HEALTH // Not defined in provided files, used as divisor by 3
```

### V3 Constants (from gameTick.ts):
```typescript
ORGANIC_CERTIFICATION_YEARS // = 3 years
ORGANIC_HEALTH_IMPROVEMENT // Not shown in provided files, but used
CONVENTIONAL_YIELD_BONUS // = 1.1 (10% bonus)
```

These constants need to be located or defined when implementing the health system.

---

## 🔍 KEY DIFFERENCES BETWEEN V1 AND V3

| Feature | V1 | V3 |
|---------|----|----|
| **Default Health** | 0.5 (50%) | DEFAULT_VINEYARD_HEALTH (likely 1.0) |
| **Health in Yield** | Part of quality multiplier avg | Part of quality multiplier avg |
| **Clearing Tasks** | Generic health improvement | Specific % per task type |
| **Task Tracking** | canBeCleared flag | completedClearingTasks array |
| **Annual Reset** | Not shown | Yes, tasks reset yearly |
| **Organic Progression** | organicYears counter | organicYears + certification |
| **Farming Methods** | 3 types | 3 types (same) |
| **UI Components** | Bootstrap-based | React + TypeScript |

---

## ✅ NEXT STEPS

1. **User Decision:** Confirm oxidation should be implemented first
2. **Oxidation Implementation:**
   - Add `oxidation` field to WineBatch interface
   - Add oxidation constants (harvest rate, storage rate)
   - Implement weekly oxidation progression
   - Add oxidation effects on wine characteristics
   - Add UI indicators for oxidation levels
   
3. **Health Implementation (after oxidation):**
   - Restore commented-out vineyard fields
   - Implement clearing activity system
   - Add farming method transitions
   - Create health improvement mechanics
   - Build UI components (HealthBar, ClearingModal)
   - Add organic certification progression


