// Custom hook for managing customer data in winepedia components
import { useCallback, useState, useEffect } from 'react';
import { useGameStateWithData, useGameUpdates } from '@/hooks';
import { getAllCustomers } from '@/lib/services';
import { Customer } from '@/lib/types/types';
import { loadFormattedRelationshipBreakdown } from '@/lib/utils';
import { calculateRelationshipBreakdown } from '@/lib/services/sales/relationshipService';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

/**
 * Custom hook for customer data management with relationship breakdowns
 * Used by CustomersTab and other components that need customer information
 */
export function useCustomerData() {
  const [relationshipBreakdowns, setRelationshipBreakdowns] = useState<{[key: string]: string}>({});
  const [computedRelationships, setComputedRelationships] = useState<{[key: string]: number}>({});

  // Helper function to create company-scoped customer key
  const getCustomerKey = useCallback((customerId: string): string => {
    try {
      const companyId = getCurrentCompanyId();
      return `${companyId}:${customerId}`;
    } catch (error) {
      return customerId;
    }
  }, []);

  // Use consolidated hook for reactive customer loading
  const loadCustomersData = useCallback(async () => {
    return await getAllCustomers();
  }, []);

  const customers = useGameStateWithData(loadCustomersData, []);

  // Clear relationship breakdown caches on game updates (e.g., after sales)
  const { subscribe } = useGameUpdates();
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setRelationshipBreakdowns({});
      setComputedRelationships({});
    });
    return () => { unsubscribe(); };
  }, [subscribe]);

  // Load relationship breakdown for a customer on-demand (memoized)
  const loadRelationshipBreakdown = useCallback(async (customer: Customer) => {
    try {
      const breakdown = await calculateRelationshipBreakdown(customer);
      const formattedBreakdown = await loadFormattedRelationshipBreakdown(customer);
      const customerKey = getCustomerKey(customer.id);
      
      setRelationshipBreakdowns(prev => ({
        ...prev,
        [customerKey]: formattedBreakdown
      }));
      
      setComputedRelationships(prev => ({
        ...prev,
        [customerKey]: breakdown.totalRelationship
      }));
    } catch (error) {
      console.error('Error loading relationship breakdown:', error);
    }
  }, [getCustomerKey]);

  return {
    customers,
    relationshipBreakdowns,
    computedRelationships,
    getCustomerKey,
    loadRelationshipBreakdown
  };
}
