/**
 * Research Constants
 * Defines available research projects and their properties
 */

import { GrapeVariety, GRAPE_VARIETIES } from '../types/types';
import { calculateGrapeDifficulty } from '../services/wine/features/grapeDifficulty';
import { getGrapeIconSrc } from '../utils/icons';
import { type BuyerLoyaltyLevel } from '@/lib/services/sales/grapeBuyerLoyaltyService';

/**
 * Types of unlocks that research can provide.
 * Only types with active enforcement paths are listed here.
 * Removed: building_type (no game system to enforce it yet).
 */
export type UnlockType = 
      | 'grape'                    // Unlocks a grape variety for planting (enforced in PlantingOptionsModal)
      | 'vineyard_size'            // Unlocks higher total vineyard hectares cap (enforced in LandSearchOptionsModal)
      | 'fermentation_technology'   // Unlocks a fermentation technology/method (enforce in FermentationOptionsModal)
      | 'staff_limit'              // Unlocks higher staff headcount cap (enforced in HireStaffModal)
      | 'wine_feature'             // Unlocks a wine feature capability (enforce in wine feature activation)
      | 'contract_type'            // Legacy alias for sales_channel; kept for backward compatibility
      | 'sales_channel'            // Unlocks a sales channel / customer contract type (enforce in contract generation)
      | 'grape_buyer_slots'        // Adds seasonal grape buyer slots in market generation
      | 'grape_buyer_limit_multiplier' // Multiplies seasonal hard limits for grape buyers
      | 'grape_buyer_multiplier_bonus'; // Adds flat grape buyer price multiplier bonus

/**
 * Generic unlock definition for research projects
 * Each unlock has a type and a value that identifies what is being unlocked
 */
export interface ResearchUnlock {
      type: UnlockType;
      value: string | number; // Identifier for what's being unlocked (grape name, max hectares, tech name, etc.)
      displayName?: string;   // Optional display name for UI (defaults to value)
      metadata?: Record<string, any>; // Additional data if needed (e.g., max hectares for vineyard_size)
}

export type ResearchWorkCurve =
      | { kind: 'linear'; multiplier: number }
      | { kind: 'exponential'; base: number };

export interface ResearchWorkProfile {
      scopeWorkAmount?: number;
      scopeWorkAmountPerComplexity?: number;
      complexityCurve?: ResearchWorkCurve;
      categoryModifier?: number;
      extraInitialWork?: number;
}

export type ResearchPermanentEffect =
      | {
            kind: 'vineyard_health_decay_multiplier';
            multiplier: number;
            description?: string;
      };

export interface ResearchProject {
      id: string;
      title: string;
      description: string;
      complexity: number; // 1-10 scale, affects work and cost calculation
      benefits: string[];
      category: 'administration' | 'projects' | 'technology' | 'agriculture' | 'efficiency' | 'marketing' | 'staff';
      icon?: string;
      rewardAmount?: number; // For grants/projects, the amount received on completion
      prestigeReward?: number; // Prestige points awarded on completion
      unlocks?: ResearchUnlock[]; // Generic unlocks system - can unlock grapes, technologies, limits, etc.
      initialWork?: number; // Extra initial work (work units) added to base RESEARCH_INITIAL_WORK from activityConstants
      baseWorkAmount?: number; // Base work amount (work units) for this research project, scales with complexity
      workProfile?: ResearchWorkProfile; // Generic work-scaling controls for this project
      permanentEffects?: ResearchPermanentEffect[]; // Always-on effects activated once research is completed
      requiredPrestige?: number; // Minimum prestige score required to start this research
      prerequisites?: string[]; // Project IDs that must be completed before this research is available
      requiredCompanyValue?: number; // Minimum company value required to start this research
      requiredBuyerLoyaltyLevel?: BuyerLoyaltyLevel; // Minimum best buyer relationship level
      requiredAchievementIds?: string[]; // Achievement IDs that must be unlocked
}

// ===== RESEARCH CALCULATION CONSTANTS =====

/**
 * Base money cost (€) for research activities by category
 * This is the base monetary investment required to start research
 * Final cost is calculated as: baseCost * (1 + (complexity - 1) * RESEARCH_PROJECT_COMPLEXITY_COST_MULTIPLIER)
 */
export const RESEARCH_BASE_MONEY_COST: Record<ResearchProject['category'], number> = {
      administration: 8000,   // Lower cost, administrative tasks
      projects: 5000,         // Lower cost, grant projects (you get money back)
      technology: 20000,      // Medium-high cost, permanent improvements
      agriculture: 15000,     // Medium cost, agricultural research (grape varieties, etc.)
      efficiency: 18000,      // Medium cost, operational improvements
      marketing: 12000,       // Medium cost, marketing research
      staff: 10000           // Medium cost, staff-related research
};

/**
 * Complexity multipliers for work calculation
 * Higher complexity = more work required
 */
export const RESEARCH_PROJECT_COMPLEXITY_WORK_MULTIPLIER = 0.15; // Each complexity point adds 15% work

export const RESEARCH_PROJECT_COMPLEXITY_COST_MULTIPLIER = 0.20; // Each complexity point adds 20% cost

// Generic prestige scaling from research complexity, shared by all research types.
const RESEARCH_PRESTIGE_PER_COMPLEXITY = 2;
const RESEARCH_PRESTIGE_COMPLEXITY_OFFSET = -2;
const RESEARCH_MIN_PRESTIGE_REWARD = 1;
const RESEARCH_MAX_PRESTIGE_REWARD = 15;

// Grape-specific difficulty-to-research mappings.
// These convert grape domain difficulty (0-1) into standard research attributes.
const GRAPE_DIFFICULTY_TO_COMPLEXITY_SCALE = 8;
const GRAPE_DIFFICULTY_TO_COMPLEXITY_OFFSET = 2;
const GRAPE_MIN_RESEARCH_COMPLEXITY = 2;
const GRAPE_MAX_RESEARCH_COMPLEXITY = 10;

// ===== GRAPE RESEARCH HELPERS =====

/**
 * Calculate complexity (1-10) from grape difficulty (0-1)
 * Maps grape-domain difficulty score into the generic research complexity axis.
 */
function mapGrapeDifficultyToResearchComplexity(difficultyScore: number): number {
  // Map 0-1 difficulty to 1-10 complexity
  // Minimum complexity is 2, maximum is 10
      return Math.max(
            GRAPE_MIN_RESEARCH_COMPLEXITY,
            Math.min(
                  GRAPE_MAX_RESEARCH_COMPLEXITY,
                  Math.ceil(difficultyScore * GRAPE_DIFFICULTY_TO_COMPLEXITY_SCALE) + GRAPE_DIFFICULTY_TO_COMPLEXITY_OFFSET
            )
      );
}

/**
 * Calculate prestige reward from normalized research complexity (1-10)
 * Shared by all research categories
 */
function calculateResearchPrestigeFromComplexity(complexity: number): number {
  // Linear prestige scaling with cap to avoid runaway rewards at top complexity.
      return Math.max(
            RESEARCH_MIN_PRESTIGE_REWARD,
            Math.min(
                  RESEARCH_MAX_PRESTIGE_REWARD,
                  (complexity * RESEARCH_PRESTIGE_PER_COMPLEXITY) + RESEARCH_PRESTIGE_COMPLEXITY_OFFSET
            )
      );
}

/**
 * Create a grape research project based on grape variety
 * Automatically calculates complexity and prestige from difficulty
 */
function createGrapeResearchProject(grape: GrapeVariety): ResearchProject {
      const grapeDifficulty = calculateGrapeDifficulty(grape);
      const complexity = mapGrapeDifficultyToResearchComplexity(grapeDifficulty.score);
      const prestigeReward = calculateResearchPrestigeFromComplexity(complexity);
  const iconPath = getGrapeIconSrc(grape);
  
  // Create project ID from grape name (e.g., "Pinot Noir" -> "agri_pinot_noir")
  const projectId = `agri_${grape.toLowerCase().replace(/\s+/g, '_')}`;
  
      // Grape research uses a generic work profile so the calculator can stay reusable
      // while still scaling scope by complexity.
      const workProfile: ResearchWorkProfile = {
            scopeWorkAmountPerComplexity: 50,
            complexityCurve: {
                  kind: 'linear',
                  multiplier: RESEARCH_PROJECT_COMPLEXITY_WORK_MULTIPLIER
            }
      };

  // Prestige gate based on complexity: rare/difficult grapes require an established winery
  // complexity 2-4: always available (0), 5-7: established winery (10), 8-10: known winery (25)
  let requiredPrestige: number | undefined;
  if (complexity >= 8) requiredPrestige = 25;
  else if (complexity >= 5) requiredPrestige = 10;
  
  return {
    id: projectId,
    title: `${grape} Grape Research`,
    description: `Research and develop expertise in cultivating ${grape} grapes`,
    complexity,
    benefits: [
      `Unlock ${grape} grape variety for planting`,
      `Learn optimal growing conditions for ${grape}`,
      `+${prestigeReward.toFixed(1)} Prestige points`
    ],
    category: 'agriculture',
    icon: iconPath, // Use image path instead of emoji
    prestigeReward,
    unlocks: [{ type: 'grape', value: grape }],
            workProfile,
    ...(requiredPrestige !== undefined ? { requiredPrestige } : {})
  };
}

// ===== AVAILABLE RESEARCH PROJECTS =====

/**
 * Available research projects
 */
export const RESEARCH_PROJECTS: ResearchProject[] = [
      // ===== ADMINISTRATION =====
      {
            id: 'admin_basic',
            title: 'Basic Administration',
            description: 'Improve administrative processes and documentation',
            complexity: 2,
            benefits: [
                  'Reduced administrative overhead',
                  'Better record keeping',
                  `+${calculateResearchPrestigeFromComplexity(2)} Prestige points`
            ],
            category: 'administration',
            icon: '📋',
            prestigeReward: calculateResearchPrestigeFromComplexity(2)
      },
      
      // ===== PROJECTS (Grants) =====
      {
            id: 'project_grant_basic',
            title: 'Basic Research Grant',
            description: 'Apply for a basic research grant to fund vineyard improvements',
            complexity: 3,
            benefits: [
                  'Receive €15,000 grant funding',
                  `+${calculateResearchPrestigeFromComplexity(3)} Prestige points`,
                  'Establishes track record for advanced grant applications'
            ],
            category: 'projects',
            icon: '💰',
            rewardAmount: 15000,
            prestigeReward: calculateResearchPrestigeFromComplexity(3)
      },
      {
            id: 'project_grant_advanced',
            title: 'Advanced Research Grant',
            description: 'Secure funding for advanced viticulture research — requires an established track record',
            complexity: 7,
            benefits: [
                  'Receive €40,000 grant funding',
                  `+${calculateResearchPrestigeFromComplexity(7)} Prestige points`,
                  'Opens premium research funding opportunities'
            ],
            category: 'projects',
            icon: '🏆',
            rewardAmount: 40000,
            prestigeReward: calculateResearchPrestigeFromComplexity(7),
            requiredPrestige: 10,
            prerequisites: ['project_grant_basic']
      },
      
      // ===== TECHNOLOGY =====
      {
            id: 'tech_soil_analysis',
            title: 'Soil Analysis Technology',
            description: 'Research advanced soil analysis techniques to better understand your terroir',
            complexity: 5,
            benefits: [
                  'Improved vineyard quality assessment',
                  'Better land purchase decisions',
                  `+${calculateResearchPrestigeFromComplexity(5)} Prestige points`
            ],
            category: 'technology',
            icon: '🔬',
            prestigeReward: calculateResearchPrestigeFromComplexity(5),
            requiredPrestige: 15,
            workProfile: {
                  scopeWorkAmount: 100,
                  complexityCurve: { kind: 'linear', multiplier: 0.18 },
                  categoryModifier: 0.15,
                  extraInitialWork: 20
            }
      },
      {
            id: 'tech_fermentation',
            title: 'Fermentation Technology Basics',
            description: 'Foundational study of controlled fermentation methods — prerequisite for advanced techniques',
            complexity: 6,
            benefits: [
                  'Unlocks Temperature Controlled fermentation method',
                  'Foundation for advanced fermentation research',
                  `+${calculateResearchPrestigeFromComplexity(6)} Prestige points`
            ],
            category: 'technology',
            icon: '🧪',
            prestigeReward: calculateResearchPrestigeFromComplexity(6),
            requiredPrestige: 15,
            prerequisites: ['admin_basic'],
            unlocks: [{ type: 'fermentation_technology', value: 'Temperature Controlled', displayName: 'Temperature Controlled fermentation' }],
            workProfile: {
                  scopeWorkAmount: 130,
                  complexityCurve: { kind: 'exponential', base: 1.08 },
                  categoryModifier: 0.2,
                  extraInitialWork: 30
            }
      },
      {
            id: 'tech_fermentation_extended',
            title: 'Extended Maceration Protocols',
            description: 'Develop advanced skin-contact control to safely run extended maceration at scale.',
            complexity: 7,
            benefits: [
                  'Unlocks Extended Maceration fermentation method',
                  'Improves process control for high-structure wines',
                  `+${calculateResearchPrestigeFromComplexity(7)} Prestige points`
            ],
            category: 'technology',
            icon: '🍷',
            prestigeReward: calculateResearchPrestigeFromComplexity(7),
            requiredPrestige: 24,
            prerequisites: ['tech_fermentation'],
            unlocks: [{ type: 'fermentation_technology', value: 'Extended Maceration', displayName: 'Extended Maceration fermentation' }],
            workProfile: {
                  scopeWorkAmount: 175,
                  complexityCurve: { kind: 'exponential', base: 1.09 },
                  categoryModifier: 0.22,
                  extraInitialWork: 45
            }
      },
      {
            id: 'tech_vineyard_health_monitoring',
            title: 'Vineyard Health Monitoring System',
            description: 'Implement systematic diagnostics and preventive care planning to reduce long-term vineyard health decay.',
            complexity: 6,
            benefits: [
                  'Reduces weekly vineyard health decay by 20%',
                  'Improves resilience against seasonal wear',
                  `+${calculateResearchPrestigeFromComplexity(6)} Prestige points`
            ],
            category: 'technology',
            icon: '🩺',
            prestigeReward: calculateResearchPrestigeFromComplexity(6),
            requiredPrestige: 20,
            prerequisites: ['tech_soil_analysis'],
            permanentEffects: [{
                  kind: 'vineyard_health_decay_multiplier',
                  multiplier: 0.8,
                  description: 'Reduce weekly vineyard health decay by 20%'
            }],
            workProfile: {
                  scopeWorkAmount: 155,
                  complexityCurve: { kind: 'exponential', base: 1.08 },
                  categoryModifier: 0.2,
                  extraInitialWork: 34
            }
      },
      
      // ===== AGRICULTURE (Grape Research) =====
      // Grape research projects are automatically generated based on difficulty
      ...GRAPE_VARIETIES.map(grape => createGrapeResearchProject(grape)),
      
      // ===== EFFICIENCY =====
      {
            id: 'eff_microplot_management',
            title: 'Microplot Management',
            description: 'Establish operating discipline for very small vineyard parcels.',
            complexity: 2,
            benefits: [
                  'Raises total vineyard capacity to 0.25 hectares',
                  `+${calculateResearchPrestigeFromComplexity(2)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🌱',
            prestigeReward: calculateResearchPrestigeFromComplexity(2),
            requiredPrestige: 2,
            prerequisites: ['admin_basic'],
            unlocks: [{ type: 'vineyard_size', value: 0.25, displayName: '0.25 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 45,
                  complexityCurve: { kind: 'linear', multiplier: 0.12 },
                  categoryModifier: 0.08,
                  extraInitialWork: 8
            }
      },
      {
            id: 'eff_smallholding_operations',
            title: 'Smallholding Operations',
            description: 'Standardize small-estate routines for reliable half-hectare operations.',
            complexity: 3,
            benefits: [
                  'Raises total vineyard capacity to 0.5 hectares',
                  `+${calculateResearchPrestigeFromComplexity(3)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🧺',
            prestigeReward: calculateResearchPrestigeFromComplexity(3),
            requiredPrestige: 5,
            prerequisites: ['eff_microplot_management'],
            unlocks: [{ type: 'vineyard_size', value: 0.5, displayName: '0.5 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 65,
                  complexityCurve: { kind: 'linear', multiplier: 0.13 },
                  categoryModifier: 0.1,
                  extraInitialWork: 12
            }
      },
      {
            id: 'eff_estate_foundations',
            title: 'Estate Foundations',
            description: 'Build foundational workflows for full one-hectare estate management.',
            complexity: 4,
            benefits: [
                  'Raises total vineyard capacity to 1 hectare',
                  `+${calculateResearchPrestigeFromComplexity(4)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🏡',
            prestigeReward: calculateResearchPrestigeFromComplexity(4),
            requiredPrestige: 9,
            prerequisites: ['eff_smallholding_operations'],
            unlocks: [{ type: 'vineyard_size', value: 1, displayName: '1 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 85,
                  complexityCurve: { kind: 'linear', multiplier: 0.15 },
                  categoryModifier: 0.12,
                  extraInitialWork: 18
            }
      },
      {
            id: 'eff_operational',
            title: 'Operational Efficiency',
            description: 'Research methods to improve overall operational efficiency across the winery',
            complexity: 6,
            benefits: [
                  'Operational improvements across winery activities',
                  'Raises total vineyard capacity to 2 hectares',
                  'Better resource planning',
                  `+${calculateResearchPrestigeFromComplexity(6)} Prestige points`
            ],
            category: 'efficiency',
            icon: '⚡',
            prestigeReward: calculateResearchPrestigeFromComplexity(6),
            requiredPrestige: 20,
            prerequisites: ['eff_estate_foundations'],
            unlocks: [{ type: 'vineyard_size', value: 2, displayName: '2 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 120,
                  complexityCurve: { kind: 'linear', multiplier: 0.2 },
                  categoryModifier: 0.15,
                  extraInitialWork: 35
            }
      },
      {
            id: 'eff_site_expansion',
            title: 'Estate Expansion Planning',
            description: 'Professionalize expansion planning and utility layout to support a larger vineyard footprint.',
            complexity: 7,
            benefits: [
                  'Raises total vineyard capacity to 4 hectares',
                  'Improves long-term site expansion planning',
                  `+${calculateResearchPrestigeFromComplexity(7)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🗺️',
            prestigeReward: calculateResearchPrestigeFromComplexity(7),
            requiredPrestige: 28,
            requiredCompanyValue: 900000,
            prerequisites: ['eff_operational'],
            unlocks: [{ type: 'vineyard_size', value: 4, displayName: '4 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 170,
                  complexityCurve: { kind: 'exponential', base: 1.07 },
                  categoryModifier: 0.2,
                  extraInitialWork: 45
            }
      },
      {
            id: 'eff_estate_scale',
            title: 'Estate-Scale Infrastructure',
            description: 'Coordinate roads, storage, and utility scaling to support full estate expansion.',
            complexity: 9,
            benefits: [
                  'Raises total vineyard capacity to 8 hectares',
                  'Unlocks robust estate-scale operating capacity',
                  `+${calculateResearchPrestigeFromComplexity(9)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🏗️',
            prestigeReward: calculateResearchPrestigeFromComplexity(9),
            requiredPrestige: 42,
            requiredCompanyValue: 2400000,
            prerequisites: ['eff_site_expansion'],
            unlocks: [{ type: 'vineyard_size', value: 8, displayName: '8 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 230,
                  complexityCurve: { kind: 'exponential', base: 1.09 },
                  categoryModifier: 0.22,
                  extraInitialWork: 60
            }
      },
      {
            id: 'eff_regional_holdings',
            title: 'Regional Holdings Blueprint',
            description: 'Standardize planning for managing multiple large vineyard parcels across the same region.',
            complexity: 9,
            benefits: [
                  'Raises total vineyard capacity to 16 hectares',
                  `+${calculateResearchPrestigeFromComplexity(9)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🧭',
            prestigeReward: calculateResearchPrestigeFromComplexity(9),
            requiredPrestige: 52,
            requiredCompanyValue: 4500000,
            prerequisites: ['eff_estate_scale'],
            unlocks: [{ type: 'vineyard_size', value: 16, displayName: '16 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 290,
                  complexityCurve: { kind: 'exponential', base: 1.1 },
                  categoryModifier: 0.24,
                  extraInitialWork: 75
            }
      },
      {
            id: 'eff_networked_estates',
            title: 'Networked Estate Operations',
            description: 'Integrate logistics, storage, and staffing between vineyards to run a distributed estate network.',
            complexity: 10,
            benefits: [
                  'Raises total vineyard capacity to 32 hectares',
                  `+${calculateResearchPrestigeFromComplexity(10)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🔗',
            prestigeReward: calculateResearchPrestigeFromComplexity(10),
            requiredPrestige: 62,
            requiredCompanyValue: 7000000,
            prerequisites: ['eff_regional_holdings'],
            unlocks: [{ type: 'vineyard_size', value: 32, displayName: '32 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 360,
                  complexityCurve: { kind: 'exponential', base: 1.1 },
                  categoryModifier: 0.25,
                  extraInitialWork: 90
            }
      },
      {
            id: 'eff_industrial_fleet_management',
            title: 'Industrial Fleet Management',
            description: 'Build tractor, transport, and intake fleet planning for high-throughput vineyard operations.',
            complexity: 10,
            benefits: [
                  'Raises total vineyard capacity to 64 hectares',
                  `+${calculateResearchPrestigeFromComplexity(10)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🚜',
            prestigeReward: calculateResearchPrestigeFromComplexity(10),
            requiredPrestige: 72,
            requiredCompanyValue: 10000000,
            prerequisites: ['eff_networked_estates'],
            unlocks: [{ type: 'vineyard_size', value: 64, displayName: '64 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 430,
                  complexityCurve: { kind: 'exponential', base: 1.11 },
                  categoryModifier: 0.26,
                  extraInitialWork: 100
            }
      },
      {
            id: 'eff_land_portfolio_management',
            title: 'Land Portfolio Management',
            description: 'Coordinate long-horizon planning and capital deployment for a large vineyard land portfolio.',
            complexity: 10,
            benefits: [
                  'Raises total vineyard capacity to 128 hectares',
                  `+${calculateResearchPrestigeFromComplexity(10)} Prestige points`
            ],
            category: 'efficiency',
            icon: '📈',
            prestigeReward: calculateResearchPrestigeFromComplexity(10),
            requiredPrestige: 84,
            requiredCompanyValue: 16000000,
            prerequisites: ['eff_industrial_fleet_management'],
            unlocks: [{ type: 'vineyard_size', value: 128, displayName: '128 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 520,
                  complexityCurve: { kind: 'exponential', base: 1.11 },
                  categoryModifier: 0.27,
                  extraInitialWork: 120
            }
      },
      {
            id: 'eff_megavineyard_control',
            title: 'Megavineyard Control Systems',
            description: 'Deploy robust operating systems for monitoring and controlling very large vineyard footprints.',
            complexity: 10,
            benefits: [
                  'Raises total vineyard capacity to 256 hectares',
                  `+${calculateResearchPrestigeFromComplexity(10)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🛰️',
            prestigeReward: calculateResearchPrestigeFromComplexity(10),
            requiredPrestige: 96,
            requiredCompanyValue: 25000000,
            prerequisites: ['eff_land_portfolio_management'],
            unlocks: [{ type: 'vineyard_size', value: 256, displayName: '256 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 620,
                  complexityCurve: { kind: 'exponential', base: 1.12 },
                  categoryModifier: 0.28,
                  extraInitialWork: 140
            }
      },
      {
            id: 'eff_agri_enterprise_planning',
            title: 'Agri-Enterprise Planning Office',
            description: 'Formalize enterprise-level planning for cross-region vineyard management and scaling.',
            complexity: 10,
            benefits: [
                  'Raises total vineyard capacity to 512 hectares',
                  `+${calculateResearchPrestigeFromComplexity(10)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🏢',
            prestigeReward: calculateResearchPrestigeFromComplexity(10),
            requiredPrestige: 110,
            requiredCompanyValue: 40000000,
            prerequisites: ['eff_megavineyard_control'],
            unlocks: [{ type: 'vineyard_size', value: 512, displayName: '512 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 740,
                  complexityCurve: { kind: 'exponential', base: 1.12 },
                  categoryModifier: 0.29,
                  extraInitialWork: 165
            }
      },
      {
            id: 'eff_global_land_network',
            title: 'Global Land Network',
            description: 'Structure governance and resource control for a global-scale vineyard asset network.',
            complexity: 10,
            benefits: [
                  'Raises total vineyard capacity to 1000 hectares',
                  `+${calculateResearchPrestigeFromComplexity(10)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🌐',
            prestigeReward: calculateResearchPrestigeFromComplexity(10),
            requiredPrestige: 125,
            requiredCompanyValue: 65000000,
            prerequisites: ['eff_agri_enterprise_planning'],
            unlocks: [{ type: 'vineyard_size', value: 1000, displayName: '1000 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 880,
                  complexityCurve: { kind: 'exponential', base: 1.13 },
                  categoryModifier: 0.3,
                  extraInitialWork: 190
            }
      },
      {
            id: 'eff_superestate_command',
            title: 'Superestate Command Center',
            description: 'Coordinate governance, logistics, and financial planning for ultra-large vineyard holdings.',
            complexity: 10,
            benefits: [
                  'Raises total vineyard capacity to 2000 hectares',
                  `+${calculateResearchPrestigeFromComplexity(10)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🏛️',
            prestigeReward: calculateResearchPrestigeFromComplexity(10),
            requiredPrestige: 140,
            requiredCompanyValue: 100000000,
            prerequisites: ['eff_global_land_network'],
            unlocks: [{ type: 'vineyard_size', value: 2000, displayName: '2000 ha vineyard cap' }],
            workProfile: {
                  scopeWorkAmount: 1040,
                  complexityCurve: { kind: 'exponential', base: 1.13 },
                  categoryModifier: 0.31,
                  extraInitialWork: 220
            }
      },
      
      // ===== MARKETING =====
      {
            id: 'mkt_research',
            title: 'Marketing Research',
            description: 'Study market trends, regional customer preferences, and pricing strategies',
            complexity: 4,
            benefits: [
                  'Better understanding of customer preferences',
                  'Improved price estimation',
                  `+${calculateResearchPrestigeFromComplexity(4)} Prestige points`
            ],
            category: 'marketing',
            icon: '📊',
            prestigeReward: calculateResearchPrestigeFromComplexity(4),
            requiredPrestige: 10
      },
      {
            id: 'mkt_restaurant_program',
            title: 'Restaurant Partnership Program',
            description: 'Develop chef-facing partnership workflows and service-level standards for restaurant buyers.',
            complexity: 5,
            benefits: [
                  'Unlocks Restaurant contract type',
                  `+${calculateResearchPrestigeFromComplexity(5)} Prestige points`
            ],
            category: 'marketing',
            icon: '🍽️',
            prestigeReward: calculateResearchPrestigeFromComplexity(5),
            requiredPrestige: 14,
            prerequisites: ['mkt_research'],
            unlocks: [{ type: 'sales_channel', value: 'Restaurant', displayName: 'Restaurant contracts' }],
            workProfile: {
                  scopeWorkAmount: 105,
                  complexityCurve: { kind: 'linear', multiplier: 0.16 },
                  categoryModifier: -0.02,
                  extraInitialWork: 18
            }
      },
      {
            id: 'mkt_collector_relations',
            title: 'Collector Relations Desk',
            description: 'Build premium customer curation and authenticity workflows for collector-facing contracts.',
            complexity: 7,
            benefits: [
                  'Unlocks Private Collector contract type',
                  `+${calculateResearchPrestigeFromComplexity(7)} Prestige points`
            ],
            category: 'marketing',
            icon: '🕯️',
            prestigeReward: calculateResearchPrestigeFromComplexity(7),
            requiredPrestige: 28,
            requiredCompanyValue: 1100000,
            prerequisites: ['mkt_restaurant_program'],
            unlocks: [{ type: 'sales_channel', value: 'Private Collector', displayName: 'Private Collector contracts' }],
            workProfile: {
                  scopeWorkAmount: 165,
                  complexityCurve: { kind: 'exponential', base: 1.08 },
                  categoryModifier: 0,
                  extraInitialWork: 38
            }
      },
      {
            id: 'mkt_chain_distribution',
            title: 'Chain Distribution Network',
            description: 'Coordinate compliance, volume planning, and reporting required by chain-store buyers.',
            complexity: 8,
            benefits: [
                  'Unlocks Chain Store contract type',
                  `+${calculateResearchPrestigeFromComplexity(8)} Prestige points`
            ],
            category: 'marketing',
            icon: '🏪',
            prestigeReward: calculateResearchPrestigeFromComplexity(8),
            requiredPrestige: 36,
            requiredCompanyValue: 2000000,
            prerequisites: ['mkt_collector_relations'],
            unlocks: [{ type: 'sales_channel', value: 'Chain Store', displayName: 'Chain Store contracts' }],
            workProfile: {
                  scopeWorkAmount: 210,
                  complexityCurve: { kind: 'exponential', base: 1.09 },
                  categoryModifier: 0.03,
                  extraInitialWork: 52
            }
      },
      {
            id: 'mkt_vintner_network',
            title: 'Vintner Network Expansion',
            description: 'Build stronger merchant pipelines and region-wide broker relationships.',
            complexity: 6,
            benefits: [
                  '+1 additional seasonal grape buyer option',
                  `+${calculateResearchPrestigeFromComplexity(6)} Prestige points`
            ],
            category: 'marketing',
            icon: '🛰️',
            prestigeReward: calculateResearchPrestigeFromComplexity(6),
            requiredPrestige: 20,
            requiredBuyerLoyaltyLevel: 1,
            requiredAchievementIds: ['bulk_grape_kg_sold_tier_1'],
            prerequisites: ['mkt_research'],
            unlocks: [{ type: 'grape_buyer_slots', value: 1, displayName: '+1 seasonal buyer slot' }]
      },
      {
            id: 'mkt_export_alliances',
            title: 'Export Alliance Desk',
            description: 'Coordinate export-focused partnerships to attract a larger buyer roster.',
            complexity: 8,
            benefits: [
                  '+1 additional seasonal grape buyer option',
                  `+${calculateResearchPrestigeFromComplexity(8)} Prestige points`
            ],
            category: 'marketing',
            icon: '🌍',
            prestigeReward: calculateResearchPrestigeFromComplexity(8),
            requiredPrestige: 35,
            requiredCompanyValue: 1200000,
            requiredBuyerLoyaltyLevel: 2,
            requiredAchievementIds: ['bulk_grape_kg_sold_tier_2'],
            prerequisites: ['mkt_vintner_network'],
            unlocks: [{ type: 'grape_buyer_slots', value: 1, displayName: '+1 seasonal buyer slot' }]
      },
      {
            id: 'eff_bulk_chain_optimization',
            title: 'Bulk Chain Optimization',
            description: 'Improve transport, storage, and intake flow to increase buyer throughput limits.',
            complexity: 6,
            benefits: [
                  '+15% grape buyer seasonal hard limits',
                  `+${calculateResearchPrestigeFromComplexity(6)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🚚',
            prestigeReward: calculateResearchPrestigeFromComplexity(6),
            requiredPrestige: 22,
            prerequisites: ['eff_operational'],
            unlocks: [{ type: 'grape_buyer_limit_multiplier', value: 0.15, displayName: '+15% buyer seasonal limit' }],
            workProfile: {
                  scopeWorkAmount: 150,
                  complexityCurve: { kind: 'linear', multiplier: 0.22 },
                  categoryModifier: 0.18,
                  extraInitialWork: 40
            }
      },
      {
            id: 'eff_contract_fulfillment_grid',
            title: 'Fulfillment Grid Control',
            description: 'Coordinate intake timing and dispatch windows to secure higher buyer allocations.',
            complexity: 8,
            benefits: [
                  '+20% additional grape buyer seasonal hard limits',
                  `+${calculateResearchPrestigeFromComplexity(8)} Prestige points`
            ],
            category: 'efficiency',
            icon: '🧩',
            prestigeReward: calculateResearchPrestigeFromComplexity(8),
            requiredPrestige: 35,
            requiredCompanyValue: 2000000,
            requiredBuyerLoyaltyLevel: 2,
            requiredAchievementIds: ['bulk_grape_sales_tier_2'],
            prerequisites: ['eff_bulk_chain_optimization'],
            unlocks: [{ type: 'grape_buyer_limit_multiplier', value: 0.2, displayName: '+20% buyer seasonal limit' }],
            workProfile: {
                  scopeWorkAmount: 220,
                  complexityCurve: { kind: 'exponential', base: 1.08 },
                  categoryModifier: 0.2,
                  extraInitialWork: 55
            }
      },
      {
            id: 'tech_market_signal_engine',
            title: 'Market Signal Engine',
            description: 'Model buyer demand shifts and improve negotiation outcomes in grape deals.',
            complexity: 7,
            benefits: [
                  '+0.04 grape buyer multiplier bonus',
                  `+${calculateResearchPrestigeFromComplexity(7)} Prestige points`
            ],
            category: 'technology',
            icon: '📡',
            prestigeReward: calculateResearchPrestigeFromComplexity(7),
            requiredPrestige: 28,
            requiredAchievementIds: ['bulk_grape_kg_sold_tier_1'],
            prerequisites: ['tech_soil_analysis'],
            unlocks: [{ type: 'grape_buyer_multiplier_bonus', value: 0.04, displayName: '+0.04 buyer multiplier' }],
            workProfile: {
                  scopeWorkAmount: 180,
                  complexityCurve: { kind: 'exponential', base: 1.08 },
                  categoryModifier: 0.2,
                  extraInitialWork: 50
            }
      },
      {
            id: 'tech_negotiation_ai_cellar',
            title: 'Negotiation AI Cellar Desk',
            description: 'Deploy advanced pricing heuristics to improve final buyer multipliers.',
            complexity: 9,
            benefits: [
                  '+0.06 additional grape buyer multiplier bonus',
                  `+${calculateResearchPrestigeFromComplexity(9)} Prestige points`
            ],
            category: 'technology',
            icon: '🤖',
            prestigeReward: calculateResearchPrestigeFromComplexity(9),
            requiredPrestige: 45,
            requiredCompanyValue: 3000000,
            requiredBuyerLoyaltyLevel: 3,
            requiredAchievementIds: ['bulk_grape_sales_tier_3'],
            prerequisites: ['tech_market_signal_engine'],
            unlocks: [{ type: 'grape_buyer_multiplier_bonus', value: 0.06, displayName: '+0.06 buyer multiplier' }],
            workProfile: {
                  scopeWorkAmount: 260,
                  complexityCurve: { kind: 'exponential', base: 1.1 },
                  categoryModifier: 0.24,
                  extraInitialWork: 70
            }
      },
      
      // ===== STAFF =====
      {
            id: 'staff_onboarding_program',
            title: 'Staff Onboarding Program',
            description: 'Create hiring playbooks and role onboarding standards to safely grow the team.',
            complexity: 3,
            benefits: [
                  'Raises staff capacity to 3 employees',
                  'Improves onboarding consistency',
                  `+${calculateResearchPrestigeFromComplexity(3)} Prestige points`
            ],
            category: 'staff',
            icon: '🧾',
            prestigeReward: calculateResearchPrestigeFromComplexity(3),
            requiredPrestige: 6,
            unlocks: [{ type: 'staff_limit', value: 3, displayName: '3 staff cap' }],
            workProfile: {
                  scopeWorkAmount: 70,
                  complexityCurve: { kind: 'linear', multiplier: 0.14 },
                  categoryModifier: 0.06,
                  extraInitialWork: 10
            }
      },
      {
            id: 'staff_training',
            title: 'Staff Training Programs',
            description: 'Develop structured training programs for winery and vineyard staff',
            complexity: 5,
            benefits: [
                  'Raises staff capacity to 5 employees',
                  'Structured staff development framework',
                  'Improved staff retention',
                  `+${calculateResearchPrestigeFromComplexity(5)} Prestige points`
            ],
            category: 'staff',
            icon: '👥',
            prestigeReward: calculateResearchPrestigeFromComplexity(5),
            requiredPrestige: 10,
            prerequisites: ['staff_onboarding_program'],
            unlocks: [{ type: 'staff_limit', value: 5, displayName: '5 staff cap' }],
            workProfile: {
                  scopeWorkAmount: 120,
                  complexityCurve: { kind: 'linear', multiplier: 0.16 },
                  categoryModifier: 0.08,
                  extraInitialWork: 20
            }
      },
      {
            id: 'staff_leadership_pipeline',
            title: 'Leadership Pipeline',
            description: 'Formalize lead roles and mentoring so larger teams remain effective and coordinated.',
            complexity: 7,
            benefits: [
                  'Raises staff capacity to 7 employees',
                  'Improves team scaling and retention',
                  `+${calculateResearchPrestigeFromComplexity(7)} Prestige points`
            ],
            category: 'staff',
            icon: '🧑‍💼',
            prestigeReward: calculateResearchPrestigeFromComplexity(7),
            requiredPrestige: 26,
            requiredCompanyValue: 1200000,
            prerequisites: ['staff_training'],
            unlocks: [{ type: 'staff_limit', value: 7, displayName: '7 staff cap' }],
            workProfile: {
                  scopeWorkAmount: 180,
                  complexityCurve: { kind: 'exponential', base: 1.07 },
                  categoryModifier: 0.1,
                  extraInitialWork: 40
            }
      },
      {
            id: 'staff_operational_management',
            title: 'Operational Management Framework',
            description: 'Define role responsibilities and shift coordination to support a larger operational team.',
            complexity: 8,
            benefits: [
                  'Raises staff capacity to 10 employees',
                  `+${calculateResearchPrestigeFromComplexity(8)} Prestige points`
            ],
            category: 'staff',
            icon: '📋',
            prestigeReward: calculateResearchPrestigeFromComplexity(8),
            requiredPrestige: 34,
            requiredCompanyValue: 2200000,
            prerequisites: ['staff_leadership_pipeline'],
            unlocks: [{ type: 'staff_limit', value: 10, displayName: '10 staff cap' }],
            workProfile: {
                  scopeWorkAmount: 230,
                  complexityCurve: { kind: 'exponential', base: 1.07 },
                  categoryModifier: 0.11,
                  extraInitialWork: 50
            }
      },
      {
            id: 'staff_department_structure',
            title: 'Department Structure Program',
            description: 'Establish specialist teams and reporting structures for multi-function operations.',
            complexity: 8,
            benefits: [
                  'Raises staff capacity to 15 employees',
                  `+${calculateResearchPrestigeFromComplexity(8)} Prestige points`
            ],
            category: 'staff',
            icon: '🗂️',
            prestigeReward: calculateResearchPrestigeFromComplexity(8),
            requiredPrestige: 44,
            requiredCompanyValue: 3500000,
            prerequisites: ['staff_operational_management'],
            unlocks: [{ type: 'staff_limit', value: 15, displayName: '15 staff cap' }],
            workProfile: {
                  scopeWorkAmount: 280,
                  complexityCurve: { kind: 'exponential', base: 1.08 },
                  categoryModifier: 0.12,
                  extraInitialWork: 60
            }
      },
      {
            id: 'staff_operations_hub',
            title: 'Operations Hub Command',
            description: 'Centralize scheduling and workforce assignment for high-output seasons.',
            complexity: 9,
            benefits: [
                  'Raises staff capacity to 25 employees',
                  `+${calculateResearchPrestigeFromComplexity(9)} Prestige points`
            ],
            category: 'staff',
            icon: '🏭',
            prestigeReward: calculateResearchPrestigeFromComplexity(9),
            requiredPrestige: 56,
            requiredCompanyValue: 5500000,
            prerequisites: ['staff_department_structure'],
            unlocks: [{ type: 'staff_limit', value: 25, displayName: '25 staff cap' }],
            workProfile: {
                  scopeWorkAmount: 360,
                  complexityCurve: { kind: 'exponential', base: 1.08 },
                  categoryModifier: 0.13,
                  extraInitialWork: 75
            }
      },
      {
            id: 'staff_enterprise_coordination',
            title: 'Enterprise Coordination Office',
            description: 'Coordinate large staffing pools with clear operating cadences and accountability.',
            complexity: 9,
            benefits: [
                  'Raises staff capacity to 40 employees',
                  `+${calculateResearchPrestigeFromComplexity(9)} Prestige points`
            ],
            category: 'staff',
            icon: '🏢',
            prestigeReward: calculateResearchPrestigeFromComplexity(9),
            requiredPrestige: 68,
            requiredCompanyValue: 8500000,
            prerequisites: ['staff_operations_hub'],
            unlocks: [{ type: 'staff_limit', value: 40, displayName: '40 staff cap' }],
            workProfile: {
                  scopeWorkAmount: 460,
                  complexityCurve: { kind: 'exponential', base: 1.09 },
                  categoryModifier: 0.14,
                  extraInitialWork: 95
            }
      },
      {
            id: 'staff_multiestate_hr',
            title: 'Multi-Estate HR Systems',
            description: 'Deploy enterprise hiring, retention, and role planning across multiple operating sites.',
            complexity: 10,
            benefits: [
                  'Raises staff capacity to 60 employees',
                  `+${calculateResearchPrestigeFromComplexity(10)} Prestige points`
            ],
            category: 'staff',
            icon: '🌍',
            prestigeReward: calculateResearchPrestigeFromComplexity(10),
            requiredPrestige: 84,
            requiredCompanyValue: 13000000,
            prerequisites: ['staff_enterprise_coordination'],
            unlocks: [{ type: 'staff_limit', value: 60, displayName: '60 staff cap' }],
            workProfile: {
                  scopeWorkAmount: 580,
                  complexityCurve: { kind: 'exponential', base: 1.09 },
                  categoryModifier: 0.15,
                  extraInitialWork: 120
            }
      },
      {
            id: 'staff_corporate_scale',
            title: 'Corporate Scale Workforce',
            description: 'Structure governance and workforce control systems for corporation-level staffing.',
            complexity: 10,
            benefits: [
                  'Raises staff capacity to 100 employees',
                  `+${calculateResearchPrestigeFromComplexity(10)} Prestige points`
            ],
            category: 'staff',
            icon: '🏛️',
            prestigeReward: calculateResearchPrestigeFromComplexity(10),
            requiredPrestige: 102,
            requiredCompanyValue: 22000000,
            prerequisites: ['staff_multiestate_hr'],
            unlocks: [{ type: 'staff_limit', value: 100, displayName: '100 staff cap' }],
            workProfile: {
                  scopeWorkAmount: 720,
                  complexityCurve: { kind: 'exponential', base: 1.1 },
                  categoryModifier: 0.16,
                  extraInitialWork: 150
            }
      }
];

// ===== HELPER FUNCTIONS =====

/**
 * Get research project by ID
 */
export function getResearchProject(id: string): ResearchProject | undefined {
      return RESEARCH_PROJECTS.find(project => project.id === id);
}

/**
 * Get research projects by category
 */
export function getResearchProjectsByCategory(category: ResearchProject['category']): ResearchProject[] {
      return RESEARCH_PROJECTS.filter(project => project.category === category);
}


