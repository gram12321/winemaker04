// Table names for legacy operations
import { supabase } from '../core/supabase';
import { WineOrder, CustomerType, Season } from '../../types/types';
import { getCompanyQuery, getCurrentCompanyId } from '../../utils/companyUtils';

const WINE_ORDERS_TABLE = 'wine_orders';

// ===== WINE ORDER OPERATIONS =====

export const saveWineOrder = async (order: WineOrder): Promise<void> => {
  try {
    const { error } = await supabase
      .from(WINE_ORDERS_TABLE)
      .upsert({
        id: order.id,
        company_id: getCurrentCompanyId(),
        wine_batch_id: order.wineBatchId,
        wine_name: order.wineName,
        order_type: order.customerType,
        customer_id: order.customerId,
        customer_name: order.customerName,
        customer_country: order.customerCountry,
        requested_quantity: order.requestedQuantity,
        offered_price: order.offeredPrice,
        total_value: order.totalValue,
        fulfillable_quantity: order.fulfillableQuantity,
        fulfillable_value: order.fulfillableValue,
        asking_price_at_order_time: order.askingPriceAtOrderTime,
        status: order.status,
        ordered_week: order.orderedAt.week,
        ordered_season: order.orderedAt.season,
        ordered_year: order.orderedAt.year,
        calculation_data: order.calculationData || null
      });

    if (error) throw error;
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
};

export const loadWineOrders = async (status?: string): Promise<WineOrder[]> => {
  try {
    // First, load orders without the join to avoid Supabase query issues
    let query = getCompanyQuery(WINE_ORDERS_TABLE);
    
    // Filter by status if provided, otherwise load all orders
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: ordersData, error: ordersError } = await query.order('created_at', { ascending: true });

    if (ordersError) throw ordersError;

    // Load customer relationships separately (filtered by company)
    const { data: customersData, error: customersError } = await getCompanyQuery('customers')
      .select('id, relationship');

    // Create a map of customer relationships for quick lookup
    const customerRelationships = new Map();
    if (!customersError && customersData) {
      customersData.forEach(customer => {
        customerRelationships.set(customer.id, customer.relationship || 0);
      });
    }

    return (ordersData || []).map(row => ({
      id: row.id,
      wineBatchId: row.wine_batch_id,
      wineName: row.wine_name,
      customerType: row.order_type as CustomerType,
      customerId: row.customer_id || '',
      customerName: row.customer_name || '',
      customerCountry: row.customer_country || '',
      customerRelationship: customerRelationships.get(row.customer_id) || 0,
      requestedQuantity: row.requested_quantity,
      offeredPrice: row.offered_price,
      totalValue: row.total_value,
      fulfillableQuantity: row.fulfillable_quantity,
      fulfillableValue: row.fulfillable_value,
      askingPriceAtOrderTime: row.asking_price_at_order_time,
      status: row.status,
      orderedAt: {
        week: row.ordered_week || 1,
        season: (row.ordered_season || 'Spring') as Season,
        year: row.ordered_year || 2024
      },
      calculationData: row.calculation_data || undefined
    }));
  } catch (error) {
    return [];
  }
};

export const getOrderById = async (orderId: string): Promise<WineOrder | null> => {
  try {
    const orders = await loadWineOrders();
    return orders.find(o => o.id === orderId) || null;
  } catch (error) {
    console.error('Error getting order by ID:', error);
    return null;
  }
};

export const updateWineOrderStatus = async (orderId: string, status: 'fulfilled' | 'rejected'): Promise<void> => {
  try {
    const { error } = await supabase
      .from(WINE_ORDERS_TABLE)
      .update({ 
        status: status
      })
      .eq('id', orderId)
      .eq('company_id', getCurrentCompanyId());

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};

