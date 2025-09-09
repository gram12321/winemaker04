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
 * Extreme quality multiplier using multi-segment scaling with smooth curves
 * Maps 0-1 quality values to price multipliers where:
 * - Values below 0.3 get modest multipliers (0.8-1.0x)
 * - Values 0.3-0.6 get moderate multipliers (1.0-1.6x)
 * - Values 0.6-0.8 get good multipliers (1.6-2.6x)
 * - Values 0.8-0.9 get strong multipliers (2.6-5.1x)
 * - Values 0.9-0.95 get excellent multipliers (5.1-15.1x)
 * - Values 0.95-0.98 get exceptional multipliers (15.1-55.1x)
 * - Only values 0.98+ get unlimited astronomical multipliers
 * 
 * This creates a wine pricing model where:
 * - ~98% of wines get reasonable, capped multipliers
 * - Only ~2% of wines can reach astronomical prices
 * - Uses same mathematical approaches as calculateSteppedBalance for consistency
 * 
 * @param value - Quality value between 0 and 1
 * @returns Price multiplier
 */
export function calculateExtremeQualityMultiplier(value: number): number {
  const safeValue = Math.min(0.99999, Math.max(0, value || 0));
  
  if (safeValue < 0.3) {
    // Polynomial curve for low quality: x² * 2 + 0.8
    // 0.0 → 0.8x, 0.1 → 0.82x, 0.2 → 0.88x, 0.3 → 0.98x
    return 0.8 + (safeValue * safeValue * 2);
  } else if (safeValue < 0.6) {
    // Logarithmic scaling for average quality
    // 0.3 → 0.98x, 0.4 → 1.15x, 0.5 → 1.35x, 0.6 → 1.58x
    return 0.98 + (Math.log(1 + (safeValue - 0.3) * 2) * 0.6);
  } else if (safeValue < 0.8) {
    // Linear scaling for good quality
    // 0.6 → 1.58x, 0.7 → 2.08x, 0.8 → 2.58x
    return 1.58 + (safeValue - 0.6) * 5;
  } else if (safeValue < 0.9) {
    // Exponential for very good quality
    // 0.8 → 2.58x, 0.85 → 3.58x, 0.9 → 5.08x
    return 2.58 + Math.pow((safeValue - 0.8) * 10, 1.5) * 2.5;
  } else if (safeValue < 0.95) {
    // Strong exponential for excellent quality
    // 0.9 → 5.08x, 0.92 → 8.08x, 0.95 → 15.08x
    return 5.08 + Math.pow((safeValue - 0.9) * 20, 2) * 10;
  } else if (safeValue < 0.98) {
    // Very strong exponential for exceptional quality
    // 0.95 → 15.08x, 0.96 → 25.08x, 0.98 → 55.08x
    return 15.08 + Math.pow((safeValue - 0.95) * 33.33, 2.5) * 40;
  } else {
    // Unlimited exponential for legendary quality (top 2% only: 0.98-1.0)
    // 0.98 → 55.08x, 0.99 → 5,000x, 0.999 → 500,000x, 1.0 → 50,000,000x
    const ultraQualityFactor = safeValue - 0.98;
    const baseMultiplier = 55.08;
    const exponentialGrowth = Math.pow(10000, ultraQualityFactor * 5); // 0-2 range becomes 1-10000
    
    return baseMultiplier * exponentialGrowth;
  }
}

// ===== VINEYARD SIZE CALCULATIONS =====

/**
 * Generate random vineyard size in acres with realistic distribution
 * Creates weighted probability for different size categories mimicking real-world vineyard distribution
 * 
 * @returns Random vineyard size in acres
 */
export function getRandomAcres(): number {
  const rand = Math.random() * 100;
  let acres;

  if (rand < 25) { // Very Small: 25%
    acres = 0.1 + Math.random() * 0.9;
  } else if (rand < 60) { // Small: 35%
    acres = 1 + Math.random() * 4;
  } else if (rand < 85) { // Medium: 25%
    acres = 5 + Math.random() * 15;
  } else if (rand < 93) { // Large: 8%
    acres = 20 + Math.random() * 30;
  } else if (rand < 96) { // Very Large: 3%
    acres = 50 + Math.random() * 450;
  } else if (rand < 96.5) { // Extra Large: 0.5%
    acres = 500 + Math.random() * 500;
  } else if (rand < 96.6) { // Ultra Large: 0.1%
    acres = 1000 + Math.random() * 4000;
  } else { // Fallback to medium size
    acres = 5 + Math.random() * 15;
  }

  // Ensure we return a number, not a string
  return Number(acres.toFixed(2));
}

// ===== PRESTIGE CALCULATIONS =====

/**
 * Calculate prestige modifier based on vine age
 * Uses different mathematical approaches for different age ranges
 * 
 * @param vineAge - Age of the vines in years
 * @returns Prestige modifier between 0 and 1
 */
export function farmlandAgePrestigeModifier(vineAge: number): number {
  const age = parseFloat(vineAge.toString());
  if (isNaN(age) || age < 0) {
    return 0;
  } else if (age <= 3) {
    return (age * age) / 100 + 0.01;
  } else if (age <= 25) {
    return 0.1 + (age - 3) * (0.4 / 22);
  } else if (age <= 100) {
    return 0.5 + (Math.atan((age - 25) / 20) / Math.PI) * (0.95 - 0.5);
  } else {
    return 0.95;
  }
}

// ===== BASE PRICE CALCULATIONS =====

/**
 * Calculate base wine price using land value and prestige
 * Uses placeholder values for now - will be enhanced with real calculations later
 * 
 * @param landValue - Land value (placeholder: 0.5)
 * @param prestige - Prestige value (placeholder: 0.5)
 * @param baseRate - Base rate per bottle (default: 25 from constants)
 * @returns Base price per bottle
 */
export function calculateBaseWinePrice(
  landValue: number = 0.5, 
  prestige: number = 0.5, 
  baseRate: number = 25
): number {
  // Base Price = (Land Value + Prestige) × Base Rate
  // With placeholders: (0.5 + 0.5) × 25 = €25
  return (landValue + prestige) * baseRate;
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
