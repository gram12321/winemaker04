// Mathematical calculation utilities for the winery management game
// Imported and adapted from previous iterations

import { SALES_CONSTANTS } from '../constants';

// ===== TYPE DEFINITIONS =====

interface SelectedWine {
  customPrice: number;
  // Add other properties as needed when integrating
}

// ===== BALANCE CALCULATIONS =====

/**
 * Calculate stepped balance using multi-segment scaling
 * Maps 0-1 input to 0-1 output using different mathematical approaches for different ranges
 * 
 * @param score - Input value between 0 and 1
 * @returns Scaled balance value between 0 and 1
 */
export function calculateSteppedBalance(score: number): number {
  if (score < 0.4) {
    // Polynomial curve for low scores: x² * 1.5
    return score * score * 1.5;
    // 0.0 → 0.000
    // 0.1 → 0.015
    // 0.2 → 0.060
    // 0.3 → 0.135
    // 0.4 → 0.240
  } else if (score < 0.7) {
    // Logarithmic scaling for middle range
    return 0.24 + (Math.log(1 + (score - 0.4) * 3.33) * 0.3);
    // 0.4 → 0.240
    // 0.5 → 0.370
    // 0.6 → 0.480
    // 0.7 → 0.560
  } else if (score < 0.9) {
    // Linear scaling for good scores
    return 0.56 + (score - 0.7) * 1.5;
    // 0.7 → 0.560
    // 0.8 → 0.710
    // 0.9 → 0.860
  } else if (score < 0.95) {
    // Exponential for very good scores
    return 0.86 + (score - 0.9) * 2;
    // 0.90 → 0.860
    // 0.95 → 0.960
  } else if (score < 0.99) {
    // Logistic curve for excellent scores
    return 0.96 + (score - 0.95) * 0.8;
    // 0.95 → 0.960
    // 0.99 → 0.992
  } else {
    // Sigmoid for near-perfect scores
    return 0.99 + (1 - Math.exp(-(score - 0.99) * 10)) * 0.01;
    // 0.99 → 0.992
    // 1.00 → 1.000
  }
}

// ===== QUALITY CALCULATIONS =====

/**
 * Extreme quality multiplier using multi-segment scaling
 * Maps 0-1 quality values to price multipliers where:
 * - Values below 0.7 get modest multipliers (0.8-1.25x)
 * - Values around 0.9 get moderate multipliers (~3-5x)
 * - Values above 0.95 grow more quickly (~10-50x)
 * - Only values approaching 0.99+ yield astronomical multipliers (>100x)
 * 
 * This creates a wine pricing model where:
 * - ~90% of wines are below €100 (average quality wines)
 * - ~9% are between €100-€1,000 (excellent wines)
 * - ~0.9% are between €1,000-€10,000 (exceptional wines)
 * - Only ~0.1% exceed €10,000 (legendary wines, requiring >0.98 quality AND balance)
 * 
 * @param value - Quality value between 0 and 1
 * @param steepness - Steepness parameter (default: 80, currently unused)
 * @param midpoint - Midpoint parameter (default: 0.95, currently unused)
 * @returns Price multiplier
 */
export function calculateExtremeQualityMultiplier(
  value: number, 
  _steepness: number = 80, 
  _midpoint: number = 0.95
): number {
  // Ensure value is between 0 and 0.99999
  const safeValue = Math.min(0.99999, Math.max(0, value || 0));
  
  if (safeValue < 0.5) {
    // Below average quality gets a small penalty but never below 0.8x
    return 1 + (safeValue * 0.4);
  } else if (safeValue < 0.7) {
    // Average quality gets approximately 1x multiplier
    return 1.1 + ((safeValue - 0.5) * 0.5);
  } else if (safeValue < 0.9) {
    // Good quality gets a modest boost (1.25x-3x)
    return 1.25 + ((safeValue - 0.7) * 8.75);
  } else if (safeValue < 0.95) {
    // Excellent quality gets a stronger boost (3x-10x)
    return 3 + ((safeValue - 0.9) * 140);
  } else if (safeValue < 0.98) {
    // Exceptional quality (0.95-0.98) gets a significant boost (10x-50x)
    return 10 + ((safeValue - 0.95) * 1333.33);
  } else {
    // Only truly extraordinary quality (>0.98) gets the extreme multipliers
    // This makes astronomical prices much rarer
    const ultraQualityFactor = safeValue - 0.98;
    const baseMultiplier = 50;
    const exponentialGrowth = Math.pow(10000, ultraQualityFactor * 5); // 0-2 range becomes 1-10000
    
    return baseMultiplier * exponentialGrowth;
  }
}

// ===== ORDER AMOUNT CALCULATIONS =====

/**
 * Calculate order amount adjustment based on price difference
 * Creates realistic market behavior where deep discounts attract massive order quantities
 * 
 * @param selectedWine - Wine object with customPrice property
 * @param calculatedBasePrice - The calculated base price for comparison
 * @param orderType - Type of order (key for WINE_ORDER_TYPES)
 * @returns Order amount multiplier
 */
export function calculateOrderAmount(
  selectedWine: SelectedWine, 
  calculatedBasePrice: number, 
  orderType: keyof typeof SALES_CONSTANTS.ORDER_TYPES
): number {
  const selectedOrderType = SALES_CONSTANTS.ORDER_TYPES[orderType];
  
  if (!selectedOrderType) {
    console.warn(`Unknown order type: ${orderType}`);
    return 1.0; // Default multiplier
  }
  
  // Calculate price difference from base price (ratio of custom price to calculated base price)
  const priceDifference = selectedWine.customPrice / calculatedBasePrice;
  
  // Enhanced price adjustment with more aggressive formula for discounts
  let amountAdjustment = 1.0;
  
  if (priceDifference < 1) {
    // Lower price than base (discount)
    // Calculate percentage below base price (0 to 1 scale where 1 = 100% discount)
    const discountLevel = 1 - priceDifference;
    
    // Define discount threshold constants locally
    const SMALL_DISCOUNT_THRESHOLD = 0.1;   // 10% discount threshold
    const MEDIUM_DISCOUNT_THRESHOLD = 0.5;  // 50% discount threshold
    const LARGE_DISCOUNT_THRESHOLD = 0.9;   // 90% discount threshold
    const MAX_DISCOUNT_MODIFIER = 10;       // Maximum discount modifier (10x)
    
    // New formula that more closely matches our desired curve:
    // 10% discount -> 10% boost
    // 25% discount -> ~35% boost
    // 50% discount -> ~75% boost
    // 75% discount -> ~100% boost
    // 90% discount -> ~300% boost
    // 99% discount -> ~1000% boost
    if (discountLevel <= SMALL_DISCOUNT_THRESHOLD) {
      // Linear for small discounts: 1:1 boost up to 10%
      amountAdjustment = 1 + discountLevel;
    } else if (discountLevel <= MEDIUM_DISCOUNT_THRESHOLD) {
      // Progressive growth between 10-50% discount
      // 0.1 -> 1.1, 0.25 -> 1.35, 0.5 -> 1.75
      amountAdjustment = 1 + (discountLevel * (1 + discountLevel));
    } else if (discountLevel <= LARGE_DISCOUNT_THRESHOLD) {
      // Higher growth between 50-90% discount
      // 0.5 -> 1.75, 0.75 -> 2.0, 0.9 -> 4.0
      const factor = 1 + (discountLevel - MEDIUM_DISCOUNT_THRESHOLD) * 3;
      amountAdjustment = 1.75 + (discountLevel * factor);
    } else {
      // Extreme growth approaching infinity as discount approaches 100%
      // 0.9 -> 4.0, 0.99 -> 10.0, 0.999 -> 100.0
      amountAdjustment = 1 + (1 / (1 - discountLevel) * discountLevel * 10);
      
      // Cap at MAX_DISCOUNT_MODIFIER to avoid excessive orders
      amountAdjustment = Math.min(amountAdjustment, MAX_DISCOUNT_MODIFIER);
    }
  }
  
  return amountAdjustment;
}

// ===== EXPORT TYPES =====

export type { SelectedWine };
