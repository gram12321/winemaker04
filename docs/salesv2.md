## ✨ Key Components from Old Iterations

### 1. **Advanced Sales System** (`sales.js`)
- **Complex Pricing:** Calculates wine price using land value, field prestige, quality, and balance.
- **Extreme Quality Multipliers:** Uses logistic functions for realistic, exponential price scaling.
- **Dynamic Order Generation:** Order frequency scales with company prestige (diminishing returns).
- **Price Negotiation:** Haggling system adjusts final sale price.
- **Order Amounts:** Order sizes respond to pricing and prestige.

---

### 2. **Sophisticated Contract System** (`contracts.js`)
- **Multi-Requirement Contracts:** Quality, vintage, balance, land value, etc.
- **Importer Relationship Management:** Dynamic, prestige-based relationship values.
- **Contract Generation:** Based on prestige and importer relationships.
- **Premium Pricing:** Different requirements yield different price premiums.
- **Flexible Fulfillment:** Wines matched to contract requirements.

---

### 3. **Importer Management** (`importerClass.js`)
- **Multiple Importer Types:** Private, Restaurant, Wine Shop, Chain Store.
- **Country-Specific Traits:** Purchasing power, wine tradition, etc.
- **Market Share Calculations:** Affects pricing and order sizes.
- **Relationship Scaling:** Prestige and market dynamics influence relationships.

---

### 4. **Rich Constants** (`constants.js`)
- **Task Definitions:** Work rates for various sales/contract tasks.
- **Order Generation Parameters:** Prestige thresholds, diminishing returns.
- **Price Negotiation Ranges:** Haggling factors for realistic deals.
- **Contract Generation Rules:** Diminishing returns, relationship thresholds.

---

### 5. **Comprehensive Data** (`names.js`)
- **Regional Wine Data:** Soil types, altitude, aspect, etc.
- **Grape Suitability:** By region.
- **Real-World Price Ranges:** For different wine regions.
- **Importer Name Generation:** By country and type.

---

## 📝 What This Means for Current Implementation

The current `salesService.ts` is **basic** compared to the old system. The legacy code offers:
- Realistic, multi-factor pricing
- Dynamic market behavior via importer relationships
- Sophisticated, multi-requirement contracts
- Regional authenticity with real-world data
- Order generation that adapts to player strategy

---

## 🚀 Recommended Approach

To modernize the sales system:
1. **Start with Pricing:** Implement advanced wine price calculations.
2. **Add Importer Management:** Create importer classes and relationship logic.
3. **Implement Contract Generation:** Add the multi-requirement contract system.
4. **Enhance Order Generation:** Make order creation prestige- and strategy-driven.
5. **Integrate Regional Data:** Use real-world wine region information.

> **Result:**  
> This will transform sales from simple order fulfillment into a dynamic, realistic wine trading simulation that responds to player decisions and market conditions.