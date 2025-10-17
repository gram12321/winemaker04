import { SALES_CONSTANTS } from '../constants/constants';

// ===== TYPE DEFINITIONS =====

interface SelectedWine {
  askingPrice: number;
  // Add other properties as needed when integrating
}


// =====Scale Converter Functions =====

/**
 * Calculate skewed multiplier using multi-segment scaling
 * Maps 0-1 input to 0-1 output using different mathematical approaches for different ranges
 * Heavily skewed toward 0 with exponential approach to 1
 * 
 * @param score - Input value between 0 and 1
 * @returns Scaled multiplier value between 0 and 1
 */
export function calculateSkewedMultiplier(score: number): number {
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

/**
 * Calculate inverted skewed multiplier using mathematical inversion
 * Maps 0-1 input to 0-1 output heavily skewed toward 1 with exponential approach to 0
 * This is the mathematical inverse of calculateSkewedMultiplier
 * 
 * @param score - Input value between 0 and 1
 * @returns Scaled multiplier value between 0 and 1
 */
export function calculateInvertedSkewedMultiplier(score: number): number {
  return 1 - calculateSkewedMultiplier(1 - score);
}

/**
 * Asymmetrical 0-1 scaler for land value normalization
 * Maps 0-1 → 0-1 with a fast rise around ~0.3-0.4 and early saturation ~0.75-0.8.
 * Shape inspired by the provided curve image. Monotonic and smooth-ish.
 *
 * Rough mapping:
 * 0.0→0.00, 0.1→~0.02, 0.2→~0.10, 0.35→~0.50, 0.6→~0.80, 0.75→~0.98, 0.85+→~0.995-1.0
 */
export function calculateAsymmetricalScaler01(value: number): number {
  const x = Math.max(0, Math.min(1, value || 0));

  if (x < 0.4) {
    // Fast start for low values: BOOST heavily
    // 0.0→0.00, 0.1→0.15, 0.2→0.30, 0.3→0.45, 0.4→0.60
    return x * 1.5;
  } else if (x < 0.7) {
    // Moderate growth for middle range: Still boosting but less
    // 0.4→0.60, 0.5→0.70, 0.6→0.80, 0.7→0.90
    return 0.60 + (x - 0.4) * 1.0;
  } else if (x < 0.9) {
    // Linear growth for good scores: Flattening out
    // 0.7→0.90, 0.8→0.95, 0.9→0.98
    return 0.90 + (x - 0.7) * 0.4;
  } else if (x < 0.95) {
    // Slower growth for very good scores: Start compressing
    // 0.9→0.98, 0.95→0.99
    return 0.98 + (x - 0.9) * 0.2;
  } else if (x < 0.99) {
    // Very slow growth for excellent scores: Heavy compression
    // 0.95→0.99, 0.99→0.995
    return 0.99 + (x - 0.95) * 0.125;
  } else {
    // Minimal growth for near-perfect scores: Cap near 1.0
    // 0.99→0.995, 1.0→1.000
    return 0.995 + (x - 0.99) * 0.5;
  }
}

/**
 * Asymmetrical multiplier using multi-segment scaling with smooth transitions
 * Maps 0–1 input values to multipliers using polynomial → logarithmic → linear → exponential → strong exponential → super-exponential progression
 * 
 * This creates a continuously rising, asymmetrical distribution where:
 * - Low values (0–0.3) get modest multipliers  
 * - Medium values (0.3–0.6) achieve steady improvement  
 * - High values (0.6–0.8) gain strong multipliers  
 * - Very high values (0.8–0.9) reach powerful boosts  
 * - Excellent values (0.9–0.95) show steep exponential escalation  
 * - Exceptional values (0.95–0.98) surge through strong super-exponential growth  
 * - Legendary values (0.98–1.0) enter astronomical scaling — capped for safety
 * 
 * Generic function for any asymmetrical scaling need (quality multipliers, bonus rewards, prestige scoring, etc.)
 * 
 * **Input → Output Mappings (approximate):**
 * ```
 * 0.0   → 1.00×
 * 0.1   → 1.02×
 * 0.2   → 1.08×
 * 0.3   → 1.18×
 * 0.4   → 1.35×
 * 0.5   → 1.55×
 * 0.6   → 1.78×
 * 0.7   → 2.28×
 * 0.8   → 2.78×
 * 0.85  → 3.78×
 * 0.9   → 5.28×
 * 0.92  → 8.28×
 * 0.95  → 15.28×
 * 0.96  → 25.28×
 * 0.98  → 55.28×
 * 0.99  → ≈ 5,000×
 * 0.999 → ≈ 500,000×
 * 1.0   → 50,000,000× (capped)
 * ```
 * 
 * **Mathematical progression by segment:**
 * - 0.0–0.3: Polynomial (x² × 2 + 1.0)
 * - 0.3–0.6: Logarithmic scaling
 * - 0.6–0.8: Linear scaling
 * - 0.8–0.9: Exponential growth
 * - 0.9–0.95: Strong exponential
 * - 0.95–0.98: Very strong exponential
 * - 0.98–1.0: Calibrated dual-segment super-exponential growth (safely capped at 50 M×)
 * 
 * @param value - Input value between 0 and 1
 * @returns Multiplier value (1×–50,000,000×)
 */
export function calculateAsymmetricalMultiplier(value: number): number {
  // Clamp only to [0, 1] and cap the *result*, not the input
  const v = Math.max(0, Math.min(1, value ?? 0));

  if (v < 0.3) {
    return 1.0 + (v * v * 2);
  } else if (v < 0.6) {
    return 1.18 + (Math.log(1 + (v - 0.3) * 2) * 0.6);
  } else if (v < 0.8) {
    return 1.78 + (v - 0.6) * 5;
  } else if (v < 0.9) {
    return 2.78 + Math.pow((v - 0.8) * 10, 1.5) * 2.5;
  } else if (v < 0.95) {
    return 5.28 + Math.pow((v - 0.9) * 20, 2) * 10;
  } else if (v < 0.98) {
    return 15.28 + Math.pow((v - 0.95) * 33.33, 2.5) * 40;
  }

  // ----- Reworked legendary tail -----
  // Targets:
  // v=0.98 -> 55.28x
  // v=0.99 -> ~5,000x
  // v=0.999 -> ~500,000x
  // v=1.00 -> ~50,000,000x (cap)

  const CAP = 50_000_000;

  if (v < 0.999) {
    // Segment A: 0.98 .. 0.999  (length 0.019)
    const base = 55.28;                     // value at 0.98
    const targetAt999 = 500_000;            // value at 0.999
    const A1 = targetAt999 / base;          // growth base across the segment
    const t = (v - 0.98) / 0.019;           // normalized [0,1)
    // Choose p so v=0.99 (~t=0.5263) hits ~5,000
    // p ≈ 1.09718 (solved to pass through 0.99 -> 5,000)
    const p = 1.097178;
    const mult = base * Math.pow(A1, Math.pow(t, p));
    return Math.min(mult, CAP);
  } else {
    // Segment B: 0.999 .. 1.000 (length 0.001)
    const base2 = 500_000;                  // exact continuity at 0.999
    const A2 = 100;                         // 500k * 100 = 50,000,000 at 1.0
    const s = (v - 0.999) / 0.001;          // normalized [0,1]
    const mult = base2 * Math.pow(A2, s);
    return Math.min(mult, CAP);             // explicit cap at 50,000,000
  }
}


// ===== TAIL SQUASHING UTIL =====
/**
 * Smoothly squash values above a threshold toward a ceiling below 1.0.
 * Useful to avoid extreme tails in functions that blow up near 1.0.
 *
 * @param value Input in [0, +inf)
 * @param threshold Start of squash (default 0.97)
 * @param maxTarget Practical ceiling (< 1.0) (default 0.985)
 * @param alpha Steepness parameter (default 8)
 * @returns Squashed value in [0, maxTarget)
 */
export function squashNormalizeTail(
  value: number,
  threshold: number = 0.97,
  maxTarget: number = 0.985,
  alpha: number = 8
): number {
  const x = Math.max(0, value || 0);
  if (x <= threshold) return x;
  const span = Math.max(0, maxTarget - threshold);
  if (span <= 0) return Math.min(x, maxTarget - 1e-6);
  const over = x - threshold;
  const tail = span * (1 - Math.exp(-alpha * over));
  return threshold + Math.min(tail, span - 1e-6);
}



// ===== SYMMETRICAL MULTIPLIER CALCULATIONS =====

/**
 * Calculate symmetrical multiplier using same mathematical progression as calculateExtremeQualityMultiplier
 * Maps 0-1 input to min-max output using polynomial → logarithmic → linear → exponential → strong exponential → sigmoid
 * 
 * This creates a bell curve distribution where:
 * - Input 0.0 approaches minimum multiplier (never quite reaches it)
 * - Input 0.5 maps to exactly 1.0x multiplier (perfect symmetry)
 * - Input 1.0 approaches maximum multiplier (never quite reaches it)
 * - Most values cluster around 1.0x with rare extremes
 * 
 * @param value - Input value between 0 and 1
 * @param minMultiplier - Minimum multiplier (e.g., 0.7)
 * @param maxMultiplier - Maximum multiplier (e.g., 1.3)
 * @returns Multiplier value between min and max
 */
export function calculateSymmetricalMultiplier(
  value: number,
  minMultiplier: number,
  maxMultiplier: number
): number {
  const safeValue = Math.min(0.99999, Math.max(0.00001, value || 0.5));
  
  // Calculate distance from center (0.5)
  const distanceFromCenter = Math.abs(safeValue - 0.5);
  
  // Map distance to 0-1 scale for mathematical progression
  const progressionInput = distanceFromCenter * 2; // 0-1 scale
  
  let progressionValue: number;
  
  if (progressionInput < 0.1) {
    // Sigmoid (0-0.1) - 0.0-0.1 and 0.9-1.0 range - extremes
    progressionValue = 1 - (1 - Math.exp(-progressionInput * 10)) * 0.1;
  } else if (progressionInput < 0.2) {
    // Logarithmic (0.1-0.2) - 0.1-0.2 and 0.8-0.9 range
    progressionValue = 0.9 + Math.log(1 + (progressionInput - 0.1) * 10) * 0.1;
  } else if (progressionInput < 0.3) {
    // Exponential (0.2-0.3) - 0.2-0.3 and 0.7-0.8 range
    progressionValue = 0.8 + Math.pow((progressionInput - 0.2) * 10, 1.5) * 0.1;
  } else if (progressionInput < 0.4) {
    // Linear (0.3-0.4) - 0.3-0.4 and 0.6-0.7 range
    progressionValue = 0.7 + (progressionInput - 0.3) * 1;
  } else if (progressionInput < 0.5) {
    // Polynomial (0.4-0.5) - 0.4-0.6 range (closest to center)
    progressionValue = 0.6 + (progressionInput - 0.4) * (progressionInput - 0.4) * 10;
  } else if (progressionInput < 0.6) {
    // Polynomial (0.5-0.6) - 0.4-0.6 range (symmetrical)
    progressionValue = 0.5 + (progressionInput - 0.5) * (progressionInput - 0.5) * 10;
  } else if (progressionInput < 0.7) {
    // Linear (0.6-0.7) - 0.3-0.4 and 0.6-0.7 range (symmetrical)
    progressionValue = 0.4 + (progressionInput - 0.6) * 1;
  } else if (progressionInput < 0.8) {
    // Exponential (0.7-0.8) - 0.2-0.3 and 0.7-0.8 range (symmetrical)
    progressionValue = 0.3 + Math.pow((progressionInput - 0.7) * 10, 1.5) * 0.1;
  } else if (progressionInput < 0.9) {
    // Logarithmic (0.8-0.9) - 0.1-0.2 and 0.8-0.9 range (symmetrical)
    progressionValue = 0.2 + Math.log(1 + (progressionInput - 0.8) * 10) * 0.1;
  } else {
    // Sigmoid (0.9-1.0) - 0.0-0.1 and 0.9-1.0 range (symmetrical) - extremes
    progressionValue = 0.1 + (1 - Math.exp(-(progressionInput - 0.9) * 10)) * 0.1;
  }
  
  // Map progression value to multiplier range
  const range = maxMultiplier - minMultiplier;
  const multiplier = minMultiplier + (progressionValue * range);
  
  // Ensure we never quite reach the extremes
  const buffer = range * 0.001; // 0.1% buffer from extremes
  return Math.max(minMultiplier + buffer, Math.min(maxMultiplier - buffer, multiplier));
}


// ===== VINEYARD SIZE CALCULATIONS =====
// ===== HECTARE DISTRIBUTION (Shared) =====
// Central source of truth for vineyard size distribution used by both generation and cost/work calculations
export const HECTARE_BUCKETS: Array<{ w: number; min: number; max: number }> = [
  { w: 0.25, min: 0.05, max: 0.5 },    // Very Small 25%
  { w: 0.35, min: 0.5,  max: 2.5 },    // Small 35%
  { w: 0.28, min: 2.5,  max: 5 },      // Medium 28%
  { w: 0.07, min: 5,    max: 10 },     // Large 7%
  { w: 0.03, min: 10,   max: 20 },     // Very Large 3%
  { w: 0.014, min: 20,  max: 100 },    // Extra Large 1.4%
  { w: 0.005, min: 100, max: 500 },    // Ultra Large 0.5%
  { w: 0.001, min: 500, max: 2000 }    // Massive 0.1%
];

export function probabilityMassInRange(minHa: number, maxHa: number): number {
  const min = Math.max(0.05, Math.min(minHa, 2000));
  const max = Math.max(min, Math.min(maxHa, 2000));
  let mass = 0;
  for (const b of HECTARE_BUCKETS) {
    const overlapMin = Math.max(min, b.min);
    const overlapMax = Math.min(max, b.max);
    if (overlapMax > overlapMin) {
      const bucketSpan = b.max - b.min;
      const overlapSpan = overlapMax - overlapMin;
      mass += b.w * (overlapSpan / bucketSpan);
    }
  }
  return Math.max(0, Math.min(1, mass));
}


/**
 * Generate random vineyard size in hectares with realistic distribution
 * Creates weighted probability for different size categories mimicking real-world vineyard distribution
 * 
 * @returns Random vineyard size in hectares
 */
export function getRandomHectares(): number {
  // Pick a bucket by cumulative weights
  const totalW = HECTARE_BUCKETS.reduce((s, b) => s + b.w, 0);
  let r = Math.random() * totalW;
  let chosen = HECTARE_BUCKETS[HECTARE_BUCKETS.length - 1];
  for (const b of HECTARE_BUCKETS) {
    if (r < b.w) { chosen = b; break; }
    r -= b.w;
  }
  const hectares = chosen.min + Math.random() * (chosen.max - chosen.min);
  return Number(hectares.toFixed(2));
}


// ===== PRESTIGE CALCULATIONS =====

/**
 * Calculate prestige modifier based on vine age
 * Uses Math.atan approach but with smooth progression across full 0-1 range
 * 
 * @param vineAge - Age of the vines in years
 * @returns Prestige modifier between 0 and 1
 */
export function vineyardAgePrestigeModifier(vineAge: number): number {
  const age = parseFloat(vineAge.toString());
  if (isNaN(age) || age < 0) {
    return 0;
  } else if (age <= 3) {
    return age === 0 ? 0 : (age * age) / 100 + 0.01;
  } else if (age <= 25) {
    return 0.1 + (age - 3) * (0.4 / 22);
  } else if (age <= 200) {
    // Use Math.atan but scale it to reach 1.0 at 200 years instead of 100
    // At age 200: (200-25)/20 = 8.75, Math.atan(8.75) ≈ 1.46, 1.46/π ≈ 0.46
    // We need to scale this to reach 1.0, so: 0.5 + 0.46 * 1.09 ≈ 1.0
    const atanResult = Math.atan((age - 25) / 20) / Math.PI;
    return 0.5 + atanResult * 1.08; // Scale factor for 200-year max
  } else {
    // For ages > 200, keep at 1.0 (very old vines)
    return 1.0;
  }
}

// ===== ORDER AMOUNT CALCULATIONS =====

/**
 * Calculate order amount adjustment based on price difference
 * Creates realistic market behavior where deep discounts attract massive order quantities
 * 
 * @param selectedWine - Wine object with askingPrice property
 * @param calculatedBasePrice - The calculated base price for comparison
 * @param orderType - Type of order (key for CUSTOMER_TYPES)
 * @returns Order amount multiplier
 */
export function calculateOrderAmount(
  selectedWine: SelectedWine, 
  calculatedBasePrice: number, 
  orderType: keyof typeof SALES_CONSTANTS.CUSTOMER_TYPES
): number {
  const selectedOrderType = SALES_CONSTANTS.CUSTOMER_TYPES[orderType];
  
  if (!selectedOrderType) {
    console.warn(`Unknown order type: ${orderType}`);
    return 1.0; // Default multiplier
  }
  
  // Calculate price difference from base price (ratio of asking price to calculated base price)
  const priceDifference = selectedWine.askingPrice / calculatedBasePrice;
  
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
  } else {
    // Higher price than base (premium) - Harsh punishment for overpricing
    const premiumLevel = priceDifference - 1; // 0 = no premium, 1 = 100% premium, 9 = 900% premium
    
    // Define premium punishment thresholds
    const SMALL_PREMIUM_THRESHOLD = 0.2;   // 20% premium threshold
    const MEDIUM_PREMIUM_THRESHOLD = 1.0;  // 100% premium threshold (2x price)
    const LARGE_PREMIUM_THRESHOLD = 5.0;   // 500% premium threshold (6x price)
    
    // Moderate premium punishment formula (half as harsh):
    // 20% premium -> 0.9x quantity (10% reduction)
    // 50% premium -> 0.75x quantity (25% reduction)
    // 100% premium -> 0.5x quantity (50% reduction)
    // 200% premium -> 0.25x quantity (75% reduction)
    // 300% premium -> 0.125x quantity (87.5% reduction)
    // 500% premium -> 0.05x quantity (95% reduction)
    if (premiumLevel <= SMALL_PREMIUM_THRESHOLD) {
      // Linear punishment for small premiums: 0.5:1 reduction up to 20%
      amountAdjustment = 1 - (premiumLevel * 0.5);
    } else if (premiumLevel <= MEDIUM_PREMIUM_THRESHOLD) {
      // Progressive punishment between 20-100% premium
      // 0.2 -> 0.9, 0.5 -> 0.75, 1.0 -> 0.5
      amountAdjustment = 1 - (premiumLevel * 0.5);
    } else if (premiumLevel <= LARGE_PREMIUM_THRESHOLD) {
      // Moderate punishment between 100-500% premium
      // 1.0 -> 0.5, 2.0 -> 0.25, 3.0 -> 0.125, 5.0 -> 0.05
      amountAdjustment = Math.pow(0.5, premiumLevel);
    } else {
      // Severe punishment for massive premiums (500%+)
      // 5.0 -> 0.05, 10.0 -> 0.005, 20.0 -> 0.0005
      amountAdjustment = Math.pow(0.1, premiumLevel / 10);
    }
    
    // Ensure minimum quantity (at least 1% of base quantity)
    amountAdjustment = Math.max(amountAdjustment, 0.01);
  }
  
  return amountAdjustment;
}

// ===== PRESTIGE NORMALIZATION =====

/**
 * Normalize prestige values from 0-1000+ range to 0-1 scale with tail squashing
 * Designed for realistic prestige distribution:
 * - Most companies: 0.1-10 prestige (maps to ~0.1-0.7)
 * - Some companies: 10-100 prestige (maps to ~0.7-0.9) 
 * - Few companies: 100-1000 prestige (maps to ~0.9-0.98)
 * - Exceptional: >1000 prestige (uses tail squash to prevent hard 1.0)
 * 
 * @param prestige - Prestige value to normalize
 * @returns Normalized value between 0 and 1 (never quite reaches 1.0)
 */
export function NormalizeScrewed1000To01WithTail(prestige: number): number {
  const safePrestige = Math.max(0, prestige || 0);
  
  let normalized: number;
  
  if (safePrestige <= 10) {
    // Most companies: 0.1-10 prestige → 0.1-0.7 (linear with slight curve)
    const ratio = safePrestige / 10;
    normalized = 0.1 + (0.6 * Math.pow(ratio, 0.8)); // Slight curve upward
  } else if (safePrestige <= 100) {
    // Some companies: 10-100 prestige → 0.7-0.9 (logarithmic)
    const ratio = (safePrestige - 10) / 90;
    normalized = 0.7 + (0.2 * Math.log(1 + 3 * ratio) / Math.log(4)); // Logarithmic growth
  } else if (safePrestige <= 1000) {
    // Few companies: 100-1000 prestige → 0.9-0.98 (very slow growth)
    const ratio = (safePrestige - 100) / 900;
    normalized = 0.9 + (0.08 * Math.pow(ratio, 0.5)); // Square root growth
  } else {
    // Exceptional cases: >1000 prestige → 0.98+ (use tail squash)
    const excess = safePrestige - 1000;
    const excessRatio = Math.min(excess / 1000, 1); // Cap at 2000 for calculation
    normalized = 0.98 + (0.02 * excessRatio);
  }
  
  // Use squashNormalizeTail only for very high prestige (>1000) to prevent hard 1.0
  if (safePrestige > 1000) {
    const result = squashNormalizeTail(normalized, 0.98, 0.999, 5);
    return result;
  }
  
  return Math.min(0.999, Math.max(0.001, normalized));
}

// ===== EXPORT TYPES =====

export type { SelectedWine };
