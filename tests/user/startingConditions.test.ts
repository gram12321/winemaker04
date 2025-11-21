import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { companyService } from '@/lib/services/user/companyService';
import { applyStartingConditions, generateVineyardPreview } from '@/lib/services/core/startingConditionsService';
import { setActiveCompany, resetGameState } from '@/lib/services/core/gameState';
import { initializeTeamsSystem } from '@/lib/services/user/teamService';
import { initializeStaffSystem } from '@/lib/services/user/staffService';
import { STARTING_CONDITIONS, type StartingCountry } from '@/lib/constants/startingConditions';
import { deleteCompany } from '@/lib/database/core/companiesDB';
import { loadStaffFromDb } from '@/lib/database/core/staffDB';
import { loadLoans } from '@/lib/database/core/loansDB';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';
import { listPrestigeEventsForUI } from '@/lib/database/customers/prestigeEventsDB';
import { getCompanyById } from '@/lib/database/core/companiesDB';
import type { Staff } from '@/lib/types/types';
import { GAME_INITIALIZATION } from '@/lib/constants/constants';

/**
 * Human Automation Test: Starting Conditions - Country-Specific Setup
 * 
 * This test validates that each starting condition (France, Italy, Germany, Spain, United States)
 * correctly applies country-specific starting conditions including staff, money, loans, vineyards,
 * and prestige. This automates the manual testing process where developers create companies with
 * different starting conditions and verify all setup is correct.
 * 
 * Manual testing equivalent: Creating a company with each starting condition through the UI,
 * then checking that staff, money, loans, vineyards, and prestige match the configuration.
 */

describe('Starting Conditions - Country-Specific Setup', () => {
  // Track created entities for cleanup
  const createdCompanyIds: string[] = [];

  beforeEach(async () => {
    // Clear tracking arrays before each test
    createdCompanyIds.length = 0;
    // Reset game state
    resetGameState();
  });

  afterEach(async () => {
    // Cleanup: Delete all created companies (this will cascade delete staff, loans, vineyards, etc.)
    for (const companyId of createdCompanyIds) {
      try {
        await deleteCompany(companyId);
      } catch (error) {
        console.error(`Failed to cleanup company ${companyId}:`, error);
      }
    }
    createdCompanyIds.length = 0;
    resetGameState();
  });

  // Test each starting country
  const startingCountries: StartingCountry[] = ['France', 'Italy', 'Germany', 'Spain', 'United States'];

  startingCountries.forEach((country) => {
    describe(`${country} Starting Conditions`, () => {
      it(`creates company with ${country} starting conditions and applies all setup correctly`, async () => {
        const condition = STARTING_CONDITIONS[country];
        expect(condition).toBeDefined();
        
        const testCompanyName = `Test${country}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // 1. Create company
        const companyResult = await companyService.createCompany({
          name: testCompanyName,
          associateWithUser: false
        });

        expect(companyResult.success).toBe(true);
        expect(companyResult.company).toBeDefined();
        const company = companyResult.company!;
        createdCompanyIds.push(company.id);

        // 2. Initialize systems required for starting conditions
        await setActiveCompany(company);
        await initializeTeamsSystem();
        await initializeStaffSystem();

        // 3. Generate vineyard preview
        const vineyardPreview = generateVineyardPreview(condition);

        // 4. Apply starting conditions
        const conditionsResult = await applyStartingConditions(
          company.id,
          country,
          vineyardPreview
        );

        expect(conditionsResult.success).toBe(true);
        expect(conditionsResult.error).toBeUndefined();

        // 5. Refresh company data to get updated money (after loan)
        const updatedCompany = await getCompanyById(company.id);
        expect(updatedCompany).not.toBeNull();

        // 6. Verify Starting Money
        if (updatedCompany) {
          // Money should match starting money (loans use skipTransactions: true, so money isn't automatically added)
          const expectedBaseMoney = condition.startingMoney;
          // Allow small variance for transaction processing
          expect(Math.abs(updatedCompany.money - expectedBaseMoney)).toBeLessThan(1);
        }

        // 7. Verify Staff
        await initializeStaffSystem(); // Refresh staff after creation
        const staff = await loadStaffFromDb();
        expect(staff.length).toBe(condition.staff.length);

        // Verify each staff member matches configuration
        condition.staff.forEach((expectedStaff) => {
          const foundStaff = staff.find(
            (s) => s.name === `${expectedStaff.firstName} ${expectedStaff.lastName}`
          );
          expect(foundStaff).toBeDefined();
          
          if (foundStaff) {
            expect(foundStaff.nationality).toBe(expectedStaff.nationality);
            // Skill level should be approximately correct (within 0.1 tolerance due to randomization)
            expect(Math.abs(foundStaff.skillLevel - expectedStaff.skillLevel)).toBeLessThan(0.15);
            // Verify specializations match
            expectedStaff.specializations.forEach((spec) => {
              expect(foundStaff.specializations).toContain(spec);
            });
          }
        });

        // 8. Verify Starting Loan (if applicable)
        if (condition.startingLoan) {
          const loans = await loadLoans();
          expect(loans.length).toBeGreaterThan(0);
          
          // Find the starting loan by principal amount
          const startingLoan = loans.find(
            (loan) => Math.abs(loan.principalAmount - condition.startingLoan!.principal) < 100
          );
          
          expect(startingLoan).toBeDefined();
          if (startingLoan) {
            expect(startingLoan.lenderType).toBe(condition.startingLoan.lenderType);
            expect(Math.abs(startingLoan.principalAmount - condition.startingLoan.principal)).toBeLessThan(100);
            expect(startingLoan.totalSeasons).toBe(condition.startingLoan.durationSeasons);
            if (condition.startingLoan.interestRate) {
              // Interest rate should be approximately correct (within 0.01 tolerance)
              expect(Math.abs(startingLoan.effectiveInterestRate - condition.startingLoan.interestRate)).toBeLessThan(0.01);
            }
          }
        } else {
          // No starting loan should exist
          const loans = await loadLoans();
          // Allow for lenders being initialized, but should not have starting loan principal
          if (loans.length > 0) {
            const hasStartingLoan = loans.some(
              (loan) => loan.principalAmount > 10000 // Starting loans are large
            );
            expect(hasStartingLoan).toBe(false);
          }
        }

        // 9. Verify Starting Vineyard
        const vineyards = await loadVineyards();
        expect(vineyards.length).toBe(1); // Should have exactly one starting vineyard
        
        const vineyard = vineyards[0];
        expect(vineyard.country).toBe(condition.startingVineyard.country);
        expect(vineyard.region).toBe(condition.startingVineyard.region);
        
        // Verify hectares are within expected range
        expect(vineyard.hectares).toBeGreaterThanOrEqual(condition.startingVineyard.minHectares);
        expect(vineyard.hectares).toBeLessThanOrEqual(condition.startingVineyard.maxHectares + 0.01); // Allow small rounding
        
        // Verify altitude is within expected range (if specified)
        if (condition.startingVineyard.minAltitude !== undefined && condition.startingVineyard.maxAltitude !== undefined) {
          expect(vineyard.altitude).toBeGreaterThanOrEqual(condition.startingVineyard.minAltitude - 10); // Allow small variance
          expect(vineyard.altitude).toBeLessThanOrEqual(condition.startingVineyard.maxAltitude + 10);
        }
        
        // Verify aspect matches preferred aspects (if specified)
        if (condition.startingVineyard.preferredAspects && condition.startingVineyard.preferredAspects.length > 0) {
          expect(condition.startingVineyard.preferredAspects).toContain(vineyard.aspect);
        }
        
        // Starting vineyard should be barren (not planted)
        expect(vineyard.status).toBe('Barren');
        expect(vineyard.density).toBe(0);
        expect(vineyard.grape).toBeNull();

        // 10. Verify Starting Prestige (if applicable)
        if (condition.startingPrestige) {
          const prestigeEvents = await listPrestigeEventsForUI();
          const startingPrestigeEvent = prestigeEvents.find(
            (event) => 
              event.type === condition.startingPrestige!.type || 
              event.type === 'company_story'
          );
          
          expect(startingPrestigeEvent).toBeDefined();
          if (startingPrestigeEvent) {
            expect(startingPrestigeEvent.amount).toBe(condition.startingPrestige.amount);
            if (condition.startingPrestige.decayRate) {
              expect(startingPrestigeEvent.decayRate).toBe(condition.startingPrestige.decayRate);
            }
          }
        }
      });

      it(`verifies ${country} starting condition configuration values`, () => {
        const condition = STARTING_CONDITIONS[country];
        
        // Verify configuration structure
        expect(condition.id).toBe(country);
        expect(condition.name).toBeDefined();
        expect(condition.startingMoney).toBeGreaterThan(0);
        expect(condition.staff.length).toBeGreaterThan(0);
        expect(condition.startingVineyard.country).toBe(country);
        expect(condition.startingVineyard.region).toBeDefined();
        expect(condition.startingVineyard.minHectares).toBeGreaterThan(0);
        expect(condition.startingVineyard.maxHectares).toBeGreaterThanOrEqual(condition.startingVineyard.minHectares);

        // Verify staff configuration
        condition.staff.forEach((staff) => {
          expect(staff.firstName).toBeDefined();
          expect(staff.lastName).toBeDefined();
          expect(staff.nationality).toBe(country);
          expect(staff.skillLevel).toBeGreaterThan(0);
          expect(staff.skillLevel).toBeLessThanOrEqual(1);
          expect(Array.isArray(staff.specializations)).toBe(true);
        });

        // Verify vineyard configuration
        if (condition.startingVineyard.minAltitude !== undefined && condition.startingVineyard.maxAltitude !== undefined) {
          expect(condition.startingVineyard.maxAltitude).toBeGreaterThanOrEqual(condition.startingVineyard.minAltitude);
        }
      });
    });
  });

  describe('Starting Conditions Comparison', () => {
    it('verifies that each country has unique starting conditions', () => {
      const countries = Object.keys(STARTING_CONDITIONS) as StartingCountry[];
      const startingMoneys = countries.map(country => STARTING_CONDITIONS[country].startingMoney);
      const staffCounts = countries.map(country => STARTING_CONDITIONS[country].staff.length);
      
      // Not all countries should have the same starting money (they should differ)
      const uniqueMoneys = new Set(startingMoneys);
      // At least some variation in starting money (not all identical)
      expect(uniqueMoneys.size).toBeGreaterThan(1);
      
      // Not all countries should have the same number of staff
      const uniqueStaffCounts = new Set(staffCounts);
      // At least some variation in staff counts
      expect(uniqueStaffCounts.size).toBeGreaterThan(1);
    });

    it('verifies that countries with loans have reasonable loan amounts', () => {
      const countriesWithLoans = (Object.keys(STARTING_CONDITIONS) as StartingCountry[]).filter(
        country => STARTING_CONDITIONS[country].startingLoan
      );

      countriesWithLoans.forEach((country) => {
        const condition = STARTING_CONDITIONS[country];
        const loan = condition.startingLoan!;
        
        expect(loan.principal).toBeGreaterThan(0);
        expect(loan.durationSeasons).toBeGreaterThan(0);
        expect(loan.lenderType).toBeDefined();
        if (loan.interestRate) {
          expect(loan.interestRate).toBeGreaterThan(0);
          expect(loan.interestRate).toBeLessThan(1); // Should be a rate, not percentage
        }
      });
    });

    it('verifies that countries with prestige have reasonable prestige amounts', () => {
      const countriesWithPrestige = (Object.keys(STARTING_CONDITIONS) as StartingCountry[]).filter(
        country => STARTING_CONDITIONS[country].startingPrestige
      );

      countriesWithPrestige.forEach((country) => {
        const condition = STARTING_CONDITIONS[country];
        const prestige = condition.startingPrestige!;
        
        expect(prestige.amount).toBeGreaterThan(0);
        expect(prestige.amount).toBeLessThan(100); // Reasonable prestige amount
        if (prestige.decayRate) {
          expect(prestige.decayRate).toBeGreaterThan(0);
          expect(prestige.decayRate).toBeLessThanOrEqual(1);
        }
      });
    });
  });
});

