/**
 * Research Constants
 * Defines available research projects and their properties
 */

import { GrapeVariety, GRAPE_VARIETIES } from '../types/types';
import { calculateGrapeDifficulty } from '../services/wine/features/grapeDifficulty';
import { getGrapeIconSrc } from '../utils/icons';

/**
 * Types of unlocks that research can provide
 */
export type UnlockType = 
      | 'grape'                    // Unlocks a grape variety for planting
      | 'vineyard_size'            // Increases maximum vineyard size (hectares)
      | 'fermentation_technology'   // Unlocks a fermentation technology/method
      | 'staff_limit'              // Increases maximum staff count
      | 'building_type'            // Unlocks a building type
      | 'wine_feature'             // Unlocks a wine feature capability
      | 'contract_type';           // Unlocks a contract type

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
}

// ===== RESEARCH CALCULATION CONSTANTS =====

/**
 * Base money cost (€) for research activities by category
 * This is the base monetary investment required to start research
 * Final cost is calculated as: baseCost * (1 + (complexity - 1) * RESEARCH_COMPLEXITY_COST_MULTIPLIER)
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
export const RESEARCH_COMPLEXITY_WORK_MULTIPLIER = 0.15; // Each complexity point adds 15% work

export const RESEARCH_COMPLEXITY_COST_MULTIPLIER = 0.20; // Each complexity point adds 20% cost

// ===== GRAPE RESEARCH HELPERS =====

/**
 * Calculate complexity (1-10) from grape difficulty (0-1)
 * Maps difficulty score to research complexity
 */
function calculateGrapeComplexity(difficulty: number): number {
  // Map 0-1 difficulty to 1-10 complexity
  // Minimum complexity is 2, maximum is 10
  return Math.max(2, Math.min(10, Math.ceil(difficulty * 8) + 2));
}

/**
 * Calculate prestige reward from grape difficulty (0-1)
 * Higher difficulty = more prestige
 */
function calculateGrapePrestige(difficulty: number): number {
  // Map 0-1 difficulty to 0.1-5 prestige
  // Minimum prestige is 0.1, maximum prestige is 5
  return Math.max(0.1, Math.min(5, difficulty * 5));
}

/**
 * Create a grape research project based on grape variety
 * Automatically calculates complexity and prestige from difficulty
 */
function createGrapeResearchProject(grape: GrapeVariety): ResearchProject {
  const difficulty = calculateGrapeDifficulty(grape);
  const complexity = calculateGrapeComplexity(difficulty.score);
  const prestigeReward = calculateGrapePrestige(difficulty.score);
  const iconPath = getGrapeIconSrc(grape);
  
  // Create project ID from grape name (e.g., "Pinot Noir" -> "agri_pinot_noir")
  const projectId = `agri_${grape.toLowerCase().replace(/\s+/g, '_')}`;
  
  // Base work amount scales with complexity (higher complexity = more work)
  // Formula: baseWorkAmount = 50 * complexity
  // This gives: complexity 2 = 100, complexity 5 = 250, complexity 10 = 500 work units
  const baseWorkAmount = 50 * complexity;
  
  return {
    id: projectId,
    title: `${grape} Grape Research`,
    description: `Research and develop expertise in cultivating ${grape} grapes`,
    complexity,
    benefits: [
      `Unlock ${grape} grape variety for planting`,
      `Learn optimal growing conditions for ${grape}`,
      `+${prestigeReward} Prestige points`
    ],
    category: 'agriculture',
    icon: iconPath, // Use image path instead of emoji
    prestigeReward,
    unlocks: [{ type: 'grape', value: grape }],
    baseWorkAmount
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
                  '+2 Prestige points'
            ],
            category: 'administration',
            icon: '📋',
            prestigeReward: 2
      },
      
      // ===== PROJECTS (Grants) =====
      {
            id: 'project_grant_basic',
            title: 'Basic Research Grant',
            description: 'Apply for a basic research grant to fund vineyard improvements',
            complexity: 3,
            benefits: [
                  'Receive €1,000 grant funding',
                  '+5 Prestige points',
                  'Unlock advanced grant applications'
            ],
            category: 'projects',
            icon: '💰',
            rewardAmount: 1000,
            prestigeReward: 5
      },
      {
            id: 'project_grant_advanced',
            title: 'Advanced Research Grant',
            description: 'Secure funding for advanced viticulture research',
            complexity: 7,
            benefits: [
                  'Receive €5,000 grant funding',
                  '+15 Prestige points',
                  'Unlock premium research opportunities'
            ],
            category: 'projects',
            icon: '🏆',
            rewardAmount: 5000,
            prestigeReward: 15
      },
      
      // ===== TECHNOLOGY =====
      {
            id: 'tech_soil_analysis',
            title: 'Soil Analysis Technology',
            description: 'Research advanced soil analysis techniques',
            complexity: 5,
            benefits: [
                  'Improved vineyard quality assessment',
                  '+10% grape quality in suitable soils',
                  'Better land purchase decisions'
            ],
            category: 'technology',
            icon: '🔬'
      },
      {
            id: 'tech_fermentation',
            title: 'Fermentation Optimization',
            description: 'Study advanced fermentation control methods',
            complexity: 6,
            benefits: [
                  '+5% wine balance improvement',
                  'Reduced fermentation time by 10%',
                  'Better wine characteristics control'
            ],
            category: 'technology',
            icon: '🧪'
      },
      
      // ===== AGRICULTURE (Grape Research) =====
      // Grape research projects are automatically generated based on difficulty
      ...GRAPE_VARIETIES.map(grape => createGrapeResearchProject(grape)),
      
      // ===== EFFICIENCY =====
      {
            id: 'eff_operational',
            title: 'Operational Efficiency',
            description: 'Research methods to improve overall operational efficiency',
            complexity: 6,
            benefits: [
                  '+15% work completion speed',
                  'Reduced labor costs by 10%',
                  'Improved staff productivity'
            ],
            category: 'efficiency',
            icon: '⚡'
      },
      
      // ===== MARKETING =====
      {
            id: 'mkt_research',
            title: 'Marketing Research',
            description: 'Study market trends and customer preferences',
            complexity: 4,
            benefits: [
                  '+20% customer relationship growth',
                  'Better price estimation',
                  'Increased sales opportunities'
            ],
            category: 'marketing',
            icon: '📊'
      },
      
      // ===== STAFF =====
      {
            id: 'staff_training',
            title: 'Staff Training Programs',
            description: 'Develop comprehensive training programs for staff development',
            complexity: 5,
            benefits: [
                  '+10% staff skill improvement rate',
                  'Reduced hiring costs',
                  'Better staff retention'
            ],
            category: 'staff',
            icon: '👥'
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
