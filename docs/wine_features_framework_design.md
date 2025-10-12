# Wine Features Framework - Design Document

## 📊 **OVERVIEW**

The Wine Features Framework is a generic system for managing wine characteristics that can be **faults** (oxidation, green flavor) or **features** (terroir expression, complexity). The framework handles:
- Risk accumulation (time-based or event-triggered)
- Feature manifestation (binary or graduated severity)
- Effects on quality, price, characteristics, and prestige
- Customer perception and market impact
- UI display and notifications

**First Implementation:** Oxidation (fault, binary, time-based)
**Second Implementation:** Green Flavor (fault, binary, event-triggered)
**Future:** Terroir Expression, Brett Character, Cork Taint, etc.

---

## 🏗️ **CORE ARCHITECTURE**

### **1. Feature Data Model**

```typescript
// src/lib/types/wineFeatures.ts

export type FeatureType = 'fault' | 'feature';
export type ManifestationType = 'binary' | 'graduated';
export type TriggerType = 'time_based' | 'event_triggered' | 'hybrid';

export interface WineFeature {
  id: string;              // 'oxidation', 'green_flavor', 'terroir', etc.
  risk: number;            // 0-1 scale, probability of occurrence/growth
  isPresent: boolean;      // Has the feature manifested?
  severity: number;        // 0-1 scale (1.0 for binary, variable for graduated)
  
  // Metadata (cached from config for performance)
  name: string;
  type: FeatureType;
  icon: string;
}

export interface WineBatch {
  // ... existing fields
  
  // Replace oxidation/isOxidized with generic features
  features: WineFeature[];
}
```

**Database Storage:**
```sql
-- wine_batches table
ALTER TABLE wine_batches 
DROP COLUMN oxidation,
DROP COLUMN is_oxidized,
ADD COLUMN features JSONB DEFAULT '[]'::jsonb;

-- Example stored data:
[
  {
    "id": "oxidation",
    "risk": 0.23,
    "isPresent": false,
    "severity": 0,
    "name": "Oxidation",
    "type": "fault",
    "icon": "⚠️"
  }
]
```

---

### **2. Feature Configuration System**

```typescript
// src/lib/constants/wineFeatures/types.ts

export interface FeatureConfig {
  // Identity
  id: string;
  name: string;
  type: FeatureType;
  icon: string;
  description: string;
  
  // Risk & Manifestation
  manifestation: ManifestationType;
  riskAccumulation: RiskAccumulationConfig;
  
  // Effects
  effects: FeatureEffects;
  
  // Customer Perception
  customerSensitivity: Record<CustomerType, number>;
  
  // UI
  ui: FeatureUIConfig;
}

export interface RiskAccumulationConfig {
  trigger: TriggerType;
  
  // For time-based accumulation (like oxidation)
  baseRate?: number;               // Per game tick
  stateMultipliers?: Record<WineBatchState, number>;
  compoundEffect?: boolean;        // Risk accelerates with current risk
  
  // For event-triggered (like green flavor from crushing)
  eventTriggers?: Array<{
    event: 'harvest' | 'crushing' | 'fermentation' | 'bottling';
    condition: (context: any) => boolean;
    riskIncrease: number | ((context: any) => number);
  }>;
  
  // Severity progression (for graduated features)
  severityGrowth?: {
    rate: number;                  // Per game tick
    cap: number;                   // Maximum severity (0-1)
  };
}

export interface FeatureEffects {
  // Quality impact
  quality: QualityEffect;
  
  // Price impact (via customer sensitivity)
  price: PriceEffect;
  
  // Characteristic modifications (for Wine Influences Phase 2)
  characteristics?: Array<{
    characteristic: keyof WineCharacteristics;
    modifier: number | ((severity: number) => number);
  }>;
  
  // Prestige impact
  prestige?: {
    onManifestation?: PrestigeImpact;  // When feature appears
    onSale?: PrestigeImpact;            // When selling affected wine
  };
}

export interface QualityEffect {
  type: 'power' | 'linear' | 'custom' | 'bonus';
  
  // For power function (premium wines hit harder)
  exponent?: number;
  basePenalty?: number;
  
  // For linear penalty/bonus
  amount?: number;
  
  // For custom function
  calculate?: (batch: WineBatch, severity: number) => number;
}

export interface PriceEffect {
  type: 'customer_sensitivity' | 'direct_multiplier' | 'premium';
  
  // Direct multiplier (simple)
  multiplier?: number;
  
  // Premium (for positive features)
  premiumPercentage?: number;
}

export interface PrestigeImpact {
  company?: { amount: number; decayRate: number };
  vineyard?: { amount: number; decayRate: number };
}

export interface FeatureUIConfig {
  badgeColor: 'destructive' | 'warning' | 'info' | 'success';
  warningThresholds?: number[];    // Risk thresholds for warnings
  sortPriority: number;             // Display order (1 = most important)
}
```

---

## 🎯 **FEATURE IMPLEMENTATIONS**

### **Feature 1: Oxidation (Binary, Time-Based)**

```typescript
// src/lib/constants/wineFeatures/oxidation.ts

export const OXIDATION_FEATURE: FeatureConfig = {
  id: 'oxidation',
  name: 'Oxidation',
  type: 'fault',
  icon: '⚠️',
  description: 'Wine exposed to oxygen, resulting in flavor degradation and browning',
  
  manifestation: 'binary',  // Jumps from 0% to 100%
  
  riskAccumulation: {
    trigger: 'time_based',
    baseRate: 0.02,          // 2% per week
    stateMultipliers: {
      'grapes': 3.0,         // Fresh grapes oxidize fast
      'must_ready': 1.5,     // Exposed must
      'must_fermenting': 0.8, // CO2 protects
      'bottled': 0.3         // Sealed environment
    },
    compoundEffect: true     // Risk accelerates: rate × (1 + currentRisk)
  },
  
  effects: {
    quality: {
      type: 'power',
      exponent: 1.5,         // Premium wines hit harder
      basePenalty: 0.25      // 25% base reduction
    },
    price: {
      type: 'customer_sensitivity'
    },
    characteristics: [
      { characteristic: 'aroma', modifier: -0.20 },
      { characteristic: 'acidity', modifier: -0.12 },
      { characteristic: 'body', modifier: -0.08 },
      { characteristic: 'sweetness', modifier: +0.08 }
    ],
    prestige: {
      onManifestation: {
        vineyard: { amount: -2.0, decayRate: 0.98 }  // 3 years
      },
      onSale: {
        company: { amount: -0.5, decayRate: 0.995 }  // 20 years
      }
    }
  },
  
  customerSensitivity: {
    'Restaurant': 0.85,
    'Wine Shop': 0.80,
    'Private Collector': 0.60,  // Hate flaws
    'Chain Store': 0.90
  },
  
  ui: {
    badgeColor: 'destructive',
    warningThresholds: [0.10, 0.20, 0.40],
    sortPriority: 1  // Show first (most serious)
  }
};
```

**How It Works:**
1. **Risk Accumulation:** Every game tick, risk increases by `0.02 × proneToOxidation × stateMultiplier × (1 + currentRisk)`
2. **Manifestation Check:** Each tick, roll `Math.random()`. If roll < risk, oxidation occurs
3. **On Manifestation:** `isPresent = true`, `severity = 1.0` (binary), vineyard prestige event triggered
4. **On Sale:** Company prestige event triggered, customer sensitivity applied to price

---

### **Feature 2: Green Flavor (Binary, Event-Triggered)**

```typescript
// src/lib/constants/wineFeatures/greenFlavor.ts

export const GREEN_FLAVOR_FEATURE: FeatureConfig = {
  id: 'green_flavor',
  name: 'Green/Vegetal',
  type: 'fault',
  icon: '🌿',
  description: 'Herbaceous, vegetal flavors from underripe grapes or rough handling',
  
  manifestation: 'binary',  // Either present or not
  
  riskAccumulation: {
    trigger: 'event_triggered',
    baseRate: 0,  // Doesn't accumulate over time
    compoundEffect: false,
    
    eventTriggers: [
      {
        event: 'harvest',
        condition: (vineyard: Vineyard) => vineyard.ripeness < 0.5,
        riskIncrease: (vineyard: Vineyard) => {
          // More underripe = higher risk
          return Math.max(0, (0.5 - vineyard.ripeness) * 0.6);
        }
      },
      {
        event: 'crushing',
        condition: (options: CrushingOptions) => {
          // Basic method with stems = risk
          return options.method === 'Basic' && options.includeStems;
        },
        riskIncrease: 0.25  // 25% risk from rough crushing with stems
      }
    ]
  },
  
  effects: {
    quality: {
      type: 'linear',
      amount: -0.20  // 20% quality reduction (simpler than oxidation)
    },
    price: {
      type: 'customer_sensitivity'
    },
    characteristics: [
      { characteristic: 'aroma', modifier: -0.15 },  // Vegetal vs fruity
      { characteristic: 'sweetness', modifier: -0.10 },  // Underripe = less sweet
      { characteristic: 'tannins', modifier: +0.12 }  // Green tannins
    ],
    prestige: {
      onManifestation: {
        vineyard: { amount: -1.0, decayRate: 0.98 }
      },
      onSale: {
        company: { amount: -0.3, decayRate: 0.995 }
      }
    }
  },
  
  customerSensitivity: {
    'Restaurant': 0.90,      // Less sensitive than oxidation
    'Wine Shop': 0.85,
    'Private Collector': 0.70,
    'Chain Store': 0.95      // Chain stores don't care much
  },
  
  ui: {
    badgeColor: 'warning',
    sortPriority: 2
  }
};
```

**How It Works:**
1. **Event Trigger (Harvest):** If ripeness < 0.5, add risk: `(0.5 - ripeness) × 0.6`
   - Example: Ripeness 0.3 → Risk += 12%
2. **Event Trigger (Crushing):** If basic method + stems → Risk += 25%
3. **Manifestation Check:** After each event, roll `Math.random()`. If roll < total risk, green flavor occurs
4. **No Time Accumulation:** Risk doesn't grow weekly (set baseRate: 0)

---

### **Feature 3: Terroir Expression (Graduated, Positive)**

```typescript
// src/lib/constants/wineFeatures/terroir.ts

export const TERROIR_FEATURE: FeatureConfig = {
  id: 'terroir_expression',
  name: 'Terroir Expression',
  type: 'feature',  // NOT a fault!
  icon: '✨',
  description: 'Distinctive character reflecting vineyard location and conditions',
  
  manifestation: 'graduated',  // Can be mild/moderate/strong
  
  riskAccumulation: {
    trigger: 'hybrid',
    baseRate: 0.01,  // Slowly develops over time
    compoundEffect: false,
    
    eventTriggers: [
      {
        event: 'fermentation',
        condition: (options) => options.method === 'Extended Maceration',
        riskIncrease: 0.15  // Longer contact = more terroir
      }
    ],
    
    severityGrowth: {
      rate: 0.02,  // Severity grows 2% per week once present
      cap: 1.0     // Can reach 100% terroir expression
    }
  },
  
  effects: {
    quality: {
      type: 'bonus',
      amount: (severity) => severity * 0.15  // Up to +15% quality
    },
    price: {
      type: 'premium',
      premiumPercentage: (severity) => severity * 0.25  // Up to +25% price
    },
    prestige: {
      onManifestation: {
        vineyard: { amount: +0.5, decayRate: 0.95 }  // Positive prestige!
      }
    }
  },
  
  customerSensitivity: {
    'Restaurant': 1.05,          // 5% bonus
    'Wine Shop': 1.10,           // 10% bonus
    'Private Collector': 1.25,   // Collectors LOVE terroir (25% bonus!)
    'Chain Store': 1.0           // Don't care
  },
  
  ui: {
    badgeColor: 'success',
    sortPriority: 5  // Show after faults
  }
};
```

**How Graduated Works:**
1. **Initial Manifestation:** When risk check succeeds, `isPresent = true`, `severity = risk` (e.g., 15%)
2. **Severity Growth:** Each week, `severity += 0.02` (if present)
3. **Quality Bonus:** `+15% × severity` (if severity = 0.6, quality bonus = +9%)
4. **Price Premium:** `+25% × severity` (if severity = 0.8, price bonus = +20%)

---

## ⚙️ **FRAMEWORK SERVICES**

### **1. Feature Risk Service**

```typescript
// src/lib/services/wine/featureRiskService.ts

/**
 * Process weekly risk accumulation for all features
 * Called by game tick
 */
export async function processWeeklyFeatureRisks(): Promise<void> {
  const batches = await loadWineBatches();
  const featureConfigs = getAllFeatureConfigs();
  
  for (const batch of batches) {
    let updatedFeatures = [...batch.features];
    
    for (const config of featureConfigs) {
      if (config.riskAccumulation.trigger === 'time_based') {
        updatedFeatures = processTimeBased(batch, config, updatedFeatures);
      }
    }
    
    await updateWineBatch(batch.id, { features: updatedFeatures });
  }
}

/**
 * Process event-triggered features
 * Called when events happen (harvest, crushing, etc.)
 */
export async function processEventTrigger(
  batch: WineBatch,
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling',
  context: any
): Promise<WineBatch> {
  const featureConfigs = getAllFeatureConfigs();
  let updatedFeatures = [...batch.features];
  
  for (const config of featureConfigs) {
    if (config.riskAccumulation.trigger === 'event_triggered' ||
        config.riskAccumulation.trigger === 'hybrid') {
      
      const triggers = config.riskAccumulation.eventTriggers || [];
      
      for (const trigger of triggers) {
        if (trigger.event === event && trigger.condition(context)) {
          updatedFeatures = applyRiskIncrease(config, trigger, updatedFeatures, context);
        }
      }
    }
  }
  
  return { ...batch, features: updatedFeatures };
}

function processTimeBased(
  batch: WineBatch,
  config: FeatureConfig,
  features: WineFeature[]
): WineFeature[] {
  const feature = features.find(f => f.id === config.id) || createNewFeature(config);
  
  if (feature.isPresent && config.manifestation === 'binary') {
    return features; // Binary features don't change once present
  }
  
  // Calculate risk increase
  const riskIncrease = calculateRiskIncrease(batch, config, feature);
  const newRisk = Math.min(1.0, feature.risk + riskIncrease);
  
  // Check for manifestation
  let isPresent = feature.isPresent;
  let severity = feature.severity;
  
  if (!isPresent) {
    isPresent = checkManifestation(newRisk);
    if (isPresent) {
      severity = config.manifestation === 'binary' ? 1.0 : newRisk;
      // Trigger notifications and prestige events
      await handleFeatureManifestation(batch, config);
    }
  } else if (config.manifestation === 'graduated') {
    // Grow severity for graduated features
    const growthRate = config.riskAccumulation.severityGrowth?.rate || 0;
    const cap = config.riskAccumulation.severityGrowth?.cap || 1.0;
    severity = Math.min(cap, severity + growthRate);
  }
  
  const updatedFeature: WineFeature = {
    ...feature,
    risk: newRisk,
    isPresent,
    severity
  };
  
  return features.map(f => f.id === config.id ? updatedFeature : f);
}
```

---

### **2. Feature Effects Service**

```typescript
// src/lib/services/wine/featureEffectsService.ts

/**
 * Calculate effective quality after applying all feature effects
 */
export function calculateEffectiveQuality(batch: WineBatch): number {
  const featureConfigs = getAllFeatureConfigs();
  let quality = batch.quality;
  
  for (const feature of batch.features) {
    if (!feature.isPresent) continue;
    
    const config = featureConfigs.find(c => c.id === feature.id);
    if (!config) continue;
    
    quality = applyQualityEffect(quality, batch, config, feature.severity);
  }
  
  return Math.max(0, Math.min(1, quality)); // Clamp to 0-1
}

function applyQualityEffect(
  quality: number,
  batch: WineBatch,
  config: FeatureConfig,
  severity: number
): number {
  const effect = config.effects.quality;
  
  switch (effect.type) {
    case 'power':
      // Premium wines hit harder (oxidation-style)
      const penaltyFactor = Math.pow(quality, effect.exponent!);
      const scaledPenalty = effect.basePenalty! * (1 + penaltyFactor);
      return quality * (1 - scaledPenalty);
      
    case 'linear':
      // Simple penalty/bonus
      return quality + (effect.amount! * severity);
      
    case 'bonus':
      // Positive effect (terroir-style)
      const bonus = typeof effect.amount === 'function' 
        ? effect.amount(severity) 
        : effect.amount!;
      return quality + bonus;
      
    case 'custom':
      return effect.calculate!(batch, severity);
      
    default:
      return quality;
  }
}

/**
 * Calculate price multiplier from customer sensitivity to features
 */
export function calculateFeaturePriceMultiplier(
  batch: WineBatch,
  customerType: CustomerType
): number {
  const featureConfigs = getAllFeatureConfigs();
  let multiplier = 1.0;
  
  for (const feature of batch.features) {
    if (!feature.isPresent) continue;
    
    const config = featureConfigs.find(c => c.id === feature.id);
    if (!config) continue;
    
    const sensitivity = config.customerSensitivity[customerType];
    
    // For graduated features, interpolate between 1.0 and sensitivity
    if (config.manifestation === 'graduated') {
      const adjustedSensitivity = 1.0 + (sensitivity - 1.0) * feature.severity;
      multiplier *= adjustedSensitivity;
    } else {
      multiplier *= sensitivity;
    }
  }
  
  return multiplier;
}
```

---

## 🎨 **UI COMPONENTS**

### **Generic Feature Badge**

```tsx
// src/components/ui/wine/FeatureBadge.tsx

interface FeatureBadgeProps {
  feature: WineFeature;
  config: FeatureConfig;
  showSeverity?: boolean;
}

export function FeatureBadge({ feature, config, showSeverity }: FeatureBadgeProps) {
  if (!feature.isPresent) return null;
  
  return (
    <Badge variant={config.ui.badgeColor} className="gap-1">
      <span>{config.icon}</span>
      <span>{config.name}</span>
      {showSeverity && config.manifestation === 'graduated' && (
        <span className="text-xs">
          {Math.round(feature.severity * 100)}%
        </span>
      )}
    </Badge>
  );
}
```

### **Wine Cellar Display**

```tsx
// In WineCellarTab.tsx

{batch.features
  .filter(f => f.isPresent)
  .sort((a, b) => {
    const configA = getFeatureConfig(a.id);
    const configB = getFeatureConfig(b.id);
    return configA.ui.sortPriority - configB.ui.sortPriority;
  })
  .map(feature => (
    <FeatureBadge 
      key={feature.id} 
      feature={feature} 
      config={getFeatureConfig(feature.id)}
      showSeverity
    />
  ))
}
```

---

## 🎯 **DYNAMIC PRESTIGE SYSTEM**

### **Overview**
Prestige penalties and bonuses scale dynamically based on context - sale volume/value, batch size, wine quality, and company/vineyard prestige levels. This creates realistic behavior where bigger scandals cause bigger reputation damage.

**See:** `docs/dynamic_prestige_system.md` for complete technical details and examples

### **Key Features:**
- **Dynamic Sale:** Company prestige scales with sale volume, value, and company prestige
- **Dynamic Manifestation:** Vineyard prestige scales with batch size, quality, and vineyard prestige
- **Logarithmic Scaling:** Volume and value use log scaling (diminishing returns)
- **Square Root Scaling:** Prestige uses sqrt scaling (higher standards for prestigious companies)
- **Linear Scaling:** Quality uses linear scaling (premium wine failures objectively worse)

### **Example Comparison:**

**Small Company, Small Sale:**
```
Prestige 5, sell 10 oxidized bottles @ €500
Company penalty: -0.08 prestige (1.6% loss)
```

**Large Company, Large Sale:**
```
Prestige 100, sell 500 oxidized bottles @ €75,000
Company penalty: -2.61 prestige (2.6% loss)
```

**Effect:** Higher stakes = bigger consequences ✅

---

## 📊 **IMPLEMENTATION STATUS**

### **✅ Phase 1: Framework + Oxidation** (COMPLETE)
- Framework foundation with all types and services
- Oxidation fully implemented as first feature
- Quality penalties (power function)
- Customer sensitivity (price impact)
- Prestige events (company + vineyard)
- UI components (badges, risk display, tooltips)
- Database schema updated

**See:** `docs/wine_features_implementation_summary.md`

---

### **✅ Phase 2: Green Flavor + Dynamic Prestige** (COMPLETE)
1. ✅ Created green flavor config (event-triggered, binary fault)
2. ✅ Added event triggers to harvest service (underripe grapes)
3. ✅ Added event triggers to crushing service (Hand Press without destemming)
4. ✅ Tested multi-feature interaction
5. ✅ Implemented dynamic prestige calculation system
6. ✅ Updated both oxidation and green flavor to use dynamic prestige
7. ✅ Prestige scales with sale context (volume, value, company prestige)
8. ✅ Prestige scales with manifestation context (batch size, quality, vineyard prestige)

---

### **🔮 Phase 3+: Future Features**

**Terroir Expression** (graduated, positive)
- Develops over time during fermentation/aging
- Quality bonus up to +15%
- Price premium for collectors

**Cork Taint** (binary, event-triggered)
- Triggers at bottling (natural cork only)
- ~2% risk per batch

**Additional Faults**
- Brett Character (graduated, fermentation hygiene)
- Volatile Acidity (graduated, process cleanliness)
- Heat Damage (event-triggered, environmental)

---

## 📖 **RELATED DOCUMENTS**

- **Implementation Summary:** `docs/wine_features_implementation_summary.md` (what was built)
- **Dynamic Prestige System:** `docs/dynamic_prestige_system.md` (technical details and examples)
- **Green Flavor Testing:** `docs/green_flavor_testing_scenarios.md` (testing guide)
- **Historical Reference:** `docs/oxidation_system_detailed_summary.md` (v1/v3 comparison)
- **Health System Analysis:** `docs/oxidation_and_health_analysis.md` (includes vineyard health from v1/v3)

