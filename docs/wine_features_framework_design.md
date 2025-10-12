# Wine Features Framework - Design Reference

## 📊 **OVERVIEW**

Generic system for managing wine characteristics - both **faults** (oxidation, green flavor) and **features** (terroir, complexity). Config-driven architecture: add new features with just configuration.

**Currently Implemented:**
- ✅ Oxidation (binary, time-based)
- ✅ Green Flavor (binary, event-triggered)
- ✅ Dynamic prestige scaling
- ✅ Generic UI components

---

## 🏗️ **ARCHITECTURE**

### **Feature Data Model**

```typescript
// Stored in WineBatch.features as JSONB array
export interface WineFeature {
  id: string;              // 'oxidation', 'green_flavor', etc.
  risk: number;            // 0-1 probability
  isPresent: boolean;      // Has manifested?
  severity: number;        // 0-1 scale (1.0 for binary)
  name: string;            // Cached from config
  type: FeatureType;       // 'fault' | 'feature'
  icon: string;
}
```

### **Feature Configuration**

```typescript
export interface FeatureConfig {
  // Identity
  id: string;
  name: string;
  type: 'fault' | 'feature';
  icon: string;
  description: string;
  
  // Risk & Manifestation
  manifestation: 'binary' | 'graduated';
  riskAccumulation: {
    trigger: 'time_based' | 'event_triggered' | 'hybrid';
    baseRate?: number;
    stateMultipliers?: Record<WineBatchState, number>;
    compoundEffect?: boolean;
    eventTriggers?: Array<{
      event: 'harvest' | 'crushing' | 'fermentation' | 'bottling';
      condition: (context: any) => boolean;
      riskIncrease: number | ((context: any) => number);
    }>;
    severityGrowth?: { rate: number; cap: number };
  };
  
  // Effects
  effects: {
    quality: QualityEffect;
    price: PriceEffect;
    characteristics?: Array<{
      characteristic: keyof WineCharacteristics;
      modifier: number;
    }>;
    prestige?: {
      onManifestation?: PrestigeImpact;
      onSale?: PrestigeImpact;
    };
  };
  
  // Customer Perception
  customerSensitivity: Record<CustomerType, number>;
  
  // UI
  ui: {
    badgeColor: 'destructive' | 'warning' | 'info' | 'success';
    warningThresholds?: number[];
    sortPriority: number;
  };
}
```

---

## 🎯 **HOW TO ADD NEW FEATURES**

### **Example: Adding Cork Taint**

```typescript
// 1. Create config in src/lib/constants/wineFeatures/corkTaint.ts
export const CORK_TAINT_FEATURE: FeatureConfig = {
  id: 'cork_taint',
  name: 'Cork Taint',
  type: 'fault',
  icon: '🍾',
  description: 'TCA contamination from natural cork',
  
  manifestation: 'binary',
  
  riskAccumulation: {
    trigger: 'event_triggered',
    baseRate: 0,
    compoundEffect: false,
    eventTriggers: [{
      event: 'bottling',
      condition: (options) => options.closureType === 'natural_cork',
      riskIncrease: 0.02  // 2% chance per bottling
    }]
  },
  
  effects: {
    quality: {
      type: 'linear',
      amount: -0.30  // 30% quality reduction
    },
    price: {
      type: 'customer_sensitivity'
    },
    characteristics: [
      { characteristic: 'aroma', modifier: -0.25 }
    ],
    prestige: {
      onManifestation: {
        vineyard: {
          calculation: 'dynamic_manifestation',
          baseAmount: -0.2,
          scalingFactors: {
            batchSizeWeight: 1.0,
            qualityWeight: 1.0,
            vineyardPrestigeWeight: 1.0
          },
          decayRate: 0.98,
          maxImpact: -5.0
        }
      },
      onSale: {
        company: {
          calculation: 'dynamic_sale',
          baseAmount: -0.15,
          scalingFactors: {
            volumeWeight: 1.0,
            valueWeight: 1.0,
            companyPrestigeWeight: 1.0
          },
          decayRate: 0.995,
          maxImpact: -8.0
        }
      }
    }
  },
  
  customerSensitivity: {
    'Restaurant': 0.75,
    'Wine Shop': 0.70,
    'Private Collector': 0.50,  // Hate cork taint
    'Chain Store': 0.85
  },
  
  ui: {
    badgeColor: 'destructive',
    warningThresholds: [0.01, 0.02],
    sortPriority: 3
  }
};

// 2. Add to index.ts
export const ACTIVE_FEATURES: FeatureConfig[] = [
  OXIDATION_FEATURE,
  GREEN_FLAVOR_FEATURE,
  CORK_TAINT_FEATURE  // Add here
];

// 3. Add event trigger in bottling service (if event-triggered)
const updatedBatch = await processEventTrigger(batch, 'bottling', options);

// DONE! Framework handles everything else.
```

---

## 📊 **QUALITY EFFECT TYPES**

### **Power Function** (Premium wines hit harder)
```typescript
quality: {
  type: 'power',
  exponent: 1.5,
  basePenalty: 0.25
}
// Formula: quality × (1 - (basePenalty × (1 + quality^exponent)))
// Used by: Oxidation
```

### **Linear** (Simple penalty/bonus)
```typescript
quality: {
  type: 'linear',
  amount: -0.20  // -20% flat reduction
}
// Used by: Green Flavor
```

### **Bonus** (Positive features)
```typescript
quality: {
  type: 'bonus',
  amount: (severity) => severity * 0.15  // Up to +15%
}
// Used by: Future terroir features
```

---

## 🎨 **PRESTIGE CALCULATION TYPES**

### **Dynamic Sale** (Scales with sale context)
```typescript
calculation: 'dynamic_sale'
baseAmount: -0.1
scalingFactors: {
  volumeWeight: 1.0,        // Bottle count (log scaling)
  valueWeight: 1.0,         // Sale value (log scaling)
  companyPrestigeWeight: 1.0 // Reputation (sqrt scaling)
}
```

### **Dynamic Manifestation** (Scales with batch/vineyard)
```typescript
calculation: 'dynamic_manifestation'
baseAmount: -0.5
scalingFactors: {
  batchSizeWeight: 1.0,      // Batch size (log scaling)
  qualityWeight: 1.0,         // Wine quality (linear)
  vineyardPrestigeWeight: 1.0 // Vineyard prestige (sqrt scaling)
}
```

### **Fixed** (Static amount)
```typescript
calculation: 'fixed'
baseAmount: -1.0  // Always -1.0 prestige
```

---

## 🔮 **FUTURE FEATURES**

### **Terroir Expression** (Positive, Graduated)
- Develops over time during aging
- Quality bonus: +15% (severity-based)
- Price premium: +25% for collectors
- Trigger: Extended maceration + time

### **Brett Character** (Fault, Graduated)
- Develops during fermentation (hygiene-related)
- Quality penalty scales with severity
- Some collectors accept low levels

### **Volatile Acidity** (Fault, Graduated)
- Time-based accumulation during fermentation
- Severity grows if not addressed
- Major quality/price impact

---

## 📁 **FILE STRUCTURE**

```
src/lib/
├── types/wineFeatures.ts                    # Core types
├── constants/wineFeatures/
│   ├── oxidation.ts                         # Oxidation config
│   ├── greenFlavor.ts                       # Green flavor config
│   └── index.ts                             # Feature registry
├── services/
│   ├── wine/
│   │   ├── featureRiskService.ts           # Risk accumulation
│   │   ├── featureEffectsService.ts        # Quality/price effects
│   │   └── featureRiskHelper.ts            # UI helpers
│   └── prestige/
│       ├── prestigeService.ts              # Event creation
│       └── prestigeCalculator.ts           # Math functions
└── components/ui/wine/
    ├── FeatureBadge.tsx                    # Generic badges
    ├── FeatureStatusGrid.tsx               # Batch display
    └── FeatureRiskDisplay.tsx              # Risk tooltips
```

---

## 🎮 **FEATURE LIFECYCLE**

1. **Initialization**: `initializeBatchFeatures()` creates feature array
2. **Accumulation**: Weekly tick or event triggers increase risk
3. **Manifestation**: Random roll when risk threshold hit
4. **Effects**: Quality/price/prestige impacts applied
5. **Sale**: Additional prestige events triggered

**Framework handles all steps automatically.**

---

## 📖 **RELATED DOCUMENTS**

- **Implementation Summary**: `docs/wine_features_implementation_summary.md`
- **Prestige System**: `docs/prestige_consolidation_summary.md`
