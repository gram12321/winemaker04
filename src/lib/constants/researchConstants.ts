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
      | 'vineyard_size'            // Unlocks higher max size per vineyard (enforced in LandSearch modals)
      | 'total_vineyard_hectares'  // Unlocks higher total owned vineyard hectares cap
      | 'vineyard_count'           // Unlocks higher total vineyard count cap
      | 'fermentation_technology'   // Unlocks a fermentation technology/method (enforce in FermentationOptionsModal)
      | 'staff_limit'              // Unlocks higher staff headcount cap (enforced in HireStaffModal)
      | 'wine_feature'             // Unlocks a wine feature capability (enforce in wine feature activation)
      | 'contract_type'            // Unlocks customer contract types (enforced in contract generation)
      | 'grape_buyer_slots'        // Adds seasonal grape buyer slots in market generation
      | 'grape_buyer_limit_multiplier' // Multiplies seasonal hard limits for grape buyers
      | 'grape_buyer_multiplier_bonus' // Adds flat grape buyer price multiplier bonus
      | 'grape_buyer_country_access'; // Unlocks additional country pools for seasonal grape buyers

/**
 * Generic unlock definition for research projects
 * Each unlock has a type and a value that identifies what is being unlocked
 */
export interface ResearchUnlock {
      type: UnlockType;
      value: string | number; // Identifier for what's being unlocked (grape name, max hectares, tech name, etc.)
      displayName?: string;   // Optional display name for UI (defaults to value)
      metadata?: Record<string, any>; // Additional data if needed (e.g., cap metadata for vineyard unlocks)
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
      }
      | {
            kind: 'research_skill_multiplier';
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

export interface ResearchProjectEconomics {
      workAmount: number;
      moneyCost: number;
      estimatedWeeks: number;
}

// Baseline gameplay caps used by services, UI constraints, and research ladder summaries.
export const BASE_MAX_HECTARES_PER_VINEYARD = 0.5;
export const BASE_TOTAL_VINEYARD_HECTARES_LIMIT = 1;
export const BASE_VINEYARD_COUNT_LIMIT = 1;
export const BASE_STAFF_LIMIT = 2;

export const RESEARCH_PROJECT_ECONOMICS: Record<string, ResearchProjectEconomics> = {
      admin_basic: { workAmount: 177, moneyCost: 5300, estimatedWeeks: 7 },
      admin_research_methodology: { workAmount: 302, moneyCost: 6200, estimatedWeeks: 11 },
      admin_research_office: { workAmount: 1206, moneyCost: 18500, estimatedWeeks: 23 },
      tech_experimental_cellar_lab: { workAmount: 4730, moneyCost: 93700, estimatedWeeks: 62 },
      tech_innovation_program: { workAmount: 11683, moneyCost: 231300, estimatedWeeks: 95 },
      tech_research_institute_network: { workAmount: 46107, moneyCost: 912900, estimatedWeeks: 198 },
      project_grant_basic: { workAmount: 132, moneyCost: 3900, estimatedWeeks: 5 },
      project_grant_advanced: { workAmount: 1679, moneyCost: 10600, estimatedWeeks: 22 },
      tech_soil_analysis: { workAmount: 1773, moneyCost: 35100, estimatedWeeks: 34 },
      tech_fermentation: { workAmount: 3540, moneyCost: 70100, estimatedWeeks: 47 },
      tech_fermentation_extended: { workAmount: 5361, moneyCost: 106100, estimatedWeeks: 70 },
      tech_vineyard_health_monitoring: { workAmount: 3579, moneyCost: 70900, estimatedWeeks: 47 },
      agri_barbera: { workAmount: 1396, moneyCost: 20100, estimatedWeeks: 27 },
      agri_chardonnay: { workAmount: 2733, moneyCost: 39400, estimatedWeeks: 36 },
      agri_pinot_noir: { workAmount: 3921, moneyCost: 56500, estimatedWeeks: 51 },
      agri_primitivo: { workAmount: 2733, moneyCost: 39400, estimatedWeeks: 36 },
      agri_sauvignon_blanc: { workAmount: 3921, moneyCost: 56500, estimatedWeeks: 51 },
      agri_tempranillo: { workAmount: 2733, moneyCost: 39400, estimatedWeeks: 36 },
      agri_sangiovese: { workAmount: 2733, moneyCost: 39400, estimatedWeeks: 36 },
      eff_microplot_management: { workAmount: 320, moneyCost: 11900, estimatedWeeks: 12 },
      eff_smallholding_operations: { workAmount: 430, moneyCost: 13900, estimatedWeeks: 16 },
      eff_estate_foundations: { workAmount: 1118, moneyCost: 19100, estimatedWeeks: 22 },
      eff_operational: { workAmount: 3619, moneyCost: 61900, estimatedWeeks: 48 },
      eff_site_expansion: { workAmount: 4841, moneyCost: 82800, estimatedWeeks: 63 },
      eff_estate_scale: { workAmount: 21946, moneyCost: 375300, estimatedWeeks: 131 },
      eff_regional_holdings: { workAmount: 23100, moneyCost: 395000, estimatedWeeks: 138 },
      eff_networked_estates: { workAmount: 45777, moneyCost: 782800, estimatedWeeks: 197 },
      eff_industrial_fleet_management: { workAmount: 48007, moneyCost: 820900, estimatedWeeks: 207 },
      eff_land_portfolio_management: { workAmount: 48582, moneyCost: 830800, estimatedWeeks: 209 },
      eff_megavineyard_control: { workAmount: 51081, moneyCost: 873500, estimatedWeeks: 220 },
      eff_agri_enterprise_planning: { workAmount: 51750, moneyCost: 884900, estimatedWeeks: 223 },
      eff_global_land_network: { workAmount: 54559, moneyCost: 933000, estimatedWeeks: 235 },
      eff_superestate_command: { workAmount: 55353, moneyCost: 946500, estimatedWeeks: 238 },
      eff_total_land_budgeting: { workAmount: 425, moneyCost: 13900, estimatedWeeks: 16 },
      eff_total_estate_area_2: { workAmount: 3536, moneyCost: 60500, estimatedWeeks: 46 },
      eff_total_estate_area_4: { workAmount: 4754, moneyCost: 81300, estimatedWeeks: 62 },
      eff_total_estate_area_8: { workAmount: 11490, moneyCost: 196500, estimatedWeeks: 94 },
      eff_total_estate_area_16: { workAmount: 22053, moneyCost: 377100, estimatedWeeks: 132 },
      eff_total_estate_area_32: { workAmount: 22365, moneyCost: 382400, estimatedWeeks: 134 },
      eff_total_estate_area_64: { workAmount: 45564, moneyCost: 779100, estimatedWeeks: 196 },
      eff_total_estate_area_128: { workAmount: 46112, moneyCost: 788500, estimatedWeeks: 198 },
      eff_total_estate_area_256: { workAmount: 48817, moneyCost: 834800, estimatedWeeks: 210 },
      eff_total_estate_area_512: { workAmount: 49463, moneyCost: 845800, estimatedWeeks: 213 },
      eff_total_estate_area_1000: { workAmount: 52083, moneyCost: 890600, estimatedWeeks: 224 },
      eff_total_estate_area_2000: { workAmount: 52836, moneyCost: 903500, estimatedWeeks: 227 },
      eff_vineyard_registry: { workAmount: 433, moneyCost: 13900, estimatedWeeks: 16 },
      eff_dual_estate_management: { workAmount: 1109, moneyCost: 19000, estimatedWeeks: 21 },
      eff_vineyard_cluster_ops: { workAmount: 1686, moneyCost: 28800, estimatedWeeks: 32 },
      eff_vineyard_dispatch: { workAmount: 3264, moneyCost: 55800, estimatedWeeks: 43 },
      eff_vineyard_support_grid: { workAmount: 4898, moneyCost: 83800, estimatedWeeks: 64 },
      eff_regional_site_supervision: { workAmount: 11503, moneyCost: 196700, estimatedWeeks: 94 },
      eff_vineyard_network_coordination: { workAmount: 21993, moneyCost: 376100, estimatedWeeks: 132 },
      eff_estate_grid_management: { workAmount: 22318, moneyCost: 381600, estimatedWeeks: 134 },
      eff_holdings_command: { workAmount: 45740, moneyCost: 782200, estimatedWeeks: 197 },
      eff_regional_hub_admin: { workAmount: 46310, moneyCost: 791900, estimatedWeeks: 199 },
      eff_multi_region_estate_control: { workAmount: 49059, moneyCost: 838900, estimatedWeeks: 211 },
      eff_global_vineyard_registry: { workAmount: 49733, moneyCost: 850400, estimatedWeeks: 214 },
      mkt_research: { workAmount: 715, moneyCost: 11600, estimatedWeeks: 14 },
      mkt_restaurant_program: { workAmount: 1234, moneyCost: 20000, estimatedWeeks: 24 },
      mkt_collector_relations: { workAmount: 3520, moneyCost: 57000, estimatedWeeks: 46 },
      mkt_chain_distribution: { workAmount: 8623, moneyCost: 139700, estimatedWeeks: 71 },
      mkt_vintner_network: { workAmount: 2267, moneyCost: 36700, estimatedWeeks: 30 },
      mkt_export_alliances: { workAmount: 8005, moneyCost: 129700, estimatedWeeks: 66 },
      mkt_cross_border_buyer_network: { workAmount: 9155, moneyCost: 148300, estimatedWeeks: 75 },
      mkt_transatlantic_buyer_desk: { workAmount: 17843, moneyCost: 289100, estimatedWeeks: 107 },
      mkt_old_world_exchange: { workAmount: 37391, moneyCost: 605700, estimatedWeeks: 161 },
      eff_bulk_chain_optimization: { workAmount: 3840, moneyCost: 65700, estimatedWeeks: 50 },
      eff_contract_fulfillment_grid: { workAmount: 11490, moneyCost: 196500, estimatedWeeks: 94 },
      tech_market_signal_engine: { workAmount: 5186, moneyCost: 102700, estimatedWeeks: 68 },
      tech_negotiation_ai_cellar: { workAmount: 24169, moneyCost: 478500, estimatedWeeks: 145 },
      staff_onboarding_program: { workAmount: 388, moneyCost: 7700, estimatedWeeks: 14 },
      staff_training: { workAmount: 1451, moneyCost: 22200, estimatedWeeks: 28 },
      staff_leadership_pipeline: { workAmount: 4028, moneyCost: 61600, estimatedWeeks: 53 },
      staff_operational_management: { workAmount: 9389, moneyCost: 143700, estimatedWeeks: 77 },
      staff_department_structure: { workAmount: 9775, moneyCost: 149600, estimatedWeeks: 80 },
      staff_operations_hub: { workAmount: 18015, moneyCost: 275600, estimatedWeeks: 108 },
      staff_enterprise_coordination: { workAmount: 18876, moneyCost: 288800, estimatedWeeks: 113 },
      staff_multiestate_hr: { workAmount: 37028, moneyCost: 566500, estimatedWeeks: 159 },
      staff_corporate_scale: { workAmount: 38957, moneyCost: 596000, estimatedWeeks: 168 },
};

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
    ...(requiredPrestige !== undefined ? { requiredPrestige } : {})
  };
}

interface UnlockResearchProjectConfig {
      id: string;
      title: string;
      description: string;
      complexity: number;
      category: 'efficiency' | 'staff';
      icon: string;
      requiredPrestige?: number;
      requiredCompanyValue?: number;
      prerequisites?: string[];
      unlockType: 'vineyard_size' | 'total_vineyard_hectares' | 'vineyard_count' | 'staff_limit';
      unlockValue: number;
      unlockDisplayName: string;
      benefits: string[];
      workProfile: ResearchWorkProfile;
}

interface CapacityResearchProjectConfig extends Omit<UnlockResearchProjectConfig, 'category' | 'unlockType' | 'unlockDisplayName'> {
      unlockType: 'vineyard_size' | 'total_vineyard_hectares' | 'vineyard_count';
}

interface StaffLimitResearchProjectConfig extends Omit<UnlockResearchProjectConfig, 'category' | 'unlockType' | 'unlockDisplayName'> {}

function createUnlockResearchProject(config: UnlockResearchProjectConfig): ResearchProject {
      return {
            id: config.id,
            title: config.title,
            description: config.description,
            complexity: config.complexity,
            benefits: [
                  ...config.benefits,
                  `+${calculateResearchPrestigeFromComplexity(config.complexity)} Prestige points`
            ],
            category: config.category,
            icon: config.icon,
            prestigeReward: calculateResearchPrestigeFromComplexity(config.complexity),
            requiredPrestige: config.requiredPrestige,
            requiredCompanyValue: config.requiredCompanyValue,
            prerequisites: config.prerequisites,
            unlocks: [{
                  type: config.unlockType,
                  value: config.unlockValue,
                  displayName: config.unlockDisplayName
            }],
            workProfile: config.workProfile
      };
}

function createCapacityResearchProject(config: CapacityResearchProjectConfig): ResearchProject {
      return createUnlockResearchProject({
            ...config,
            category: 'efficiency',
            unlockDisplayName: config.unlockType === 'vineyard_count'
                  ? `${config.unlockValue} vineyard cap`
                  : `${config.unlockValue} ha ${config.unlockType === 'vineyard_size' ? 'per-vineyard' : 'total-area'} cap`
      });
}

function createStaffLimitResearchProject(config: StaffLimitResearchProjectConfig): ResearchProject {
      return createUnlockResearchProject({
            ...config,
            category: 'staff',
            unlockType: 'staff_limit',
            unlockDisplayName: `${config.unlockValue} staff cap`
      });
}

const VINEYARD_SIZE_RESEARCH_CHAIN: CapacityResearchProjectConfig[] = [
      {
            id: 'eff_microplot_management',
            title: 'Microplot Management',
            description: 'Establish operating discipline for very small vineyard parcels.',
            complexity: 2,
            icon: '🌱',
            requiredPrestige: 2,
            prerequisites: ['admin_basic'],
            unlockType: 'vineyard_size',
            unlockValue: 0.25,
            benefits: ['Raises max size per vineyard to 0.25 hectares'],
            workProfile: { scopeWorkAmount: 45, complexityCurve: { kind: 'linear', multiplier: 0.12 }, categoryModifier: 0.08, extraInitialWork: 8 }
      },
      {
            id: 'eff_smallholding_operations',
            title: 'Smallholding Operations',
            description: 'Standardize small-estate routines for reliable half-hectare operations.',
            complexity: 3,
            icon: '🧺',
            requiredPrestige: 5,
            prerequisites: ['eff_microplot_management'],
            unlockType: 'vineyard_size',
            unlockValue: 0.5,
            benefits: ['Raises max size per vineyard to 0.5 hectares'],
            workProfile: { scopeWorkAmount: 65, complexityCurve: { kind: 'linear', multiplier: 0.13 }, categoryModifier: 0.1, extraInitialWork: 12 }
      },
      {
            id: 'eff_estate_foundations',
            title: 'Estate Foundations',
            description: 'Build foundational workflows for full one-hectare estate management.',
            complexity: 4,
            icon: '🏡',
            requiredPrestige: 9,
            prerequisites: ['eff_smallholding_operations'],
            unlockType: 'vineyard_size',
            unlockValue: 1,
            benefits: ['Raises max size per vineyard to 1 hectare'],
            workProfile: { scopeWorkAmount: 85, complexityCurve: { kind: 'linear', multiplier: 0.15 }, categoryModifier: 0.12, extraInitialWork: 18 }
      },
      {
            id: 'eff_operational',
            title: 'Operational Efficiency',
            description: 'Research methods to improve overall operational efficiency across the winery.',
            complexity: 6,
            icon: '⚡',
            requiredPrestige: 20,
            prerequisites: ['eff_estate_foundations'],
            unlockType: 'vineyard_size',
            unlockValue: 2,
            benefits: ['Operational improvements across winery activities', 'Raises max size per vineyard to 2 hectares', 'Better resource planning'],
            workProfile: { scopeWorkAmount: 120, complexityCurve: { kind: 'linear', multiplier: 0.2 }, categoryModifier: 0.15, extraInitialWork: 35 }
      },
      {
            id: 'eff_site_expansion',
            title: 'Estate Expansion Planning',
            description: 'Professionalize expansion planning and utility layout to support larger individual vineyard sites.',
            complexity: 7,
            icon: '🗺️',
            requiredPrestige: 28,
            requiredCompanyValue: 900000,
            prerequisites: ['eff_operational'],
            unlockType: 'vineyard_size',
            unlockValue: 4,
            benefits: ['Raises max size per vineyard to 4 hectares', 'Improves long-term site expansion planning'],
            workProfile: { scopeWorkAmount: 170, complexityCurve: { kind: 'exponential', base: 1.07 }, categoryModifier: 0.2, extraInitialWork: 45 }
      },
      {
            id: 'eff_estate_scale',
            title: 'Estate-Scale Infrastructure',
            description: 'Coordinate roads, storage, and utility scaling to support full estate-size vineyards.',
            complexity: 9,
            icon: '🏗️',
            requiredPrestige: 42,
            requiredCompanyValue: 2400000,
            prerequisites: ['eff_site_expansion'],
            unlockType: 'vineyard_size',
            unlockValue: 8,
            benefits: ['Raises max size per vineyard to 8 hectares', 'Unlocks robust estate-scale operating capacity'],
            workProfile: { scopeWorkAmount: 230, complexityCurve: { kind: 'exponential', base: 1.09 }, categoryModifier: 0.22, extraInitialWork: 60 }
      },
      {
            id: 'eff_regional_holdings',
            title: 'Regional Holdings Blueprint',
            description: 'Standardize planning for managing very large vineyard parcels within the same region.',
            complexity: 9,
            icon: '🧭',
            requiredPrestige: 52,
            requiredCompanyValue: 4500000,
            prerequisites: ['eff_estate_scale'],
            unlockType: 'vineyard_size',
            unlockValue: 16,
            benefits: ['Raises max size per vineyard to 16 hectares'],
            workProfile: { scopeWorkAmount: 290, complexityCurve: { kind: 'exponential', base: 1.1 }, categoryModifier: 0.24, extraInitialWork: 75 }
      },
      {
            id: 'eff_networked_estates',
            title: 'Networked Estate Operations',
            description: 'Integrate logistics, storage, and staffing for distributed mega-sites.',
            complexity: 10,
            icon: '🔗',
            requiredPrestige: 62,
            requiredCompanyValue: 7000000,
            prerequisites: ['eff_regional_holdings'],
            unlockType: 'vineyard_size',
            unlockValue: 32,
            benefits: ['Raises max size per vineyard to 32 hectares'],
            workProfile: { scopeWorkAmount: 360, complexityCurve: { kind: 'exponential', base: 1.1 }, categoryModifier: 0.25, extraInitialWork: 90 }
      },
      {
            id: 'eff_industrial_fleet_management',
            title: 'Industrial Fleet Management',
            description: 'Build tractor, transport, and intake fleet planning for very large vineyard sites.',
            complexity: 10,
            icon: '🚜',
            requiredPrestige: 72,
            requiredCompanyValue: 10000000,
            prerequisites: ['eff_networked_estates'],
            unlockType: 'vineyard_size',
            unlockValue: 64,
            benefits: ['Raises max size per vineyard to 64 hectares'],
            workProfile: { scopeWorkAmount: 430, complexityCurve: { kind: 'exponential', base: 1.11 }, categoryModifier: 0.26, extraInitialWork: 100 }
      },
      {
            id: 'eff_land_portfolio_management',
            title: 'Land Portfolio Management',
            description: 'Coordinate capital deployment and operating systems for massive individual vineyard assets.',
            complexity: 10,
            icon: '📈',
            requiredPrestige: 84,
            requiredCompanyValue: 16000000,
            prerequisites: ['eff_industrial_fleet_management'],
            unlockType: 'vineyard_size',
            unlockValue: 128,
            benefits: ['Raises max size per vineyard to 128 hectares'],
            workProfile: { scopeWorkAmount: 520, complexityCurve: { kind: 'exponential', base: 1.11 }, categoryModifier: 0.27, extraInitialWork: 120 }
      },
      {
            id: 'eff_megavineyard_control',
            title: 'Megavineyard Control Systems',
            description: 'Deploy robust operating systems for monitoring and controlling immense vineyard footprints.',
            complexity: 10,
            icon: '🛰️',
            requiredPrestige: 96,
            requiredCompanyValue: 25000000,
            prerequisites: ['eff_land_portfolio_management'],
            unlockType: 'vineyard_size',
            unlockValue: 256,
            benefits: ['Raises max size per vineyard to 256 hectares'],
            workProfile: { scopeWorkAmount: 620, complexityCurve: { kind: 'exponential', base: 1.12 }, categoryModifier: 0.28, extraInitialWork: 140 }
      },
      {
            id: 'eff_agri_enterprise_planning',
            title: 'Agri-Enterprise Planning Office',
            description: 'Formalize enterprise-level planning for ultra-large vineyard sites.',
            complexity: 10,
            icon: '🏢',
            requiredPrestige: 110,
            requiredCompanyValue: 40000000,
            prerequisites: ['eff_megavineyard_control'],
            unlockType: 'vineyard_size',
            unlockValue: 512,
            benefits: ['Raises max size per vineyard to 512 hectares'],
            workProfile: { scopeWorkAmount: 740, complexityCurve: { kind: 'exponential', base: 1.12 }, categoryModifier: 0.29, extraInitialWork: 165 }
      },
      {
            id: 'eff_global_land_network',
            title: 'Global Land Network',
            description: 'Structure governance and resource control for global-scale flagship vineyard estates.',
            complexity: 10,
            icon: '🌐',
            requiredPrestige: 125,
            requiredCompanyValue: 65000000,
            prerequisites: ['eff_agri_enterprise_planning'],
            unlockType: 'vineyard_size',
            unlockValue: 1000,
            benefits: ['Raises max size per vineyard to 1000 hectares'],
            workProfile: { scopeWorkAmount: 880, complexityCurve: { kind: 'exponential', base: 1.13 }, categoryModifier: 0.3, extraInitialWork: 190 }
      },
      {
            id: 'eff_superestate_command',
            title: 'Superestate Command Center',
            description: 'Coordinate governance, logistics, and financial planning for ultra-large single vineyard holdings.',
            complexity: 10,
            icon: '🏛️',
            requiredPrestige: 140,
            requiredCompanyValue: 100000000,
            prerequisites: ['eff_global_land_network'],
            unlockType: 'vineyard_size',
            unlockValue: 2000,
            benefits: ['Raises max size per vineyard to 2000 hectares'],
            workProfile: { scopeWorkAmount: 1040, complexityCurve: { kind: 'exponential', base: 1.13 }, categoryModifier: 0.31, extraInitialWork: 220 }
      }
];

const VINEYARD_SIZE_RESEARCH_PROJECTS: ResearchProject[] = VINEYARD_SIZE_RESEARCH_CHAIN.map(createCapacityResearchProject);

const TOTAL_VINEYARD_HECTARE_RESEARCH_PROJECTS: ResearchProject[] = [
      createCapacityResearchProject({
            id: 'eff_total_land_budgeting',
            title: 'Total Land Budgeting',
            description: 'Track and allocate land budget across your entire vineyard footprint.',
            complexity: 3,
            icon: '📏',
            requiredPrestige: 5,
            prerequisites: ['admin_basic'],
            unlockType: 'total_vineyard_hectares',
            unlockValue: 1,
            benefits: ['Raises max total vineyard area to 1 hectare'],
            workProfile: { scopeWorkAmount: 60, complexityCurve: { kind: 'linear', multiplier: 0.13 }, categoryModifier: 0.1, extraInitialWork: 12 }
      }),
      createCapacityResearchProject({ id: 'eff_total_estate_area_2', title: 'Total Estate Area 2 ha', description: 'Expand oversight tools for multi-parcel land use.', complexity: 6, icon: '🗂️', requiredPrestige: 18, prerequisites: ['eff_total_land_budgeting'], unlockType: 'total_vineyard_hectares', unlockValue: 2, benefits: ['Raises max total vineyard area to 2 hectares'], workProfile: { scopeWorkAmount: 118, complexityCurve: { kind: 'linear', multiplier: 0.18 }, categoryModifier: 0.15, extraInitialWork: 30 } }),
      createCapacityResearchProject({ id: 'eff_total_estate_area_4', title: 'Total Estate Area 4 ha', description: 'Manage planning and maintenance for a broader estate footprint.', complexity: 7, icon: '🧭', requiredPrestige: 26, requiredCompanyValue: 800000, prerequisites: ['eff_total_estate_area_2'], unlockType: 'total_vineyard_hectares', unlockValue: 4, benefits: ['Raises max total vineyard area to 4 hectares'], workProfile: { scopeWorkAmount: 168, complexityCurve: { kind: 'exponential', base: 1.07 }, categoryModifier: 0.18, extraInitialWork: 42 } }),
      createCapacityResearchProject({ id: 'eff_total_estate_area_8', title: 'Total Estate Area 8 ha', description: 'Scale land planning for a full estate network.', complexity: 8, icon: '🗺️', requiredPrestige: 36, requiredCompanyValue: 1800000, prerequisites: ['eff_total_estate_area_4'], unlockType: 'total_vineyard_hectares', unlockValue: 8, benefits: ['Raises max total vineyard area to 8 hectares'], workProfile: { scopeWorkAmount: 220, complexityCurve: { kind: 'exponential', base: 1.08 }, categoryModifier: 0.2, extraInitialWork: 55 } }),
      createCapacityResearchProject({ id: 'eff_total_estate_area_16', title: 'Total Estate Area 16 ha', description: 'Create governance systems for regional-scale vineyard land.', complexity: 9, icon: '🏞️', requiredPrestige: 48, requiredCompanyValue: 3200000, prerequisites: ['eff_total_estate_area_8'], unlockType: 'total_vineyard_hectares', unlockValue: 16, benefits: ['Raises max total vineyard area to 16 hectares'], workProfile: { scopeWorkAmount: 290, complexityCurve: { kind: 'exponential', base: 1.09 }, categoryModifier: 0.22, extraInitialWork: 70 } }),
      createCapacityResearchProject({ id: 'eff_total_estate_area_32', title: 'Total Estate Area 32 ha', description: 'Coordinate operations for a distributed land portfolio.', complexity: 9, icon: '🏘️', requiredPrestige: 58, requiredCompanyValue: 5000000, prerequisites: ['eff_total_estate_area_16'], unlockType: 'total_vineyard_hectares', unlockValue: 32, benefits: ['Raises max total vineyard area to 32 hectares'], workProfile: { scopeWorkAmount: 360, complexityCurve: { kind: 'exponential', base: 1.09 }, categoryModifier: 0.23, extraInitialWork: 86 } }),
      createCapacityResearchProject({ id: 'eff_total_estate_area_64', title: 'Total Estate Area 64 ha', description: 'Centralize oversight for large vineyard holdings.', complexity: 10, icon: '🏗️', requiredPrestige: 68, requiredCompanyValue: 7600000, prerequisites: ['eff_total_estate_area_32'], unlockType: 'total_vineyard_hectares', unlockValue: 64, benefits: ['Raises max total vineyard area to 64 hectares'], workProfile: { scopeWorkAmount: 440, complexityCurve: { kind: 'exponential', base: 1.1 }, categoryModifier: 0.24, extraInitialWork: 102 } }),
      createCapacityResearchProject({ id: 'eff_total_estate_area_128', title: 'Total Estate Area 128 ha', description: 'Professionalize governance for a major vineyard estate group.', complexity: 10, icon: '🏢', requiredPrestige: 80, requiredCompanyValue: 12000000, prerequisites: ['eff_total_estate_area_64'], unlockType: 'total_vineyard_hectares', unlockValue: 128, benefits: ['Raises max total vineyard area to 128 hectares'], workProfile: { scopeWorkAmount: 530, complexityCurve: { kind: 'exponential', base: 1.1 }, categoryModifier: 0.25, extraInitialWork: 120 } }),
      createCapacityResearchProject({ id: 'eff_total_estate_area_256', title: 'Total Estate Area 256 ha', description: 'Build systems for massive regional vineyard portfolios.', complexity: 10, icon: '📈', requiredPrestige: 92, requiredCompanyValue: 18000000, prerequisites: ['eff_total_estate_area_128'], unlockType: 'total_vineyard_hectares', unlockValue: 256, benefits: ['Raises max total vineyard area to 256 hectares'], workProfile: { scopeWorkAmount: 635, complexityCurve: { kind: 'exponential', base: 1.11 }, categoryModifier: 0.27, extraInitialWork: 138 } }),
      createCapacityResearchProject({ id: 'eff_total_estate_area_512', title: 'Total Estate Area 512 ha', description: 'Extend planning into multi-region vineyard land management.', complexity: 10, icon: '🛰️', requiredPrestige: 106, requiredCompanyValue: 28000000, prerequisites: ['eff_total_estate_area_256'], unlockType: 'total_vineyard_hectares', unlockValue: 512, benefits: ['Raises max total vineyard area to 512 hectares'], workProfile: { scopeWorkAmount: 760, complexityCurve: { kind: 'exponential', base: 1.11 }, categoryModifier: 0.28, extraInitialWork: 160 } }),
      createCapacityResearchProject({ id: 'eff_total_estate_area_1000', title: 'Total Estate Area 1000 ha', description: 'Coordinate global-scale vineyard area planning.', complexity: 10, icon: '🌐', requiredPrestige: 122, requiredCompanyValue: 45000000, prerequisites: ['eff_total_estate_area_512'], unlockType: 'total_vineyard_hectares', unlockValue: 1000, benefits: ['Raises max total vineyard area to 1000 hectares'], workProfile: { scopeWorkAmount: 900, complexityCurve: { kind: 'exponential', base: 1.12 }, categoryModifier: 0.29, extraInitialWork: 184 } }),
      createCapacityResearchProject({ id: 'eff_total_estate_area_2000', title: 'Total Estate Area 2000 ha', description: 'Formalize super-estate governance across your entire land portfolio.', complexity: 10, icon: '🏛️', requiredPrestige: 138, requiredCompanyValue: 70000000, prerequisites: ['eff_total_estate_area_1000'], unlockType: 'total_vineyard_hectares', unlockValue: 2000, benefits: ['Raises max total vineyard area to 2000 hectares'], workProfile: { scopeWorkAmount: 1060, complexityCurve: { kind: 'exponential', base: 1.12 }, categoryModifier: 0.3, extraInitialWork: 210 } })
];

const VINEYARD_COUNT_RESEARCH_PROJECTS: ResearchProject[] = [
      createCapacityResearchProject({ id: 'eff_vineyard_registry', title: 'Vineyard Registry', description: 'Introduce formal registry and oversight for more than one vineyard.', complexity: 3, icon: '📚', requiredPrestige: 6, prerequisites: ['admin_basic'], unlockType: 'vineyard_count', unlockValue: 2, benefits: ['Raises max vineyard count to 2'], workProfile: { scopeWorkAmount: 70, complexityCurve: { kind: 'linear', multiplier: 0.14 }, categoryModifier: 0.08, extraInitialWork: 14 } }),
      createCapacityResearchProject({ id: 'eff_dual_estate_management', title: 'Dual Estate Management', description: 'Coordinate planning for a three-vineyard operation.', complexity: 4, icon: '🏷️', requiredPrestige: 10, prerequisites: ['eff_vineyard_registry'], unlockType: 'vineyard_count', unlockValue: 3, benefits: ['Raises max vineyard count to 3'], workProfile: { scopeWorkAmount: 92, complexityCurve: { kind: 'linear', multiplier: 0.15 }, categoryModifier: 0.1, extraInitialWork: 20 } }),
      createCapacityResearchProject({ id: 'eff_vineyard_cluster_ops', title: 'Vineyard Cluster Operations', description: 'Run a small network of separate vineyard sites.', complexity: 5, icon: '🪴', requiredPrestige: 16, prerequisites: ['eff_dual_estate_management'], unlockType: 'vineyard_count', unlockValue: 5, benefits: ['Raises max vineyard count to 5'], workProfile: { scopeWorkAmount: 128, complexityCurve: { kind: 'linear', multiplier: 0.17 }, categoryModifier: 0.12, extraInitialWork: 28 } }),
      createCapacityResearchProject({ id: 'eff_vineyard_dispatch', title: 'Multi-Vineyard Dispatch', description: 'Dispatch labor and logistics across a wider site network.', complexity: 6, icon: '🚚', requiredPrestige: 24, requiredCompanyValue: 900000, prerequisites: ['eff_vineyard_cluster_ops'], unlockType: 'vineyard_count', unlockValue: 8, benefits: ['Raises max vineyard count to 8'], workProfile: { scopeWorkAmount: 176, complexityCurve: { kind: 'exponential', base: 1.07 }, categoryModifier: 0.15, extraInitialWork: 40 } }),
      createCapacityResearchProject({ id: 'eff_vineyard_support_grid', title: 'Vineyard Support Grid', description: 'Establish support teams for a 12-vineyard portfolio.', complexity: 7, icon: '🧰', requiredPrestige: 34, requiredCompanyValue: 1600000, prerequisites: ['eff_vineyard_dispatch'], unlockType: 'vineyard_count', unlockValue: 12, benefits: ['Raises max vineyard count to 12'], workProfile: { scopeWorkAmount: 226, complexityCurve: { kind: 'exponential', base: 1.08 }, categoryModifier: 0.17, extraInitialWork: 54 } }),
      createCapacityResearchProject({ id: 'eff_regional_site_supervision', title: 'Regional Site Supervision', description: 'Supervise a 16-vineyard regional footprint.', complexity: 8, icon: '🧭', requiredPrestige: 44, requiredCompanyValue: 2600000, prerequisites: ['eff_vineyard_support_grid'], unlockType: 'vineyard_count', unlockValue: 16, benefits: ['Raises max vineyard count to 16'], workProfile: { scopeWorkAmount: 286, complexityCurve: { kind: 'exponential', base: 1.08 }, categoryModifier: 0.19, extraInitialWork: 66 } }),
      createCapacityResearchProject({ id: 'eff_vineyard_network_coordination', title: 'Vineyard Network Coordination', description: 'Coordinate work across 24 separate vineyard sites.', complexity: 9, icon: '🔗', requiredPrestige: 56, requiredCompanyValue: 4200000, prerequisites: ['eff_regional_site_supervision'], unlockType: 'vineyard_count', unlockValue: 24, benefits: ['Raises max vineyard count to 24'], workProfile: { scopeWorkAmount: 360, complexityCurve: { kind: 'exponential', base: 1.09 }, categoryModifier: 0.21, extraInitialWork: 80 } }),
      createCapacityResearchProject({ id: 'eff_estate_grid_management', title: 'Estate Grid Management', description: 'Maintain governance over a 32-vineyard operating grid.', complexity: 9, icon: '🕸️', requiredPrestige: 68, requiredCompanyValue: 6200000, prerequisites: ['eff_vineyard_network_coordination'], unlockType: 'vineyard_count', unlockValue: 32, benefits: ['Raises max vineyard count to 32'], workProfile: { scopeWorkAmount: 438, complexityCurve: { kind: 'exponential', base: 1.09 }, categoryModifier: 0.22, extraInitialWork: 96 } }),
      createCapacityResearchProject({ id: 'eff_holdings_command', title: 'Holdings Command', description: 'Run a 48-vineyard estate command structure.', complexity: 10, icon: '🏭', requiredPrestige: 80, requiredCompanyValue: 9000000, prerequisites: ['eff_estate_grid_management'], unlockType: 'vineyard_count', unlockValue: 48, benefits: ['Raises max vineyard count to 48'], workProfile: { scopeWorkAmount: 530, complexityCurve: { kind: 'exponential', base: 1.1 }, categoryModifier: 0.24, extraInitialWork: 118 } }),
      createCapacityResearchProject({ id: 'eff_regional_hub_admin', title: 'Regional Hub Administration', description: 'Govern a 64-vineyard network through regional hubs.', complexity: 10, icon: '🏢', requiredPrestige: 94, requiredCompanyValue: 14000000, prerequisites: ['eff_holdings_command'], unlockType: 'vineyard_count', unlockValue: 64, benefits: ['Raises max vineyard count to 64'], workProfile: { scopeWorkAmount: 630, complexityCurve: { kind: 'exponential', base: 1.1 }, categoryModifier: 0.25, extraInitialWork: 138 } }),
      createCapacityResearchProject({ id: 'eff_multi_region_estate_control', title: 'Multi-Region Estate Control', description: 'Scale supervision to a 96-vineyard multi-region portfolio.', complexity: 10, icon: '🌍', requiredPrestige: 110, requiredCompanyValue: 22000000, prerequisites: ['eff_regional_hub_admin'], unlockType: 'vineyard_count', unlockValue: 96, benefits: ['Raises max vineyard count to 96'], workProfile: { scopeWorkAmount: 748, complexityCurve: { kind: 'exponential', base: 1.11 }, categoryModifier: 0.27, extraInitialWork: 162 } }),
      createCapacityResearchProject({ id: 'eff_global_vineyard_registry', title: 'Global Vineyard Registry', description: 'Maintain a controlled register for 128 vineyard sites.', complexity: 10, icon: '🌐', requiredPrestige: 126, requiredCompanyValue: 36000000, prerequisites: ['eff_multi_region_estate_control'], unlockType: 'vineyard_count', unlockValue: 128, benefits: ['Raises max vineyard count to 128'], workProfile: { scopeWorkAmount: 884, complexityCurve: { kind: 'exponential', base: 1.11 }, categoryModifier: 0.28, extraInitialWork: 188 } })
];

const STAFF_LIMIT_RESEARCH_CHAIN: StaffLimitResearchProjectConfig[] = [
      {
            id: 'staff_onboarding_program',
            title: 'Staff Onboarding Program',
            description: 'Create hiring playbooks and role onboarding standards to safely grow the team.',
            complexity: 3,
            icon: '🧾',
            requiredPrestige: 6,
            unlockValue: 3,
            benefits: ['Raises staff capacity to 3 employees', 'Improves onboarding consistency'],
            workProfile: { scopeWorkAmount: 70, complexityCurve: { kind: 'linear', multiplier: 0.14 }, categoryModifier: 0.06, extraInitialWork: 10 }
      },
      {
            id: 'staff_training',
            title: 'Staff Training Programs',
            description: 'Develop structured training programs for winery and vineyard staff',
            complexity: 5,
            icon: '👥',
            requiredPrestige: 10,
            prerequisites: ['staff_onboarding_program'],
            unlockValue: 5,
            benefits: ['Raises staff capacity to 5 employees', 'Structured staff development framework', 'Improved staff retention'],
            workProfile: { scopeWorkAmount: 120, complexityCurve: { kind: 'linear', multiplier: 0.16 }, categoryModifier: 0.08, extraInitialWork: 20 }
      },
      {
            id: 'staff_leadership_pipeline',
            title: 'Leadership Pipeline',
            description: 'Formalize lead roles and mentoring so larger teams remain effective and coordinated.',
            complexity: 7,
            icon: '🧑‍💼',
            requiredPrestige: 26,
            requiredCompanyValue: 1200000,
            prerequisites: ['staff_training'],
            unlockValue: 7,
            benefits: ['Raises staff capacity to 7 employees', 'Improves team scaling and retention'],
            workProfile: { scopeWorkAmount: 180, complexityCurve: { kind: 'exponential', base: 1.07 }, categoryModifier: 0.1, extraInitialWork: 40 }
      },
      {
            id: 'staff_operational_management',
            title: 'Operational Management Framework',
            description: 'Define role responsibilities and shift coordination to support a larger operational team.',
            complexity: 8,
            icon: '📋',
            requiredPrestige: 34,
            requiredCompanyValue: 2200000,
            prerequisites: ['staff_leadership_pipeline'],
            unlockValue: 10,
            benefits: ['Raises staff capacity to 10 employees'],
            workProfile: { scopeWorkAmount: 230, complexityCurve: { kind: 'exponential', base: 1.07 }, categoryModifier: 0.11, extraInitialWork: 50 }
      },
      {
            id: 'staff_department_structure',
            title: 'Department Structure Program',
            description: 'Establish specialist teams and reporting structures for multi-function operations.',
            complexity: 8,
            icon: '🗂️',
            requiredPrestige: 44,
            requiredCompanyValue: 3500000,
            prerequisites: ['staff_operational_management'],
            unlockValue: 15,
            benefits: ['Raises staff capacity to 15 employees'],
            workProfile: { scopeWorkAmount: 280, complexityCurve: { kind: 'exponential', base: 1.08 }, categoryModifier: 0.12, extraInitialWork: 60 }
      },
      {
            id: 'staff_operations_hub',
            title: 'Operations Hub Command',
            description: 'Centralize scheduling and workforce assignment for high-output seasons.',
            complexity: 9,
            icon: '🏭',
            requiredPrestige: 56,
            requiredCompanyValue: 5500000,
            prerequisites: ['staff_department_structure'],
            unlockValue: 25,
            benefits: ['Raises staff capacity to 25 employees'],
            workProfile: { scopeWorkAmount: 360, complexityCurve: { kind: 'exponential', base: 1.08 }, categoryModifier: 0.13, extraInitialWork: 75 }
      },
      {
            id: 'staff_enterprise_coordination',
            title: 'Enterprise Coordination Office',
            description: 'Coordinate large staffing pools with clear operating cadences and accountability.',
            complexity: 9,
            icon: '🏢',
            requiredPrestige: 68,
            requiredCompanyValue: 8500000,
            prerequisites: ['staff_operations_hub'],
            unlockValue: 40,
            benefits: ['Raises staff capacity to 40 employees'],
            workProfile: { scopeWorkAmount: 460, complexityCurve: { kind: 'exponential', base: 1.09 }, categoryModifier: 0.14, extraInitialWork: 95 }
      },
      {
            id: 'staff_multiestate_hr',
            title: 'Multi-Estate HR Systems',
            description: 'Deploy enterprise hiring, retention, and role planning across multiple operating sites.',
            complexity: 10,
            icon: '🌍',
            requiredPrestige: 84,
            requiredCompanyValue: 13000000,
            prerequisites: ['staff_enterprise_coordination'],
            unlockValue: 60,
            benefits: ['Raises staff capacity to 60 employees'],
            workProfile: { scopeWorkAmount: 580, complexityCurve: { kind: 'exponential', base: 1.09 }, categoryModifier: 0.15, extraInitialWork: 120 }
      },
      {
            id: 'staff_corporate_scale',
            title: 'Corporate Scale Workforce',
            description: 'Structure governance and workforce control systems for corporation-level staffing.',
            complexity: 10,
            icon: '🏛️',
            requiredPrestige: 102,
            requiredCompanyValue: 22000000,
            prerequisites: ['staff_multiestate_hr'],
            unlockValue: 100,
            benefits: ['Raises staff capacity to 100 employees'],
            workProfile: { scopeWorkAmount: 720, complexityCurve: { kind: 'exponential', base: 1.1 }, categoryModifier: 0.16, extraInitialWork: 150 }
      }
];

const STAFF_LIMIT_RESEARCH_PROJECTS: ResearchProject[] = STAFF_LIMIT_RESEARCH_CHAIN.map(createStaffLimitResearchProject);

const RESEARCH_SPEED_RESEARCH_PROJECTS: ResearchProject[] = [
      {
            id: 'admin_research_methodology',
            title: 'Research Methodology',
            description: 'Standardize literature review, test notes, and project handoff practices for research staff.',
            complexity: 3,
            benefits: [
                  'Research staff work 10% faster on research tasks',
                  'Creates the operating discipline for larger research programs',
                  `+${calculateResearchPrestigeFromComplexity(3)} Prestige points`
            ],
            category: 'administration',
            icon: '📚',
            prestigeReward: calculateResearchPrestigeFromComplexity(3),
            requiredPrestige: 6,
            prerequisites: ['admin_basic'],
            permanentEffects: [{
                  kind: 'research_skill_multiplier',
                  multiplier: 1.1,
                  description: 'Research staff work 10% faster on research tasks'
            }],
            workProfile: {
                  scopeWorkAmount: 45,
                  complexityCurve: { kind: 'linear', multiplier: 0.08 },
                  categoryModifier: -0.05,
                  extraInitialWork: 12
            }
      },
      {
            id: 'admin_research_office',
            title: 'Applied Research Office',
            description: 'Create a dedicated office for grant tracking, experimental design, and reusable research protocols.',
            complexity: 5,
            benefits: [
                  'Research staff work 12% faster on research tasks',
                  'Improves coordination across administrative and technical research',
                  `+${calculateResearchPrestigeFromComplexity(5)} Prestige points`
            ],
            category: 'administration',
            icon: '🗂️',
            prestigeReward: calculateResearchPrestigeFromComplexity(5),
            requiredPrestige: 14,
            prerequisites: ['admin_research_methodology', 'project_grant_basic'],
            permanentEffects: [{
                  kind: 'research_skill_multiplier',
                  multiplier: 1.12,
                  description: 'Research staff work 12% faster on research tasks'
            }],
            workProfile: {
                  scopeWorkAmount: 90,
                  complexityCurve: { kind: 'linear', multiplier: 0.12 },
                  categoryModifier: 0,
                  extraInitialWork: 24
            }
      },
      {
            id: 'tech_experimental_cellar_lab',
            title: 'Experimental Cellar Lab',
            description: 'Build a practical lab for controlled cellar trials, sensory records, and faster technical iteration.',
            complexity: 7,
            benefits: [
                  'Research staff work 15% faster on research tasks',
                  'Requires proven wine quality before lab trials can justify the investment',
                  `+${calculateResearchPrestigeFromComplexity(7)} Prestige points`
            ],
            category: 'technology',
            icon: '🧪',
            prestigeReward: calculateResearchPrestigeFromComplexity(7),
            requiredPrestige: 28,
            prerequisites: ['admin_research_office', 'tech_fermentation'],
            requiredAchievementIds: ['wine_score_tier_1'],
            permanentEffects: [{
                  kind: 'research_skill_multiplier',
                  multiplier: 1.15,
                  description: 'Research staff work 15% faster on research tasks'
            }],
            workProfile: {
                  scopeWorkAmount: 170,
                  complexityCurve: { kind: 'exponential', base: 1.07 },
                  categoryModifier: 0.12,
                  extraInitialWork: 45
            }
      },
      {
            id: 'tech_innovation_program',
            title: 'Innovation Program',
            description: 'Coordinate formal innovation sprints across cellar, market, and estate operations.',
            complexity: 8,
            benefits: [
                  'Research staff work 18% faster on research tasks',
                  'Connects premium contract performance to deeper technical research',
                  `+${calculateResearchPrestigeFromComplexity(8)} Prestige points`
            ],
            category: 'technology',
            icon: '💡',
            prestigeReward: calculateResearchPrestigeFromComplexity(8),
            requiredPrestige: 44,
            requiredCompanyValue: 2000000,
            prerequisites: ['tech_experimental_cellar_lab', 'tech_fermentation_extended'],
            requiredAchievementIds: ['wine_score_tier_1', 'single_contract_value_tier_2'],
            permanentEffects: [{
                  kind: 'research_skill_multiplier',
                  multiplier: 1.18,
                  description: 'Research staff work 18% faster on research tasks'
            }],
            workProfile: {
                  scopeWorkAmount: 240,
                  complexityCurve: { kind: 'exponential', base: 1.08 },
                  categoryModifier: 0.16,
                  extraInitialWork: 64
            }
      },
      {
            id: 'tech_research_institute_network',
            title: 'Research Institute Network',
            description: 'Partner with outside institutes and expert consultants to accelerate late-stage research programs.',
            complexity: 10,
            benefits: [
                  'Research staff work 22% faster on research tasks',
                  'Requires a recognized brand and enough technical depth to coordinate external institutes',
                  `+${calculateResearchPrestigeFromComplexity(10)} Prestige points`
            ],
            category: 'technology',
            icon: '🏛️',
            prestigeReward: calculateResearchPrestigeFromComplexity(10),
            requiredPrestige: 75,
            requiredCompanyValue: 8000000,
            prerequisites: ['tech_innovation_program', 'tech_market_signal_engine'],
            requiredAchievementIds: ['prestige_master_tier_1', 'wine_score_tier_2'],
            permanentEffects: [{
                  kind: 'research_skill_multiplier',
                  multiplier: 1.22,
                  description: 'Research staff work 22% faster on research tasks'
            }],
            workProfile: {
                  scopeWorkAmount: 360,
                  complexityCurve: { kind: 'exponential', base: 1.1 },
                  categoryModifier: 0.2,
                  extraInitialWork: 90
            }
      }
];

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
      ...RESEARCH_SPEED_RESEARCH_PROJECTS,
      
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
      ...VINEYARD_SIZE_RESEARCH_PROJECTS,
      ...TOTAL_VINEYARD_HECTARE_RESEARCH_PROJECTS,
      ...VINEYARD_COUNT_RESEARCH_PROJECTS,
      
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
            unlocks: [{ type: 'contract_type', value: 'Restaurant', displayName: 'Restaurant contracts' }],
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
            unlocks: [{ type: 'contract_type', value: 'Private Collector', displayName: 'Private Collector contracts' }],
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
            unlocks: [{ type: 'contract_type', value: 'Chain Store', displayName: 'Chain Store contracts' }],
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
            id: 'mkt_cross_border_buyer_network',
            title: 'Cross-Border Buyer Network',
            description: 'Establish neighboring-country merchant channels to source seasonal buyer demand beyond your home market.',
            complexity: 8,
            benefits: [
                  'Unlocks Italy grape buyer access',
                  'Unlocks Spain grape buyer access',
                  `+${calculateResearchPrestigeFromComplexity(8)} Prestige points`
            ],
            category: 'marketing',
            icon: '🧭',
            prestigeReward: calculateResearchPrestigeFromComplexity(8),
            requiredPrestige: 34,
            requiredCompanyValue: 1200000,
            requiredBuyerLoyaltyLevel: 2,
            prerequisites: ['mkt_export_alliances'],
            unlocks: [
                  { type: 'grape_buyer_country_access', value: 'Italy', displayName: 'Italy buyer access' },
                  { type: 'grape_buyer_country_access', value: 'Spain', displayName: 'Spain buyer access' }
            ],
            workProfile: {
                  scopeWorkAmount: 210,
                  complexityCurve: { kind: 'exponential', base: 1.08 },
                  categoryModifier: 0.12,
                  extraInitialWork: 52
            }
      },
      {
            id: 'mkt_transatlantic_buyer_desk',
            title: 'Transatlantic Buyer Desk',
            description: 'Build compliance and logistics capability to access United States seasonal grape buyers.',
            complexity: 9,
            benefits: [
                  'Unlocks United States grape buyer access',
                  `+${calculateResearchPrestigeFromComplexity(9)} Prestige points`
            ],
            category: 'marketing',
            icon: '🗽',
            prestigeReward: calculateResearchPrestigeFromComplexity(9),
            requiredPrestige: 44,
            requiredCompanyValue: 2600000,
            requiredBuyerLoyaltyLevel: 3,
            requiredAchievementIds: ['bulk_grape_sales_tier_2'],
            prerequisites: ['mkt_cross_border_buyer_network'],
            unlocks: [
                  { type: 'grape_buyer_country_access', value: 'United States', displayName: 'United States buyer access' }
            ],
            workProfile: {
                  scopeWorkAmount: 250,
                  complexityCurve: { kind: 'exponential', base: 1.09 },
                  categoryModifier: 0.16,
                  extraInitialWork: 68
            }
      },
      {
            id: 'mkt_old_world_exchange',
            title: 'Old World Exchange Program',
            description: 'Secure prestige-focused exchange agreements to unlock France and Germany premium buyer channels.',
            complexity: 10,
            benefits: [
                  'Unlocks France grape buyer access',
                  'Unlocks Germany grape buyer access',
                  `+${calculateResearchPrestigeFromComplexity(10)} Prestige points`
            ],
            category: 'marketing',
            icon: '🏛️',
            prestigeReward: calculateResearchPrestigeFromComplexity(10),
            requiredPrestige: 58,
            requiredCompanyValue: 4500000,
            requiredBuyerLoyaltyLevel: 4,
            requiredAchievementIds: ['bulk_grape_sales_tier_3'],
            prerequisites: ['mkt_transatlantic_buyer_desk'],
            unlocks: [
                  { type: 'grape_buyer_country_access', value: 'France', displayName: 'France buyer access' },
                  { type: 'grape_buyer_country_access', value: 'Germany', displayName: 'Germany buyer access' }
            ],
            workProfile: {
                  scopeWorkAmount: 320,
                  complexityCurve: { kind: 'exponential', base: 1.1 },
                  categoryModifier: 0.2,
                  extraInitialWork: 84
            }
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
      ...STAFF_LIMIT_RESEARCH_PROJECTS
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


