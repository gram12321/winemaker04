import type { LoanLenderFeature } from './featureTypes';
import { noLoanLenderFeature } from './noop';

let loanLenderFeature: LoanLenderFeature = noLoanLenderFeature;

export function configureLoanLenderFeature(feature: LoanLenderFeature): void {
  loanLenderFeature = feature;
}

export function getLoanLenderFeature(): LoanLenderFeature {
  return loanLenderFeature;
}
