// Customer generation service - creates sophisticated customers with regional characteristics
import { v4 as uuidv4 } from 'uuid';
import { Customer, CustomerCountry, CustomerType } from '../../types/types';
import { CUSTOMER_REGIONAL_DATA, SALES_CONSTANTS, CUSTOMER_MARKET_SHARE_MULTIPLIERS } from '../../constants/constants';
import { NAMES } from '../../constants/namesConstants';
import { calculateSkewedMultiplier, NormalizeScrewed1000To01WithTail } from '../../utils/calculator';
import { saveCustomers, loadCustomers, updateCustomerRelationships, checkCustomersExist, loadActiveCustomers } from '../../database/customers/customerDB';
import { calculateRelationshipBreakdown } from './relationshipService';
import { loadFormattedRelationshipBreakdown } from '../../utils/utils';

// ===== CUSTOMER RELATIONSHIP MANAGEMENT =====

/**
 * Calculate customer relationship based on company prestige and market share
 * Uses normalized prestige scaling and power-based scaling for market share
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
  
  // Normalize prestige to 0-1 scale using consistent function
  const normalizedPrestige = NormalizeScrewed1000To01WithTail(companyPrestige);
  
  // Scale normalized prestige to match desired relationship values
  // 0 prestige → 0 contribution, 1000+ prestige → ~25 contribution
  const prestigeContribution = normalizedPrestige * 25;
  
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
 * Generate realistic customer names based on country and order type
 * Uses regional name databases with appropriate business suffixes
 */
function generateCustomerName(country: CustomerCountry, customerType: CustomerType): string {
  const nameData = NAMES[country];
  
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
 * Generate a random customer type based on regional weights
 */
function selectRandomCustomerType(country: CustomerCountry): CustomerType {
  const typeWeights = CUSTOMER_REGIONAL_DATA[country].customerTypeWeights;
  const types = Object.keys(typeWeights) as CustomerType[];
  const totalWeight = Object.values(typeWeights).reduce((sum, weight) => sum + weight, 0);
  
  const randomValue = Math.random() * totalWeight;
  let cumulativeWeight = 0;
  
  for (const type of types) {
    cumulativeWeight += typeWeights[type];
    if (randomValue <= cumulativeWeight) {
      return type;
    }
  }
  
  return 'Restaurant'; // fallback
}

/**
 * Generate customers for all countries based on the old iteration logic
 * Now uses the consolidated customer creation logic to avoid duplication
 */
export function generateCustomersForAllCountries(companyPrestige: number = 1): Customer[] {
  const allCustomers: Customer[] = [];
  
  const countries = Object.keys(CUSTOMER_REGIONAL_DATA) as CustomerCountry[];
  
  countries.forEach(country => {
    // Generate customer types dynamically as we create customers
    const customerTypes: CustomerType[] = [];
    
    // Generate market shares until we reach 100% for this country
    let totalMarketShare = 0;
    const marketShares: number[] = [];
    
    // Keep generating customers until we reach 100% market share for this country
    while (totalMarketShare < 100.0) {
      // Select customer type dynamically for each customer
      const customerType = selectRandomCustomerType(country);
      customerTypes.push(customerType);
      
      // Generate market share for this customer
      const randomValue1 = Math.random();
      const steppedValue1 = calculateSkewedMultiplier(randomValue1);
      
      let numDraws = 1;
      if (steppedValue1 >= 0.9) {
        numDraws = 5;
      } else if (steppedValue1 >= 0.7) {
        numDraws = 4;
      } else if (steppedValue1 >= 0.5) {
        numDraws = 3;
      } else if (steppedValue1 >= 0.1) {
        numDraws = 2;
      } else {
        numDraws = 1;
      }
      
      // Perform additional draws if needed
      let minValue = steppedValue1;
      for (let i = 1; i < numDraws; i++) {
        const randomValue = Math.random();
        const additionalValue = calculateSkewedMultiplier(randomValue);
        minValue = Math.min(minValue, additionalValue);
      }
      
      // Use market share multiplier from constants
      const customermultiplier = CUSTOMER_MARKET_SHARE_MULTIPLIERS[customerType];
      const marketShare = minValue * customermultiplier * 100;
      
      marketShares.push(marketShare);
      totalMarketShare += marketShare;
      
      // Safety check to prevent infinite loops
      if (marketShares.length > 1000) {
        console.warn(`[Customer Generation] Safety limit reached for ${country}: ${marketShares.length} customers`);
        break;
      }
    }
    
    // If we exceeded 100%, adjust the last customer's share
    if (totalMarketShare > 100.0) {
      const excess = totalMarketShare - 100.0;
      marketShares[marketShares.length - 1] -= excess;
      totalMarketShare = 100.0;
    }
    
    // Create customers for this country
    for (let i = 0; i < marketShares.length; i++) {
      const selectedType = customerTypes[i];
      const marketShare = marketShares[i] / 100; // Convert from percentage to 0-1 scale
      const customer = createCustomerWithSpecificData(country, selectedType, marketShare, companyPrestige);
      allCustomers.push(customer);
    }
  });
  
  return allCustomers;
}

/**
 * Initialize customers for the game - either load existing or generate new ones
 * Customers are created ONCE per company and never recreated on reload
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
    
    // No existing customers found, generate new ones (first time only)
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
 * Pre-load all customer relationships in the background during game initialization
 * This warms up the cache so "Show All Customers" loads instantly
 */
export async function preloadAllCustomerRelationships(): Promise<void> {
  try {
    const customers = await getAllCustomers();
    if (customers.length === 0) return;
    
    // Pre-load relationships for all customers in batches to avoid blocking
    // Process in smaller batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      // Process batch in parallel
      await Promise.allSettled(
        batch.map(async (customer) => {
          try {
            // Calculate and cache relationship breakdown
            await calculateRelationshipBreakdown(customer);
            // Also pre-load formatted breakdown
            await loadFormattedRelationshipBreakdown(customer);
          } catch (error) {
            // Silently fail for individual customers - don't block initialization
            console.debug(`[Customer Preload] Failed to preload relationship for ${customer.name}:`, error);
          }
        })
      );
      
      // Small delay between batches to avoid blocking the UI
      if (i + batchSize < customers.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  } catch (error) {
    console.error('[Customer Preload] Failed to preload customer relationships:', error);
    // Don't throw - this is a background optimization, shouldn't block initialization
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

