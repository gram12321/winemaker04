# Wine Features - Consolidation Analysis

## ✅ **CONSOLIDATION OPPORTUNITIES FOUND**

After analyzing the new `featureRiskHelper.ts` and existing feature-related files, here are the consolidation opportunities:

---

## 🗑️ **1. DEPRECATE `oxidationConstants.ts`** (PRIORITY: HIGH)

### **Current State:**
- **File:** `src/lib/constants/oxidationConstants.ts` (67 lines)
- **Exports:**
  - `BASE_OXIDATION_RATE = 0.02`
  - `OXIDATION_STATE_MULTIPLIERS`
  - `OXIDATION_WARNING_THRESHOLDS`
  - `getOxidationRiskLabel()`

### **Problem:**
- ❌ **All values duplicated in `oxidation.ts` (OXIDATION_FEATURE config)**
- ❌ **Not imported anywhere** (only re-exported by `index.ts`)
- ❌ **Pre-dates Wine Features Framework**
- ❌ **Maintenance burden** (two sources of truth)

### **Solution:**
**Delete `oxidationConstants.ts` entirely**

**Mapping:**
```typescript
// OLD (oxidationConstants.ts) → NEW (oxidation.ts)

BASE_OXIDATION_RATE = 0.02 
  → OXIDATION_FEATURE.riskAccumulation.baseRate = 0.02

OXIDATION_STATE_MULTIPLIERS 
  → OXIDATION_FEATURE.riskAccumulation.stateMultipliers

OXIDATION_WARNING_THRESHOLDS 
  → OXIDATION_FEATURE.ui.warningThresholds

getOxidationRiskLabel() 
  → Move to featureRiskHelper.ts as generic getRiskLabel()
```

---

## 🔧 **2. ADD GENERIC RISK LABEL FUNCTION** (PRIORITY: MEDIUM)

### **Current State:**
- `oxidationConstants.ts` has `getOxidationRiskLabel()` (oxidation-specific)
- `featureRiskHelper.ts` has hardcoded severity thresholds in `formatFeatureRiskWarning()`

### **Problem:**
- 🔴 Risk severity labels scattered across code
- 🔴 No generic function for "Low Risk", "High Risk", etc.

### **Solution:**
**Add generic risk label function to `featureRiskHelper.ts`**

```typescript
/**
 * Get risk severity label based on risk value (0-1)
 * Used for consistent risk communication across UI
 */
export function getRiskSeverityLabel(risk: number): string {
  if (risk < 0.05) return 'Minimal Risk';
  if (risk < 0.08) return 'Low Risk';
  if (risk < 0.15) return 'Moderate Risk';
  if (risk < 0.30) return 'High Risk';
  return 'Critical Risk';
}

/**
 * Get risk severity icon based on risk value
 */
export function getRiskSeverityIcon(risk: number): string {
  if (risk < 0.08) return 'ℹ️';
  if (risk < 0.15) return '⚠️';
  if (risk < 0.30) return '⚠️ HIGH RISK';
  return '🚨 CRITICAL';
}
```

**Benefits:**
- ✅ Consistent risk labels across all features
- ✅ One source of truth for severity thresholds
- ✅ Easier to tune risk communication

---

## 📊 **3. NO CHANGES NEEDED FOR THESE FILES** ✅

### **FeatureRiskDisplay.tsx**
- **Purpose:** Display feature risk in Winery/Sales pages (list view)
- **Usage:** Shows oxidation risk with tooltip on batch cards
- **Status:** ✅ **Good as-is** - Different use case from modals

### **FeatureBadge.tsx**
- **Purpose:** Display present features as badges
- **Usage:** Already used in crushing modal
- **Status:** ✅ **Good as-is** - Well-integrated

### **oxidation.ts / greenFlavor.ts**
- **Purpose:** Feature configurations
- **Status:** ✅ **Good as-is** - Clean, complete configs

### **prestigeCalculator.ts**
- **Purpose:** Pure math for dynamic prestige
- **Status:** ✅ **Good as-is** - Focused, reusable

### **featureEffectsService.ts**
- **Purpose:** Quality/price/characteristic calculations
- **Status:** ✅ **Good as-is** - Core business logic

### **featureRiskService.ts**
- **Purpose:** Risk accumulation and manifestation
- **Status:** ✅ **Good as-is** - Core game engine

### **wineFeatures.ts**
- **Purpose:** Type definitions
- **Status:** ✅ **Good as-is** - Complete type system

---

## 📝 **IMPLEMENTATION PLAN**

### **Phase 1: Add Generic Functions (Low Risk)**
1. Add `getRiskSeverityLabel()` to `featureRiskHelper.ts`
2. Add `getRiskSeverityIcon()` to `featureRiskHelper.ts`
3. Update `formatFeatureRiskWarning()` to use new functions
4. Test in modals

### **Phase 2: Deprecate oxidationConstants.ts (Low Risk)**
1. Remove `export * from './oxidationConstants'` from `src/lib/constants/index.ts`
2. Delete `src/lib/constants/oxidationConstants.ts`
3. Verify no build errors (already confirmed no imports)

---

## 🎯 **BENEFITS**

### **After Consolidation:**
- ✅ **-67 lines** (delete oxidationConstants.ts)
- ✅ **+30 lines** (add generic functions to featureRiskHelper.ts)
- ✅ **Net: -37 lines**
- ✅ **One source of truth** for feature configs
- ✅ **Consistent risk labels** across all features
- ✅ **Easier maintenance** (fewer files to update)

---

## ⚠️ **NO BREAKING CHANGES**

All changes are internal:
- ✅ No public API changes
- ✅ No database changes
- ✅ No UI changes
- ✅ Pure refactoring/consolidation

---

## 📊 **FILE SUMMARY AFTER CONSOLIDATION**

### **Wine Features System:**
```
src/lib/
├── types/
│   └── wineFeatures.ts (194 lines) ✅ Type definitions
├── constants/
│   └── wineFeatures/
│       ├── index.ts ✅ Feature registry
│       ├── oxidation.ts (117 lines) ✅ Oxidation config
│       └── greenFlavor.ts (129 lines) ✅ Green flavor config
├── services/
│   ├── wine/
│   │   ├── featureRiskService.ts (339 lines) ✅ Risk engine
│   │   ├── featureEffectsService.ts (187 lines) ✅ Effects calculation
│   │   └── featureRiskHelper.ts (231 lines) ✅ UI helpers (+30 lines)
│   └── prestige/
│       └── prestigeCalculator.ts (152 lines) ✅ Prestige math
└── components/
    └── ui/wine/
        ├── FeatureBadge.tsx (88 lines) ✅ Badge display
        └── FeatureRiskDisplay.tsx (95 lines) ✅ Risk display
```

### **Deleted:**
```
❌ src/lib/constants/oxidationConstants.ts (67 lines)
```

---

## 🧪 **TESTING CHECKLIST**

### **After Deleting oxidationConstants.ts:**
- [ ] `npm run build` succeeds
- [ ] No import errors in console
- [ ] Oxidation still works (check Winery page)
- [ ] Green flavor still works (check harvest/crushing)

### **After Adding Generic Functions:**
- [ ] Risk labels consistent in modals
- [ ] Risk icons correct (⚠️ vs 🚨)
- [ ] All features use same severity scale

---

## 💡 **RECOMMENDATION**

**Priority: Medium** - Safe refactoring with clear benefits

**Order:**
1. Add generic functions first (Phase 1) - Additive, low risk
2. Delete oxidationConstants.ts second (Phase 2) - Already unused

**Time Estimate:** 15-20 minutes total

**Risk Level:** ⬇️ **LOW** - No functional changes, purely organizational

