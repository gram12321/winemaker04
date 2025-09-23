import { supabase } from './supabase';
import { Vineyard, WineBatch, GameState, Season, WineOrder, CustomerType, GrapeVariety } from '../types/types';
import { getCompanyQuery } from '../utils/companyUtils';
import { getCurrentCompanyId } from '../utils/companyUtils';
import { GRAPE_CONST } from '../constants/grapeConstants';

// Table names
const VINEYARDS_TABLE = 'vineyards';
const WINE_BATCHES_TABLE = 'wine_batches';
const GAME_STATE_TABLE = 'game_state';
const WINE_ORDERS_TABLE = 'wine_orders';
const NOTIFICATIONS_TABLE = 'notifications';

// ===== VINEYARD OPERATIONS =====

export const saveVineyard = async (vineyard: Vineyard): Promise<void> => {
  try {
    const { error } = await supabase
      .from(VINEYARDS_TABLE)
      .upsert({
        id: vineyard.id,
        company_id: getCurrentCompanyId(),
        name: vineyard.name,
        country: vineyard.country,
        region: vineyard.region,
        hectares: vineyard.hectares,
        grape_variety: vineyard.grape,
        vine_age: vineyard.vineAge,
        soil: vineyard.soil, // Store as JSON array
        altitude: vineyard.altitude,
        aspect: vineyard.aspect,
        density: vineyard.density,
        land_value: vineyard.landValue,
        vineyard_total_value: vineyard.vineyardTotalValue,
        status: vineyard.status,
        vineyard_prestige: vineyard.vineyardPrestige,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    // Silently fail - allow game to continue
  }
};

export const loadVineyards = async (): Promise<Vineyard[]> => {
  try {
    const { data, error } = await getCompanyQuery(VINEYARDS_TABLE)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      country: row.country,
      region: row.region,
      hectares: row.hectares,
      grape: row.grape_variety,
      vineAge: row.vine_age,
      soil: row.soil || ['Clay'],
      altitude: row.altitude || 200,
      aspect: row.aspect || 'South',
      density: row.density ?? 0,
      landValue: row.land_value || 50000,
      vineyardTotalValue: row.vineyard_total_value || (row.hectares * (row.land_value || 50000)),
      status: row.status,
      vineyardPrestige: row.vineyard_prestige || 0
    }));
  } catch (error) {
    return [];
  }
};

// ===== GAME STATE OPERATIONS =====
export const saveGameState = async (gameState: Partial<GameState>): Promise<void> => {
  try {
    const dataToSave = {
      id: getCurrentCompanyId(),
      player_name: 'Player',
      week: gameState.week,
      season: gameState.season,
      current_year: gameState.currentYear,
      money: gameState.money || 0,
      prestige: gameState.prestige,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from(GAME_STATE_TABLE)
      .upsert(dataToSave);

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};

export const loadGameState = async (): Promise<Partial<GameState> | null> => {
  try {
    const { data, error } = await supabase
      .from(GAME_STATE_TABLE)
      .select('*')
      .eq('id', getCurrentCompanyId());

    if (error) {
      throw error;
    }

    // If no record found, return null
    if (!data || data.length === 0) {
      return null;
    }

    const record = data[0];
    return {
      week: record.week,
      season: record.season,
      currentYear: record.current_year,
      money: record.money,
      prestige: record.prestige
    };
  } catch (error) {
    return null;
  }
};


// ===== WINE BATCH OPERATIONS =====

export const saveWineBatch = async (batch: WineBatch): Promise<void> => {
  try {
    const { error } = await supabase
      .from(WINE_BATCHES_TABLE)
      .upsert({
        id: batch.id,
        company_id: getCurrentCompanyId(),
        vineyard_id: batch.vineyardId,
        vineyard_name: batch.vineyardName,
        grape_variety: batch.grape,
        quantity: batch.quantity,
        stage: batch.stage,
        process: batch.process,
        fermentation_progress: batch.fermentationProgress || 0,
        quality: batch.quality,
        balance: batch.balance,
        characteristics: batch.characteristics, // Store as JSON
        final_price: batch.finalPrice,
        asking_price: batch.askingPrice,
        harvest_week: batch.harvestDate.week,
        harvest_season: batch.harvestDate.season,
        harvest_year: batch.harvestDate.year,
        created_week: batch.createdAt.week,
        created_season: batch.createdAt.season,
        created_year: batch.createdAt.year,
        completed_week: batch.completedAt?.week,
        completed_season: batch.completedAt?.season,
        completed_year: batch.completedAt?.year,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    // Silently fail - allow game to continue
  }
};

export const loadWineBatches = async (): Promise<WineBatch[]> => {
  try {
    const { data, error } = await getCompanyQuery(WINE_BATCHES_TABLE)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => {
      const grapeVariety = row.grape_variety as GrapeVariety;
      const grapeData = GRAPE_CONST[grapeVariety] || GRAPE_CONST['Chardonnay']; // Fallback to Chardonnay
      
      return {
        id: row.id,
        vineyardId: row.vineyard_id,
        vineyardName: row.vineyard_name,
        grape: grapeVariety,
        quantity: row.quantity,
        stage: row.stage,
        process: row.process,
        fermentationProgress: row.fermentation_progress || 0,
        quality: row.quality || 0.7,
        balance: row.balance || 0.6,
        characteristics: row.characteristics || {
          acidity: 0.5,
          aroma: 0.5,
          body: 0.5,
          spice: 0.5,
          sweetness: 0.5,
          tannins: 0.5
        }, // Default characteristics if not set
        finalPrice: row.final_price || 10.50,
        askingPrice: row.asking_price, // Will default to undefined if not set
        grapeColor: grapeData.grapeColor,
        naturalYield: grapeData.naturalYield,
        fragile: grapeData.fragile,
        proneToOxidation: grapeData.proneToOxidation,
        harvestDate: {
          week: row.harvest_week || 1,
          season: (row.harvest_season || 'Spring') as Season,
          year: row.harvest_year || 2024
        },
        createdAt: {
          week: row.created_week || 1,
          season: (row.created_season || 'Spring') as Season,
          year: row.created_year || 2024
        },
        completedAt: row.completed_week ? {
          week: row.completed_week,
          season: row.completed_season as Season,
          year: row.completed_year
        } : undefined
      };
    });
  } catch (error) {
    return [];
  }
};

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
        calculation_data: order.calculationData || null,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    // Silently fail - allow game to continue
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

export const updateWineOrderStatus = async (orderId: string, status: 'fulfilled' | 'rejected'): Promise<void> => {
  try {
    const { error } = await supabase
      .from(WINE_ORDERS_TABLE)
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('company_id', getCurrentCompanyId());

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};


// ===== NOTIFICATION OPERATIONS =====

export type DbNotificationType = 'info' | 'warning' | 'error' | 'success';

export interface DbNotificationRecord {
  id: string;
  timestamp: string;
  text: string;
  type: DbNotificationType;
}

export const saveNotification = async (notification: DbNotificationRecord): Promise<void> => {
  try {
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .upsert({
        id: notification.id,
        company_id: getCurrentCompanyId(),
        timestamp: notification.timestamp,
        text: notification.text,
        type: notification.type,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    // Silently fail - notifications are non-critical for gameplay
  }
};

export const loadNotifications = async (): Promise<DbNotificationRecord[]> => {
  try {
    const { data, error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .select('*')
      .eq('company_id', getCurrentCompanyId())
      .order('timestamp', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      text: row.text,
      type: row.type as DbNotificationType
    }));
  } catch (error) {
    return [];
  }
};

export const clearNotifications = async (): Promise<void> => {
  try {
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .delete()
      .eq('company_id', getCurrentCompanyId());

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};
