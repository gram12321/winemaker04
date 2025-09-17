// Customer generation service - creates sophisticated customers with regional characteristics
import { v4 as uuidv4 } from 'uuid';
import { Customer, CustomerCountry, CustomerType } from '../../types';
import { CUSTOMER_REGIONAL_DATA, CUSTOMER_NAMES, SALES_CONSTANTS } from '../../constants';
import { getCountryCodeForFlag } from '../../utils/utils';
import { calculateSkewedMultiplier } from '../../utils/calculator';
import { 
  saveCustomers, 
  loadCustomers, 
  updateCustomerRelationships, 
  checkCustomersExist,
  loadActiveCustomers
} from '../../database/customerDatabaseService';

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

// Note: calculateCustomerRelationshipWithBoosts function removed as it's now redundant
// Fresh relationships are calculated directly in generateOrder.ts using current prestige


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







// ===== BULK CUSTOMER GENERATION (GAME INITIALIZATION) =====

/**
 * Generate market shares using calculateSkewedMultiplier
 * Creates heavily skewed distribution toward small values (0-1 range)
 * Converts to percentage (0-100%) and iterates until 100% total is reached
 */
function generateMarketSharesUntilFull(customerTypes: CustomerType[]): number[] {
  const marketShares: number[] = [];
  let totalMarketShare = 0;
  
  
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
    const steppedValue1 = calculateSkewedMultiplier(randomValue1);
    
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
      const additionalValue = calculateSkewedMultiplier(randomValue);
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
    
    // Safety check to prevent infinite loops
    if (marketShares.length > 1000) {
      break;
    }
  }
  
  // If we exceeded 100%, adjust the last customer's share
  if (totalMarketShare > 100.0) {
    const excess = totalMarketShare - 100.0;
    marketShares[marketShares.length - 1] -= excess;
    totalMarketShare = 100.0;
  }
  
  
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
    relationship: calculateCustomerRelationship(marketShare, companyPrestige),
    activeCustomer: false // Default to inactive until first order
  };
}

/**
 * Generate customers for all countries based on the old iteration logic
 * Now uses the consolidated customer creation logic to avoid duplication
 */
export function generateCustomersForAllCountries(companyPrestige: number = 1): Customer[] {
  const allCustomers: Customer[] = [];
  
  const countries = Object.keys(CUSTOMER_REGIONAL_DATA) as CustomerCountry[];
  
  countries.forEach(country => {
    
    // Get customer type weights for this country
    const typeWeights = CUSTOMER_REGIONAL_DATA[country].customerTypeWeights;
    const types = Object.keys(typeWeights) as CustomerType[];
    
    // First, generate customer types for this country
    const customerTypes: CustomerType[] = [];
    let totalWeight = Object.values(typeWeights).reduce((sum, weight) => sum + weight, 0);
    
    
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
    
    
    // Generate market shares with customer type modifiers
    const marketShares = generateMarketSharesUntilFull(customerTypes);
    const customerCount = marketShares.length;
    
    
    // Create customers for this country
    for (let i = 0; i < customerCount; i++) {
      const selectedType = customerTypes[i];
      
      // Use the consolidated customer creation logic
      const marketShare = marketShares[i] / 100; // Convert from percentage to 0-1 scale
      const customer = createCustomerWithSpecificData(country, selectedType, marketShare, companyPrestige);
      
      allCustomers.push(customer);
    }
  });
  
  
  return allCustomers;
}

/**
 * Initialize customers for the game - either load existing or generate new ones
 */
export async function initializeCustomers(companyPrestige: number = 1): Promise<Customer[]> {
  
  try {
    // Check if customers already exist for this company
    const customersExist = await checkCustomersExist();
    
    if (customersExist) {
      const existingCustomers = await loadCustomers();
      
      if (existingCustomers && existingCustomers.length > 0) {
        return existingCustomers;
      }
    }
    
    // No existing customers found, generate new ones
    const newCustomers = generateCustomersForAllCountries(companyPrestige);
    
    // Save to database for this company
    await saveCustomers(newCustomers);
    
    return newCustomers;
    
  } catch (error) {
    console.error('[Customer Init] Failed to initialize customers:', error);
    // Fallback: return generated customers without saving
    return generateCustomersForAllCountries(companyPrestige);
  }
}

/**
 * Update only active customer relationships when company prestige changes
 * This dramatically improves performance by only updating customers who have actually placed orders
 */
export async function updateCustomerRelationshipsForPrestige(companyPrestige: number): Promise<Customer[]> {
  try {
    // Updating relationships for active customers only
    
    // Load only active customers (customers who have placed orders)
    const activeCustomers = await loadActiveCustomers();
    
    if (activeCustomers.length === 0) {
      // No active customers found, skipping relationship updates
      return [];
    }
    
    // Updating relationships for active customers
    
    // Update relationships only for active customers
    const updatedCustomers = activeCustomers.map(customer => ({
      ...customer,
      relationship: calculateCustomerRelationship(customer.marketShare, companyPrestige)
    }));
    
    // Save updated relationships back to database
    await updateCustomerRelationships(updatedCustomers);
    
    // Successfully updated active customer relationships
    return updatedCustomers;
    
  } catch (error) {
    console.error('[Customer Update] Failed to update customer relationships:', error);
    throw error; // Don't fallback to reinitializing all customers
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
