import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/shadCN/card';
import { Button } from '@/components/ui/shadCN/button';
import { Badge } from '@/components/ui/shadCN/badge';
import { Play, CheckCircle2, XCircle, Loader2, ExternalLink, TestTube, Sparkles, RefreshCw } from 'lucide-react';
import { useLoadingState } from '@/hooks';
import { Vineyard as VineyardType } from '@/lib/types/types';
import { calculateVineyardExpectedYield } from '@/lib/services';
import { formatNumber } from '@/lib/utils/utils';
import { VineyardModal } from '@/components/ui';
import { createVineyard } from '@/lib/services/vineyard/vineyardService';
import { getCurrentCompany } from '@/lib/services/core/gameState';
import { loadVineyards, saveVineyard, deleteVineyards } from '@/lib/database/activities/vineyardDB';

// Test descriptions extracted from actual test files
// Only includes tests that actually exist in the codebase
interface TestDescription {
  name: string;
  scenario?: string;
  expected?: string;
  whyItMatters?: string;
}

interface TestSuite {
  file: string;
  title: string;
  description: string;
  formula?: string;
  groups: Array<{
    name: string;
    tests: TestDescription[];
  }>;
}

const testSuites: Record<string, TestSuite> = {
  'vineyardCreation.test.ts': {
    file: 'tests/vineyard/vineyardCreation.test.ts',
    title: 'Vineyard Creation - Size Distribution',
    description: 'Tests that vineyard creation produces realistic size distributions matching expected probability buckets',
    groups: [
      {
        name: 'getRandomHectares() distribution validation',
        tests: [
          {
            name: 'generates hectares within valid range (0.05 to 2000)',
            scenario: 'Sampling 1000 random vineyard sizes',
            expected: 'All hectares between 0.05 and 2000'
          },
          {
            name: 'generates hectares with 0.01 precision (2 decimal places)',
            scenario: 'Checking precision of generated hectare values',
            expected: 'All values have at most 2 decimal places'
          },
          {
            name: 'distributes vineyards across size buckets with expected probabilities',
            scenario: 'Statistical sampling of 10,000 vineyards',
            expected: 'Distribution matches expected bucket weights (±5% tolerance)'
          },
          {
            name: 'produces more small vineyards (0.05-2.5 ha) than large ones (10+ ha)',
            scenario: 'Comparing small vs large vineyard frequency',
            expected: 'Small vineyards are at least 10x more common than large ones'
          },
          {
            name: 'produces very small vineyards (0.05-0.5 ha) at expected rate (~25%)',
            scenario: 'Sampling 5,000 vineyards',
            expected: 'Very small vineyards appear 20-30% of the time'
          },
          {
            name: 'produces small vineyards (0.5-2.5 ha) at expected rate (~35%)',
            scenario: 'Sampling 5,000 vineyards',
            expected: 'Small vineyards appear 30-40% of the time'
          },
          {
            name: 'produces medium vineyards (2.5-5 ha) at expected rate (~28%)',
            scenario: 'Sampling 5,000 vineyards',
            expected: 'Medium vineyards appear 23-33% of the time'
          },
          {
            name: 'produces large vineyards (5-10 ha) at expected rate (~7%)',
            scenario: 'Sampling 5,000 vineyards',
            expected: 'Large vineyards appear 4-10% of the time'
          },
          {
            name: 'produces very large vineyards (10+ ha) at expected rare rate (~5.5% combined)',
            scenario: 'Sampling 10,000 vineyards for rare events',
            expected: 'Very large vineyards appear 3-7% of the time'
          },
          {
            name: 'never produces hectares below 0.05 (minimum bucket)',
            scenario: 'Sampling 1,000 vineyards',
            expected: 'All hectares >= 0.05'
          },
          {
            name: 'produces hectares that fall within defined bucket ranges',
            scenario: 'Verifying all hectares match bucket definitions',
            expected: 'All hectares fall within at least one defined bucket range'
          }
        ]
      }
    ]
  },
  'companyCreation.test.ts': {
    file: 'tests/user/companyCreation.test.ts',
    title: 'Company and User Creation - Database Persistence',
    description: 'Tests that company and user creation workflows successfully write data to the database. This automates the manual testing process where developers create companies/users through the UI and verify they appear in the database.',
    groups: [
      {
        name: 'Creating a Company with a User',
        tests: [
          {
            name: 'creates a user and company successfully and writes to database',
            scenario: 'Creating a company with a user through companyService.createCompany()',
            expected: 'Both user and company are created and can be retrieved from database',
            whyItMatters: 'This is the most common error - data not being successfully written to database'
          },
          {
            name: 'creates a company with user and sets correct default values',
            scenario: 'Verifying default values (money=0, prestige=STARTING_PRESTIGE, week=1, season=Spring)',
            expected: 'All default values match expected initialization constants',
            whyItMatters: 'Ensures new companies start with correct game state'
          },
          {
            name: 'prevents duplicate company names',
            scenario: 'Attempting to create two companies with the same name',
            expected: 'Second creation fails with "already exists" error',
            whyItMatters: 'Prevents database conflicts and ensures company names are unique'
          }
        ]
      },
      {
        name: 'Creating a Company without a User',
        tests: [
          {
            name: 'creates a company without user successfully and writes to database',
            scenario: 'Creating a company without user association',
            expected: 'Company is created with userId=null and can be retrieved from database',
            whyItMatters: 'Supports anonymous company creation workflow'
          },
          {
            name: 'creates a company without user and sets correct default values',
            scenario: 'Verifying default values for company without user',
            expected: 'All default values match expected initialization constants',
            whyItMatters: 'Ensures consistent initialization regardless of user association'
          }
        ]
      },
      {
        name: 'Database Persistence Verification',
        tests: [
          {
            name: 'can retrieve company immediately after creation',
            scenario: 'Creating company and immediately querying database',
            expected: 'Company is found in database right after creation',
            whyItMatters: 'Validates that database writes complete successfully before function returns'
          },
          {
            name: 'persists company data correctly in database',
            scenario: 'Verifying all company fields are saved correctly',
            expected: 'All fields (id, name, userId, money, prestige, dates) are persisted correctly',
            whyItMatters: 'Ensures complete data integrity - missing fields would break game functionality'
          },
          {
            name: 'persists user data correctly when created with company',
            scenario: 'Creating company with user and verifying user data in database',
            expected: 'User data (id, name, dates) is correctly saved and retrievable',
            whyItMatters: 'User data must be persisted correctly for company-user relationships to work'
          }
        ]
      },
      {
        name: 'Multiple Companies with Same User',
        tests: [
          {
            name: 'creates multiple companies for the same user successfully',
            scenario: 'Creating two companies linked to the same user',
            expected: 'Both companies are created and appear in user\'s company list',
            whyItMatters: 'Users should be able to have multiple companies (saves)'
          }
        ]
      }
    ]
  },
  'startingConditions.test.ts': {
    file: 'tests/user/startingConditions.test.ts',
    title: 'Starting Conditions - Country-Specific Setup',
    description: 'Tests that each starting condition (France, Italy, Germany, Spain, United States) correctly applies country-specific starting conditions including staff, money, loans, vineyards, and prestige.',
    groups: [
      {
        name: 'France Starting Conditions',
        tests: [
          {
            name: 'creates company with France starting conditions and applies all setup correctly',
            scenario: 'Creating company with France starting conditions and verifying staff, money, loan, vineyard, and prestige',
            expected: 'Company has 2 staff (Pierre, Camille), starting money 40000, loan 80000, vineyard in Bourgogne, prestige 5',
            whyItMatters: 'Ensures France starting conditions match the Latosha family story and game balance'
          },
          {
            name: 'verifies France starting condition configuration values',
            scenario: 'Checking France configuration structure',
            expected: 'All configuration values are valid and within expected ranges'
          }
        ]
      },
      {
        name: 'Italy Starting Conditions',
        tests: [
          {
            name: 'creates company with Italy starting conditions and applies all setup correctly',
            scenario: 'Creating company with Italy starting conditions and verifying staff, money, loan, vineyard, and prestige',
            expected: 'Company has 2 staff (Roberto, Bianca), starting money 55000, loan 48000, vineyard in Tuscany, prestige 2',
            whyItMatters: 'Ensures Italy starting conditions match the De Luca family story and game balance'
          },
          {
            name: 'verifies Italy starting condition configuration values',
            scenario: 'Checking Italy configuration structure',
            expected: 'All configuration values are valid and within expected ranges'
          }
        ]
      },
      {
        name: 'Germany Starting Conditions',
        tests: [
          {
            name: 'creates company with Germany starting conditions and applies all setup correctly',
            scenario: 'Creating company with Germany starting conditions and verifying staff, money, vineyard, and prestige',
            expected: 'Company has 4 staff (Johann, Lukas, Elsa, Klara), starting money 74000, vineyard in Mosel, prestige 1',
            whyItMatters: 'Ensures Germany starting conditions match the Weissburg family story (largest staff) and game balance'
          },
          {
            name: 'verifies Germany starting condition configuration values',
            scenario: 'Checking Germany configuration structure',
            expected: 'All configuration values are valid and within expected ranges'
          }
        ]
      },
      {
        name: 'Spain Starting Conditions',
        tests: [
          {
            name: 'creates company with Spain starting conditions and applies all setup correctly',
            scenario: 'Creating company with Spain starting conditions and verifying staff, money, loan, and vineyard',
            expected: 'Company has 1 staff (Miguel), starting money 100000, loan 5000, vineyard in Ribera del Duero',
            whyItMatters: 'Ensures Spain starting conditions match the Torres family story (highest starting money) and game balance'
          },
          {
            name: 'verifies Spain starting condition configuration values',
            scenario: 'Checking Spain configuration structure',
            expected: 'All configuration values are valid and within expected ranges'
          }
        ]
      },
      {
        name: 'United States Starting Conditions',
        tests: [
          {
            name: 'creates company with United States starting conditions and applies all setup correctly',
            scenario: 'Creating company with US starting conditions and verifying staff, money, and vineyard',
            expected: 'Company has 2 staff (Sarah, Robert), starting money 65000, vineyard in Napa Valley',
            whyItMatters: 'Ensures US starting conditions match the Mondavi family story and game balance'
          },
          {
            name: 'verifies United States starting condition configuration values',
            scenario: 'Checking US configuration structure',
            expected: 'All configuration values are valid and within expected ranges'
          }
        ]
      },
      {
        name: 'Starting Conditions Comparison',
        tests: [
          {
            name: 'verifies that each country has unique starting conditions',
            scenario: 'Comparing starting money and staff counts across all countries',
            expected: 'Countries have variation in starting money and staff counts',
            whyItMatters: 'Ensures each country offers unique gameplay experience'
          },
          {
            name: 'verifies that countries with loans have reasonable loan amounts',
            scenario: 'Checking loan configurations for France, Italy, and Spain',
            expected: 'All loans have valid principal, duration, interest rate values',
            whyItMatters: 'Ensures loans are balanced and don\'t break game economy'
          },
          {
            name: 'verifies that countries with prestige have reasonable prestige amounts',
            scenario: 'Checking prestige configurations for France, Italy, and Germany',
            expected: 'All prestige amounts are reasonable (0-100) with valid decay rates',
            whyItMatters: 'Ensures prestige bonuses are balanced and meaningful'
          }
        ]
      }
    ]
  },
  'hireStaffWorkflow.test.ts': {
    file: 'tests/user/hireStaffWorkflow.test.ts',
    title: 'Hire Staff Workflow - Complete Staff Search and Hiring Process',
    description: 'Tests the complete staff hiring workflow from search to hire. Validates that staff search activities generate candidates, hiring activities add staff to the database, and transactions are recorded correctly.',
    groups: [
      {
        name: 'Complete Staff Search Workflow',
        tests: [
          {
            name: 'creates company, starts staff search, completes search, and generates candidates',
            scenario: 'Creating company with starting conditions, starting staff search with options, completing search activity',
            expected: 'Search activity created, money deducted, candidates generated and stored in game state, activity removed after completion',
            whyItMatters: 'Validates that staff search creates activities correctly, generates candidates matching search criteria, and completes successfully'
          },
          {
            name: 'generates candidates with correct skill levels and specializations',
            scenario: 'Searching with specific skill level and specializations',
            expected: 'Candidates match search criteria (skill level range, specializations)',
            whyItMatters: 'Ensures search options are correctly applied to generated candidates'
          }
        ]
      },
      {
        name: 'Complete Hiring Workflow',
        tests: [
          {
            name: 'hires a candidate from search results and adds them to database',
            scenario: 'Completing staff search, selecting candidate, starting and completing hiring process',
            expected: 'Hiring activity created, staff added to database, first month wage deducted, transaction recorded, activity removed',
            whyItMatters: 'Most common error - data not being successfully written to database. Validates complete hiring workflow.'
          },
          {
            name: 'can hire multiple candidates from the same search',
            scenario: 'Completing search with 3 candidates, hiring 2 of them sequentially',
            expected: 'Both candidates added to database correctly with their unique data',
            whyItMatters: 'Ensures multiple hires from same search work correctly and don\'t conflict'
          },
          {
            name: 'prevents hiring when company has insufficient funds',
            scenario: 'Completing search, trying to hire candidate when company has less money than candidate wage',
            expected: 'Hiring process fails or returns null when insufficient funds',
            whyItMatters: 'Validates financial checks prevent hiring without sufficient funds'
          }
        ]
      },
      {
        name: 'Hire Staff via Manual Hire Modal',
        tests: [
          {
            name: 'manually hires staff using createStaff and addStaff directly',
            scenario: 'Using HireStaffModal to manually create and add staff (without search)',
            expected: 'Staff created and added to database with correct name, skills, and specializations',
            whyItMatters: 'Validates alternative hiring path through manual hire modal works correctly'
          }
        ]
      }
    ]
  },
  'yieldCalculator.test.ts': {
    file: 'tests/vineyard/yieldCalculator.test.ts',
    title: 'Vineyard Yield Calculator Tests',
    description: 'Tests the core vineyard yield formula that determines grape production when harvesting',
    formula: 'yield = (hectares × density × 1.5 kg/vine) × (suitability × naturalYield × ripeness × vineYield × health)',
    groups: [
      {
        name: 'Edge Cases - Prevents Game-Breaking Bugs',
        tests: [
          {
            name: 'returns 0 kg when vineyard has no grape variety planted (cannot harvest barren land)',
            scenario: 'Player hasn\'t planted grapes yet',
            expected: 'No yield possible',
            whyItMatters: 'Prevents harvesting from empty vineyards'
          },
          {
            name: 'returns 0 kg when grapes are unripe (harvesting too early produces nothing)',
            scenario: 'Player tries to harvest at 0% ripeness',
            expected: 'Zero yield (grapes not ready)',
            whyItMatters: 'Forces players to wait for proper harvest timing'
          },
          {
            name: 'handles missing optional fields gracefully (prevents crashes from incomplete data)',
            scenario: 'Database returns incomplete vineyard data',
            expected: 'Function doesn\'t crash, returns 0 safely',
            whyItMatters: 'Prevents save file corruption or migration issues from breaking the game'
          }
        ]
      },
      {
        name: 'Scale Factors - Ensures Realistic Vineyard Economics',
        tests: [
          {
            name: 'yield scales proportionally with vineyard size (2 hectares = 2x grapes)',
            scenario: 'Player buys a larger vineyard',
            expected: 'Double the size = double the grapes (all else equal)',
            whyItMatters: 'Makes vineyard purchases economically sensible'
          },
          {
            name: 'yield scales proportionally with vine density (more vines = more grapes)',
            scenario: 'High-density planting vs standard density',
            expected: 'More vines per hectare = more grapes',
            whyItMatters: 'Dense planting is a valid strategy (though requires more work)'
          }
        ]
      },
      {
        name: 'Quality Multipliers - Rewards Good Vineyard Management',
        tests: [
          {
            name: 'damaged vineyards (50% health) produce roughly half the yield of healthy ones',
            scenario: 'Neglected vineyard vs well-maintained vineyard',
            expected: 'Poor health = lower yields',
            whyItMatters: 'Incentivizes players to maintain vineyards (clearing activities)'
          },
          {
            name: 'riper grapes (80%) produce roughly double the yield of unripe grapes (40%)',
            scenario: 'Early harvest vs optimal harvest timing',
            expected: 'Waiting for ripeness = significantly more grapes',
            whyItMatters: 'Creates strategic timing decisions (harvest early or wait?)'
          },
          {
            name: 'mature vines (100% yield) produce double the yield of young vines (50% yield)',
            scenario: 'Newly planted vineyard vs established vineyard',
            expected: 'Vine age affects yield potential',
            whyItMatters: 'Rewards long-term vineyard investments'
          }
        ]
      },
      {
        name: 'Realistic Scenarios - Validates Game Balance',
        tests: [
          {
            name: 'produces realistic yields for an optimal 5-hectare vineyard',
            scenario: 'Perfect vineyard setup (5 hectares, optimal conditions)',
            expected: 'Substantial but realistic yield (10,000-100,000 kg)',
            whyItMatters: 'Ensures the economy scales correctly for larger operations'
          },
          {
            name: 'minimum health vineyards (10%) still produce some yield (prevents total crop failure)',
            scenario: 'Severely neglected vineyard at minimum health threshold',
            expected: 'Still produces some grapes (10% of normal)',
            whyItMatters: 'Prevents players from losing everything, allows recovery'
          }
        ]
      }
    ]
  },
  'grapeSuitability.test.ts': {
    file: 'tests/vineyard/grapeSuitability.test.ts',
    title: 'Grape Suitability Tests',
    description: 'Tests how well different grape varieties match with regions, altitudes, aspects, and soils',
    formula: 'suitability = weighted combination of (region match, altitude preference, sun exposure, soil preference)',
    groups: [
      {
        name: 'Core Functionality',
        tests: [
          {
            name: 'calculates suitability for a well-matched grape and region',
            scenario: 'Sangiovese in Tuscany with optimal conditions',
            expected: 'Overall suitability between 0.5-1.0'
          },
          {
            name: 'returns suitability metrics within 0-1 range',
            scenario: 'Chardonnay in Burgundy with standard conditions',
            expected: 'All metrics (region, altitude, sunExposure, soil, overall) between 0 and 1'
          }
        ]
      },
      {
        name: 'Error Handling',
        tests: [
          {
            name: 'throws error when country or region is missing',
            scenario: 'Missing country or region parameter',
            expected: 'Throws error with message about missing params'
          },
          {
            name: 'throws error for unsupported country',
            scenario: 'Trying to calculate suitability for unknown country',
            expected: 'Throws error indicating no data for country'
          }
        ]
      },
      {
        name: 'Environmental Factors',
        tests: [
          {
            name: 'calculates altitude suitability correctly for different altitudes',
            scenario: 'Tempranillo at low (200m), optimal (550m), and high (900m) altitudes',
            expected: 'Optimal altitude has better suitability than extremes'
          },
          {
            name: 'handles different aspect orientations',
            scenario: 'Pinot Noir with South vs North aspect',
            expected: 'Sun exposure differs based on aspect'
          },
          {
            name: 'handles soil preferences correctly',
            scenario: 'Pinot Noir with preferred soils (Clay, Limestone) vs non-preferred (Sand)',
            expected: 'Preferred soil has better suitability'
          }
        ]
      }
    ]
  },
  'workCalculator.test.ts': {
    file: 'tests/activity/workCalculator.test.ts',
    title: 'Work Calculation Tests',
    description: 'Tests how work units are calculated for activities based on density, modifiers, and staff contributions',
    formula: 'total_work = (base_work + density_adjustment) × modifiers × rounding',
    groups: [
      {
        name: 'Work Unit Calculations',
        tests: [
          {
            name: 'applies density adjustments and modifiers before rounding up',
            scenario: 'Work with density 2500, rate 2, modifiers +0.1 and -0.05',
            expected: 'Work = 71 (calculated with all factors)'
          },
          {
            name: 'falls back to base rate when density is absent or zero',
            scenario: 'Work with density 0 vs no density adjustment',
            expected: 'Both produce same result'
          }
        ]
      },
      {
        name: 'Staff Contributions',
        tests: [
          {
            name: 'returns zero when no staff are assigned',
            scenario: 'Activity with empty staff array',
            expected: 'Contribution = 0'
          },
          {
            name: 'honors specialization bonuses and multitask penalties',
            scenario: 'Staff A (specialized in field) vs Staff B (generalist), both doing planting',
            expected: 'Specialized staff contributes more efficiently'
          }
        ]
      },
      {
        name: 'Timeline Calculations',
        tests: [
          {
            name: 'derives timeline from staff contribution output',
            scenario: '200 work units with staff contributing 64 units/week',
            expected: 'Timeline = 4 weeks'
          }
        ]
      }
    ]
  },
  'wageService.test.ts': {
    file: 'tests/finance/wageService.test.ts',
    title: 'Wage Calculation Tests',
    description: 'Tests how staff wages are calculated based on skills and specializations',
    formula: 'wage = base (500) + (average skills × 1000) × specialization_multiplier^num_specializations',
    groups: [
      {
        name: 'Base Calculations',
        tests: [
          {
            name: 'calculates base wage for average skills without specializations',
            scenario: 'Staff with all skills at 0.5, no specializations',
            expected: 'Wage = 1000 (500 base + 500 from skills)'
          },
          {
            name: 'increases wage with higher average skills',
            scenario: 'Comparing low skills (0.3) vs high skills (0.8)',
            expected: 'Higher skills = higher wage'
          }
        ]
      },
      {
        name: 'Specialization Bonuses',
        tests: [
          {
            name: 'applies specialization bonus multiplicatively',
            scenario: '0, 1, 2, and 3 specializations with same base skills',
            expected: 'Each specialization multiplies wage by 1.3'
          },
          {
            name: 'handles multiple specializations correctly',
            scenario: 'Staff with all 5 specializations',
            expected: 'Wage = base × 1.3^5'
          }
        ]
      },
      {
        name: 'Edge Cases',
        tests: [
          {
            name: 'handles minimum skills (all zeros)',
            scenario: 'Staff with no skills',
            expected: 'Wage = 500 (base only)'
          },
          {
            name: 'handles maximum skills (all ones)',
            scenario: 'Staff with perfect skills',
            expected: 'Wage = 1500 (500 base + 1000 from skills)'
          },
          {
            name: 'rounds wage to nearest integer',
            scenario: 'Skills that would produce fractional wages',
            expected: 'Wage is always an integer'
          }
        ]
      }
    ]
  },
  'loanService.test.ts': {
    file: 'tests/finance/loanService.test.ts',
    title: 'Loan Calculation Tests',
    description: 'Tests how interest rates and loan payments are calculated based on economy, lender type, and credit rating',
    formula: 'effective_rate = base_rate × economy_multiplier × lender_multiplier × credit_modifier × duration_modifier',
    groups: [
      {
        name: 'Interest Rate Calculations',
        tests: [
          {
            name: 'applies economy phase multipliers correctly',
            scenario: 'Same loan in Expansion, Stable, and Recession',
            expected: 'Recession has higher rates than Expansion'
          },
          {
            name: 'applies lender type multipliers correctly',
            scenario: 'Comparing Bank, QuickLoan, and Private Lender',
            expected: 'QuickLoan has highest rates, Bank has lowest'
          },
          {
            name: 'applies credit rating modifier correctly',
            scenario: 'Excellent (0.9), Good (0.7), and Poor (0.3) credit ratings',
            expected: 'Better credit = lower interest rates'
          }
        ]
      },
      {
        name: 'Loan Payments',
        tests: [
          {
            name: 'calculates payment for a simple loan',
            scenario: '10,000 loan at 5% for 4 seasons (1 year)',
            expected: 'Payment > 0 and includes interest'
          },
          {
            name: 'returns higher payments for higher interest rates',
            scenario: 'Same loan at 3% vs 8% interest',
            expected: 'Higher rate = higher payment'
          },
          {
            name: 'returns lower payments for longer loan terms',
            scenario: 'Same loan for 4 seasons vs 12 seasons',
            expected: 'Longer term = lower payment (spread over more periods)'
          }
        ]
      },
      {
        name: 'Edge Cases',
        tests: [
          {
            name: 'handles zero principal gracefully',
            scenario: 'Loan with 0 principal',
            expected: 'Payment = 0'
          },
          {
            name: 'returns a positive interest rate',
            scenario: 'Any valid loan configuration',
            expected: 'Rate between 0 and 1 (0% and 100%)'
          }
        ]
      }
    ]
  },
  'fermentationCharacteristics.test.ts': {
    file: 'tests/wine/fermentationCharacteristics.test.ts',
    title: 'Fermentation Characteristics Tests',
    description: 'Tests how wine characteristics change during fermentation based on method and temperature',
    formula: 'final_characteristics = base_characteristics + fermentation_effects (clamped to 0-1)',
    groups: [
      {
        name: 'Fermentation Methods',
        tests: [
          {
            name: 'applies basic fermentation method effects correctly',
            scenario: 'Wine fermented with Basic method and Ambient temperature',
            expected: 'Aroma and body increase slightly'
          },
          {
            name: 'applies temperature controlled method effects',
            scenario: 'Wine fermented with Temperature Controlled method',
            expected: 'Aroma, body, and acidity are enhanced'
          },
          {
            name: 'applies extended maceration method effects',
            scenario: 'Wine fermented with Extended Maceration method',
            expected: 'Tannins, body, spice, and aroma significantly increase'
          }
        ]
      },
      {
        name: 'Temperature Effects',
        tests: [
          {
            name: 'applies different temperature settings correctly',
            scenario: 'Same method with Cool vs Warm temperature',
            expected: 'Final characteristics differ based on temperature'
          },
          {
            name: 'maintains characteristic values within valid 0-1 range',
            scenario: 'High characteristics (0.95) with Extended Maceration and Warm temperature',
            expected: 'All characteristics stay between 0 and 1 (clamped)'
          },
          {
            name: 'preserves low characteristic values when effects are minimal',
            scenario: 'Low characteristics (0.1) with Basic method and Cool temperature',
            expected: 'Characteristics increase slightly but remain relatively low'
          }
        ]
      },
      {
        name: 'Fermentation Information',
        tests: [
          {
            name: 'returns effects array for basic method and ambient temperature',
            scenario: 'Querying combined effects for Basic method',
            expected: 'Returns array of effect objects'
          },
          {
            name: 'returns method information for all available methods',
            scenario: 'Querying fermentation method information',
            expected: 'Returns info for Basic, Temperature Controlled, and Extended Maceration'
          },
          {
            name: 'has Basic method as baseline (workMultiplier 1.0, no cost)',
            scenario: 'Checking Basic method properties',
            expected: 'Work multiplier = 1.0, cost penalty = 0'
          }
        ]
      }
    ]
  }
};

interface TestFileResult {
  file: string;
  tests: number;
  duration: number;
  passed: boolean;
}

interface TestResult {
  passed: number;
  failed: number;
  total: number;
  status: 'idle' | 'running' | 'passed' | 'failed';
  output?: string;
  testFiles?: TestFileResult[];
}


const TestViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'human' | 'ai'>('human');
  const [testResult, setTestResult] = useState<TestResult>({
    passed: 0,
    failed: 0,
    total: 0,
    status: 'idle'
  });
  const [testVineyards, setTestVineyards] = useState<VineyardType[]>([]);
  const [testVineyardIds, setTestVineyardIds] = useState<string[]>([]); // Track IDs of created test vineyards
  const [selectedVineyard, setSelectedVineyard] = useState<VineyardType | null>(null);
  const [showVineyardModal, setShowVineyardModal] = useState(false);
  const { withLoading } = useLoadingState();

  // Delete test vineyards from database
  const deleteTestVineyards = async () => {
    try {
      if (testVineyardIds.length === 0) {
        return;
      }
      
      await deleteVineyards(testVineyardIds);
      setTestVineyardIds([]);
      setTestVineyards([]);
    } catch (error) {
      console.error('Error deleting test vineyards:', error);
    }
  };

  // Generate test vineyards matching yieldCalculator.test.ts scenarios
  const generateTestVineyards = async () => {
    try {
      // Check if there's an active company (user must be logged in)
      const currentCompany = getCurrentCompany();
      if (!currentCompany) {
        console.error('No active company found. Please log in and select a company first.');
        setTestVineyards([]);
        return;
      }
      
      // Delete old test vineyards first
      if (testVineyardIds.length > 0) {
        await deleteTestVineyards();
      }
      
      // Base vineyard matching yieldCalculator.test.ts baseVineyard
      const baseVineyardProps = {
        country: 'Italy',
        region: 'Tuscany',
        hectares: 1,
        grape: 'Sangiovese' as const,
        vineAge: 5,
        soil: ['Clay', 'Limestone'],
        altitude: 300,
        aspect: 'South' as const,
        density: 5000,
        vineyardHealth: 1.0,
        landValue: 50000,
        vineyardTotalValue: 50000,
        status: 'Planted' as const,
        ripeness: 0.8,
        vineyardPrestige: 0,
        vineYield: 1.0
      };

      // Create vineyards using actual createVineyard function, then update to match test scenarios
      const scenarioVineyards: Array<{ name: string; props: Partial<VineyardType> }> = [
        { name: 'Base Test Vineyard', props: baseVineyardProps },
        { name: 'Unplanted Vineyard (No Grape)', props: { ...baseVineyardProps, grape: null, status: 'Barren' as const, density: 0, vineAge: null } },
        { name: 'Unripe Grapes (0% Ripeness)', props: { ...baseVineyardProps, ripeness: 0 } },
        { name: 'Small Vineyard (1 ha)', props: { ...baseVineyardProps, hectares: 1 } },
        { name: 'Large Vineyard (2 ha)', props: { ...baseVineyardProps, hectares: 2, vineyardTotalValue: 100000 } },
        { name: 'Low Density (2,500 vines/ha)', props: { ...baseVineyardProps, density: 2500 } },
        { name: 'Standard Density (5,000 vines/ha)', props: { ...baseVineyardProps, density: 5000 } },
        { name: 'Damaged Vineyard (50% Health)', props: { ...baseVineyardProps, vineyardHealth: 0.5 } },
        { name: 'Healthy Vineyard (100% Health)', props: { ...baseVineyardProps, vineyardHealth: 1.0 } },
        { name: 'Early Harvest (40% Ripeness)', props: { ...baseVineyardProps, ripeness: 0.4 } },
        { name: 'Optimal Harvest (80% Ripeness)', props: { ...baseVineyardProps, ripeness: 0.8 } },
        { name: 'Young Vines (50% Yield)', props: { ...baseVineyardProps, vineYield: 0.5, vineAge: 1 } },
        { name: 'Mature Vines (100% Yield)', props: { ...baseVineyardProps, vineYield: 1.0, vineAge: 5 } },
        { name: 'Optimal 5ha Vineyard', props: { ...baseVineyardProps, hectares: 5, ripeness: 0.9, vineyardHealth: 0.95, vineyardTotalValue: 250000 } },
        { name: 'Minimum Health (10%)', props: { ...baseVineyardProps, vineyardHealth: 0.1 } }
      ];

      const vineyards: VineyardType[] = [];
      const createdIds: string[] = [];
      
      // Create each vineyard using createVineyard, then update to match scenario
      for (const scenario of scenarioVineyards) {
        // Create using actual function
        const vineyard = await createVineyard(scenario.name);
        createdIds.push(vineyard.id);
        
        // Update to match test scenario
        const updatedVineyard: VineyardType = {
          ...vineyard,
          ...scenario.props,
          name: scenario.name,
          vineyardTotalValue: scenario.props.vineyardTotalValue || (scenario.props.hectares || vineyard.hectares) * (scenario.props.landValue || vineyard.landValue)
        };
        
        // Save updated vineyard
        await saveVineyard(updatedVineyard);
        vineyards.push(updatedVineyard);
      }
      
      // Store IDs for later deletion
      setTestVineyardIds(createdIds);
      
      // Load all vineyards for the current company to display
      const allVineyards = await loadVineyards();
      setTestVineyards(allVineyards);
    } catch (error) {
      console.error('Error generating test vineyards:', error);
      // Fallback: show error message
      setTestVineyards([]);
    }
  };

  const handleVineyardClick = (vineyard: VineyardType) => {
    setSelectedVineyard(vineyard);
    setShowVineyardModal(true);
  };

  const runTests = async () => {
    await withLoading(async () => {
      // Clear old test data when starting a new run
      setTestResult({
        passed: 0,
        failed: 0,
        total: 0,
        status: 'running',
        output: undefined,
        testFiles: undefined
      });
      
      try {
        // Try to call API endpoint (may not exist yet)
        const response = await fetch('/api/test-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          setTestResult({
            passed: result.passed || 0,
            failed: result.failed || 0,
            total: result.total || 0,
            status: result.status || (result.failed > 0 ? 'failed' : 'passed'),
            output: result.output || result.message || 'No output',
            testFiles: result.testFiles || []
          });
        } else {
          const errorData = await response.json().catch(() => ({ message: 'API error' }));
          throw new Error(errorData.message || 'API not available');
        }
      } catch (error: any) {
        // Show error from API
        setTestResult({
          passed: 0,
          failed: 0,
          total: 0,
          status: 'failed',
          output: `Failed to run tests: ${error.message}\n\nMake sure the dev server is running and npm test works in terminal.`,
          testFiles: undefined
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Test Suite Viewer</h3>
          <p className="text-gray-600 text-xs mt-1">
            Human Automation Tests <span className="text-green-600 font-semibold">(primary)</span> | AI Test Suite <span className="text-gray-500">(reference)</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              // Open Vitest UI in a new window (requires test server to be running)
              // User should run: npm run test:watch -- --ui
              window.open('http://localhost:51204/__vitest__/', '_blank');
            }}
            variant="default"
            size="sm"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            title="Open Vitest UI (requires 'npm run test:watch -- --ui' in terminal)"
          >
            <ExternalLink className="h-4 w-4" />
            Open Vitest UI
          </Button>
          <Button
            onClick={runTests}
            disabled={testResult.status === 'running'}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            title="Run all tests via API"
          >
            {testResult.status === 'running' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run All Tests
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => window.open('/tests/README.md', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Test Docs
          </Button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'human' | 'ai')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="human" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Human Automation Tests
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Test Suite
          </TabsTrigger>
        </TabsList>

        {/* Human Automation Tests Tab */}
        <TabsContent value="human" className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Human Automation Tests
            </h4>
            <p className="text-sm text-blue-800 mb-3">
              These tests automate the manual testing you currently do by playing the game. 
              They validate that game features work correctly and produce expected results.
            </p>
            <p className="text-xs text-blue-700">
              <strong>Purpose:</strong> Replace manual "play and check" testing with automated validation of game mechanics.
            </p>
      </div>

          {/* Test Results Summary - Shown in Human Automation Tab */}
      {testResult.status !== 'idle' && testResult.output && (
        <div className={`p-3 rounded-lg border text-sm ${
          testResult.status === 'passed' ? 'bg-green-50 border-green-200' :
          testResult.status === 'failed' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {testResult.status === 'passed' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {testResult.status === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
              {testResult.status === 'running' && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
              <span className="font-medium text-xs">
                {testResult.status === 'passed' && `✓ ${testResult.passed} tests passed`}
                {testResult.status === 'failed' && `✗ ${testResult.failed}/${testResult.total} tests failed`}
                {testResult.status === 'running' && 'Running tests...'}
              </span>
            </div>
            {testResult.testFiles && testResult.testFiles.length > 0 && testResult.status === 'passed' && (
              <span className="text-xs text-gray-600">
                {testResult.testFiles.length} test files • See details below
              </span>
            )}
          </div>
          {/* Show raw output only if there are no structured test files, or for errors */}
          {(!testResult.testFiles || testResult.testFiles.length === 0 || testResult.status === 'failed') && (
            <details className="mt-2">
              <summary className="text-xs font-medium text-gray-600 cursor-pointer hover:text-gray-800 mb-2">
                Show raw output
              </summary>
              <pre className="text-xs bg-black/5 p-2 rounded whitespace-pre-wrap font-mono max-h-96 overflow-auto">
                {testResult.output}
              </pre>
            </details>
          )}
        </div>
      )}

          {/* Human Automation Test Suites - Only show after tests are run */}
          {testResult.status !== 'idle' && (
            <div className="space-y-6">
              {Object.entries(testSuites)
                .filter(([key]) => key === 'vineyardCreation.test.ts' || key === 'companyCreation.test.ts' || key === 'startingConditions.test.ts' || key === 'hireStaffWorkflow.test.ts') // Only show human automation tests
                .map(([key, suite]) => {
                const matchingTestFile = testResult.testFiles?.find(tf => {
                  const fileName = tf.file.split('/').pop() || tf.file; // Get just the filename
                  const keyName = key.replace('.test.ts', ''); // Remove .test.ts extension
                  const keyFull = key; // Full key with extension
                  // Match by filename or full path
                  return fileName === key || 
                         fileName === keyFull || 
                         tf.file.includes(keyName) || 
                         tf.file.includes(keyFull);
                });

                return (
                  <Card key={key}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TestTube className="h-4 w-4" />
                          {suite.title}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          Human Automation
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{suite.description}</p>
                      <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 mb-1">What this replaces:</p>
                        <p className="text-xs text-gray-600">
                          {key === 'vineyardCreation.test.ts' && 'Manual testing: Creating 100+ vineyards in-game and checking that size distribution looks realistic.'}
                          {key === 'companyCreation.test.ts' && 'Manual testing: Creating companies with and without users through the login screen, then checking the database to verify they were saved correctly.'}
                          {key === 'startingConditions.test.ts' && 'Manual testing: Creating a company with each starting condition (France, Italy, Germany, Spain, US) through the UI, then manually checking that staff, money, loans, vineyards, and prestige match the configuration.'}
                          {key === 'hireStaffWorkflow.test.ts' && 'Manual testing: Opening Staff page, clicking "Search Staff", configuring search options, waiting for search to complete, viewing results modal, hiring candidates, waiting for hiring activity to complete, verifying new staff appears in list, checking transactions for costs.'}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs mt-2 w-fit">
                        {suite.file}
                      </Badge>
                      {matchingTestFile && (
                        <div className={`mt-3 p-4 rounded-lg border ${
                          matchingTestFile.passed 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            {matchingTestFile.passed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <h5 className="font-semibold text-sm">
                              {matchingTestFile.passed ? 'Test Results' : 'Test Failed'}
                            </h5>
                          </div>
                          <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-gray-600">Tests:</span>
                                <span className={`ml-2 font-semibold ${
                                  matchingTestFile.passed ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {matchingTestFile.tests} {matchingTestFile.passed ? 'passed' : 'failed'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Duration:</span>
                                <span className="ml-2 font-semibold text-gray-700">{matchingTestFile.duration}ms</span>
                              </div>
                            </div>
                            {matchingTestFile.passed && (
                              <div className="pt-2 border-t border-green-300">
                                <p className="text-sm text-green-800">
                                  ✓ All {matchingTestFile.tests} test cases passed in {matchingTestFile.duration}ms
                                </p>
                                {testResult.output && (
                                  <p className="text-xs text-green-700 mt-2">
                                    See detailed test output below for specific test results.
                                  </p>
                                )}
                              </div>
                            )}
                            {testResult.output && (
                              <details className="pt-2 border-t border-gray-300">
                                <summary className="cursor-pointer text-gray-700 hover:text-gray-900 font-medium">
                                  {matchingTestFile.passed ? 'View detailed test output' : 'View error details'}
                                </summary>
                                <pre className="mt-2 p-2 bg-white rounded text-xs font-mono overflow-auto max-h-48 border border-gray-200">
                                  {testResult.output.split('\n').slice(0, 50).join('\n')}
                                  {testResult.output.split('\n').length > 50 && '\n... (truncated - see full output in terminal or Vitest UI)'}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <Accordion type="multiple" className="w-full">
                        {suite.groups.map((group, groupIndex) => (
                          <AccordionItem key={groupIndex} value={`${key}-group-${groupIndex}`}>
                            <AccordionTrigger className="text-sm font-medium py-3">
                              <div className="flex items-center justify-between w-full pr-4">
                                <span>{group.name}</span>
                                <span className="text-xs text-gray-500">
                                  {group.tests.length} {group.tests.length === 1 ? 'test' : 'tests'}
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-3 pt-2">
                                {group.tests.map((test, testIndex) => (
                                  <div
                                    key={testIndex}
                                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <h5 className="text-sm font-semibold text-gray-800">
                                        {test.name}
                                      </h5>
                                      {matchingTestFile && matchingTestFile.passed && (
                                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 ml-2" />
                                      )}
                                    </div>
                                    <div className="space-y-1 text-xs text-gray-600">
                                      {test.scenario && (
                                        <div>
                                          <span className="font-medium">Scenario:</span>{' '}
                                          <span>{test.scenario}</span>
                                        </div>
                                      )}
                                      {test.expected && (
                                        <div>
                                          <span className="font-medium">Expected:</span>{' '}
                                          <span>{test.expected}</span>
                                        </div>
                                      )}
                                      {test.whyItMatters && (
                                        <div>
                                          <span className="font-medium">Why it matters:</span>{' '}
                                          <span>{test.whyItMatters}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={runTests}
                          disabled={testResult.status === 'running'}
                          variant="default"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          {testResult.status === 'running' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Running...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              Run Test
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() => window.open('http://localhost:51204/__vitest__/', '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                          View in Vitest UI
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Show message when no tests have been run yet */}
          {testResult.status === 'idle' && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Click "Run All Tests" above to execute tests and see results.
                </p>
                <Button
                  onClick={runTests}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2 mx-auto"
                >
                  <Play className="h-4 w-4" />
                  Run Tests
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Placeholder for future human automation tests */}
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-sm text-gray-500">More Human Automation Tests Coming Soon</CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Future tests will automate other manual testing scenarios like:
              </p>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                <li>✅ Company and user creation (COMPLETED)</li>
                <li>✅ Starting conditions for all countries (COMPLETED)</li>
                <li>✅ Hire staff workflow validation (COMPLETED)</li>
                <li>Take loan workflow validation</li>
                <li>Find/buy land workflow validation</li>
                <li>Plant vineyard workflow validation</li>
                <li>Harvest grapes workflow validation</li>
                <li>Crush grapes workflow validation</li>
                <li>Ferment wine workflow validation</li>
                <li>Bottle wine workflow validation</li>
                <li>Get, accept and receive orders workflow validation</li>
                <li>Get, fulfill and reject contracts workflow validation</li>
              </ul>
            </CardContent>
          </Card>

          {/* All Test Files Results */}
          {testResult.testFiles && testResult.testFiles.length > 0 && (
            <div className="mt-6">
                <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Test Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                  <div className="space-y-2">
                    {testResult.testFiles.map((testFile, index) => {
                      const fileName = testFile.file.split('/').pop() || testFile.file;
                      return (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border text-xs ${
                            testFile.passed
                              ? 'bg-green-50 border-green-200'
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {testFile.passed ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className="font-medium">{fileName}</span>
                                  </div>
                            <div className="flex items-center gap-3 text-gray-600">
                              <span>{testFile.tests} {testFile.tests === 1 ? 'test' : 'tests'}</span>
                              <span>•</span>
                              <span>{testFile.duration}ms</span>
                                    </div>
                                    </div>
                                    </div>
                      );
                    })}
                                      </div>
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">Total:</span>
                      <div className="flex items-center gap-4">
                        <span className="text-green-600">
                          ✓ {testResult.passed} passed
                        </span>
                        {testResult.failed > 0 && (
                          <span className="text-red-600">
                            ✗ {testResult.failed} failed
                          </span>
                        )}
                        <span className="text-gray-600">
                          {testResult.total} total
                        </span>
                                  </div>
                                </div>
                            </div>
                  </CardContent>
                </Card>
            </div>
          )}
                </TabsContent>

        {/* AI Test Suite Tab */}
        <TabsContent value="ai" className="space-y-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Test Suite (Reference)
            </h4>
            <p className="text-sm text-purple-800 mb-3">
              These are automated unit tests generated by AI to validate core game mechanics and formulas.
              They serve as regression tests and documentation of expected behavior.
            </p>
            <p className="text-xs text-purple-700">
              <strong>Note:</strong> These tests are primarily for AI reference and regression prevention. 
              Human automation tests (above) focus on validating user-facing workflows.
            </p>
          </div>

          {/* Info Banner for AI Tests */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs">
            <p className="font-semibold text-purple-900 mb-1">📋 AI Test Suite Status:</p>
            <ul className="list-disc list-inside text-purple-800 space-y-1">
              <li><strong>Test Files:</strong> Run tests to see live results</li>
              <li><strong>Test Vineyards:</strong> Generated dynamically using <code>createVineyard()</code> function (saved to active company - use "Delete Test Vineyards" to clean up)</li>
              <li><strong>Real Test Results:</strong> Click "Run All Tests" button above to execute tests and see live results</li>
              <li><strong>Alternative:</strong> Use "Open Vitest UI" button (requires <code>npm run test:watch -- --ui</code> in terminal)</li>
            </ul>
          </div>

          {/* Test Vineyards - Generated using createVineyard() function */}
          {testResult.status !== 'idle' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-gray-800">
                  Test Vineyards <span className="text-xs font-normal text-gray-500">(Generated using actual createVineyard() function - saved to active company)</span>
                </h4>
                <div className="flex gap-2">
                  {testVineyardIds.length > 0 && (
                    <Button
                      onClick={deleteTestVineyards}
                      variant="destructive"
                      size="sm"
                      className="flex items-center gap-2"
                      title="Delete all test vineyards from database"
                    >
                      <XCircle className="h-4 w-4" />
                      Delete Test Vineyards
                    </Button>
                  )}
                  <Button
                    onClick={generateTestVineyards}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    title="Generate test vineyards matching yieldCalculator.test.ts scenarios using createVineyard()"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {testVineyardIds.length > 0 ? 'Regenerate Vineyards' : 'Generate Vineyards'}
                  </Button>
                </div>
              </div>
              
              {testVineyards.length === 0 && (
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-sm text-gray-600">
                      {!getCurrentCompany() 
                        ? 'Please log in and select a company to generate test vineyards.'
                        : 'Click "Regenerate" to create test vineyards using the actual createVineyard() function.'}
                    </p>
                  </CardContent>
                </Card>
              )}
              
              {testVineyards.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {testVineyards.map((vineyard) => {
                  const yieldData = calculateVineyardExpectedYield(vineyard);
                  return (
                    <Card
                      key={vineyard.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => handleVineyardClick(vineyard)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{vineyard.name}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {vineyard.grape || 'Unplanted'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {vineyard.region}, {vineyard.country}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Size:</span>
                            <span className="ml-1 font-medium">{vineyard.hectares} ha</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Density:</span>
                            <span className="ml-1 font-medium">{vineyard.density?.toLocaleString() || 0} vines/ha</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Health:</span>
                            <span className="ml-1 font-medium">
                              {formatNumber((vineyard.vineyardHealth || 1.0) * 100, { smartDecimals: true })}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Aspect:</span>
                            <span className="ml-1 font-medium">{vineyard.aspect}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Altitude:</span>
                            <span className="ml-1 font-medium">{vineyard.altitude}m</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Value:</span>
                            <span className="ml-1 font-medium">
                              {formatNumber(vineyard.vineyardTotalValue || 0, { currency: true })}
                            </span>
                          </div>
                          {vineyard.grape && (
                            <>
                              <div>
                                <span className="text-gray-500">Ripeness:</span>
                                <span className="ml-1 font-medium">
                                  {formatNumber((vineyard.ripeness || 0) * 100, { smartDecimals: true })}%
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Vine Yield:</span>
                                <span className="ml-1 font-medium">
                                  {formatNumber((vineyard.vineYield || 0.02) * 100, { smartDecimals: true })}%
                                </span>
                              </div>
                              {yieldData && (
                                <div className="col-span-2 pt-1 border-t">
                                  <span className="text-gray-500">Expected Yield:</span>
                                  <span className="ml-1 font-semibold text-green-600">
                                    {formatNumber(yieldData.totalYield, { smartDecimals: true })} kg
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              )}
            </div>
          )}

          {/* Test Suites - Display actual test descriptions - Only show after tests are run */}
          {testResult.status !== 'idle' && (
            <div className="space-y-6">
              {Object.entries(testSuites)
                .filter(([key]) => key !== 'vineyardCreation.test.ts') // Exclude human automation tests (shown in other tab)
                .map(([key, suite]) => {
              // Check if this test file has results
              const matchingTestFile = testResult.testFiles?.find(tf => 
                tf.file.includes(key.replace('.test.ts', '')) || tf.file.includes(key)
              );

              return (
                <Card key={key}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{suite.title}</CardTitle>
                      {matchingTestFile && (
                        <Badge variant={matchingTestFile.passed ? 'default' : 'destructive'} className="text-xs">
                          {matchingTestFile.passed ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> {matchingTestFile.tests} tests passed</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" /> Failed</>
                          )}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{suite.description}</p>
                    {suite.formula && (
                      <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs font-semibold text-blue-900 mb-1">Formula:</p>
                        <code className="text-xs text-blue-800">{suite.formula}</code>
                      </div>
                    )}
                    <Badge variant="outline" className="text-xs mt-2 w-fit">
                      {suite.file}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" className="w-full">
                      {suite.groups.map((group, groupIndex) => (
                        <AccordionItem key={groupIndex} value={`${key}-group-${groupIndex}`}>
                          <AccordionTrigger className="text-sm font-medium py-3">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span>{group.name}</span>
                              <span className="text-xs text-gray-500">
                                {group.tests.length} {group.tests.length === 1 ? 'test' : 'tests'}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3 pt-2">
                              {group.tests.map((test, testIndex) => (
                                <div
                                  key={testIndex}
                                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <h5 className="text-sm font-semibold text-gray-800">
                                      {test.name}
                                    </h5>
                                    {matchingTestFile && matchingTestFile.passed && (
                                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 ml-2" />
                                    )}
                                  </div>
                                  <div className="space-y-1 text-xs text-gray-600">
                                    {test.scenario && (
                                      <div>
                                        <span className="font-medium">Scenario:</span>{' '}
                                        <span>{test.scenario}</span>
                                      </div>
                                    )}
                                    {test.expected && (
                                      <div>
                                        <span className="font-medium">Expected:</span>{' '}
                                        <span>{test.expected}</span>
                                      </div>
                                    )}
                                    {test.whyItMatters && (
                                      <div>
                                        <span className="font-medium">Why it matters:</span>{' '}
                                        <span>{test.whyItMatters}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          )}

          {/* Show message when no tests have been run yet */}
          {testResult.status === 'idle' && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Click "Run All Tests" above to execute tests and see results.
                </p>
                <Button
                  onClick={runTests}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2 mx-auto"
                >
                  <Play className="h-4 w-4" />
                  Run Tests
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Test Results for AI Tests */}
        {testResult.testFiles && testResult.testFiles.length > 0 && (
          <div className="mt-6">
            <Card>
              <CardHeader>
                  <CardTitle className="text-sm">AI Test Suite Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {testResult.testFiles.map((testFile, index) => {
                    const fileName = testFile.file.split('/').pop() || testFile.file;
                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border text-xs ${
                          testFile.passed
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {testFile.passed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-medium">{fileName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-600">
                            <span>{testFile.tests} {testFile.tests === 1 ? 'test' : 'tests'}</span>
                            <span>•</span>
                            <span>{testFile.duration}ms</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">Total:</span>
                    <div className="flex items-center gap-4">
                      <span className="text-green-600">
                        ✓ {testResult.passed} passed
                      </span>
                      {testResult.failed > 0 && (
                        <span className="text-red-600">
                          ✗ {testResult.failed} failed
                        </span>
                      )}
                      <span className="text-gray-600">
                        {testResult.total} total
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </TabsContent>
      </Tabs>

      {/* Vineyard Modal */}
      {showVineyardModal && selectedVineyard && (
        <VineyardModal
          isOpen={showVineyardModal}
          onClose={() => {
            setShowVineyardModal(false);
            setSelectedVineyard(null);
          }}
          vineyard={selectedVineyard}
        />
      )}
    </div>
  );
};

export default TestViewer;
