export enum WorkCategory {
  PLANTING = 'PLANTING',
  HARVESTING = 'HARVESTING',
  CRUSHING = 'CRUSHING',
  FERMENTATION = 'FERMENTATION',
  CLEARING = 'CLEARING',
  BUILDING = 'BUILDING',
  UPGRADING = 'UPGRADING',
  ADMINISTRATION_AND_RESEARCH = 'ADMINISTRATION_AND_RESEARCH',
  STAFF_SEARCH = 'STAFF_SEARCH',
  STAFF_HIRING = 'STAFF_HIRING',
  LAND_SEARCH = 'LAND_SEARCH',
  LENDER_SEARCH = 'LENDER_SEARCH',
  TAKE_LOAN = 'TAKE_LOAN',
  FINANCE_AND_STAFF = 'FINANCE_AND_STAFF'
}

export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';

export interface GameDate {
  week: number;
  season: Season;
  year: number;
}

/**
 * Notification categories - unified system for all notification types
 */
export enum NotificationCategory {
  SYSTEM = 'system',
  VINEYARD_OPERATIONS = 'field',
  WINEMAKING_PROCESS = 'winery',
  FINANCE_AND_STAFF = 'financeAndStaff',
  SALES_ORDERS = 'sales',
  ADMINISTRATION_AND_RESEARCH = 'administrationAndResearch',
  TIME_CALENDAR = 'time',
  STAFF_MANAGEMENT = 'staff',
  ACTIVITIES_TASKS = 'tasks'
}
