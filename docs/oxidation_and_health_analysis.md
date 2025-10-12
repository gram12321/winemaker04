# V1/V3/V4 System Comparison - Historical Reference

> **📌 For current v4 implementation:**
> - **Oxidation (via Wine Features):** [`wine_features_framework_design.md`](wine_features_framework_design.md)
> - **Vineyard Health:** Not yet implemented

---

## 🔬 Oxidation: V1 → V3 → V4

| Feature | V1 | V3 | V4 (Wine Features) |
|---------|----|----|---------------------|
| **Tracking** | ✅ Deterministic | ❌ Not implemented | ✅ Risk-based probabilistic |
| **Progression** | ✅ Weekly | ❌ None | ✅ State-based multipliers |
| **Effects** | ✅ Archetypes | ❌ None | ✅ Quality/price/prestige |
| **Approach** | Standalone | N/A | Generic framework |

---

## 🌱 Vineyard Health: V1 → V3 → V4

| Feature | V1 | V3 | V4 |
|---------|----|----|-----|
| **Health Property** | ✅ `farmlandHealth` | ✅ `vineyardHealth` | ✅ `vineyardHealth` |
| **Default Health** | 0.5 (50%) | 1.0 (100%) | 1.0 (100%) |
| **Health in Yield** | ✅ Part of quality multiplier | ✅ Part of quality multiplier | ✅ Part of quality multiplier |
| **Clearing Tasks** | ✅ Generic improvement | ✅ Specific % per task | ❌ Not implemented |
| **Task Tracking** | ✅ `canBeCleared` flag | ✅ `completedClearingTasks[]` | ❌ Commented out |
| **Annual Reset** | ❌ Not shown | ✅ Tasks reset yearly | ❌ Not implemented |
| **Farming Methods** | ✅ 3 types | ✅ 3 types | ❌ Not implemented |
| **Organic Progression** | ✅ `organicYears` | ✅ 3 years → Ecological | ❌ Not implemented |
| **Organic Health Boost** | ❌ Not shown | ✅ Annual improvement | ❌ Not implemented |
| **UI Components** | ✅ HealthBar, ClearingOverlay | ✅ HealthBar, ClearingModal | ❌ Not implemented |

---

## V3 Health System Details

**Clearing Task Improvements:**
- Clear vegetation: +10% health
- Remove debris: +5% health
- Soil amendment: +15% health
- Remove vines: +20% health (scaled by replanting intensity)

**Farming Methods:**
- Conventional → 10% yield bonus, resets organic progress
- Non-Conventional → Counts towards organic certification
- Ecological → Requires 3 years of Non-Conventional first

**Organic Certification:**
- 3 years of Non-Conventional farming → Ecological
- Ecological: Annual health improvement
- Switching to Conventional: Resets `organicYears` to 0

---

## 📋 V3 Health System Reference (For Future Implementation)

**Clearing Tasks:** Clear vegetation (+10%), Remove debris (+5%), Soil amendment (+15%), Remove vines (+20%)  
**Farming Methods:** Conventional (10% yield bonus), Non-Conventional, Ecological (3yr certification)  
**Organic:** 3 years Non-Conventional → Ecological certification + annual health improvement

**Key Files:** `HealthBar.tsx`, `ClearingOptionModal.tsx`, `vineyard.ts`, `gameTick.ts`

# Oxidation System - V1/V3 Reference

## V1 Implementation Summary

**Core Mechanism:**
- Oxidation tracked on 0-1 scale (0% = fresh, 100% = fully oxidized)
- Base rate: 2% per week during harvest/storage
- Formula: `oxidation += 0.02 × proneToOxidation × (compound effect)`
- Capped at 1.0 maximum

**Grape Sensitivity (proneToOxidation):**
- Primitivo: 0.3 (most resistant)
- Barbera: 0.4
- Chardonnay: 0.7
- Pinot Noir: 0.8
- Sauvignon Blanc: 0.9 (most prone)

**When Applied:**
- Weekly during harvest for stored grapes
- Carried through: grapes → must → bottled wine
- No oxidation progression after bottling

**Effects:**
- **Archetype Qualification:** Wine archetypes had oxidation range requirements
  - Classic Premium: [0, 0.1] - Very strict
  - Burgundian Elegance: [0, 0.15] - Strict
  - Natural Wine: [0.1, 0.4] - Required some oxidation
  - Oxidative Style: [0.3, 0.5] - Required high oxidation
- Wines outside ranges failed to qualify for premium archetypes

**User Feedback:**
- Console messages for significant oxidation (>1%)
- Oxidation % visible in wine cellar and info displays

---

## V3 Implementation Summary

**Status:** PARTIAL
- `proneToOxidation` property defined on Resource interface
- Same grape values as v1
- **No evidence of active tracking** in provided files
- Infrastructure present but mechanics unclear

---

## Key Files (V1)

- `js/utils/oxidationIndex.js` - Core oxidation logic
- `js/resource.js` - Grape sensitivity values
- `js/wineprocessing.js` - Carried oxidation through production
- `js/constants/archetypes.js` - Oxidation range requirements
- `js/utils/archetypeUtils.js` - Archetype qualification checks

---

## Example Accumulation Rates

**Sauvignon Blanc (0.9 proneToOxidation):**
- Week 5: 9.0%
- Week 6: 10.8% (fails Classic Premium archetype)
- Week 10: 18.0%

**Primitivo (0.3 proneToOxidation):**
- Week 5: 3.0%
- Week 16: 9.6% (still qualifies for Classic Premium)
- Week 20: 12.0%

**Insight:** Primitivo can sit 2.7x longer than Sauvignon Blanc before exceeding limits.
