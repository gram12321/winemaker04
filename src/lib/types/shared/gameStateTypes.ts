import type { Season } from './coreTypes';
import type { EconomyPhase, ForcedLoanRestructureOffer } from '../features/financeTypes';
import type {
  Activity,
  PendingLandSearchResults,
  PendingLenderSearchResults,
  PendingStaffCandidates
} from '../features/activityTypes';
import type { Staff, StaffTeam } from '../features/staffTypes';

export interface GameState {
  week: number;
  season: Season;
  currentYear: number;
  companyName: string;
  foundedYear: number;
  money: number;
  prestige: number;
  creditRating: number;
  economyPhase: EconomyPhase;
  activities?: Activity[];
  staff?: Staff[];
  teams?: StaffTeam[];
  pendingStaffCandidates?: PendingStaffCandidates;
  pendingLandSearchResults?: PendingLandSearchResults;
  pendingLenderSearchResults?: PendingLenderSearchResults;
  loanPenaltyWork?: number;
  pendingForcedLoanRestructure?: ForcedLoanRestructureOffer | null;
}
