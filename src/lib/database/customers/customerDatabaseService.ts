// Customer database service - handles Supabase CRUD operations for customers
import { supabase } from '../supabase';
import { Customer } from '../../types/types';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { getCompanyQuery } from '../../utils/companyUtils';

/**
 * Save customers to database for a specific company
 */
export async function saveCustomers(customers: Customer[]): Promise<void> {
  try {
    // Clear dependent company_customers rows first to avoid FK violations
    const { error: deleteCompanyCustomersError } = await supabase
      .from('company_customers')
      .delete()
      .eq('company_id', getCurrentCompanyId());

    if (deleteCompanyCustomersError) {
      console.error('Error clearing existing company_customers:', deleteCompanyCustomersError);
      throw deleteCompanyCustomersError;
    }

    // Clear existing customers for this company
    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .eq('company_id', getCurrentCompanyId());

    if (deleteError) {
      console.error('Error clearing existing customers:', deleteError);
      throw deleteError;
    }

    // Insert new customers (map to database format)
    const customersForDB = customers.map(customer => ({
      id: customer.id,
      company_id: getCurrentCompanyId(),
      name: customer.name,
      country: customer.country,
      customer_type: customer.customerType,
      market_share: customer.marketShare,
      purchasing_power: customer.purchasingPower,
      wine_tradition: customer.wineTradition,
      price_multiplier: customer.priceMultiplier,
      relationship: customer.relationship || 0,
      active_customer: customer.activeCustomer || false
    }));

    const { error: insertError } = await supabase
      .from('customers')
      .insert(customersForDB);

    if (insertError) {
      console.error('Error saving customers:', insertError);
      throw insertError;
    }

  } catch (error) {
    console.error('Failed to save customers:', error);
    throw error;
  }
}

/**
 * Load customers from database for a specific company
 */
export async function loadCustomers(): Promise<Customer[] | null> {
  try {
    const { data, error } = await getCompanyQuery('customers')
      .order('country', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading customers:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return null;
    }

    
    // Map from database format to Customer interface
    const customers: Customer[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      country: row.country,
      customerType: row.customer_type,
      marketShare: row.market_share,
      purchasingPower: row.purchasing_power,
      wineTradition: row.wine_tradition,
      priceMultiplier: row.price_multiplier,
      relationship: row.relationship,
      activeCustomer: row.active_customer || false
    }));
    
    return customers;
  } catch (error) {
    console.error('Failed to load customers:', error);
    return null;
  }
}

/**
 * Update customer relationships based on current company prestige
 */
export async function updateCustomerRelationships(customers: Customer[]): Promise<void> {
  try {
    const updatePromises = customers.map(customer => 
      supabase
        .from('customers')
        .update({ relationship: customer.relationship })
        .eq('id', customer.id)
    );

    const results = await Promise.all(updatePromises);
    
    // Check for errors
    const errors = results.filter(result => result.error).map(result => result.error);
    if (errors.length > 0) {
      console.error('Errors updating customer relationships:', errors);
      throw new Error(`Failed to update ${errors.length} customer relationships`);
    }

  } catch (error) {
    console.error('Failed to update customer relationships:', error);
    throw error;
  }
}

/**
 * Activate a customer (mark them as active and store their initial relationship)
 * Updates both the customers table and creates a company_customers record
 */
export async function activateCustomer(customerId: string, initialRelationship: number): Promise<void> {
  try {
    // Update the main customers table
    const { error: updateError } = await supabase
      .from('customers')
      .update({ 
        active_customer: true,
        relationship: initialRelationship
      })
      .eq('id', customerId)
      .eq('company_id', getCurrentCompanyId());

    if (updateError) {
      console.error('Error updating customer in customers table:', updateError);
      throw updateError;
    }

    // Create or update the company_customers record for performance optimization
    const { error: upsertError } = await supabase
      .from('company_customers')
      .upsert({
        company_id: getCurrentCompanyId(),
        customer_id: customerId,
        relationship: initialRelationship,
        active_customer: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'company_id,customer_id'
      });

    if (upsertError) {
      console.error('Error upserting customer in company_customers table:', upsertError);
      throw upsertError;
    }
  } catch (error) {
    console.error('Failed to activate customer:', error);
    throw error;
  }
}

/**
 * Load only active customers (for performance optimization)
 * Uses the company_customers table for fast lookups
 */
export async function loadActiveCustomers(): Promise<Customer[]> {
  try {
    // Join customers with company_customers for active customers only
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        company_customers!inner(relationship, active_customer)
      `)
      .eq('company_id', getCurrentCompanyId())
      .eq('company_customers.active_customer', true)
      .order('country', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading active customers:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map from database format to Customer interface
    const customers: Customer[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      country: row.country,
      customerType: row.customer_type,
      marketShare: row.market_share,
      purchasingPower: row.purchasing_power,
      wineTradition: row.wine_tradition,
      priceMultiplier: row.price_multiplier,
      relationship: row.company_customers.relationship,
      activeCustomer: row.company_customers.active_customer
    }));
    
    return customers;
  } catch (error) {
    console.error('Failed to load active customers:', error);
    return [];
  }
}

/**
 * Check if customers exist for a specific company
 */
export async function checkCustomersExist(): Promise<boolean> {
  try {
    const companyId = getCurrentCompanyId();
    console.log(`[Customer Check] Checking if customers exist for company: ${companyId}`);
    
    const { data, error } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);

    if (error) {
      console.error('Error checking customers existence:', error);
      return false;
    }

    const count = data?.length || 0;
    const exists = count > 0;
    console.log(`[Customer Check] Found ${count} customers for company ${companyId}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    return exists;
  } catch (error) {
    console.error('Failed to check customers existence:', error);
    return false;
  }
}
