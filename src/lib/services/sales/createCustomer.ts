// Customer generation service - creates sophisticated customers with regional characteristics
import { v4 as uuidv4 } from 'uuid';
import { Customer, CustomerCountry, CustomerType } from '../../types';
import { CUSTOMER_REGIONAL_DATA, CUSTOMER_NAMES, SALES_CONSTANTS } from '../../constants';
import { getCountryCodeForFlag } from '../../utils/formatUtils';
import { calculateSteppedBalance } from '../../utils/calculator';
import { 
  saveCustomers, 
  loadCustomers, 
  updateCustomerRelationships, 
  checkCustomersExist 
} from '../customerDatabaseService';

// ===== CUSTOMER RELATIONSHIP MANAGEMENT =====

/**
 * Calculate customer relationship based on company prestige and market share
 * Uses a logarithmic scaling for prestige and a power-based scaling for market share
 * to create the desired relationship values:
 * - Zero prestige → ~0.1 relationship
 * - Prestige 100 → ~15 relationship
 * - Prestige 1000 → ~25 relationship
 * - 0.1% market share → ~1.16 divisor
 * - 1% market share → ~1.77 divisor
 * - 5% market share → ~4.4 divisor
 * - 10% market share → ~10 divisor
 */
export function calculateCustomerRelationship(marketShare: number, companyPrestige: number = 1): number {
  // Very low base relationship
  const baseRelationship = 0.1;
  
  // Prestige contribution with logarithmic scaling (diminishing returns)
  // This gives ~15 at prestige 100 and ~25 at prestige 1000
  const prestigeContribution = Math.log(companyPrestige + 1) * 3.3;
  
  // Market share impact - more aggressive formula for larger importers
  // Uses a combination of power functions to match the specified divisor values
  const marketShareImpact = 1 + 0.7 * Math.pow(marketShare, 0.25) + Math.pow(marketShare, 0.9);
  
  // Calculate final relationship
  // Higher prestige increases relationship
  // Higher market share decreases relationship
  const relationship = baseRelationship + (prestigeContribution / marketShareImpact);
  
  // Ensure relationship is at least the base value
  return Math.max(baseRelationship, relationship);
}

/**
 * Create a sophisticated customer with regional characteristics
 * Based on the legacy importer system but updated for TypeScript/React
 * 
 * @param companyPrestige - Current company prestige for relationship calculation
 * @returns Customer with realistic characteristics and behavioral multipliers
 */
export function createCustomer(companyPrestige: number = 1): Customer {
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
  
  
  return {
    id: uuidv4(),
    name: customerName,
    country: selectedCountry,
    customerType: selectedCustomerType,
    purchasingPower: regionalData.purchasingPower,
    wineTradition: regionalData.wineTradition,
    marketShare,
    priceMultiplier: finalPriceMultiplier,
    relationship: calculateCustomerRelationship(marketShare, companyPrestige)
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
    
    case 'Restaurant':
      // Use possessive format: "LastName's Restaurant" (US) or "LastName Restaurant" (Europe)
      if (country === 'United States') {
        return `${lastName}'s ${suffix}`;
      } else {
        return `${lastName} ${suffix}`;
      }
    
    case 'Wine Shop':
    case 'Chain Store':
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
 * @param companyPrestige - Current company prestige for relationship calculation
 * @returns Array of customers with diverse characteristics
 */
export function createMultipleCustomers(count: number, companyPrestige: number = 1): Customer[] {
  const customers: Customer[] = [];
  
  for (let i = 0; i < count; i++) {
    customers.push(createCustomer(companyPrestige));
  }
  
  return customers;
}


// ===== BULK CUSTOMER GENERATION (GAME INITIALIZATION) =====

/**
 * Generate market shares using calculateSteppedBalance
 * Creates heavily skewed distribution toward small values (0-1 range)
 * Converts to percentage (0-100%) and iterates until 100% total is reached
 */
function generateMarketSharesUntilFull(customerTypes: CustomerType[]): number[] {
  const marketShares: number[] = [];
  let totalMarketShare = 0;
  
  console.log('[Market Share Generation] Starting generation...');
  
  // Customer type market share multipliers
  const marketShareMultipliers: Record<CustomerType, number> = {
    'Restaurant': 0.12,      // Small restaurants
    'Private Collector': 0.08, // Very small private collectors
    'Wine Shop': 0.9,      // Medium wine shops
    'Chain Store': 1.0      // Large chain stores
  };
  
  // Keep generating customers until we reach 100% market share
  while (totalMarketShare < 100.0) {
    const randomValue1 = Math.random();
    const steppedValue1 = calculateSteppedBalance(randomValue1);
    
    let steppedValue: number;
    let numDraws = 1;
    
    // Determine how many draws based on the first value
    // Use 1-5 draws with minimum for entire range
    if (steppedValue1 >= 0.9) {
      numDraws = 5; // 0.9+ = 5 draws (rare)
    } else if (steppedValue1 >= 0.7) {
      numDraws = 4; // 0.7-0.9 = 4 draws (few)
    } else if (steppedValue1 >= 0.5) {
      numDraws = 3; // 0.5-0.7 = 3 draws (some)
    } else if (steppedValue1 >= 0.1) {
      numDraws = 2; // 0.1-0.3 = 2 draw (most)
    } else {
      numDraws = 1; // 0.0-0.1 = 1 draw (most)
    }
    
    // Perform additional draws if needed
    // Use minimum for entire range (1-5 draws)
    let minValue = steppedValue1;
    for (let i = 1; i < numDraws; i++) {
      const randomValue = Math.random();
      const additionalValue = calculateSteppedBalance(randomValue);
      minValue = Math.min(minValue, additionalValue);
    }
    
    steppedValue = minValue;
    
    // Get the customer type for this iteration
    const customerType = customerTypes[marketShares.length] || 'Restaurant';
    const customermultiplier = marketShareMultipliers[customerType];
    
    // Apply customer type multiplier to create realistic market shares
    const marketShare = steppedValue * customermultiplier * 100;
    
    // Add to our list
    marketShares.push(marketShare);
    totalMarketShare += marketShare;
    
    console.log(`[Market Share Generation] Customer ${marketShares.length} (${customerType}): ${marketShare.toFixed(1)}%, Total: ${totalMarketShare.toFixed(1)}%`);
    
    // Safety check to prevent infinite loops
    if (marketShares.length > 1000) {
      console.warn('[Market Share Generation] Reached maximum customer limit, stopping generation');
      break;
    }
  }
  
  // If we exceeded 100%, adjust the last customer's share
  if (totalMarketShare > 100.0) {
    const excess = totalMarketShare - 100.0;
    marketShares[marketShares.length - 1] -= excess;
    totalMarketShare = 100.0;
  }
  
  console.log(`[Market Share Generation] Final: ${marketShares.length} customers, Total: ${totalMarketShare.toFixed(1)}%`);
  
  return marketShares;
}

/**
 * Create a customer with specific parameters (used for bulk generation)
 */
function createCustomerWithSpecificData(
  country: CustomerCountry,
  customerType: CustomerType, 
  marketShare: number,
  companyPrestige: number = 1
): Customer {
  const regionalData = CUSTOMER_REGIONAL_DATA[country];
  const customerName = generateCustomerName(country, customerType);
  
  const customerTypeConfig = SALES_CONSTANTS.CUSTOMER_TYPES[customerType];
  
  // Generate individual price multiplier from range, influenced by customer characteristics
  const basePriceMultiplier = customerTypeConfig.priceMultiplierRange[0] + 
    (Math.random() * (customerTypeConfig.priceMultiplierRange[1] - customerTypeConfig.priceMultiplierRange[0]));
  
  // Apply customer characteristics to price multiplier - direct percentage multiplication
  const purchasingPowerMultiplier = regionalData.purchasingPower;
  const wineTraditionMultiplier = regionalData.wineTradition; 
  const marketShareMultiplier = 1 - marketShare; // Relative to 1
  
  const priceMultiplier = basePriceMultiplier * purchasingPowerMultiplier * wineTraditionMultiplier * marketShareMultiplier;
  
  // Ensure multiplier stays within reasonable bounds
  const finalPriceMultiplier = Math.max(0.1, Math.min(2.0, priceMultiplier));
  
  return {
    id: uuidv4(),
    name: customerName,
    country,
    customerType,
    purchasingPower: regionalData.purchasingPower,
    wineTradition: regionalData.wineTradition,
    marketShare,
    priceMultiplier: finalPriceMultiplier,
    relationship: calculateCustomerRelationship(marketShare, companyPrestige)
  };
}

/**
 * Generate customers for all countries based on the old iteration logic
 * Now uses the consolidated customer creation logic to avoid duplication
 */
export function generateCustomersForAllCountries(companyPrestige: number = 1): Customer[] {
  console.log('[Customer Generation] Starting customer generation...');
  const allCustomers: Customer[] = [];
  
  const countries = Object.keys(CUSTOMER_REGIONAL_DATA) as CustomerCountry[];
  
  countries.forEach(country => {
    console.log(`[Customer Generation] Generating customers for ${country}`);
    
    // Get customer type weights for this country
    const typeWeights = CUSTOMER_REGIONAL_DATA[country].customerTypeWeights;
    const types = Object.keys(typeWeights) as CustomerType[];
    
    // First, generate customer types for this country
    const customerTypes: CustomerType[] = [];
    let totalWeight = Object.values(typeWeights).reduce((sum, weight) => sum + weight, 0);
    
    console.log(`[Customer Type Generation] Weights for ${country}:`, typeWeights);
    console.log(`[Customer Type Generation] Total weight: ${totalWeight}`);
    
    // Generate enough customer types (we'll generate more as needed)
    for (let i = 0; i < 100; i++) { // Generate up to 100 customer types
      const randomValue = Math.random() * totalWeight;
      let cumulativeWeight = 0;
      let selectedType: CustomerType = 'Restaurant'; // fallback
      
      for (const type of types) {
        cumulativeWeight += typeWeights[type];
        if (randomValue <= cumulativeWeight) {
          selectedType = type;
          break;
        }
      }
      
      customerTypes.push(selectedType);
    }
    
    // Log the distribution of generated customer types
    const typeCounts = customerTypes.reduce((counts, type) => {
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {} as Record<CustomerType, number>);
    
    console.log(`[Customer Type Generation] Generated type distribution:`, typeCounts);
    
    // Generate market shares with customer type modifiers
    const marketShares = generateMarketSharesUntilFull(customerTypes);
    const customerCount = marketShares.length;
    
    console.log(`[Customer Generation] Generated ${customerCount} customers for ${country} with total market share: ${marketShares.reduce((a, b) => a + b, 0).toFixed(2)}%`);
    
    // Create customers for this country
    for (let i = 0; i < customerCount; i++) {
      const selectedType = customerTypes[i];
      
      // Use the consolidated customer creation logic
      const marketShare = marketShares[i] / 100; // Convert from percentage to 0-1 scale
      const customer = createCustomerWithSpecificData(country, selectedType, marketShare, companyPrestige);
      
      allCustomers.push(customer);
    }
  });
  
  // Calculate and log the initial total relationship sum
  const initialTotalRelationship = allCustomers.reduce((sum, customer) => sum + (customer.relationship || 0), 0);
  
  console.log('[Customer Generation] Generation complete:', {
    totalCustomers: allCustomers.length,
    totalRelationship: initialTotalRelationship,
    averageRelationship: initialTotalRelationship / allCustomers.length
  });
  
  return allCustomers;
}

/**
 * Update all customer relationships based on current company prestige
 */
export function updateAllCustomerRelationships(customers: Customer[], companyPrestige: number): Customer[] {
  return customers.map(customer => ({
    ...customer,
    relationship: calculateCustomerRelationship(customer.marketShare, companyPrestige)
  }));
}

/**
 * Initialize customers for the game - either load existing or generate new ones
 */
export async function initializeCustomers(companyPrestige: number = 1): Promise<Customer[]> {
  console.log('[Customer Init] Checking for existing customers...');
  
  try {
    // Check if customers already exist
    const customersExist = await checkCustomersExist();
    
    if (customersExist) {
      console.log('[Customer Init] Found existing customers, loading from database...');
      const existingCustomers = await loadCustomers();
      
      if (existingCustomers && existingCustomers.length > 0) {
        console.log(`[Customer Init] Successfully loaded ${existingCustomers.length} existing customers`);
        return existingCustomers;
      }
    }
    
    // No existing customers found, generate new ones
    console.log('[Customer Init] No existing customers found, generating new ones...');
    const newCustomers = generateCustomersForAllCountries(companyPrestige);
    
    // Save to database
    await saveCustomers(newCustomers);
    
    console.log(`[Customer Init] Successfully initialized ${newCustomers.length} customers`);
    return newCustomers;
    
  } catch (error) {
    console.error('[Customer Init] Failed to initialize customers:', error);
    // Fallback: return generated customers without saving
    console.log('[Customer Init] Using fallback generation without database save');
    return generateCustomersForAllCountries(companyPrestige);
  }
}

/**
 * Update all customer relationships when company prestige changes
 */
export async function updateCustomerRelationshipsForPrestige(companyPrestige: number): Promise<Customer[]> {
  try {
    console.log(`[Customer Update] Updating relationships for prestige: ${companyPrestige}`);
    
    // Load current customers
    const currentCustomers = await loadCustomers();
    
    if (!currentCustomers || currentCustomers.length === 0) {
      console.log('[Customer Update] No customers found, initializing new ones');
      return await initializeCustomers(companyPrestige);
    }
    
    // Update relationships
    const updatedCustomers = updateAllCustomerRelationships(currentCustomers, companyPrestige);
    
    // Save updated relationships back to database
    await updateCustomerRelationships(updatedCustomers);
    
    console.log(`[Customer Update] Successfully updated ${updatedCustomers.length} customer relationships`);
    return updatedCustomers;
    
  } catch (error) {
    console.error('[Customer Update] Failed to update customer relationships:', error);
    // Fallback: reinitialize
    return await initializeCustomers(companyPrestige);
  }
}

/**
 * Get all customers (loads from database)
 */
export async function getAllCustomers(): Promise<Customer[]> {
  try {
    const customers = await loadCustomers();
    return customers || [];
  } catch (error) {
    console.error('[Customer Service] Failed to get customers:', error);
    return [];
  }
}

/**
 * Get country flag code for display purposes
 * Uses the existing utility function to avoid duplication
 */
export function getCountryCode(country: CustomerCountry): string {
  return getCountryCodeForFlag(country);
}
