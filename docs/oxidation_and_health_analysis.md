# V1/V3/V4 System Comparison - Historical Reference

> **📌 Current v4 implementation:**
> - **Oxidation:** See `wine_features_framework_design.md` (config-driven, generic framework)
> - **Vineyard Health:** Basic property exists but no clearing/improvement system implemented

---

## 🔬 **Oxidation Comparison**

| Feature | V1 (Old JS) | V3 | V4 (Current) |
|---------|-------------|-----|--------------|
| **Tracking** | Deterministic (0-1 scale) | Not implemented | Risk-based probabilistic |
| **Progression** | Weekly (2% × proneToOxidation) | None | State multipliers + compound |
| **Effects** | Archetype disqualification | None | Quality/price/prestige penalties |
| **Approach** | Standalone system | N/A | Generic feature framework |
| **Customer Impact** | Archetype matching | None | Customer sensitivity (0.60-0.90) |

**V1 → V4 Evolution:**
- V1: Linear accumulation → archetype requirements
- V4: Risk-based manifestation → quality power function + customer sensitivity + prestige events

---

## 🌱 **Vineyard Health Comparison**

| Feature | V1 | V3 | V4 (Current) |
|---------|----|----|-----|
| **Property** | `farmlandHealth` | `vineyardHealth` | `vineyardHealth` ✅ |
| **Default** | 0.5 (50%) | 1.0 (100%) | 1.0 (100%) ✅ |
| **Yield Impact** | Quality multiplier | Quality multiplier | ❌ Not used in yield calculation |
| **Clearing Tasks** | Generic improvement | Specific % per task | ❌ Not implemented |
| **Task Tracking** | `canBeCleared` flag | `completedClearingTasks[]` | ❌ Commented out in types |
| **Farming Methods** | 3 types | 3 types + organic | ❌ Commented out in types |
| **UI Components** | HealthBar, Overlay | HealthBar, Modal | ❌ Not implemented |
| **Database Storage** | N/A | N/A | ✅ Stored in vineyard table |

---

## 🎯 **V4 Current State Analysis**

### **What Exists in V4:**
- ✅ `vineyardHealth` property in `Vineyard` interface (0-1 scale)
- ✅ Database storage for vineyard health
- ✅ Default health of 1.0 (100%) for new vineyards
- ✅ Health displayed in vineyard UI (basic property)

### **What's Missing in V4:**
- ❌ **Yield Impact**: Health not used in yield calculations (unlike V1/V3)
- ❌ **Clearing Activities**: No way to improve vineyard health
- ❌ **Farming Methods**: No organic/conventional system
- ❌ **Health Progression**: No natural health degradation or improvement
- ❌ **UI Components**: No health bar, clearing modals, or health management
- ❌ **Activity System**: No clearing tasks in activity system

### **Key Insight:**
The health system is completely separate from the wine features framework. Health affects **vineyard productivity** (yield/quality), while wine features affect **wine characteristics** (oxidation, terroir, etc.).

---

## 📋 **V3 Health System Reference** (For Future Implementation)

### **Clearing Tasks**
- Clear vegetation: +10% health
- Remove debris: +5% health
- Soil amendment: +15% health
- Remove vines: +20% health (scaled by replanting intensity)

### **Farming Methods**
- **Conventional**: 10% yield bonus, resets organic progress
- **Non-Conventional**: Counts towards organic certification
- **Ecological**: Requires 3 years Non-Conventional, annual health improvement

### **Organic Certification**
- 3 years Non-Conventional → Ecological certification
- Ecological: Annual health improvement
- Switching to Conventional: Resets `organicYears` to 0

**Key V3 Files:** `HealthBar.tsx`, `ClearingOptionModal.tsx`, `vineyard.ts`, `gameTick.ts`

---

## 🎯 **V1 Oxidation Details** (Historical)

### **Core Mechanism**
```javascript
// Weekly accumulation
oxidation += 0.02 × proneToOxidation × compoundEffect
// Capped at 1.0
```

### **Grape Sensitivity**
| Grape | proneToOxidation |
|-------|------------------|
| Primitivo | 0.3 (resistant) |
| Barbera | 0.4 |
| Chardonnay | 0.7 |
| Pinot Noir | 0.8 |
| Sauvignon Blanc | 0.9 (very prone) |

### **Archetype Requirements**
- Classic Premium: [0, 0.1] oxidation
- Burgundian Elegance: [0, 0.15]
- Natural Wine: [0.1, 0.4]
- Oxidative Style: [0.3, 0.5]

**Example Accumulation:**
- Sauvignon Blanc (0.9): Fails Classic Premium by week 6 (10.8%)
- Primitivo (0.3): Can sit until week 16 (9.6%)
- **Ratio:** Primitivo lasts 2.7x longer

**Key V1 Files:** `utils/oxidationIndex.js`, `resource.js`, `constants/archetypes.js`

---

## 💡 **Migration Insights**

**V1 → V4:**
- Deterministic accumulation → Risk-based manifestation (more realistic)
- Archetype requirements → Quality power function + customer sensitivity (more flexible)
- Standalone system → Generic framework (extensible to all features)

**V3 → V4:**
- Health system infrastructure exists but not active
- Can implement clearing tasks + farming methods as future feature
- `vineyardHealth` property already tracked in database
