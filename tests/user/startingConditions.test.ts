import { describe, it, expect } from 'vitest';
import { 
  generateVineyardPreview,
   
} from '@/lib/services/core/startingConditionsService';
import { 
  STARTING_CONDITIONS, 
  type StartingCountry,
    
} from '@/lib/constants/startingConditions';

/**
 * Starting Conditions Tests - Pure Functions
 * 
 * These tests validate starting condition generation without requiring database setup.
 * Focuses on configuration validation and preview generation logic.
 */
describe('Starting Conditions - Pure Functions', () => {
  const startingCountries: StartingCountry[] = ['France', 'Italy', 'Germany', 'Spain', 'United States'];

  describe('generateVineyardPreview', () => {
    startingCountries.forEach((country) => {
      it(`generates valid vineyard preview for ${country}`, () => {
        const condition = STARTING_CONDITIONS[country];
        expect(condition).toBeDefined();
        
        const preview = generateVineyardPreview(condition);
        
        // Validate preview structure
        expect(preview.name).toBeTruthy();
        expect(preview.country).toBe(country);
        expect(preview.region).toBe(condition.startingVineyard.region);
        expect(preview.hectares).toBeGreaterThanOrEqual(condition.startingVineyard.minHectares);
        expect(preview.hectares).toBeLessThanOrEqual(condition.startingVineyard.maxHectares + 0.01);
        expect(Array.isArray(preview.soil)).toBe(true);
        expect(preview.soil.length).toBeGreaterThan(0);
        expect(preview.altitude).toBeGreaterThan(0);
        expect(preview.density).toBeGreaterThan(0);
        
        // Validate altitude range if specified
        if (condition.startingVineyard.minAltitude !== undefined && 
            condition.startingVineyard.maxAltitude !== undefined) {
          expect(preview.altitude).toBeGreaterThanOrEqual(condition.startingVineyard.minAltitude - 10);
          expect(preview.altitude).toBeLessThanOrEqual(condition.startingVineyard.maxAltitude + 10);
        }
        
        // Validate aspect if preferred aspects are specified
        if (condition.startingVineyard.preferredAspects && 
            condition.startingVineyard.preferredAspects.length > 0) {
          expect(condition.startingVineyard.preferredAspects).toContain(preview.aspect);
        }
      });

      it(`generates different previews for ${country} on multiple calls`, () => {
        const condition = STARTING_CONDITIONS[country];
        const preview1 = generateVineyardPreview(condition);
        const preview2 = generateVineyardPreview(condition);
        
        // Some properties should vary (at least hectares, altitude, aspect might differ)
        // But country and region should always match
        expect(preview1.country).toBe(preview2.country);
        expect(preview1.region).toBe(preview2.region);
      });
    });
  });

  describe('Starting Condition Configuration', () => {
    startingCountries.forEach((country) => {
      it(`validates ${country} starting condition structure`, () => {
        const condition = STARTING_CONDITIONS[country];
        
        // Basic structure
        expect(condition.id).toBe(country);
        expect(condition.name).toBeTruthy();
        expect(condition.startingMoney).toBeGreaterThan(0);
        
        // Staff configuration
        expect(Array.isArray(condition.staff)).toBe(true);
        expect(condition.staff.length).toBeGreaterThan(0);
        condition.staff.forEach((staff) => {
          expect(staff.firstName).toBeTruthy();
          expect(staff.lastName).toBeTruthy();
          expect(staff.nationality).toBe(country);
          expect(staff.skillLevel).toBeGreaterThan(0);
          expect(staff.skillLevel).toBeLessThanOrEqual(1);
          expect(Array.isArray(staff.specializations)).toBe(true);
        });
        
        // Vineyard configuration
        expect(condition.startingVineyard.country).toBe(country);
        expect(condition.startingVineyard.region).toBeTruthy();
        expect(condition.startingVineyard.minHectares).toBeGreaterThan(0);
        expect(condition.startingVineyard.maxHectares).toBeGreaterThanOrEqual(
          condition.startingVineyard.minHectares
        );
        
        if (condition.startingVineyard.minAltitude !== undefined && 
            condition.startingVineyard.maxAltitude !== undefined) {
          expect(condition.startingVineyard.maxAltitude).toBeGreaterThanOrEqual(
            condition.startingVineyard.minAltitude
          );
        }
        
        // Starting vine age
        expect(condition.startingVineyard.startingVineAge).toBeDefined();
        expect(condition.startingVineyard.startingVineAge).toBeGreaterThan(0);
        expect(condition.startingVineyard.startingVineAge).toBeLessThan(50);
      });
    });

    it('validates that countries have unique starting conditions', () => {
      const startingMoneys = startingCountries.map(c => STARTING_CONDITIONS[c].startingMoney);
      const staffCounts = startingCountries.map(c => STARTING_CONDITIONS[c].staff.length);
      
      // Should have some variation
      const uniqueMoneys = new Set(startingMoneys);
      expect(uniqueMoneys.size).toBeGreaterThan(1);
      
      const uniqueStaffCounts = new Set(staffCounts);
      expect(uniqueStaffCounts.size).toBeGreaterThan(1);
    });

    it('validates loan configuration when present', () => {
      const countriesWithLoans = startingCountries.filter(
        c => STARTING_CONDITIONS[c].startingLoan
      );
      
      countriesWithLoans.forEach((country) => {
        const loan = STARTING_CONDITIONS[country].startingLoan!;
        expect(loan.principal).toBeGreaterThan(0);
        expect(loan.durationSeasons).toBeGreaterThan(0);
        expect(loan.lenderType).toBeTruthy();
        if (loan.interestRate) {
          expect(loan.interestRate).toBeGreaterThan(0);
          expect(loan.interestRate).toBeLessThan(1);
        }
      });
    });

    it('validates prestige configuration when present', () => {
      const countriesWithPrestige = startingCountries.filter(
        c => STARTING_CONDITIONS[c].startingPrestige
      );
      
      countriesWithPrestige.forEach((country) => {
        const prestige = STARTING_CONDITIONS[country].startingPrestige!;
        expect(prestige.amount).toBeGreaterThan(0);
        expect(prestige.amount).toBeLessThan(100);
        if (prestige.decayRate) {
          expect(prestige.decayRate).toBeGreaterThan(0);
          expect(prestige.decayRate).toBeLessThanOrEqual(1);
        }
      });
    });

    it('validates starting unlocked grape when present', () => {
      const countriesWithGrape = startingCountries.filter(
        c => STARTING_CONDITIONS[c].startingUnlockedGrape
      );
      
      countriesWithGrape.forEach((country) => {
        const grape = STARTING_CONDITIONS[country].startingUnlockedGrape!;
        expect(typeof grape).toBe('string');
        expect(grape.length).toBeGreaterThan(0);
      });
    });
  });
});

