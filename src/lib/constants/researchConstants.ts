/**
 * Research Constants
 * Defines available research projects and their properties
 */

export interface ResearchProject {
      id: string;
      title: string;
      description: string;
      complexity: number; // 1-10 scale, affects work and cost calculation
      benefits: string[];
      category: 'grant' | 'technology' | 'upgrade';
      icon?: string;
      rewardAmount?: number; // For grants, the amount received on completion
      prestigeReward?: number; // Prestige points awarded on completion
}

// ===== RESEARCH CALCULATION CONSTANTS =====

/**
 * Base cost for research activities by category
 */
export const RESEARCH_BASE_COST: Record<ResearchProject['category'], number> = {
      grant: 500,      // Lower cost, you get money back
      technology: 2000, // Medium cost, permanent improvements
      upgrade: 1800     // Medium cost, operational improvements
};

/**
 * Complexity multipliers for work calculation
 * Higher complexity = more work required
 */
export const RESEARCH_COMPLEXITY_WORK_MULTIPLIER = 0.15; // Each complexity point adds 15% work

/**
 * Complexity multipliers for cost calculation
 * Higher complexity = higher cost
 */
export const RESEARCH_COMPLEXITY_COST_MULTIPLIER = 0.20; // Each complexity point adds 20% cost

// ===== AVAILABLE RESEARCH PROJECTS =====

/**
 * Available research projects
 */
export const RESEARCH_PROJECTS: ResearchProject[] = [
      {
            id: 'research_grant_basic',
            title: 'Basic Research Grant',
            description: 'Apply for a basic research grant to fund vineyard improvements',
            complexity: 3,
            benefits: [
                  'Receive €1,000 grant funding',
                  '+5 Prestige points',
                  'Unlock advanced grant applications'
            ],
            category: 'grant',
            icon: '💰',
            rewardAmount: 1000,
            prestigeReward: 5
      },
      {
            id: 'research_grant_advanced',
            title: 'Advanced Research Grant',
            description: 'Secure funding for advanced viticulture research',
            complexity: 7,
            benefits: [
                  'Receive €5,000 grant funding',
                  '+15 Prestige points',
                  'Unlock premium research opportunities'
            ],
            category: 'grant',
            icon: '🏆',
            rewardAmount: 5000,
            prestigeReward: 15
      },
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
      {
            id: 'upgrade_efficiency',
            title: 'Operational Efficiency',
            description: 'Research methods to improve overall operational efficiency',
            complexity: 6,
            benefits: [
                  '+15% work completion speed',
                  'Reduced labor costs by 10%',
                  'Improved staff productivity'
            ],
            category: 'upgrade',
            icon: '⚡'
      },
      {
            id: 'upgrade_marketing',
            title: 'Marketing Research',
            description: 'Study market trends and customer preferences',
            complexity: 4,
            benefits: [
                  '+20% customer relationship growth',
                  'Better price estimation',
                  'Increased sales opportunities'
            ],
            category: 'upgrade',
            icon: '📊'
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
