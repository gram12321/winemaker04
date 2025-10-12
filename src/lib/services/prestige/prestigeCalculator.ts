// Unified Prestige Calculator
// Shared dynamic prestige calculations for both regular events and feature events
// 
// KEY DISTINCTION:
// - Sale events (no features): Scale with company ASSETS (business size)
// - Feature events (positive/negative): Scale with company/vineyard PRESTIGE (reputation standards)

/**
 * Calculate dynamic prestige for REGULAR SALE EVENTS (positive, no features)
 * Scales with company ASSETS (business size) - bigger companies make bigger sales
 * 
 * @param baseAmount - Base prestige amount (typically saleValue / 10000)
 * @param saleValue - Total sale value in euros
 * @param saleVolume - Number of bottles sold
 * @param companyAssets - Company's total assets/money
 * @param weights - Optional scaling weights
 * @returns Calculated prestige amount
 */
export function calculateSalePrestigeWithAssets(
  baseAmount: number,
  saleValue: number,
  saleVolume: number,
  companyAssets: number,
  weights?: {
    volumeWeight?: number;
    valueWeight?: number;
    assetsWeight?: number;
  }
): number {
  const { volumeWeight = 1, valueWeight = 1, assetsWeight = 1 } = weights || {};
  
  // Volume scaling (logarithmic - diminishing returns)
  const volumeFactor = Math.log((saleVolume / 10) + 1) * volumeWeight;
  
  // Value scaling (logarithmic)
  const valueFactor = Math.log((saleValue / 1000) + 1) * valueWeight;
  
  // Assets scaling (square root - bigger businesses = bigger achievements)
  const assetsFactor = Math.sqrt(Math.max(1, companyAssets) / 100000) * assetsWeight;
  
  // Formula: baseAmount × (volume + value) × assets
  const amount = baseAmount * (volumeFactor + valueFactor) * assetsFactor;
  
  // Cap at reasonable maximum
  return Math.min(10.0, amount);
}

/**
 * Calculate dynamic prestige for FEATURE SALE EVENTS (positive or negative features)
 * Scales with company PRESTIGE (reputation) - higher reputation = higher standards
 * 
 * @param baseAmount - Base prestige amount (negative for faults, positive for features)
 * @param saleValue - Total sale value in euros
 * @param saleVolume - Number of bottles sold
 * @param companyPrestige - Company's current prestige (reputation)
 * @param weights - Optional scaling weights
 * @returns Calculated prestige amount
 */
export function calculateFeatureSalePrestigeWithReputation(
  baseAmount: number,
  saleValue: number,
  saleVolume: number,
  companyPrestige: number,
  weights?: {
    volumeWeight?: number;
    valueWeight?: number;
    prestigeWeight?: number;
  }
): number {
  const { volumeWeight = 1, valueWeight = 1, prestigeWeight = 1 } = weights || {};
  
  // Volume scaling (logarithmic)
  const volumeFactor = Math.log((saleVolume / 10) + 1) * volumeWeight;
  
  // Value scaling (logarithmic)
  const valueFactor = Math.log((saleValue / 1000) + 1) * valueWeight;
  
  // Prestige scaling (square root - higher prestige = held to higher standards)
  const prestigeFactor = Math.sqrt(Math.max(1, companyPrestige) / 10) * prestigeWeight;
  
  // Formula: baseAmount × (volume + value) × prestige
  const amount = baseAmount * (volumeFactor + valueFactor) * prestigeFactor;
  
  // Cap based on positive/negative
  const maxImpact = baseAmount < 0 ? -10.0 : 10.0;
  return baseAmount < 0 
    ? Math.max(maxImpact, amount)  // Negative: cap at max penalty
    : Math.min(maxImpact, amount);  // Positive: cap at max bonus
}

/**
 * Calculate dynamic prestige for VINEYARD MANIFESTATION EVENTS (features appearing)
 * Scales with vineyard PRESTIGE (reputation) - premium vineyards held to higher standards
 * 
 * @param baseAmount - Base prestige amount (negative for faults, positive for features)
 * @param batchSize - Size of wine batch in kg or bottles
 * @param wineQuality - Quality of the wine (0-1)
 * @param vineyardPrestige - Vineyard's current prestige (reputation)
 * @param weights - Optional scaling weights
 * @returns Calculated prestige amount
 */
export function calculateVineyardManifestationPrestige(
  baseAmount: number,
  batchSize: number,
  wineQuality: number,
  vineyardPrestige: number,
  weights?: {
    batchSizeWeight?: number;
    qualityWeight?: number;
    vineyardPrestigeWeight?: number;
  }
): number {
  const { batchSizeWeight = 1, qualityWeight = 1, vineyardPrestigeWeight = 1 } = weights || {};
  
  // Batch size scaling (logarithmic - larger batches = bigger impact)
  const sizeFactor = Math.log((batchSize / 100) + 1) * batchSizeWeight;
  
  // Quality scaling (linear - premium wine failures/achievements matter more)
  const qualityFactor = (1 + wineQuality) * qualityWeight;
  
  // Vineyard prestige scaling (square root - premium vineyards held to higher standard)
  const vineyardFactor = Math.sqrt(Math.max(0.1, vineyardPrestige) / 5) * vineyardPrestigeWeight;
  
  // Formula: baseAmount × size × quality × vineyardPrestige
  const amount = baseAmount * sizeFactor * qualityFactor * vineyardFactor;
  
  // Cap based on positive/negative
  const maxImpact = baseAmount < 0 ? -10.0 : 10.0;
  return baseAmount < 0 
    ? Math.max(maxImpact, amount)
    : Math.min(maxImpact, amount);
}

/**
 * Calculate dynamic prestige for COMPANY MANIFESTATION EVENTS (features appearing)
 * Scales with company PRESTIGE (reputation) - higher reputation = higher standards
 * 
 * @param baseAmount - Base prestige amount (negative for faults, positive for features)
 * @param batchSize - Size of wine batch in kg or bottles
 * @param wineQuality - Quality of the wine (0-1)
 * @param companyPrestige - Company's current prestige (reputation)
 * @param weights - Optional scaling weights
 * @returns Calculated prestige amount
 */
export function calculateCompanyManifestationPrestige(
  baseAmount: number,
  batchSize: number,
  wineQuality: number,
  companyPrestige: number,
  weights?: {
    batchSizeWeight?: number;
    qualityWeight?: number;
    companyPrestigeWeight?: number;
  }
): number {
  const { batchSizeWeight = 1, qualityWeight = 1, companyPrestigeWeight = 1 } = weights || {};
  
  // Batch size scaling (logarithmic - larger batches = bigger impact)
  const sizeFactor = Math.log((batchSize / 100) + 1) * batchSizeWeight;
  
  // Quality scaling (linear - premium wine failures/achievements matter more)
  const qualityFactor = (1 + wineQuality) * qualityWeight;
  
  // Company prestige scaling (square root - higher prestige = held to higher standards)
  const prestigeFactor = Math.sqrt(Math.max(0.1, companyPrestige) / 5) * companyPrestigeWeight;
  
  // Formula: baseAmount × size × quality × companyPrestige
  const amount = baseAmount * sizeFactor * qualityFactor * prestigeFactor;
  
  // Cap based on positive/negative
  const maxImpact = baseAmount < 0 ? -10.0 : 10.0;
  return baseAmount < 0 
    ? Math.max(maxImpact, amount)
    : Math.min(maxImpact, amount);
}

/**
 * Calculate dynamic prestige for VINEYARD SALE EVENTS (regular sales tied to vineyard)
 * Scales with vineyard PRESTIGE for the achievement
 * 
 * @param baseAmount - Base prestige amount from sale value (already includes saleValue / 10000)
 * @param vineyardPrestige - Current vineyard prestige
 * @returns Calculated prestige amount
 */
export function calculateVineyardSalePrestige(
  baseAmount: number,
  vineyardPrestige: number
): number {
  // Use vineyard prestige as multiplier (existing system)
  // This is for POSITIVE vineyard sales showing vineyard quality
  const prestigeFactor = Math.max(0.1, vineyardPrestige);
  return baseAmount * prestigeFactor;
}

