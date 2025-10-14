import { AchievementConfig } from '../types/types';

/**
 * Achievement Definitions
 * 
 * Centralized configuration for all game achievements
 * Each achievement can spawn prestige events when unlocked
 */

// ===== FINANCIAL ACHIEVEMENTS =====

export const ACHIEVEMENT_FIRST_EURO: AchievementConfig = {
  id: 'first_euro',
  name: 'First Euro',
  description: 'Your winery journey begins with a single euro',
  icon: '💶',
  category: 'financial',
  rarity: 'common',
  condition: {
    type: 'money_threshold',
    threshold: 1
  },
  prestige: {
    company: {
      baseAmount: 0.1,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_PROFITABLE: AchievementConfig = {
  id: 'profitable',
  name: 'Profitable Winery',
  description: 'Reach €10,000 in cash reserves',
  icon: '💰',
  category: 'financial',
  rarity: 'common',
  condition: {
    type: 'money_threshold',
    threshold: 10000
  },
  prestige: {
    company: {
      baseAmount: 0.5,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_COMFORTABLE: AchievementConfig = {
  id: 'comfortable',
  name: 'Comfortable Position',
  description: 'Accumulate €100,000 in cash',
  icon: '💵',
  category: 'financial',
  rarity: 'rare',
  condition: {
    type: 'money_threshold',
    threshold: 100000
  },
  prestige: {
    company: {
      baseAmount: 2.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_MILLIONAIRE: AchievementConfig = {
  id: 'millionaire',
  name: 'Millionaire',
  description: 'Accumulate €1,000,000 in cash',
  icon: '💎',
  category: 'financial',
  rarity: 'epic',
  condition: {
    type: 'money_threshold',
    threshold: 1000000
  },
  prestige: {
    company: {
      baseAmount: 10.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_MOGUL: AchievementConfig = {
  id: 'mogul',
  name: 'Wine Mogul',
  description: 'Reach €10,000,000 in cash reserves',
  icon: '👑',
  category: 'financial',
  rarity: 'legendary',
  condition: {
    type: 'money_threshold',
    threshold: 10000000
  },
  prestige: {
    company: {
      baseAmount: 50.0,
      decayRate: 0
    }
  }
};

// ===== TIME-BASED ACHIEVEMENTS =====

export const ACHIEVEMENT_FIRST_YEAR: AchievementConfig = {
  id: 'first_year',
  name: 'Rookie Vintner',
  description: 'Survive your first year in business',
  icon: '📅',
  category: 'time',
  rarity: 'common',
  condition: {
    type: 'time_threshold',
    threshold: 1
  },
  prestige: {
    company: {
      baseAmount: 0.5,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_VETERAN: AchievementConfig = {
  id: 'veteran_vintner',
  name: 'Veteran Vintner',
  description: 'Run your company for 5 years',
  icon: '⏰',
  category: 'time',
  rarity: 'rare',
  condition: {
    type: 'time_threshold',
    threshold: 5
  },
  prestige: {
    company: {
      baseAmount: 3.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_DECADE: AchievementConfig = {
  id: 'decade_winery',
  name: 'Decade of Excellence',
  description: 'Operate your winery for 10 years',
  icon: '🎂',
  category: 'time',
  rarity: 'epic',
  condition: {
    type: 'time_threshold',
    threshold: 10
  },
  prestige: {
    company: {
      baseAmount: 8.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_LEGACY: AchievementConfig = {
  id: 'legacy_winery',
  name: 'Legacy Winery',
  description: 'Build a 25-year legacy',
  icon: '🏛️',
  category: 'time',
  rarity: 'legendary',
  condition: {
    type: 'time_threshold',
    threshold: 25
  },
  prestige: {
    company: {
      baseAmount: 20.0,
      decayRate: 0
    }
  }
};

// ===== PRODUCTION ACHIEVEMENTS =====

export const ACHIEVEMENT_FIRST_WINE: AchievementConfig = {
  id: 'first_wine',
  name: 'First Vintage',
  description: 'Produce your first wine',
  icon: '🍾',
  category: 'production',
  rarity: 'common',
  condition: {
    type: 'production_count',
    threshold: 1
  },
  prestige: {
    company: {
      baseAmount: 0.3,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_BOTTLER: AchievementConfig = {
  id: 'dedicated_bottler',
  name: 'Dedicated Bottler',
  description: 'Produce 10 different wines',
  icon: '🍷',
  category: 'production',
  rarity: 'common',
  condition: {
    type: 'production_count',
    threshold: 10
  },
  prestige: {
    company: {
      baseAmount: 1.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_WINE_MASTER: AchievementConfig = {
  id: 'wine_master',
  name: 'Wine Master',
  description: 'Produce 50 different wines',
  icon: '🎯',
  category: 'production',
  rarity: 'rare',
  condition: {
    type: 'production_count',
    threshold: 50
  },
  prestige: {
    company: {
      baseAmount: 4.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_PROLIFIC: AchievementConfig = {
  id: 'prolific_producer',
  name: 'Prolific Producer',
  description: 'Produce 100 different wines',
  icon: '🏭',
  category: 'production',
  rarity: 'epic',
  condition: {
    type: 'production_count',
    threshold: 100
  },
  prestige: {
    company: {
      baseAmount: 10.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_FIRST_BOTTLE: AchievementConfig = {
  id: 'first_bottle',
  name: 'First Bottle',
  description: 'Bottle your first wine',
  icon: '🍇',
  category: 'production',
  rarity: 'common',
  condition: {
    type: 'bottles_produced',
    threshold: 1
  },
  prestige: {
    company: {
      baseAmount: 0.2,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_THOUSAND_BOTTLES: AchievementConfig = {
  id: 'thousand_bottles',
  name: 'Thousand Bottles',
  description: 'Produce 1,000 bottles of wine',
  icon: '📦',
  category: 'production',
  rarity: 'rare',
  condition: {
    type: 'bottles_produced',
    threshold: 1000
  },
  prestige: {
    company: {
      baseAmount: 3.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_MASS_PRODUCTION: AchievementConfig = {
  id: 'mass_production',
  name: 'Mass Production',
  description: 'Produce 10,000 bottles of wine',
  icon: '🏗️',
  category: 'production',
  rarity: 'epic',
  condition: {
    type: 'bottles_produced',
    threshold: 10000
  },
  prestige: {
    company: {
      baseAmount: 8.0,
      decayRate: 0
    }
  }
};

// ===== SALES ACHIEVEMENTS =====

export const ACHIEVEMENT_FIRST_SALE: AchievementConfig = {
  id: 'first_sale',
  name: 'First Sale',
  description: 'Make your first wine sale',
  icon: '🤝',
  category: 'production',
  rarity: 'common',
  condition: {
    type: 'sales_count',
    threshold: 1
  },
  prestige: {
    company: {
      baseAmount: 0.3,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_REGULAR_SELLER: AchievementConfig = {
  id: 'regular_seller',
  name: 'Regular Seller',
  description: 'Complete 10 sales',
  icon: '💼',
  category: 'production',
  rarity: 'common',
  condition: {
    type: 'sales_count',
    threshold: 10
  },
  prestige: {
    company: {
      baseAmount: 1.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_SALES_PRO: AchievementConfig = {
  id: 'sales_pro',
  name: 'Sales Professional',
  description: 'Complete 100 sales',
  icon: '📈',
  category: 'production',
  rarity: 'rare',
  condition: {
    type: 'sales_count',
    threshold: 100
  },
  prestige: {
    company: {
      baseAmount: 4.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_SALES_MOGUL: AchievementConfig = {
  id: 'sales_mogul',
  name: 'Sales Mogul',
  description: 'Complete 500 sales',
  icon: '💹',
  category: 'production',
  rarity: 'epic',
  condition: {
    type: 'sales_count',
    threshold: 500
  },
  prestige: {
    company: {
      baseAmount: 12.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_REVENUE_MILESTONE: AchievementConfig = {
  id: 'revenue_milestone',
  name: 'Revenue Milestone',
  description: 'Reach €100,000 in total sales',
  icon: '💸',
  category: 'production',
  rarity: 'rare',
  condition: {
    type: 'sales_value',
    threshold: 100000
  },
  prestige: {
    company: {
      baseAmount: 3.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_REVENUE_KING: AchievementConfig = {
  id: 'revenue_king',
  name: 'Revenue King',
  description: 'Reach €1,000,000 in total sales',
  icon: '🏆',
  category: 'production',
  rarity: 'epic',
  condition: {
    type: 'sales_value',
    threshold: 1000000
  },
  prestige: {
    company: {
      baseAmount: 10.0,
      decayRate: 0
    }
  }
};

// ===== PRESTIGE ACHIEVEMENTS =====

export const ACHIEVEMENT_PRESTIGIOUS: AchievementConfig = {
  id: 'prestigious_company',
  name: 'Prestigious Company',
  description: 'Accumulate 100 prestige points',
  icon: '⭐',
  category: 'prestige',
  rarity: 'rare',
  condition: {
    type: 'prestige_threshold',
    threshold: 100
  },
  prestige: {
    company: {
      baseAmount: 5.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_RENOWNED: AchievementConfig = {
  id: 'renowned_winery',
  name: 'Renowned Winery',
  description: 'Reach 500 prestige points',
  icon: '🌟',
  category: 'prestige',
  rarity: 'epic',
  condition: {
    type: 'prestige_threshold',
    threshold: 500
  },
  prestige: {
    company: {
      baseAmount: 15.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_LEGENDARY: AchievementConfig = {
  id: 'legendary_status',
  name: 'Legendary Status',
  description: 'Achieve 1000 prestige points',
  icon: '👑',
  category: 'prestige',
  rarity: 'legendary',
  condition: {
    type: 'prestige_threshold',
    threshold: 1000
  },
  prestige: {
    company: {
      baseAmount: 30.0,
      decayRate: 0
    }
  }
};

// ===== VINEYARD ACHIEVEMENTS =====

export const ACHIEVEMENT_FIRST_VINEYARD: AchievementConfig = {
  id: 'first_vineyard',
  name: 'Land Owner',
  description: 'Purchase your first vineyard',
  icon: '🌿',
  category: 'special',
  rarity: 'common',
  condition: {
    type: 'vineyard_count',
    threshold: 1
  },
  prestige: {
    company: {
      baseAmount: 0.5,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_VINEYARD_PORTFOLIO: AchievementConfig = {
  id: 'vineyard_portfolio',
  name: 'Vineyard Portfolio',
  description: 'Own 5 vineyards',
  icon: '🏞️',
  category: 'special',
  rarity: 'rare',
  condition: {
    type: 'vineyard_count',
    threshold: 5
  },
  prestige: {
    company: {
      baseAmount: 4.0,
      decayRate: 0
    }
  }
};

export const ACHIEVEMENT_VINEYARD_EMPIRE: AchievementConfig = {
  id: 'vineyard_empire',
  name: 'Vineyard Empire',
  description: 'Own 10 vineyards',
  icon: '🗺️',
  category: 'special',
  rarity: 'epic',
  condition: {
    type: 'vineyard_count',
    threshold: 10
  },
  prestige: {
    company: {
      baseAmount: 12.0,
      decayRate: 0
    }
  }
};

// ===== EXPORT ALL ACHIEVEMENTS =====

/**
 * All achievement configurations
 * Centralized array for easy iteration
 */
export const ALL_ACHIEVEMENTS: AchievementConfig[] = [
  // Financial
  ACHIEVEMENT_FIRST_EURO,
  ACHIEVEMENT_PROFITABLE,
  ACHIEVEMENT_COMFORTABLE,
  ACHIEVEMENT_MILLIONAIRE,
  ACHIEVEMENT_MOGUL,
  
  // Time
  ACHIEVEMENT_FIRST_YEAR,
  ACHIEVEMENT_VETERAN,
  ACHIEVEMENT_DECADE,
  ACHIEVEMENT_LEGACY,
  
  // Production
  ACHIEVEMENT_FIRST_WINE,
  ACHIEVEMENT_BOTTLER,
  ACHIEVEMENT_WINE_MASTER,
  ACHIEVEMENT_PROLIFIC,
  ACHIEVEMENT_FIRST_BOTTLE,
  ACHIEVEMENT_THOUSAND_BOTTLES,
  ACHIEVEMENT_MASS_PRODUCTION,
  
  // Sales
  ACHIEVEMENT_FIRST_SALE,
  ACHIEVEMENT_REGULAR_SELLER,
  ACHIEVEMENT_SALES_PRO,
  ACHIEVEMENT_SALES_MOGUL,
  ACHIEVEMENT_REVENUE_MILESTONE,
  ACHIEVEMENT_REVENUE_KING,
  
  // Prestige
  ACHIEVEMENT_PRESTIGIOUS,
  ACHIEVEMENT_RENOWNED,
  ACHIEVEMENT_LEGENDARY,
  
  // Vineyards
  ACHIEVEMENT_FIRST_VINEYARD,
  ACHIEVEMENT_VINEYARD_PORTFOLIO,
  ACHIEVEMENT_VINEYARD_EMPIRE,
];

/**
 * Get achievement configuration by ID
 */
export function getAchievementConfig(achievementId: string): AchievementConfig | undefined {
  return ALL_ACHIEVEMENTS.find(achievement => achievement.id === achievementId);
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(category: string): AchievementConfig[] {
  return ALL_ACHIEVEMENTS.filter(achievement => achievement.category === category);
}

/**
 * Get achievements by rarity
 */
export function getAchievementsByRarity(rarity: string): AchievementConfig[] {
  return ALL_ACHIEVEMENTS.filter(achievement => achievement.rarity === rarity);
}

