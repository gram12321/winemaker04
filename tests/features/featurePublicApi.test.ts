import { describe, expect, it } from 'vitest';
import * as boardShare from '@/lib/features/boardShare';
import * as achievements from '@/lib/features/achievements';
import * as loanLender from '@/lib/features/loanLender';
import * as researchUpgrade from '@/lib/features/researchUpgrade';

describe('installed feature public facades', () => {
  it('exports the Achievements feature value and no implementation helpers', () => {
    expect(Object.keys(achievements).sort()).toEqual(['achievementsFeature']);
    expect(achievements.achievementsFeature.evaluation.checkAll).toEqual(expect.any(Function));
    expect(achievements.achievementsFeature.progression.getUnlockedIds).toEqual(expect.any(Function));
    expect(achievements.achievementsFeature.views.getWorkspace).toEqual(expect.any(Function));
    expect(achievements.achievementsFeature.ticks.checkAfterWeekAdvance).toEqual(expect.any(Function));
  });

  it('exports the Loan Lender feature value and no registry API', () => {
    expect(Object.keys(loanLender).sort()).toEqual(['loanLenderFeature']);
    expect(loanLender.loanLenderFeature.ui.getFinanceTabs).toEqual(expect.any(Function));
    expect(loanLender.loanLenderFeature.ticks.processSeasonalLoanPayments)
      .toEqual(expect.any(Function));
  });

  it('exports the Research Upgrade feature value and no registry API', () => {
    expect(Object.keys(researchUpgrade).sort()).toEqual(['researchUpgradeFeature']);
    expect(researchUpgrade.researchUpgradeFeature.workflow.startResearch)
      .toEqual(expect.any(Function));
    expect(researchUpgrade.researchUpgradeFeature.unlocks.getUnlockedItems)
      .toEqual(expect.any(Function));
    expect(researchUpgrade.researchUpgradeFeature.setup.grantResearchUnlock)
      .toEqual(expect.any(Function));
    expect(researchUpgrade.researchUpgradeFeature.ui.renderResearchPage)
      .toEqual(expect.any(Function));
    expect(researchUpgrade.researchUpgradeFeature).not.toHaveProperty('admin');
    expect(researchUpgrade.researchUpgradeFeature.ui).not.toHaveProperty('renderAdminInspector');
    expect(researchUpgrade.researchUpgradeFeature.effects.getPermanentEffects)
      .toEqual(expect.any(Function));
  });

  it('exports the inactive Board Share feature value and no registry API', () => {
    expect(Object.keys(boardShare).sort()).toEqual(['boardShareFeature']);
    expect(boardShare.boardShareFeature.constraints.checkVineyardPurchase)
      .toEqual(expect.any(Function));
    expect(boardShare.boardShareFeature.ticks.onWeekAdvanced)
      .toEqual(expect.any(Function));
    expect(boardShare.boardShareFeature.starting.getStartingOwnership)
      .toEqual(expect.any(Function));
    expect(boardShare.boardShareFeature.ui.getFinanceTabs)
      .toEqual(expect.any(Function));
  });

});
