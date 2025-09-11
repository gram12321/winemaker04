// Customer generation service - creates sophisticated customers with regional characteristics
import { v4 as uuidv4 } from 'uuid';
import { Customer, CustomerCountry, CustomerType } from '../../types';
import { CUSTOMER_REGIONAL_DATA, CUSTOMER_NAMES, SALES_CONSTANTS } from '../../constants';

/**
 * Create a sophisticated customer with regional characteristics
 * Based on the legacy importer system but updated for TypeScript/React
 * 
 * @returns Customer with realistic characteristics and behavioral multipliers
 */
export function createCustomer(): Customer {
  // Select country randomly
  const countries = Object.keys(CUSTOMER_REGIONAL_DATA) as CustomerCountry[];
  const selectedCountry = countries[Math.floor(Math.random() * countries.length)];
  
  const regionalData = CUSTOMER_REGIONAL_DATA[selectedCountry];
  
  // Select customer type based on regional weights
  const selectedCustomerType = weightedRandomSelect(
    Object.keys(regionalData.customerTypeWeights) as CustomerType[],
    Object.values(regionalData.customerTypeWeights)
  );
  
  // Generate market share (0-1 scale, realistic distribution)
  const marketSharePercent = generateMarketShare();
  const marketShare = marketSharePercent / 100; // Convert to 0-1 scale
  
  // Generate customer name
  const customerName = generateCustomerName(selectedCountry, selectedCustomerType);
  
  // Get pricing from unified constants system
  const customerTypeConfig = SALES_CONSTANTS.CUSTOMER_TYPES[selectedCustomerType];
  
  // Generate individual price multiplier from range, influenced by customer characteristics
  const basePriceMultiplier = customerTypeConfig.priceMultiplierRange[0] + 
    (Math.random() * (customerTypeConfig.priceMultiplierRange[1] - customerTypeConfig.priceMultiplierRange[0]));
  
  // Apply customer characteristics to price multiplier - direct percentage multiplication
  // Purchasing Power: 100% = neutral, 110% = 10% higher prices, 90% = 10% lower prices
  // Wine Tradition: 100% = neutral, 110% = 10% higher prices, 90% = 10% lower prices  
  // Market Share: 100% = neutral, 110% = 10% LOWER prices (inverted - higher market share = more negotiating power)
  const purchasingPowerMultiplier = regionalData.purchasingPower; // 0.8 = 80% = 20% lower prices
  const wineTraditionMultiplier = regionalData.wineTradition; // 0.75 = 75% = 25% lower prices
  const marketShareMultiplier = 1 - marketShare; // Relative to 1: 0.006 = 0.6% = 0.994x multiplier
  
  const priceMultiplier = basePriceMultiplier * purchasingPowerMultiplier * wineTraditionMultiplier * marketShareMultiplier;
  
  // Ensure multiplier stays within reasonable bounds
  const finalPriceMultiplier = Math.max(0.1, Math.min(2.0, priceMultiplier));
  
  // Generate individual quantity multiplier from base + regional influences
  let quantityMultiplier: number = customerTypeConfig.baseQuantityMultiplier;
  
  // Apply regional influences (market share and purchasing power)
  const qtyMarketShareInfluence = (marketShare - 0.5) * 0.2; // ±10% influence
  const qtyPurchasingPowerInfluence = (regionalData.purchasingPower - 0.5) * 0.1; // ±5% influence
  
  quantityMultiplier *= (1 + qtyMarketShareInfluence + qtyPurchasingPowerInfluence);
  
  // Ensure reasonable bounds
  quantityMultiplier = Math.max(0.1, Math.min(2.0, quantityMultiplier));
  
  return {
    id: uuidv4(),
    name: customerName,
    country: selectedCountry,
    customerType: selectedCustomerType,
    purchasingPower: regionalData.purchasingPower,
    wineTradition: regionalData.wineTradition,
    marketShare,
    priceMultiplier: finalPriceMultiplier,
    quantityMultiplier,
    relationship: 0 // Start with no relationship - will be developed through transactions
  };
}

/**
 * Generate realistic customer names based on country and order type
 * Uses regional name databases with appropriate business suffixes
 */
function generateCustomerName(country: CustomerCountry, customerType: CustomerType): string {
  const nameData = CUSTOMER_NAMES[country];
  
  // Select random gender and corresponding name
  const useFemaleName = Math.random() < 0.5;
  const firstNames = useFemaleName ? nameData.firstNames.female : nameData.firstNames.male;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = nameData.lastNames[Math.floor(Math.random() * nameData.lastNames.length)];
  
  // Generate business name based on order type
  const suffixes = nameData.businessSuffixes[customerType];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  switch (customerType) {
    case 'Private Collector':
      // Use personal format: "FirstName LastName Wines"
      return `${firstName} ${lastName} ${suffix}`;
    
    case 'Local Restaurant':
      // Use possessive format: "LastName's Restaurant" (US) or "LastName Restaurant" (Europe)
      if (country === 'United States') {
        return `${lastName}'s ${suffix}`;
      } else {
        return `${lastName} ${suffix}`;
      }
    
    case 'Wine Shop':
    case 'Export Order':
      // Use corporate format: "LastName Wine Merchants"
      return `${lastName} ${suffix}`;
    
    default:
      return `${firstName} ${lastName} ${suffix}`;
  }
}

/**
 * Generate realistic market share distribution
 * Most customers have small market share, few have large share
 */
function generateMarketShare(): number { // TODO: Replace with non-linear distribution from calculator.ts
  // Use exponential distribution to create realistic market share
  // Most customers: 0.1-2%, Some: 2-10%, Few: 10%+
  const random = Math.random();
  
  if (random < 0.7) {
    // 70% have small market share (0.1-2%)
    return 0.1 + Math.random() * 1.9;
  } else if (random < 0.95) {
    // 25% have medium market share (2-10%)
    return 2 + Math.random() * 8;
  } else {
    // 5% have large market share (10-50%)
    return 10 + Math.random() * 40;
  }
}



/**
 * Weighted random selection helper
 */
function weightedRandomSelect<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  
  return items[items.length - 1]; // Fallback
}

/**
 * Generate multiple customers for multi-customer order generation
 * Uses regional distribution to create realistic customer mix
 * 
 * @param count - Number of customers to generate
 * @returns Array of customers with diverse characteristics
 */
export function createMultipleCustomers(count: number): Customer[] {
  const customers: Customer[] = [];
  
  for (let i = 0; i < count; i++) {
    customers.push(createCustomer());
  }
  
  return customers;
}
