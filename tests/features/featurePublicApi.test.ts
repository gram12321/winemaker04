import { describe, expect, it } from 'vitest';
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
    expect(researchUpgrade.researchUpgradeFeature.ui.renderResearchPage)
      .toEqual(expect.any(Function));
    expect(researchUpgrade.researchUpgradeFeature).not.toHaveProperty('admin');
    expect(researchUpgrade.researchUpgradeFeature.ui).not.toHaveProperty('renderAdminInspector');
    expect(researchUpgrade.researchUpgradeFeature.effects.getPermanentEffects)
      .toEqual(expect.any(Function));
  });

});
