# Oxidation System - Detailed Implementation Summary (V1 & V3)

## 📊 EXECUTIVE SUMMARY

The oxidation system in v1 was a **time-based degradation mechanic** that added gameplay depth by creating urgency in the wine production pipeline. It tracked how grapes and wine deteriorated due to oxygen exposure during harvest and storage.

---

## 🔬 HOW IT WORKED IN V1

### **1. The Core Mechanism**

**Oxidation was tracked on a 0-1 scale (0% to 100%)**
- **0.0** = Perfect, no oxidation (fresh grapes)
- **1.0** = Maximum oxidation (fully degraded)

---

### **2. When Oxidation Occurred**

#### **WEEKLY DURING HARVEST** ⏱️

**File:** `js/utils/oxidationIndex.js`
**Function:** `applyHarvestOxidation(inventoryItem)`

```javascript
const HARVEST_OXIDATION_RATE = 0.02; // 2% base oxidation per week

export function applyHarvestOxidation(inventoryItem) {
    // Calculate oxidation increment based on grape's properties
    const oxidationIncrement = HARVEST_OXIDATION_RATE * inventoryItem.resource.proneToOxidation;
    const previousOxidation = inventoryItem.oxidation || 0;
    
    // Apply oxidation
    inventoryItem.oxidation = Math.min(1, previousOxidation + oxidationIncrement);
    
    // User feedback for significant oxidation
    if (oxidationIncrement > 0.01) {
        addConsoleMessage(`${inventoryItem.resource.name} from ${inventoryItem.fieldName} oxidized by ${(oxidationIncrement * 100).toFixed(1)}%`);
    }
}
```

**Key Formula:**
```
Weekly Oxidation = 0.02 × proneToOxidation

Examples per week:
- Primitivo (0.3):        0.6% oxidation/week
- Barbera (0.4):          0.8% oxidation/week  
- Chardonnay (0.7):       1.4% oxidation/week
- Pinot Noir (0.8):       1.6% oxidation/week
- Sauvignon Blanc (0.9):  1.8% oxidation/week
```

**When Applied:**
- ✅ **Every week** for grapes sitting in storage during harvest
- ✅ Applied in `harvestOverlay.js` after harvest completion (lines 343, 389)
- ✅ Accumulative - oxidation builds up week after week

---

### **3. Grape-Specific Sensitivity**

**File:** `js/resource.js`

Each grape variety had a `proneToOxidation` value (0-1 scale):

```javascript
export const allResources = [
  new Resource('Barbera', 1, 1, 0.4, 'red'),           // Moderately resistant
  new Resource('Chardonnay', 0.9, 1, 0.7, 'white'),    // Highly prone
  new Resource('Pinot Noir', 0.7, 0.4, 0.8, 'red'),    // Very prone
  new Resource('Primitivo', 0.85, 0.8, 0.3, 'red'),    // More resistant
  new Resource('Sauvignon Blanc', 0.95, 0.9, 0.9, 'white') // Extremely prone
];
```

**Ranking (Most to Least Resistant):**
1. Primitivo: 0.3 (30% - most resistant)
2. Barbera: 0.4 (40%)
3. Chardonnay: 0.7 (70%)
4. Pinot Noir: 0.8 (80%)
5. Sauvignon Blanc: 0.9 (90% - most prone)

---

### **4. Oxidation Flow Through Production**

#### **Stage 1: Harvest → Grapes**
```javascript
// harvestOverlay.js line 309
matchingGrapes.oxidation = 0; // Start with no oxidation

// harvestOverlay.js line 343, 389
applyHarvestOxidation(matchingGrapes); // Apply weekly oxidation
```

#### **Stage 2: Grapes → Must (Crushing)**
```javascript
// crushingOverlay.js line 743
oxidation: parseFloat(grapeResource.oxidation) || 0, // Carry oxidation forward
```
**Oxidation is preserved** - it transfers from grapes to must

#### **Stage 3: Must → Wine (Fermentation)**
```javascript
// wineprocessing.js line 91
oxidation: parseFloat(mustItem.oxidation) || 0, // Carry oxidation forward
```
**Oxidation is preserved** - it transfers from must to bottled wine

---

### **5. What Oxidation Affected**

#### **A. Wine Archetype Qualification** 🏆

**File:** `js/constants/archetypes.js`

Each wine archetype had an `oxidationRange` requirement:

```javascript
// Example archetypes with oxidation ranges:
{
    name: "Classic Premium",
    oxidationRange: [0, 0.1],  // Only 0-10% oxidation allowed
    // ... other requirements
}

{
    name: "Burgundian Elegance", 
    oxidationRange: [0, 0.15],  // Only 0-15% oxidation allowed (very sensitive)
    // ... other requirements
}

{
    name: "Natural Wine",
    oxidationRange: [0.1, 0.4],  // Requires 10-40% oxidation (intentional!)
    // ... other requirements
}

{
    name: "Oxidative Style",
    oxidationRange: [0.3, 0.5],  // Requires 30-50% oxidation
    // ... other requirements
}
```

**Impact:**
- ❌ **Too much oxidation** = Wine fails to qualify for premium archetypes
- ✅ **Low oxidation** = Qualifies for "Classic Premium", "Burgundian Elegance"
- ✅ **Some oxidation** = Can qualify for "Natural Wine" or "Oxidative Style"

#### **B. Archetype Score Calculation**

**File:** `js/utils/archetypeUtils.js`

```javascript
// Line 29-31
case 'oxidationRange':
    actualValue = wine.oxidation;
    return typeof actualValue === 'number' && 
           actualValue >= value[0] && 
           actualValue <= value[1];
```

Wines that met the oxidation range requirements got **higher archetype scores**, which:
- Increased **wine balance** (which affects price)
- Allowed qualification for **premium archetypes**

---

### **6. User Feedback & Visibility**

#### **Console Messages**
```javascript
// oxidationIndex.js line 18-19
if (oxidationIncrement > 0.01) {
    addConsoleMessage(`${inventoryItem.resource.name} from ${fieldName} oxidized by ${(oxidationIncrement * 100).toFixed(1)}%`);
}
```

**Example messages:**
- "Pinot Noir from Domaine Laurent oxidized by 1.6%"
- "Sauvignon Blanc from Hillside Vineyard oxidized by 1.8%"

#### **Display in UI**
```javascript
// resource.js line 131
getDisplayInfo() {
    return {
        oxidation: this.oxidation,  // Shown in wine info
        // ... other properties
    }
}
```

Oxidation percentage was visible in:
- Wine cellar inventory displays
- Order details
- Wine information overlays

---

## ⚖️ V1 VS V3 COMPARISON

### **V1 Implementation** ✅ **COMPLETE**
- ✅ Full oxidation tracking system
- ✅ Weekly progression during harvest
- ✅ Grape-specific sensitivity
- ✅ Archetype requirements
- ✅ User feedback (console messages)
- ✅ Carried through entire production chain

### **V3 Implementation** ⚠️ **PARTIAL**
- ✅ `proneToOxidation` property defined on `Resource` interface
- ✅ Same grape values as v1
- ❌ **No evidence of oxidation tracking** in provided files
- ❌ No `oxidation` field on wine batches
- ❌ No weekly progression logic
- ❌ No archetype integration

**Conclusion:** V3 defined the grape properties but **may not have fully implemented** the oxidation system. The infrastructure was there, but the active mechanics were unclear.

---

## 🎮 GAMEPLAY IMPACT

### **Strategic Decisions Created:**

1. **Harvest Timing** ⏰
   - Wait for better ripeness = Risk more oxidation
   - Harvest early = Lower oxidation but lower quality

2. **Processing Speed** 🏃
   - Fast crushing/fermentation = Less oxidation
   - Slow processing = Higher oxidation risk

3. **Grape Selection** 🍇
   - Primitivo/Barbera = Safer, more forgiving
   - Pinot Noir/Sauvignon Blanc = Riskier, requires speed

4. **Archetype Targeting** 🎯
   - Low oxidation grapes = Target premium archetypes
   - High oxidation batches = Natural/Oxidative wine styles

---

## 📈 OXIDATION ACCUMULATION EXAMPLES

### **Scenario: Sauvignon Blanc (proneToOxidation = 0.9)**

```
Week 1: 0.0% → 1.8% (first week after harvest)
Week 2: 1.8% → 3.6%
Week 3: 3.6% → 5.4%
Week 4: 5.4% → 7.2%
Week 5: 7.2% → 9.0%
Week 6: 9.0% → 10.8% ❌ Fails "Classic Premium" (max 10%)
Week 10: → 18.0% ❌ Fails most premium archetypes
Week 20: → 36.0% ✅ Qualifies for "Natural Wine" (10-40%)
```

### **Scenario: Primitivo (proneToOxidation = 0.3)**

```
Week 1: 0.0% → 0.6%
Week 5: 3.0%
Week 10: 6.0%
Week 16: 9.6% ✅ Still qualifies for "Classic Premium" (max 10%)
Week 20: 12.0% ❌ Now exceeds "Classic Premium"
```

**Key Insight:** Primitivo can sit in storage **2.7x longer** than Sauvignon Blanc before exceeding oxidation limits!

---

## 🔑 KEY CONSTANTS

```javascript
// From oxidationIndex.js
HARVEST_OXIDATION_RATE = 0.02  // 2% base rate per week

// Grape sensitivity (from resource.js)
PRONE_TO_OXIDATION = {
  'Primitivo': 0.3,
  'Barbera': 0.4,
  'Chardonnay': 0.7,
  'Pinot Noir': 0.8,
  'Sauvignon Blanc': 0.9
}

// Archetype ranges (from archetypes.js)
OXIDATION_RANGES = {
  'Classic Premium': [0, 0.1],      // Very strict
  'Burgundian Elegance': [0, 0.15], // Strict
  'Bordeaux Classic': [0, 0.2],     // Moderate
  'Natural Wine': [0.1, 0.4],       // Requires some oxidation
  'Oxidative Style': [0.3, 0.5]     // Requires high oxidation
}
```

---

## 🛠️ TECHNICAL IMPLEMENTATION DETAILS

### **Data Storage**
```javascript
// Stored on InventoryItem (resource.js)
class InventoryItem {
  constructor(/* ... */, oxidation = 0, /* ... */) {
    this.oxidation = oxidation;  // 0-1 scale
  }
}
```

### **Database Persistence**
```javascript
// adminFunctions.js line 35, 96
oxidation: item.oxidation || 0  // Saved to localStorage
```

### **Applied During Game Tick**
- **NOT automatically** during game tick
- **Manually triggered** when harvest activity completes
- Applied **per inventory item** in storage

---

## 💡 DESIGN PHILOSOPHY

### **Why This System Worked:**

1. **Realistic** 🌍
   - Mimics real wine production urgency
   - Grapes degrade in real life too

2. **Strategic Depth** 🎲
   - Creates time pressure
   - Forces player decisions
   - Differentiates grape varieties

3. **Archetype Integration** 🏆
   - Some wines benefit from oxidation
   - Creates variety in wine styles
   - Rewards different playstyles

4. **User-Friendly** 👤
   - Simple to understand (%)
   - Clear feedback (console messages)
   - Visible in UI

5. **Not Punishing** ⚖️
   - Base rate is slow (2% × sensitivity)
   - Plenty of time for normal gameplay
   - High oxidation enables alternative styles

---

## ✅ IMPLEMENTATION CHECKLIST FOR V4

To implement oxidation in v4, we need:

### **1. Data Structure Changes**
- [ ] Add `oxidation: number` to `WineBatch` interface (0-1 scale)
- [ ] Add `oxidation` column to `wine_batches` database table
- [ ] Update `saveWineBatch` to persist oxidation
- [ ] Update `loadWineBatches` to load oxidation

### **2. Constants & Configuration**
- [ ] `HARVEST_OXIDATION_RATE = 0.02` (or make configurable)
- [ ] Grape sensitivity values already exist in `GRAPE_CONST.proneToOxidation`

### **3. Oxidation Progression Logic**
- [ ] Create `applyHarvestOxidation(batch)` function
- [ ] Hook into weekly game tick (`processGameTick`)
- [ ] Apply only to batches in `grapes` state
- [ ] Calculate: `oxidation += 0.02 × proneToOxidation`
- [ ] Cap at 1.0 maximum

### **4. Production Chain Integration**
- [ ] Initialize `oxidation = 0` when harvesting grapes
- [ ] Preserve oxidation during crushing (grapes → must)
- [ ] Preserve oxidation during fermentation (must → wine)

### **5. Archetype/Balance System** (Optional but recommended)
- [ ] Add `oxidationRange` to wine archetypes (if v4 has archetypes)
- [ ] Use oxidation in balance/quality calculations
- [ ] OR: Simple penalty for high oxidation

### **6. UI/UX**
- [ ] Display oxidation % in wine batch cards
- [ ] Show oxidation in wine cellar
- [ ] Add notification for significant oxidation (>10%?)
- [ ] Consider color coding (green = fresh, yellow = moderate, red = high)

### **7. Testing Scenarios**
- [ ] Verify weekly progression works
- [ ] Test different grape varieties age correctly
- [ ] Ensure oxidation carries through production
- [ ] Validate cap at 100%

---

## 🎯 RECOMMENDED V4 APPROACH

### **Phase 1: Basic Tracking** (Minimal Viable Product)
1. Add `oxidation` field to WineBatch
2. Initialize at 0 during harvest
3. Apply weekly progression for `grapes` state
4. Display in UI

### **Phase 2: Production Integration**
5. Preserve oxidation through crushing
6. Preserve oxidation through fermentation
7. Display on bottled wines

### **Phase 3: Gameplay Impact** (Future Enhancement)
8. Add oxidation penalties to wine price/quality
9. Create archetype oxidation ranges
10. Add special "oxidative style" wines that benefit

---

## 📝 NOTES & CONSIDERATIONS

1. **Storage vs Fresh Processing:**
   - V1 only applied oxidation to **stored grapes**
   - If immediately processed, minimal oxidation
   - This rewarded efficient workflow

2. **No Post-Bottling Oxidation:**
   - V1 stopped oxidation after bottling
   - Wine aging was separate mechanic (not shown in files)

3. **Grape Color Independence:**
   - Oxidation wasn't tied to red vs white
   - Each variety had unique sensitivity
   - Realistic (some reds oxidize more than some whites)

4. **User Control:**
   - Players couldn't prevent oxidation
   - Only mitigation: process quickly
   - Created natural time pressure

5. **Balance with Other Systems:**
   - Worked alongside ripeness
   - Both created harvest timing decisions
   - But different trade-offs (quality vs stability)


