import { describe, expect, it } from 'vitest';
import * as boardShare from '@/lib/features/boardShare';
import * as loanLender from '@/lib/features/loanLender';
import * as researchUpgrade from '@/lib/features/researchUpgrade';

describe('installed feature public facades', () => {
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
    expect(researchUpgrade.researchUpgradeFeature.admin.grantAllResearch)
      .toEqual(expect.any(Function));
    expect(researchUpgrade.researchUpgradeFeature.ui.renderResearchPage)
      .toEqual(expect.any(Function));
    expect(researchUpgrade.researchUpgradeFeature.ui.renderAdminInspector)
      .toEqual(expect.any(Function));
    expect(researchUpgrade.researchUpgradeFeature.effects.getPermanentEffects)
      .toEqual(expect.any(Function));
  });

  it('exports the Board Share baseline feature value and no registry API', () => {
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
