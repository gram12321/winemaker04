// Custom hook for managing customer data in winepedia components
import { useCallback, useState, useEffect } from 'react';
import { useGameStateWithData, useGameUpdates } from '@/hooks';
import { getAllCustomers } from '@/lib/services';
import { loadActiveCustomers } from '@/lib/database/customers/customerDB';
import { Customer } from '@/lib/types/types';
import { loadFormattedRelationshipBreakdown } from '@/lib/utils';
import { calculateRelationshipBreakdown, clearRelationshipBreakdownCache } from '@/lib/services';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

/**
 * Custom hook for customer data management with smart caching and lazy loading
 * Used by CustomersTab and other components that need customer information
 */
export function useCustomerData(activeCustomersOnly: boolean = false) {
  const [relationshipBreakdowns, setRelationshipBreakdowns] = useState<{[key: string]: string}>({});
  const [computedRelationships, setComputedRelationships] = useState<{[key: string]: number}>({});
  const [relationshipBoosts, setRelationshipBoosts] = useState<{[key: string]: number}>({});
  const [boostDetails, setBoostDetails] = useState<{[key: string]: Array<{
    description: string;
    amount: number;
    weeksAgo: number;
    decayedAmount: number;
  }>}>({});
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isLoadingAllCustomers, setIsLoadingAllCustomers] = useState<boolean>(false);

  // Helper function to create company-scoped customer key
  const getCustomerKey = useCallback((customerId: string): string => {
    try {
      const companyId = getCurrentCompanyId();
      return `${companyId}:${customerId}`;
    } catch (error) {
      return customerId;
    }
  }, []);

  // Load active customers immediately (fast, relevant data)
  const loadActiveCustomersData = useCallback(async () => {
    return await loadActiveCustomers();
  }, []);

  const activeCustomers = useGameStateWithData(loadActiveCustomersData, []);

  // Lazy load all customers when needed
  const loadAllCustomersData = useCallback(async () => {
    if (allCustomers.length > 0) return allCustomers; // Already loaded
    
    setIsLoadingAllCustomers(true);
    try {
      const customers = await getAllCustomers();
      setAllCustomers(customers);
      return customers;
    } catch (error) {
      console.error('Error loading all customers:', error);
      return [];
    } finally {
      setIsLoadingAllCustomers(false);
    }
  }, [allCustomers.length]);

  // Pre-load relationship breakdowns for active customers on mount
  const loadActiveCustomerRelationships = useCallback(async () => {
    if (activeCustomers.length === 0) return;
    
    const formattedBreakdowns: {[key: string]: string} = {};
    const computedRels: {[key: string]: number} = {};
    const boosts: {[key: string]: number} = {};
    const details: {[key: string]: Array<{
      description: string;
      amount: number;
      weeksAgo: number;
      decayedAmount: number;
    }>} = {};
    
    for (const customer of activeCustomers) {
      const customerKey = getCustomerKey(customer.id);
      
      // Only load if not already cached
      if (!computedRelationships[customerKey]) {
        try {
          const breakdown = await calculateRelationshipBreakdown(customer);
          const formattedBreakdown = await loadFormattedRelationshipBreakdown(customer);
          
          formattedBreakdowns[customerKey] = formattedBreakdown;
          computedRels[customerKey] = breakdown.totalRelationship;
          boosts[customerKey] = breakdown.relationshipBoosts;
          details[customerKey] = breakdown.factors.boostDetails;
        } catch (error) {
          console.error(`Error loading relationship for ${customer.name}:`, error);
        }
      }
    }
    
    if (Object.keys(formattedBreakdowns).length > 0) {
      setRelationshipBreakdowns(prev => ({ ...prev, ...formattedBreakdowns }));
      setComputedRelationships(prev => ({ ...prev, ...computedRels }));
      setRelationshipBoosts(prev => ({ ...prev, ...boosts }));
      setBoostDetails(prev => ({ ...prev, ...details }));
    }
  }, [activeCustomers, getCustomerKey]); // Removed computedRelationships from dependencies

  // Load relationship breakdown for a customer on-demand (with cache check)
  const loadRelationshipBreakdown = useCallback(async (customer: Customer) => {
    const customerKey = getCustomerKey(customer.id);
    
    // Check if already cached
    if (relationshipBreakdowns[customerKey] && computedRelationships[customerKey]) {
      return;
    }
    
    try {
      const breakdown = await calculateRelationshipBreakdown(customer);
      const formattedBreakdown = await loadFormattedRelationshipBreakdown(customer);
      
      setRelationshipBreakdowns(prev => ({
        ...prev,
        [customerKey]: formattedBreakdown
      }));
      
      setComputedRelationships(prev => ({
        ...prev,
        [customerKey]: breakdown.totalRelationship
      }));

      setRelationshipBoosts(prev => ({
        ...prev,
        [customerKey]: breakdown.relationshipBoosts
      }));

      setBoostDetails(prev => ({
        ...prev,
        [customerKey]: breakdown.factors.boostDetails
      }));
    } catch (error) {
      console.error('Error loading relationship breakdown:', error);
    }
  }, [getCustomerKey]); // Removed state dependencies

  // Load all customers and their relationships when needed
  const loadAllCustomersWithRelationships = useCallback(async () => {
    const customers = await loadAllCustomersData();
    if (customers.length === 0) return;
    
    const formattedBreakdowns: {[key: string]: string} = {};
    const computedRels: {[key: string]: number} = {};
    const boosts: {[key: string]: number} = {};
    const details: {[key: string]: Array<{
      description: string;
      amount: number;
      weeksAgo: number;
      decayedAmount: number;
    }>} = {};
    
    for (const customer of customers) {
      const customerKey = getCustomerKey(customer.id);
      
      // Only load if not already cached
      if (!computedRelationships[customerKey]) {
        try {
          const breakdown = await calculateRelationshipBreakdown(customer);
          const formattedBreakdown = await loadFormattedRelationshipBreakdown(customer);
          
          formattedBreakdowns[customerKey] = formattedBreakdown;
          computedRels[customerKey] = breakdown.totalRelationship;
          boosts[customerKey] = breakdown.relationshipBoosts;
          details[customerKey] = breakdown.factors.boostDetails;
        } catch (error) {
          console.error(`Error loading relationship for ${customer.name}:`, error);
        }
      }
    }
    
    if (Object.keys(formattedBreakdowns).length > 0) {
      setRelationshipBreakdowns(prev => ({ ...prev, ...formattedBreakdowns }));
      setComputedRelationships(prev => ({ ...prev, ...computedRels }));
      setRelationshipBoosts(prev => ({ ...prev, ...boosts }));
      setBoostDetails(prev => ({ ...prev, ...details }));
    }
  }, [loadAllCustomersData, getCustomerKey]); // Removed computedRelationships from dependencies

  // Clear relationship breakdown caches on game updates (e.g., after sales)
  const { subscribe } = useGameUpdates();
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      clearRelationshipBreakdownCache();
      setRelationshipBreakdowns({});
      setComputedRelationships({});
      setRelationshipBoosts({});
      setBoostDetails({});
      setAllCustomers([]); // Clear all customers cache
    });
    return () => { unsubscribe(); };
  }, [subscribe]);

  // Pre-load active customer relationships on mount
  useEffect(() => {
    if (activeCustomers.length > 0) {
      loadActiveCustomerRelationships();
    }
  }, [activeCustomers.length]); // Only depend on activeCustomers.length, not the function

  // Determine which customers to show
  const customers = activeCustomersOnly ? activeCustomers : allCustomers;

  return {
    customers,
    activeCustomers,
    allCustomers,
    relationshipBreakdowns,
    computedRelationships,
    relationshipBoosts,
    boostDetails,
    getCustomerKey,
    loadRelationshipBreakdown,
    loadAllCustomersWithRelationships,
    isLoadingAllCustomers
  };
}
