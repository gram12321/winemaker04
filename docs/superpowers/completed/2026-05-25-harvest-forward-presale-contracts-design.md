# Harvest Forward and Pre-Sale Contracts (Minimal Design)
Created: 2026-05-25
Status: Implemented design record. Code-verified on 2026-07-14: wine pre-sale and harvest-forward lifecycles are present in current mainline, including persistence, UI, tick expiry/default handling, settlement, and Admin test fixtures.
Scope: Minimal v1 design; later balancing and deeper contract policy remain follow-up work.

Implementation note: v1 books advances as income, uses the configured 25% wine / 30% forward advance rates and 20% advance-based default penalty, allows the implemented forward target states including `any`, and generates offers through the weekly runtime/Admin test path. The open decisions below are retained as historical follow-up questions rather than current blockers.

## 1. Why This Is Two Features
The original 4.6 idea is valid but splits into two distinct systems:

1. Wine Pre-Sale Contracts (futures on bottled wine)
2. Harvest Forward Contracts (futures on grapes/must sold through bulk-sale channels)

They share a common concept (upfront cash now, delivery later), but they depend on different inventories, validation rules, and existing code paths.

## 2. Goals
1. Provide early-game liquidity before normal sales mature.
2. Teach contract-style delivery flow without heavy legal/board mechanics.
3. Reuse current systems where possible to keep complexity low.
4. Keep failures understandable with clear penalties and notifications.
5. Tie outcomes to prestige so reliable delivery supports reputation, while defaults hurt trust materially.

## 3. Non-Goals (v1)
1. No negotiation UI.
2. No hedging portfolio analytics.
3. No dynamic legal disputes/arbitration subsystem.
4. No partial quality scoring across blended deliveries.
5. No country-specific legal rule variants in v1.

## 4. Shared Contract Model (Conceptual)
Both systems use the same lifecycle concept:

- Offered: player can accept or reject.
- Accepted: player receives upfront payment immediately.
- Deliverable: delivery window opens.
- Fulfilled: delivery completed, final payment posted.
- Defaulted: delivery missed or invalid quality at deadline.

Shared economic terms:

- upfrontPercent: suggested v1 range 20-35%
- finalPercent: 100% - upfrontPercent
- defaultPenaltyPercentOnAdvance: suggested 10-25%

Default formula:

- totalContractValue = unitPrice * quantity
- upfrontPayment = round(totalContractValue * upfrontPercent)
- finalPayment = totalContractValue - upfrontPayment
- defaultPenalty = round(upfrontPayment * defaultPenaltyPercentOnAdvance)

Shared prestige terms:

- fulfillmentPrestigeFactor: small positive event compared to normal finished-wine contract fulfillment
- defaultPrestigePenaltyFactor: heavy negative event, intentionally stronger than rejection-level penalties

## 5. System A: Wine Pre-Sale Contracts

### 5.1 Definition
A customer prepays part of a bottled wine contract now. Player must deliver bottled wine later that meets a minimum quality requirement.

### 5.2 Reuse Strategy
Use existing wine contract architecture instead of building a parallel full contract engine.

Minimal extension to existing contract data:

- contractMode: 'spot' | 'wine_presale'
- upfrontPercent
- upfrontPaidAmount
- finalPaymentAmount
- acceptedWeek/Season/Year
- deliveryDueWeek/Season/Year
- defaultedWeek/Season/Year

Recommendation: extend existing wine_contracts table and types, rather than creating a separate wine presale table.

### 5.3 Rules (v1)
1. Acceptance posts finance transaction category Contract Advance In.
2. Delivery uses existing fulfill contract flow with minor branching for final payment settlement.
3. Quality requirement in v1:
- At least one requirement of tasteQuality OR structureIndex.
- Optional vintage requirement allowed.
4. If due date passes while still accepted+undelivered:
- Contract set to defaulted.
- Relationship penalty.
- Financial penalty = defaultPenalty.
5. Prestige integration:
- On fulfill, add a small prestige event (lower than normal finished-wine contract fulfillment).
- On default, add a heavy prestige penalty event in addition to cash penalty.

### 5.4 UI Surface
Sales > Contracts tab:

- Add a filter chip for Wine Pre-Sale.
- Pending card shows Upfront, Final, Due Date, Risk badge.
- Accept action and Reject action on offered state.
- Fulfill action only when accepted.

## 6. System B: Harvest Forward Contracts (Bulk Grapes/Must)

### 6.1 Definition
A grape buyer prepays part of a future bulk delivery. Player later delivers grapes/must using sellable states in the current sellGrapes flow.

### 6.2 Why Separate From Wine Contracts
This flow targets sellable raw states:

- grapes
- must_ready
- must_fermenting

It should integrate with sellGrapesService buyer logic, buyer seasonal caps, and buyer loyalty, not bottled wine contract rules.

### 6.3 New Data Shape (Dedicated Table)
Create dedicated table for clarity:

- grape_forward_contracts

Suggested columns:

- id (uuid)
- company_id
- buyer_id
- buyer_name
- target_state (grapes | must_ready | must_fermenting | any)
- target_grape (nullable for any)
- quantity_kg
- delivered_kg (default 0)
- unit_price_per_kg
- total_value
- upfront_percent
- upfront_paid_amount
- final_payment_amount
- status (offered | accepted | fulfilled | defaulted | rejected | expired)
- created_week/season/year
- due_week/season/year
- accepted_week/season/year (nullable)
- settled_week/season/year (nullable)

### 6.4 Rules (v1)
1. Acceptance posts transaction category Harvest Forward Advance In.
2. Delivery can be split across multiple sellable batches, but all deliveries must match target_state and optional target_grape.
3. On fulfillment:
- Post final payment.
- Apply buyer loyalty gain bonus (small multiplier vs normal sale).
4. On deadline miss:
- Mark defaulted.
- Penalty = defaultPenalty.
- Buyer loyalty penalty and optional temporary buyer multiplier penalty.
5. Prestige integration:
- On fulfill, add a small prestige event (smaller than bottled wine contract fulfillment and usually smaller than direct bottled-wine spot sales).
- On default, add a heavy prestige penalty event in addition to buyer loyalty and cash penalties.

### 6.5 UI Surface
Sales page:

- Add Forward Contracts panel in the bulk-selling area.
- Show remaining kg, due date, locked price per kg, and progress bar.
- Add Deliver Into Contract action from eligible sellable batches.

## 7. Tick and Service Integration

### 7.1 New Services
- src/lib/services/sales/presaleContractService.ts (wine presale logic wrappers around existing contract service)
- src/lib/services/sales/forwardContractService.ts (bulk forward lifecycle)

### 7.2 Existing Service Touchpoints
- contractGenerationService.ts: add occasional wine_presale offers.
- contractService.ts: accept/settle/default branches for presale mode.
- sellGrapesService.ts: optional route to deliver quantity into forward contracts before standard spot sale.
- gameTick.ts: weekly expiration/default checks for both systems.
- prestigeService.ts: add explicit event creators for presale/forward fulfill and default outcomes.

### 7.3 Prestige Integration and Scaling
Both systems should use the existing prestige event ledger patterns.

Lifecycle events:

- wine_presale_fulfilled: small positive prestige event
- wine_presale_defaulted: heavy negative prestige event
- forward_contract_fulfilled: small positive prestige event
- forward_contract_defaulted: heavy negative prestige event

Relative balancing target:

- fulfill prestige: intentionally below normal finished-wine contract fulfill events
- default prestige: intentionally larger magnitude than typical rejection/expiration penalties

Availability scaling by prestige:

- Wine pre-sale offer chance and contract size should scale with current company prestige (same direction as existing bottle contract opportunity logic).
- Harvest forward contract count/size should scale with prestige similarly to current buyer/supplier market scaling patterns.
- Low prestige: fewer/smaller pre-sale and forward offers.
- High prestige: more/larger offers, but still bounded by active-contract caps.

Suggested v1 implementation knobs:

- PRESALE_PRESTIGE_OFFER_CHANCE_MULTIPLIER
- PRESALE_PRESTIGE_SIZE_MULTIPLIER
- FORWARD_PRESTIGE_OFFER_COUNT_MULTIPLIER
- FORWARD_PRESTIGE_SIZE_MULTIPLIER
- PRESALE_FULFILL_PRESTIGE_BASE
- PRESALE_DEFAULT_PRESTIGE_BASE
- FORWARD_FULFILL_PRESTIGE_BASE
- FORWARD_DEFAULT_PRESTIGE_BASE

### 7.4 Finance Categories Needed
Add categories in finance constants (capital flow decision to be confirmed):

- CONTRACT_ADVANCE_IN
- CONTRACT_FINAL_SETTLEMENT_IN
- CONTRACT_DEFAULT_PENALTY_OUT
- FORWARD_ADVANCE_IN
- FORWARD_FINAL_SETTLEMENT_IN
- FORWARD_DEFAULT_PENALTY_OUT

Recommended accounting in v1:
- Treat advances and settlements as sales income events.
- Treat default penalties as expense.

## 8. Balancing Defaults (Minimal)
Initial suggested values for first test pass:

- wine presale upfrontPercent: 25%
- forward contract upfrontPercent: 30%
- defaultPenaltyPercentOnAdvance: 20%
- max active contracts early game:
- wine presale: 1
- forward contracts: 1
- fulfill prestige baseline:
- wine presale: +0.5 to +1.5 (small)
- forward: +0.3 to +1.0 (small)
- default prestige baseline:
- wine presale: -8 to -15 (heavy)
- forward: -6 to -12 (heavy)

Reason: preserves survival utility without turning contracts into infinite cash exploits.

## 9. Risk and Abuse Controls
1. Cap active accepted contracts by type.
2. Prevent same inventory quantity from being allocated twice.
3. Require explicit due date visibility and warning notifications.
4. Add default cooldown on same buyer for a short period (optional v1.1 if needed).
5. Clamp prestige-scaled offer growth to avoid runaway snowballing from high prestige.

## 10. Testing Plan (Design-Level)
1. Accept contract posts correct upfront transaction.
2. Fulfillment posts correct final settlement and status transitions.
3. Deadline miss triggers default, penalty, and notification.
4. Forward delivery enforces state/grape constraints.
5. No double-allocation of the same kg/bottles.
6. Buyer loyalty deltas behave as expected on fulfill vs default.
7. Fulfillment emits smaller prestige gains than normal finished-wine contract fulfillment.
8. Default emits heavy prestige penalties and stacks correctly with financial penalty.
9. Prestige changes offer count/size in expected direction for both wine presale and forward contracts.

## 11. Phased Delivery Recommendation
1. Phase A: Wine Pre-Sale (reuse contract system)
2. Phase B: Harvest Forward (bulk flow)
3. Phase C: shared UX polish and balancing pass

This reduces risk because Phase A reuses stable contract foundations, while Phase B adds the new state-aware forward delivery path.

## 12. Open Decisions For User Approval
1. Accounting: should upfront contract cash be treated as income immediately, or as deferred liability until delivery?
2. Penalty severity: fixed percent of advance (recommended) or full advance clawback + fee?
3. Forward contract target_state: allow any state in v1, or force grapes-only for first release?
4. Contract origin: should these be random offers only, or also available as a manual "request pre-sale" action?
5. Should repeated defaults apply an additional temporary prestige suppression to future contract availability (cooldown), or keep only direct event penalties in v1?
