// Customer database service - handles Supabase CRUD operations for customers
import { supabase } from './supabase';
import { Customer } from '../types';

/**
 * Save customers to database
 */
export async function saveCustomers(customers: Customer[]): Promise<void> {
  try {
    // Clear existing customers first
    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .gte('created_at', '1970-01-01'); // Delete all rows (since all rows have created_at >= 1970)

    if (deleteError) {
      console.error('Error clearing existing customers:', deleteError);
      throw deleteError;
    }

    // Insert new customers (map to database format)
    const customersForDB = customers.map(customer => ({
      id: customer.id,
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
 * Load customers from database
 */
export async function loadCustomers(): Promise<Customer[] | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
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
    const customers: Customer[] = data.map(row => ({
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
 */
export async function activateCustomer(customerId: string, initialRelationship: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('customers')
      .update({ 
        active_customer: true,
        relationship: initialRelationship
      })
      .eq('id', customerId);

    if (error) {
      console.error('Error activating customer:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to activate customer:', error);
    throw error;
  }
}

/**
 * Load only active customers (for performance optimization)
 */
export async function loadActiveCustomers(): Promise<Customer[]> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('active_customer', true)
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
    const customers: Customer[] = data.map(row => ({
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
    console.error('Failed to load active customers:', error);
    return [];
  }
}

/**
 * Check if customers table exists and is populated
 */
export async function checkCustomersExist(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('Error checking customers existence:', error);
      return false;
    }

    const count = data?.length || 0;
    return count > 0;
  } catch (error) {
    console.error('Failed to check customers existence:', error);
    return false;
  }
}
