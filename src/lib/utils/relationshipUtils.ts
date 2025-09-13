// Shared utilities for customer relationship display
import { Customer } from '../types';
import { calculateRelationshipBreakdown, formatRelationshipBreakdown } from '../database/relationshipBreakdownService';

/**
 * Load and format relationship breakdown for UI display
 * Handles the common pattern used in Sales.tsx and Winepedia.tsx
 */
export async function loadFormattedRelationshipBreakdown(customer: Customer): Promise<string> {
  try {
    const breakdown = await calculateRelationshipBreakdown(customer);
    return formatRelationshipBreakdown(breakdown);
  } catch (error) {
    console.error('Error loading relationship breakdown:', error);
    return 'Failed to load relationship breakdown';
  }
}

/**
 * Create minimal customer object for relationship breakdown from order data
 * Used in Sales.tsx where we only have order information
 */
export function createCustomerFromOrderData(
  customerId: string,
  customerName: string,
  customerCountry: any,
  customerType: any,
  customerRelationship?: number
): Customer {
  return {
    id: customerId,
    name: customerName,
    country: customerCountry,
    customerType,
    marketShare: 0.01, // Default value, will be overridden by actual customer data
    purchasingPower: 1.0,
    wineTradition: 1.0,
    priceMultiplier: 1.0,
    relationship: customerRelationship
  };
}
