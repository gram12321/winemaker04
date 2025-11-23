import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { companyService } from '@/lib/services/user/companyService';
import { applyStartingConditions, generateVineyardPreview } from '@/lib/services/core/startingConditionsService';
import { setActiveCompany, resetGameState, getGameState, updateGameState, getCurrentCompany } from '@/lib/services/core/gameState';
import { initializeTeamsSystem } from '@/lib/services/user/teamService';
import { initializeStaffSystem } from '@/lib/services/user/staffService';
import { STARTING_CONDITIONS, type StartingCountry } from '@/lib/constants/startingConditions';
import { deleteCompany } from '@/lib/database/core/companiesDB';
import { loadStaffFromDb } from '@/lib/database/core/staffDB';
import { getActivityById } from '@/lib/services/activity/activitymanagers/activityManager';
import { startStaffSearch, completeStaffSearch, startHiringProcess, completeHiringProcess, type StaffSearchOptions } from '@/lib/services/activity/activitymanagers/staffSearchManager';
import { updateActivityInDb, removeActivityFromDb } from '@/lib/database/activities/activityDB';
import { loadTransactions } from '@/lib/database/core/transactionsDB';
import type { Staff } from '@/lib/types/types';
import { WorkCategory } from '@/lib/types/types';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';

/**
 * Human Automation Test: Hire Staff Workflow - Complete Staff Search and Hiring Process
 * 
 * This test validates the complete staff hiring workflow from search to hire:
 * 1. Start a staff search with options (number of candidates, skill level, specializations)
 * 2. Complete the search activity and verify candidates are generated
 * 3. Start hiring process for a candidate
 * 4. Complete the hiring activity and verify staff is added to database
 * 5. Verify transactions are recorded correctly
 * 
 * Manual testing equivalent: 
 * - Open Staff page
 * - Click "Search Staff" 
 * - Configure search options (5 candidates, skill level 0.3, no specializations)
 * - Wait for search to complete (watch activity panel)
 * - View search results modal
 * - Hire a candidate from results
 * - Wait for hiring activity to complete
 * - Verify new staff appears in staff list
 * - Check transactions to verify costs
 * 
 * Most common error: Data not being successfully written to database (staff, transactions, activities)
 */

describe('Hire Staff Workflow - Complete Staff Search and Hiring Process', () => {
  // Track created entities for cleanup
  const createdCompanyIds: string[] = [];
  const createdActivityIds: string[] = [];

  beforeEach(async () => {
    // Clear tracking arrays before each test
    createdCompanyIds.length = 0;
    createdActivityIds.length = 0;
    // Reset game state
    resetGameState();
  });

  afterEach(async () => {
    // Cleanup: Delete all created companies (this will cascade delete staff, activities, transactions, etc.)
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

  /**
   * Helper function to ensure company is set as active (needed for operations that use getCurrentCompanyId)
   */
  async function ensureCompanyActive(companyId: string): Promise<void> {
    const company = await companyService.getCompany(companyId);
    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }
    // Force set active company even if already active (to refresh game state)
    const currentCompany = getCurrentCompany();
    if (!currentCompany || currentCompany.id !== companyId) {
      await setActiveCompany(company);
    } else {
      // Company is already active, but ensure game state is synced
      await updateGameState({ money: company.money });
    }
  }

  /**
   * Helper function to manually complete an activity for testing
   * Sets completedWork = totalWork, then calls completion handler and removes activity
   */
  async function completeActivityManually(activityId: string, companyId?: string): Promise<void> {
    // Ensure company is active before operations that require it
    if (companyId) {
      await ensureCompanyActive(companyId);
    }

    const activity = await getActivityById(activityId);
    if (!activity) {
      throw new Error(`Activity ${activityId} not found`);
    }

    // Mark activity as complete
    await updateActivityInDb(activityId, {
      completedWork: activity.totalWork
    });

    // Get updated activity
    const updatedActivity = await getActivityById(activityId);
    if (!updatedActivity) {
      throw new Error(`Failed to update activity ${activityId}`);
    }

    // Ensure company is active before calling completion handlers (they use getCurrentCompanyId)
    if (companyId) {
      await ensureCompanyActive(companyId);
    }

    // Call appropriate completion handler based on category
    if (updatedActivity.category === WorkCategory.STAFF_SEARCH) {
      await completeStaffSearch(updatedActivity);
    } else if (updatedActivity.category === WorkCategory.STAFF_HIRING) {
      await completeHiringProcess(updatedActivity);
    } else {
      throw new Error(`No completion handler for category ${updatedActivity.category}`);
    }

    // Remove the completed activity (same as progressActivities does)
    // Ensure company is active before removing (removeActivityFromDb uses getCurrentCompanyId)
    if (companyId) {
      await ensureCompanyActive(companyId);
    }
    await removeActivityFromDb(activityId);
  }

  describe('Complete Staff Search Workflow', () => {
    it('creates company, starts staff search, completes search, and generates candidates', async () => {
      // 1. Create company with France starting conditions (to get initial staff for completing activities)
      const testCompanyName = `TestHireStaff_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const country: StartingCountry = 'France';
      const condition = STARTING_CONDITIONS[country];

      const companyResult = await companyService.createCompany({
        name: testCompanyName,
        associateWithUser: false
      });

      expect(companyResult.success).toBe(true);
      const company = companyResult.company!;
      createdCompanyIds.push(company.id);

      // Initialize systems
      await setActiveCompany(company);
      await initializeTeamsSystem();
      await initializeStaffSystem();

      // Apply starting conditions to get initial staff
      const vineyardPreview = generateVineyardPreview(condition);
      const conditionsResult = await applyStartingConditions(
        company.id,
        country,
        vineyardPreview
      );
      expect(conditionsResult.success).toBe(true);

      // Refresh staff system
      await initializeStaffSystem();

      // Give company enough money for search
      const searchOptions: StaffSearchOptions = {
        numberOfCandidates: 5,
        skillLevel: 0.3,
        specializations: []
      };

      // Calculate search cost
      const { calculateStaffSearchCost } = await import('@/lib/services/activity/workcalculators/staffSearchWorkCalculator');
      const searchCost = calculateStaffSearchCost(searchOptions);
      
      // Get current money after starting conditions
      const companyBeforeSearch = await companyService.getCompany(company.id);
      expect(companyBeforeSearch).not.toBeNull();
      const moneyBeforeSearch = companyBeforeSearch?.money || 0;
      
      // Add money if needed (should have enough from France starting conditions, but ensure we have it)
      const targetMoney = searchCost + 20000; // Add extra for hiring costs
      if (moneyBeforeSearch < targetMoney) {
        await companyService.updateCompany(company.id, {
          money: targetMoney
        });
        
        // Update game state directly to ensure it's synced (setActiveCompany won't update if company is already active)
        await updateGameState({ money: targetMoney });
      } else {
        // Even if we have enough, ensure game state is synced with current money
        await updateGameState({ money: moneyBeforeSearch });
      }

      // Get the actual money we have now (after potential update)
      const companyWithMoney = await companyService.getCompany(company.id);
      const moneyAfterUpdate = companyWithMoney?.money || 0;
      await updateGameState({ money: moneyAfterUpdate });

      // 2. Start staff search
      const searchActivityId = await startStaffSearch(searchOptions);
      expect(searchActivityId).not.toBeNull();
      expect(searchActivityId).toBeTruthy();
      
      if (searchActivityId) {
        createdActivityIds.push(searchActivityId);

        // Verify search activity was created
        const searchActivity = await getActivityById(searchActivityId);
        expect(searchActivity).not.toBeNull();
        expect(searchActivity?.category).toBe(WorkCategory.STAFF_SEARCH);
        expect(searchActivity?.title).toBe('Search Staff');
        expect(searchActivity?.status).toBe('active');
        expect(searchActivity?.completedWork).toBe(0);
        expect(searchActivity?.totalWork).toBeGreaterThan(0);

        // Verify money was deducted for search cost
        const companyAfterSearch = await companyService.getCompany(company.id);
        expect(companyAfterSearch).not.toBeNull();
        if (companyAfterSearch) {
          // Money should be reduced by search cost (allow small variance for transaction processing)
          expect(companyAfterSearch.money).toBeLessThanOrEqual(moneyAfterUpdate);
          expect(Math.abs((moneyAfterUpdate - companyAfterSearch.money) - searchCost)).toBeLessThan(1);
        }

        // Verify transaction was recorded
        const transactions = await loadTransactions();
        const searchTransaction = transactions.find(
          t => t.description?.includes('Staff search') && 
               Math.abs(t.amount + searchCost) < 1 // Negative amount
        );
        expect(searchTransaction).toBeDefined();
        expect(searchTransaction?.category).toBe(TRANSACTION_CATEGORIES.STAFF_SEARCH);

        // 3. Manually complete the search activity (simulating time passing and work completion)
        await completeActivityManually(searchActivityId, company.id);

        // 4. Verify candidates were generated and stored in game state
        const gameState = getGameState();
        expect(gameState.pendingStaffCandidates).toBeDefined();
        expect(gameState.pendingStaffCandidates?.candidates).toBeDefined();
        expect(gameState.pendingStaffCandidates?.candidates.length).toBe(searchOptions.numberOfCandidates);
        expect(gameState.pendingStaffCandidates?.activityId).toBe(searchActivityId);

        const candidates = gameState.pendingStaffCandidates!.candidates;
        
        // Verify each candidate matches search criteria
        candidates.forEach((candidate) => {
          expect(candidate.id).toBeDefined();
          expect(candidate.name).toBeDefined();
          expect(candidate.nationality).toBeDefined();
          // Skill level should be approximately within expected range (0.3 * 0.4 = 0.12 to 0.3 * 0.4 + 0.6 = 0.72)
          // But candidates are generated with the exact skillLevel parameter, with random variation
          expect(candidate.skillLevel).toBeGreaterThanOrEqual(0);
          expect(candidate.skillLevel).toBeLessThanOrEqual(1);
          expect(candidate.wage).toBeGreaterThan(0);
          expect(candidate.specializations).toEqual(searchOptions.specializations);
        });

        // Verify activity is removed after completion
        const completedActivity = await getActivityById(searchActivityId);
        expect(completedActivity).toBeNull(); // Activity should be removed after completion
      }
    });

    it('generates candidates with correct skill levels and specializations', async () => {
      // Create company with starting conditions
      const testCompanyName = `TestHireStaff_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const country: StartingCountry = 'France';
      const condition = STARTING_CONDITIONS[country];

      const companyResult = await companyService.createCompany({
        name: testCompanyName,
        associateWithUser: false
      });

      expect(companyResult.success).toBe(true);
      const company = companyResult.company!;
      createdCompanyIds.push(company.id);

      await setActiveCompany(company);
      await initializeTeamsSystem();
      await initializeStaffSystem();

      const vineyardPreview = generateVineyardPreview(condition);
      await applyStartingConditions(company.id, country, vineyardPreview);
      await initializeStaffSystem();

      // Test with different search options
      const searchOptions: StaffSearchOptions = {
        numberOfCandidates: 3,
        skillLevel: 0.5,
        specializations: ['winery', 'administration']
      };

      // Add money
      const { calculateStaffSearchCost } = await import('@/lib/services/activity/workcalculators/staffSearchWorkCalculator');
      const searchCost = calculateStaffSearchCost(searchOptions);
      const targetMoney2 = searchCost + 20000;
      await companyService.updateCompany(company.id, {
        money: targetMoney2
      });
      await updateGameState({ money: targetMoney2 });

      // Start and complete search
      const searchActivityId = await startStaffSearch(searchOptions);
      expect(searchActivityId).not.toBeNull();
      
      if (searchActivityId) {
        createdActivityIds.push(searchActivityId);
        await completeActivityManually(searchActivityId, company.id);

        // Verify candidates
        const gameState = getGameState();
        const candidates = gameState.pendingStaffCandidates?.candidates || [];
        
        expect(candidates.length).toBe(3);
        
        candidates.forEach((candidate) => {
          // Verify specializations match
          expect(candidate.specializations).toContain('winery');
          expect(candidate.specializations).toContain('administration');
          expect(candidate.specializations.length).toBe(2);
        });
      }
    });
  });

  describe('Complete Hiring Workflow', () => {
    it('hires a candidate from search results and adds them to database', async () => {
      // 1. Create company with starting conditions
      const testCompanyName = `TestHireStaff_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const country: StartingCountry = 'France';
      const condition = STARTING_CONDITIONS[country];

      const companyResult = await companyService.createCompany({
        name: testCompanyName,
        associateWithUser: false
      });

      expect(companyResult.success).toBe(true);
      const company = companyResult.company!;
      createdCompanyIds.push(company.id);

      await setActiveCompany(company);
      await initializeTeamsSystem();
      await initializeStaffSystem();

      const vineyardPreview = generateVineyardPreview(condition);
      await applyStartingConditions(company.id, country, vineyardPreview);
      await initializeStaffSystem();

      // Get initial staff count
      const initialStaff = await loadStaffFromDb();
      const initialStaffCount = initialStaff.length;

      // 2. Start and complete staff search
      const searchOptions: StaffSearchOptions = {
        numberOfCandidates: 5,
        skillLevel: 0.3,
        specializations: []
      };

      const { calculateStaffSearchCost } = await import('@/lib/services/activity/workcalculators/staffSearchWorkCalculator');
      const searchCost = calculateStaffSearchCost(searchOptions);
      const targetMoney3 = searchCost + 50000; // Enough for search + hiring multiple candidates
      await companyService.updateCompany(company.id, {
        money: targetMoney3
      });
      await updateGameState({ money: targetMoney3 });

      const searchActivityId = await startStaffSearch(searchOptions);
      expect(searchActivityId).not.toBeNull();
      
      if (!searchActivityId) {
        throw new Error('Failed to create search activity');
      }

      createdActivityIds.push(searchActivityId);
      await completeActivityManually(searchActivityId, company.id);

      // 3. Get candidates from game state
      const gameState = getGameState();
      const candidates = gameState.pendingStaffCandidates?.candidates || [];
      expect(candidates.length).toBe(5);

      // Select first candidate for hiring
      const candidateToHire = candidates[0];
      expect(candidateToHire).toBeDefined();
      expect(candidateToHire.name).toBeDefined();
      expect(candidateToHire.wage).toBeGreaterThan(0);

      // Get company money before hiring
      const companyBeforeHire = await companyService.getCompany(company.id);
      expect(companyBeforeHire).not.toBeNull();
      const moneyBeforeHire = companyBeforeHire?.money || 0;

      // 4. Start hiring process
      const hiringActivityId = await startHiringProcess(candidateToHire);
      expect(hiringActivityId).not.toBeNull();
      expect(hiringActivityId).toBeTruthy();

      if (!hiringActivityId) {
        throw new Error('Failed to create hiring activity');
      }

      createdActivityIds.push(hiringActivityId);

      // Verify hiring activity was created
      const hiringActivity = await getActivityById(hiringActivityId);
      expect(hiringActivity).not.toBeNull();
      expect(hiringActivity?.category).toBe(WorkCategory.STAFF_HIRING);
      expect(hiringActivity?.title).toContain(candidateToHire.name);
      expect(hiringActivity?.status).toBe('active');
      expect(hiringActivity?.totalWork).toBeGreaterThan(0);

      // Verify candidate data is stored in activity
      const candidateData = hiringActivity?.params.candidateData as Staff;
      expect(candidateData).toBeDefined();
      expect(candidateData.name).toBe(candidateToHire.name);
      expect(candidateData.id).toBe(candidateToHire.id);

      // 5. Manually complete the hiring activity
      await completeActivityManually(hiringActivityId, company.id);

      // 6. Verify staff was added to database
      await ensureCompanyActive(company.id); // Ensure company is active before loading staff
      await initializeStaffSystem(); // Refresh staff
      const staffAfterHire = await loadStaffFromDb();
      expect(staffAfterHire.length).toBe(initialStaffCount + 1);

      // Find the newly hired staff member
      const hiredStaff = staffAfterHire.find(s => s.id === candidateToHire.id);
      expect(hiredStaff).toBeDefined();
      
      if (hiredStaff) {
        expect(hiredStaff.name).toBe(candidateToHire.name);
        expect(hiredStaff.nationality).toBe(candidateToHire.nationality);
        expect(hiredStaff.wage).toBe(candidateToHire.wage);
        expect(hiredStaff.specializations).toEqual(candidateToHire.specializations);
        // Verify hire date is set
        expect(hiredStaff.hireDate).toBeDefined();
        expect(hiredStaff.hireDate.week).toBeGreaterThan(0);
        expect(hiredStaff.hireDate.season).toBeDefined();
        expect(hiredStaff.hireDate.year).toBeGreaterThan(0);
      }

      // 7. Verify transaction was recorded for first month's wage
      const transactions = await loadTransactions();
      const hiringTransaction = transactions.find(
        t => t.description?.includes(candidateToHire.name) &&
             t.description?.includes('First month')
      );
      expect(hiringTransaction).toBeDefined();
      if (hiringTransaction) {
        expect(Math.abs(hiringTransaction.amount + candidateToHire.wage)).toBeLessThan(1); // Negative amount
        expect(hiringTransaction.category).toBe(TRANSACTION_CATEGORIES.STAFF_WAGES);
      }

      // Verify money was deducted
      const companyAfterHire = await companyService.getCompany(company.id);
      expect(companyAfterHire).not.toBeNull();
      if (companyAfterHire) {
        // Money should be reduced by candidate's wage (allow small variance)
        expect(companyAfterHire.money).toBeLessThan(moneyBeforeHire);
        expect(Math.abs((moneyBeforeHire - companyAfterHire.money) - candidateToHire.wage)).toBeLessThan(1);
      }

      // Verify hiring activity is removed after completion
      const completedHiringActivity = await getActivityById(hiringActivityId);
      expect(completedHiringActivity).toBeNull();
    });

    it('can hire multiple candidates from the same search', async () => {
      // Create company with starting conditions
      const testCompanyName = `TestHireStaff_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const country: StartingCountry = 'France';
      const condition = STARTING_CONDITIONS[country];

      const companyResult = await companyService.createCompany({
        name: testCompanyName,
        associateWithUser: false
      });

      expect(companyResult.success).toBe(true);
      const company = companyResult.company!;
      createdCompanyIds.push(company.id);

      await setActiveCompany(company);
      await initializeTeamsSystem();
      await initializeStaffSystem();

      const vineyardPreview = generateVineyardPreview(condition);
      await applyStartingConditions(company.id, country, vineyardPreview);
      await initializeStaffSystem();

      const initialStaff = await loadStaffFromDb();
      const initialStaffCount = initialStaff.length;

      // Start and complete search
      const searchOptions: StaffSearchOptions = {
        numberOfCandidates: 3,
        skillLevel: 0.3,
        specializations: []
      };

      const { calculateStaffSearchCost } = await import('@/lib/services/activity/workcalculators/staffSearchWorkCalculator');
      const searchCost = calculateStaffSearchCost(searchOptions);
      const totalWages = 30000; // Estimate for 3 candidates
      const targetMoney4 = searchCost + totalWages;
      await companyService.updateCompany(company.id, {
        money: targetMoney4
      });
      await updateGameState({ money: targetMoney4 });

      const searchActivityId = await startStaffSearch(searchOptions);
      expect(searchActivityId).not.toBeNull();
      
      if (!searchActivityId) {
        throw new Error('Failed to create search activity');
      }

      createdActivityIds.push(searchActivityId);
      await completeActivityManually(searchActivityId, company.id);

      // Get candidates
      const gameState = getGameState();
      const candidates = gameState.pendingStaffCandidates?.candidates || [];
      expect(candidates.length).toBe(3);

      // Hire first candidate
      const candidate1 = candidates[0];
      const hiringActivityId1 = await startHiringProcess(candidate1);
      expect(hiringActivityId1).not.toBeNull();
      
      if (hiringActivityId1) {
        createdActivityIds.push(hiringActivityId1);
        await completeActivityManually(hiringActivityId1, company.id);
      }

      // Refresh staff - ensure company is active
      await ensureCompanyActive(company.id);
      await initializeStaffSystem();
      let staffAfterFirstHire = await loadStaffFromDb();
      expect(staffAfterFirstHire.length).toBe(initialStaffCount + 1);

      // Hire second candidate
      const candidate2 = candidates[1];
      const hiringActivityId2 = await startHiringProcess(candidate2);
      expect(hiringActivityId2).not.toBeNull();
      
      if (hiringActivityId2) {
        createdActivityIds.push(hiringActivityId2);
        await completeActivityManually(hiringActivityId2, company.id);
      }

      // Refresh staff - ensure company is active
      await ensureCompanyActive(company.id);
      await initializeStaffSystem();
      const staffAfterSecondHire = await loadStaffFromDb();
      expect(staffAfterSecondHire.length).toBe(initialStaffCount + 2);

      // Verify both staff members are in database
      const hiredStaff1 = staffAfterSecondHire.find(s => s.id === candidate1.id);
      const hiredStaff2 = staffAfterSecondHire.find(s => s.id === candidate2.id);
      
      expect(hiredStaff1).toBeDefined();
      expect(hiredStaff2).toBeDefined();
      expect(hiredStaff1?.name).toBe(candidate1.name);
      expect(hiredStaff2?.name).toBe(candidate2.name);
    });

    it('prevents hiring when company has insufficient funds', async () => {
      // Create company with starting conditions
      const testCompanyName = `TestHireStaff_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const country: StartingCountry = 'France';
      const condition = STARTING_CONDITIONS[country];

      const companyResult = await companyService.createCompany({
        name: testCompanyName,
        associateWithUser: false
      });

      expect(companyResult.success).toBe(true);
      const company = companyResult.company!;
      createdCompanyIds.push(company.id);

      await setActiveCompany(company);
      await initializeTeamsSystem();
      await initializeStaffSystem();

      const vineyardPreview = generateVineyardPreview(condition);
      await applyStartingConditions(company.id, country, vineyardPreview);
      await initializeStaffSystem();

      // Start and complete search
      const searchOptions: StaffSearchOptions = {
        numberOfCandidates: 3,
        skillLevel: 0.5, // Higher skill = higher wages
        specializations: []
      };

      const { calculateStaffSearchCost } = await import('@/lib/services/activity/workcalculators/staffSearchWorkCalculator');
      const searchCost = calculateStaffSearchCost(searchOptions);
      // Give just enough for search, but not enough for hiring
      const targetMoney5 = searchCost + 1; // Just 1 more than search cost
      await companyService.updateCompany(company.id, {
        money: targetMoney5
      });
      await updateGameState({ money: targetMoney5 });

      const searchActivityId = await startStaffSearch(searchOptions);
      expect(searchActivityId).not.toBeNull();
      
      if (!searchActivityId) {
        throw new Error('Failed to create search activity');
      }

      createdActivityIds.push(searchActivityId);
      await completeActivityManually(searchActivityId, company.id);

      // Get candidates
      const gameState = getGameState();
      const candidates = gameState.pendingStaffCandidates?.candidates || [];
      expect(candidates.length).toBe(3);

      // Try to hire a candidate (should fail due to insufficient funds)
      // Ensure company is active before hiring
      await ensureCompanyActive(company.id);
      const candidate = candidates[0];
      const hiringActivityId = await startHiringProcess(candidate);
      
      // Hiring should fail (return null) if company doesn't have enough money
      // But we need to check the current money after search was paid
      const companyAfterSearch = await companyService.getCompany(company.id);
      expect(companyAfterSearch).not.toBeNull();
      
      if (companyAfterSearch && companyAfterSearch.money < candidate.wage) {
        expect(hiringActivityId).toBeNull(); // Should fail due to insufficient funds
      } else {
        // If somehow we have enough money, hiring should succeed
        expect(hiringActivityId).not.toBeNull();
      }
    });
  });

  describe('Hire Staff via Manual Hire Modal', () => {
    it('manually hires staff using createStaff and addStaff directly', async () => {
      // This tests the HireStaffModal workflow (manual hiring without search)
      const testCompanyName = `TestManualHire_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const country: StartingCountry = 'France';
      const condition = STARTING_CONDITIONS[country];

      const companyResult = await companyService.createCompany({
        name: testCompanyName,
        associateWithUser: false
      });

      expect(companyResult.success).toBe(true);
      const company = companyResult.company!;
      createdCompanyIds.push(company.id);

      await setActiveCompany(company);
      await initializeTeamsSystem();
      await initializeStaffSystem();

      const vineyardPreview = generateVineyardPreview(condition);
      await applyStartingConditions(company.id, country, vineyardPreview);
      await initializeStaffSystem();

      const initialStaff = await loadStaffFromDb();
      const initialStaffCount = initialStaff.length;

      // Manually create and add staff (simulating HireStaffModal workflow)
      const { createStaff, addStaff } = await import('@/lib/services/user/staffService');
      
      const newStaff = createStaff(
        'John',
        'Doe',
        0.4,
        ['field'],
        'United States'
      );

      const addedStaff = await addStaff(newStaff);
      expect(addedStaff).not.toBeNull();
      expect(addedStaff?.id).toBe(newStaff.id);
      expect(addedStaff?.name).toBe('John Doe');

      // Verify staff was added to database
      await ensureCompanyActive(company.id);
      await initializeStaffSystem();
      const staffAfterManualHire = await loadStaffFromDb();
      expect(staffAfterManualHire.length).toBe(initialStaffCount + 1);

      const foundStaff = staffAfterManualHire.find(s => s.id === newStaff.id);
      expect(foundStaff).toBeDefined();
      if (foundStaff) {
        expect(foundStaff.name).toBe('John Doe');
        expect(foundStaff.specializations).toContain('field');
        expect(foundStaff.nationality).toBe('United States');
      }
    });
  });
});

