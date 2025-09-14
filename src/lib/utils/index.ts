// Barrel export for common utilities to reduce import duplication

// Formatting utilities
export { 
  formatNumber, 
  formatCurrency, 
  formatDate, 
  formatGameDate, 
  formatGameDateFromObject,
  formatPercent,
  formatTime,
  formatCompact,
  getColorClass,
  calculateCompanyWeeks
} from './utils';

// Calculation utilities
export { 
  calculateSteppedBalance,
  calculateAsymmetricalMultiplier,
  getRandomAcres,
  farmlandAgePrestigeModifier,
  calculateBaseWinePrice,
  calculateSymmetricalMultiplier,
  calculateOrderAmount
} from './calculator';

// Company utilities
export { 
  getCurrentCompanyId,
  getCompanyQuery,
  getCompanyDeleteQuery,
  getCompanyUpdateQuery,
  insertCompanyRecord,
  upsertCompanyRecord,
  getAllCompanyRecords,
  getCompanyRecord
} from './companyUtils';

// Flag utilities
export { 
  getFlagIcon,
  getCountryFlag
} from './flags';

// Wine utilities
export { 
  getAvailableBottledWines,
  loadFormattedRelationshipBreakdown
} from './UIWineFilters';


// Emoji utilities
export { 
  NAVIGATION_EMOJIS
} from './emojis';
